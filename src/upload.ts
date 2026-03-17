export {};

interface Project {
  id: string;
  name: string;
  path: string;
  flashAddress: string;
  cpuFamily: string;
  dateAdded: number;
}

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

let projects: Project[] = [];
let activeProjectId: string | null = null;

function initializeUpload() {
  loadProjects();
  renderProjects();

  const fileInput = document.getElementById("fileInput") as HTMLInputElement;
  const fileInfo = document.getElementById("fileInfo") as HTMLDivElement;
  const addBtn = document.getElementById("addProjectBtn") as HTMLButtonElement;
  const flashSelect = document.getElementById(
    "flashAddress"
  ) as HTMLSelectElement;
  const customFlashInput = document.getElementById(
    "customFlashAddress"
  ) as HTMLInputElement;

  // File Selection
  fileInput.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["bin", "elf", "axf"].includes(ext || "")) {
        fileInfo.textContent = `Selected: ${file.name} (${(
          file.size / 1024
        ).toFixed(2)} KB)`;
        addBtn.disabled = false;
      } else {
        fileInfo.textContent =
          "Invalid file type. Please select .bin, .elf, or .axf";
        addBtn.disabled = true;
      }
    }
  });

  // Custom Flash Address Toggle
  flashSelect.addEventListener("change", () => {
    if (flashSelect.value === "custom") {
      customFlashInput.style.display = "block";
    } else {
      customFlashInput.style.display = "none";
    }
  });

  // Add Project
  addBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      alert("No file selected.");
      return;
    }

    // Get secure file path via Electron API
    const filePath = window.api?.getFilePath?.(file);

    if (!filePath) {
      alert("Could not retrieve file path. Please try again.");
      return;
    }

    let address = flashSelect.value;
    if (address === "custom") {
      address = customFlashInput.value.trim();
      if (!address.match(/^0x[0-9a-fA-F]+$/)) {
        alert("Invalid custom address. Use hex format (e.g., 0x08000000).");
        return;
      }
    }

    const projectName = document.getElementById(
      "projectName"
    ) as HTMLInputElement;
    const cpu = (document.getElementById("cpuFamily") as HTMLSelectElement)
      .value;

    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName.value.trim() || file.name,
      path: filePath,
      flashAddress: address,
      cpuFamily: cpu,
      dateAdded: Date.now(),
    };

    projects.push(newProject);
    saveProjects();

    // Auto-activate new project
    setActiveProject(newProject.id);

    renderProjects();

    // Reset form
    fileInput.value = "";
    fileInfo.textContent = "";
    addBtn.disabled = true;
  });
}

function loadProjects() {
  const stored = localStorage.getItem("microtrace_projects");
  if (stored) {
    projects = JSON.parse(stored);
  }
  activeProjectId = localStorage.getItem("microtrace_active_project");
}

function saveProjects() {
  localStorage.setItem("microtrace_projects", JSON.stringify(projects));
}

function setActiveProject(id: string) {
  activeProjectId = id;
  localStorage.setItem("microtrace_active_project", id);
  renderProjects();
}

function deleteProject(id: string) {
  projects = projects.filter((p) => p.id !== id);
  if (activeProjectId === id) {
    activeProjectId = null;
    localStorage.removeItem("microtrace_active_project");
  }
  saveProjects();
  renderProjects();
}

function renderProjects() {
  const list = document.getElementById("projectList");
  if (!list) return;

  if (projects.length === 0) {
    list.innerHTML =
      '<p style="text-align: center; color: var(--text-muted);">No projects added yet.</p>';
    return;
  }

  list.innerHTML = "";
  projects.forEach((p) => {
    const item = document.createElement("div");
    item.className = `project-item ${p.id === activeProjectId ? "active" : ""}`;

    const date = new Date(p.dateAdded).toLocaleDateString();

    item.innerHTML = `
      <div class="project-info">
        <h4>${p.name} ${p.id === activeProjectId ? "(Active)" : ""}</h4>
        <p>Path: ${p.path}</p>
        <p>CPU: ${p.cpuFamily} | Flash: ${p.flashAddress} | Added: ${date}</p>
      </div>
      <div class="project-actions">
        ${
          p.id !== activeProjectId
            ? `<button class="btn-activate" data-id="${p.id}">Activate</button>`
            : ""
        }
        <button class="btn-delete" data-id="${p.id}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

  // Event listeners for buttons
  list.querySelectorAll(".btn-activate").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id) setActiveProject(id);
    });
  });

  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id && confirm("Are you sure you want to delete this project?")) {
        deleteProject(id);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initializeUpload);
