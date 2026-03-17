// Assembly Viewer Module
import type { NodeData } from "../types";
import hljs from "highlight.js/lib/core";
import x86asm from "highlight.js/lib/languages/x86asm";

// Register x86 assembly language for highlighting
hljs.registerLanguage("x86asm", x86asm);

/**
 * Display the full assembly listing with line numbers and syntax highlighting
 */
export function displayFullAsm(asmText: string, container: HTMLElement): void {
  const asmLines = asmText.split("\n");
  let html = '<div class="asm-listing">';

  for (let i = 0; i < asmLines.length; i++) {
    const lineNum = i + 1;
    const lineContent = asmLines[i] || "";

    // Apply highlighting to each line
    const highlighted = hljs.highlight(lineContent, {
      language: "x86asm",
    }).value;

    html += `<div class="asm-line" data-line="${lineNum}">`;
    html += `<span class="line-num">${lineNum}</span>`;
    html += `<span class="line-content">${highlighted}</span>`;
    html += "</div>";
  }

  html += "</div>";
  container.innerHTML = html;
}

/**
 * Highlight specific assembly lines and scroll to them
 */
export function highlightAsmLines(
  container: HTMLElement,
  startLine: number,
  instructionCount: number,
): void {
  // Remove existing highlights
  container.querySelectorAll(".asm-line").forEach((line) => {
    line.classList.remove("highlighted");
  });

  // Add highlights to the target range
  for (let i = startLine; i < startLine + instructionCount; i++) {
    const lineEl = container.querySelector(`.asm-line[data-line="${i}"]`);
    if (lineEl) {
      lineEl.classList.add("highlighted");
    }
  }

  // Scroll to the first highlighted line
  scrollToLine(container, startLine);
}

/**
 * Scroll to a specific line number
 */
export function scrollToLine(container: HTMLElement, lineNum: number): void {
  setTimeout(() => {
    const target = container.querySelector(`.asm-line[data-line="${lineNum}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "center" });
    }
  }, 100);
}

/**
 * Attach click handlers to assembly lines
 */
export function attachAsmClickHandlers(
  container: HTMLElement,
  onLineClick: (lineNum: number) => void,
): void {
  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const lineEl = target.closest(".asm-line");
    if (lineEl) {
      const lineNum = parseInt(lineEl.getAttribute("data-line") || "0");
      if (lineNum > 0) {
        onLineClick(lineNum);
      }
    }
  });
}

/**
 * Find which node owns a specific assembly line
 */
export function findNodeByAsmLine(
  lineNum: number,
  nodes: NodeData[],
): NodeData | undefined {
  return nodes.find((n) => {
    const start = n.asm_start_line || 0;
    const end = start + (n.instruction_count || 0);
    return lineNum >= start && lineNum < end;
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
