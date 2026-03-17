import type { PanelConfig, PanelGroupConfig, LayoutConfig } from "./types";

export class PanelManager {
  private rootElement: HTMLElement;
  private panels: Map<string, HTMLElement> = new Map();
  private activePanels: Set<string> = new Set();
  private layout: LayoutConfig | null = null;
  private onPanelStateChange?: (id: string, isOpen: boolean) => void;

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
    this.init();
  }

  private init() {
    // Find all existing tab contents and detach them
    const tabs = document.querySelectorAll(".tab[data-id]");
    tabs.forEach((tab) => {
      const id = (tab as HTMLElement).dataset.id!;
      this.panels.set(id, tab as HTMLElement);
      (tab as HTMLElement).style.display = "none"; // Hide initially
    });
  }

  public setRootLayout(layout: LayoutConfig) {
    this.layout = layout;
    this.renderLayout();
  }

  public setOnPanelStateChange(cb: (id: string, isOpen: boolean) => void) {
    this.onPanelStateChange = cb;
  }

  private renderLayout() {
    this.rootElement.innerHTML = "";
    if (!this.layout) return;
    const rootGroup = this.createPanelGroup(this.layout.root);
    this.rootElement.appendChild(rootGroup);
  }

  private createPanelGroup(config: PanelGroupConfig): HTMLElement {
    const group = document.createElement("div");
    group.className = "panel-group";
    group.dataset.orientation = config.orientation;

    config.children.forEach((child, index) => {
      // Add splitter if not the first child
      if (index > 0) {
        const splitter = document.createElement("div");
        splitter.className = "splitter";
        splitter.dataset.orientation = config.orientation;
        this.setupSplitter(splitter, group, config.orientation);
        group.appendChild(splitter);
      }

      if ("children" in child) {
        // It's a group
        const childGroup = this.createPanelGroup(child as PanelGroupConfig);
        childGroup.style.flex = config.sizes ? `${config.sizes[index]}` : "1";
        group.appendChild(childGroup);
      } else {
        // It's a panel
        const panel = this.createPanel(child as PanelConfig);
        panel.style.flex = config.sizes ? `${config.sizes[index]}` : "1";
        group.appendChild(panel);
      }
    });

    return group;
  }

  private createPanel(config: PanelConfig): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.dataset.id = config.id;

    const header = document.createElement("div");
    header.className = "panel-header";
    header.textContent = config.title;

    // Close button
    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.marginLeft = "auto";
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closePanel(config.componentId);
    };
    header.appendChild(closeBtn);

    panel.appendChild(header);

    const content = document.createElement("div");
    content.className = "panel-content";

    // Inject the actual content
    const component = this.panels.get(config.componentId);
    if (component) {
      component.style.display = "block";
      content.appendChild(component);
      this.activePanels.add(config.componentId);
    } else {
      content.textContent = `Panel content for ${config.componentId} not found.`;
    }

    panel.appendChild(content);
    return panel;
  }

  private setupSplitter(
    splitter: HTMLElement,
    container: HTMLElement,
    orientation: string
  ) {
    let isDragging = false;
    let startX: number, startY: number;
    let startPrevSize: number, startNextSize: number;

    splitter.addEventListener("mousedown", (e) => {
      isDragging = true;
      splitter.classList.add("dragging");
      startX = e.clientX;
      startY = e.clientY;

      const prev = splitter.previousElementSibling as HTMLElement;
      const next = splitter.nextElementSibling as HTMLElement;

      if (orientation === "horizontal") {
        startPrevSize = prev.offsetWidth;
        startNextSize = next.offsetWidth;
      } else {
        startPrevSize = prev.offsetHeight;
        startNextSize = next.offsetHeight;
      }

      document.body.style.cursor =
        orientation === "horizontal" ? "col-resize" : "row-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const prev = splitter.previousElementSibling as HTMLElement;
      const next = splitter.nextElementSibling as HTMLElement;

      if (!prev || !next) return;

      let delta = 0;
      if (orientation === "horizontal") {
        delta = e.clientX - startX;
      } else {
        delta = e.clientY - startY;
      }

      const totalSize = startPrevSize + startNextSize;
      const newPrevSize = startPrevSize + delta;
      const newNextSize = startNextSize - delta;

      if (newPrevSize > 50 && newNextSize > 50) {
        const prevFlex = newPrevSize / totalSize;
        const nextFlex = newNextSize / totalSize;

        prev.style.flex = `${prevFlex} 1 0%`;
        next.style.flex = `${nextFlex} 1 0%`;
      }
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        splitter.classList.remove("dragging");
        document.body.style.cursor = "";
      }
    });
  }

  public splitPanel(
    id: string,
    direction: "right" | "left" | "top" | "bottom"
  ) {
    const panel = this.panels.get(id);
    if (!panel) return;
    console.log(
      `Split panel ${id} to ${direction} - Not fully implemented in MVP`
    );
  }

  public openPanel(id: string) {
    if (this.activePanels.has(id)) return;
    this.togglePanel(id);
  }

  public closePanel(id: string) {
    if (!this.activePanels.has(id)) return;
    this.activePanels.delete(id);

    // We need to remove it from the layout.
    if (this.layout) {
      this.layout = this.removePanelFromLayout(this.layout, id);
      this.renderLayout();
    }

    if (this.onPanelStateChange) {
      this.onPanelStateChange(id, false);
    }
  }

  public togglePanel(id: string) {
    if (this.activePanels.has(id)) {
      this.closePanel(id);
    } else {
      // We need to add it back.
      if (!this.layout) {
        // Create default layout
        this.layout = {
          root: {
            id: "root",
            orientation: "horizontal",
            children: [{ id, title: this.getPanelTitle(id), componentId: id }],
          },
        };
      } else {
        // Add to layout
        this.layout = this.addPanelToLayout(this.layout, id);
      }
      this.activePanels.add(id);
      this.renderLayout();

      if (this.onPanelStateChange) {
        this.onPanelStateChange(id, true);
      }
    }
  }

  private removePanelFromLayout(
    layout: LayoutConfig,
    id: string
  ): LayoutConfig {
    // Deep clone to avoid mutation issues
    const newLayout = JSON.parse(JSON.stringify(layout));

    const removeRecursive = (group: PanelGroupConfig) => {
      // Filter out the panel
      group.children = group.children.filter((child) => {
        if ("children" in child) {
          removeRecursive(child as PanelGroupConfig);
          return child.children.length > 0; // Keep group only if it has children
        } else {
          return (child as PanelConfig).id !== id;
        }
      });
    };

    removeRecursive(newLayout.root);
    return newLayout;
  }

  private addPanelToLayout(layout: LayoutConfig, id: string): LayoutConfig {
    const newLayout = JSON.parse(JSON.stringify(layout));

    // Simple heuristic:
    // If ASM or C, try to put in first child (Left).
    // If Graph or Chat, try to put in second child (Right).

    const isLeft = id === "asm" || id === "c";

    const root = newLayout.root;
    if (root.orientation === "horizontal" && root.children.length >= 2) {
      const targetGroupIndex = isLeft ? 0 : 1;
      const target = root.children[targetGroupIndex];

      if ("children" in target) {
        // It's a group, add to it
        (target as PanelGroupConfig).children.push({
          id,
          title: this.getPanelTitle(id),
          componentId: id,
        });
      } else {
        // It's a panel, convert to group? Or just add to root?
        // Let's just add to root for simplicity if the structure isn't perfect
        // But wait, we want to maintain the split.

        // If the target is a panel, wrap it in a vertical group?
        const oldPanel = target as PanelConfig;
        const newGroup: PanelGroupConfig = {
          id: `group-${Date.now()}`,
          orientation: "vertical",
          children: [
            oldPanel,
            { id, title: this.getPanelTitle(id), componentId: id },
          ],
        };
        root.children[targetGroupIndex] = newGroup;
      }
    } else {
      // Fallback: just append to root
      root.children.push({
        id,
        title: this.getPanelTitle(id),
        componentId: id,
      });
    }

    return newLayout;
  }

  private getPanelTitle(id: string): string {
    switch (id) {
      case "asm":
        return "Assembly";
      case "c":
        return "C Code";
      case "graph":
        return "Graph";
      case "chat":
        return "Chat";
      default:
        return id;
    }
  }
}
