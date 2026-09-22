// 丸三三刀屋店 台データビューア
// Loads data/history.json (real) or sample-data/history.json (demo preview),
// and renders a sortable/filterable table plus per-machine trend charts.

const GENRE_LABEL = { pachinko: "パチンコ", slot: "スロット", "": "-" };
const PERIOD_DAYS = { "7": 7, "30": 30, "90": 90, all: Infinity };

const state = {
  source: "data",
  history: [], // [{date, store, machines:[...]}], ascending by date
  selectedDate: null,
  genre: "all",
  search: "",
  sortKey: "diff",
  sortDir: "desc",
  period: "30",
  selectedMachine: null, // "unit_no|model"
};

const els = {};

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("ja-JP");
}
function fmtSigned(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const s = n > 0 ? "+" : "";
  return s + n.toLocaleString("ja-JP");
}
function machineKey(m) {
  return `${m.unit_no}|${m.model}`;
}
function countsToText(counts) {
  if (!counts) return "";
  return Object.entries(counts)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
}
function setText(node, text) {
  node.textContent = text;
}

async function loadHistory(source) {
  const path = source === "sample" ? "sample-data/history.json" : "data/history.json";
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load ${path}`);
  const data = await res.json();
  data.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return data;
}

async function init() {
  els.root = document.getElementById("app");
  buildShell();
  await switchSource("data");
}

async function switchSource(source) {
  state.source = source;
  try {
    state.history = await loadHistory(source);
  } catch (e) {
    state.history = [];
  }
  state.selectedDate = state.history.length
    ? state.history[state.history.length - 1].date
    : null;
  state.selectedMachine = null;
  renderAll();
}

function buildShell() {
  els.root.innerHTML = `
    <div id="banner"></div>
    <div class="filters" id="filters"></div>
    <section class="card" id="table-section"></section>
    <section class="card" id="detail-section" hidden></section>
    <section class="card" id="ranking-section"></section>
  `;
  els.banner = document.getElementById("banner");
  els.filters = document.getElementById("filters");
  els.tableSection = document.getElementById("table-section");
  els.detailSection = document.getElementById("detail-section");
  els.rankingSection = document.getElementById("ranking-section");
}

function renderAll() {
  renderBanner();
  renderFilters();
  renderTableSection();
  renderDetailSection();
  renderRankingSection();
}

function renderBanner() {
  els.banner.innerHTML = "";
  if (state.source === "sample") {
    const div = document.createElement("div");
    div.className = "banner";
    const span = document.createElement("span");
    span.innerHTML = "<strong>サンプルデータ表示中</strong> — 実データではありません。動作確認用のダミーです。";
    const btn = document.createElement("button");
    setText(btn, "実データに戻る");
    btn.onclick = () => switchSource("data");
    div.appendChild(span);
    div.appendChild(btn);
    els.banner.appendChild(div);
    return;
  }
  if (state.history.length === 0) {
    const div = document.createElement("div");
    div.className = "banner";
    const span = document.createElement("span");
    setText(span, "まだ台データが登録されていません。データが登録されるとここに表示されます。");
    const btn = document.createElement("button");
    btn.className = "primary";
    setText(btn, "サンプルデータでプレビュー");
    btn.onclick = () => switchSource("sample");
    div.appendChild(span);
    div.appendChild(btn);
    els.banner.appendChild(div);
  } else {
    const div = document.createElement("div");
    div.className = "banner";
    const span = document.createElement("span");
    setText(span, `最新: ${state.history[state.history.length - 1].date} まで ${state.history.length}日分`);
    const btn = document.createElement("button");
    setText(btn, "サンプルデータでプレビュー");
    btn.onclick = () => switchSource("sample");
    div.appendChild(span);
    div.appendChild(btn);
    els.banner.appendChild(div);
  }
}

function renderFilters() {
  els.filters.innerHTML = "";
  if (!state.history.length) return;

  const dateSel = document.createElement("select");
  state.history
    .slice()
    .reverse()
    .forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.date;
      opt.textContent = d.date;
      if (d.date === state.selectedDate) opt.selected = true;
      dateSel.appendChild(opt);
    });
  dateSel.onchange = () => {
    state.selectedDate = dateSel.value;
    renderTableSection();
  };

  const genreSel = document.createElement("select");
  [["all", "全ジャンル"], ["pachinko", "パチンコ"], ["slot", "スロット"]].forEach(([v, l]) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = l;
    if (v === state.genre) opt.selected = true;
    genreSel.appendChild(opt);
  });
  genreSel.onchange = () => {
    state.genre = genreSel.value;
    renderTableSection();
    renderRankingSection();
  };

  const searchWrap = document.createElement("div");
  searchWrap.className = "grow";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "機種名・台番号で検索";
  search.value = state.search;
  search.oninput = () => {
    state.search = search.value;
    renderTableSection();
  };
  searchWrap.appendChild(search);

  const periodSel = document.createElement("select");
  [["7", "直近7日"], ["30", "直近30日"], ["90", "直近90日"], ["all", "全期間"]].forEach(([v, l]) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = l;
    if (v === state.period) opt.selected = true;
    periodSel.appendChild(opt);
  });
  periodSel.onchange = () => {
    state.period = periodSel.value;
    renderRankingSection();
    if (state.selectedMachine) renderDetailSection();
  };

  els.filters.appendChild(dateSel);
  els.filters.appendChild(genreSel);
  els.filters.appendChild(searchWrap);
  els.filters.appendChild(periodSel);
}

function filteredMachines(machines) {
  return machines.filter((m) => {
    if (state.genre !== "all" && m.genre !== state.genre) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      if (!m.model.toLowerCase().includes(q) && !m.unit_no.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderTableSection() {
  const day = state.history.find((d) => d.date === state.selectedDate);
  els.tableSection.innerHTML = "";
  const h2 = document.createElement("h2");
  setText(h2, day ? `${day.date} の台データ` : "台データ");
  els.tableSection.appendChild(h2);

  if (!day) {
    const p = document.createElement("p");
    p.className = "hint";
    setText(p, "表示する日付がありません。");
    els.tableSection.appendChild(p);
    return;
  }

  let rows = filteredMachines(day.machines);
  const dir = state.sortDir === "asc" ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    const av = a[state.sortKey];
    const bv = b[state.sortKey];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });

  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  const table = document.createElement("table");
  const cols = [
    ["unit_no", "台番号"],
    ["model", "機種"],
    ["diff", "差枚/差玉"],
    ["genre", "ジャンル"],
    ["total_games", "総回転数"],
    ["counts", "ボーナス等"],
  ];
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach(([key, label]) => {
    const th = document.createElement("th");
    setText(th, label + (key === state.sortKey ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""));
    if (key === state.sortKey) th.classList.add("active");
    if (key !== "counts") {
      th.onclick = () => {
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "model" || key === "unit_no" ? "asc" : "desc";
        }
        renderTableSection();
      };
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((m) => {
    const tr = document.createElement("tr");
    tr.onclick = () => {
      state.selectedMachine = machineKey(m);
      renderDetailSection();
      els.detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const cells = [
      m.unit_no,
      m.model,
      fmtSigned(m.diff),
      GENRE_LABEL[m.genre] || m.genre,
      fmtNum(m.total_games),
      countsToText(m.counts),
    ];
    cells.forEach((val, i) => {
      const td = document.createElement("td");
      setText(td, String(val));
      if (i === 2) td.classList.add(m.diff > 0 ? "pos" : m.diff < 0 ? "neg" : "");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  els.tableSection.appendChild(scroll);

  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "hint";
    setText(p, "条件に一致する台がありません。");
    els.tableSection.appendChild(p);
  }
}

function machineSeries(unitNo, model) {
  const days = periodSlice(state.history);
  const pts = [];
  days.forEach((d) => {
    const m = d.machines.find((x) => x.unit_no === unitNo && x.model === model);
    if (m) pts.push({ date: d.date, value: m.diff });
  });
  return pts;
}

function periodSlice(history) {
  const n = PERIOD_DAYS[state.period];
  if (!Number.isFinite(n)) return history;
  return history.slice(-n);
}

function renderDetailSection() {
  if (!state.selectedMachine) {
    els.detailSection.hidden = true;
    els.detailSection.innerHTML = "";
    return;
  }
  const [unitNo, model] = state.selectedMachine.split("|");
  const pts = machineSeries(unitNo, model);
  els.detailSection.hidden = false;
  els.detailSection.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.className = "detail-close";
  setText(closeBtn, "閉じる ×");
  closeBtn.onclick = () => {
    state.selectedMachine = null;
    renderDetailSection();
  };
  els.detailSection.appendChild(closeBtn);

  const h2 = document.createElement("h2");
  setText(h2, `${model}（${unitNo}番）の推移`);
  els.detailSection.appendChild(h2);

  const p = document.createElement("p");
  p.className = "hint";
  setText(p, `${periodLabel()} の差枚/差玉推移`);
  els.detailSection.appendChild(p);

  if (pts.length === 0) {
    const empty = document.createElement("p");
    setText(empty, "この期間のデータがありません。");
    els.detailSection.appendChild(empty);
    return;
  }

  const values = pts.map((p) => p.value);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const winRate = Math.round((values.filter((v) => v > 0).length / values.length) * 100);
  const best = Math.max(...values);
  const worst = Math.min(...values);

  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  [
    ["平均差枚/差玉", fmtSigned(avg)],
    ["プラス日率", `${winRate}%`],
    ["ベスト", fmtSigned(best)],
    ["ワースト", fmtSigned(worst)],
    ["記録日数", `${values.length}日`],
  ].forEach(([label, value]) => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const l = document.createElement("div");
    l.className = "label";
    setText(l, label);
    const v = document.createElement("div");
    v.className = "value";
    setText(v, value);
    tile.appendChild(l);
    tile.appendChild(v);
    statRow.appendChild(tile);
  });
  els.detailSection.appendChild(statRow);

  const chartWrap = document.createElement("div");
  chartWrap.className = "chart-wrap";
  els.detailSection.appendChild(chartWrap);
  renderLineChart(chartWrap, pts);

  appendTableToggle(els.detailSection, chartWrap, () => buildLineTable(pts));
}

function periodLabel() {
  return { "7": "直近7日", "30": "直近30日", "90": "直近90日", all: "全期間" }[state.period];
}

function buildLineTable(pts) {
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>日付</th><th>差枚/差玉</th></tr></thead>";
  const tbody = document.createElement("tbody");
  pts.forEach((p) => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    setText(td1, p.date);
    const td2 = document.createElement("td");
    setText(td2, fmtSigned(p.value));
    td2.classList.add(p.value > 0 ? "pos" : p.value < 0 ? "neg" : "");
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  scroll.appendChild(table);
  return scroll;
}

function appendTableToggle(parent, chartEl, buildTable) {
  let showing = false;
  let tableEl = null;
  const btn = document.createElement("button");
  btn.className = "toggle-table-view";
  setText(btn, "表で見る");
  btn.onclick = () => {
    showing = !showing;
    if (showing) {
      tableEl = buildTable();
      chartEl.after(tableEl);
      chartEl.style.display = "none";
      setText(btn, "グラフで見る");
    } else {
      if (tableEl) tableEl.remove();
      chartEl.style.display = "";
      setText(btn, "表で見る");
    }
  };
  parent.appendChild(btn);
}

// ---- Line chart (single series, diff over time) ----
function renderLineChart(container, pts) {
  const W = 640, H = 220, padL = 44, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const values = pts.map((p) => p.value);
  let vMin = Math.min(0, ...values);
  let vMax = Math.max(0, ...values);
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const pad = (vMax - vMin) * 0.1;
  vMin -= pad; vMax += pad;

  const x = (i) => padL + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v) => padT + innerH - ((v - vMin) / (vMax - vMin)) * innerH;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "差枚/差玉の推移グラフ");

  // gridlines (y)
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = vMin + ((vMax - vMin) * i) / ticks;
    const gy = y(v);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", padL);
    line.setAttribute("x2", W - padR);
    line.setAttribute("y1", gy);
    line.setAttribute("y2", gy);
    line.setAttribute("stroke", "var(--gridline)");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", padL - 8);
    label.setAttribute("y", gy + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "var(--text-muted)");
    label.textContent = Math.round(v).toLocaleString("ja-JP");
    svg.appendChild(label);
  }
  // zero baseline emphasized
  if (vMin < 0 && vMax > 0) {
    const zy = y(0);
    const zline = document.createElementNS(svgNS, "line");
    zline.setAttribute("x1", padL);
    zline.setAttribute("x2", W - padR);
    zline.setAttribute("y1", zy);
    zline.setAttribute("y2", zy);
    zline.setAttribute("stroke", "var(--baseline)");
    zline.setAttribute("stroke-width", "1");
    svg.appendChild(zline);
  }

  // x labels: first and last date
  [0, pts.length - 1].forEach((i) => {
    if (i < 0) return;
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", x(i));
    label.setAttribute("y", H - 8);
    label.setAttribute("text-anchor", i === 0 ? "start" : "end");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "var(--text-muted)");
    label.textContent = pts[i].date.slice(5);
    svg.appendChild(label);
  });

  // line path
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--series-pos)");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  // end marker + direct label
  const last = pts[pts.length - 1];
  const lx = x(pts.length - 1), ly = y(last.value);
  const ring = document.createElementNS(svgNS, "circle");
  ring.setAttribute("cx", lx);
  ring.setAttribute("cy", ly);
  ring.setAttribute("r", 6);
  ring.setAttribute("fill", "var(--surface-1)");
  svg.appendChild(ring);
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("cx", lx);
  dot.setAttribute("cy", ly);
  dot.setAttribute("r", 4);
  dot.setAttribute("fill", "var(--series-pos)");
  svg.appendChild(dot);
  const endLabel = document.createElementNS(svgNS, "text");
  endLabel.setAttribute("x", lx);
  endLabel.setAttribute("y", ly - 10);
  endLabel.setAttribute("text-anchor", "end");
  endLabel.setAttribute("font-size", "11");
  endLabel.setAttribute("font-weight", "700");
  endLabel.setAttribute("fill", last.value >= 0 ? "var(--delta-good)" : "var(--delta-bad)");
  endLabel.textContent = fmtSigned(last.value);
  svg.appendChild(endLabel);

  // crosshair
  const crosshair = document.createElementNS(svgNS, "line");
  crosshair.setAttribute("y1", padT);
  crosshair.setAttribute("y2", H - padB);
  crosshair.setAttribute("stroke", "var(--baseline)");
  crosshair.setAttribute("stroke-width", "1");
  crosshair.setAttribute("visibility", "hidden");
  svg.appendChild(crosshair);
  const hoverDot = document.createElementNS(svgNS, "circle");
  hoverDot.setAttribute("r", 4);
  hoverDot.setAttribute("fill", "var(--series-pos)");
  hoverDot.setAttribute("stroke", "var(--surface-1)");
  hoverDot.setAttribute("stroke-width", "2");
  hoverDot.setAttribute("visibility", "hidden");
  svg.appendChild(hoverDot);

  const hitRect = document.createElementNS(svgNS, "rect");
  hitRect.setAttribute("x", padL);
  hitRect.setAttribute("y", padT);
  hitRect.setAttribute("width", innerW);
  hitRect.setAttribute("height", innerH);
  hitRect.setAttribute("fill", "transparent");
  svg.appendChild(hitRect);

  container.innerHTML = "";
  container.appendChild(svg);
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  container.appendChild(tooltip);

  function pointerToIndex(evt) {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const ratio = Math.min(1, Math.max(0, (px - padL) / innerW));
    return Math.round(ratio * (pts.length - 1));
  }
  function showAt(i) {
    const p = pts[i];
    const px = x(i), py = y(p.value);
    crosshair.setAttribute("x1", px);
    crosshair.setAttribute("x2", px);
    crosshair.setAttribute("visibility", "visible");
    hoverDot.setAttribute("cx", px);
    hoverDot.setAttribute("cy", py);
    hoverDot.setAttribute("visibility", "visible");
    const rect = svg.getBoundingClientRect();
    tooltip.style.left = `${(px / W) * rect.width}px`;
    tooltip.style.top = `${(py / H) * rect.height}px`;
    tooltip.innerHTML = "";
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    setText(lbl, p.date);
    const val = document.createElement("div");
    val.className = "val";
    setText(val, fmtSigned(p.value) + " 差枚/差玉");
    tooltip.appendChild(lbl);
    tooltip.appendChild(val);
    tooltip.classList.add("show");
  }
  function hide() {
    crosshair.setAttribute("visibility", "hidden");
    hoverDot.setAttribute("visibility", "hidden");
    tooltip.classList.remove("show");
  }
  hitRect.addEventListener("pointermove", (e) => showAt(pointerToIndex(e)));
  hitRect.addEventListener("pointerleave", hide);
  hitRect.addEventListener("pointerdown", (e) => showAt(pointerToIndex(e)));
}

// ---- Ranking (diverging horizontal bars) ----
function rankingData() {
  const days = periodSlice(state.history);
  const agg = new Map();
  days.forEach((d) => {
    filteredMachines(d.machines).forEach((m) => {
      const key = machineKey(m);
      if (!agg.has(key)) agg.set(key, { key, model: m.model, unit_no: m.unit_no, sum: 0, n: 0 });
      const e = agg.get(key);
      e.sum += m.diff;
      e.n += 1;
    });
  });
  const list = [...agg.values()].map((e) => ({ ...e, avg: Math.round(e.sum / e.n) }));
  list.sort((a, b) => b.avg - a.avg);
  return list.slice(0, 10);
}

function renderRankingSection() {
  els.rankingSection.innerHTML = "";
  const h2 = document.createElement("h2");
  setText(h2, "平均差枚/差玉ランキング（上位10台）");
  els.rankingSection.appendChild(h2);
  const p = document.createElement("p");
  p.className = "hint";
  setText(p, `${periodLabel()}の平均`);
  els.rankingSection.appendChild(p);

  const data = rankingData();
  if (!data.length) {
    const empty = document.createElement("p");
    setText(empty, "データがありません。");
    els.rankingSection.appendChild(empty);
    return;
  }

  const chartWrap = document.createElement("div");
  chartWrap.className = "chart-wrap";
  els.rankingSection.appendChild(chartWrap);
  renderBarChart(chartWrap, data);

  appendTableToggle(els.rankingSection, chartWrap, () => buildRankingTable(data));
}

function buildRankingTable(data) {
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>台番号</th><th>機種</th><th>平均差枚/差玉</th></tr></thead>";
  const tbody = document.createElement("tbody");
  data.forEach((d) => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    setText(td1, d.unit_no);
    const td2 = document.createElement("td");
    setText(td2, d.model);
    const td3 = document.createElement("td");
    setText(td3, fmtSigned(d.avg));
    td3.classList.add(d.avg > 0 ? "pos" : d.avg < 0 ? "neg" : "");
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  scroll.appendChild(table);
  return scroll;
}

function renderBarChart(container, data) {
  const barH = 24, gap = 10, padL = 8, padR = 56, padT = 8, padB = 8;
  const labelW = 150;
  const W = 640;
  const H = padT + padB + data.length * (barH + gap) - gap;
  const innerW = W - padL - padR - labelW;

  const vMax = Math.max(0, ...data.map((d) => d.avg));
  const vMin = Math.min(0, ...data.map((d) => d.avg));
  const domain = Math.max(vMax, -vMin, 1);
  const zeroX = padL + labelW + (vMin < 0 ? (-vMin / (vMax - vMin || 1)) * innerW : 0);
  const scaleRange = vMax - vMin || 1;
  const xOf = (v) => padL + labelW + ((v - vMin) / scaleRange) * innerW;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "平均差枚/差玉ランキング");

  const zx = xOf(0);
  const zline = document.createElementNS(svgNS, "line");
  zline.setAttribute("x1", zx);
  zline.setAttribute("x2", zx);
  zline.setAttribute("y1", padT);
  zline.setAttribute("y2", H - padB);
  zline.setAttribute("stroke", "var(--baseline)");
  zline.setAttribute("stroke-width", "1");
  svg.appendChild(zline);

  container.innerHTML = "";
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";

  data.forEach((d, i) => {
    const y0 = padT + i * (barH + gap);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", padL + labelW - 8);
    label.setAttribute("y", y0 + barH / 2 + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "11");
    label.setAttribute("fill", "var(--text-secondary)");
    const shortModel = d.model.length > 12 ? d.model.slice(0, 12) + "…" : d.model;
    label.textContent = `${shortModel} (${d.unit_no})`;
    svg.appendChild(label);

    const barX = Math.min(xOf(d.avg), zx);
    const barW = Math.max(2, Math.abs(xOf(d.avg) - zx));
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", barX);
    rect.setAttribute("y", y0);
    rect.setAttribute("width", barW);
    rect.setAttribute("height", barH);
    rect.setAttribute("rx", 4);
    rect.setAttribute("fill", d.avg >= 0 ? "var(--series-pos)" : "var(--series-neg)");
    rect.style.cursor = "pointer";
    rect.tabIndex = 0;
    svg.appendChild(rect);

    const valLabel = document.createElementNS(svgNS, "text");
    const atEnd = xOf(d.avg);
    const outside = d.avg >= 0;
    valLabel.setAttribute("x", outside ? atEnd + 6 : atEnd - 6);
    valLabel.setAttribute("y", y0 + barH / 2 + 4);
    valLabel.setAttribute("text-anchor", outside ? "start" : "end");
    valLabel.setAttribute("font-size", "11");
    valLabel.setAttribute("font-weight", "700");
    valLabel.setAttribute("fill", d.avg >= 0 ? "var(--delta-good)" : "var(--delta-bad)");
    valLabel.textContent = fmtSigned(d.avg);
    svg.appendChild(valLabel);

    function show(evt) {
      const rectBox = svg.getBoundingClientRect();
      tooltip.style.left = `${((barX + barW / 2) / W) * rectBox.width}px`;
      tooltip.style.top = `${(y0 / H) * rectBox.height}px`;
      tooltip.innerHTML = "";
      const lbl = document.createElement("div");
      lbl.className = "lbl";
      setText(lbl, `${d.model}（${d.unit_no}番）`);
      const val = document.createElement("div");
      val.className = "val";
      setText(val, fmtSigned(d.avg) + " 平均");
      tooltip.appendChild(lbl);
      tooltip.appendChild(val);
      tooltip.classList.add("show");
    }
    function hide() {
      tooltip.classList.remove("show");
    }
    rect.addEventListener("pointerenter", show);
    rect.addEventListener("pointerleave", hide);
    rect.addEventListener("focus", show);
    rect.addEventListener("blur", hide);
  });

  container.appendChild(svg);
  container.appendChild(tooltip);
}

init();
