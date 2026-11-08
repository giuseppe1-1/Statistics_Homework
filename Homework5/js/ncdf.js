"use strict";
/* Standard normal CDF: several numerical methods + an arbitrary-precision reference (no DOM). */
const SQRT2 = Math.SQRT2, SQRTPI = Math.sqrt(Math.PI), INV_SQRT_2PI = 0.3989422804014327;
const phi = x => INV_SQRT_2PI * Math.exp(-0.5 * x * x);

/* ---- 1. numerical integration: Phi(x) = 1/2 +- int_0^|x| phi(t) dt ---- */
function cdfTrapezoid(x, n) {
  const ax = Math.abs(x), h = ax / n; let s = 0.5 * (phi(0) + phi(ax));
  for (let i = 1; i < n; i++) s += phi(i * h);
  const I = s * h; return { v: x >= 0 ? 0.5 + I : 0.5 - I, ev: n + 1 };
}
function cdfSimpson(x, n) {
  if (n % 2) n++;
  const ax = Math.abs(x), h = ax / n; let s = phi(0) + phi(ax);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * phi(i * h);
  const I = s * h / 3; return { v: x >= 0 ? 0.5 + I : 0.5 - I, ev: n + 1 };
}
/* ---- 2. Maclaurin series of erf (alternating):  erf z = 2/sqrt(pi) sum (-1)^k z^(2k+1) / (k! (2k+1)) ---- */
function cdfErfSeries(x) {
  const z = x / SQRT2, z2 = z * z; let term = z, sum = z, k = 0;
  while (k < 2000) { k++; term *= -z2 / k; const t = term / (2 * k + 1); sum += t; if (k > z2 && Math.abs(t) < 1e-17 * Math.abs(sum)) break; }
  return { v: 0.5 * (1 + 2 / SQRTPI * sum), ev: k + 1 };
}
/* ---- 3. series with positive terms:  Phi(x) = 1/2 + phi(x) sum x^(2k+1)/(1*3*5*...*(2k+1)) ---- */
function cdfPosSeries(x) {
  const x2 = x * x; let term = x, sum = x, k = 0;
  while (k < 5000) { k++; term *= x2 / (2 * k + 1); sum += term; if (k > x2 / 2 && Math.abs(term) < 1e-17 * Math.abs(sum)) break; }
  return { v: 0.5 + phi(x) * sum, ev: k + 1 };
}
/* ---- 4. Laplace continued fraction for the upper tail Q(x) = P(Z > x), x > 0:  phi(x) / (x + 1/(x + 2/(x + 3/(x + ...)))) ---- */
function tailCF(x) {
  let f = x, C = x, D = 0, k;
  for (k = 1; k < 3000; k++) { D = x + k * D; D = 1 / D; C = x + k / C; const d = C * D; f *= d; if (Math.abs(d - 1) < 1e-16) break; }
  return { v: phi(x) / f, ev: k };
}
function cdfCF(x) { if (x === 0) return { v: 0.5, ev: 0 }; const q = tailCF(Math.abs(x)); return { v: x > 0 ? 1 - q.v : q.v, ev: q.ev }; }
/* ---- 5. erf approximation, Abramowitz & Stegun 7.1.26 (abs. error of erf <= 1.5e-7) ---- */
function cdfAS(x) {
  const z = Math.abs(x) / SQRT2, t = 1 / (1 + 0.3275911 * z);
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const Q = 0.5 * p * Math.exp(-z * z);                       // = erfc(z)/2 = P(Z > |x|)
  return { v: x >= 0 ? 1 - Q : Q, ev: 6 };
}
/* ---- 6. hybrid (the method we recommend): series near 0, continued fraction in the tails ---- */
/* x >= 0: series up to x = 3 (no cancellation: Phi >= 1/2), then 1 - Q(x) with the continued fraction;
   x < 0 : series for -1.5 < x < 0 (Phi >= 0.067, the cancellation 1/2 - ... is harmless), otherwise the tail Q(|x|) is
           computed directly by the continued fraction, which keeps full RELATIVE accuracy deep in the lower tail. */
const HYBRID_POS = 3, HYBRID_NEG = -1.5;
function cdfHybrid(x) {
  if (x >= 0) return x < HYBRID_POS ? cdfPosSeries(x) : cdfCF(x);
  return x > HYBRID_NEG ? cdfPosSeries(x) : cdfCF(x);
}

/* ---- reference: 80-digit fixed-point series with BigInt (Phi(x) = 1/2 + 1/sqrt(2 pi) sum (-1)^k x^(2k+1) / (2^k k! (2k+1)) ) ---- */
const DIG = 80, ONE = 10n ** BigInt(DIG);
const C_INV = BigInt("3989422804014326779399460599343818684758586311649346576659258296706579258993018385012523".slice(0, DIG));
function bigRef(x) {
  const xs = x.toFixed(70), neg = xs[0] === "-", [ip, fp] = xs.replace("-", "").split(".");
  let X = BigInt(ip + fp) * 10n ** BigInt(DIG - 70); if (neg) X = -X;
  const x2 = X * X / ONE; let term = X, S = X;
  for (let k = 1; k < 4000; k++) {
    term = -term * x2 / (2n * BigInt(k)) / ONE; const t = term / BigInt(2 * k + 1); S += t;
    if (k > x * x && (t < 0n ? -t : t) === 0n) break;
  }
  const V = ONE / 2n + C_INV * S / ONE, s = V.toString().padStart(DIG + 1, "0");
  const str = s.slice(0, -DIG) + "." + s.slice(-DIG);
  return { str, v: Number(str) };
}

const NMETHODS = [
  { key: "trap", name: "Trapezoidal rule", run: (x, n) => cdfTrapezoid(x, n) },
  { key: "simp", name: "Simpson's rule", run: (x, n) => cdfSimpson(x, n) },
  { key: "erfs", name: "erf Maclaurin series (alternating)", run: x => cdfErfSeries(x) },
  { key: "pos", name: "Series with positive terms", run: x => cdfPosSeries(x) },
  { key: "cf", name: "Continued fraction", run: x => cdfCF(x) },
  { key: "as", name: "erf rational approx. (A&S 7.1.26)", run: x => cdfAS(x) },
  { key: "hyb", name: "Hybrid: series + continued fraction", run: x => cdfHybrid(x) }
];
if (typeof module !== "undefined") module.exports = { phi, cdfTrapezoid, cdfSimpson, cdfErfSeries, cdfPosSeries, tailCF, cdfCF, cdfAS, cdfHybrid, bigRef, NMETHODS, HYBRID_POS, HYBRID_NEG };
