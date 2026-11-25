"use strict";
const f3 = x => Number.isFinite(x) ? (+x.toPrecision(3)).toString() : (x === Infinity ? "∞" : "—");
const fe = x => x === 0 ? "0" : Number.isFinite(x) ? x.toExponential(2) : "—";
const COLS = [COL.B, COL.R, COL.G, COL.P, COL.Y, COL.W, COL.red, "#b69cff"];
const p10up = v => Math.pow(10, Math.ceil(Math.log10(v))), p10dn = v => Math.pow(10, Math.floor(Math.log10(v)));
let CLT = null;

function initSelects() {
  $("gk").innerHTML = Object.entries(GALLERY).map(([k, g]) => `<option value="${k}">${g.name}</option>`).join("");
  $("lp").innerHTML = Object.entries(POPS).map(([k, g]) => `<option value="${k}">${g.name}</option>`).join(""); $("lp").value = "exp";
  $("cp").innerHTML = Object.entries(CLTPOPS).map(([k, g]) => `<option value="${k}">${g.name}</option>`).join(""); $("cp").value = "exp";
  $("vp").innerHTML = $("cp").innerHTML; $("vp").value = "exp";
}

/* ---------------- 2. gallery ---------------- */
function galSel() { $("gE").value = GALLERY[$("gk").value].eps; runGal(); }
function runGal() {
  const k = $("gk").value, g = GALLERY[k], M = Math.max(200, Math.min(20000, +$("gM").value || 3000)), N = Math.max(50, Math.min(5000, +$("gN").value || 1000)), eps = +$("gE").value || 0.5, seed = (+$("gS").value) >>> 0;
  const r = runGallery(k, M, N, eps, seed);
  $("gDesc").innerHTML = `<b>${g.name}</b><br>${g.form}<br><i>${g.why}</i>`;
  const len = r.paths[0].length, vals = r.paths.flat(), hi = Math.max(1, ...vals) * 1.1, lo = Math.min(0, ...vals);
  chart($("svgGP"), { series: r.paths.map((p, i) => ({ color: COLS[i], width: 1.7, opacity: .9, pts: p.map((v, j) => [j + 1, v]) })), xmin: 1, xmax: len, ymin: lo < 0 ? lo * 1.15 : -0.05 * hi, ymax: hi, xlabel: "n", ylabel: "X_n(ω)", legend: false, H: 320 });
  const ymaxC = p10up(Math.max(1, ...r.msq) * 1.01);
  chart($("svgGC"), { series: [{ name: "P(|X_n| > ε): in probability", color: COL.B, width: 2.4, pts: r.ns.map((n, i) => [n, r.pProb[i]]) }, { name: "P(sup_{k≥n} |X_k| > ε): almost surely", color: COL.R, width: 2.4, pts: r.ns.map((n, i) => [n, r.pSup[i]]) }, { name: "E X_n²: mean square", color: COL.G, width: 2.4, pts: r.ns.map((n, i) => [n, r.msq[i]]) }], xlog: true, ylog: true, xmin: 1, xmax: N, ymin: 1e-4, ymax: ymaxC, xlabel: "n", perRow: 1, H: 320 });
  const iq = r.ns.length - 1, ih = r.ns.findIndex(n => n >= N / 10), tick = b => b ? "<span style='color:var(--ok)'>converges</span>" : "<span style='color:var(--warn)'>does not converge</span>";
  $("gTab").innerHTML = `<tr><th>Mode</th><th>Theory</th><th>Simulation (ε = ${eps}, M = ${fmtN(M)})</th></tr>
   <tr><td>in probability</td><td>${tick(g.truth.prob)}</td><td class="n">P(|X<sub>n</sub>| &gt; ε) = ${f3(r.pProb[ih])} at n = ${r.ns[ih]}, ${f3(r.pProb[iq])} at n = ${N}</td></tr>
   <tr><td>almost surely</td><td>${tick(g.truth.as)}</td><td class="n">P(sup<sub>k≥n</sub> |X<sub>k</sub>| &gt; ε) = ${f3(r.pSup[ih])} at n = ${r.ns[ih]}${g.truth.as ? "" : " (stays ≈ 1 until the truncation at N bites)"}</td></tr>
   <tr><td>mean square</td><td>${tick(g.truth.l2)}</td><td class="n">E X<sub>n</sub>² = ${f3(r.msq[ih])} at n = ${r.ns[ih]}, ${f3(r.msq[iq])} at n = ${N}</td></tr>`;
  gSummary();
}
function gSummary() {
  const ref = { mean: "none: the well-behaved case (LLN)", typewriter: "P ⇏ a.s. and L² ⇏ a.s.", spike: "a.s. ⇏ L² (and P ⇏ L²)", ind1n: "P ⇏ a.s. (Borel–Cantelli II)", ind1n2: "P(X<sub>n</sub> ≠ 0) summable ⇒ a.s. (Borel–Cantelli I)" };
  const ck = b => b ? "<span style='color:var(--ok)'>✓</span>" : "<span style='color:var(--warn)'>✗</span>";
  let h = `<tr><th>Sequence</th><th>in P</th><th>a.s.</th><th>L²</th><th>What it shows</th></tr>`;
  Object.entries(GALLERY).forEach(([k, g]) => { h += `<tr><td>${g.name}</td><td class="n">${ck(g.truth.prob)}</td><td class="n">${ck(g.truth.as)}</td><td class="n">${ck(g.truth.l2)}</td><td>${ref[k]}</td></tr>`; });
  $("gTab").innerHTML += `<tr><th colspan="3" style="padding-top:16px">All five sequences, in theory</th><th></th><th></th></tr>` + h;
}

