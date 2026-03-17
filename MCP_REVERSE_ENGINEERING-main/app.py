from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from clientServerMcp import MCPClient
import asyncio
import logging
import os
import json
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import openai

load_dotenv()

# Configure OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")
openai.api_key = OPENAI_API_KEY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Verify API key
if not OPENAI_API_KEY:
    logger.warning("⚠️ OpenAI API key not found!")
else:
    logger.info("✅ OpenAI API key loaded")

# Global MCP client instance
mcp_client: Optional[MCPClient] = None

# Request/Response models
class QueryRequest(BaseModel):
    query: str
    reset_conversation: bool = False
    max_messages_context: Optional[int] = None
    max_messages_return: Optional[int] = None

class ConnectRequest(BaseModel):
    server_script_path: str

class QueryResponse(BaseModel):
    messages: List[Dict[str, Any]]
    success: bool
    error: Optional[str] = None

class ToolsResponse(BaseModel):
    tools: List[Dict[str, Any]]
    success: bool

class StatusResponse(BaseModel):
    connected: bool
    tools_count: int

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global mcp_client
    system_prompt = os.getenv("SYSTEM_PROMPT", None)
    
    mcp_client = MCPClient(
        system_prompt=system_prompt,
        api_key=OPENAI_API_KEY
    )
    
    logger.info("✅ MCP Client initialized")
    
    if system_prompt:
        logger.info("✅ System prompt loaded from environment")
    else:
        logger.info("✅ Using default system prompt")
    
    yield
    
    # Shutdown
    if mcp_client:
        try:
            await mcp_client.cleanup()
            logger.info("👋 MCP Client cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Create FastAPI app
app = FastAPI(
    title="MCP Client API",
    description="API for interacting with MCP (Model Context Protocol) server",
    version="1.0.0",
    lifespan=lifespan
)

# CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get MCP client
async def get_client() -> MCPClient:
    if mcp_client is None:
        raise HTTPException(status_code=503, detail="MCP Client not initialized")
    return mcp_client

# Routes
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "message": "MCP Client API is running",
        "status": "healthy",
        "openai_configured": bool(OPENAI_API_KEY)
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "client_initialized": mcp_client is not None,
        "openai_configured": bool(OPENAI_API_KEY)
    }

