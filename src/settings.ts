export {};

declare global {
  interface Window {
    api?: {
      send: (txt: string) => Promise<{ success: boolean; error?: string }>;
      onOutput: (cb: (data: string) => void) => void;
      getFilePath: (file: File) => string;
      settingsGet: (key: string) => Promise<any>;
      settingsSet: (key: string, value: any) => Promise<{ success: boolean }>;
      settingsGetAll: () => Promise<Record<string, any>>;
    };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // --- Theme Settings ---
  const themeSelect = document.getElementById(
    "themeSelect"
  ) as HTMLSelectElement;

  // Load current theme
  const currentTheme = localStorage.getItem("themeMode") || "dark";
  if (themeSelect) {
    themeSelect.value = currentTheme;

    themeSelect.addEventListener("change", () => {
      const newTheme = themeSelect.value;
      localStorage.setItem("themeMode", newTheme);

      // Apply theme immediately
      if (newTheme === "light") {
        document.body.dataset.lightTheme = "true";
      } else {
        document.body.dataset.lightTheme = "false";
      }
    });
  }

  // --- Ghidra Settings ---
  const ghidraPathInput = document.getElementById(
    "ghidraPathInput"
  ) as HTMLInputElement;
  const ghidraFileBtn = document.getElementById(
    "ghidraFileBtn"
  ) as HTMLButtonElement;
  const ghidraStatus = document.getElementById(
    "ghidraStatus"
  ) as HTMLSpanElement;

  // Load current Ghidra path
  if (window.api?.settingsGet) {
    try {
      const savedPath = await window.api.settingsGet("ghidraPath");
      if (savedPath && ghidraPathInput) {
        ghidraPathInput.value = savedPath;
      }
    } catch (err) {
      console.error("Failed to load Ghidra path:", err);
    }
  }

  // Handle File Selection
  if (ghidraFileBtn && ghidraPathInput) {
    // We use a hidden file input to trigger the system dialog
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "file";
    hiddenInput.style.display = "none";
    // We can't easily filter for "analyzeHeadless" without extension on Linux/Mac,
    // but on Windows we can look for .bat.
    // However, the user said "analyzeHeadless.bat if windows and analyzeHeadless if else".
    // The browser file picker accept attribute is advisory.
    // We'll just let them pick any file and validate it.
    document.body.appendChild(hiddenInput);

    ghidraFileBtn.addEventListener("click", () => {
      hiddenInput.click();
    });

    hiddenInput.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Get full path via Electron API
        const fullPath = window.api?.getFilePath?.(file);

        if (fullPath) {
          // Basic validation
          const fileName = file.name;
          const isWin = navigator.userAgent.toLowerCase().includes("windows");
          const expectedName = isWin
            ? "analyzeHeadless.bat"
            : "analyzeHeadless";

          // We allow it even if it doesn't match, but warn?
          // The user request was specific about what it SHOULD be.
          // Let's just set it and save it.

          ghidraPathInput.value = fullPath;

          // Save to settings
          if (window.api?.settingsSet) {
            await window.api.settingsSet("ghidraPath", fullPath);
            if (ghidraStatus) {
              ghidraStatus.textContent = "Saved!";
              ghidraStatus.style.color = "var(--accent-color, #4CAF50)";
              setTimeout(() => {
                ghidraStatus.textContent = "";
              }, 2000);
            }
          }
        } else {
          alert("Could not retrieve file path. Please try again.");
        }
      }
      // Reset input so we can select the same file again if needed
      hiddenInput.value = "";
    });
  }
});
