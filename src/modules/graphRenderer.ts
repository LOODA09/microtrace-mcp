// Graph Renderer Module - D3.js Visualization
import * as d3 from "d3";
import type { GraphData, NodeData } from "../types";
import { SyncManager } from "../infrastructure/SyncManager";
import { Minimap } from "./miniMap";

const NODE_RADIUS = 11;

const COLORS: Record<string, string> = {
  mcal: "var(--mcal)",
  hal: "var(--hal)",
  other: "var(--other)",
};

let currentContainer: d3.Selection<
  SVGGElement,
  unknown,
  d3.BaseType,
  unknown
> | null = null;

let svgSelection: d3.Selection<d3.BaseType, unknown, HTMLElement, any> | null =
  null;
let zoomBehavior: d3.ZoomBehavior<Element, unknown> | null = null;
let minimap: Minimap | null = null;

export function mountGraph(
  data: GraphData,
  onNodeClick?: (nodeId: string) => void,
): void {
  const svg = d3.select("#graph");
  if (svg.empty()) return;

  svgSelection = svg;
  const wrap = document.getElementById("graph-wrap");
  if (!wrap) return;

  const width = Math.max(700, wrap.clientWidth);
  const height = Math.max(480, wrap.clientHeight);
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();

  // defs for arrowheads
  const defs = svg.append("defs");

  // Normal arrow marker
  defs
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 23)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("class", "marker-arrow")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .style("fill", "var(--arrow-color)");

  // Highlighted arrow marker
  defs
    .append("marker")
    .attr("id", "arrow-highlighted")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 17)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .attr("class", "marker-arrow highlighted")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .style("fill", "var(--arrow-color-highlight)");

  // copy nodes/links
  const nodes: NodeData[] = data.nodes.map((n) => ({ ...n }));
  const links = data.links.map((l) => ({ ...l }));

  // adjacency for hover highlighting
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((n) => adjacency.set(n.id, new Set<string>()));
  links.forEach((l) => {
    adjacency.get(l.source)?.add(l.target);
    adjacency.get(l.target)?.add(l.source);
  });

  // simulation
  const sim = d3
    .forceSimulation<NodeData>(nodes)
    .force(
      "link",
      d3
        .forceLink<NodeData, d3.SimulationLinkDatum<NodeData>>(links as any)
        .id((d) => d.id)
        .distance(80)
        .strength(1),
    )
    .force("charge", d3.forceManyBody<NodeData>().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide<NodeData>().radius(NODE_RADIUS * 1.5))
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05));

  // container for pan/zoom
  const container = svg.append("g").attr("class", "container-group");
  currentContainer = container;

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => {
      container.attr("transform", event.transform.toString());
    });
  zoomBehavior = zoom as any;

  (svg as any).call(zoom as any);

  // draw links
  const link = container
    .append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)")
    .attr("fill", "none")
    .attr("stroke", "var(--link-color)")
    .attr("stroke-width", 1.3)
    .style("opacity", 0.6);

  // draw nodes
  const node = container
    .append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node-group")
    .attr("tabindex", 0);

  node
    .append("circle")
    .attr("class", "hover-ring")
    .attr("r", NODE_RADIUS * 2.0)
    .attr("fill", "rgba(200,200,200,0.08)")
    .style("display", "none");

  node
    .append("circle")
    .attr("class", "node-circle")
    .attr("r", NODE_RADIUS)
    .attr("fill", (d) => (COLORS[d.type] as string) ?? COLORS.other)
    .attr("stroke", "#0b1220")
    .attr("stroke-width", 1.2);

  node
    .append("text")
    .attr("class", "node-label")
    .attr("x", NODE_RADIUS + 8)
    .attr("dy", "0.32em")
    .text((d) => d.name)
    .style("pointer-events", "none")
    .style("font-size", "11px");

  // drag behaviour
  const drag = d3
    .drag<SVGGElement, NodeData>()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x ?? event.x;
      d.fy = d.y ?? event.y;
    })
    .on("drag", (event, d) => {
      const minX = NODE_RADIUS * 2;
      const minY = NODE_RADIUS * 2;
      const maxX = width - NODE_RADIUS * 2;
      const maxY = height - NODE_RADIUS * 2;
      d.fx = Math.max(minX, Math.min(maxX, event.x));
      d.fy = Math.max(minY, Math.min(maxY, event.y));
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
    });

  node.call(drag as any);

  // interactivity: hover and click
  node
    .on("mouseover", function (event, d) {
      d3.select(this).select(".hover-ring").style("display", "block");

      container
        .selectAll<SVGCircleElement, NodeData>(".node-circle")
        .style("opacity", (nd) => {
          const isNeighbor = nd.id === d.id || adjacency.get(d.id)?.has(nd.id);
          return isNeighbor ? 1 : 0.25;
        });

      link
        .style("opacity", (lk) => {
          const s = (lk.source as any).id ?? (lk.source as any);
          const t = (lk.target as any).id ?? (lk.target as any);
          return s === d.id || t === d.id ? 1 : 0.2;
        })
        .classed("highlighted", (lk) => {
          const s = (lk.source as any).id ?? (lk.source as any);
          const t = (lk.target as any).id ?? (lk.target as any);
          return s === d.id || t === d.id;
        })
        .attr("marker-end", (lk) => {
          const s = (lk.source as any).id ?? (lk.source as any);
          const t = (lk.target as any).id ?? (lk.target as any);
          const isHighlighted = s === d.id || t === d.id;
          return isHighlighted ? "url(#arrow-highlighted)" : "url(#arrow)";
        });
    })
    .on("mouseout", function (event, d) {
      d3.select(this).select(".hover-ring").style("display", "none");
      container
        .selectAll<SVGCircleElement, NodeData>(".node-circle")
        .style("opacity", 1);
      link
        .style("opacity", 0.6)
        .classed("highlighted", false)
        .attr("marker-end", "url(#arrow)");
    })
    .on("click", (_, d) => {
      // Notify SyncManager
      SyncManager.getInstance().emit("graph-node-selected", { id: d.id });

      // Call custom handler if provided
      if (onNodeClick) {
        onNodeClick(d.id);
      }

      // Highlight in graph
      highlightNode(d.id);
    });

  // Initialize Minimap
  minimap = new Minimap("#graph", zoom as any);

  // simulation tick
  function linkPath(d: any) {
    const s = d.source as any as NodeData;
    const t = d.target as any as NodeData;
    const sx = s.x ?? 0,
      sy = s.y ?? 0,
      tx = t.x ?? 0,
      ty = t.y ?? 0;
    return `M${sx},${sy} L${tx},${ty}`;
  }

  sim.on("tick", () => {
    link.attr("d", (d) => linkPath(d));
    node.attr(
      "transform",
      (d: NodeData) => `translate(${d.x ?? 0},${d.y ?? 0})`,
    );
    // Update minimap with new node positions
    if (minimap) minimap.update(nodes);
  });
}

