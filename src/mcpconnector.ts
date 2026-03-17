import { MicroTraceMCPClient } from './mcp';

export class MCPConnector {
  private apiUrl: string;
  private serverPath: string;
  private connected: boolean;
  private client: MicroTraceMCPClient;

  constructor(apiUrl: string, client: MicroTraceMCPClient) {
    this.apiUrl = apiUrl;
    this.serverPath = 'server_mcp.py';
    this.connected = false;
    this.client = client;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async initialize(): Promise<void> {
    await this.checkHealth();
  }

  private async checkHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      const data = await response.json();
      this.client.updateConnectionStatus(data.status === 'healthy', 'API Ready');
      this.client.updateApiStatus(data.status);

      if (data.status === 'healthy') {
        await this.connectToServer();
      }
    } catch (error) {
      this.client.updateConnectionStatus(false, 'API Offline');
      this.client.updateApiStatus('Offline');
      console.error('Health check failed:', error);
    }
  }

  public async connectToServer(): Promise<void> {
    try {
      this.client.notify('🔌 Connecting to MCP server...');
      const response = await fetch(`${this.apiUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_script_path: this.serverPath })
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.connected = true;
      this.client.updateConnectionStatus(true, `Connected (${data.tools.length} tools)`);
      this.client.notify(`✅ Connected! ${data.tools.length} tools available`);
    } catch (error: any) {
      this.connected = false;
      this.client.updateConnectionStatus(false, 'Connection Failed');
      this.client.notify(`❌ Connection failed: ${error.message}`);
      console.error('Connection error:', error);
    }
  }

  public async sendQuery(query: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query,
          reset_conversation: false,
          max_messages_return: 1
        })
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        const lastMessage = data.messages[data.messages.length - 1];
        if (lastMessage.role === 'assistant') {
          this.client.handleQueryResponse(true, lastMessage);
          return;
        }
      }

      this.client.handleQueryResponse(false, undefined, 'No response from server');
    } catch (error: any) {
      const errorMsg = `Error: ${error.message}. Make sure the FastAPI server is running at ${this.apiUrl}`;
      this.client.handleQueryResponse(false, undefined, errorMsg);
      console.error('Query error:', error);
    }
  }

  public async clearConversation(): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/conversation/clear`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to clear conversation:', e);
    }
  }

  public async handleExtractRegisters(): Promise<void> {
    const pdfPath = prompt('Enter PDF file path (e.g., C:\\path\\to\\stm32.pdf):');
    if (!pdfPath) return;
    
    const btn = document.getElementById('extractRegisterBtn');
    btn?.classList.add('loading');
    
    try {
      const query = `Extract all registers from "${pdfPath}"`;
      await this.sendToolQuery(query);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  public async handleSearchRegister(): Promise<void> {
    const registerName = prompt('Enter register name to search (e.g., CRC_DR):');
    if (!registerName) return;
    
    const btn = document.getElementById('searchRegisterBtn');
    btn?.classList.add('loading');
    
    try {
      const query = `Search for register "${registerName}"`;
      await this.sendToolQuery(query);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  public async handleGetRegister(): Promise<void> {
    const registerName = prompt('Enter exact register name (e.g., CRC_DR):');
    if (!registerName) return;
    
    const btn = document.getElementById('getRegisterBtn');
    btn?.classList.add('loading');
    
    try {
      const query = `Get register "${registerName}" with all details`;
      await this.sendToolQuery(query);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  public async handleExtractImages(): Promise<void> {
    const pdfPath = prompt('Enter PDF file path:');
    if (!pdfPath) return;
    
    const startPage = prompt('Enter start page (e.g., 122):');
    if (!startPage) return;
    
    const endPage = prompt('Enter end page (e.g., 125):');
    if (!endPage) return;
    
    const btn = document.getElementById('extractImagesBtn');
    btn?.classList.add('loading');
    
    try {
      const query = `Extract images from "${pdfPath}" pages ${startPage} to ${endPage}`;
      await this.sendToolQuery(query);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  public async handleGetPdfTitles(): Promise<void> {
    const pdfPath = prompt('Enter PDF file path:');
    if (!pdfPath) return;
    
    const btn = document.getElementById('getPdfTitlesBtn');
    btn?.classList.add('loading');
    
    try {
      const query = `Get table of contents from "${pdfPath}"`;
      await this.sendToolQuery(query);
    } finally {
      btn?.classList.remove('loading');
    }
  }

  private async sendToolQuery(query: string): Promise<void> {
    if (!this.connected) {
      this.client.notify('❌ Not connected to server');
      return;
    }
    
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    
    messageInput.value = query;
    sendButton.disabled = false;
    await this.client.sendMessage();
  }
}
