"use strict";
/* Riemann vs Lebesgue numerical integration: the engine (no DOM). */
const gcd = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a; };
const sinc = x => x === 0 ? 1 : Math.sin(x) / x;
const SI_PI = 1.8519370519824662; // Si(pi) = integral_0^pi sin(x)/x dx

/* smallest q such that some p/q lies in the closed cell [i/n, (i+1)/n]: sup of Thomae's function there is 1/q */
function thomaeSup(i, n) {
  for (let q = 1; q <= n; q++) {
    const p = Math.floor((i * q + n - 1) / n);       // ceil(i q / n)
    if (p * n <= (i + 1) * q) return 1 / q;
  }
  return 1 / n;
}

/*  Every function carries:
    f(x)            the function
    G(t)            Lebesgue measure of the level set {x in [a,b] : f(x) < t}   (the "distribution function")
    lo, hi          range of f (hi = null: unbounded above)
    inf(x0,x1), sup(x0,x1)   exact inf / sup of f on the closed cell [x0,x1]  (Darboux sums)           */
const FUNCS = [
  { id: "sin", name: "sin x on [0, π]", html: "f(x) = sin x, x ∈ [0, π]", a: 0, b: Math.PI, exact: 2, exactTxt: "2",
    f: Math.sin, lo: 0, hi: 1,
    G: t => t <= 0 ? 0 : t > 1 ? Math.PI : 2 * Math.asin(t),
    inf: (x0, x1) => Math.min(Math.sin(x0), Math.sin(x1)),
    sup: (x0, x1) => (x0 <= Math.PI / 2 && x1 >= Math.PI / 2) ? 1 : Math.max(Math.sin(x0), Math.sin(x1)),
    type: "smooth", note: "Smooth and bounded: the textbook case." },
  { id: "sq", name: "x² on [0, 1]", html: "f(x) = x², x ∈ [0, 1]", a: 0, b: 1, exact: 1 / 3, exactTxt: "1/3",
    f: x => x * x, lo: 0, hi: 1,
    G: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.sqrt(t),
    inf: (x0) => x0 * x0, sup: (x0, x1) => x1 * x1,
    type: "smooth", note: "Smooth, monotone." },
  { id: "step3", name: "step 1 / 3 on [0, 1]", html: "f(x) = 1 if x &lt; 0.5, 3 if x ≥ 0.5", a: 0, b: 1, exact: 2, exactTxt: "2",
    f: x => x < 0.5 ? 1 : 3, lo: 1, hi: 3,
    G: t => t <= 1 ? 0 : t <= 3 ? 0.5 : 1,
    inf: (x0) => x0 < 0.5 ? 1 : 3, sup: (x0, x1) => x1 >= 0.5 ? 3 : 1,
    type: "step", note: "Discontinuous at 0.5 (one jump): Riemann integrable. It takes only two values, so the Lebesgue picture is trivial." },
  { id: "abs", name: "|x − 0.5| on [0, 1]", html: "f(x) = |x − 0.5|, x ∈ [0, 1]", a: 0, b: 1, exact: 0.25, exactTxt: "1/4",
    f: x => Math.abs(x - 0.5), lo: 0, hi: 0.5,
    G: t => t <= 0 ? 0 : Math.min(2 * t, 1),
    inf: (x0, x1) => (x0 <= 0.5 && x1 >= 0.5) ? 0 : Math.min(Math.abs(x0 - 0.5), Math.abs(x1 - 0.5)),
    sup: (x0, x1) => Math.max(Math.abs(x0 - 0.5), Math.abs(x1 - 0.5)),
    type: "smooth", note: "Continuous with a corner at 0.5 (not differentiable there)." },
  { id: "invsqrt", name: "1/√x on (0, 1]", html: "f(x) = 1/√x, x ∈ (0, 1]", a: 0, b: 1, exact: 2, exactTxt: "2",
    f: x => x === 0 ? Infinity : 1 / Math.sqrt(x), lo: 1, hi: null,
    G: t => t <= 1 ? 0 : 1 - 1 / (t * t),
    inf: (x0, x1) => 1 / Math.sqrt(x1), sup: (x0) => x0 === 0 ? Infinity : 1 / Math.sqrt(x0),
    type: "improper", note: "Unbounded near 0: not Riemann integrable in the proper sense (only as an improper integral), but Lebesgue integrable." },
  { id: "step1", name: "step 1 / 0 on [0, 1]", html: "f(x) = 1 if x &lt; 0.5, 0 if x ≥ 0.5", a: 0, b: 1, exact: 0.5, exactTxt: "1/2",
    f: x => x < 0.5 ? 1 : 0, lo: 0, hi: 1,
    G: t => t <= 0 ? 0 : t <= 1 ? 0.5 : 1,
    inf: (x0, x1) => x1 >= 0.5 ? 0 : 1, sup: (x0) => x0 < 0.5 ? 1 : 0,
    type: "step", note: "Indicator function of [0, 0.5): Lebesgue integral = measure of the set." },
  { id: "sinc", name: "sin x / x on [0, π]", html: "f(x) = sin x / x, x ∈ [0, π]  (f(0) = 1)", a: 0, b: Math.PI, exact: SI_PI, exactTxt: "Si(π) = 1.8519370519824662…",
    f: sinc, lo: 0, hi: 1,
    G: t => {
      if (t <= 0) return 0; if (t > 1) return Math.PI;
      let lo = 0, hi = Math.PI; for (let i = 0; i < 55; i++) { const m = (lo + hi) / 2; if (sinc(m) > t) lo = m; else hi = m; }
      return Math.PI - (lo + hi) / 2;               // {sinc < t} = (x*, π] because sinc decreases on [0, π]
    },
    inf: (x0, x1) => sinc(x1), sup: (x0) => sinc(x0),
    type: "smooth", note: "Smooth after removing the removable singularity at 0; the antiderivative is the special function Si." },
  { id: "dir", name: "Dirichlet", html: "f(x) = 1 if x is rational, 0 if x is irrational, x ∈ [0, 1]", a: 0, b: 1, exact: 0, exactTxt: "0 (Lebesgue); not Riemann integrable",
    patho: "dir", lo: 0, hi: 1, G: t => t <= 0 ? 0 : 1,
    darbouxLower: () => 0, darbouxUpper: () => 1,
    type: "patho", note: "Every cell contains both rationals and irrationals, so every upper sum is 1 and every lower sum is 0." },
  { id: "thomae", name: "Thomae", html: "f(x) = 1/q if x = p/q in lowest terms, 0 if x is irrational, x ∈ [0, 1]", a: 0, b: 1, exact: 0, exactTxt: "0 (both Riemann and Lebesgue)",
    patho: "thomae", lo: 0, hi: 1, G: t => t <= 0 ? 0 : 1,
    darbouxLower: () => 0,
    darbouxUpper: n => { let s = 0; for (let i = 0; i < n; i++) s += thomaeSup(i, n); return s / n; },
    type: "patho", note: "Continuous at every irrational and discontinuous at every rational: its discontinuity set has measure zero, so it IS Riemann integrable (integral 0)." }
];

