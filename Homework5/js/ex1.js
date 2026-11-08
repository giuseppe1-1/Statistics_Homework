"use strict";
let F = FUNCS[0], CONV = null;
const fv = v => v === Infinity ? "∞" : Number.isFinite(v) ? (+v.toPrecision(9)).toString() : "n/a";
const fe = e => !Number.isFinite(e) ? "—" : e === 0 ? "0" : e.toExponential(2);
const capN = (n, f) => Math.max(1, Math.min(Math.round(n) || 1, f.patho ? 3000 : 200000));
const nVal = () => capN(+$("nIn").value, F);

function initSel() {
  $("fsel").innerHTML = FUNCS.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
  $("fsel").value = F.id;
}
function selectF() { F = FUNCS.find(f => f.id === $("fsel").value); renderAll(); }

/* ---------------- pictures ---------------- */
function frame(svg, ymax) {
  const W = 520, H = 300, l = 44, r = 14, t = 30, b = 34;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const px = x => l + (W - l - r) * (x - F.a) / (F.b - F.a), py = y => H - b - (H - b - t) * y / ymax;
  let s = "";
  linTicks(0, ymax, 4).forEach(v => { s += `<line class="gr" x1="${l}" x2="${W - r}" y1="${py(v)}" y2="${py(v)}"/><text class="tx" x="${l - 5}" y="${py(v) + 3.5}" font-size="12" text-anchor="end">${tickLabel(v)}</text>`; });
  linTicks(F.a, F.b, 5).forEach(v => { s += `<text class="tx" x="${px(v)}" y="${H - b + 17}" font-size="12" text-anchor="middle">${tickLabel(v)}</text>`; });
  return { W, H, l, r, t, b, px, py, s };
}
function axes(g) { return `<line class="ax" x1="${g.l}" y1="${g.t}" x2="${g.l}" y2="${g.H - g.b}"/><line class="ax" x1="${g.l}" y1="${g.H - g.b}" x2="${g.W - g.r}" y2="${g.H - g.b}"/>`; }
function ymaxOf(n) { return F.patho ? 1.15 : F.hi == null ? Math.min(1 + Math.sqrt(Math.min(n, 50)), 8) * 1.05 : F.hi * 1.12; }
function curve(g, ymax) {
  let pts = []; for (let i = 0; i <= 400; i++) { const x = F.a + (F.b - F.a) * i / 400, y = F.f(x); if (!Number.isFinite(y)) continue; pts.push(g.px(x).toFixed(1) + "," + g.py(Math.min(y, ymax)).toFixed(1)); }
  return `<polyline fill="none" stroke="${COL.W}" stroke-width="2" points="${pts.join(" ")}"/>`;
}
function popcorn(g, big) {
  let s = ""; for (let q = 1; q <= 30; q++) for (let p = 0; p <= q; p++) if (gcd(p, q) === 1) s += `<circle cx="${g.px(p / q)}" cy="${g.py(1 / q)}" r="${big ? 2.6 : 2.2}" fill="${COL.R}"/>`;
  return s;
}
function drawR(svg, n) {
  const ymax = ymaxOf(n), g = frame(svg, ymax), nd = Math.min(n, F.patho ? 40 : 50), h = (F.b - F.a) / nd; let s = g.s;
  if (F.patho) {
    for (let i = 0; i < nd; i++) { const sup = F.patho === "dir" ? 1 : thomaeSup(i, nd); s += `<rect x="${g.px(F.a + i * h) + 0.5}" y="${g.py(sup)}" width="${g.px(F.a + h) - g.px(F.a) - 1}" height="${g.py(0) - g.py(sup)}" fill="${COL.B}" fill-opacity=".3" stroke="${COL.B}" stroke-width=".8"/>`; }
    s += F.patho === "thomae" ? popcorn(g) : `<line x1="${g.l}" x2="${g.W - g.r}" y1="${g.py(1)}" y2="${g.py(1)}" stroke="${COL.R}" stroke-width="2" stroke-dasharray="2 4"/><text class="tx" x="${g.W - g.r - 4}" y="${g.py(1) - 6}" font-size="11.5" text-anchor="end">rationals: f = 1</text><line x1="${g.l}" x2="${g.W - g.r}" y1="${g.py(0)}" y2="${g.py(0)}" stroke="${COL.G}" stroke-width="2.5"/>`;
    s += axes(g) + `<text class="tx2" x="${g.l}" y="18" font-size="13.5" font-weight="700">Riemann: upper Darboux strips (sup on each cell)</text>`;
  } else {
    for (let i = 0; i < nd; i++) { const y = Math.min(F.f(F.a + i * h), ymax); s += `<rect x="${g.px(F.a + i * h) + 0.5}" y="${g.py(y)}" width="${g.px(F.a + h) - g.px(F.a) - 1}" height="${g.py(0) - g.py(y)}" fill="${COL.B}" fill-opacity=".35" stroke="${COL.B}" stroke-width=".8"/>`; }
    s += curve(g, ymax) + axes(g) + `<text class="tx2" x="${g.l}" y="18" font-size="13.5" font-weight="700">Riemann: ${nd} vertical strips, left tags</text>`;
  }
  svg.innerHTML = s;
}
function drawL(svg, n) {
  const ymax = ymaxOf(n), g = frame(svg, ymax); let s = g.s;
  if (F.patho) {
    s += F.patho === "thomae" ? popcorn(g, true) : `<line x1="${g.l}" x2="${g.W - g.r}" y1="${g.py(1)}" y2="${g.py(1)}" stroke="${COL.R}" stroke-width="2" stroke-dasharray="2 4"/>`;
    s += `<line x1="${g.l}" x2="${g.W - g.r}" y1="${g.py(0)}" y2="${g.py(0)}" stroke="${COL.G}" stroke-width="4"/>`;
    s += `<text class="tx" x="${g.W - g.r - 4}" y="${g.py(0) - 10}" font-size="12" text-anchor="end" fill="${COL.G}">irrationals: f = 0 on a set of measure 1</text>`;
    s += `<text class="tx" x="${g.W - g.r - 4}" y="${g.py(0.55)}" font-size="12" text-anchor="end">{ f &gt; 0 } = rationals: countable, measure 0</text>`;
    s += axes(g) + `<text class="tx2" x="${g.l}" y="18" font-size="13.5" font-weight="700">Lebesgue: the preimages of the values</text>`;
  } else {
    const nl = Math.min(n, 50), lo = F.lo, top = F.hi == null ? lo + Math.sqrt(nl) : F.hi, dl = (top - lo) / nl, S = 300, dx = (F.b - F.a) / S;
    for (let i = 0; i < S; i++) {
      const x = F.a + (i + 0.5) * dx, y = F.f(x); let k = Math.floor((y - lo) / dl); if (!(k >= 0)) k = y > lo ? nl - 1 : 0; if (k >= nl) k = nl - 1;
      const col = `hsl(${(k * 47) % 360} 70% 62%)`, ph = lo + k * dl, x0 = g.px(x - dx / 2);
      s += `<rect x="${x0}" y="${g.py(ph)}" width="${g.px(x + dx / 2) - x0 + 0.4}" height="${g.py(0) - g.py(ph)}" fill="${col}" fill-opacity=".5"/><rect x="${x0}" y="${g.H - g.b + 1}" width="${g.px(x + dx / 2) - x0 + 0.4}" height="5" fill="${col}"/>`;
    }
    if (nl <= 40) for (let k = 0; k <= nl; k++) s += `<line x1="${g.l}" x2="${g.W - g.r}" y1="${g.py(lo + k * dl)}" y2="${g.py(lo + k * dl)}" stroke="${COL.W}" stroke-opacity=".3" stroke-dasharray="3 3"/>`;
    s += curve(g, ymax) + axes(g) + `<text class="tx2" x="${g.l}" y="18" font-size="13.5" font-weight="700">Lebesgue: ${nl} horizontal bands (lower level)</text>`;
  }
  svg.innerHTML = s;
}

