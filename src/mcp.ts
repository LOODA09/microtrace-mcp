import { MCPConnector } from './mcpconnector';

export class MicroTraceMCPClient {
  private selectedText: string;
  private chatSessions: any[];
  private currentChatId: string | null;
  private currentMessages: any[];
  private uploadedFiles: File[];
  private els: any;
  public connector: MCPConnector;

  constructor() {
    this.selectedText = '';
    this.chatSessions = this.loadChatSessions();
    this.currentChatId = null;
    this.currentMessages = [];
    this.uploadedFiles = [];
    this.connector = new MCPConnector('http://127.0.0.1:8000', this);
    this.initElements();
    this.loadTheme();
    this.loadProfile();
    this.setupEventListeners();
    this.setupTextSelection();
    this.renderChatHistory();
    this.connector.initialize();
  }

  private initElements(): void {
    this.els = {
      sidebar: document.getElementById('sidebar'),
      toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
      newChatBtn: document.getElementById('newChatBtn'),
      clearChatBtn: document.getElementById('clearChatBtn'),
      exportChatBtn: document.getElementById('exportChatBtn'),
      connectBtn: document.getElementById('connectBtn'),
      themeSwitch: document.getElementById('themeSwitch'),
      modelSelector: document.getElementById('modelSelector'),
      chatHistory: document.getElementById('chatHistory'),
      messagesWrapper: document.getElementById('messagesWrapper'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      typingIndicator: document.getElementById('typingIndicator'),
      messageInput: document.getElementById('messageInput'),
      sendButton: document.getElementById('sendButton'),
      deepSearchButton: document.getElementById('deepSearchButton'),
      fileUploadBtn: document.getElementById('fileUploadBtn'),
      fileInput: document.getElementById('fileInput'),
      contextMenu: document.getElementById('contextMenu'),
      copyTextBtn: document.getElementById('copyTextBtn'),
      askChatBtn: document.getElementById('askChatBtn'),
      messagesContainer: document.getElementById('messagesContainer'),
      connectionStatus: document.getElementById('connectionStatus'),
      statusText: document.getElementById('statusText'),
      apiStatus: document.getElementById('apiStatus'),
      quickToolsPanel: document.getElementById('quickToolsPanel'),
      togglePanelBtn: document.getElementById('togglePanelBtn'),
      profileBubble: document.getElementById('profileBubble'),
      profileName: document.getElementById('profileName'),
      editProfileBtn: document.getElementById('editProfileBtn')
    };
  }

  private setupEventListeners(): void {
    this.els.toggleSidebarBtn.onclick = () => this.els.sidebar.classList.toggle('hidden');
    this.els.togglePanelBtn.onclick = () => this.els.quickToolsPanel.classList.toggle('collapsed');
    this.els.newChatBtn.onclick = () => this.createNewChat();
    this.els.clearChatBtn.onclick = () => this.clearChat();
    this.els.exportChatBtn.onclick = () => this.exportChat();
    this.els.connectBtn.onclick = () => this.connector.connectToServer();
    this.els.themeSwitch.onclick = () => this.toggleTheme();
    this.els.fileUploadBtn.onclick = () => this.els.fileInput.click();
    this.els.fileInput.onchange = (e: Event) => this.handleFileUpload(e);

    this.els.messageInput.oninput = () => {
      this.autoResize();
      const hasText = this.els.messageInput.value.trim();
      this.els.sendButton.disabled = !hasText;
      this.els.deepSearchButton.disabled = !hasText;
    };

    this.els.messageInput.onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    };

    this.els.sendButton.onclick = () => this.sendMessage();
    this.els.deepSearchButton.onclick = () => this.sendMessage(true);
    this.els.copyTextBtn.onclick = () => this.copyText();
    // Changed: Ask Chat now puts text in input box for editing instead of auto-sending
    this.els.askChatBtn.onclick = () => this.askSelectionForEdit();
    this.els.editProfileBtn.onclick = () => this.editProfile();

    document.getElementById('extractRegisterBtn')?.addEventListener('click', () => this.connector.handleExtractRegisters());
    document.getElementById('searchRegisterBtn')?.addEventListener('click', () => this.connector.handleSearchRegister());
    document.getElementById('getRegisterBtn')?.addEventListener('click', () => this.connector.handleGetRegister());
    document.getElementById('extractImagesBtn')?.addEventListener('click', () => this.connector.handleExtractImages());
    document.getElementById('getPdfTitlesBtn')?.addEventListener('click', () => this.connector.handleGetPdfTitles());

    document.addEventListener('click', (e: MouseEvent) => {
      if (!this.els.contextMenu.contains(e.target)) {
        this.els.contextMenu.classList.remove('show');
      }
    });
  }

