// Function Graph Page - Orchestrator
import { DrawerManager, LayoutManager, HistoryManager } from "./ui";
import { SyncManager } from "./infrastructure/SyncManager";
import { loadData, loadAsm } from "./modules/dataLoader";
import {
  displayFullAsm,
  highlightAsmLines,
  attachAsmClickHandlers,
  findNodeByAsmLine,
} from "./modules/asmViewer";
import { displayCCode } from "./modules/codeViewer";
import {
  mountGraph,
  highlightNode,
  createLegend,
  centerOnNode,
} from "./modules/graphRenderer";

// Search functionality
function wireSearch() {
  const input = document.getElementById("search") as HTMLInputElement;
  if (!input) return;

  const clearBtn = document.getElementById("clear-search") as HTMLButtonElement;
  if (clearBtn) {
    clearBtn.style.display = input.value ? "block" : "none";
    input.addEventListener("input", () => {
      clearBtn.style.display = input.value ? "block" : "none";
    });
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.style.display = "none";
      const ev = new Event("input");
      input.dispatchEvent(ev);
    });
  }

  input.addEventListener("input", () => {
    const query = input.value.toLowerCase();
    const svg = document.querySelector("#graph");
    if (!svg) return;

    const nodes = svg.querySelectorAll(".node-group");
    nodes.forEach((nodeEl) => {
      const text = nodeEl.querySelector("text")?.textContent || "";
      const match = text.toLowerCase().includes(query);
      (nodeEl as SVGElement).style.opacity =
        query === "" || match ? "1" : "0.2";
    });
  });
}

