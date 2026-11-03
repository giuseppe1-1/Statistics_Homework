"use strict";
/* ===== Welford / Knuth recurrences, score distributions on [0, 10], simulation of m hackers x n systems ===== */

/* ---- seedable generator (sfc32) ---- */
class Rng {
  constructor(seed) {
    let s = seed >>> 0;
    const sm = () => { s = (s + 0x9E3779B9) | 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
    this.a = sm(); this.b = sm(); this.c = sm(); this.d = 1;
    for (let i = 0; i < 15; i++) this.u32();
  }
  u32() {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }
  u01() { return this.u32() / 4294967296; }
}

/* ---- Welford's algorithm: the core of the recurrence is the three lines inside the loop ---- */
function welford(data) {
  let k = 0, mean = 0, ss = 0;
  for (const x of data) {
    k++;
    const d = x - mean;        // 1. difference from the OLD mean
    mean += d / k;             // 2. Knuth: M_k = M_{k-1} + (x_k - M_{k-1}) / k
    ss += d * (x - mean);      // 3. Welford: SS_k = SS_{k-1} + (x_k - M_{k-1}) (x_k - M_k)
  }
  return { n: k, mean, ss, variance: k > 1 ? ss / (k - 1) : NaN, popVariance: k > 0 ? ss / k : NaN };
}
function twoPass(data) { // textbook reference
  const n = data.length; let s = 0; for (const x of data) s += x;
  const mean = s / n; let ss = 0; for (const x of data) ss += (x - mean) * (x - mean);
  return { n, mean, ss, variance: ss / (n - 1), popVariance: ss / n };
}
function naiveFormula(data) { // (sum x^2 - (sum x)^2 / n) / (n - 1): numerically unstable
  const n = data.length; let s = 0, q = 0; for (const x of data) { s += x; q += x * x; }
  return { n, mean: s / n, ss: q - s * s / n, variance: (q - s * s / n) / (n - 1), popVariance: (q - s * s / n) / n };
}

/* ---- score distributions on [0, 10] with exact theoretical moments ---- */
function discreteDist(name, pmf) {
  const tot = pmf.reduce((a, b) => a + b, 0), p = pmf.map(v => v / tot);
  const cdf = []; let c = 0; for (const v of p) { c += v; cdf.push(c); }
  let mu = 0; p.forEach((v, i) => mu += i * v);
  let var2 = 0, mu3 = 0, mu4 = 0; p.forEach((v, i) => { const d = i - mu; var2 += v * d * d; mu3 += v * d * d * d; mu4 += v * d ** 4; });
  return { name, kind: "discrete", pmf: p, mu, variance: var2, mu3, mu4, sample: r => { const u = r.u01(); let i = 0; while (i < 10 && u >= cdf[i]) i++; return i; } };
}
function binomialPmf(n, q) { const out = []; let lc = 0; for (let k = 0; k <= n; k++) { if (k > 0) lc += Math.log(n - k + 1) - Math.log(k); out.push(Math.exp(lc + k * Math.log(q) + (n - k) * Math.log(1 - q))); } return out; }
function makeDist(kind, opts) {
  if (kind === "binomial") return discreteDist(`Binomial(10, ${opts.q})`, binomialPmf(10, opts.q));
  if (kind === "uniform") return discreteDist("Uniform on {0, 1, ..., 10}", new Array(11).fill(1));
  if (kind === "custom") return discreteDist("Custom distribution on {0, ..., 10}", opts.weights);
  // 10 * Beta(2, 5): continuous scores in [0, 10]; the 2nd smallest of 6 uniforms is Beta(2, 5)
  const a = 2, b = 5, s = a + b, mu = 10 * a / s, v = 100 * a * b / (s * s * (s + 1));
  const exk = 6 * ((a - b) ** 2 * (s + 1) - a * b * (s + 2)) / (a * b * (s + 2) * (s + 3));
  const cdf01 = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 5) * (1 + 5 * x);
  return {
    name: "10 · Beta(2, 5) (continuous)", kind: "continuous", mu, variance: v, mu3: NaN, mu4: (exk + 3) * v * v, cdf: x => cdf01(x / 10),
    sample: r => { let m1 = 2, m2 = 2; for (let i = 0; i < 6; i++) { const u = r.u01(); if (u < m1) { m2 = m1; m1 = u; } else if (u < m2) m2 = u; } return 10 * m2; }
  };
}
const varOfSampleVariance = (D, n) => (D.mu4 - (n - 3) / (n - 1) * D.variance * D.variance) / n; // Var(s^2) for i.i.d. samples of size n

