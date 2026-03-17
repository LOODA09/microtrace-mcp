import { SyncManager } from "../infrastructure/SyncManager";

interface HistoryEntry {
  functionName: string;
  address: number;
  timestamp: number;
}

export class HistoryManager {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private isNavigating: boolean = false;
  private readonly DEBOUNCE_MS = 200;
  private lastPushTime: number = 0;

  constructor() {
    this.initEventListeners();

    // Listen to function selection to push to history
    SyncManager.getInstance().on("function-selected", (payload) => {
      if (this.isNavigating) return;
      this.push(payload.name, payload.address || 0);
    });

    // Listen to code function changes too if they are distinct events
    SyncManager.getInstance().on("code-function-changed", (payload) => {
      if (this.isNavigating) return;
      // Deduplicate if needed
      if (
        this.currentIndex >= 0 &&
        this.history[this.currentIndex] &&
        this.history[this.currentIndex]?.functionName === payload.name
      ) {
        return;
      }
      this.push(payload.name, payload.address || 0);
    });
  }

  private initEventListeners() {
    const backBtn = document.getElementById("history-back-btn");
    const fwdBtn = document.getElementById("history-fwd-btn");

    if (backBtn) {
      backBtn.addEventListener("click", () => this.goBack());
    }
    if (fwdBtn) {
      fwdBtn.addEventListener("click", () => this.goForward());
    }
  }

  private push(name: string, address: number) {
    const now = Date.now();
    if (now - this.lastPushTime < this.DEBOUNCE_MS) {
      // Replace the last entry if too rapid (debounce/throttle logic)
      if (this.currentIndex >= 0 && this.history[this.currentIndex]) {
        this.history[this.currentIndex] = {
          functionName: name,
          address,
          timestamp: now,
        };
        this.updateButtons();
        return;
      }
    }

    // If we are in the middle of history, cut off the future
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push({ functionName: name, address, timestamp: now });
    this.currentIndex++;
    this.lastPushTime = now;
    this.updateButtons();
  }

  public goBack() {
    if (this.currentIndex > 0) {
      this.isNavigating = true;
      this.currentIndex--;
      const entry = this.history[this.currentIndex];
      if (entry) {
        this.emitNavigation(entry);
      }
      this.updateButtons();
      // Reset flag after a short delay to allow events to propagate without re-triggering push
      setTimeout(() => {
        this.isNavigating = false;
      }, 100);
    }
  }

  public goForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.isNavigating = true;
      this.currentIndex++;
      const entry = this.history[this.currentIndex];
      if (entry) {
        this.emitNavigation(entry);
      }
      this.updateButtons();
      setTimeout(() => {
        this.isNavigating = false;
      }, 100);
    }
  }

  private emitNavigation(entry: HistoryEntry) {
    // Emit events to update the UI
    SyncManager.getInstance().emit("function-selected", {
      name: entry.functionName,
      address: entry.address,
    });
    // Also emit code changed if needed, but function-selected usually triggers that
  }

  private updateButtons() {
    const backBtn = document.getElementById(
      "history-back-btn"
    ) as HTMLButtonElement;
    const fwdBtn = document.getElementById(
      "history-fwd-btn"
    ) as HTMLButtonElement;

    if (backBtn) backBtn.disabled = this.currentIndex <= 0;
    if (fwdBtn) fwdBtn.disabled = this.currentIndex >= this.history.length - 1;
  }
}
