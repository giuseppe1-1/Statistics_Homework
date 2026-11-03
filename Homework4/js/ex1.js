"use strict";
const $ = id => document.getElementById(id);
function parseNums(s) { return s.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite); }
const f6 = x => Number.isFinite(x) ? (+x.toPrecision(10)).toString() : "—";
function copyCode(id, btn) {
  const t = $(id).innerText.replace(/^Copy\n?/, "");
  const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy", 1400); };
  try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); }
}
function runDemo() {
  const xs = parseNums($("dataIn").value).slice(0, 200);
  if (!xs.length) { $("traceTab").innerHTML = "<tr><td>Enter at least one number.</td></tr>"; $("cmpTab").innerHTML = ""; return; }
  let k = 0, mean = 0, ss = 0, h = `<tr><th>k</th><th>x<sub>k</sub></th><th>δ<sub>k</sub> = x<sub>k</sub> − M<sub>k−1</sub></th><th>M<sub>k</sub></th><th>x<sub>k</sub> − M<sub>k</sub></th><th>SS<sub>k</sub></th><th>s<sub>k</sub>² = SS<sub>k</sub>/(k−1)</th><th>v<sub>k</sub> = SS<sub>k</sub>/k</th></tr>`;
  for (const x of xs) {
    k++;
    const d = x - mean;
    mean += d / k;
    ss += d * (x - mean);
    h += `<tr><td class="m">${k}</td><td class="n">${f6(x)}</td><td class="n">${f6(d)}</td><td class="n">${f6(mean)}</td><td class="n">${f6(x - mean)}</td><td class="n">${f6(ss)}</td><td class="n">${k > 1 ? f6(ss / (k - 1)) : "—"}</td><td class="n">${f6(ss / k)}</td></tr>`;
  }
  $("traceTab").innerHTML = h;
  const w = welford(xs), t = twoPass(xs), nv = naiveFormula(xs);
  const row = (name, r) => `<tr><td>${name}</td><td class="n">${f6(r.mean)}</td><td class="n">${f6(r.ss)}</td><td class="n">${f6(r.variance)}</td><td class="n">${f6(r.popVariance)}</td></tr>`;
  $("cmpTab").innerHTML = `<tr><th>Method (n = ${xs.length})</th><th>Mean</th><th>SS</th><th>Sample variance</th><th>Population variance</th></tr>` + row("Welford (the table above)", w) + row("Two-pass (reference)", t) + row("Naive sums of squares", nv);
}
function runStab() {
  const xs = parseNums($("stabIn").value).slice(0, 100), c = +$("offIn").value;
  if (xs.length < 2) { $("stabTab").innerHTML = "<tr><td>Enter at least two numbers.</td></tr>"; return; }
  const sh = xs.map(x => x + c), exact = twoPass(xs).variance;
  const rows = [["Welford", welford(sh).variance], ["Two-pass", twoPass(sh).variance], ["Naive sums of squares", naiveFormula(sh).variance]];
  let h = `<tr><th>Method (values + ${c.toExponential(0).replace("e+", "·10^")})</th><th>Sample variance</th><th>Exact</th><th>Relative error</th></tr>`;
  rows.forEach(([n, v]) => { const err = Math.abs(v - exact) / Math.abs(exact); h += `<tr><td>${n}</td><td class="n">${f6(v)}</td><td class="th">${f6(exact)}</td><td class="n" style="color:${err > 1e-6 ? "var(--warn)" : "var(--ok)"}">${err === 0 ? "0" : err.toExponential(2)}</td></tr>`; });
  $("stabTab").innerHTML = h;
}
runDemo(); runStab();
