import { FunctionListViewer } from "../modules/functionListViewer";
import { SyncManager } from "../infrastructure/SyncManager";

// Type definition for DrawerState if not imported or available
interface DrawerState {
  functionListHeight: number;
  aiDrawerHeight: number;
  isFunctionListCollapsed: boolean;
  isAiDrawerCollapsed: boolean;
}

export class DrawerManager {
  private container: HTMLElement;
  private functionList: HTMLElement;
  private splitter: HTMLElement;
  private aiDrawer: HTMLElement;
  private state: DrawerState;

  private startY: number = 0;
  private startHeight: number = 0;
  private isDragging: boolean = false;

  private viewer: FunctionListViewer;

  constructor() {
    this.container = document.getElementById("left-drawer-column")!;
    this.functionList = document.getElementById("function-list-drawer")!;
    this.splitter = document.getElementById("drawer-splitter")!;
    this.aiDrawer = document.getElementById("ai-drawer")!;

    this.viewer = new FunctionListViewer("function-list-content");

    // Default state
    this.state = {
      functionListHeight: 50, // Percentage
      aiDrawerHeight: 50,
      isFunctionListCollapsed: false,
      isAiDrawerCollapsed: false,
    };

    this.loadState();
    this.initResize();
    this.initButtons();
    this.applyState();
  }

  private loadState() {
    const stored = localStorage.getItem("drawerState");
    if (stored) {
      try {
        this.state = { ...this.state, ...JSON.parse(stored) };
      } catch (e) {
        console.error("Failed to parse drawer state", e);
      }
    }
  }

  private saveState() {
    localStorage.setItem("drawerState", JSON.stringify(this.state));
  }

  private applyState() {
    const funcList = this.functionList;
    const aiDrawer = this.aiDrawer;
    const splitter = this.splitter;

    // Cases:
    // 1. Both Open
    // 2. Func Open, AI Closed
    // 3. Func Closed, AI Open
    // 4. Both Closed

    // Common elements
    const container = this.container;
    const vSplitter = document.getElementById("vertical-splitter");

    // Check if everything is closed
    const allClosed =
      this.state.isFunctionListCollapsed && this.state.isAiDrawerCollapsed;

    if (allClosed) {
      container.style.display = "none";
      if (vSplitter) vSplitter.style.display = "none";
      // We don't technically need to hide inner drawers if container is hidden, but let's keep consistent state
      funcList.style.display = "none";
      aiDrawer.style.display = "none";
      splitter.style.display = "none";
    } else {
      // Something is open
      container.style.display = "flex";
      if (vSplitter) vSplitter.style.display = "block";

      if (
        !this.state.isFunctionListCollapsed &&
        !this.state.isAiDrawerCollapsed
      ) {
        // Both Open
        funcList.style.display = "flex";
        aiDrawer.style.display = "flex";
        splitter.style.display = "block";
        funcList.style.height = `${this.state.functionListHeight}%`;
        aiDrawer.style.height = `${this.state.aiDrawerHeight}%`;
      } else if (
        !this.state.isFunctionListCollapsed &&
        this.state.isAiDrawerCollapsed
      ) {
        // Func Open only
        funcList.style.display = "flex";
        aiDrawer.style.display = "none";
        splitter.style.display = "none";
        funcList.style.height = "100%";
      } else if (
        this.state.isFunctionListCollapsed &&
        !this.state.isAiDrawerCollapsed
      ) {
        // AI Open only
        funcList.style.display = "none";
        aiDrawer.style.display = "flex";
        splitter.style.display = "none";
        aiDrawer.style.height = "100%";
      }
    }

    // Always notify layout resize after state change because main column might have expanded/shrunk
    // Always notify layout resize after state change because main column might have expanded/shrunk
    SyncManager.getInstance().emit("layout-resize", undefined);
  }

  private initResize() {
    this.initVerticalResize();
    this.initHorizontalResize();
  }