/* ---------------- 3. LLN ---------------- */
function runLln() {
  const pop = $("lp").value, P = POPS[pop], eps = +$("lE").value || 0.1, M = Math.max(100, Math.min(10000, +$("lM").value || 1500)), N = Math.max(100, Math.min(20000, +$("lN").value || 5000));
  const r = runLLN(pop, M, N, eps, 2327983), fin = Number.isFinite(P.v), mu = P.mu;
  const dev = r.paths.flatMap(p => p.filter((_, i) => r.ns[i] >= 3).map(v => Math.abs(v - mu))).sort((a, b) => a - b), d = Math.max(dev[Math.floor(dev.length * 0.97)] * 1.25, 0.05);
  chart($("svgL1"), { series: r.paths.map((p, i) => ({ color: COLS[i], width: 1.6, opacity: .9, pts: r.ns.map((n, j) => [n, p[j]]) })), hlines: [{ y: mu, color: COL.Y, dash: "6 4" }], xlog: true, xmin: 1, xmax: N, ymin: mu - d, ymax: mu + d, xlabel: "n", ylabel: "running mean", legend: false, H: 320 });
  const cheb = r.ns.map(n => [n, Math.min(1, P.v / (n * eps * eps))]);
  chart($("svgL2"), { series: [{ name: "P(|X̄_n − μ| > ε), simulated", color: COL.B, marker: true, pts: r.ns.map((n, i) => [n, r.pProb[i]]) }, ...(fin ? [{ name: "Chebyshev: σ²/(nε²)", color: COL.R, dash: "6 4", pts: cheb }] : [])], xlog: true, ylog: true, xmin: 1, xmax: N, ymin: 1e-4, ymax: 1, xlabel: "n", perRow: 1, H: 320 });
  const pos = r.mse.filter(v => v > 0), ymin = p10dn(Math.min(...pos, fin ? P.v / N : 1) * 0.9), ymax = p10up(Math.max(...r.mse, fin ? P.v : 1) * 1.1);
  chart($("svgL3"), { series: [{ name: "E(X̄_n − μ)², simulated", color: COL.G, marker: true, pts: r.ns.map((n, i) => [n, r.mse[i]]) }, ...(fin ? [{ name: "σ²/n", color: COL.Y, dash: "6 4", pts: r.ns.map(n => [n, P.v / n]) }] : [])], xlog: true, ylog: true, xmin: 1, xmax: N, ymin, ymax, xlabel: "n", perRow: 2, H: 300 });
  const i = r.ns.length - 1; let t = "";
  if (pop === "cauchy") t = `<li><b>No LLN.</b> E|X| = ∞: X̄<sub>n</sub> has the same Cauchy distribution as X<sub>1</sub> for every n, so P(|X̄<sub>n</sub>| &gt; ε) stays at ${f3(r.pProb[i])} even at n = ${fmtN(N)}, the running means keep jumping, and the mean-square error is not defined. No mode of convergence holds.</li>`;
  else if (pop === "pareto") t = `<li><b>LLN without L².</b> The variance is infinite, so E(X̄<sub>n</sub> − μ)² = ∞ (the simulated MSE is dominated by a few huge values and is unstable) and Chebyshev&rsquo;s bound is useless. But E|X| = 3 &lt; ∞, so the weak and strong LLN apply: P(|X̄<sub>n</sub> − 3| &gt; ε) decreases (${f3(r.pProb[i])} at n = ${fmtN(N)}), only much more slowly, and the running means approach 3 with occasional upward jumps. The LLN needs a mean, not a variance.</li>`;
  else t = `<li>P(|X̄<sub>n</sub> − μ| &gt; ε) falls to ${f3(r.pProb[i])} at n = ${fmtN(N)} and always lies below Chebyshev&rsquo;s bound; the MSE follows σ²/n (ratio at n = ${fmtN(N)}: ${f3(r.mse[i] / (P.v / N))}), i.e. L² convergence at rate 1/n; and each running mean settles near μ and stays there (almost sure convergence). Chebyshev is only an upper bound: the true probability decays much faster (Gaussian tail, by the CLT).</li>`;
  $("llnFinds").innerHTML = `<b>Reading the plots</b><ul class="plain">${t}</ul>`;
}

