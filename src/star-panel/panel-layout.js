// Layout is account-bound by the host; local storage also keeps browser refresh usable.
const STORAGE_KEY = "xuebutong.html.layout.v1";
const RANGES = {
  panelColumnRatio: { min: .20, max: .65, initial: .26 },
  panelQueueRatio: { min: .20, max: .65, initial: .35 },
  panelTaskRatio: { min: .20, max: .80, initial: .60 },
};
const ratios = Object.fromEntries(Object.entries(RANGES).map(([key, value]) => [key, value.initial]));
const valid = (key, value) => typeof value === "number" && Number.isFinite(value)
  && value >= RANGES[key].min && value <= RANGES[key].max;
const clamp = (value, box) => Math.min(box.max, Math.max(box.min, value));
let refresh = () => {}, bound = false, writes = Promise.resolve();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  for (const key of Object.keys(RANGES)) if (valid(key, saved?.[key])) ratios[key] = saved[key];
} catch (_) { /* Storage may be unavailable. */ }
let committed = { ...ratios };
const snapshot = () => ({ ...ratios });

function save(silent = false) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); } catch (_) {}
  const changed = Object.keys(RANGES).filter(key => ratios[key] !== committed[key]);
  committed = snapshot();
  if (silent || !changed.length) return;
  // Existing host bootstrap owns only the first divider's event. Keep its contract.
  if (changed.includes("panelColumnRatio")) {
    window.dispatchEvent(new CustomEvent("fusion-html-preferences-changed", { detail: snapshot() }));
  }
  const extra = Object.fromEntries(changed.filter(key => key !== "panelColumnRatio").map(key => [key, ratios[key]]));
  if (Object.keys(extra).length && window.fusionPanelBridge?.set) {
    writes = writes.then(() => window.fusionPanelBridge.set(extra)).catch(() => {
      window.dispatchEvent(new Event("fusion-html-preferences-error"));
    });
  }
}

window.fusionHtmlPreferences = function (next, options = {}) {
  if (next !== undefined) {
    const keys = next && typeof next === "object" ? Object.keys(RANGES).filter(key => key in next) : [];
    if (!keys.length || keys.some(key => !valid(key, next[key]))) throw new TypeError("Invalid panel layout ratios");
    for (const key of keys) ratios[key] = next[key];
    refresh();
    save(options?.silent === true);
  }
  return snapshot();
};

