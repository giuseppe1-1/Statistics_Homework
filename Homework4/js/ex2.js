"use strict";
let D = null, SIM = null, AN = null, running = false;
const f4 = x => Number.isFinite(x) ? (+x.toPrecision(4)).toString() : "—";

function distChanged() {
  const k = $("dist").value;
  $("qBox").classList.toggle("hidden", k !== "binomial");
  $("wBox").classList.toggle("hidden", k !== "custom");
  buildDist(); drawDist();
}
function buildDist() {
  const k = $("dist").value;
  if (k === "custom") {
    let w = $("w").value.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (w.length !== 11 || w.some(v => !(v >= 0)) || !w.some(v => v > 0)) { $("distInfo").innerHTML = "<b>Enter 11 non-negative weights (scores 0 to 10), at least one positive.</b>"; return D = null; }
    D = makeDist("custom", { weights: w });
  } else {
    const q = Math.min(0.99, Math.max(0.01, +$("q").value || 0.3));
    D = makeDist(k, { q });
  }
  $("distInfo").innerHTML = `<b>${D.name}</b> &nbsp; &mu; = <b>${f4(D.mu)}</b>, &sigma;&sup2; = <b>${f4(D.variance)}</b>, &sigma; = ${f4(Math.sqrt(D.variance))}, &mu;<sub>4</sub> = ${f4(D.mu4)}`;
  return D;
}
function drawDist() {
  if (!D) return;
  let bars;
  if (D.kind === "continuous") bars = Array.from({ length: 20 }, (_, i) => ({ x0: i * .5, x1: (i + 1) * .5, d: (D.cdf((i + 1) * .5) - D.cdf(i * .5)) / .5 }));
  else bars = D.pmf.map((p, i) => ({ x0: i - .4, x1: i + .4, d: p }));
  histChart($("svgDist"), { bars, model: "B", title: D.kind === "continuous" ? "Density" : "Probability", sub: "μ = " + f4(D.mu), vline: { x: D.mu }, xlabel: "score" });
}
function parseNs() {
  const a = [...new Set($("ns").value.split(/[\s,;]+/).filter(Boolean).map(Number).filter(v => Number.isInteger(v) && v >= 2 && v <= 20000))].sort((x, y) => x - y);
  return a.slice(0, 12);
}
async function run() {
  if (running) return;
  if (!buildDist()) return;
  const ns = parseNs(), m = Math.min(50000, Math.max(50, Math.round(+$("m").value) || 3000));
  if (!ns.length) { alert("Enter at least one integer n ≥ 2."); return; }
  running = true; $("run").disabled = true;
  const t0 = performance.now();
  SIM = makeSim(D, m, ns, (+$("seed").value) >>> 0, 6);
  const nmax = ns[ns.length - 1], chunk = Math.max(20, Math.floor(4e6 / nmax));
  for (let j = 0; j < m; j += chunk) {
    simulateHackers(SIM, j, Math.min(m, j + chunk));
    $("bar").style.width = (100 * Math.min(m, j + chunk) / m) + "%";
    await tick();
  }
  AN = analyseSim(SIM);
  const dt = ((performance.now() - t0) / 1000).toFixed(2);
  $("runInfo").innerHTML = `<b>${fmtN(m)}</b> hackers × up to <b>${fmtN(nmax)}</b> attempts = ${fmtN(m * nmax)} scores, each processed by the three Welford lines. Done in ${dt} s.<br>n compared: ${ns.join(", ")}.<br>Seed ${$("seed").value} (same seed = same results).`;
  $("nsel").innerHTML = ns.map(n => `<option value="${n}">${n}</option>`).join("");
  $("nsel").value = ns.includes(10) ? 10 : ns[Math.floor(ns.length / 2)];
  render();
  running = false; $("run").disabled = false;
}
function render() {
  drawPaths(); drawAvg(); drawHists(); drawVar(); drawConcl();
}
function drawPaths() {
  const nmax = SIM.nmax, mu = D.mu, s2 = D.variance, np = SIM.pathM.length;
  const cols = [COL.B, COL.R, COL.G, COL.P, COL.Y, COL.W];
  const kmax = Math.min(nmax, 200);
  const step = k => k;
  const sm = [], sv = [];
  for (let j = 0; j < np; j++) {
    sm.push({ color: cols[j], width: 1.6, opacity: .9, pts: Array.from({ length: kmax }, (_, i) => [i + 1, SIM.pathM[j][i + 1]]) });
    sv.push({ color: cols[j], width: 1.6, opacity: .9, pts: Array.from({ length: kmax - 1 }, (_, i) => [i + 2, SIM.pathS[j][i + 2] / (i + 1)]) });
  }
  let lo = mu, hi = mu; sm.forEach(s => s.pts.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }));
  const sd = Math.sqrt(s2);
  const band = [[1, mu + 2 * sd], ...Array.from({ length: kmax - 1 }, (_, i) => [i + 2, mu + 2 * sd / Math.sqrt(i + 2)])];
  const bandL = band.map(p => [p[0], 2 * mu - p[1]]);
  const ymax = Math.min(10, Math.max(hi, mu + sd) + .3), ymin = Math.max(0, Math.min(lo, mu - sd) - .3);
  chart($("svgPM"), { series: [...sm, { color: COL.red, dash: "5 4", width: 1.4, pts: band.slice(1) }, { color: COL.red, dash: "5 4", width: 1.4, pts: bandL.slice(1) }], hlines: [{ y: mu, color: COL.Y, dash: "6 4" }], xmin: 1, xmax: kmax, ymin, ymax, xlabel: "number of attempts k", ylabel: "running sample mean M<tspan font-size='10' dy='3'>k</tspan>", legend: false });
  let vmax = s2 * 3.5; 
  chart($("svgPS"), { series: sv, hlines: [{ y: s2, color: COL.Y, dash: "6 4" }], xmin: 2, xmax: kmax, ymin: 0, ymax: vmax, xlabel: "number of attempts k", ylabel: "running sample variance s²", legend: false });
}
function avgRows() {
  return AN.map(a => {
    const zM = (a.avgMean - D.mu) / a.seAvgMean, zV = (a.avgVar - D.variance) / a.seAvgVar, zB = (a.avgVarBiased - a.thBiased) / a.seAvgVarBiased;
    return { a, zM, zV, zB };
  });
}
function drawAvg() {
  const R = avgRows(), mu = D.mu, s2 = D.variance;
  let h = `<tr><th>n</th><th>avg sample mean</th><th>μ</th><th>z</th><th>avg sample variance s²</th><th>σ²</th><th>z</th><th>avg SS/n</th><th>σ²(n−1)/n</th></tr>`;
  R.forEach(({ a, zM, zV }) => {
    const c = z => Math.abs(z) > 3 ? "var(--warn)" : "var(--ok)";
    h += `<tr><td class="m">${a.n}</td><td class="n">${f4(a.avgMean)} ± ${f4(a.seAvgMean)}</td><td class="th">${f4(mu)}</td><td class="n" style="color:${c(zM)}">${zM.toFixed(2)}</td><td class="n">${f4(a.avgVar)} ± ${f4(a.seAvgVar)}</td><td class="th">${f4(s2)}</td><td class="n" style="color:${c(zV)}">${zV.toFixed(2)}</td><td class="n">${f4(a.avgVarBiased)}</td><td class="th">${f4(a.thBiased)}</td></tr>`;
  });
  $("avgTab").innerHTML = h;
  const ns = AN.map(a => a.n), xmin = ns[0], xmax = ns[ns.length - 1] === xmin ? xmin * 2 : ns[ns.length - 1];
  const rel = (f) => AN.map(a => [a.n, f(a)]);
  const pad = Math.max(...AN.map(a => Math.abs(a.avgMean - mu) + 2 * a.seAvgMean), 0.05);
  chart($("svgAvgM"), { xlog: true, xmin, xmax, ymin: mu - 1.3 * pad, ymax: mu + 1.3 * pad, xlabel: "n (log scale)", ylabel: "average of sample means", perRow: 1, series: [{ name: "average of the m sample means", color: COL.B, marker: true, pts: rel(a => a.avgMean) }, { name: "average ± 2 s.e.", color: COL.B, dash: "3 3", width: 1.2, opacity: .7, pts: rel(a => a.avgMean + 2 * a.seAvgMean) }, { color: COL.B, dash: "3 3", width: 1.2, opacity: .7, pts: rel(a => a.avgMean - 2 * a.seAvgMean) }], hlines: [{ y: mu, color: COL.Y, dash: "6 4" }] });
  const padV = Math.max(...AN.map(a => Math.abs(a.avgVar - s2) + 2 * a.seAvgVar), ...AN.map(a => Math.abs(a.avgVarBiased - s2)), 0.05 * s2);
  chart($("svgAvgV"), { xlog: true, xmin, xmax, ymin: Math.max(0, s2 - 1.2 * padV), ymax: s2 + 1.2 * padV, xlabel: "n (log scale)", ylabel: "average variance", perRow: 1, series: [{ name: "average of s² (divide by n−1)", color: COL.B, marker: true, pts: rel(a => a.avgVar) }, { name: "average of SS/n (divide by n)", color: COL.R, marker: true, pts: rel(a => a.avgVarBiased) }, { name: "σ²(n−1)/n", color: COL.R, dash: "3 3", width: 1.2, pts: rel(a => a.thBiased) }], hlines: [{ y: s2, color: COL.Y, dash: "6 4" }] });
  const maxZ = Math.max(...R.map(r => Math.abs(r.zM)), ...R.map(r => Math.abs(r.zV)));
  const nSmall = AN[0];
  $("finds").innerHTML = `<b>What the numbers say</b><ul class="plain"><li>The average of the sample means is within ${maxZ.toFixed(1)} standard errors of &mu; = ${f4(mu)} (and the same for s&sup2; vs &sigma;&sup2; = ${f4(s2)}) for every n: the differences are compatible with pure simulation noise.</li><li>This holds even for n = ${nSmall.n}: the average of s&sup2; is ${f4(nSmall.avgVar)} (&sigma;&sup2; = ${f4(s2)}), while dividing by n gives ${f4(nSmall.avgVarBiased)}, close to &sigma;&sup2;(n&minus;1)/n = ${f4(nSmall.thBiased)}, i.e. biased by the factor (n&minus;1)/n.</li></ul>`;
}
function histOf(v, bins, lo, hi) { const c = new Array(bins).fill(0), w = (hi - lo) / bins; for (const x of v) { let i = Math.floor((x - lo) / w); if (i < 0) i = 0; if (i >= bins) i = bins - 1; c[i]++; } return c.map((n, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, d: n / v.length / w })); }
function drawHists() {
  if (!AN) return;
  const n = +$("nsel").value, a = AN.find(r => r.n === n); if (!a) return;
  const mu = D.mu, sd = Math.sqrt(D.variance / n);
  const lo = Math.max(0, Math.min(mu - 4 * sd, ...[a.avgMean - 4 * a.sdMeans])), hi = Math.min(10, mu + 4 * sd + 1e-9);
  const hm = histOf(a.xb, 30, Math.min(lo, mu - 4 * sd < 0 ? 0 : mu - 4 * sd), Math.max(mu + 4 * sd > 10 ? 10 : mu + 4 * sd, lo + 1e-6));
  histChart($("svgHM"), { bars: hm, model: "B", pdf: x => phi((x - mu) / sd) / sd, vline: { x: mu }, title: "Sample means", sub: `n = ${n}, sd = ${f4(a.sdMeans)}`, xlabel: "x̄ of one hacker" });
  const s2 = D.variance, sv = a.thSdVars, l2 = Math.max(0, s2 - 4 * sv), h2 = Math.max(s2 + 4 * sv, Math.max(...a.s2) * 0.0 + s2 * 1.5);
  histChart($("svgHV"), { bars: histOf(a.s2, 30, l2, h2), model: "R", vline: { x: s2 }, title: "Sample variances", sub: `n = ${n}, sd = ${f4(a.sdVars)}`, xlabel: "s² of one hacker" });
}
function drawVar() {
  const ns = AN.map(a => a.n), xmin = ns[0], xmax = ns[ns.length - 1] === xmin ? xmin * 2 : ns[ns.length - 1];
  const ex = f => AN.map(a => [a.n, f(a)]);
  const lo = v => Math.pow(10, Math.floor(Math.log10(v)));
  const allM = AN.flatMap(a => [a.sdMeans, a.thSdMeans]), allV = AN.flatMap(a => [a.sdVars, a.thSdVars]);
  chart($("svgVarM"), { xlog: true, ylog: true, xmin, xmax, ymin: lo(Math.min(...allM)), ymax: Math.pow(10, Math.ceil(Math.log10(Math.max(...allM)))), xlabel: "n", ylabel: "sd of sample means", perRow: 1, series: [{ name: "simulated sd of x̄ across hackers", color: COL.B, marker: true, pts: ex(a => a.sdMeans) }, { name: "theory σ/√n", color: COL.Y, dash: "6 4", pts: ex(a => a.thSdMeans) }] });
  chart($("svgVarV"), { xlog: true, ylog: true, xmin, xmax, ymin: lo(Math.min(...allV)), ymax: Math.pow(10, Math.ceil(Math.log10(Math.max(...allV)))), xlabel: "n", ylabel: "sd of sample variances", perRow: 1, series: [{ name: "simulated sd of s² across hackers", color: COL.R, marker: true, pts: ex(a => a.sdVars) }, { name: "theory √[(μ₄ − (n−3)/(n−1) σ⁴)/n]", color: COL.Y, dash: "6 4", pts: ex(a => a.thSdVars) }] });
  let h = `<tr><th>n</th><th>sd(x̄) simulated</th><th>σ/√n</th><th>sd(s²) simulated</th><th>theory</th><th>CV of s² = sd/σ²</th></tr>`;
  AN.forEach(a => { h += `<tr><td class="m">${a.n}</td><td class="n">${f4(a.sdMeans)}</td><td class="th">${f4(a.thSdMeans)}</td><td class="n">${f4(a.sdVars)}</td><td class="th">${f4(a.thSdVars)}</td><td class="n">${f4(a.sdVars / D.variance)}</td></tr>`; });
  $("varTab").innerHTML = h;
}
function drawConcl() {
  const a0 = AN[0], a1 = AN[AN.length - 1], ratio = a0.sdMeans / a1.sdMeans, nr = Math.sqrt(a1.n / a0.n);
  $("conclText").innerHTML = `
  <h3>What we observe</h3>
  <ul class="plain">
    <li><b>Averages match the parameters.</b> The mean of the sample means is &asymp; &mu; = ${f4(D.mu)} and the mean of the sample variances (with n&minus;1) is &asymp; &sigma;&sup2; = ${f4(D.variance)}, for every n, even for n = ${a0.n}. Hence x&#772; and s&sup2; are <b>unbiased</b>: E[x&#772;] = &mu; and E[s&sup2;] = &sigma;&sup2;. Dividing SS by n gives instead E[SS/n] = &sigma;&sup2;(n&minus;1)/n, visibly too small for small n.</li>
    <li><b>Individual hackers vary, and n controls how much.</b> Between n = ${a0.n} and n = ${a1.n} the sd of the sample means falls from ${f4(a0.sdMeans)} to ${f4(a1.sdMeans)}, a factor ${ratio.toFixed(1)} against the predicted &radic;(${a1.n}/${a0.n}) = ${nr.toFixed(1)}: Var(x&#772;) = &sigma;&sup2;/n. The sd of the sample variances also shrinks (${f4(a0.sdVars)} &rarr; ${f4(a1.sdVars)}), as ~1/&radic;n for large n.</li>
    <li><b>Consistency.</b> Since both variabilities go to 0 as n grows, x&#772; &rarr; &mu; and s&sup2; &rarr; &sigma;&sup2; (law of large numbers): a single long trajectory already gives accurate estimates. The histograms of x&#772; become bell-shaped around &mu; with variance &sigma;&sup2;/n (CLT); the shape of the s&sup2; histogram is skewed at small n and also tends to normal, more slowly (its sd depends on the fourth moment &mu;<sub>4</sub>).</li>
  </ul>
  <h3>Why it matters in inferential statistics</h3>
  <ul class="plain">
    <li>In practice we have <i>one</i> sample (one hacker) and unknown &mu; and &sigma;&sup2;. The experiment shows that x&#772; and s&sup2; are good, unbiased estimators of them, and the unbiasedness of s&sup2; is exactly why Bessel&rsquo;s correction (n&minus;1) is used.</li>
    <li>The spread of x&#772; across repetitions is the <b>standard error</b> &sigma;/&radic;n, estimated by s/&radic;n; with the CLT it gives confidence intervals x&#772; &plusmn; z&middot;s/&radic;n and tests on the mean. It also tells how many attempts n are needed for a target precision (to halve the error, four times as many).</li>
    <li>Welford&rsquo;s recurrences make all this possible online: mean and variance (hence the standard error) are updated at each new attempt with constant memory and good numerical stability, so the experiment can stop as soon as the precision is sufficient.</li>
  </ul>`;
}
distChanged();
run();
