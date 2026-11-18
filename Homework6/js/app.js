"use strict";
let T = null, A = null, PAIRS = [], DS = null, PERM = null, tabSel = "obs", expSel = "exp";
const SEED = 2327983;
const PAL = ["#4aa8ee", "#ffa94d", "#52c98f", "#ff7ab6", "#ffd166", "#b69cff", "#5fd3d3", "#ff6b81"];
const f3 = x => Number.isFinite(x) ? (+x.toFixed(3)).toString() : "—";
const pc = x => (100 * x).toFixed(1) + "%";
const fp = p => p === 0 ? "0" : p < 1e-4 ? p.toExponential(2) : (+p.toPrecision(3)).toString();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function copyCode(id, btn) {
  const t = $(id).innerText.replace(/^Copy\n?/, "");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy", 1400); };
  try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); }
}

/* ---------------- data loading ---------------- */
const CUSTOM_TABLE = "Group, Passed, Failed\nStudied, 45, 15\nDid not study, 25, 35";
const CUSTOM_RAW = "Studied, Passed\nStudied, Passed\nStudied, Failed\nDid not study, Failed\nDid not study, Passed\nDid not study, Failed\nStudied, Passed\nDid not study, Failed";
function initSelect() {
  $("ds").innerHTML = Object.entries(DATASETS).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join("") + `<option value="sim">Simulated data (tunable dependence)</option><option value="custom">My own data (paste or load a file)</option>`;
  $("custTxt").value = CUSTOM_TABLE;
}
function dsChanged() {
  const k = $("ds").value;
  $("simBox").classList.toggle("hidden", k !== "sim"); $("custBox").classList.toggle("hidden", k !== "custom");
  update(true);
}
function custModeChanged() { $("custTxt").value = $("custMode").value === "table" ? CUSTOM_TABLE : CUSTOM_RAW; }
function loadFile(inp) {
  const f = inp.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { $("custTxt").value = String(r.result).slice(0, 2e6); update(true); }; r.readAsText(f);
}
const splitLine = l => l.split(/[,;\t]/).map(s => s.trim());
function parseCustom() {
  const lines = $("custTxt").value.split(/\r?\n/).filter(l => l.trim() !== "");
  if ($("custMode").value === "raw") {
    const pairs = lines.map(splitLine).filter(a => a.length >= 2).map(a => [a[0], a[1]]);
    if (pairs.length < 2) throw new Error("Enter at least two records, one pair 'x, f' per line.");
    return { pairs, names: ["X", "F"], opts: {} };
  }
  const rows = lines.map(splitLine); if (rows.length < 3 || rows[0].length < 3) throw new Error("A table needs a header row with at least two column labels and at least two data rows.");
  const cols = rows[0].slice(1), rl = [], O = [];
  for (const r of rows.slice(1)) {
    const v = r.slice(1, cols.length + 1).map(Number); if (v.length !== cols.length || v.some(x => !Number.isFinite(x) || x < 0 || x !== Math.round(x))) throw new Error("Counts must be non-negative integers; check row '" + r[0] + "'.");
    rl.push(r[0]); O.push(v);
  }
  const n = O.flat().reduce((a, b) => a + b, 0); if (n > 2e6) throw new Error("Too many observations for this page (max 2,000,000).");
  return { table: { O, rows: rl, cols, notes: [] }, names: [rows[0][0] || "X", "F"] };
}
function load() {
  const k = $("ds").value; $("dsMsg").textContent = "";
  let names = ["X", "F"], desc = "", table = null;
  if (DATASETS[k]) {
    const d = DATASETS[k]; DS = d; names = [d.X, d.F]; desc = d.desc;
    PAIRS = pairsFromTable(d.O, d.rows, d.cols, SEED); table = tableFromPairs(PAIRS, { rowOrder: d.rows, colOrder: d.cols });
  } else if (k === "sim") {
    DS = null; const n = Math.max(20, Math.min(200000, Math.round(+$("simN").value) || 300)), s = Math.max(0, Math.min(1, +$("simS").value || 0));
    PAIRS = simulate(n, s, (+$("simSeed").value) >>> 0); table = tableFromPairs(PAIRS, { rowOrder: ["X1", "X2", "X3"], colOrder: ["low", "high"] });
    desc = `Simulated sample of n = ${fmtN(n)}: X takes three values with equal probability and P(F = high | X) = 0.4 + s&middot;(x&minus;2)&middot;0.25 with s = ${s}. For s = 0 the variables are independent by construction; try s = 0.1 with n = 200 and with n = 5000.`;
  } else {
    DS = null; const c = parseCustom(); names = c.names;
    if (c.pairs) { PAIRS = c.pairs; table = tableFromPairs(PAIRS); } else { table = c.table; PAIRS = table.O.flat().reduce((a, b) => a + b, 0) <= 50000 ? pairsFromTable(table.O, table.rows, table.cols, SEED) : []; }
    desc = "Your own dataset.";
  }
  table = dropEmpty(table);
  if (table.rows.length < 2 || table.cols.length < 2) throw new Error("Both variables need at least two categories with observations.");
  if (table.rows.length > 30 || table.cols.length > 30) throw new Error("Too many categories (max 30 per variable).");
  T = table; T.names = names; T.notes = table.notes || [];
  const n = table.O.flat().reduce((a, b) => a + b, 0);
  $("dsDesc").innerHTML = `<b>X = ${esc(names[0])}</b> (${T.rows.length} categories), <b>F = ${esc(names[1])}</b> (${T.cols.length} categories), <b>n = ${fmtN(n)}</b> records.<br>${desc}${T.notes.length ? "<br><i>" + T.notes.join(" ") + "</i>" : ""}`;
  let h = `<tr><th>#</th><th>X = ${esc(names[0])}</th><th>F = ${esc(names[1])}</th></tr>`;
  PAIRS.slice(0, 8).forEach((p, i) => { h += `<tr><td class="m">${i + 1}</td><td>${esc(p[0])}</td><td>${esc(p[1])}</td></tr>`; });
  $("recTab").innerHTML = PAIRS.length ? h + `<tr><td class="m">…</td><td colspan="2">(first 8 of ${fmtN(PAIRS.length)} records; the contingency table below is obtained by counting them)</td></tr>` : "";
}

