"use strict";
const XT = [-6, -3, -1, 0, 0.5, 1, 1.96, 2, 3, 5, 8];
const REFC = new Map();
const ref = x => { if (!REFC.has(x)) REFC.set(x, bigRef(x)); return REFC.get(x); };
const GRID = Array.from({ length: 161 }, (_, i) => Math.round((-8 + i * 0.1) * 10) / 10);
const timeBest = (fn, reps = 3) => { let b = Infinity; for (let r = 0; r < reps; r++) { const t = performance.now(); fn(); b = Math.min(b, performance.now() - t); } return b; };
const fe = e => e === 0 ? "0" : e.toExponential(1);
const col = e => e < 1e-12 ? "var(--ok)" : e < 1e-6 ? COL.Y : "var(--warn)";
const nQ = () => Math.max(2, Math.min(200000, Math.round(+$("nQ").value) || 1000));
const dispRef = v => v < 1e-3 ? v.toExponential(12) : (+v.toPrecision(15)).toString();
function copyCode(id, btn) {
  const t = $(id).innerText.replace(/^Copy\n?/, "");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy", 1400); };
  try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); }
}
let ACC = null;
function accData(n) {
  const R = GRID.map(x => ref(x).v), out = {};
  NMETHODS.forEach(m => { out[m.key] = GRID.map((x, i) => { const v = m.run(x, n).v; return Math.abs(v - R[i]) / R[i]; }); });
  return out;
}
function renderAcc() {
  const n = nQ(), xc = Math.max(-12, Math.min(12, +$("xc").value || 0));
  let h = `<tr><th>x</th><th>&Phi;(x) reference</th>` + NMETHODS.map(m => `<th>${m.name}${m.key === "trap" || m.key === "simp" ? " (n = " + fmtN(n) + ")" : ""}</th>`).join("") + `</tr>`;
  [...XT, xc].forEach((x, j) => {
    const r = ref(x);
    h += `<tr><td class="m">${x}${j === XT.length ? " (yours)" : ""}</td><td class="th">${dispRef(r.v)}</td>` + NMETHODS.map(m => { const e = Math.abs(m.run(x, n).v - r.v) / r.v; return `<td class="n" style="color:${col(e)}">${Number.isFinite(e) ? fe(e) : "n/a"}</td>`; }).join("") + `</tr>`;
  });
  $("ptTab").innerHTML = h;
  ACC = accData(n);
  const cl = [["trap", COL.B, "Trapezoid"], ["simp", COL.G, "Simpson"], ["erfs", COL.red, "erf series (alternating)"], ["pos", COL.P, "positive series"], ["cf", COL.Y, "continued fraction"], ["as", COL.R, "A&S 7.1.26"], ["hyb", COL.W, "hybrid"]];
  const ser = cl.map(([k, c, nm]) => ({ name: nm, color: c, width: k === "hyb" ? 2.8 : 1.8, pts: GRID.map((x, i) => [x, Math.max(ACC[k][i], 1e-17)]) }));
  chart($("svgAcc"), { series: ser, ylog: true, xmin: -8, xmax: 8, ymin: 1e-17, ymax: 1e2, xlabel: "x", ylabel: "relative error", perRow: 3, H: 360, W: 760 });
  const mx = (k, lim) => Math.max(...GRID.map((x, i) => Math.abs(x) <= lim ? ACC[k][i] : 0));
  $("accFinds").innerHTML = `<b>What the data show</b><ul class="plain"><li><b>Hybrid:</b> maximum relative error ${fe(mx("hyb", 8))} on [&minus;8, 8] &ndash; full double precision, also deep in the tails (&Phi;(&minus;8) &asymp; 6.2&middot;10<sup>&minus;16</sup> is obtained with 15 correct digits).</li><li><b>Alternating erf series:</b> accurate for |x| &lt; 2, loses digits from |x| &asymp; 3 and is useless in the tails (the rounding errors explode (relative error ${fe(mx("erfs", 8))} on [&minus;8, 8]) because the terms reach e<sup>x&sup2;/2</sup> &gt;&gt; 1 before decaying).</li><li><b>Positive series:</b> excellent for x &ge; 0, but for negative x the result 1/2 &minus; (&hellip;) cancels: the relative error grows to ${fe(mx("pos", 8))} in the lower tail (absolute error stays ~10<sup>&minus;16</sup>).</li><li><b>A&amp;S 7.1.26:</b> absolute error below 1.5&middot;10<sup>&minus;7</sup> as promised (maximum absolute error here: ${fe(Math.max(...GRID.map(x => Math.abs(cdfAS(x).v - ref(x).v))))}), but relative error in the tails of several percent.</li><li><b>Quadrature (n = ${fmtN(n)}):</b> the integral from 0 to |x| has small absolute error, but &Phi;(&minus;|x|) = 1/2 &minus; I loses relative accuracy in the lower tail as well. Simpson is much better than the trapezoid for the same n.</li></ul>`;
  nist();
}
function nist() {
  const rows = [[0.5, 0.19146, 0.69146, "NIST (area 0→z) + Wikipedia"], [1.0, 0.34134, 0.84134, "NIST + Wikipedia"], [1.5, 0.43319, 0.93319, "NIST + Wikipedia"], [2.0, 0.47725, 0.97725, "NIST + Wikipedia"], [2.5, 0.49379, 0.99379, "NIST + Wikipedia"], [3.0, 0.49865, 0.99865, "NIST + Wikipedia"], [1.96, null, 0.97500, "Wikipedia (row 1.9, column .06)"], [3.5, null, 0.99977, "Wikipedia"], [-1, null, 0.15866, "Wikipedia"]];
  let h = `<tr><th>z</th><th>Published value</th><th>Source</th><th>Hybrid method (5 decimals)</th><th>Reference (12 digits)</th><th>Match</th></tr>`;
  rows.forEach(([z, area, phi, src]) => {
    const v = cdfHybrid(z).v, pub = area != null ? area : phi, mine = area != null ? v - 0.5 : v, ok = Math.abs(+mine.toFixed(5) - pub) < 1e-9;
    h += `<tr><td class="m">${z}</td><td class="th">${pub.toFixed(5)} ${area != null ? "(area 0→z)" : "(Φ)"}</td><td>${src}</td><td class="n">${mine.toFixed(5)}</td><td class="th">${(+ref(z).v.toPrecision(12)).toString()}</td><td class="n" style="color:${ok ? "var(--ok)" : "var(--warn)"}">${ok ? "✓" : "✗"}</td></tr>`;
  });
  $("nistTab").innerHTML = h;
}
function renderConv() {
  const x = Math.max(-12, Math.min(12, +$("xq").value || 2)), r = ref(x).v, ns = Array.from({ length: 13 }, (_, i) => 2 ** (i + 1));
  const e = k => ns.map(n => Math.abs(NMETHODS.find(m => m.key === k).run(x, n).v - r));
  const et = e("trap"), es = e("simp"), floor = 1e-17;
  const pt = (arr) => ns.map((n, i) => [n, Math.max(arr[i], floor)]);
  const a0 = Math.max(et[0], 1e-6), ref2 = ns.map(n => [n, a0 * (n / ns[0]) ** -2]), ref4 = ns.map(n => [n, Math.max(es[0], 1e-6) * (n / ns[0]) ** -4]);
  chart($("svgConv"), { series: [{ name: "Trapezoid", color: COL.B, marker: true, pts: pt(et) }, { name: "Simpson", color: COL.G, marker: true, pts: pt(es) }, { name: "slope −2", color: COL.W, dash: "4 4", opacity: .55, width: 1.3, pts: ref2 }, { name: "slope −4", color: COL.Y, dash: "4 4", opacity: .55, width: 1.3, pts: ref4 }], xlog: true, ylog: true, xmin: 2, xmax: 8192, ymin: 1e-17, ymax: 1, xlabel: "n (sub-intervals)", ylabel: "absolute error", perRow: 2, H: 330 });
  let h = `<tr><th>Rule</th><th>Observed order</th><th>Error at n = 8192</th></tr>`;
  [["Trapezoid", et], ["Simpson", es]].forEach(([nm, arr]) => {
    const pts = []; ns.forEach((n, i) => { if (arr[i] > 1e-13) pts.push([Math.log(n), Math.log(arr[i])]); }); const q = pts.slice(-5);
    let p = NaN; if (q.length >= 3) { const mx = q.reduce((s, a) => s + a[0], 0) / q.length, my = q.reduce((s, a) => s + a[1], 0) / q.length; let nu = 0, de = 0; q.forEach(a => { nu += (a[0] - mx) * (a[1] - my); de += (a[0] - mx) ** 2; }); p = -nu / de; }
    h += `<tr><td>${nm}</td><td class="n">${Number.isFinite(p) ? p.toFixed(2) : "floor reached"}</td><td class="n">${fe(arr[arr.length - 1])}</td></tr>`;
  });
  $("ordTab").innerHTML = h;
}
function renderEff() {
  const n = nQ(), xs = Array.from({ length: 20000 }, (_, i) => -6 + 12 * (i + 0.5) / 20000);
  let h = `<tr><th>Method</th><th>Time for 20,000 evaluations (ms)</th><th>µs per evaluation</th><th>Mean terms / iterations / points</th><th>Max relative error on [−6, 6]</th></tr>`;
  NMETHODS.forEach(m => {
    let s = 0, ev = 0; const t = timeBest(() => { s = 0; for (const x of xs) s += m.run(x, n).v; });
    xs.forEach((x, i) => { if (i % 50 === 0) ev += m.run(x, n).ev; }); ev /= 400;
    const mxe = Math.max(...GRID.map((x, i) => Math.abs(x) <= 6 ? ACC[m.key][i] : 0));
    h += `<tr><td>${m.name}${m.key === "trap" || m.key === "simp" ? " (n = " + fmtN(n) + ")" : ""}</td><td class="n">${t.toFixed(1)}</td><td class="n">${(t * 1000 / xs.length).toFixed(2)}</td><td class="n">${ev < 10 ? ev.toFixed(1) : Math.round(ev)}</td><td class="n" style="color:${col(mxe)}">${fe(mxe)}</td></tr>`;
  });
  $("effTab").innerHTML = h;
  let t = `<tr><th>x</th><th>positive series (terms)</th><th>erf alternating series (terms)</th><th>continued fraction (iterations)</th><th>hybrid</th></tr>`;
  [0.5, 1, 2, 3, 5, 8].forEach(x => { t += `<tr><td class="m">${x}</td><td class="n">${cdfPosSeries(x).ev}</td><td class="n">${cdfErfSeries(x).ev}</td><td class="n">${tailCF(x).ev}</td><td class="n">${cdfHybrid(x).ev}</td></tr>`; });
  $("itTab").innerHTML = t;
}
function concl() {
  $("conclText").innerHTML = `
  <h3>Why there is no elementary formula, and what replaces it</h3>
  <ul class="plain">
    <li>By Liouville&rsquo;s theorem &int; f e<sup>g</sup> is elementary only if f = h&prime; + g&prime;h for a rational h; for e<sup>&minus;t&sup2;/2</sup> the equation h&prime; &minus; t h = 1 has no rational solution (a pole argument rules out denominators, a degree argument rules out polynomials). Hence &Phi; is not elementary.</li>
    <li>The special function erf gives the exact representation &Phi;(x) = &frac12;[1 + erf(x/&radic;2)] and an everywhere-convergent series, but it is only a <i>name</i> for the integral: numbers still have to be produced by finite algorithms.</li>
  </ul>
  <h3>What the experiments show</h3>
  <ul class="plain">
    <li><b>Numerical integration</b> is the most general approach (it works for any density) but the least efficient: the trapezoid rule has order 2 and Simpson order 4, so Simpson reaches 10<sup>&minus;12</sup> with a few hundred points where the trapezoid needs millions; each evaluation of &Phi; costs n evaluations of &phi;.</li>
    <li><b>Series</b> are very cheap (tens of terms). The alternating erf series is unusable beyond |x| &asymp; 3 because of cancellation; the positive-term series is stable but loses relative accuracy in the lower tail.</li>
    <li><b>Continued fraction</b> is the right tool in the tails (relative accuracy preserved) but slow near 0.</li>
    <li><b>erf approximations</b> such as A&amp;S 7.1.26 cost one exponential and a polynomial (the fastest method here) with error 1.5&middot;10<sup>&minus;7</sup>: enough for tables and plots, not for double precision.</li>
    <li><b>The hybrid method</b> combines the stable series near 0 with the continued fraction in the tails: typically 20&ndash;40 terms or iterations per call (at most about 180), relative error of the order of 10<sup>&minus;15</sup> on the whole range, comparable to what library implementations of erf achieve with minimax rational approximations. All values agree with the 80-digit reference and with the published NIST / Wikipedia tables.</li>
  </ul>
  <p class="note">Sources: Hogg, McKean, Craig, <i>Introduction to Mathematical Statistics</i>, &sect;3.4 (as linked in the assignment); NIST/SEMATECH e-Handbook of Statistical Methods, &sect;1.3.6.7.1, <a href="https://itl.nist.gov/div898/handbook/eda/section3/eda3671.htm" target="_blank" rel="noopener">itl.nist.gov</a>; <a href="https://en.wikipedia.org/wiki/Standard_normal_table" target="_blank" rel="noopener">Wikipedia, Standard normal table</a>; arbitrary-precision check with Python <code>mpmath</code>.</p>`;
}
renderAcc(); renderConv(); renderEff(); concl();
