// Data Loading Module
import type { GraphData } from "../types";

export async function loadData(): Promise<GraphData> {
  try {
    const res = await fetch("../assets/firmware_analysis.json", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Transform firmware_analysis.json to GraphData
    const nodes = json.nodes.map((n: any) => ({
      id: n.name,
      name: n.name,
      type: (n.type ? n.type.toLowerCase() : "other") as
        | "mcal"
        | "hal"
        | "other",
      info: n.info || `Address: ${n.address}`,
      depth: n.depth,
      c_code: n.c_code,
      asm_start_line: n.asm_start_line,
      instruction_count: n.instruction_count,
    }));

    const links: any[] = [];
    json.nodes.forEach((n: any) => {
      if (n.calls) {
        n.calls.forEach((targetName: string) => {
          if (nodes.find((node: any) => node.id === targetName)) {
            links.push({ source: n.name, target: targetName });
          }
        });
      }
    });

    return { nodes, links };
  } catch (err) {
    console.error(
      "Failed to load firmware_analysis.json, falling back to sample data",
      err
    );
    return {
      nodes: [
        { id: "f_main", name: "main", type: "other", info: "Entry point" },
        {
          id: "f_init",
          name: "init_peripherals",
          type: "mcal",
          info: "Initialises MCAL peripherals",
        },
        {
          id: "f_read",
          name: "read_sensor",
          type: "hal",
          info: "Reads sensor via HAL",
        },
      ],
      links: [
        { source: "f_main", target: "f_init" },
        { source: "f_init", target: "f_read" },
      ],
    };
  }
}

export async function loadAsm(): Promise<string> {
  try {
    const res = await fetch("../assets/asm.txt");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text;
  } catch (err) {
    console.error("Failed to load asm.txt", err);
    return "";
  }
}
