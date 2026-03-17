import * as d3 from "d3";

export class Minimap {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | null =
    null;
  private viewRect: d3.Selection<
    SVGRectElement,
    unknown,
    HTMLElement,
    any
  > | null = null;
  private container: d3.Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    any
  > | null = null;
  private width: number = 150;
  private height: number = 100;
  private mainSvg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>;
  private zoomBehavior: d3.ZoomBehavior<Element, unknown>;

  constructor(
    mainSvgSelector: string,
    zoomBehavior: d3.ZoomBehavior<Element, unknown>
  ) {
    this.mainSvg = d3.select(mainSvgSelector);
    this.zoomBehavior = zoomBehavior;
    this.init();
  }

  private init() {
    d3.select("#minimap-container").remove();

    const graphWrap = d3.select("#graph-wrap");
    this.container = graphWrap
      .append("div")
      .attr("id", "minimap-container")
      .style("position", "absolute")
      .style("bottom", "20px")
      .style("left", "20px")
      .style("width", `${this.width}px`)
      .style("height", `${this.height}px`)
      .style("border", "1px solid var(--border-color)")
      .style("background", "var(--card-bg)")
      .style("overflow", "hidden")
      .style("pointer-events", "none") as d3.Selection<
      HTMLDivElement,
      unknown,
      HTMLElement,
      any
    >;

    this.svg = this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .style("display", "block") as d3.Selection<
      SVGSVGElement,
      unknown,
      HTMLElement,
      any
    >;

    this.viewRect = this.svg
      .append("rect")
      .attr("class", "minimap-view-rect")
      .attr("fill", "var(--hover-bg-color)")
      .attr("stroke", "var(--accent-1)")
      .attr("stroke-width", 1.5) as d3.Selection<
      SVGRectElement,
      unknown,
      HTMLElement,
      any
    >;

    // Hook into zoom
    this.zoomBehavior.on("zoom.minimap", (event) => {
      // Propagate transform to main container if needed (usually main handles its own zoom)
      // Here we just update the minimap rect
      const t = event.transform;
      this.updateViewRect(t);

      // Also update main graph container transform if this was called from zoom event
      const container = d3.select(".container-group");
      if (!container.empty()) {
        container.attr("transform", t.toString());
      }
    });
  }

  public update(nodes: any[]) {
    if (!this.svg) return;

    // Calculate bounding box of all nodes
    const xExtent = d3.extent(nodes, (d: any) => d.x as number) as [
      number,
      number
    ];
    const yExtent = d3.extent(nodes, (d: any) => d.y as number) as [
      number,
      number
    ];

    if (!xExtent[0] || !yExtent[0]) return;

    const padding = 50;
    const bounds = {
      x: xExtent[0] - padding,
      y: yExtent[0] - padding,
      width: xExtent[1] - xExtent[0] + padding * 2,
      height: yExtent[1] - yExtent[0] + padding * 2,
    };

    // Update viewBox to fit all nodes
    this.svg.attr(
      "viewBox",
      `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`
    );

    // Render simplified nodes
    const miniNodes = this.svg
      .selectAll(".mini-node")
      .data(nodes, (d: any) => d.id);

    miniNodes
      .enter()
      .append("circle")
      .attr("class", "mini-node")
      .attr("r", 15) // Fixed small size relative to coordinate space usually, but here coord space is huge
      // If viewBox is 2000x2000, 15 is small.
      .attr("fill", "var(--text-muted)")
      .merge(miniNodes as any)
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y);

    miniNodes.exit().remove();
  }

  private updateViewRect(transform: d3.ZoomTransform) {
    if (!this.svg || !this.viewRect) return;

    // The viewRect represents the current viewport in the graph coordinate space.
    // Graph coords x,y map to screen coords X,Y via: X = x*k + tx
    // So screen 0 (left edge) maps to graph x = (0 - tx) / k
    // Screen Width maps to graph width / k

    // We need the dimensions of the main SVG viewport (screen size)
    const mainNode = this.mainSvg.node() as SVGElement;
    if (!mainNode) return;
    const { width, height } = mainNode.getBoundingClientRect();

    const vx = -transform.x / transform.k;
    const vy = -transform.y / transform.k;
    const vw = width / transform.k;
    const vh = height / transform.k;

    this.viewRect
      .attr("x", vx)
      .attr("y", vy)
      .attr("width", vw)
      .attr("height", vh);
  }
}