/* ---------------- tables ---------------- */
function shade(v, vmax) { return `background:rgba(74,168,238,${Math.min(0.55, 0.55 * v / (vmax || 1)).toFixed(3)})`; }
function resShade(r) { const a = Math.min(0.6, Math.abs(r) / 6); return r >= 0 ? `background:rgba(74,168,238,${a.toFixed(3)})` : `background:rgba(255,169,77,${a.toFixed(3)})`; }
function grid(cornerHtml, cells, o) {                        // cells(i,j) -> [text, style]; o: {rowTot(i), colTot(j), corner total}
  let h = `<tr><th class="rowh">${cornerHtml}</th>` + A.cols.map(c => `<th>${esc(c)}</th>`).join("") + (o.rt ? `<th class="tot">${o.rtLabel || "Total"}</th>` : "") + `</tr>`;
  A.rows.forEach((r, i) => { h += `<tr><th class="rowh">${esc(r)}</th>` + A.cols.map((_, j) => { const [t, st] = cells(i, j); return `<td class="hm" style="${st || ""}">${t}</td>`; }).join("") + (o.rt ? `<td class="hm tot">${o.rt(i)}</td>` : "") + `</tr>`; });
  if (o.ct) h += `<tr class="tot"><th class="rowh">${o.ctLabel || "Total"}</th>` + A.cols.map((_, j) => `<td class="hm">${o.ct(j)}</td>`).join("") + (o.rt ? `<td class="hm tot">${o.all}</td>` : "") + `</tr>`;
  return h;
}
const corner = () => `X \\ F`;
function buttons(id, opts, sel, fn) { $(id).innerHTML = opts.map(([k, l]) => `<button class="${k === sel ? "on" : ""}" onclick="${fn}('${k}')">${l}</button>`).join(""); }
function pickTab(k) { tabSel = k; renderFreq(); }
function pickExp(k) { expSel = k; renderExp(); }
function renderFreq() {
  buttons("tabBtns", [["obs", "Observed counts n<sub>ij</sub>"], ["joint", "Joint frequencies f<sub>ij</sub>"], ["condF", "F given X: f(F | X)"], ["condX", "X given F: f(X | F)"]], tabSel, "pickTab");
  const mx = Math.max(...A.O.flat());
  let h = "", cap = "";
  if (tabSel === "obs") { h = grid(corner(), (i, j) => [fmtN(A.O[i][j]), shade(A.O[i][j], mx)], { rt: i => fmtN(A.rowTot[i]), ct: j => fmtN(A.colTot[j]), all: fmtN(A.n) }); cap = "Counts with the marginal totals n<sub>i&bull;</sub> (right) and n<sub>&bull;j</sub> (bottom). Marginal relative frequencies: see the next tab."; }
  if (tabSel === "joint") { h = grid(corner(), (i, j) => [f3(A.joint[i][j]), shade(A.joint[i][j], Math.max(...A.joint.flat()))], { rt: i => f3(A.fRow[i]), ct: j => f3(A.fCol[j]), all: "1" }); cap = "f<sub>ij</sub> = n<sub>ij</sub>/n. The last column is the marginal distribution of X (f<sub>i&bull;</sub>), the last row the marginal distribution of F (f<sub>&bull;j</sub>)."; }
  if (tabSel === "condF") { h = grid(corner(), (i, j) => [f3(A.condF[i][j]), shade(A.condF[i][j], 1)], { rt: () => "1", ct: j => f3(A.fCol[j]), ctLabel: "Marginal f<sub>&bull;j</sub>", all: "1" }); cap = "Row profiles f(f<sub>j</sub> | x<sub>i</sub>) = n<sub>ij</sub>/n<sub>i&bull;</sub>: each row sums to 1. Independence &hArr; every row equals the marginal row at the bottom."; }
  if (tabSel === "condX") { h = grid(corner(), (i, j) => [f3(A.condX[i][j]), shade(A.condX[i][j], 1)], { rt: i => f3(A.fRow[i]), rtLabel: "Marginal f<sub>i&bull;</sub>", ct: () => "1", all: "1" }); cap = "Column profiles f(x<sub>i</sub> | f<sub>j</sub>) = n<sub>ij</sub>/n<sub>&bull;j</sub>: each column sums to 1. Independence &hArr; every column equals the marginal column on the right."; }
  $("freqTab").innerHTML = h; $("freqCap").innerHTML = cap;
}
function renderExp() {
  buttons("expBtns", [["exp", "Expected E<sub>ij</sub>"], ["contrib", "Contributions (O&minus;E)&sup2;/E"], ["res", "Pearson residuals (O&minus;E)/&radic;E"], ["adj", "Adjusted residuals"]], expSel, "pickExp");
  let h = "", cap = "";
  if (expSel === "exp") { h = grid(corner(), (i, j) => [f3(A.E[i][j]), ""], { rt: i => fmtN(A.rowTot[i]), ct: j => fmtN(A.colTot[j]), all: fmtN(A.n) }); cap = `Expected counts E<sub>ij</sub> = n<sub>i&bull;</sub>n<sub>&bull;j</sub>/n. Smallest expected count: <b>${f3(A.minE)}</b>; ${pc(A.lowFrac)} of the cells have E &lt; 5 ${A.lowFrac > 0.2 || A.minE < 1 ? "<span style='color:var(--warn)'>(the chi-square approximation may be unreliable: see the permutation test)</span>" : "(the rule of thumb is satisfied)"}.`; }
  if (expSel === "contrib") { const mx = Math.max(...A.contrib.flat()); h = grid(corner(), (i, j) => [f3(A.contrib[i][j]), shade(A.contrib[i][j], mx)], { rt: i => f3(A.contrib[i].reduce((a, b) => a + b, 0)), ct: j => f3(A.contrib.reduce((a, r) => a + r[j], 0)), all: f3(A.chi2) }); cap = `Each cell contributes (O&minus;E)&sup2;/E to the statistic; the grand total is &chi;&sup2; = <b>${f3(A.chi2)}</b>.`; }
  if (expSel === "res") { h = grid(corner(), (i, j) => [f3(A.resid[i][j]), resShade(A.resid[i][j])], { }); cap = "Blue: observed &gt; expected; orange: observed &lt; expected. Residuals beyond about &plusmn;2 point to the cells that depart most from independence."; }
  if (expSel === "adj") { h = grid(corner(), (i, j) => [f3(A.adj[i][j]), resShade(A.adj[i][j])], { }); cap = "Adjusted (standardised) residuals (O&minus;E)/&radic;(E(1&minus;n<sub>i&bull;</sub>/n)(1&minus;n<sub>&bull;j</sub>/n)) are approximately N(0, 1) under H<sub>0</sub>: |value| &gt; 2 is significant at about 5% for that cell."; }
  $("expTab").innerHTML = h; $("expCap").innerHTML = cap;
}

