"use strict";
/* Numerical engine for the probability homework (no DOM): random numbers, special functions, simulations. */

/* ---------------- random numbers ---------------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rand) {
  let spare = null;
  return () => { if (spare !== null) { const s = spare; spare = null; return s; } let u, v, s; do { u = 2 * rand() - 1; v = 2 * rand() - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const f = Math.sqrt(-2 * Math.log(s) / s); spare = v * f; return u * f; };
}
function denseNs(N, count = 48) {                         // log-spaced integer checkpoints 1..N
  const s = new Set([1, N]); for (let i = 0; i < count; i++) s.add(Math.max(1, Math.round(Math.pow(N, i / (count - 1)))));
  return [...s].sort((a, b) => a - b);
}

/* ---------------- special functions ---------------- */
const LGC = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = LGC[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += LGC[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const INV_SQRT_2PI = 0.3989422804014327, phi = x => INV_SQRT_2PI * Math.exp(-0.5 * x * x);
function normCdf(x) {                                      // series near 0, continued fraction in the tails (full double precision)
  const tail = z => { let f = z, C = z, D = 0; for (let k = 1; k < 3000; k++) { D = 1 / (z + k * D); C = z + k / C; const d = C * D; f *= d; if (Math.abs(d - 1) < 1e-16) break; } return phi(z) / f; };
  const pos = z => { const z2 = z * z; let term = z, sum = z; for (let k = 1; k < 5000; k++) { term *= z2 / (2 * k + 1); sum += term; if (k > z2 / 2 && Math.abs(term) < 1e-17 * Math.abs(sum)) break; } return 0.5 + phi(z) * sum; };
  if (x >= 0) return x < 3 ? pos(x) : 1 - tail(x);
  return x > -1.5 ? pos(x) : tail(-x);
}
function betacf(a, b, x) {
  const FP = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
  for (let m = 1; m <= 400; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}
function betainc(x, a, b) {                                // regularised incomplete beta I_x(a, b) = Beta(a, b) cdf
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
function betaPdf(x, a, b) { if (x <= 0 || x >= 1) return (x === 0 && a === 1) ? b : (x === 1 && b === 1) ? a : 0; return Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)); }
function betaQuantile(p, a, b) { let lo = 0, hi = 1; for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (betainc(m, a, b) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

/* ================== 1. gallery: modes of convergence of a sequence X_n(omega) -> 0 ================== */
const GALLERY = {
  mean: { name: "Centred sample mean of fair coin tosses", form: "X<sub>n</sub> = (ξ<sub>1</sub> + … + ξ<sub>n</sub>)/n − 1/2, ξ<sub>i</sub> i.i.d. Bernoulli(½)", eps: 0.05, truth: { prob: 1, as: 1, l2: 1 },
    why: "The Law of Large Numbers: Var(X<sub>n</sub>) = 1/(4n) → 0 gives L² (hence in probability) by Chebyshev; the Strong LLN gives a.s. convergence." },
  typewriter: { name: "Typewriter sequence (moving bump)", form: "X<sub>n</sub> = 1{U ∈ [k/2<sup>m</sup>, (k+1)/2<sup>m</sup>)}, n = 2<sup>m</sup> + k, one U ~ Uniform(0,1) for the whole path", eps: 0.5, truth: { prob: 1, as: 0, l2: 1 },
    why: "P(X<sub>n</sub> = 1) = 2<sup>−m</sup> → 0 and E X<sub>n</sub>² = 2<sup>−m</sup> → 0, but the bump sweeps the whole interval again and again: for every ω, X<sub>n</sub>(ω) = 1 infinitely often. In probability and L², not a.s." },
  spike: { name: "Spike: n · 1{U < 1/n}", form: "X<sub>n</sub> = n · 1{U &lt; 1/n}, one U ~ Uniform(0,1) for the whole path", eps: 0.5, truth: { prob: 1, as: 1, l2: 0 },
    why: "For a given ω, X<sub>n</sub>(ω) = 0 as soon as n &gt; 1/U: a.s. convergence (and in probability, P(X<sub>n</sub> ≠ 0) = 1/n → 0). But E X<sub>n</sub> = 1 and E X<sub>n</sub>² = n → ∞: the rare large values keep the moments away from 0. a.s. does not imply L<sup>p</sup>." },
  ind1n: { name: "Independent indicators with P(X_n = 1) = 1/n", form: "X<sub>n</sub> ~ Bernoulli(1/n), independent", eps: 0.5, truth: { prob: 1, as: 0, l2: 1 },
    why: "P(X<sub>n</sub> = 1) = 1/n → 0 and E X<sub>n</sub>² = 1/n → 0, but Σ 1/n = ∞ and the events are independent: by the second Borel–Cantelli lemma, X<sub>n</sub> = 1 infinitely often with probability 1. Not a.s. (the simulation only sees up to N, so the curve falls near n = N)." },
  ind1n2: { name: "Independent indicators with P(X_n = 1) = 1/n²", form: "X<sub>n</sub> ~ Bernoulli(1/n²), independent", eps: 0.5, truth: { prob: 1, as: 1, l2: 1 },
    why: "Now Σ 1/n² &lt; ∞: by the first Borel–Cantelli lemma only finitely many X<sub>n</sub> equal 1, hence a.s. convergence; also E X<sub>n</sub>² = 1/n² → 0." }
};
function galleryPath(kind, rand, N, out) {
  if (kind === "mean") { let s = 0; for (let k = 1; k <= N; k++) { s += rand() < 0.5 ? 1 : 0; out[k - 1] = s / k - 0.5; } }
  else if (kind === "typewriter") { const u = rand(); for (let k = 1; k <= N; k++) { const m = Math.floor(Math.log2(k)), p = 2 ** m, j = k - p; out[k - 1] = (u >= j / p && u < (j + 1) / p) ? 1 : 0; } }
  else if (kind === "spike") { const u = rand(); for (let k = 1; k <= N; k++) out[k - 1] = u < 1 / k ? k : 0; }
  else if (kind === "ind1n") { for (let k = 1; k <= N; k++) out[k - 1] = rand() < 1 / k ? 1 : 0; }
  else { for (let k = 1; k <= N; k++) out[k - 1] = rand() < 1 / (k * k) ? 1 : 0; }
}
function runGallery(kind, M, N, eps, seed) {
  const rand = rng(seed), out = new Float64Array(N), ns = denseNs(N), np = ns.length, pProb = new Float64Array(np), pSup = new Float64Array(np), msq = new Float64Array(np), paths = [];
  for (let m = 0; m < M; m++) {
    galleryPath(kind, rand, N, out); if (m < 4) paths.push(Array.from(out.slice(0, Math.min(N, 120))));
    let mx = 0, j = np - 1;
    for (let k = N; k >= 1; k--) {
      const v = out[k - 1], a = Math.abs(v); if (a > mx) mx = a;
      if (j >= 0 && ns[j] === k) { if (a > eps) pProb[j]++; if (mx > eps) pSup[j]++; msq[j] += v * v; j--; }
    }
  }
  return { ns, pProb: Array.from(pProb, v => v / M), pSup: Array.from(pSup, v => v / M), msq: Array.from(msq, v => v / M), paths };
}

/* ================== 2. LLN ================== */
const POPS = {
  bern: { name: "Bernoulli(0.3)", mu: 0.3, v: 0.21, sample: r => r() < 0.3 ? 1 : 0 },
  exp: { name: "Exponential(1)", mu: 1, v: 1, sample: r => -Math.log(1 - r()) },
  unif: { name: "Uniform(0, 1)", mu: 0.5, v: 1 / 12, sample: r => r() },
  pareto: { name: "Pareto(α = 1.5): finite mean 3, infinite variance", mu: 3, v: Infinity, sample: r => Math.pow(1 - r(), -1 / 1.5) },
  cauchy: { name: "Cauchy: no mean at all", mu: 0, v: Infinity, sample: r => Math.tan(Math.PI * (r() - 0.5)) }
};
function runLLN(pop, M, N, eps, seed) {
  const P = POPS[pop], rand = rng(seed), ns = denseNs(N, 60), np = ns.length, pr = new Float64Array(np), ms = new Float64Array(np), paths = [];
  for (let m = 0; m < M; m++) {
    let s = 0, j = 0; const keep = m < 8 ? new Array(np) : null;
    for (let k = 1; k <= N; k++) { s += P.sample(rand); if (ns[j] === k) { const d = s / k - P.mu; if (Math.abs(d) > eps) pr[j]++; ms[j] += d * d; if (keep) keep[j] = s / k; j++; } }
    if (keep) paths.push(keep);
  }
  return { ns, pProb: Array.from(pr, v => v / M), mse: Array.from(ms, v => v / M), paths, mu: P.mu, v: P.v };
}

/* ================== 3. CLT ================== */
const CLTPOPS = {
  bern: { name: "Bernoulli(0.1) (very skewed, discrete)", mu: 0.1, v: 0.09, rho: 0.1 * 0.9 * (0.01 + 0.81), sample: r => r() < 0.1 ? 1 : 0 },
  exp: { name: "Exponential(1) (skewed)", mu: 1, v: 1, rho: 12 / Math.E - 2, sample: r => -Math.log(1 - r()) },
  unif: { name: "Uniform(0, 1) (symmetric)", mu: 0.5, v: 1 / 12, rho: 1 / 32, sample: r => r() },
  pareto: { name: "Pareto(α = 4) (heavy-tailed)", mu: 4 / 3, v: 2 / 9, rho: null, sample: r => Math.pow(1 - r(), -1 / 4) }
};
function runCLT(pop, ns, M, seed) {
  const P = CLTPOPS[pop], rand = rng(seed), sd = Math.sqrt(P.v), Z = [], ks = [];
  for (const n of ns) {
    const z = new Float64Array(M);
    for (let m = 0; m < M; m++) { let s = 0; for (let i = 0; i < n; i++) s += P.sample(rand); z[m] = (s - n * P.mu) / (sd * Math.sqrt(n)); }
    z.sort(); let D = 0; for (let i = 0; i < M; i++) { const F = normCdf(z[i]); D = Math.max(D, F - i / M, (i + 1) / M - F); }
    Z.push(z); ks.push(D);
  }
  return { ns, ks, Z, pop: P };
}
function runNotInProb(pop, ns, M, eps, seed) {             // P(|Z_2n - Z_n| > eps) does not tend to 0: Z_n does not converge in probability
  const P = CLTPOPS[pop], rand = rng(seed), sd = Math.sqrt(P.v), out = [];
  for (const n of ns) {
    let c = 0;
    for (let m = 0; m < M; m++) { let s = 0, s2 = 0; for (let i = 0; i < 2 * n; i++) { const x = P.sample(rand); s2 += x; if (i < n) s += x; } const z1 = (s - n * P.mu) / (sd * Math.sqrt(n)), z2 = (s2 - 2 * n * P.mu) / (sd * Math.sqrt(2 * n)); if (Math.abs(z2 - z1) > eps) c++; }
    out.push(c / M);
  }
  return out;
}

/* ================== 4. why sqrt(n) ================== */
function runScale(M, N, seed) {                            // sd of the sample mean of Exponential(1): sigma / sqrt(n)
  const rand = rng(seed), ns = denseNs(N, 40), np = ns.length, acc = new Float64Array(np);
  for (let m = 0; m < M; m++) { let s = 0, j = 0; for (let k = 1; k <= N; k++) { s += -Math.log(1 - rand()); if (ns[j] === k) { const d = s / k - 1; acc[j] += d * d; j++; } } }
  return { ns, sd: Array.from(acc, v => Math.sqrt(v / M)) };
}
function theoryRatio(model, par, n) {                      // n Var(mean) / sigma^2 for unit-variance stationary sequences
  if (model === "indep") return 1;
  if (model === "equi") return 1 + (n - 1) * par;
  let s = 0; for (let k = 1; k < Math.min(n, 4000); k++) s += (1 - k / n) * Math.pow(par, k); return 1 + 2 * s;
}
function runDep(model, par, M, N, seed) {
  const rand = rng(seed), g = gauss(rand), ns = denseNs(N, 40), np = ns.length, acc = new Float64Array(np);
  for (let m = 0; m < M; m++) {
    let s = 0, j = 0, x = g(); const w = g(), a = Math.sqrt(par), b = Math.sqrt(1 - par), q = Math.sqrt(1 - par * par);
    for (let k = 1; k <= N; k++) {
      let v; if (model === "indep") v = g(); else if (model === "equi") v = a * w + b * g(); else { if (k > 1) x = par * x + q * g(); v = x; }
      s += v; if (ns[j] === k) { const mean = s / k; acc[j] += k * mean * mean; j++; }
    }
  }
  return { ns, ratio: Array.from(acc, v => v / M), theory: ns.map(n => theoryRatio(model, par, n)) };
}
function runCoverEngine(pop, ns, M, seed = 8) {                      // coverage of the 95% interval  xbar +- 1.96 s / sqrt(n)
  const P = CLTPOPS[pop], rand = rng(seed), out = [];
  for (const n of ns) {
    let c = 0;
    for (let m = 0; m < M; m++) { let s = 0, s2 = 0; for (let i = 0; i < n; i++) { const x = P.sample(rand); s += x; s2 += x * x; } const mean = s / n, v = Math.max(0, (s2 - n * mean * mean) / (n - 1)); if (Math.abs(mean - P.mu) <= 1.96 * Math.sqrt(v / n)) c++; }
    out.push(c / M);
  }
  return out;
}

/* ================== 5. Bayesian helpers ================== */
function wilson(x, n, z = 1.959964) { const p = x / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; }
function betaSummary(a, b) {
  const mean = a / (a + b), mode = a > 1 && b > 1 ? (a - 1) / (a + b - 2) : (a <= 1 && b > 1 ? 0 : (b <= 1 && a > 1 ? 1 : NaN)), sd = Math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1)));
  return { mean, mode, sd, lo: betaQuantile(0.025, a, b), hi: betaQuantile(0.975, a, b) };
}
function bernoulliPath(theta, N, seed) { const r = rng(seed), out = new Uint8Array(N); for (let i = 0; i < N; i++) out[i] = r() < theta ? 1 : 0; return out; }

if (typeof module !== "undefined") module.exports = { rng, gauss, denseNs, lgamma, normCdf, betainc, betaPdf, betaQuantile, GALLERY, runGallery, POPS, runLLN, CLTPOPS, runCLT, runNotInProb, runScale, runDep, theoryRatio, runCoverEngine, wilson, betaSummary, bernoulliPath };