  private initVerticalResize() {
    // Width resizing of the entire left drawer column
    const vSplitter = document.getElementById("vertical-splitter");
    if (!vSplitter) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    vSplitter.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = this.container.getBoundingClientRect().width;
      document.body.style.cursor = "col-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startX;
      let newWidth = startWidth + deltaX;
      if (newWidth < 150) newWidth = 150; // min width
      if (newWidth > 600) newWidth = 600; // max width
      if (newWidth > 600) newWidth = 600; // max width
      this.container.style.width = `${newWidth}px`;

      // Notify layout manager to resize the Golden Layout instance
      SyncManager.getInstance().emit("layout-resize", undefined);
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "default";
      }
    });
  }

  private initHorizontalResize() {
    // Horizontal splitter (between top and bottom drawer)
    this.splitter.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.startY = e.clientY;
      this.startHeight = this.functionList.getBoundingClientRect().height;
      document.body.style.cursor = "row-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;

      const containerHeight = this.container.getBoundingClientRect().height;
      const deltaY = e.clientY - this.startY;
      const newHeightPx = this.startHeight + deltaY;

      // Convert to percentage
      let newHeightPercent = (newHeightPx / containerHeight) * 100;

      // Constraints (min 10%, max 90%)
      if (newHeightPercent < 10) newHeightPercent = 10;
      if (newHeightPercent > 90) newHeightPercent = 90;

      this.state.functionListHeight = newHeightPercent;
      this.state.aiDrawerHeight = 100 - newHeightPercent;

      this.applyState();
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = "default";
        this.saveState();
      }
    });
  }

  private initButtons() {
    // AI Drawer buttons
    const newChatBtn = document.getElementById("ai-new-chat-btn");
    const pastChatsBtn = document.getElementById("ai-past-chats-btn");
    const openWindowBtn = document.getElementById("ai-open-window-btn");

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        // Clear chat content logic here or emit event
        const chatContent = document.getElementById("ai-chat-content");
        if (chatContent) chatContent.innerHTML = "";
        SyncManager.getInstance().emit("ai-new-chat", undefined);
      });
    }

    if (pastChatsBtn) {
      pastChatsBtn.addEventListener("click", () => {
        // Toggle past chats overlay
        alert("Past chats logic to be implemented");
      });
    }

    if (openWindowBtn) {
      openWindowBtn.addEventListener("click", () => {
        window.open("mcp.html", "_blank", "width=800,height=600");
      });
    }

    const toggleFuncBtn = document.getElementById("toggle-functions-btn");
    if (toggleFuncBtn) {
      toggleFuncBtn.addEventListener("click", () => {
        this.toggleFunctionList();
      });
    }

    // Intercept MCP/AI link in sidebar
    const mcpLink = document.querySelector('a[href="mcp.html"]');
    if (mcpLink) {
      mcpLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleAiDrawer();
      });
    }

    // Close buttons
    const closeFunc = document.getElementById("close-functions-btn");
    if (closeFunc) {
      closeFunc.addEventListener("click", () => {
        this.setFunctionListState(true);
      });
    }

    const closeAi = document.getElementById("close-ai-btn");
    if (closeAi) {
      closeAi.addEventListener("click", () => {
        this.setAiDrawerState(true);
      });
    }
  }

  public toggleFunctionList() {
    this.state.isFunctionListCollapsed = !this.state.isFunctionListCollapsed;
    this.applyState();
    this.saveState();
    this.emitStateChange();
  }

  public toggleAiDrawer() {
    this.state.isAiDrawerCollapsed = !this.state.isAiDrawerCollapsed;
    this.applyState();
    this.saveState();
    this.emitStateChange();
  }

  public setFunctionListState(collapsed: boolean) {
    if (this.state.isFunctionListCollapsed === collapsed) return;
    this.state.isFunctionListCollapsed = collapsed;
    this.applyState();
    this.saveState();
    this.emitStateChange();
  }

  public setAiDrawerState(collapsed: boolean) {
    if (this.state.isAiDrawerCollapsed === collapsed) return;
    this.state.isAiDrawerCollapsed = collapsed;
    this.applyState();
    this.saveState();
    this.emitStateChange();
  }

  private emitStateChange() {
    SyncManager.getInstance().emit("drawer-state-changed", {
      functions: !this.state.isFunctionListCollapsed,
      ai: !this.state.isAiDrawerCollapsed,
    });
  }

  public populateFunctions(nodes: any[]) {
    this.viewer.populate(nodes);
  }

  public selectFunction(name: string) {
    this.viewer.highlight(name);
  }

  /** Check if function list drawer is collapsed */
  public isFunctionListCollapsed(): boolean {
    return this.state.isFunctionListCollapsed;
  }

  /** Check if AI drawer is collapsed */
  public isAiDrawerCollapsed(): boolean {
    return this.state.isAiDrawerCollapsed;
  }
}
