// Dashboard TypeScript
import Chart from "chart.js/auto";

interface FunctionData {
  name: string;
  type: "mcal" | "hal" | "other" | "library";
  version?: string;
  cve?: string;
  severity?: "none" | "low" | "medium" | "high" | "critical";
}

interface AnalysisData {
  functions: FunctionData[];
  layerDistribution: { [key: string]: number };
  libraryUsage: { [key: string]: number };
  vulnerabilities: { [key: string]: number };
  components: { [key: string]: number };
}

// Sample data for demonstration
const sampleData: AnalysisData = {
  functions: [
    {
      name: "init_peripherals",
      type: "mcal",
      version: "1.0",
      cve: "CVE-2024-001",
      severity: "low",
    },
    { name: "read_sensor", type: "hal", version: "2.1", severity: "none" },
    {
      name: "FreeRTOS",
      type: "library",
      version: "10.4.3",
      cve: "CVE-2024-002",
      severity: "medium",
    },
    {
      name: "lwIP",
      type: "library",
      version: "2.1.2",
      cve: "CVE-2024-003",
      severity: "high",
    },
    { name: "compute", type: "other", severity: "none" },
    { name: "CMSIS-DSP", type: "library", version: "1.9.0", severity: "none" },
    { name: "write_actuator", type: "hal", version: "1.5", severity: "none" },
    {
      name: "USB_Stack",
      type: "library",
      version: "3.0.1",
      cve: "CVE-2024-004",
      severity: "critical",
    },
  ],
  layerDistribution: {
    MCAL: 15,
    HAL: 28,
    Other: 42,
    Library: 15,
  },
  libraryUsage: {
    FreeRTOS: 35,
    lwIP: 20,
    "CMSIS-DSP": 15,
    USB_Stack: 10,
    Other: 20,
  },
  vulnerabilities: {
    None: 60,
    Low: 15,
    Medium: 15,
    High: 7,
    Critical: 3,
  },
  components: {
    Functions: 45,
    Libraries: 30,
    Drivers: 15,
    Middleware: 10,
  },
};

let charts: { [key: string]: Chart } = {};

function initializeDashboard() {
  const fileInput = document.getElementById("fileInput") as HTMLInputElement;
  // const analyzeBtn = document.getElementById("analyzeBtn") as HTMLButtonElement;
  const fileInfo = document.getElementById("fileInfo") as HTMLDivElement;
  analyzeFirmware();
}

function analyzeFirmware() {
  const resultsSection = document.getElementById(
    "resultsSection"
  ) as HTMLElement;
  resultsSection.style.display = "block";
  resultsSection.scrollIntoView({ behavior: "smooth" });

  // Simulate analysis delay
  setTimeout(() => {
    populateTable(sampleData.functions);
    createCharts(sampleData);
  }, 500);
}

function populateTable(functions: FunctionData[]) {
  const tbody = document.getElementById(
    "functionsTableBody"
  ) as HTMLTableSectionElement;
  tbody.innerHTML = "";

  functions.forEach((func) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${func.name}</td>
      <td>${func.type.toUpperCase()}</td>
      <td>${func.version || "N/A"}</td>
      <td>${func.cve || "None"}</td>
      <td>
        ${
          func.severity && func.severity !== "none"
            ? `<span class="cve-badge ${
                func.severity
              }">${func.severity.toUpperCase()}</span>`
            : '<span class="cve-badge none">SAFE</span>'
        }
      </td>
    `;

    tbody.appendChild(row);
  });
}

function createCharts(data: AnalysisData) {
  const isLightTheme = document.body.dataset.lightTheme === "true";
  const textColor = isLightTheme ? "#1a1a2e" : "#e5e7eb";
  const gridColor = isLightTheme
    ? "rgba(0, 0, 0, 0.1)"
    : "rgba(255, 255, 255, 0.1)";

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: textColor,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  // Layer Distribution Chart
  const layerCtx = (
    document.getElementById("layerChart") as HTMLCanvasElement
  ).getContext("2d");
  if (layerCtx && !charts.layerChart) {
    charts.layerChart = new Chart(layerCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(data.layerDistribution),
        datasets: [
          {
            data: Object.values(data.layerDistribution),
            backgroundColor: [
              "rgba(31, 119, 180, 0.8)", // MCAL - blue
              "rgba(255, 127, 14, 0.8)", // HAL - orange
              "rgba(107, 174, 214, 0.8)", // Other - light blue
              "rgba(152, 223, 138, 0.8)", // Library - green
            ],
            borderWidth: 2,
            borderColor: textColor,
          },
        ],
      },
      options: chartOptions,
    });
  }

  // Library Usage Chart
  const libraryCtx = (
    document.getElementById("libraryChart") as HTMLCanvasElement
  ).getContext("2d");
  if (libraryCtx && !charts.libraryChart) {
    charts.libraryChart = new Chart(libraryCtx, {
      type: "bar",
      data: {
        labels: Object.keys(data.libraryUsage),
        datasets: [
          {
            label: "Usage %",
            data: Object.values(data.libraryUsage),
            backgroundColor: "rgba(102, 126, 234, 0.8)",
            borderColor: "rgba(102, 126, 234, 1)",
            borderWidth: 2,
          },
        ],
      },
      options: chartOptions,
    });
  }

  // Vulnerability Chart
  const vulnCtx = (
    document.getElementById("vulnerabilityChart") as HTMLCanvasElement
  ).getContext("2d");
  if (vulnCtx && !charts.vulnerabilityChart) {
    charts.vulnerabilityChart = new Chart(vulnCtx, {
      type: "pie",
      data: {
        labels: Object.keys(data.vulnerabilities),
        datasets: [
          {
            data: Object.values(data.vulnerabilities),
            backgroundColor: [
              "rgba(76, 175, 80, 0.8)", // None - green
              "rgba(255, 193, 7, 0.8)", // Low - yellow
              "rgba(255, 152, 0, 0.8)", // Medium - orange
              "rgba(244, 67, 54, 0.8)", // High - red
              "rgba(156, 39, 176, 0.8)", // Critical - purple
            ],
            borderWidth: 2,
            borderColor: textColor,
          },
        ],
      },
      options: chartOptions,
    });
  }

  // Component Chart
  const componentCtx = (
    document.getElementById("componentChart") as HTMLCanvasElement
  ).getContext("2d");
  if (componentCtx && !charts.componentChart) {
    charts.componentChart = new Chart(componentCtx, {
      type: "line",
      data: {
        labels: Object.keys(data.components),
        datasets: [
          {
            label: "Count",
            data: Object.values(data.components),
            borderColor: "rgba(0, 255, 240, 1)",
            backgroundColor: "rgba(0, 255, 240, 0.2)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: chartOptions,
    });
  }
}

// Watch for theme changes and update charts
const themeObserver = new MutationObserver(() => {
  Object.keys(charts).forEach((key) => {
    charts[key]?.destroy();
  });
  charts = {};
  const resultsSection = document.getElementById(
    "resultsSection"
  ) as HTMLElement;
  if (resultsSection.style.display !== "none") {
    createCharts(sampleData);
  }
});

themeObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["data-light-theme"],
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", initializeDashboard);
