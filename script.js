const PREFIXES = ["pc99", "paX", "PALLET", "pb", "dz-P-A", "cvFMS", "pk"];
const MAX_DATASETS = 20;
const baseURL = "https://qi-fcresearch-na.corp.amazon.com/YHM1/results?s=";
const colorPalette = [
  "#ffadad", // soft coral red
  "#ffd6a5", // warm peach
  "#fdffb6", // gentle yellow
  "#caffbf", // mint green
  "#9bf6ff", // baby blue
  "#bdb2ff", // soft lavender
  "#ffc6ff", // light pink violet
  "#f28b82", // coral accent
  "#fbbc04", // sunshine yellow
  "#ccff90", // pastel lime
  "#a0c4ff", // powder blue
  "#b9fbc0", // soft mint
  "#ffb5a7", // rose blush
  "#ffd6ff", // lilac mist
  "#fcd5ce", // pale salmon
  "#cdb4db", // dusty lavender
  "#fef9c3", // light cream yellow
  "#caf0f8", // icy blue
  "#ade8f4", // clear aqua
  "#ffafcc", // pinky rose contrast
];
let datasets = [];

const troubleshoot = document.getElementById("troubleshoot");
const fcresearch = document.getElementById("fcresearch");
const troubleshootCount = document.getElementById("troubleshoot-count");
const fcresearchCount = document.getElementById("fcresearch-count");
const openLinks = document.getElementById("open-links");
const jsonInput = document.getElementById("jsonInput");
const loadJson = document.getElementById("loadJson");
const clearAll = document.getElementById("clearAll");
const trailerButtons = document.getElementById("trailerButtons");
const charts = document.getElementById("charts");
const resultBox = document.getElementById("resultBox");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const searchHistory = document.getElementById("searchHistory");

const getIDs = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const updateCounts = () => {
  troubleshootCount.textContent = getIDs(troubleshoot.value).length;
  fcresearchCount.textContent = getIDs(fcresearch.value).length;
};
troubleshoot.addEventListener("input", updateCounts);
fcresearch.addEventListener("input", updateCounts);

openLinks.addEventListener("click", () => {
  const t = getIDs(troubleshoot.value);
  const f = new Set(getIDs(fcresearch.value));
  const unique = t.filter((id) => !f.has(id));
  if (!unique.length) return showModal("No unique IDs.");
  unique.forEach((id) => window.open(baseURL + id, "_blank"));
});

window.addEventListener("load", () => {
  datasets = JSON.parse(localStorage.getItem("jsonDatasets") || "[]");
  renderAll();
});

loadJson.addEventListener("click", () => {
  if (!jsonInput.value.trim()) return showModal("Paste JSON first.");
  if (datasets.length >= MAX_DATASETS) return showModal("Max 20 datasets.");
  try {
    const d = JSON.parse(jsonInput.value);
    const color = colorPalette[datasets.length % colorPalette.length];
    d.color = color;
    d.trailerId = d.trailerId || `Dataset ${datasets.length + 1}`;
    datasets.push(d);
    localStorage.setItem("jsonDatasets", JSON.stringify(datasets));
    jsonInput.value = "";
    renderAll();
  } catch {
    showModal("Invalid JSON format.");
  }
});

clearAll.addEventListener("click", () => {
  localStorage.removeItem("jsonDatasets");
  datasets = [];
  renderAll();
});

function renderAll() {
  renderButtons();
  charts.innerHTML =
    '<p style="color:#999;text-align:center;">Select a trailer to view chart.</p>';
}

function renderButtons() {
  trailerButtons.innerHTML = "";
  if (!datasets.length)
    return (trailerButtons.innerHTML = '<p style="color:#999;">No data.</p>');
  datasets.forEach((d) => {
    const b = document.createElement("div");
    b.textContent = d.trailerId;
    b.style.background = d.color;
    b.style.padding = "6px 8px";
    b.style.margin = "3px";
    b.style.borderRadius = "6px";
    b.style.cursor = "pointer";
    b.style.fontWeight = "600";
    b.onclick = () => renderChart(d);
    trailerButtons.appendChild(b);
  });
}