/* ---------------- figures ---------------- */
function resFill(r) { const a = Math.abs(r); if (a < 2) return "rgba(150,170,190,.30)"; const al = Math.min(0.9, 0.45 + (a - 2) / 6); return r > 0 ? `rgba(74,168,238,${al})` : `rgba(255,140,60,${al})`; }
function mosaic() {
  const svg = $("svgMosaic"), W = 560, H = 400, l = 56, rr = 14, t = 34, b = 70, gap = 3, pw = W - l - rr - gap * (A.r - 1), ph = H - t - b;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); let s = `<text class="tx2" x="${l}" y="18" font-size="14" font-weight="700">Mosaic plot of ${esc(T.names[0])} and ${esc(T.names[1])}</text>`, x = l;
  for (let i = 0; i < A.r; i++) {
    const w = pw * A.rowTot[i] / A.n; let y = t;
    for (let j = 0; j < A.c; j++) {
      const hh = ph * A.condF[i][j];
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(w, 0.5).toFixed(1)}" height="${Math.max(hh, 0).toFixed(1)}" fill="${resFill(A.resid[i][j])}" stroke="#0e1822" stroke-width="1.5"><title>${esc(A.rows[i])} / ${esc(A.cols[j])}: ${A.O[i][j]} (expected ${f3(A.E[i][j])}), residual ${f3(A.resid[i][j])}</title></rect>`;
      if (hh > 16 && w > 30) s += `<text class="tx2" x="${(x + w / 2).toFixed(1)}" y="${(y + hh / 2 + 4).toFixed(1)}" font-size="11.5" text-anchor="middle">${fmtN(A.O[i][j])}</text>`;
      if (i === 0 && hh > 10) s += `<text class="tx" x="${l - 6}" y="${(y + hh / 2 + 4).toFixed(1)}" font-size="11.5" text-anchor="end">${esc(String(A.cols[j]).slice(0, 9))}</text>`;
      y += hh;
    }
    const lab = esc(String(A.rows[i]).slice(0, Math.max(3, Math.floor(w / 6.5))));
    s += `<text class="tx" x="${(x + w / 2).toFixed(1)}" y="${H - b + 16}" font-size="11.5" text-anchor="middle">${lab}</text>`;
    x += w + gap;
  }
  s += `<text class="tx" x="${(l + W - rr) / 2}" y="${H - b + 34}" font-size="11.5" text-anchor="middle">${esc(T.names[0])} (width ∝ n<tspan dy="3" font-size="9">i•</tspan><tspan dy="-3">)</tspan></text>`;
  const lg = [["rgba(255,140,60,.85)", "residual < −2"], ["rgba(150,170,190,.30)", "|residual| < 2"], ["rgba(74,168,238,.85)", "residual > +2"]];
  lg.forEach(([c, tx], k) => { s += `<rect x="${l + k * 125}" y="${H - 22}" width="12" height="12" rx="2" fill="${c}"/><text class="tx" x="${l + k * 125 + 17}" y="${H - 12}" font-size="11.5">${tx}</text>`; });
  svg.innerHTML = s;
}
function bars() {
  const svg = $("svgBars"), W = 560, H = 400, l = 44, rr = 92, t = 34, b = 70, nb = A.r + 1, bw = (W - l - rr) / nb, ph = H - t - b;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); let s = `<text class="tx2" x="${l}" y="18" font-size="14" font-weight="700">Distribution of ${esc(T.names[1])} given ${esc(T.names[0])}</text>`;
  [0, 0.25, 0.5, 0.75, 1].forEach(v => { const y = t + ph * (1 - v); s += `<line class="gr" x1="${l}" x2="${W - rr}" y1="${y}" y2="${y}"/><text class="tx" x="${l - 5}" y="${y + 4}" font-size="11.5" text-anchor="end">${Math.round(v * 100)}%</text>`; });
  for (let i = 0; i < nb; i++) {
    const prof = i < A.r ? A.condF[i] : A.fCol, x = l + i * bw + bw * 0.12, w = bw * 0.76; let y = t + ph;
    for (let j = 0; j < A.c; j++) {
      const hh = ph * prof[j]; y -= hh;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${PAL[j % PAL.length]}" fill-opacity="${i === A.r ? 1 : 0.82}" stroke="#0e1822" stroke-width="1"><title>${i < A.r ? esc(A.rows[i]) : "overall"}: ${esc(A.cols[j])} ${pc(prof[j])}</title></rect>`;
      if (hh > 15 && w > 26) s += `<text x="${(x + w / 2).toFixed(1)}" y="${(y + hh / 2 + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="#0b1520" font-weight="700">${Math.round(prof[j] * 100)}%</text>`;
    }
    const lab = i < A.r ? String(A.rows[i]).slice(0, Math.max(3, Math.floor(bw / 6.3))) : "all (marginal)";
    s += `<text class="tx" x="${(x + w / 2).toFixed(1)}" y="${H - b + 16}" font-size="11.5" text-anchor="middle" ${i === A.r ? 'font-weight="700"' : ""}>${esc(i === A.r ? "all" : lab)}</text>`;
  }
  s += `<line x1="${l + A.r * bw - 2}" x2="${l + A.r * bw - 2}" y1="${t}" y2="${t + ph}" stroke="#ffd166" stroke-dasharray="4 4"/>`;
  A.cols.forEach((c, j) => { const y = t + 12 + j * 19; s += `<rect x="${W - rr + 10}" y="${y - 10}" width="12" height="12" rx="2" fill="${PAL[j % PAL.length]}"/><text class="tx" x="${W - rr + 27}" y="${y}" font-size="11.5">${esc(String(c).slice(0, 10))}</text>`; });
  s += `<text class="tx" x="${(l + W - rr) / 2}" y="${H - b + 34}" font-size="11.5" text-anchor="middle">${esc(T.names[0])}</text>`;
  svg.innerHTML = s;
}
function permHist() {
  const B = +$("perm").value, svg = $("svgPerm");
  if (!B || A.n > 300000) { svg.innerHTML = `<text class="tx" x="20" y="40" font-size="13">Permutation test not run.</text>`; svg.setAttribute("viewBox", "0 0 520 80"); PERM = null; return; }
  const Be = Math.max(200, Math.min(B, Math.floor(3e7 / A.n))); PERM = permutationTest(A, Be, SEED);
  const vals = Array.from(PERM.vals), hi = Math.max(...vals) * 1.02, nb = 30, w = hi / nb, cnt = new Array(nb).fill(0);
  vals.forEach(v => { cnt[Math.min(nb - 1, Math.floor(v / w))]++; });
  histChart(svg, { bars: cnt.map((c, i) => ({ x0: i * w, x1: (i + 1) * w, d: c / vals.length / w })), model: "B", pdf: x => chi2pdf(x, A.df), vline: A.chi2 <= hi * 1.6 ? { x: A.chi2 } : undefined, title: "χ² under shuffled labels", sub: A.chi2 <= hi * 1.6 ? `B = ${fmtN(Be)}` : `observed χ² = ${f3(A.chi2)} is off the scale →`, xlabel: "χ² (red = χ²(" + A.df + ") density)" });
  $("permCap").innerHTML = `Distribution of &chi;&sup2; when the F labels are shuffled at random (independence by construction, margins fixed), ${fmtN(Be)} times, against the theoretical &chi;&sup2;(${A.df}) density. The observed &chi;&sup2; = ${f3(A.chi2)} is ${A.chi2 <= hi * 1.6 ? "the dashed line" : "far to the right of every shuffled value (off the scale)"}.`;
}

