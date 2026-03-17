import type { EventMap, EventName, EventHandler } from "../types";

export class SyncManager {
  private listeners: { [K in EventName]?: EventHandler<K>[] } = {};
  private static instance: SyncManager;

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public on<E extends EventName>(event: E, callback: EventHandler<E>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as EventHandler<E>[]).push(callback);
  }

  public off<E extends EventName>(event: E, callback: EventHandler<E>): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = (this.listeners[event] as any[]).filter(
      (cb) => cb !== callback
    ) as any;
  }

  public emit<E extends EventName>(event: E, payload: EventMap[E]): void {
    if (!this.listeners[event]) return;
    (this.listeners[event] as EventHandler<E>[]).forEach((callback) =>
      callback(payload)
    );
  }
}