/* ---------------- 4. CLT ---------------- */
function runClt() {
  const pop = $("cp").value, M = Math.max(500, Math.min(20000, +$("cM").value || 4000)), ns = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500];
  CLT = runCLT(pop, ns, M, 2327983); const P = CLT.pop;
  const keep = $("cn").value; $("cn").innerHTML = ns.map(n => `<option value="${n}">${n}</option>`).join(""); $("cn").value = keep && ns.includes(+keep) ? keep : "10";
  drawCltHist();
  const sd3 = Math.pow(P.v, 1.5), be = P.rho ? ns.map(n => [n, Math.min(1, 0.4748 * P.rho / (sd3 * Math.sqrt(n)))]) : null, a = 3;
  chart($("svgC2"), { series: [{ name: "Kolmogorov distance, simulated", color: COL.B, marker: true, pts: ns.map((n, i) => [n, CLT.ks[i]]) }, ...(be ? [{ name: "Berry–Esseen bound (C = 0.4748)", color: COL.R, dash: "6 4", pts: be }] : []), { name: "reference ∝ 1/√n", color: COL.W, dash: "3 4", opacity: .6, width: 1.4, pts: ns.map(n => [n, CLT.ks[a] * Math.sqrt(ns[a] / n)]) }], xlog: true, ylog: true, xmin: 1, xmax: 500, ymin: 1e-3, ymax: 1, xlabel: "n", perRow: 1, H: 320 });
  const ns2 = [5, 20, 100, 500], pr = runNotInProb(pop, ns2, Math.min(M, 2000), 0.5, 11), asy = 2 * (1 - normCdf(0.5 / Math.sqrt(2 - Math.SQRT2)));
  $("cTab").innerHTML = `<tr><th>n</th><th>P(|Z<sub>2n</sub> − Z<sub>n</sub>| &gt; 0.5), simulated</th><th>limit as n → ∞ (Gaussian)</th><th>if Z<sub>n</sub> converged in probability</th></tr>` + ns2.map((n, i) => `<tr><td class="m">${n}</td><td class="n">${f3(pr[i])}</td><td class="n">${f3(asy)}</td><td class="n">→ 0</td></tr>`).join("");
}
function drawCltHist() {
  if (!CLT) return; const n = +$("cn").value, i = CLT.ns.indexOf(n), z = CLT.Z[i], nb = 40, lo = -4, hi = 4, w = (hi - lo) / nb, c = new Array(nb).fill(0);
  z.forEach(v => { const b = Math.floor((v - lo) / w); if (b >= 0 && b < nb) c[b]++; });
  histChart($("svgC1"), { bars: c.map((k, j) => ({ x0: lo + j * w, x1: lo + (j + 1) * w, d: k / z.length / w })), model: "B", pdf: phi, title: `Z_n for n = ${n}`, sub: `KS distance ${f3(CLT.ks[i])}`, xlabel: "z (red: N(0,1) density)", H: 320 });
}