export function highlightNode(nodeId: string): void {
  if (!currentContainer) return;

  currentContainer
    .selectAll<SVGCircleElement, NodeData>(".node-circle")
    .attr("stroke-width", (nd: NodeData) => (nd.id === nodeId ? 2.4 : 1.2));
}

export function centerOnNode(nodeId: string): void {
  console.log(`[Graph] centerOnNode called for ${nodeId}`);
  if (!svgSelection || !zoomBehavior || !currentContainer) {
    console.warn(
      "[Graph] Missing svgSelection, zoomBehavior, or currentContainer",
    );
    return;
  }

  const nodeSelection = currentContainer
    .selectAll<SVGGElement, NodeData>(".node-group")
    .filter((d) => d.id === nodeId);

  if (nodeSelection.empty()) {
    console.warn(`[Graph] Node ${nodeId} not found in graph DOM`);
    return;
  }

  const nodeData = nodeSelection.datum();
  if (!nodeData) {
    console.warn(`[Graph] No data for node ${nodeId}`);
    return;
  }

  const svgNode = svgSelection.node() as SVGElement;
  const { width, height } = svgNode.getBoundingClientRect();

  const scale = 1.2;
  const tx = width / 2 - (nodeData.x || 0) * scale;
  const ty = height / 2 - (nodeData.y || 0) * scale;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  svgSelection
    .transition()
    .duration(750)
    .call(zoomBehavior.transform as any, transform);
}

export function createLegend(
  container: HTMLElement,
  onToggle: (t: string, enabled: boolean) => void,
): void {
  container.innerHTML = "";
  const items = [
    { key: "mcal", label: "MCAL" },
    { key: "hal", label: "HAL" },
    { key: "other", label: "Other" },
  ];
  items.forEach((it) => {
    const div = document.createElement("div");
    div.className = "item";

    const sw = document.createElement("span");
    sw.className = "sw";
    sw.style.background = COLORS[it.key] || "";

    const label = document.createElement("span");
    label.textContent = it.label;

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true;
    chk.style.marginLeft = "8px";
    chk.addEventListener("change", () => onToggle(it.key, chk.checked));

    div.appendChild(sw);
    div.appendChild(label);
    div.appendChild(chk);

    container.appendChild(div);
  });
}
