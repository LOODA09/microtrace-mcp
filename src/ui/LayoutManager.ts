import {
  DockviewComponent,
  type IDockviewPanel,
  type IContentRenderer,
  type SerializedDockview,
  type IHeaderActionsRenderer,
  type IDockviewHeaderActionsProps,
} from "dockview-core";
import { SyncManager } from "../infrastructure/SyncManager";

const LAYOUT_STORAGE_KEY = "dockview-layout";

class VanillaContentRenderer implements IContentRenderer {
  private _element: HTMLElement;

  constructor() {
    this._element = document.createElement("div");
    this._element.style.width = "100%";
    this._element.style.height = "100%";
    this._element.style.overflow = "hidden";
  }

  get element(): HTMLElement {
    return this._element;
  }

  init(parameters: any): void {
    // params passed from addPanel if any
  }
}

/** Custom header actions renderer with maximize, popout, and close buttons */
class HeaderActionsRenderer implements IHeaderActionsRenderer {
  private _element: HTMLElement;
  private _disposables: (() => void)[] = [];

  constructor() {
    this._element = document.createElement("div");
    this._element.className = "dv-header-actions";
    this._element.style.display = "flex";
    this._element.style.alignItems = "center";
    this._element.style.gap = "2px";
    this._element.style.marginLeft = "auto";
    this._element.style.paddingRight = "4px";
  }

  get element(): HTMLElement {
    return this._element;
  }

  init(params: IDockviewHeaderActionsProps): void {
    // params.api is the DockviewGroupPanelApi which has close(), maximize(), etc.
    // params.group is the DockviewGroupPanel
    const groupApi = params.api;

    // Maximize button - affects the entire group
    const maximizeBtn = document.createElement("button");
    maximizeBtn.className = "dv-action-btn";
    maximizeBtn.innerHTML = groupApi?.isMaximized?.() ? "❐" : "⬜";
    maximizeBtn.title = "Maximize/Restore Group";
    maximizeBtn.onclick = () => {
      if (groupApi?.isMaximized?.()) {
        groupApi.exitMaximized?.();
        maximizeBtn.innerHTML = "⬜";
      } else {
        groupApi?.maximize?.();
        maximizeBtn.innerHTML = "❐";
      }
    };
    this._element.appendChild(maximizeBtn);

    // Open in new window button (popout)
    const popoutBtn = document.createElement("button");
    popoutBtn.className = "dv-action-btn";
    popoutBtn.innerHTML = "↗";
    popoutBtn.title = "Open in New Window";
    popoutBtn.onclick = () => {
      // For now, just alert since cross-window sync is complex
      alert("Opening panel in new window is planned for Electron version");
    };
    this._element.appendChild(popoutBtn);

    // Close button - closes the entire group (all tabs)
    const closeBtn = document.createElement("button");
    closeBtn.className = "dv-action-btn dv-close-btn";
    closeBtn.innerHTML = "✕";
    closeBtn.title = "Close Group (All Tabs)";
    closeBtn.onclick = () => {
      // Close the entire group, which removes all panels/tabs in it
      groupApi?.close?.();
    };
    this._element.appendChild(closeBtn);
  }

  dispose(): void {
    this._disposables.forEach((d) => d());
    this._disposables = [];
  }
}

export class LayoutManager {
  private api: DockviewComponent;
  private container: HTMLElement;
  private isInitialized = false;

  constructor() {
    this.container = document.getElementById("dockview-root")!;

    // Initialize Dockview with header actions
    this.api = new DockviewComponent(this.container, {
      createComponent: (options) => {
        return new VanillaContentRenderer();
      },
      createRightHeaderActionComponent: (group) => {
        return new HeaderActionsRenderer();
      },
    });

    // Handle Window Resize
    window.addEventListener("resize", () => {
      this.api.layout(this.container.clientWidth, this.container.clientHeight);
    });

    // Handle Splitter Resize from drawer
    SyncManager.getInstance().on("layout-resize", () => {
      setTimeout(() => {
        this.api.layout(
          this.container.clientWidth,
          this.container.clientHeight,
        );
      }, 10);
    });

    // Auto-save layout on changes
    this.api.onDidLayoutChange(() => {
      if (this.isInitialized) {
        this.saveLayout();
      }
    });

    // Sync toggle buttons when panel is closed via X button
    this.api.onDidRemovePanel((event) => {
      const id = event.id;
      const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
      if (btn) {
        btn.classList.remove("active");
      }
    });
  }

