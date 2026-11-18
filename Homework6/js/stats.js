"use strict";
/* Contingency tables and the chi-square test of independence (engine, no DOM). */

/* ---------- special functions: log-gamma, regularised incomplete gamma, chi-square distribution ---------- */
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = LG[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function gammaPser(a, x) {                       // series, good for x < a + 1
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 0; n < 5000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}
function gammaQcf(a, x) {                        // continued fraction (modified Lentz), good for x >= a + 1
  const tiny = 1e-300; let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 5000; i++) {
    const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
function gammaQ(a, x) { if (x <= 0) return 1; return x < a + 1 ? 1 - gammaPser(a, x) : gammaQcf(a, x); }
const chi2sf = (x, k) => gammaQ(k / 2, x / 2);                               // P(chi2_k >= x)
const chi2pdf = (x, k) => x <= 0 ? (k === 2 ? 0.5 : 0) : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2));
function chi2crit(alpha, k) {                    // x with P(chi2_k >= x) = alpha
  let lo = 0, hi = Math.max(10, k * 4); while (chi2sf(hi, k) > alpha) hi *= 2;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (chi2sf(m, k) > alpha) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/* ---------- random numbers ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- from a list of records (x, f) to the contingency table ---------- */
function naturalSort(a) {
  return a.slice().sort((p, q) => { const np = Number(p), nq = Number(q); return (isFinite(np) && isFinite(nq) && p !== "" && q !== "") ? np - nq : String(p).localeCompare(String(q)); });
}
function quantileBins(vals, k) {                 // equal-frequency classes for a numeric variable with many distinct values
  const nums = vals.map(Number), s = nums.slice().sort((a, b) => a - b), cuts = [];
  for (let j = 1; j < k; j++) cuts.push(s[Math.floor(j * s.length / k)]);
  const uniq = [...new Set(cuts)], edges = [s[0], ...uniq, s[s.length - 1]];
  const lab = i => i === 0 ? `≤ ${+edges[1].toPrecision(4)}` : i === edges.length - 2 ? `> ${+edges[i].toPrecision(4)}` : `(${+edges[i].toPrecision(4)}, ${+edges[i + 1].toPrecision(4)}]`;
  const labels = edges.slice(0, -1).map((_, i) => lab(i));
  return { labels, map: v => { const x = Number(v); let i = 0; while (i < uniq.length && x > uniq[i]) i++; return labels[i]; } };
}
function tableFromPairs(pairs, opts = {}) {
  let xs = pairs.map(p => String(p[0]).trim()), fs = pairs.map(p => String(p[1]).trim()), notes = [];
  const maxCat = opts.maxCat || 12;
  const fix = (arr, name, given) => {
    const d = [...new Set(arr)];
    if (given) return { arr, order: given.filter(v => d.includes(v)) };
    if (d.length > maxCat && d.every(v => v !== "" && isFinite(Number(v)))) { const b = quantileBins(arr, 5); notes.push(`${name} has ${d.length} distinct numeric values: grouped into ${b.labels.length} equal-frequency classes.`); return { arr: arr.map(b.map), order: b.labels }; }
    return { arr, order: naturalSort(d) };
  };
  const X = fix(xs, "X", opts.rowOrder), Fv = fix(fs, "F", opts.colOrder);
  const rows = X.order, cols = Fv.order, ri = new Map(rows.map((v, i) => [v, i])), ci = new Map(cols.map((v, i) => [v, i]));
  const O = rows.map(() => cols.map(() => 0));
  for (let i = 0; i < pairs.length; i++) O[ri.get(X.arr[i])][ci.get(Fv.arr[i])]++;
  return { O, rows, cols, notes };
}
function pairsFromTable(O, rows, cols, seed = 1) {
  const out = [], rand = rng(seed);
  O.forEach((r, i) => r.forEach((c, j) => { for (let k = 0; k < c; k++) out.push([rows[i], cols[j]]); }));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function dropEmpty(T) {                          // remove rows / columns with zero total (they carry no information)
  const rs = T.O.map(r => r.reduce((a, b) => a + b, 0)), cs = T.cols.map((_, j) => T.O.reduce((a, r) => a + r[j], 0));
  const ri = rs.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0), ci = cs.map((v, j) => v > 0 ? j : -1).filter(j => j >= 0);
  return { O: ri.map(i => ci.map(j => T.O[i][j])), rows: ri.map(i => T.rows[i]), cols: ci.map(j => T.cols[j]), notes: T.notes || [] };
}

/* ---------- Fisher's exact test for a 2x2 table (two-sided: sum of all tables at most as likely as the observed one) ---------- */
const lfact = n => lgamma(n + 1);
function fisher2x2(a, b, c, d) {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const logp = x => lfact(r1) + lfact(r2) + lfact(c1) + lfact(n - c1) - lfact(n) - lfact(x) - lfact(r1 - x) - lfact(c1 - x) - lfact(r2 - c1 + x);
  const lo = Math.max(0, c1 - r2), hi = Math.min(r1, c1), p0 = logp(a); let p = 0;
  for (let x = lo; x <= hi; x++) { const lp = logp(x); if (lp <= p0 + 1e-7) p += Math.exp(lp); }
  return Math.min(1, p);
}

/* ---------- the analysis ---------- */
function analyse(T) {
  const O = T.O, r = O.length, c = O[0].length;
  const rowTot = O.map(row => row.reduce((a, b) => a + b, 0)), colTot = O[0].map((_, j) => O.reduce((a, row) => a + row[j], 0)), n = rowTot.reduce((a, b) => a + b, 0);
  const E = O.map((row, i) => row.map((_, j) => rowTot[i] * colTot[j] / n));
  const contrib = O.map((row, i) => row.map((o, j) => (o - E[i][j]) ** 2 / E[i][j]));
  const resid = O.map((row, i) => row.map((o, j) => (o - E[i][j]) / Math.sqrt(E[i][j])));
  const adj = O.map((row, i) => row.map((o, j) => (o - E[i][j]) / Math.sqrt(E[i][j] * (1 - rowTot[i] / n) * (1 - colTot[j] / n))));
  const chi2 = contrib.flat().reduce((a, b) => a + b, 0), df = (r - 1) * (c - 1), p = chi2sf(chi2, df);
  let G = 0; O.forEach((row, i) => row.forEach((o, j) => { if (o > 0) G += 2 * o * Math.log(o / E[i][j]); }));
  const k = Math.min(r, c) - 1, V = Math.sqrt(chi2 / (n * k)), Cc = Math.sqrt(chi2 / (chi2 + n));
  const minE = Math.min(...E.flat()), lowFrac = E.flat().filter(e => e < 5).length / (r * c);
  const out = { O, rows: T.rows, cols: T.cols, r, c, n, rowTot, colTot, E, contrib, resid, adj, chi2, df, p, G, pG: chi2sf(G, df), V, C: Cc, k, minE, lowFrac,
    joint: O.map(row => row.map(o => o / n)), fRow: rowTot.map(v => v / n), fCol: colTot.map(v => v / n),
    condF: O.map((row, i) => row.map(o => o / rowTot[i])), condX: O.map((row, i) => row.map((o, j) => o / colTot[j])) };
  if (r === 2 && c === 2) {
    out.phi = (O[0][0] * O[1][1] - O[0][1] * O[1][0]) / Math.sqrt(rowTot[0] * rowTot[1] * colTot[0] * colTot[1]);
    out.chi2Y = O.flat().reduce((a, o, idx) => { const i = idx >> 1, j = idx & 1, d = Math.max(0, Math.abs(o - E[i][j]) - 0.5); return a + d * d / E[i][j]; }, 0);
    out.pY = chi2sf(out.chi2Y, 1); out.pFisher = fisher2x2(O[0][0], O[0][1], O[1][0], O[1][1]);
    out.oddsRatio = (O[0][0] * O[1][1]) / (O[0][1] * O[1][0]);
  }
  return out;
}
function chi2OfCounts(O, rowTot, colTot, n) {
  let s = 0; for (let i = 0; i < O.length; i++) for (let j = 0; j < O[0].length; j++) { const e = rowTot[i] * colTot[j] / n; s += (O[i][j] - e) ** 2 / e; } return s;
}
/* permutation test: shuffle the F labels, keeping X and the marginal totals fixed */
function permutationTest(A, B, seed) {
  const n = A.n, r = A.r, c = A.c, rows = new Int32Array(n), cols = new Int32Array(n); let q = 0;
  A.O.forEach((row, i) => row.forEach((cnt, j) => { for (let k = 0; k < cnt; k++) { rows[q] = i; cols[q] = j; q++; } }));
  const rand = rng(seed), vals = new Float64Array(B), O = Array.from({ length: r }, () => new Array(c).fill(0));
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)), t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
    for (let i = 0; i < r; i++) O[i].fill(0);
    for (let i = 0; i < n; i++) O[rows[i]][cols[i]]++;
    const v = chi2OfCounts(O, A.rowTot, A.colTot, n); vals[b] = v; if (v >= A.chi2 - 1e-9) ge++;
  }
  return { vals, p: (ge + 1) / (B + 1), B };
}