@app.post("/connect", response_model=ToolsResponse)
async def connect_to_server(request: ConnectRequest, client: MCPClient = Depends(get_client)):
    """Connect to an MCP server"""
    try:
        if not os.path.exists(request.server_script_path):
            raise HTTPException(
                status_code=404,
                detail=f"Server script not found: {request.server_script_path}"
            )
        
        await client.connect_to_server(request.server_script_path)
        tools = await client.get_mcp_tools()
        
        tools_list = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema,
            }
            for tool in tools
        ]
        
        logger.info(f"✅ Connected to MCP server - {len(tools_list)} tools available")
        return ToolsResponse(tools=tools_list, success=True)
        
    except Exception as e:
        logger.error(f"❌ Error connecting to server: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest, client: MCPClient = Depends(get_client)):
    """Process a query using the MCP client"""
    try:
        if not client.session:
            raise HTTPException(
                status_code=400,
                detail="Not connected to MCP server. Please connect first using /connect"
            )

        # Process the query
        if request.reset_conversation:
            messages = await client.process_query(request.query)
            if request.max_messages_return and len(messages) > request.max_messages_return:
                messages = messages[-request.max_messages_return:]
        else:
            client._ensure_system_prompt()
            user_message = {"role": "user", "content": request.query}
            client.messages.append(user_message)

            if request.max_messages_context:
                client._limit_messages_preserving_system(request.max_messages_context)

            max_iterations = 10
            iteration = 0

            while iteration < max_iterations:
                iteration += 1

                # Call LLM
                response = await client.call_llm()
                message = response.choices[0].message

                if not message.tool_calls:
                    assistant_message = {
                        "role": "assistant",
                        "content": message.content,
                    }
                    client.messages.append(assistant_message)
                    await client.log_conversation()
                    break

                # Handle tool calls
                assistant_message = {
                    "role": "assistant",
                    "content": message.content,
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
                client.messages.append(assistant_message)
                await client.log_conversation()

                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    tool_call_id = tool_call.id

                    logger.info(f"🔧 Calling tool {tool_name} with args {tool_args}")

                    try:
                        result = await client.session.call_tool(tool_name, tool_args)
                        
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

                        logger.info(f"✅ Tool {tool_name} result: {content_text[:200]}...")

                        client.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": content_text,
                        })
                        await client.log_conversation()

                    except Exception as e:
                        logger.error(f"❌ Error calling tool {tool_name}: {e}")
                        error_content = f"Error executing tool: {str(e)}"
                        client.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": error_content,
                        })

            messages = client.messages

            if request.max_messages_return and len(messages) > request.max_messages_return:
                messages = messages[-request.max_messages_return:]

        # Convert messages to serializable format
        serializable_messages = []
        for msg in messages:
            serializable_msg = {
                "role": msg.get("role"),
                "content": msg.get("content", ""),
            }
            if "tool_calls" in msg:
                serializable_msg["tool_calls"] = msg["tool_calls"]
            if "tool_call_id" in msg:
                serializable_msg["tool_call_id"] = msg["tool_call_id"]
            serializable_messages.append(serializable_msg)

        return QueryResponse(messages=serializable_messages, success=True)

    # ✅ HANDLE OPENAI QUOTA ERROR
    except openai.RateLimitError as e:
        error_msg = "OpenAI API quota exceeded. Please add credits to your account at https://platform.openai.com/account/billing"
        logger.error(f"❌ {error_msg}: {e}")
        return QueryResponse(
            messages=[{
                "role": "error",
                "content": error_msg
            }],
            success=False,
            error=error_msg
        )
    except Exception as e:
        error_msg = f"Error processing query: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return QueryResponse(
            messages=[{
                "role": "error",
                "content": error_msg
            }],
            success=False,
            error=error_msg
        )

@app.get("/tools", response_model=ToolsResponse)
async def get_tools(client: MCPClient = Depends(get_client)):
    """Get available MCP tools"""
    try:
        if not client.session:
            raise HTTPException(
                status_code=400,
                detail="Not connected to MCP server. Please connect first using /connect"
            )

        tools = await client.get_mcp_tools()
        tools_list = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema,
            }
            for tool in tools
        ]

        return ToolsResponse(tools=tools_list, success=True)

    except Exception as e:
        logger.error(f"Error getting tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status", response_model=StatusResponse)
async def get_status(client: MCPClient = Depends(get_client)):
    """Get current connection status"""
    try:
        connected = client.session is not None
        tools_count = len(client.tools) if client.tools else 0

        return StatusResponse(connected=connected, tools_count=tools_count)

    except Exception as e:
        logger.error(f"Error getting status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversation/clear")
async def clear_conversation(client: MCPClient = Depends(get_client)):
    """Clear the conversation history"""
    try:
        client.messages = []
        client._ensure_system_prompt()
        logger.info("🗑️ Conversation history cleared")
        return {"success": True, "message": "Conversation history cleared"}

    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversation/history", response_model=QueryResponse)
async def get_conversation_history(client: MCPClient = Depends(get_client)):
    """Get the current conversation history"""
    try:
        serializable_messages = []
        for msg in client.messages:
            serializable_msg = {
                "role": msg.get("role"),
                "content": msg.get("content", ""),
            }
            if "tool_calls" in msg:
                serializable_msg["tool_calls"] = msg["tool_calls"]
            if "tool_call_id" in msg:
                serializable_msg["tool_call_id"] = msg["tool_call_id"]
            serializable_messages.append(serializable_msg)

        return QueryResponse(messages=serializable_messages, success=True)

    except Exception as e:
        logger.error(f"Error getting conversation history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting MCP Client API Server...")
    logger.info("📍 Server: http://127.0.0.1:8000")
    logger.info("📖 Docs: http://127.0.0.1:8000/docs")
    
    uvicorn.run(app, host="127.0.0.1", port=8000)