  private saveLayout() {
    try {
      const data = this.api.toJSON();
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save layout", e);
    }
  }

  private loadLayout(): boolean {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return false;

    try {
      const data: SerializedDockview = JSON.parse(saved);
      this.api.fromJSON(data);
      return true;
    } catch (e) {
      console.warn("Failed to restore layout, using default", e);
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      return false;
    }
  }

  public initLayout() {
    // Check if we already have panels to avoid dupes in Strict Mode calls
    if (this.api.panels.length > 0) return;

    // Try to load saved layout first
    if (this.loadLayout()) {
      this.isInitialized = true;
      this.syncToggleButtonsWithLayout();
      setTimeout(() => {
        this.api.layout(
          this.container.clientWidth,
          this.container.clientHeight,
        );
        // Emit event to signal panels are ready and need content
        SyncManager.getInstance().emit("panels-ready", undefined);
      }, 100);
      return;
    }

    // Default layout: Graph 50% left, Assembly/Code 50% right (stacked)
    const graphPanel = this.api.addPanel({
      id: "graph",
      component: "graphComponent",
      title: "Control Flow Graph",
      position: { referencePanel: undefined, direction: "left" },
    });

    const asmPanel = this.api.addPanel({
      id: "assembly",
      component: "assemblyComponent",
      title: "Assembly",
      position: {
        referencePanel: graphPanel as IDockviewPanel,
        direction: "right",
      },
    });

    this.api.addPanel({
      id: "code",
      component: "codeComponent",
      title: "Decompiled Code",
      position: {
        referencePanel: asmPanel as IDockviewPanel,
        direction: "below",
      },
    });

    // Don't mark as initialized until layout is properly sized
    // Force layout update to ensure panels render correctly
    setTimeout(() => {
      // First, trigger layout with container dimensions
      this.api.layout(this.container.clientWidth, this.container.clientHeight);

      // Set proper 50/50 proportions using groups API
      const groups = (this.api as any).groups;
      if (groups && groups.length >= 2) {
        // First group (graph) should be 50% width
        const halfWidth = Math.floor(this.container.clientWidth / 2);
        try {
          groups[0]?.api?.setSize?.({ width: halfWidth });
        } catch (e) {
          console.warn("Could not set initial panel size", e);
        }
      }

      // Now mark as initialized so future changes are saved
      this.isInitialized = true;

      // Emit event to signal panels are ready and need content
      SyncManager.getInstance().emit("panels-ready", undefined);
    }, 200);
  }

