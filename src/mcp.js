import { MCPConnector } from './mcpconnector';

export class MicroTraceMCPClient {
    constructor() {
        this.selectedText = '';
        this.chatSessions = this.loadChatSessions();
        this.currentChatId = null;
        this.currentMessages = [];
        this.uploadedFiles = [];
        this.connector = new MCPConnector('http://127.0.0.1:8000', this);
        this.initElements();
        this.loadTheme();
        this.setupEventListeners();
        this.setupTextSelection();
        this.renderChatHistory();
        this.connector.initialize();
    }

    initElements() {
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
            togglePanelBtn: document.getElementById('togglePanelBtn')
        };
    }

    setupEventListeners() {
        var _a, _b, _c, _d, _e;
        this.els.toggleSidebarBtn.onclick = () => this.els.sidebar.classList.toggle('hidden');
        this.els.togglePanelBtn.onclick = () => this.els.quickToolsPanel.classList.toggle('collapsed');
        this.els.newChatBtn.onclick = () => this.createNewChat();
        this.els.clearChatBtn.onclick = () => this.clearChat();
        this.els.exportChatBtn.onclick = () => this.exportChat();
        this.els.connectBtn.onclick = () => this.connector.connectToServer();
        this.els.themeSwitch.onclick = () => this.toggleTheme();
        this.els.fileUploadBtn.onclick = () => this.els.fileInput.click();
        this.els.fileInput.onchange = (e) => this.handleFileUpload(e);

        this.els.messageInput.oninput = () => {
            this.autoResize();
            const hasText = this.els.messageInput.value.trim();
            this.els.sendButton.disabled = !hasText;
            this.els.deepSearchButton.disabled = !hasText;
        };

        this.els.messageInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        this.els.sendButton.onclick = () => this.sendMessage();
        this.els.deepSearchButton.onclick = () => this.sendMessage(true);
        this.els.copyTextBtn.onclick = () => this.copyText();
        this.els.askChatBtn.onclick = () => this.askSelectionForEdit();

        (_a = document.getElementById('extractRegisterBtn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.connector.handleExtractRegisters());
        (_b = document.getElementById('searchRegisterBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => this.connector.handleSearchRegister());
        (_c = document.getElementById('getRegisterBtn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => this.connector.handleGetRegister());
        (_d = document.getElementById('extractImagesBtn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this.connector.handleExtractImages());
        (_e = document.getElementById('getPdfTitlesBtn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => this.connector.handleGetPdfTitles());

        document.addEventListener('click', (e) => {
            if (!this.els.contextMenu.contains(e.target)) {
                this.els.contextMenu.classList.remove('show');
            }
        });
    }

    setupTextSelection() {
        document.addEventListener('mouseup', () => {
            setTimeout(() => {
                const sel = window.getSelection();
                const txt = sel === null || sel === void 0 ? void 0 : sel.toString().trim();
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

    handleFileUpload(event) {
        const target = event.target;
        const files = Array.from(target.files || []);
        this.uploadedFiles = [...this.uploadedFiles, ...files];
        this.notify(`${files.length} file(s) attached`, 'info');
        target.value = '';
    }

    loadChatSessions() {
        try {
            const saved = localStorage.getItem('mcp-chat-sessions');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    saveChatSessions() {
        try {
            localStorage.setItem('mcp-chat-sessions', JSON.stringify(this.chatSessions));
        } catch (e) {
            console.error('Failed to save chat sessions:', e);
        }
    }

    renderChatHistory() {
        this.els.chatHistory.innerHTML = '';
        this.chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'chat-item' + (session.id === this.currentChatId ? ' active' : '');
            item.innerHTML = `<span class="chat-item-text">${session.title}</span><button class="chat-item-delete" title="Delete">x</button>`;
            item.querySelector('.chat-item-text').addEventListener('click', () => this.loadChatSession(session.id));
            item.querySelector('.chat-item-delete').onclick = (e) => { e.stopPropagation(); this.deleteChatSession(session.id); };
            this.els.chatHistory.appendChild(item);
        });
    }

    createNewChat() {
        if (this.currentMessages.length > 0 && this.currentChatId) this.saveChatSession();
        this.currentChatId = Date.now().toString();
        this.currentMessages = [];
        this.clearMessages();
        this.connector.clearConversation();
        this.notify('New chat started', 'success');
    }

    saveChatSession() {
        if (this.currentMessages.length === 0) return;
        const firstUserMessage = this.currentMessages.find(m => m.role === 'user');
        const title = firstUserMessage ? firstUserMessage.content.substring(0, 40) + (firstUserMessage.content.length > 40 ? '...' : '') : 'New Chat';
        const existingIndex = this.chatSessions.findIndex(s => s.id === this.currentChatId);
        const session = { id: this.currentChatId, title, messages: this.currentMessages, timestamp: Date.now() };
        if (existingIndex >= 0) this.chatSessions[existingIndex] = session;
        else this.chatSessions.unshift(session);
        if (this.chatSessions.length > 50) this.chatSessions = this.chatSessions.slice(0, 50);
        this.saveChatSessions();
        this.renderChatHistory();
    }

    loadChatSession(id) {
        if (this.currentMessages.length > 0 && this.currentChatId) this.saveChatSession();
        const session = this.chatSessions.find(s => s.id === id);
        if (!session) return;
        this.currentChatId = id;
        this.currentMessages = session.messages;
        this.clearMessages();
        this.currentMessages.forEach(msg => this.renderMsg(msg));
        if (this.currentMessages.length > 0) this.els.welcomeScreen.style.display = 'none';
        this.renderChatHistory();
        this.scroll();
    }

    deleteChatSession(id) {
        if (!confirm('Delete this chat?')) return;
        this.chatSessions = this.chatSessions.filter(s => s.id !== id);
        this.saveChatSessions();
        this.renderChatHistory();
        if (this.currentChatId === id) this.createNewChat();
        this.notify('Chat deleted', 'success');
    }

    async clearChat() {
        if (confirm('Clear this conversation?')) {
            this.currentMessages = [];
            this.clearMessages();
            await this.connector.clearConversation();
            this.notify('Chat cleared', 'success');
        }
    }

    clearMessages() {
        this.els.messagesWrapper.querySelectorAll('.message').forEach((m) => m.remove());
        this.els.welcomeScreen.style.display = 'block';
        this.els.typingIndicator.classList.remove('active');
    }

    async exportChat() {
        if (this.currentMessages.length === 0) { this.notify('No messages to export', 'warning'); return; }
        const content = this.currentMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n---\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcp-chat-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.notify('Chat exported successfully', 'success');
    }

    updateConnectionStatus(connected, text) {
        this.els.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        this.els.statusText.textContent = text;
    }

    updateApiStatus(status) { this.els.apiStatus.textContent = `API: ${status}`; }

    autoResize() {
        this.els.messageInput.style.height = 'auto';
        this.els.messageInput.style.height = `${Math.min(this.els.messageInput.scrollHeight, 200)}px`;
    }

    async sendMessage(deepSearch = false) {
        const content = this.els.messageInput.value.trim();
        if (!content) return;
        if (!this.currentChatId) this.currentChatId = Date.now().toString();
        if (this.els.welcomeScreen.parentElement) this.els.welcomeScreen.style.display = 'none';
        let messageContent = content;
        if (deepSearch) messageContent = `[DEEP SEARCH] ${content}`;
        if (this.uploadedFiles.length > 0) messageContent += `\n\nAttached files: ${this.uploadedFiles.map(f => f.name).join(', ')}`;
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

    handleQueryResponse(success, message, error) {
        this.els.typingIndicator.classList.remove('active');
        if (success && message) { this.currentMessages.push(message); this.renderMsg(message); this.saveChatSession(); }
        else if (error) { const errorMsg = { role: 'error', content: error }; this.currentMessages.push(errorMsg); this.renderMsg(errorMsg); this.notify(error, 'error'); }
        this.scroll();
    }

    renderMsg(m) {
        const el = document.createElement('div');
        el.className = `message ${m.role}`;
        let avatarText = 'AI';
        if (m.role === 'user') avatarText = 'U';
        if (m.role === 'error') avatarText = '!';
        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        avatarEl.textContent = avatarText;
        el.appendChild(avatarEl);
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.innerHTML = this.formatContent(m.content);
        contentWrapper.appendChild(contentEl);
        if (m.role === 'assistant' || m.role === 'user') {
            const actionsEl = this.createMessageActions(m.content, m.role);
            contentWrapper.appendChild(actionsEl);
        }
        el.appendChild(contentWrapper);
        this.els.messagesWrapper.appendChild(el);
    }

    createMessageActions(content, role) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'message-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-action-btn copy-btn';
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;
        copyBtn.onclick = (e) => { e.stopPropagation(); this.copyMessageContent(content, copyBtn); };
        actionsEl.appendChild(copyBtn);
        return actionsEl;
    }

    copyMessageContent(content, button) {
        const plainText = this.stripHtml(content);
        navigator.clipboard.writeText(plainText).then(() => {
            button.classList.add('copied');
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>`;
            this.notify('Copied to clipboard', 'success');
            setTimeout(() => { button.classList.remove('copied'); button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`; }, 2000);
        }).catch((err) => { console.error('Failed to copy:', err); this.notify('Failed to copy', 'error'); });
    }

    stripHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return (tempDiv.textContent || tempDiv.innerText || '').trim();
    }

    formatContent(content) {
        try { const parsed = JSON.parse(content); if (parsed.ok !== undefined) return this.formatStructuredResponse(parsed); } catch (e) {}
        return content.replace(/\n/g, '<br>').replace(/```([\s\S]*?)```/gs, '<pre><code>$1</code></pre>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    formatStructuredResponse(data) {
        let html = '';
        if (data.task_summary) html += `<div style="font-weight:600;margin-bottom:1rem;">${data.task_summary}</div>`;
        if (data.technical_findings && data.technical_findings.length > 0) { html += '<div class="register-info"><div class="register-header">Technical Findings</div>'; data.technical_findings.forEach((f) => { html += `<div style="margin:0.5rem 0;">- ${f}</div>`; }); html += '</div>'; }
        if (data.recommendations && data.recommendations.length > 0) { html += '<div class="register-info"><div class="register-header">Recommendations</div>'; data.recommendations.forEach((r) => { html += `<div style="margin:0.5rem 0;">- ${r}</div>`; }); html += '</div>'; }
        return html || JSON.stringify(data, null, 2).replace(/\n/g, '<br>');
    }

    copyText() {
        if (this.selectedText) {
            navigator.clipboard.writeText(this.selectedText).then(() => { this.notify('Copied', 'success'); this.els.contextMenu.classList.remove('show'); });
        }
    }

    askSelectionForEdit() {
        if (this.selectedText) {
            this.els.messageInput.value = `Explain this: "${this.selectedText}"`;
            this.els.sendButton.disabled = false;
            this.els.deepSearchButton.disabled = false;
            this.els.messageInput.focus();
            this.els.messageInput.setSelectionRange(this.els.messageInput.value.length, this.els.messageInput.value.length);
            this.autoResize();
            this.els.contextMenu.classList.remove('show');
            this.notify('Edit and press Enter to send', 'info');
            this.els.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    toggleTheme() {
        const curr = document.body.getAttribute('data-theme') || 'dark';
        const newTheme = curr === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('microtrace-theme', newTheme);
        this.notify(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`, 'info');
    }

    loadTheme() { const saved = localStorage.getItem('microtrace-theme') || 'dark'; document.body.setAttribute('data-theme', saved); }

    scroll() { if (this.els.messagesContainer) this.els.messagesContainer.scrollTop = this.els.messagesContainer.scrollHeight; }

    // ========== MODERN TOAST NOTIFICATION SYSTEM ==========
    notify(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        };

        toast.innerHTML = `
            <div class="toast-icon-wrapper">
                <div class="toast-icon">${icons[type]}</div>
                <div class="toast-ripple"></div>
            </div>
            <div class="toast-body">
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="toast-progress"><div class="toast-progress-bar"></div></div>
        `;

        // Close button
        toast.querySelector('.toast-close').onclick = () => this.removeToast(toast);

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-enter');
        });

        // Auto remove after 3.5 seconds
        setTimeout(() => this.removeToast(toast), 3500);
    }

    removeToast(toast) {
        if (!toast || toast.classList.contains('toast-exit')) return;
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MicroTraceMCPClient());
} else {
    new MicroTraceMCPClient();
}