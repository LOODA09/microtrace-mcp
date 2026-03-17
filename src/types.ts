export interface PanelConfig {
  id: string;
  title: string;
  componentId: string; // Matches data-id in HTML
}

export interface PanelGroupConfig {
  id: string;
  orientation: "horizontal" | "vertical";
  children: (PanelConfig | PanelGroupConfig)[];
  sizes?: number[]; // Percentages
}

export interface LayoutConfig {
  root: PanelGroupConfig;
}

export interface Panel {
  id: string;
  element: HTMLElement;
  contentElement: HTMLElement;
}

// Graph Data Types
export interface NodeData {
  id: string;
  name: string;
  type: "mcal" | "hal" | "other" | "other2";
  info?: string;
  depth?: number;
  asm_start_line?: number;
  instruction_count?: number;
  c_code?: string;
  // d3 simulation properties (optional)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
  // pinned coordinates used during drag
  fx?: number | null;
  fy?: number | null;
}

export interface LinkData {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

// Event Bus Types
export interface EventMap {
  "function-selected": { name: string; address?: number };
  "graph-node-selected": { id: string };
  "asm-line-selected": { address: number };
  "code-function-changed": { name: string; address?: number };
  "ai-new-chat": void;
  "drawer-state-changed": { functions: boolean; ai: boolean };
  "layout-resize": void;
  "panel-added": { id: string };
  "panels-ready": void;
}

export type EventName = keyof EventMap;
export type EventHandler<E extends EventName> = (payload: EventMap[E]) => void;

// Drawer Types
export interface DrawerState {
  functionListHeight: number;
  aiDrawerHeight: number;
  isFunctionListCollapsed: boolean;
  isAiDrawerCollapsed: boolean;
}