  /** Sync toggle button states with current panel visibility */
  public syncToggleButtonsWithLayout() {
    const panelIds = ["graph", "assembly", "code"];
    panelIds.forEach((id) => {
      const panel = this.api.getPanel(id);
      const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
      if (btn) {
        if (panel) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  }

  public registerComponents() {
    this.api.onDidAddPanel((panel) => {
      const id = panel.id;
      const container = panel.view.content.element;

      // Clear any existing content in case of reuse
      container.innerHTML = "";

      const el = document.createElement("div");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.overflow = "hidden";

      if (id === "graph") {
        el.id = "graph-panel-content";
        el.style.display = "flex";
        el.style.flexDirection = "column";
        this.renderGraphShell(el);
      } else if (id === "assembly") {
        el.id = "asm-panel-content";
        el.style.overflow = "auto";
        el.innerHTML =
          "<div class='panel-placeholder'>Wait for Assembly...</div>";
      } else if (id === "code") {
        el.id = "code-panel-content";
        el.style.overflow = "auto";
        el.innerHTML = "<div class='panel-placeholder'>Wait for Code...</div>";
      }

      container.appendChild(el);

      // Sync toggle button to show active when panel is added
      const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
      if (btn) {
        btn.classList.add("active");
      }

      // Emit event to signal this panel needs content
      setTimeout(() => {
        SyncManager.getInstance().emit("panel-added", { id });
      }, 50);
    });
  }

  private renderGraphShell(container: HTMLElement) {
    const controlsHTML = `
        <div class="graph-controls-toolbar" style="padding: 5px; background: var(--panel-bg); display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--border-color);">
            <div class="search-container" style="display: flex; align-items: center; gap: 5px;">
              <input id="search" placeholder="Search function..." style="padding: 2px;">
              <button id="clear-search" class="clear-btn" style="display: none;">✕</button>
            </div>
            
            <div class="separator" style="width: 1px; height: 16px; background: #999;"></div>

            <div class="depth-filter" style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 12px;">Depth:</span>
              <input type="number" id="depth-input" min="0" placeholder="0" style="width: 50px;">
              <input type="checkbox" id="depth-checkbox" title="Enable Depth Filter">
            </div>
            
            <div style="flex-grow: 1;"></div>
            <div id="legend" class="legend" style="display: flex; gap: 10px; font-size: 11px;"></div>
        </div>
        <div id="graph-wrap" style="flex-grow: 1; position: relative; overflow: hidden; background: var(--graph-bg);">
            <svg id="graph" style="width: 100%; height: 100%;"></svg>
        </div>
      `;
    container.innerHTML = controlsHTML;
  }

  public showComponent(componentName: string) {
    const panel = this.api.getPanel(componentName);
    if (panel) {
      this.api.doSetGroupActive((panel as any).group);
      panel.api.setActive();
    } else {
      this.reOpenPanel(componentName);
    }
  }

  public toggleComponent(componentName: string, forceShow: boolean) {
    // Try getPanel first, then fallback to array search for fromJSON-restored panels
    let panel: any = this.api.getPanel(componentName);
    if (!panel) {
      panel = this.api.panels.find((p) => p.id === componentName);
    }

    console.log(
      `toggleComponent: ${componentName}, forceShow: ${forceShow}, panel exists: ${!!panel}`,
    );

    if (forceShow) {
      // User wants to show the panel
      if (panel) {
        // Panel exists, just activate it
        this.api.doSetGroupActive((panel as any).group);
        panel.api.setActive();
      } else {
        // Panel doesn't exist, recreate it
        this.reOpenPanel(componentName);
      }
    } else {
      // User wants to hide the panel
      if (panel) {
        panel.api.close();
      }
    }
  }

  /** Check if a panel is currently open */
  public isPanelOpen(componentName: string): boolean {
    const panel = this.api.getPanel(componentName);
    if (panel) return true;

    // Fallback: check panels array directly (for panels restored via fromJSON)
    const found = this.api.panels.some((p) => p.id === componentName);
    console.log(
      `isPanelOpen(${componentName}): getPanel=${!!panel}, array search=${found}, total panels=${
        this.api.panels.length
      }`,
    );
    return found;
  }

  private reOpenPanel(id: string) {
    // Safety check: don't add if already exists
    if (this.api.getPanel(id)) {
      console.warn(`Panel ${id} already exists, not re-adding`);
      return;
    }

    if (id === "graph") {
      this.api.addPanel({
        id: "graph",
        component: "graphComponent",
        title: "Control Flow Graph",
        position: { direction: "left" },
      });
      return;
    }

    const reference =
      this.api.panels.length > 0
        ? (this.api.panels[0] as IDockviewPanel)
        : undefined;

    this.api.addPanel({
      id: id,
      component: id + "Component",
      title: id === "assembly" ? "Assembly" : "Decompiled Code",
      position: { referencePanel: reference, direction: "right" },
    });
  }

  /** Reset layout to default and clear localStorage */
  public resetLayout() {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    // Clear all panels
    this.api.panels.forEach((panel) => {
      panel.api.close();
    });
    this.isInitialized = false;
    // Re-init with default layout
    this.initLayout();
    this.syncToggleButtonsWithLayout();
  }
}