// Main initialization
(async function main() {
  const fullData = await loadData();
  const asmText = await loadAsm();

  // Initialize Managers
  const drawerManager = new DrawerManager();
  const layoutManager = new LayoutManager();
  // Register component Rendering logic immediately
  layoutManager.registerComponents();
  layoutManager.initLayout();
  new HistoryManager();

  // Sync drawer toggle button with saved state on load
  const functionsBtn = document.querySelector('.tab-btn[data-tab="functions"]');
  if (functionsBtn) {
    if (drawerManager.isFunctionListCollapsed()) {
      functionsBtn.classList.remove("active");
    } else {
      functionsBtn.classList.add("active");
    }
  }

  // Sync panel toggle buttons with current panel state
  ["assembly", "code", "graph"].forEach((panelId) => {
    const btn = document.querySelector(`.tab-btn[data-tab="${panelId}"]`);
    if (btn) {
      if (layoutManager.isPanelOpen(panelId)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });

  // Wire Top Bar View Toggles
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (!tabName) return;

      if (tabName === "functions") {
        // Toggle drawer based on current state
        const isCurrentlyOpen = !drawerManager.isFunctionListCollapsed();
        drawerManager.setFunctionListState(isCurrentlyOpen); // collapse if open, expand if closed
        // Update button state to match new state
        if (isCurrentlyOpen) {
          btn.classList.remove("active");
        } else {
          btn.classList.add("active");
        }
      } else {
        // Check actual panel state FIRST, then toggle
        const isCurrentlyOpen = layoutManager.isPanelOpen(tabName);
        console.log(`Toggle ${tabName}: currently open = ${isCurrentlyOpen}`);

        if (isCurrentlyOpen) {
          // Panel is open, close it
          layoutManager.toggleComponent(tabName, false);
          btn.classList.remove("active");
        } else {
          // Panel is closed, open it
          layoutManager.toggleComponent(tabName, true);
          btn.classList.add("active");
        }
      }
    });
  });

  // Wire Reset Layout Button
  const resetLayoutBtn = document.getElementById("reset-layout-btn");
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener("click", () => {
      layoutManager.resetLayout();
      // Also sync drawer state back to defaults
      drawerManager.setFunctionListState(false);
      drawerManager.setAiDrawerState(false);
      // Sync toggle buttons
      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.add("active");
      });
    });
  }

  // Populate Functions List
  drawerManager.populateFunctions(fullData.nodes);

  // State for filtering
  const activeTypes = new Set<string>(["mcal", "hal", "other"]);
  let depthLimit: number = 0;
  let depthEnabled: boolean = false;

  // Function to filter and update graph
  function updateGraph() {
    const wrap = document.getElementById("graph-wrap");
    if (!wrap) {
      // Retry once
      setTimeout(updateGraph, 200);
      return;
    }

    const filteredNodes = fullData.nodes.filter((n) => {
      const typeOk = activeTypes.has(n.type);
      const depthOk =
        !depthEnabled || (n.depth !== undefined && n.depth <= depthLimit);
      return typeOk && depthOk;
    });

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = fullData.links.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    mountGraph({ nodes: filteredNodes, links: filteredLinks });
  }

  // Helper to wait for elements
  function waitForElement(
    id: string,
    retries = 10
  ): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const check = (count: number) => {
        const el = document.getElementById(id);
        if (el) resolve(el);
        else if (count <= 0) resolve(null);
        else setTimeout(() => check(count - 1), 200);
      };
      check(retries);
    });
  }

  // Display full assembly on load
  const asmContainer = await waitForElement("asm-panel-content");
  if (asmContainer && asmText) {
    displayFullAsm(asmText, asmContainer as HTMLElement);
    // Attach click handlers for assembly lines
    attachAsmClickHandlers(asmContainer as HTMLElement, (lineNum) => {
      const node = findNodeByAsmLine(lineNum, fullData.nodes);
      if (node) {
        SyncManager.getInstance().emit("function-selected", {
          name: node.name,
          address: node.asm_start_line ?? 0,
        });
        SyncManager.getInstance().emit("asm-line-selected", {
          address: node.asm_start_line || 0,
        });
      }
    });
  } else {
    console.warn("ASM Container not found even after timeout");
  }

  // Subscribe to events
  SyncManager.getInstance().on("function-selected", (payload) => {
    // Determine node from function name or address
    const node = fullData.nodes.find((n) => n.name === payload.name);
    if (!node) return;

    const asmContainer = document.getElementById("asm-panel-content");
    if (asmContainer && node.asm_start_line && node.instruction_count) {
      highlightAsmLines(
        asmContainer as HTMLElement,
        node.asm_start_line,
        node.instruction_count
      );
    }

    const cContainer = document.getElementById("code-panel-content");
    if (cContainer) {
      displayCCode(cContainer as HTMLElement, node);
    }

    // Update Breadcrumb
    const breadcrumb = document.getElementById("current-function-breadcrumb");
    if (breadcrumb) {
      breadcrumb.textContent = `Function: ${node.name}`;
    }

    highlightNode(node.id);
    centerOnNode(node.id);
    drawerManager.selectFunction(node.name);
  });

  // Graph Node Selection (From Graph Click)
  SyncManager.getInstance().on("graph-node-selected", (payload) => {
    // Treat it same as function selected
    const node = fullData.nodes.find((n) => n.id === payload.id);
    if (node) {
      SyncManager.getInstance().emit("function-selected", {
        name: node.name,
        address: node.asm_start_line ?? 0,
      });
    }
  });

  // Listen for drawer state changes to update button states
  SyncManager.getInstance().on(
    "drawer-state-changed",
    (state: { functions: boolean; ai: boolean }) => {
      const functionsBtn = document.querySelector(
        '.tab-btn[data-tab="functions"]'
      );
      if (functionsBtn) {
        if (state.functions) functionsBtn.classList.add("active");
        else functionsBtn.classList.remove("active");
      }
    }
  );

  // Helper functions to load panel content
  function loadAssemblyContent() {
    const container = document.getElementById("asm-panel-content");
    if (container && asmText) {
      displayFullAsm(asmText, container as HTMLElement);
      attachAsmClickHandlers(container as HTMLElement, (lineNum) => {
        const node = findNodeByAsmLine(lineNum, fullData.nodes);
        if (node) {
          SyncManager.getInstance().emit("function-selected", {
            name: node.name,
            address: node.asm_start_line ?? 0,
          });
          SyncManager.getInstance().emit("asm-line-selected", {
            address: node.asm_start_line || 0,
          });
        }
      });
    }
  }

  function loadGraphContent() {
    setTimeout(() => {
      updateGraph();
      wireSearch();

      const depthInput = document.getElementById(
        "depth-input"
      ) as HTMLInputElement;
      const depthCheckbox = document.getElementById(
        "depth-checkbox"
      ) as HTMLInputElement;

      if (depthInput) {
        depthInput.addEventListener("input", () => {
          const val = parseInt(depthInput.value, 10);
          depthLimit = isNaN(val) ? 0 : val;
          if (depthEnabled) updateGraph();
        });
      }

      if (depthCheckbox) {
        depthCheckbox.addEventListener("change", () => {
          depthEnabled = depthCheckbox.checked;
          updateGraph();
        });
      }

      const legendContainer = document.getElementById("legend");
      if (legendContainer) {
        createLegend(legendContainer, (type, enabled) => {
          if (enabled) activeTypes.add(type);
          else activeTypes.delete(type);
          updateGraph();
        });
      }
    }, 100);
  }

  // Listen for panel-added events to reload content
  SyncManager.getInstance().on("panel-added", (payload) => {
    console.log("Panel added:", payload.id);
    if (payload.id === "assembly") {
      setTimeout(loadAssemblyContent, 100);
    } else if (payload.id === "graph") {
      loadGraphContent();
    }
    // Code panel content is loaded on function selection, not on init
  });

  // Listen for panels-ready (on initial load or reset)
  SyncManager.getInstance().on("panels-ready", () => {
    console.log("Panels ready, loading content...");
    setTimeout(() => {
      loadAssemblyContent();
      loadGraphContent();
    }, 100);
  });

  // Initial Mount (handled by panels-ready now, but keep as backup)
  setTimeout(updateGraph, 300);

  // Wire up controls (Wait for LayoutManager to inject DOM)
  setTimeout(() => {
    wireSearch();

    const depthInput = document.getElementById(
      "depth-input"
    ) as HTMLInputElement;
    const depthCheckbox = document.getElementById(
      "depth-checkbox"
    ) as HTMLInputElement;

    if (depthInput) {
      depthInput.addEventListener("input", () => {
        const val = parseInt(depthInput.value, 10);
        depthLimit = isNaN(val) ? 0 : val;
        if (depthEnabled) updateGraph();
      });
    }

    if (depthCheckbox) {
      depthCheckbox.addEventListener("change", () => {
        depthEnabled = depthCheckbox.checked;
        updateGraph();
      });
    }

    const legendContainer = document.getElementById("legend");
    if (legendContainer) {
      createLegend(legendContainer, (type, enabled) => {
        if (enabled) activeTypes.add(type);
        else activeTypes.delete(type);
        updateGraph();
      });
    }
  }, 200);
})();
