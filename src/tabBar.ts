import { PanelManager } from "./panelManager";

export class TabBar {
  private container: HTMLElement;
  private manager: PanelManager;
  private tabs: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement, manager: PanelManager) {
    this.container = container;
    this.manager = manager;
    this.init();

    // Subscribe to external state changes (e.g. close button on panel)
    this.manager.setOnPanelStateChange((id, isOpen) => {
      this.setActive(id, isOpen);
    });
  }

  private init() {
    this.container.className = "top-tab-bar";

    const tabDefinitions = [
      { id: "chat", label: "Chat" },
      { id: "asm", label: "Assembly" },
      { id: "c", label: "C Code" },
      { id: "graph", label: "Graph" },
    ];

    tabDefinitions.forEach((def) => {
      const btn = document.createElement("button");
      btn.className = "tab-button";
      btn.textContent = def.label;
      btn.dataset.id = def.id;
      btn.onclick = () => this.handleTabClick(def.id);
      this.container.appendChild(btn);
      this.tabs.set(def.id, btn);
    });
  }

  private handleTabClick(id: string) {
    // Toggle active state visual
    this.tabs.forEach((btn, key) => {
      if (key === id) {
        btn.classList.toggle("active");
      }
    });

    // Call manager to toggle panel
    this.manager.togglePanel(id);
  }

  public setActive(id: string, active: boolean) {
    const btn = this.tabs.get(id);
    if (btn) {
      if (active) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  }
}
