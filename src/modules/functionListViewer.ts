import { SyncManager } from "../infrastructure/SyncManager";

export class FunctionListViewer {
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  public highlight(name: string) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    const items = container.querySelectorAll("li.function-item");
    items.forEach((itemNode) => {
      const item = itemNode as HTMLElement; // Cast to HTMLElement to access specific properties if needed
      if (item.getAttribute("data-name") === name) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  public populate(nodes: any[]) {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(
        `FunctionListViewer: Container '${this.containerId}' not found.`
      );
      return;
    }

    if (!nodes || !Array.isArray(nodes)) {
      console.warn("FunctionListViewer: Invalid data", nodes);
      return;
    }

    container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "function-list";

    nodes.forEach((node) => {
      const li = document.createElement("li");
      li.className = "function-item";
      li.setAttribute("data-name", node.name);
      li.textContent = node.name;
      li.title = node.name;

      li.addEventListener("click", () => {
        SyncManager.getInstance().emit("function-selected", {
          name: node.name,
          address: node.asm_start_line,
        });
      });

      ul.appendChild(li);
    });

    container.appendChild(ul);
  }
}