// === Chart Builder ===
function renderChart(dataset) {
  charts.innerHTML = "";
  const matched = [];
  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.container?.scannableId && typeof obj.quantityItems === "number") {
      const id = obj.container.scannableId;
      if (PREFIXES.some((p) => id.startsWith(p)) && obj.quantityItems >= 1) {
        matched.push({ id, qty: obj.quantityItems });
      }
    }
    if (Array.isArray(obj.childContainers))
      obj.childContainers.forEach(traverse);
    else Object.values(obj).forEach(traverse);
  }
  traverse(dataset.transferContainerHierarchy);
  if (!matched.length)
    return (charts.innerHTML =
      "<p style='color:#999;'>No matching containers found.</p>");
  matched.sort((a, b) => a.id.localeCompare(b.id));
  const labels = matched.map((m) => m.id);
  const values = matched.map((m) => m.qty);
  const wrapper = document.createElement("div");
  wrapper.className = "chart-wrapper";
  charts.appendChild(wrapper);
  const canvas = document.createElement("canvas");
  wrapper.appendChild(canvas);
  drawFullChart(canvas, labels, values, dataset.color, wrapper);
}

function drawFullChart(canvas, labels, values, color, wrapper) {
  const ctx = canvas.getContext("2d");
  const width = Math.max(labels.length * 60, charts.clientWidth - 40);
  const height = charts.clientHeight - 60;
  canvas.width = width;
  canvas.height = height;
  charts.style.overflowX = "auto";
  const max = Math.max(...values, 1);
  const barWidth = width / labels.length;
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.font = "10px Inter";
  labels.forEach((label, i) => {
    const val = values[i];
    const x = i * barWidth + barWidth / 2;
    const h = (val / max) * (height - 60);
    const y = height - 40 - h;
    ctx.fillStyle = color;
    ctx.fillRect(x - barWidth / 3, y, barWidth / 1.5, h);
    ctx.fillStyle = "#333";
    ctx.fillText(val, x, y - 5);
    const lbl = document.createElement("a");
    lbl.className = "chart-label";
    lbl.textContent = label;
    lbl.href = baseURL + label;
    lbl.target = "_blank";
    lbl.style.left = `${x - barWidth / 2 + 10}px`;
    lbl.style.width = `${barWidth - 10}px`;
    wrapper.appendChild(lbl);
  });
}

// === Search Logic ===
function findContainer(obj, id) {
  if (obj.container?.scannableId === id) return obj;
  for (const c of obj.childContainers || []) {
    const f = findContainer(c, id);
    if (f) return f;
  }
  return null;
}

function getContrastColor(hex) {
  const rgb = parseInt(hex.replace("#", ""), 16);
  const r = (rgb >> 16) & 0xff,
    g = (rgb >> 8) & 0xff,
    b = rgb & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  const id = event.target.value.trim();
  if (!id) return showModal("Scan Container ID");

  let found = null,
    foundData = null;

  for (const d of datasets) {
    for (const i of d.transferContainerHierarchy || []) {
      const f = findContainer(i, id);
      if (f) {
        found = d;
        foundData = f;
        break;
      }
    }
    if (found) break;
  }

  const li = document.createElement("div");
  const color = found ? found.color : "#f8f8f8";
  const textColor = found ? getContrastColor(color) : "#999999";

  resultBox.style.background = color;
  resultBox.style.color = textColor;
  resultBox.innerHTML = found
    ? `
      <h2><b>${found.trailerId}</b></h2>
      <p><b>Container:</b> ${foundData.container.scannableId}</p>
      <p><b>Type:</b> ${foundData.container.containerType}</p>
      <p><b>Quantity:</b> ${foundData.quantityItems || 0}</p>
      <p><b>Status:</b> ${foundData.containerStatus}</p>
    `
    : `<strong>No match found for:</strong> ${id}`;

  li.textContent = found
    ? `${id} → ${foundData.container.containerType} → ${
        foundData.quantityItems || 0
      } → ${found.trailerId}`
    : `${id} → No Match`;

  li.style.cssText = `
    background: ${color};
    color: ${textColor};
    border-radius: 6px;
    padding: 4px;
    margin: 2px 0;
  `;

  searchHistory.prepend(li);
  event.target.value = "";
});

clearBtn.addEventListener("click", () => {
  searchHistory.innerHTML = "";
  resultBox.innerHTML = "Results will appear here...";
  resultBox.style.background = "#e6f3ff";
  resultBox.style.color = "#000";
});

function showModal(msg) {
  const m = document.createElement("div");
  m.id = "custom-modal";
  m.textContent = msg;
  document.body.appendChild(m);
  setTimeout(() => (m.style.opacity = "1"), 10);
  setTimeout(() => {
    m.style.opacity = "0";
    setTimeout(() => m.remove(), 300);
  }, 2000);
}
