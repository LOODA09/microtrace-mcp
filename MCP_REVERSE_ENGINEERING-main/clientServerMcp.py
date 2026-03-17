from typing import Optional
from contextlib import AsyncExitStack
import traceback
import asyncio
import sys
import logging
import json
import os
from datetime import datetime

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Configure logging
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/client.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ✅ UPDATED: More flexible system prompt
DEFAULT_SYSTEM_PROMPT = """You are a helpful STM32 Reverse Engineering Assistant.

Your capabilities:
- Search and explain STM32 registers from documentation
- Extract information from PDF datasheets
- Analyze memory maps and peripheral configurations
- Help with embedded systems troubleshooting

When helping users:
1. Listen to their question carefully
2. Use available tools if you need to look up information
3. Provide clear, technical answers in plain language
4. Include specific register details, addresses, and bit fields when relevant
5. Offer practical recommendations

Be conversational, accurate, and helpful. No need for special JSON formatting unless specifically requested."""


class MCPClient:
    def __init__(self, system_prompt: Optional[str] = None, api_key: Optional[str] = None):
        """Initialize MCP Client with optional API key"""
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.tools = []
        self.messages = []
        self.logger = logger
        
        # Get API key from parameter, environment, or hardcoded fallback
        self.api_key = (
            api_key or 
            os.getenv("OPENAI_API_KEY") or
            "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"
        )
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found")
        
        # Initialize OpenAI client
        self.llm = OpenAI(api_key=self.api_key)
        
        # Use provided system prompt, or environment variable, or default
        self.system_prompt = system_prompt or os.getenv("SYSTEM_PROMPT") or DEFAULT_SYSTEM_PROMPT
        
        # Initialize with system prompt
        if self.system_prompt:
            self._ensure_system_prompt()
    
    def _ensure_system_prompt(self):
        """Ensure system prompt is always at the beginning of messages"""
        if not self.system_prompt:
            return
        if not self.messages or self.messages[0].get("role") != "system":
            self.messages = [msg for msg in self.messages if msg.get("role") != "system"]
            self.messages.insert(0, {"role": "system", "content": self.system_prompt})
    
    def _limit_messages_preserving_system(self, max_messages: int):
        """Limit messages while preserving system prompt at position 0"""
        if len(self.messages) <= max_messages:
            return
        
        system_msg = None
        if self.messages and self.messages[0].get("role") == "system":
            system_msg = self.messages[0]
            other_messages = self.messages[1:]
        else:
            other_messages = self.messages
        
        if len(other_messages) > max_messages - 1:
            other_messages = other_messages[-(max_messages - 1):]
        
        if system_msg:
            self.messages = [system_msg] + other_messages
        else:
            self.messages = other_messages
            self._ensure_system_prompt()

    async def connect_to_server(self, server_script_path: str):
        try:
            is_python = server_script_path.endswith(".py")
            is_js = server_script_path.endswith(".js")
            if not (is_python or is_js):
                raise ValueError("Server script must be a .py or .js file")

            command = "python" if is_python else "node"
            server_params = StdioServerParameters(
                command=command, args=[server_script_path], env=None
            )

            stdio_transport = await self.exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            self.stdio, self.write = stdio_transport
            self.session = await self.exit_stack.enter_async_context(
                ClientSession(self.stdio, self.write)
            )

            await self.session.initialize()
            self.logger.info("✅ Connected to MCP server")

            mcp_tools = await self.get_mcp_tools()
            self.tools = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                }
                for tool in mcp_tools
            ]

            self.logger.info(f"📦 Available tools: {[tool['name'] for tool in self.tools]}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error connecting to MCP server: {e}")
            traceback.print_exc()
            raise

    async def get_mcp_tools(self):
        try:
            response = await self.session.list_tools()
            return response.tools
        except Exception as e:
            self.logger.error(f"Error getting MCP tools: {e}")
            raise

    async def process_query(self, query: str):
        try:
            self.logger.info(f"📝 Processing query: {query}")
            self.messages = []
            self._ensure_system_prompt()
            user_message = {"role": "user", "content": query}
            self.messages.append(user_message)

            max_iterations = 10
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                response = await self.call_llm()
                message = response.choices[0].message
                
                # No tool calls - final response
                if not message.tool_calls:
                    assistant_message = {
                        "role": "assistant",
                        "content": message.content or "I apologize, but I couldn't generate a response. Please try rephrasing your question.",
                    }
                    self.messages.append(assistant_message)
                    await self.log_conversation()
                    break

                # Tool calls present
                assistant_message = {
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            }
                        }
                        for tool_call in message.tool_calls
                    ],
                }
                self.messages.append(assistant_message)
                await self.log_conversation()

                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    tool_call_id = tool_call.id
                    
                    self.logger.info(f"🔧 Calling tool {tool_name} with args {tool_args}")
                    
                    try:
                        result = await self.session.call_tool(tool_name, tool_args)
                        
                        # Extract content from MCP result
                        content_text = ""
                        if hasattr(result, 'content') and result.content:
                            content_parts = []
                            for content_item in result.content:
                                if hasattr(content_item, 'text'):
                                    content_parts.append(content_item.text)
                                elif isinstance(content_item, str):
                                    content_parts.append(content_item)
                                else:
                                    content_parts.append(str(content_item))
                            content_text = "\n".join(content_parts) if content_parts else ""
                        else:
                            content_text = str(result)
                        
                        self.logger.info(f"✅ Tool result: {content_text[:200]}...")
                        
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": content_text,
                        })
                        await self.log_conversation()
                        
                    except Exception as e:
                        self.logger.error(f"❌ Error calling tool {tool_name}: {e}")
                        error_content = f"Error executing tool: {str(e)}"
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": error_content,
                        })

            return self.messages

        except Exception as e:
            self.logger.error(f"❌ Error processing query: {e}")
            traceback.print_exc()
            raise

    async def chat_loop(self):
        self.logger.info("🚀 Chat loop started. Type 'exit' to quit.")
        while True:
            try:
                query = input("\n💬 You: ")
                if query.lower() in ['exit', 'quit', 'q']:
                    break
                result = await self.process_query(query)
                last_message = result[-1]
                print(f"\n🤖 Assistant: {last_message['content']}\n")
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.logger.error(f"Error in chat loop: {e}")

    async def call_llm(self):
        try:
            self.logger.info("🧠 Calling LLM...")
            
            openai_tools = []
            for tool in self.tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool["description"],
                        "parameters": tool["input_schema"],
                    }
                })
            
            self._ensure_system_prompt()
            messages_to_send = self.messages.copy()
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.llm.chat.completions.create(
                    model="gpt-4o-mini",
                    max_tokens=2000,
                    messages=messages_to_send,
                    tools=openai_tools if openai_tools else None,
                    temperature=0.7,
                )
            )
            return response
            
        except Exception as e:
            self.logger.error(f"❌ Error calling LLM: {e}")
            raise

    async def cleanup(self):
        try:
            await self.exit_stack.aclose()
            self.logger.info("👋 Disconnected from MCP server")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")
            traceback.print_exc()

    async def log_conversation(self):
        os.makedirs("conversations", exist_ok=True)
        serializable_conversation = []

        for message in self.messages:
            try:
                serializable_message = {"role": message["role"], "content": []}

                if isinstance(message["content"], str):
                    serializable_message["content"] = message["content"]
                elif isinstance(message["content"], list):
                    for content_item in message["content"]:
                        if hasattr(content_item, "to_dict"):
                            serializable_message["content"].append(content_item.to_dict())
                        elif hasattr(content_item, "dict"):
                            serializable_message["content"].append(content_item.dict())
                        elif hasattr(content_item, "model_dump"):
                            serializable_message["content"].append(content_item.model_dump())
                        else:
                            serializable_message["content"].append(content_item)

                serializable_conversation.append(serializable_message)
            except Exception as e:
                self.logger.error(f"Error processing message: {str(e)}")

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filepath = os.path.join("conversations", f"conversation_{timestamp}.json")

        try:
            with open(filepath, "w") as f:
                json.dump(serializable_conversation, f, indent=2, default=str)
        except Exception as e:
            self.logger.error(f"Error writing conversation: {str(e)}")


async def main():
    client = MCPClient()
    try:
        await client.connect_to_server(r"C:\Users\khaled\Downloads\Compressed\Grad-project-main_2\Grad-project-main\MCP_REVERSE_ENGINEERING-main\server_mcp.py")
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