/* ---------------- 5. sqrt(n) ---------------- */
function runSqrt() {
  const M = Math.max(100, Math.min(10000, +$("sM").value || 1500)), s = runScale(M, 2000, 5), as = [0, 0.25, 0.5, 0.75];
  const ser = []; as.forEach((a, k) => {
    ser.push({ name: a === 0.5 ? "a = 1/2 (CLT)" : a === 0 ? "a = 0 (LLN: sd → 0)" : `a = ${a}`, color: COLS[k], marker: true, pts: s.ns.map((n, i) => [n, Math.pow(n, a) * s.sd[i]]) });
    ser.push({ color: COLS[k], dash: "4 4", width: 1.3, opacity: .8, pts: s.ns.map(n => [n, Math.pow(n, a - 0.5)]) });
  });
  chart($("svgS1"), { series: ser, xlog: true, ylog: true, xmin: 1, xmax: 2000, ymin: 1e-2, ymax: 10, xlabel: "n", ylabel: "sd of n^a (X̄_n − μ)", perRow: 2, H: 340 });
  const rho = Math.min(0.95, Math.max(0, +$("dR").value || 0)), phi_ = Math.min(0.95, Math.max(0, +$("dP").value || 0)), Md = Math.min(M, 1500);
  const a = runDep("indep", 0, Md, 1000, 21), b = runDep("equi", rho, Md, 1000, 22), c = runDep("ar1", phi_, Md, 1000, 23);
  const mx = Math.max(...b.theory, ...c.theory, 1) * 1.5;
  chart($("svgS2"), { series: [
    { name: "independent", color: COL.B, marker: true, pts: a.ns.map((n, i) => [n, a.ratio[i]]) }, { color: COL.B, dash: "4 4", pts: a.ns.map((n, i) => [n, a.theory[i]]) },
    { name: `equicorrelated ρ = ${rho}`, color: COL.R, marker: true, pts: b.ns.map((n, i) => [n, b.ratio[i]]) }, { color: COL.R, dash: "4 4", pts: b.ns.map((n, i) => [n, b.theory[i]]) },
    { name: `AR(1) φ = ${phi_}`, color: COL.G, marker: true, pts: c.ns.map((n, i) => [n, c.ratio[i]]) }, { color: COL.G, dash: "4 4", pts: c.ns.map((n, i) => [n, c.theory[i]]) }],
    xlog: true, ylog: true, xmin: 1, xmax: 1000, ymin: 0.1, ymax: p10up(mx), xlabel: "n", ylabel: "n·Var(X̄_n)/σ²", perRow: 1, H: 340 });
}
function runCover() {
  const pop = $("vp").value, M = Math.max(500, Math.min(20000, +$("vM").value || 3000)), ns = [5, 10, 20, 50, 100, 200, 500], cov = runCoverEngine(pop, ns, M);
  $("vTab").innerHTML = `<tr><th>n</th><th>coverage of X̄ ± 1.96 s/√n</th><th>distance from 95%</th></tr>` + ns.map((n, i) => `<tr><td class="m">${n}</td><td class="n">${(100 * cov[i]).toFixed(1)}%</td><td class="n" style="color:${Math.abs(cov[i] - 0.95) < 0.015 ? "var(--ok)" : "var(--warn)"}">${(100 * (cov[i] - 0.95)).toFixed(1)} points</td></tr>`).join("");
}

(async function init() {
  initSelects(); galSel(); await tick(); runLln(); await tick(); runClt(); await tick(); runSqrt(); await tick(); runCover();
})();