/* ---------- built-in datasets (counts are expanded into individual records by the page) ---------- */
const DATASETS = {
  hair: { name: "Hair colour × eye colour (592 students)", X: "Hair colour", F: "Eye colour",
    rows: ["Black", "Brown", "Red", "Blond"], cols: ["Brown", "Blue", "Hazel", "Green"], O: [[68, 20, 15, 5], [119, 84, 54, 29], [26, 17, 14, 14], [7, 94, 10, 16]],
    desc: "Snee (1974): statistics students at the University of Delaware, sexes combined. Built into R as <code>HairEyeColor</code>." },
  titanic: { name: "Passenger class × survival, Titanic (2,201 people)", X: "Class", F: "Survival",
    rows: ["1st", "2nd", "3rd", "Crew"], cols: ["Died", "Survived"], O: [[122, 203], [167, 118], [528, 178], [673, 212]],
    desc: "All 2,201 people on board (passengers and crew); counts from the British Board of Trade inquiry, as in R's <code>Titanic</code> table (marginalised over sex and age)." },
  berkeley: { name: "Gender × admission, UC Berkeley 1973 (4,526 applicants)", X: "Gender", F: "Admission",
    rows: ["Male", "Female"], cols: ["Admitted", "Rejected"], O: [[1198, 1493], [557, 1278]],
    strata: { name: "Department", labels: ["A", "B", "C", "D", "E", "F"], O: [[[512, 313], [89, 19]], [[353, 207], [17, 8]], [[120, 205], [202, 391]], [[138, 279], [131, 244]], [[53, 138], [94, 299]], [[22, 351], [24, 317]]] },
    desc: "Graduate applications to the six largest departments of UC Berkeley in autumn 1973 (Bickel, Hammel, O'Connell, 1975; R's <code>UCBAdmissions</code>). A classic case of Simpson's paradox: see the stratified analysis in Section 6." }
};
/* simulated data: F depends on X with a tunable strength s (s = 0: independent) */
function simulate(n, s, seed) {
  const rand = rng(seed), P = [0.30, 0.40, 0.50], pairs = [];     // base P(F = high | X) = 0.4 + s * shift
  for (let i = 0; i < n; i++) { const x = Math.floor(rand() * 3), p = 0.4 + s * (x - 1) * 0.25; pairs.push(["X" + (x + 1), rand() < p ? "high" : "low"]); }
  return pairs;
}

if (typeof module !== "undefined") module.exports = { lgamma, chi2sf, chi2pdf, chi2crit, rng, tableFromPairs, pairsFromTable, dropEmpty, fisher2x2, analyse, permutationTest, DATASETS, simulate, naturalSort };