/* ---------------- Riemann-type sums ---------------- */
function pathoSum(F, n, tag) {
  if (tag === "irr") return 0;                                 // f = 0 on every irrational tag
  let s = 0;
  if (F.patho === "dir") return 1;                             // every rational tag gives 1: sum = n * 1/n
  if (tag === "mid") { for (let i = 0; i < n; i++) s += gcd(2 * i + 1, 2 * n) / (2 * n); }
  else if (tag === "right") { for (let i = 1; i <= n; i++) s += gcd(i, n) / n; }
  else { for (let i = 0; i < n; i++) s += gcd(i, n) / n; }     // left tags k/n: f = 1/(n/gcd) = gcd/n  (gcd(0,n) = n)
  return s / n;
}
function riemannSum(F, n, tag) {                                // tag: left | mid | right | irr
  if (F.patho) return { v: pathoSum(F, n, tag), ev: n };
  const a = F.a, h = (F.b - F.a) / n; let s = 0;
  if (tag === "left") for (let i = 0; i < n; i++) s += F.f(a + i * h);
  else if (tag === "right") for (let i = 1; i <= n; i++) s += F.f(a + i * h);
  else for (let i = 0; i < n; i++) s += F.f(a + (i + 0.5) * h);
  return { v: s * h, ev: n };
}
function darboux(F, n, which) {                                 // which: lower | upper
  if (F.patho) return { v: which === "lower" ? F.darbouxLower(n) : F.darbouxUpper(n), ev: n };
  const a = F.a, h = (F.b - F.a) / n; let s = 0;
  for (let i = 0; i < n; i++) { const x0 = a + i * h, x1 = a + (i + 1) * h; s += which === "lower" ? F.inf(x0, x1) : F.sup(x0, x1); }
  return { v: s * h, ev: 2 * n };
}