  private setupTextSelection(): void {
    document.addEventListener('mouseup', () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const txt = sel?.toString().trim();
        if (txt && txt.length > 5 && sel) {
          this.selectedText = txt;
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          this.els.contextMenu.style.left = `${rect.left + window.scrollX}px`;
          this.els.contextMenu.style.top = `${rect.bottom + window.scrollY + 10}px`;
          this.els.contextMenu.classList.add('show');
        } else {
          this.els.contextMenu.classList.remove('show');
        }
      }, 10);
    });
  }

  private handleFileUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    this.uploadedFiles = [...this.uploadedFiles, ...files];
    this.notify(`📎 ${files.length} file(s) attached`);
    target.value = '';
  }

  private loadChatSessions(): any[] {
    try {
      const saved = localStorage.getItem('mcp-chat-sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  private saveChatSessions(): void {
    try {
      localStorage.setItem('mcp-chat-sessions', JSON.stringify(this.chatSessions));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  }

  public renderChatHistory(): void {
    this.els.chatHistory.innerHTML = '';
    this.chatSessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (session.id === this.currentChatId ? ' active' : '');
      item.innerHTML = `
        <span class="chat-item-text">${session.title}</span>
        <button class="chat-item-delete" title="Delete">×</button>
      `;
      
      item.querySelector('.chat-item-text')!.addEventListener('click', () => this.loadChatSession(session.id));
      (item.querySelector('.chat-item-delete') as HTMLButtonElement)!.onclick = (e: Event) => {
        e.stopPropagation();
        this.deleteChatSession(session.id);
      };
      
      this.els.chatHistory.appendChild(item);
    });
  }

  private createNewChat(): void {
    if (this.currentMessages.length > 0 && this.currentChatId) {
      this.saveChatSession();
    }

    this.currentChatId = Date.now().toString();
    this.currentMessages = [];
    this.clearMessages();
    this.connector.clearConversation();
    this.notify('✨ New chat started');
  }

  public saveChatSession(): void {
    if (this.currentMessages.length === 0) return;

    const firstUserMessage = this.currentMessages.find(m => m.role === 'user');
    const title = firstUserMessage ? 
      firstUserMessage.content.substring(0, 40) + (firstUserMessage.content.length > 40 ? '...' : '') : 
      'New Chat';

    const existingIndex = this.chatSessions.findIndex(s => s.id === this.currentChatId);
    const session = {
      id: this.currentChatId,
      title: title,
      messages: this.currentMessages,
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      this.chatSessions[existingIndex] = session;
    } else {
      this.chatSessions.unshift(session);
    }

    if (this.chatSessions.length > 50) {
      this.chatSessions = this.chatSessions.slice(0, 50);
    }

    this.saveChatSessions();
    this.renderChatHistory();
  }

  private loadChatSession(id: string): void {
    if (this.currentMessages.length > 0 && this.currentChatId) {
      this.saveChatSession();
    }

    const session = this.chatSessions.find(s => s.id === id);
    if (!session) return;

    this.currentChatId = id;
    this.currentMessages = session.messages;
    this.clearMessages();

    this.currentMessages.forEach(msg => this.renderMsg(msg));
    if (this.currentMessages.length > 0) {
      this.els.welcomeScreen.style.display = 'none';
    }

    this.renderChatHistory();
    this.scroll();
  }

  private deleteChatSession(id: string): void {
    if (!confirm('Delete this chat?')) return;

    this.chatSessions = this.chatSessions.filter(s => s.id !== id);
    this.saveChatSessions();
    this.renderChatHistory();

    if (this.currentChatId === id) {
      this.createNewChat();
    }

    this.notify('🗑️ Chat deleted');
  }

  private async clearChat(): Promise<void> {
    if (confirm('Clear this conversation?')) {
      this.currentMessages = [];
      this.clearMessages();
      await this.connector.clearConversation();
      this.notify('🗑️ Chat cleared');
    }
  }

  private clearMessages(): void {
    this.els.messagesWrapper.querySelectorAll('.message').forEach((m: Element) => m.remove());
    this.els.welcomeScreen.style.display = 'block';
    this.els.typingIndicator.classList.remove('active');
  }

  private async exportChat(): Promise<void> {
    if (this.currentMessages.length === 0) {
      this.notify('❌ No messages to export');
      return;
    }

    const content = this.currentMessages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('📥 Chat exported');
  }

  public updateConnectionStatus(connected: boolean, text: string): void {
    this.els.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    this.els.statusText.textContent = text;
  }

  public updateApiStatus(status: string): void {
    this.els.apiStatus.textContent = `API: ${status}`;
  }

  private autoResize(): void {
    this.els.messageInput.style.height = 'auto';
    this.els.messageInput.style.height = `${Math.min(this.els.messageInput.scrollHeight, 200)}px`;
  }

  public async sendMessage(deepSearch: boolean = false): Promise<void> {
    const content = this.els.messageInput.value.trim();
    if (!content) return;

    if (!this.currentChatId) {
      this.currentChatId = Date.now().toString();
    }

    if (this.els.welcomeScreen.parentElement) {
      this.els.welcomeScreen.style.display = 'none';
    }

    let messageContent = content;
    if (deepSearch) {
      messageContent = `[DEEP SEARCH] ${content}`;
    }
    if (this.uploadedFiles.length > 0) {
      messageContent += `\n\n📎 Attached files: ${this.uploadedFiles.map(f => f.name).join(', ')}`;
    }

    const userMessage = { role: 'user', content: messageContent };
    this.currentMessages.push(userMessage);
    this.renderMsg(userMessage);

    this.els.messageInput.value = '';
    this.els.messageInput.style.height = 'auto';
    this.els.sendButton.disabled = true;
    this.els.deepSearchButton.disabled = true;
    this.els.typingIndicator.classList.add('active');
    this.uploadedFiles = [];
    this.scroll();

    await this.connector.sendQuery(messageContent);
  }

  public handleQueryResponse(success: boolean, message?: any, error?: string): void {
    this.els.typingIndicator.classList.remove('active');

    if (success && message) {
      this.currentMessages.push(message);
      this.renderMsg(message);
      this.saveChatSession();
    } else if (error) {
      const errorMsg = { role: 'error', content: error };
      this.currentMessages.push(errorMsg);
      this.renderMsg(errorMsg);
    }

    this.scroll();
  }

  /**
   * Renders a message with copy button - ChatGPT style
   */
  public renderMsg(m: any): void {
    const el = document.createElement('div');
    el.className = `message ${m.role}`;

    let avatarText = 'AI';
    if (m.role === 'user') avatarText = 'U';
    if (m.role === 'error') avatarText = '❌';

    // Create avatar
    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = avatarText;
    el.appendChild(avatarEl);

    // Create message content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    // Create message content
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.innerHTML = this.formatContent(m.content);
    contentWrapper.appendChild(contentEl);

    // Create message actions (copy button) - only for assistant messages
    if (m.role === 'assistant' || m.role === 'user') {
      const actionsEl = this.createMessageActions(m.content, m.role);
      contentWrapper.appendChild(actionsEl);
    }

    el.appendChild(contentWrapper);
    this.els.messagesWrapper.appendChild(el);
  }

  /**
   * Creates message action buttons (copy button) - ChatGPT style
   */
  private createMessageActions(content: string, role: string): HTMLElement {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'message-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-action-btn copy-btn';
    copyBtn.setAttribute('data-tooltip', 'Copy to clipboard');
    copyBtn.innerHTML = `
      <span class="copy-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </span>
      <span class="check-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
      <span class="btn-text">Copy</span>
    `;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      this.copyMessageContent(content, copyBtn);
    };
    actionsEl.appendChild(copyBtn);

    return actionsEl;
  }

  /**
   * Copies message content to clipboard with visual feedback - ChatGPT style
   */
  private copyMessageContent(content: string, button: HTMLElement): void {
    // Strip HTML tags for plain text copy
    const plainText = this.stripHtml(content);
    
    navigator.clipboard.writeText(plainText).then(() => {
      // Show success state
      button.classList.add('copied');
      const textEl = button.querySelector('.btn-text');
      if (textEl) textEl.textContent = 'Copied!';
      
      // Reset after 2 seconds
      setTimeout(() => {
        button.classList.remove('copied');
        if (textEl) textEl.textContent = 'Copy';
      }, 2000);
      
      this.notify('📋 Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy:', err);
      this.notify('❌ Failed to copy');
    });
  }

  /**
   * Strips HTML tags from content for plain text copy
   */
  private stripHtml(html: string): string {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get text content
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up extra whitespace
    return text.trim();
  }

  private formatContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      if (parsed.ok !== undefined) {
        return this.formatStructuredResponse(parsed);
      }
    } catch (e) {}

    return content
      .replace(/\n/g, '<br>')
      .replace(/```([\s\S]*?)```/gs, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  private formatStructuredResponse(data: any): string {
    let html = '';

    if (data.task_summary) {
      html += `<div style="font-weight: 600; margin-bottom: 1rem;">${data.task_summary}</div>`;
    }

    if (data.technical_findings && data.technical_findings.length > 0) {
      html += '<div class="register-info">';
      html += '<div class="register-header">Technical Findings</div>';
      data.technical_findings.forEach((finding: string) => {
        html += `<div style="margin: 0.5rem 0;">• ${finding}</div>`;
      });
      html += '</div>';
    }

    if (data.recommendations && data.recommendations.length > 0) {
      html += '<div class="register-info">';
      html += '<div class="register-header">Recommendations</div>';
      data.recommendations.forEach((rec: string) => {
        html += `<div style="margin: 0.5rem 0;">• ${rec}</div>`;
      });
      html += '</div>';
    }

    return html || JSON.stringify(data, null, 2).replace(/\n/g, '<br>');
  }

  private copyText(): void {
    if (this.selectedText) {
      navigator.clipboard.writeText(this.selectedText).then(() => {
        this.notify('📋 Copied');
        this.els.contextMenu.classList.remove('show');
      });
    }
  }

  /**
   * Ask Chat - puts selected text in input box for editing (like ChatGPT)
   * Does NOT auto-send, allows user to edit before sending
   */
  private askSelectionForEdit(): void {
    if (this.selectedText) {
      // Put text in input box for editing
      this.els.messageInput.value = `Explain this: "${this.selectedText}"`;
      
      // Enable send button
      this.els.sendButton.disabled = false;
      this.els.deepSearchButton.disabled = false;
      
      // Focus the input and move cursor to end
      this.els.messageInput.focus();
      this.els.messageInput.setSelectionRange(
        this.els.messageInput.value.length, 
        this.els.messageInput.value.length
      );
      
      // Auto-resize the input
      this.autoResize();
      
      // Hide context menu
      this.els.contextMenu.classList.remove('show');
      
      // Notify user
      this.notify('💬 Edit and press Enter to send');
      
      // Scroll to input
      this.els.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private toggleTheme(): void {
    const curr = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = curr === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('microtrace-theme', newTheme);
    this.notify(`🎨 ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode`);
  }

  private loadTheme(): void {
    const saved = localStorage.getItem('microtrace-theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
  }

  private scroll(): void {
    if (this.els.messagesContainer) {
      this.els.messagesContainer.scrollTop = this.els.messagesContainer.scrollHeight;
    }
  }

  private loadProfile(): void {
    const name = localStorage.getItem('userName') || 'User';
    this.els.profileName.textContent = name;
    this.els.profileBubble.textContent = name.charAt(0).toUpperCase();
  }

  private saveProfile(name: string): void {
    localStorage.setItem('userName', name);
  }

  private editProfile(): void {
    const currentName = this.els.profileName.textContent || 'User';
    const newName = prompt('Enter your name:', currentName);
    if (newName && newName.trim()) {
      const trimmedName = newName.trim();
      this.els.profileName.textContent = trimmedName;
      this.els.profileBubble.textContent = trimmedName.charAt(0).toUpperCase();
      this.saveProfile(trimmedName);
    }
  }

  public notify(msg: string): void {
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:100px;right:20px;background:var(--bg-secondary);color:var(--text-main);padding:1rem 1.5rem;border-radius:10px;border:1px solid var(--border);box-shadow:var(--shadow-lg);z-index:10001;animation:slideInRight 0.3s ease;font-weight:500;max-width:300px;';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => n.remove(), 300);
    }, 3000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MicroTraceMCPClient());
} else {
  new MicroTraceMCPClient();
}
