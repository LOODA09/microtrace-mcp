// C Code Viewer Module
import type { NodeData } from "../types";
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";

// Register C language for highlighting
hljs.registerLanguage("c", c);

/**
 * Display C code from a node with syntax highlighting
 */
export function displayCCode(container: HTMLElement, node: NodeData): void {
  const cCode =
    node.c_code || `// C code for ${node.name}\n// No code available`;

  // Create pre>code structure for highlight.js
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-c hljs";
  code.textContent = cCode;

  // Apply syntax highlighting
  hljs.highlightElement(code);

  pre.appendChild(code);
  container.innerHTML = "";
  container.appendChild(pre);
}

/**
 * Clear C code display
 */
export function clearCCode(container: HTMLElement): void {
  container.innerHTML =
    "<pre><code class='language-c hljs'>// Select a function to view its C code</code></pre>";
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