/* ---------------- tables ---------------- */
function resultsTable(n) {
  let h = `<tr><th>Method (n = ${fmtN(n)})</th><th>Slices</th><th>Value</th><th>Exact</th><th>Absolute error</th><th>Evaluations</th></tr>`;
  const row = (name, grp, r) => { const e = Math.abs(r.v - F.exact); h += `<tr><td>${name}</td><td class="m">${grp}</td><td class="n">${fv(r.v)}</td><td class="th">${F.exactTxt.length < 14 ? F.exactTxt : fv(F.exact)}</td><td class="n">${fe(e)}</td><td class="n">${fmtN(r.ev)}</td></tr>`; };
  METHODS.forEach(m => row(m.name + (F.patho && m.key === "Rleft" ? " (rational tags)" : ""), m.grp === "R" ? "domain" : "range", m.run(F, n)));
  if (!F.patho) row("Lebesgue, sampled preimages (mid-level, M = " + fmtN(Math.min(100 * n, 2e6)) + " points)", "range", lebesgueSampled(F, n, Math.min(100 * n, 2e6)));
  $("resTab").innerHTML = h;
}
function allTable(n) {
  $("nAll").textContent = fmtN(n);
  const keys = ["Rleft", "Rmid", "Llow", "Lmid"];
  let h = `<tr><th>Function</th><th>Exact</th>` + keys.map(k => `<th>${byKey(k).name}</th>`).join("") + `</tr>`, best = { R: 0, L: 0, tie: 0 }, cnt = 0;
  FUNCS.forEach(f => {
    const nn = capN(n, f); h += `<tr><td>${f.name}</td><td class="th">${f.exactTxt.length < 14 ? f.exactTxt : fv(f.exact)}</td>`;
    const es = {};
    keys.forEach(k => { const v = byKey(k).run(f, nn).v, e = Math.abs(v - f.exact); es[k] = e; h += `<td class="n">${fv(v)}<br><span class="sub">err ${fe(e)}</span></td>`; });
    h += `</tr>`;
    if (!f.patho && f.hi != null) { cnt++; if (es.Rmid < es.Lmid * 0.999) best.R++; else if (es.Lmid < es.Rmid * 0.999) best.L++; else best.tie++; }
  });
  $("allTab").innerHTML = h;
  $("allFinds").innerHTML = `<b>Reading the table</b><ul class="plain"><li>On the ${cnt} bounded, proper functions of the list the midpoint Riemann sum beats the mid-level Lebesgue sum in ${best.R} cases, the reverse happens in ${best.L}, and they tie (both exact up to rounding) in ${best.tie}. Where f is smooth the Riemann midpoint sum is the better of the two; the Lebesgue sum catches up when f is a step function.</li><li>For all the functions that are Riemann integrable (every row except Dirichlet, and 1/&radic;x in the proper sense) the Riemann and Lebesgue columns approach the <i>same</i> number: the exact value.</li><li>The Dirichlet row shows the difference: the Riemann columns give 1 (rational tags) while the Lebesgue sums give 0. For 1/&radic;x the left-tag Riemann sum is infinite while the Lebesgue sums are finite and converge to 2.</li></ul>`;
}
function convChart() {
  const max = F.patho ? 11 : 16, ns = Array.from({ length: max }, (_, i) => 2 ** (i + 1)), keys = METHODS.map(m => m.key);
  CONV = { ns, err: convergence(F, ns, keys) };
  const show = [["Rleft", COL.R, "Riemann, left tags"], ["Rmid", COL.B, "Riemann, midpoint tags"], ["Llow", COL.P, "Lebesgue, lower sum"], ["Lmid", COL.G, "Lebesgue, mid-level sum"]];
  const ser = show.map(([k, c, nm]) => ({ name: nm, color: c, marker: true, pts: ns.map((n, i) => { const e = CONV.err[k][i]; return Number.isFinite(e) && e > 0 ? [n, e] : null; }) }));
  const all = ser.flatMap(s => s.pts.filter(Boolean).map(p => p[1]));
  let emin = all.length ? Math.min(...all) : 1e-3, emax = all.length ? Math.max(...all) : 1;
  let ymin = Math.pow(10, Math.floor(Math.log10(emin))), ymax = Math.pow(10, Math.ceil(Math.log10(emax))); if (ymax <= ymin) ymax = ymin * 10;
  const e0 = all.length ? Math.max(...all) : 1, ref = p => ns.map(n => [n, e0 * Math.pow(n / ns[0], -p)]);
  ser.push({ name: "slope −1", color: COL.W, dash: "4 4", opacity: .55, width: 1.3, pts: ref(1) }, { name: "slope −2", color: COL.Y, dash: "4 4", opacity: .55, width: 1.3, pts: ref(2) });
  chart($("svgConv"), { series: ser, xlog: true, ylog: true, xmin: ns[0], xmax: ns[ns.length - 1], ymin, ymax, xlabel: "n (cells / bands)", ylabel: "absolute error", perRow: 2, H: 330 });
  const expect = { Rleft: "1 (smooth), jumps: 1", Rmid: "2 (smooth)", Rlow: "1", Rup: "1", Llow: "1", Lmid: "between 1 and 2", Lup: "1" };
  let h = `<tr><th>Method</th><th>Observed order p</th><th>Error at n = ${fmtN(ns[ns.length - 1])}</th></tr>`;
  METHODS.forEach(m => { const e = CONV.err[m.key], p = order(ns, e), last = e[e.length - 1]; h += `<tr><td>${m.name}</td><td class="n">${Number.isFinite(p) ? p.toFixed(2) : (last === 0 ? "exact" : "—")}</td><td class="n">${fe(last)}</td></tr>`; });
  $("ordTab").innerHTML = h;
  $("ordNote").innerHTML = F.type === "smooth" ? "Smooth f: the midpoint rule has order 2, the left rule and every Darboux sum order 1. The Lebesgue lower / upper sums have order 1 (the band width &delta;). The mid-level sum is better, with order about 1.5: the error cancels inside each band except near the extremum of f, where the preimages are wide (G has a square-root singularity)." : F.type === "step" ? "Step function: sums are exact when the jump falls on a cell border (n even); the Lebesgue sum is exact with mid-level values, since the two values are reproduced; lower / upper sums and Darboux sums keep the order-1 error from the band or the jump cell." : F.type === "improper" ? "Unbounded f: no method reaches order 1; the singular first cell limits the Riemann sums to order 1/2, and the Lebesgue sums by the truncation level." : "Pathological function: see Section 6. Zero errors are exact and not drawn.";
}
function effTable() {
  const nT = Math.max(10, Math.min(Math.round(+$("nT").value) || 1e5, F.patho ? 3000 : 1e6));
  let h = `<tr><th>Method (n = ${fmtN(nT)})</th><th>Evaluations</th><th>Time (ms)</th><th>Error</th></tr>`;
  const rows = METHODS.map(m => [m.name, () => m.run(F, nT)]);
  if (!F.patho) rows.push(["Lebesgue, sampled preimages (M = 100 n, max 2·10⁶)", () => lebesgueSampled(F, nT, Math.min(100 * nT, 2e6))]);
  rows.forEach(([nm, fn]) => { const r = fn(), t = timeIt(fn, 3); h += `<tr><td>${nm}</td><td class="n">${fmtN(r.ev)}</td><td class="n">${t < 0.01 ? "<0.01" : t.toFixed(2)}</td><td class="n">${fe(Math.abs(r.v - F.exact))}</td></tr>`; });
  $("effTab").innerHTML = h;
  const tol = +$("tol").value || 1e-6;
  let t2 = `<tr><th>Method</th><th>Cells needed for error ≤ ${tol.toExponential(0)}</th><th>Evaluations</th><th>Time at that n (ms)</th></tr>`;
  METHODS.forEach(m => {
    const e = CONV.err[m.key], i = e.findIndex(x => Number.isFinite(x) && x <= tol);
    if (i < 0) { t2 += `<tr><td>${m.name}</td><td class="n">&gt; ${fmtN(CONV.ns[CONV.ns.length - 1])}</td><td class="n">—</td><td class="n">—</td></tr>`; return; }
    const n = CONV.ns[i], r = m.run(F, n), t = timeIt(() => m.run(F, n), 3);
    t2 += `<tr><td>${m.name}</td><td class="n">${fmtN(n)}</td><td class="n">${fmtN(r.ev)}</td><td class="n">${t < 0.01 ? "<0.01" : t.toFixed(3)}</td></tr>`;
  });
  $("tolTab").innerHTML = t2;
}
function runEff() { if (!CONV) convChart(); effTable(); }
function pathoTable() {
  const ns = [10, 100, 1000, 2000];
  let h = `<tr><th>Function</th><th>n</th><th>Darboux lower</th><th>Darboux upper</th><th>Riemann, rational tags</th><th>Riemann, irrational tags</th><th>Lebesgue lower</th><th>Lebesgue mid-level</th></tr>`;
  ["dir", "thomae"].forEach(id => { const f = FUNCS.find(x => x.id === id); ns.forEach(n => {
    h += `<tr><td>${f.name}</td><td class="m">${n}</td><td class="n">${fv(darboux(f, n, "lower").v)}</td><td class="n">${fv(darboux(f, n, "upper").v)}</td><td class="n">${fv(riemannSum(f, n, "left").v)}</td><td class="n">${fv(riemannSum(f, n, "irr").v)}</td><td class="n">${fv(lebesgueSum(f, n, "lower").v)}</td><td class="n">${fv(lebesgueSum(f, n, "mid").v)}</td></tr>`; }); });
  $("pathoTab").innerHTML = h;
  const f = FUNCS.find(x => x.id === "invsqrt"), ni = [10, 100, 1000, 10000, 100000];
  let t = `<tr><th>n</th><th>Riemann, left tags</th><th>Riemann, midpoint</th><th>Darboux lower</th><th>Darboux upper</th><th>Lebesgue lower</th><th>Lebesgue mid-level</th><th>Sampled preimages</th></tr>`;
  ni.forEach(n => { const g = (k) => byKey(k).run(f, n).v; t += `<tr><td class="m">${fmtN(n)}</td><td class="n">${fv(g("Rleft"))}</td><td class="n">${fv(g("Rmid"))}</td><td class="n">${fv(g("Rlow"))}</td><td class="n">${fv(g("Rup"))}</td><td class="n">${fv(g("Llow"))}</td><td class="n">${fv(g("Lmid"))}</td><td class="n">${fv(lebesgueSampled(f, n, Math.min(100 * n, 2e6)).v)}</td></tr>`; });
  $("invTab").innerHTML = t + `<tr><td>exact</td><td class="th" colspan="7">2</td></tr>`;
}
function concl() {
  const sq = FUNCS.find(f => f.id === "sq"), ns = Array.from({ length: 16 }, (_, i) => 2 ** (i + 1)), p = {};
  ["Rleft", "Rmid", "Llow", "Lmid"].forEach(k => p[k] = order(ns, ns.map(n => errAt(sq, k, n))).toFixed(2));
  $("conclText").innerHTML = `
  <h3>Do the two approaches converge to the same value?</h3>
  <ul class="plain">
    <li><b>Yes, whenever the function is Riemann integrable.</b> For sin x, x&sup2;, the two step functions, |x&minus;0.5|, sin x / x and Thomae&rsquo;s function the Riemann sums (any tags), the Darboux sums and the Lebesgue sums all tend to the same exact value (2, 1/3, 2, 1/4, 1/2, Si(&pi;) = 1.85194&hellip;, 0). This is the theorem &ldquo;Riemann integrable &rArr; Lebesgue integrable, with the same integral&rdquo;.</li>
    <li><b>No, for the Dirichlet function.</b> The Riemann sums can be 0 or 1 depending on the tags, the lower and upper Darboux sums converge to different limits (0 and 1): the Riemann integral does not exist. The Lebesgue integral exists and is 0, because the rationals form a set of measure 0.</li>
    <li><b>1/&radic;x</b> is not Riemann integrable in the proper sense (unbounded): the Riemann route needs an improper-integral limit, and its sums converge slowly (order 1/2). The Lebesgue sum handles it as it is and gives 2.</li>
  </ul>
  <h3>Accuracy and convergence</h3>
  <ul class="plain">
    <li>For smooth f (x&sup2; in the last run) the observed orders are: Riemann left ${p.Rleft}, Riemann midpoint ${p.Rmid}, Lebesgue lower ${p.Llow}, Lebesgue mid-level ${p.Lmid}. The midpoint rule (error &asymp; h&sup2;) is the most accurate per cell; Lebesgue lower and upper sums behave like the one-sided Riemann sums (error &asymp; band width), and the mid-level Lebesgue sum improves to about h<sup>1.5</sup>.</li>
    <li>For functions with jumps, the Lebesgue sums do not suffer from the discontinuity: the jump only changes which band a point belongs to; a Riemann sum loses one order of accuracy in the cell that contains the jump (unless the jump lies on a cell border). With only two values the Lebesgue mid-level sum is exact.</li>
    <li>Riemann sums (and Darboux sums) are robust and need only evaluations of f. Their weak point is oscillating or discontinuous functions on a dense set.</li>
  </ul>
  <h3>Computational efficiency</h3>
  <ul class="plain">
    <li>Per slice both approaches cost O(1): a Riemann cell needs one evaluation of f; a Lebesgue band needs one evaluation of the distribution function G. The difference is what is needed in advance: Riemann only needs f, Lebesgue needs the <i>measure of the preimages</i>, i.e. the inverse of f. When it is known in closed form (x&sup2;, sin, |x&minus;0.5|, steps) the Lebesgue sum is cheap, but for a general f one needs a root search per level (sin x / x: about 55 sine evaluations per band: see the timings) or sampling.</li>
    <li>The sampled-preimage Lebesgue sum works for any f but needs M &gt;&gt; N evaluations to estimate the measures; its error is the sum of the band width and the sampling error of the histogram, so it is clearly less efficient than a midpoint Riemann sum with the same number of evaluations. Higher-dimensional integrals show the same pattern, which is why Monte Carlo methods are (statistically) Lebesgue-style.</li>
    <li>In practice: Riemann (midpoint or better, such as Simpson) for smooth integrands; the Lebesgue viewpoint for theory, for functions defined through their level sets (probability: E[X] = &int; x dF(x)), and for pathological or unbounded functions.</li>
  </ul>`;
}
function renderAll() {
  const n = nVal(); $("nIn").value = n;
  $("fdesc").innerHTML = `<b>${F.html}</b><br>Exact integral: <b>${F.exactTxt}</b>. ${F.note}`;
  drawR($("svgR"), n); drawL($("svgL"), n); resultsTable(n); allTable(n); convChart(); effTable();
}
initSel(); renderAll(); pathoTable(); concl();