/* ---------------- Lebesgue-type sums (partition of the RANGE) ---------------- */
/* N levels y_k = lo + k h; E_k = {y_k <= f < y_{k+1}} (last cell closed); mu(E_k) = G(y_{k+1}) - G(y_k).
   lower: sum y_k mu(E_k)   upper: sum y_{k+1} mu(E_k)   mid: sum (y_k + h/2) mu(E_k) */
function lebesgueSum(F, N, mode) {
  const L = F.b - F.a, unb = F.hi == null, lo = F.lo, top = unb ? lo + Math.sqrt(N) : F.hi, h = (top - lo) / N;
  if (unb && mode === "upper") return { v: NaN, ev: N + 1 };    // the last cell has no finite upper value
  let s = 0, Gk = F.G(lo);
  for (let k = 0; k < N; k++) {
    const y0 = lo + k * h, Gn = k === N - 1 ? L : F.G(y0 + h);
    const y = mode === "lower" ? y0 : mode === "upper" ? y0 + h : y0 + h / 2;
    s += y * (Gn - Gk); Gk = Gn;
  }
  return { v: s, ev: N + 1 };
}
/* Lebesgue sum with the measures of the preimages ESTIMATED from M sample points (histogram of the values) */
function lebesgueSampled(F, N, M) {
  if (F.patho) return { v: NaN, ev: 0 };
  const unb = F.hi == null, lo = F.lo, top = unb ? lo + Math.sqrt(N) : F.hi, h = (top - lo) / N, L = F.b - F.a;
  const cnt = new Float64Array(N), dx = L / M;
  for (let i = 0; i < M; i++) { const y = F.f(F.a + (i + 0.5) * dx); let k = Math.floor((y - lo) / h); if (!(k >= 0)) k = 0; if (k >= N) k = N - 1; cnt[k]++; }
  let s = 0; for (let k = 0; k < N; k++) s += (lo + (k + 0.5) * h) * cnt[k];
  return { v: s * dx, ev: M };
}

const METHODS = [
  { key: "Rleft", grp: "R", name: "Riemann, left tags", run: (F, n) => riemannSum(F, n, "left") },
  { key: "Rmid", grp: "R", name: "Riemann, midpoint tags", run: (F, n) => riemannSum(F, n, "mid") },
  { key: "Rlow", grp: "R", name: "Darboux lower sum", run: (F, n) => darboux(F, n, "lower") },
  { key: "Rup", grp: "R", name: "Darboux upper sum", run: (F, n) => darboux(F, n, "upper") },
  { key: "Llow", grp: "L", name: "Lebesgue lower sum", run: (F, n) => lebesgueSum(F, n, "lower") },
  { key: "Lmid", grp: "L", name: "Lebesgue mid-level sum", run: (F, n) => lebesgueSum(F, n, "mid") },
  { key: "Lup", grp: "L", name: "Lebesgue upper sum", run: (F, n) => lebesgueSum(F, n, "upper") }
];
const byKey = k => METHODS.find(m => m.key === k);

/* absolute error of one method at n cells/levels */
function errAt(F, key, n) { const r = byKey(key).run(F, n).v; return Math.abs(r - F.exact); }

/* convergence table: err[key][i] for ns[i] */
function convergence(F, ns, keys) {
  const out = {}; keys.forEach(k => out[k] = ns.map(n => errAt(F, k, n)));
  return out;
}
/* empirical order p in err ~ C n^-p, least squares on the last points that are above the floating-point floor */
function order(ns, errs, floor = 1e-13) {
  const pts = []; for (let i = 0; i < ns.length; i++) if (isFinite(errs[i]) && errs[i] > floor) pts.push([Math.log(ns[i]), Math.log(errs[i])]);
  const q = pts.slice(-6); if (q.length < 3) return NaN;
  const mx = q.reduce((s, p) => s + p[0], 0) / q.length, my = q.reduce((s, p) => s + p[1], 0) / q.length;
  let num = 0, den = 0; q.forEach(p => { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) ** 2; });
  return -num / den;
}
function timeIt(fn, reps = 5) { let best = Infinity; for (let r = 0; r < reps; r++) { const t = performance.now(); fn(); best = Math.min(best, performance.now() - t); } return best; }

if (typeof module !== "undefined") module.exports = { FUNCS, METHODS, byKey, riemannSum, darboux, lebesgueSum, lebesgueSampled, errAt, convergence, order, thomaeSup, gcd };
