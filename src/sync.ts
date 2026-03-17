export class SyncManager {
  private static instance: SyncManager;

  // Event callbacks
  private onNodeSelectCallbacks: ((nodeId: string) => void)[] = [];
  private onAsmLineSelectCallbacks: ((line: number) => void)[] = [];

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public onNodeSelected(nodeId: string) {
    console.log(`[Sync] Node selected: ${nodeId}`);
    this.onNodeSelectCallbacks.forEach((cb) => cb(nodeId));
  }

  public onAsmLineSelected(line: number) {
    console.log(`[Sync] ASM Line selected: ${line}`);
    this.onAsmLineSelectCallbacks.forEach((cb) => cb(line));
  }

  public subscribeToNodeSelection(callback: (nodeId: string) => void) {
    this.onNodeSelectCallbacks.push(callback);
  }

  public subscribeToAsmLineSelection(callback: (line: number) => void) {
    this.onAsmLineSelectCallbacks.push(callback);
  }
}
