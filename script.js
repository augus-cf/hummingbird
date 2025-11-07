const PREFIXES_json = ["pc99", "paX", "PALLET", "pb", "dz-P-A", "cvFMS", "csX", "tsX", "pk"];
const PREFIXES = ["pc99", "paX", "PALLET", "pb", "dz-P-A", "cvFMS", "pk"];

const MAX_DATASETS = 21;
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

// --- Filtering utilities (preserve only needed containers) ---
// Utility: test prefix match
function matchesPrefix(scannableId) {
  if (!scannableId || typeof scannableId !== "string") return false;
  return PREFIXES_json.some((pj) => scannableId.startsWith(pj));
}

// Recursive filter function:
// Returns array of filtered nodes (each contains container.scannableId, quantityItems, and childContainers if any).
function filterContainers(containers) {
  if (!Array.isArray(containers)) return [];
  const out = [];
  for (const node of containers) {
    const scannableId =
      node && node.container && node.container.scannableId
        ? node.container.scannableId
        : "";
    // start with original numeric quantity
    let quantity = Number(node.quantityItems || 0);
    const children = Array.isArray(node.childContainers)
      ? node.childContainers
      : [];

    const filteredChildren = filterContainers(children);

    // ensure nodes with the "pk" prefix are kept regardless of original qty
    const nodeMatches =
      matchesPrefix(scannableId) &&
      (quantity > 0 || scannableId.startsWith("pk"));
    // Keep node if it matches itself (and qty>0) OR any children matched.
    if (nodeMatches || filteredChildren.length) {
      // force quantityItems = 101 for any scannableId that starts with "pk"
      if (scannableId.startsWith("pk")) {
        quantity = 101;
      }
      const reduced = {
        container: { scannableId: scannableId || null },
        quantityItems: quantity,
      };
      if (filteredChildren.length) reduced.childContainers = filteredChildren;
      out.push(reduced);
    }
  }
  return out;
}

// Top-level fields we will preserve if present
const topFields = [
  "containerStatusMap",
  "amazonShipmentRefId",
  "trailerId",
  "itemQuantity",
  "itemQuantityLeftToStow",
  "palletQuantity",
  "toteQuantity",
  "caseQuantity",
  "stowByDate",
  "receivedByUserId",
  "sourceWarehouseId",
  "destinationWarehouseId",
  "departTime",
  "arrivalTime",
  "dockAppointmentId",
  "transferStatus",
  "dockAppointmentTime",
  "dockArrivalTime",
  "lastUpdatedDate",
  "containerLvlReceive",
  "throttlingOccurred",
];

function processInput(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Invalid JSON: " + err.message);
  }
  const filteredHierarchy = filterContainers(
    parsed.transferContainerHierarchy || []
  );
  const out = { transferContainerHierarchy: filteredHierarchy };
  for (const k of topFields) {
    if (k in parsed) out[k] = parsed[k];
  }
  return out;
}

// Enable/disable the Load button based on trimmed input and dataset capacity
function updateLoadButtonState() {
  try {
    const hasText = !!jsonInput.value && jsonInput.value.trim().length > 0;
    const atMax = datasets.length >= MAX_DATASETS;
    loadJson.disabled = !hasText || atMax;
    // optionally provide a tooltip when disabled due to max
    if (loadJson.disabled && atMax) {
      loadJson.title = `Maximum of ${MAX_DATASETS} datasets reached`;
    } else {
      loadJson.title = hasText ? "Load JSON" : "Paste JSON to enable";
    }
  } catch (e) {
    // defensive: if elements not yet available, ignore
  }
}

// (moved later so DOM elements are available)

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

// wire up json input helpers: input -> update button state, paste & drop -> trim
jsonInput.addEventListener("input", updateLoadButtonState);

jsonInput.addEventListener("paste", (e) => {
  try {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    jsonInput.value = text ? text.trim() : "";
    updateLoadButtonState();
  } catch (err) {
    // fallback: let default behavior occur
  }
});

jsonInput.addEventListener("dragover", (e) => e.preventDefault());
jsonInput.addEventListener("drop", (e) => {
  e.preventDefault();
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    const f = dt.files[0];
    // read file content if possible
    if (f && typeof f.text === "function") {
      f.text()
        .then((t) => {
          jsonInput.value = t ? t.trim() : "";
          updateLoadButtonState();
        })
        .catch(() => showModal("Unable to read dropped file."));
      return;
    }
  }
  // fallback to plain text drop
  const text = (dt && dt.getData && dt.getData("text")) || "";
  jsonInput.value = text.trim();
  updateLoadButtonState();
});

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
  // ensure Load button initial state reflects current input and datasets
  updateLoadButtonState();
});

loadJson.addEventListener("click", async () => {
  if (!jsonInput.value.trim()) return showModal("Paste JSON first.");
  if (datasets.length >= MAX_DATASETS)
    return showModal(`Max ${MAX_DATASETS} datasets.`);
  // Prevent double-clicks or re-entry while processing
  if (loadJson.disabled) return;

  const labelEl = loadJson.querySelector(".btn-label");
  const prevLabel = labelEl ? labelEl.textContent : "";
  loadJson.disabled = true;
  loadJson.classList.add("loading");
  if (labelEl) labelEl.textContent = "Loading...";
  try {
    // yield to the event loop so the UI can reflect the disabled state and spinner
    await new Promise((r) => setTimeout(r, 20));
    // Process and filter incoming JSON according to rules in processInput()
    const processed = processInput(jsonInput.value);
    const color = colorPalette[datasets.length % colorPalette.length];
    processed.color = color;
    processed.trailerId = processed.trailerId || `Dataset ${datasets.length + 1}`;
    datasets.push(processed);
    localStorage.setItem("jsonDatasets", JSON.stringify(datasets));
    jsonInput.value = "";
    renderAll();
  } catch (err) {
    showModal(err && err.message ? err.message : "Invalid JSON format.");
  } finally {
    if (labelEl) labelEl.textContent = prevLabel;
    loadJson.classList.remove("loading");
    updateLoadButtonState();
  }
});

clearAll.addEventListener("click", () => {
  localStorage.removeItem("jsonDatasets");
  datasets = [];
  renderAll();
  updateLoadButtonState();
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
    b.className = "trailer-item";
    b.textContent = d.trailerId;
    // keep color inline so each tile keeps its assigned color
    b.style.background = d.color;
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
  ctx.font = "12px Inter";
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
      <h1><b>${found.trailerId}</b></h1>
      <h3><b>Container:</b> ${foundData.container.scannableId}</h3>
      <p><b>Type:</b> ${foundData.scannableId}</p>
      <h3><b>Quantity:</b> ${foundData.quantityItems || 0}</h3>
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