export function initPanelLayout() {
  if (bound) return;
  const columns = document.getElementById("panelColumns"), main = document.getElementById("taskColumn");
  const left = document.getElementById("panelDivider"), queue = document.getElementById("queueDivider");
  const split = document.getElementById("tasksSplit"), height = document.getElementById("taskLogDivider");
  if (!columns || !main || !left || !queue || !split || !height) return;
  bound = true;
  const narrow = window.matchMedia("(max-width: 759px)");
  const widthEnabled = () => !narrow.matches && columns.clientWidth > 0;
  const heightEnabled = () => split.classList.contains("with-log") && split.clientHeight > 0;

  function widthGeometry() {
    const available = Math.max(1, columns.clientWidth - 24);
    const leftRange = { min: Math.max(.20, 180 / available), max: Math.min(.65, (available - 480) / available) };
    const leftWidth = Math.round(clamp(ratios.panelColumnRatio, leftRange) * available);
    const rest = Math.max(1, available - leftWidth);
    return { available, leftRange, leftWidth, rest,
      queueRange: { min: Math.max(.20, 180 / rest), max: Math.min(.65, (rest - 300) / rest) } };
  }
  function heightGeometry() {
    const available = Math.max(1, split.clientHeight - 10);
    const minimum = Math.min(110, available * .4);
    return { available, min: Math.max(.20, minimum / available), max: Math.min(.80, 1 - minimum / available) };
  }
  function describe(node, box, value, text) {
    node.setAttribute("aria-valuemin", String(Math.ceil(box.min * 100)));
    node.setAttribute("aria-valuemax", String(Math.floor(box.max * 100)));
    node.setAttribute("aria-valuenow", String(Math.round(value * 100)));
    node.setAttribute("aria-valuetext", text + Math.round(value * 100) + "%");
  }
  refresh = () => {
    left.tabIndex = queue.tabIndex = widthEnabled() ? 0 : -1;
    if (widthEnabled()) {
      const box = widthGeometry(), q = clamp(ratios.panelQueueRatio, box.queueRange);
      columns.style.setProperty("--panel-left-width", box.leftWidth + "px");
      columns.style.setProperty("--panel-queue-width", Math.round(q * box.rest) + "px");
      describe(left, box.leftRange, box.leftWidth / box.available, "课程列表占可用宽度 ");
      describe(queue, box.queueRange, q, "刷课队列占右侧区域宽度 ");
    }
    main.classList.toggle("narrow-task-region", narrow.matches || main.clientWidth < 720);
    main.classList.toggle("compact-task-table", main.clientWidth < 480);
    height.tabIndex = heightEnabled() ? 0 : -1;
    if (heightEnabled()) {
      const box = heightGeometry(), shown = clamp(ratios.panelTaskRatio, box);
      split.style.setProperty("--panel-task-height", Math.round(shown * box.available) + "px");
      describe(height, box, shown, "任务列表占任务与日志区域高度 ");
    }
  };

  function bindDivider(node, key, axis, enabled, range, coordinate) {
    let pointer = null, start;
    const resizeClass = axis === "y" ? "panel-resizing-row" : "panel-resizing";
    function end(event, cancel = false) {
      if (pointer !== event.pointerId) return;
      const active = pointer;
      pointer = null;
      if (cancel) ratios[key] = start;
      document.documentElement.classList.remove(resizeClass);
      if (node.hasPointerCapture(active)) node.releasePointerCapture(active);
      refresh();
      if (!cancel) save();
    }
    node.addEventListener("pointerdown", event => {
      if (!enabled() || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      pointer = event.pointerId;
      start = ratios[key];
      node.setPointerCapture(pointer);
      document.documentElement.classList.add(resizeClass);
    });
    node.addEventListener("pointermove", event => {
      if (pointer !== event.pointerId) return;
      ratios[key] = clamp(coordinate(event), range());
      refresh();
    });
    node.addEventListener("pointerup", event => end(event));
    node.addEventListener("pointercancel", event => end(event, true));
    node.addEventListener("lostpointercapture", event => end(event));
    node.addEventListener("dblclick", () => { if (enabled()) { ratios[key] = RANGES[key].initial; refresh(); save(); } });
    node.addEventListener("keydown", event => {
      const back = axis === "y" ? "ArrowUp" : "ArrowLeft", forward = axis === "y" ? "ArrowDown" : "ArrowRight";
      if (!enabled() || ![back, forward, "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const box = range(), shown = clamp(ratios[key], box), step = event.shiftKey ? .05 : .02;
      ratios[key] = event.key === "Home" ? box.min : event.key === "End" ? box.max : clamp(shown + (event.key === forward ? step : -step), box);
      refresh();
      save();
    });
  }
  bindDivider(left, "panelColumnRatio", "x", widthEnabled, () => widthGeometry().leftRange, event =>
    (event.clientX - columns.getBoundingClientRect().left - 6) / widthGeometry().available);
  bindDivider(queue, "panelQueueRatio", "x", widthEnabled, () => widthGeometry().queueRange, event => {
    const box = widthGeometry();
    return (event.clientX - columns.getBoundingClientRect().left - box.leftWidth - 12 - 6) / box.rest;
  });
  bindDivider(height, "panelTaskRatio", "y", heightEnabled, heightGeometry, event =>
    (event.clientY - split.getBoundingClientRect().top - 5) / heightGeometry().available);
  window.addEventListener("resize", refresh);
  window.addEventListener("fusion-panel-layout-change", refresh);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(refresh);
    observer.observe(columns);
    observer.observe(split);
  }
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    try {
      const value = JSON.parse(event.newValue || "null");
      for (const key of Object.keys(RANGES)) if (valid(key, value?.[key])) ratios[key] = value[key];
      committed = snapshot();
      refresh();
    } catch (_) {}
  });
  refresh();
}