/* ---------------- test results, interpretation ---------------- */
function renderTest() {
  const alpha = +$("alpha").value, crit = chi2crit(alpha, A.df), rej = A.p < alpha;
  $("kpis").innerHTML = `<div class="kpi"><div class="k">χ² statistic</div><div class="v">${f3(A.chi2)}</div></div><div class="kpi"><div class="k">Degrees of freedom</div><div class="v">${A.df}</div></div><div class="kpi ${rej ? "bad" : "good"}"><div class="k">p-value</div><div class="v">${fp(A.p)}</div></div><div class="kpi"><div class="k">Critical value (α = ${alpha})</div><div class="v">${f3(crit)}</div></div><div class="kpi ${rej ? "bad" : "good"}"><div class="k">Decision</div><div class="v" style="font-size:1.05rem">${rej ? "Reject H₀ (dependent)" : "Do not reject H₀"}</div></div><div class="kpi"><div class="k">Cramér's V</div><div class="v">${f3(A.V)}</div></div>`;
  $("testNote").innerHTML = `Since ${rej ? `&chi;&sup2; = ${f3(A.chi2)} &gt; ${f3(crit)} (equivalently p = ${fp(A.p)} &lt; ${alpha})` : `&chi;&sup2; = ${f3(A.chi2)} &le; ${f3(crit)} (equivalently p = ${fp(A.p)} &ge; ${alpha})`}, we ${rej ? "<b>reject</b> the hypothesis of independence at the " + alpha + " level" : "<b>do not reject</b> the hypothesis of independence at the " + alpha + " level"}.`;
  let h = `<tr><th>Test</th><th>Statistic</th><th>df</th><th>p-value</th><th>Decision at α</th></tr>`;
  const row = (nm, st, df, p) => { h += `<tr><td>${nm}</td><td class="n">${st}</td><td class="n">${df}</td><td class="n">${p === null ? "—" : fp(p)}</td><td class="n" style="color:${p !== null && p < alpha ? "var(--warn)" : "var(--ok)"}">${p === null ? "—" : p < alpha ? "reject H₀" : "do not reject"}</td></tr>`; };
  row("Pearson χ² (main test)", f3(A.chi2), A.df, A.p); row("Likelihood-ratio G = 2 Σ O ln(O/E)", f3(A.G), A.df, A.pG);
  if (A.r === 2 && A.c === 2) { row("Pearson χ² with Yates' continuity correction", f3(A.chi2Y), 1, A.pY); row("Fisher's exact test (two-sided)", "—", "—", A.pFisher); }
  if (PERM) row(`Monte-Carlo permutation test (B = ${fmtN(PERM.B)})`, f3(A.chi2), "—", PERM.p);
  $("altTab").innerHTML = h;
  const k = A.k, lab = v => v < 0.1 / Math.sqrt(k) ? "negligible" : v < 0.3 / Math.sqrt(k) ? "small" : v < 0.5 / Math.sqrt(k) ? "medium" : "large";
  let e = `<tr><th>Measure</th><th>Value</th><th>Reading</th></tr><tr><td>Cramér's V = √(χ²/(n·min(r−1, c−1)))</td><td class="n">${f3(A.V)}</td><td>${lab(A.V)} (Cohen's scale)</td></tr><tr><td>Cohen's w = √(χ²/n)</td><td class="n">${f3(Math.sqrt(A.chi2 / A.n))}</td><td>0.1 small, 0.3 medium, 0.5 large</td></tr><tr><td>Contingency coefficient C</td><td class="n">${f3(A.C)}</td><td>0 = independence; upper bound &lt; 1</td></tr>`;
  if (A.phi !== undefined) e += `<tr><td>φ coefficient (2×2)</td><td class="n">${f3(A.phi)}</td><td>sign depends on the order of the categories</td></tr><tr><td>Odds ratio (2×2)</td><td class="n">${f3(A.oddsRatio)}</td><td>1 = independence</td></tr>`;
  $("effTab").innerHTML = e;
}
function interpret() {
  const alpha = +$("alpha").value, rej = A.p < alpha, k = A.k, small = A.V < 0.1 / Math.sqrt(k);
  const cells = []; A.O.forEach((row, i) => row.forEach((o, j) => cells.push({ i, j, c: A.contrib[i][j], r: A.adj[i][j], o, e: A.E[i][j] }))); cells.sort((a, b) => b.c - a.c);
  const top = cells.slice(0, 3).map(c => `(${esc(A.rows[c.i])}, ${esc(A.cols[c.j])}): observed ${fmtN(c.o)} vs expected ${f3(c.e)} (${c.o > c.e ? "more" : "fewer"} than under independence; adjusted residual ${f3(c.r)}; ${pc(c.c / A.chi2)} of &chi;&sup2;)`);
  let best = null; A.O.forEach((row, i) => row.forEach((_, j) => { const d = A.condF[i][j] - A.fCol[j]; if (!best || Math.abs(d) > Math.abs(best.d)) best = { i, j, d }; }));
  let h = `<b>Conclusions for this dataset</b><ul class="plain">`;
  h += `<li><b>Decision.</b> &chi;&sup2; = ${f3(A.chi2)} with ${A.df} degrees of freedom, p = ${fp(A.p)}: ${rej ? `at &alpha; = ${alpha} the data are <b>not compatible with independence</b>; X = ${esc(T.names[0])} and F = ${esc(T.names[1])} are <b>statistically dependent (associated)</b>.` : `at &alpha; = ${alpha} there is <b>no sufficient evidence against independence</b>: the departures of the observed counts from the expected ones are of the size expected from sampling variation alone. This does not prove independence (the test may lack power).`}</li>`;
  h += `<li><b>Where the dependence comes from.</b> ${rej ? "Largest contributions: " + top.join("; ") + "." : "The three cells with the largest contributions are " + top.map((x, q) => x).join("; ") + "."}</li>`;
  h += `<li><b>In terms of conditional frequencies.</b> The largest gap between a conditional and the marginal frequency is for F = ${esc(A.cols[best.j])} given X = ${esc(A.rows[best.i])}: ${pc(A.condF[best.i][best.j])} against ${pc(A.fCol[best.j])} overall (a difference of ${(100 * best.d).toFixed(1)} percentage points). Under independence the two would coincide.</li>`;
  h += `<li><b>Strength.</b> Cramér&rsquo;s V = ${f3(A.V)}: ${small ? "negligible" : A.V < 0.3 / Math.sqrt(k) ? "small" : A.V < 0.5 / Math.sqrt(k) ? "medium" : "large"} association. ${rej && small ? "The result is <b>statistically significant but practically weak</b> (typical of a large n)." : rej ? "The association is both statistically significant and of non-trivial size." : ""}</li>`;
  h += `<li><b>Validity.</b> ${A.lowFrac > 0.2 || A.minE < 1 ? `<span style="color:var(--warn)">${pc(A.lowFrac)} of the expected counts are below 5 (minimum ${f3(A.minE)}): the chi-square approximation is questionable; rely on the permutation / Fisher p-values or merge categories.</span>` : `all conditions hold (minimum expected count ${f3(A.minE)}; ${PERM ? "the permutation p-value " + fp(PERM.p) + " agrees with the asymptotic one" : "run the permutation test to double-check"}).`} The records must come from independent observations.</li>`;
  const caus = { hair: "Hair colour does not <i>cause</i> eye colour (or vice versa): both are largely determined by ancestry and genetics, a common cause. The association is real but not causal.", titanic: "Class is associated with survival, and class plausibly mattered (location of the cabins, access to lifeboats), but the table also hides confounders: age and sex composition differ strongly across classes and crew, and the survival rule 'women and children first' acts on them. The chi-square test cannot separate these effects.", berkeley: "The pooled table shows an association between gender and admission. Section 6.1 below shows that, inside departments, it disappears (and in department A it even reverses): women applied more to departments with low admission rates. The association in the aggregate is caused by a third variable, not by discrimination within departments.", sim: "In a simulation the dependence is built in: here the causal mechanism is known (F is generated from X); with real data we never know it from the table alone." };
  h += `<li><b>Causality.</b> ${DS && DS === DATASETS.hair ? caus.hair : DS && DS === DATASETS.titanic ? caus.titanic : DS && DS === DATASETS.berkeley ? caus.berkeley : $("ds").value === "sim" ? caus.sim : "A significant result establishes only an association; any causal reading needs knowledge of the data-generating process or a randomised design."}</li></ul>`;
  $("findings").innerHTML = h;
}
function strata() {
  const box = $("strataBox"); if (!DS || !DS.strata) { box.innerHTML = ""; return; }
  const st = DS.strata; let h = `<h3>6.1 Stratified analysis by ${st.name.toLowerCase()} (Simpson&rsquo;s paradox)</h3><p>The same applicants, split by the third variable. For each ${st.name.toLowerCase()}: the share of ${esc(DS.cols[0]).toLowerCase()} for each group, and the chi-square test of independence <i>within</i> the ${st.name.toLowerCase()}.</p><div class="tblwrap"><table class="res"><tr><th>${st.name}</th><th>n</th>` + DS.rows.map(r => `<th>% ${esc(DS.cols[0])}: ${esc(r)}</th>`).join("") + `<th>Applicants ${esc(DS.rows[0]).toLowerCase()} / ${esc(DS.rows[1]).toLowerCase()}</th><th>χ²</th><th>p-value</th></tr>`;
  let sa = 0, sv = 0, sd = 0;
  const addRow = (lab, O) => { const B = analyse({ O, rows: DS.rows, cols: DS.cols }); h += `<tr><td class="m">${lab}</td><td class="n">${fmtN(B.n)}</td>` + B.condF.map(r => `<td class="n">${pc(r[0])}</td>`).join("") + `<td class="n">${fmtN(B.rowTot[0])} / ${fmtN(B.rowTot[1])}</td><td class="n">${f3(B.chi2)}</td><td class="n" style="color:${B.p < 0.05 ? "var(--warn)" : "var(--ok)"}">${fp(B.p)}</td></tr>`; return B; };
  st.O.forEach((O, i) => {
    const B = addRow(st.labels[i], O); const a = O[0][0], r1 = B.rowTot[0], c1 = B.colTot[0], n = B.n;
    sa += a - r1 * c1 / n; sv += B.rowTot[0] * B.rowTot[1] * B.colTot[0] * B.colTot[1] / (n * n * (n - 1));
  });
  const pooled = addRow("<b>All (pooled)</b>", DS.O), cmh = (Math.max(0, Math.abs(sa) - 0.5) ** 2) / sv, pc2 = chi2sf(cmh, 1);
  h += `</table></div><p class="note">Pooled: ${esc(DS.rows[0])} ${pc(pooled.condF[0][0])} admitted vs ${esc(DS.rows[1])} ${pc(pooled.condF[1][0])}: a highly significant gap. Within departments the gap is small and mostly not significant (only department A is significant, and there in favour of women). The Cochran&ndash;Mantel&ndash;Haenszel test, which combines the departments (2×2×K table, continuity-corrected), gives &chi;&sup2; = ${f3(cmh)}, p = ${fp(pc2)}: once the department is taken into account there is ${pc2 < 0.05 ? "still some evidence of association" : "no evidence of association between gender and admission"}. The paradox arises because men applied mostly to departments with high admission rates (A, B) and women to departments with low rates (C&ndash;F).</p>`;
  box.innerHTML = h;
}

/* ---------------- main ---------------- */
function update(reload) {
  try {
    if (reload || !T) load();
    A = analyse(T); renderFreq(); mosaic(); bars(); renderExp(); permHist(); renderTest(); interpret(); strata();
  } catch (e) { $("dsMsg").textContent = e.message; console.warn(e); }
}
initSelect(); update(true);