/* ---- experiment: m hackers, each attacking up to nmax systems; Welford state is read at the checkpoints in ns ---- */
function makeSim(D, m, ns, seed, nPaths) {
  const nmax = ns[ns.length - 1];
  return { D, m, ns, rng: new Rng(seed), nmax, mean: ns.map(() => new Float64Array(m)), ss: ns.map(() => new Float64Array(m)),
    pathM: Array.from({ length: Math.min(nPaths, m) }, () => new Float64Array(nmax + 1)), pathS: Array.from({ length: Math.min(nPaths, m) }, () => new Float64Array(nmax + 1)), first: null };
}
function simulateHackers(sim, from, to) {
  const { D, ns, rng, nmax } = sim;
  for (let j = from; j < to; j++) {
    const pm = j < sim.pathM.length ? sim.pathM[j] : null, ps = j < sim.pathM.length ? sim.pathS[j] : null;
    const keep = j === 0 ? [] : null;
    let mean = 0, ss = 0, c = 0;
    for (let k = 1; k <= nmax; k++) {
      const x = D.sample(rng);
      const d = x - mean;
      mean += d / k;
      ss += d * (x - mean);
      if (pm) { pm[k] = mean; ps[k] = ss; }
      if (keep) keep.push(x);
      if (k === ns[c]) { sim.mean[c][j] = mean; sim.ss[c][j] = ss; c++; }
    }
    if (keep) sim.first = keep;
  }
}
function momentsOf(v) {
  const m = v.length; let s = 0; for (let i = 0; i < m; i++) s += v[i];
  const mean = s / m; let c2 = 0; for (let i = 0; i < m; i++) { const d = v[i] - mean; c2 += d * d; }
  return { mean, variance: c2 / (m - 1), sd: Math.sqrt(c2 / (m - 1)) };
}
function analyseSim(sim) {
  const { D, m, ns } = sim;
  return ns.map((n, c) => {
    const xb = sim.mean[c], s2 = new Float64Array(m), s2b = new Float64Array(m);
    for (let j = 0; j < m; j++) { s2[j] = sim.ss[c][j] / (n - 1); s2b[j] = sim.ss[c][j] / n; }
    const a = momentsOf(xb), b = momentsOf(s2), g = momentsOf(s2b);
    return {
      n, xb, s2, avgMean: a.mean, sdMeans: a.sd, seAvgMean: a.sd / Math.sqrt(m),
      avgVar: b.mean, sdVars: b.sd, seAvgVar: b.sd / Math.sqrt(m), avgVarBiased: g.mean, seAvgVarBiased: g.sd / Math.sqrt(m),
      thSdMeans: Math.sqrt(D.variance / n), thSdVars: Math.sqrt(varOfSampleVariance(D, n)), thBiased: D.variance * (n - 1) / n
    };
  });
}
function histContinuous(v, bins, lo, hi) {
  if (lo === undefined) { lo = Infinity; hi = -Infinity; for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; } }
  const w = (hi - lo) / bins || 1, cnt = new Array(bins).fill(0);
  for (const x of v) cnt[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / w)))]++;
  return cnt.map((c, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, d: c / v.length / w }));
}
const phi = x => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
if (typeof module !== "undefined") module.exports = { Rng, welford, twoPass, naiveFormula, makeDist, varOfSampleVariance, makeSim, simulateHackers, analyseSim, histContinuous, momentsOf };
