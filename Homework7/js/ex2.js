"use strict";
const f3 = x => Number.isFinite(x) ? (+x.toPrecision(3)).toString() : "—";
const f4 = x => Number.isFinite(x) ? (+x.toPrecision(4)).toString() : "—";
const pc = x => (100 * x).toFixed(x < 0.1 ? 2 : 1) + "%";
const COLS = [COL.B, COL.R, COL.G, COL.P, COL.Y, COL.W];
const PRIORS = [{ name: "Uniform Beta(1, 1)", a: 1, b: 1 }, { name: "Jeffreys Beta(½, ½)", a: 0.5, b: 0.5 }, { name: "Weakly informative Beta(2, 2)", a: 2, b: 2 }, { name: "Skeptical, concentrated Beta(20, 20)", a: 20, b: 20 }, { name: "Dogmatic, low Beta(2, 30)", a: 2, b: 30 }];
let wSeed = 2327983;

/* ---------------- 1-2. diagnostic test ---------------- */
function runDiag() {
  const prev = Math.min(0.99, Math.max(1e-4, +$("prev").value / 100)), se = Math.min(0.999, Math.max(0.01, +$("sens").value / 100)), sp = Math.min(0.999, Math.max(0.01, +$("spec").value / 100)), N = 10000;
  const TP = N * prev * se, FN = N * prev * (1 - se), FP = N * (1 - prev) * (1 - sp), TN = N * (1 - prev) * sp;
  const ppv = TP / (TP + FP), npv = TN / (TN + FN), lrp = se / (1 - sp), lrm = (1 - se) / sp, odds0 = prev / (1 - prev), odds1 = odds0 * lrp;
  $("dKpis").innerHTML = `<div class="kpi"><div class="k">Prior P(D)</div><div class="v">${pc(prev)}</div></div><div class="kpi"><div class="k">Likelihood P(+ | D)</div><div class="v">${pc(se)}</div></div><div class="kpi"><div class="k">Evidence P(+)</div><div class="v">${pc((TP + FP) / N)}</div></div><div class="kpi ${ppv > 0.5 ? "good" : "bad"}"><div class="k">Posterior P(D | +)</div><div class="v">${pc(ppv)}</div></div><div class="kpi"><div class="k">P(D | −)</div><div class="v">${pc(1 - npv)}</div></div><div class="kpi"><div class="k">Likelihood ratio LR+</div><div class="v">${f3(lrp)}</div></div>`;
  $("dTab").innerHTML = `<tr><th>Out of ${fmtN(N)} people</th><th>Test positive</th><th>Test negative</th><th>Total</th></tr><tr><td>Ill</td><td class="n">${f3(TP)}</td><td class="n">${f3(FN)}</td><td class="n">${f3(TP + FN)}</td></tr><tr><td>Healthy</td><td class="n">${f3(FP)}</td><td class="n">${f3(TN)}</td><td class="n">${f3(FP + TN)}</td></tr><tr><td>Total</td><td class="n">${f3(TP + FP)}</td><td class="n">${f3(FN + TN)}</td><td class="n">${fmtN(N)}</td></tr><tr><td colspan="4" style="padding-top:12px">Bayes: P(D | +) = P(+ | D)P(D)/P(+) = ${f3(se)} &times; ${f3(prev)} / ${f3((TP + FP) / N)} = <b>${f3(ppv)}</b>. In odds: prior odds ${f3(odds0)} &times; LR<sub>+</sub> ${f3(lrp)} = posterior odds ${f3(odds1)} (probability ${f3(odds1 / (1 + odds1))}). Of the ${f3(TP + FP)} positives, ${f3(FP)} are false alarms.</td></tr>`;
  // area diagram
  const svg = $("svgD1"), W = 520, H = 330, l = 14, r = 14, t = 28, b = 46, pw = W - l - r, ph = H - t - b, gap = 4, wD = Math.max(pw * prev, 2), wH = pw - wD - gap;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const rect = (x, y, w, h, c, lab) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(w, 0.5).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" fill="${c}" stroke="#0e1822" stroke-width="1.5"/>` + (lab && w > 60 && h > 18 ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 4).toFixed(1)}" font-size="12" font-weight="700" text-anchor="middle" fill="#0b1520">${lab}</text>` : "");
  let s = `<text class="tx2" x="${l}" y="18" font-size="14" font-weight="700">Population: status × test result</text>`;
  s += rect(l, t, wD, ph * se, COL.G, "") + rect(l, t + ph * se, wD, ph * (1 - se), "#5f7388", "");
  s += rect(l + wD + gap, t, wH, ph * (1 - sp), COL.R, `${f3(FP)}`) + rect(l + wD + gap, t + ph * (1 - sp), wH, ph * sp, "#5f7388", `${f3(TN)}`);
  s += `<text class="tx" x="${l}" y="${H - b + 17}" font-size="12">ill: ${pc(prev)} (width)</text><text class="tx" x="${W - r}" y="${H - b + 17}" font-size="12" text-anchor="end">healthy: ${pc(1 - prev)}</text>`;
  s += `<rect x="${l}" y="${H - 22}" width="12" height="12" fill="${COL.G}"/><text class="tx" x="${l + 17}" y="${H - 12}" font-size="12">true positive (${f3(TP)})</text><rect x="${l + 170}" y="${H - 22}" width="12" height="12" fill="${COL.R}"/><text class="tx" x="${l + 187}" y="${H - 12}" font-size="12">false positive</text><rect x="${l + 310}" y="${H - 22}" width="12" height="12" fill="#5f7388"/><text class="tx" x="${l + 327}" y="${H - 12}" font-size="12">negative results</text>`;
  s += `<text class="tx2" x="${l + wD + 8}" y="${t + ph * se + 14}" font-size="11.5" ${wD > pw * 0.5 ? "" : 'style="display:none"'}></text>`;
  svg.innerHTML = s;
  const xs = Array.from({ length: 80 }, (_, i) => Math.pow(10, -4 + 4 * i / 79 * 0.9999)), pp = p => p * se / (p * se + (1 - p) * (1 - sp)), pn = p => p * (1 - se) / (p * (1 - se) + (1 - p) * sp);
  chart($("svgD2"), { series: [{ name: "P(D | +)", color: COL.G, width: 2.6, pts: xs.map(p => [p, pp(p)]) }, { name: "P(D | −)", color: COL.R, width: 2.2, dash: "5 4", pts: xs.map(p => [p, pn(p)]) }, { name: "your prevalence", color: COL.Y, marker: true, pts: [[prev, ppv]] }], xlog: true, xmin: 1e-4, xmax: 1, ymin: 0, ymax: 1, xlabel: "prevalence P(D) (log scale)", ylabel: "posterior probability", perRow: 3, H: 330 });
  // sequential updating
  const ks = Array.from({ length: 9 }, (_, k) => k), post = ks.map(k => { const o = odds0 * Math.pow(lrp, k); return o / (1 + o); });
  $("sTab").innerHTML = `<tr><th>Positive results k</th><th>Posterior odds = prior odds × LR+<sup>k</sup></th><th>P(D | k positives)</th></tr>` + ks.map(k => `<tr><td class="m">${k}</td><td class="n">${f3(odds0 * Math.pow(lrp, k))}</td><td class="n">${pc(post[k])}</td></tr>`).join("");
  chart($("svgS"), { series: [{ name: "P(D | k positive tests)", color: COL.B, marker: true, pts: ks.map(k => [k, post[k]]) }], xmin: 0, xmax: 8, ymin: 0, ymax: 1, xlabel: "number of positive tests k", ylabel: "posterior probability", perRow: 1, H: 280 });
}

/* ---------------- 3. Beta-Binomial ---------------- */
function initSelects() {
  $("bp").innerHTML = PRIORS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("") + `<option value="custom">Custom Beta(a, b)</option>`; $("bp").value = "2";
}
function bbInputs() {
  const n = Math.max(1, Math.min(100000, Math.round(+$("bn").value) || 1)), x = Math.max(0, Math.min(n, Math.round(+$("bx").value) || 0)), v = $("bp").value;
  const pr = v === "custom" ? { name: "Custom", a: Math.max(0.05, +$("ba").value || 1), b: Math.max(0.05, +$("bb").value || 1) } : PRIORS[+v];
  return { n, x, pr, th0: Math.min(1, Math.max(0, +$("bt").value || 0.5)) };
}
function runBeta() {
  const { n, x, pr, th0 } = bbInputs(), a1 = pr.a + x, b1 = pr.b + n - x, S = betaSummary(a1, b1), wil = wilson(x, n), mle = x / n, w = (pr.a + pr.b) / (pr.a + pr.b + n);
  const G = Array.from({ length: 400 }, (_, i) => (i + 0.5) / 400), lik = G.map(t => betaPdf(t, x + 1, n - x + 1)), post = G.map(t => betaPdf(t, a1, b1)), prior = G.map(t => betaPdf(t, pr.a, pr.b));
  const ymax = Math.max(...lik, ...post) * 1.2;
  chart($("svgB1"), { series: [{ name: `prior Beta(${f3(pr.a)}, ${f3(pr.b)})`, color: COL.R, dash: "6 4", width: 2.2, pts: G.map((t, i) => [t, prior[i]]) }, { name: "likelihood (rescaled to area 1)", color: COL.G, width: 2.2, pts: G.map((t, i) => [t, lik[i]]) }, { name: `posterior Beta(${f3(a1)}, ${f3(b1)})`, color: COL.B, width: 3, pts: G.map((t, i) => [t, post[i]]) }], xmin: 0, xmax: 1, ymin: 0, ymax, xlabel: "θ", ylabel: "density", perRow: 1, H: 330 });
  const pAbove = 1 - betainc(th0, a1, b1);
  $("bTab").innerHTML = `<tr><th>Quantity</th><th>Value</th></tr>
   <tr><td>Prior mean a/(a+b)</td><td class="n">${f4(pr.a / (pr.a + pr.b))}</td></tr>
   <tr><td>Maximum-likelihood estimate x/n</td><td class="n">${f4(mle)}</td></tr>
   <tr><td>Posterior mean (a+x)/(a+b+n)</td><td class="n"><b>${f4(S.mean)}</b></td></tr>
   <tr><td>Posterior mode (MAP)</td><td class="n">${f4(S.mode)}</td></tr>
   <tr><td>Posterior standard deviation</td><td class="n">${f4(S.sd)}</td></tr>
   <tr><td><b>95% credible interval</b> (equal-tailed)</td><td class="n">[${f4(S.lo)}, ${f4(S.hi)}]</td></tr>
   <tr><td>95% Wilson confidence interval (frequentist)</td><td class="n">[${f4(wil[0])}, ${f4(wil[1])}]</td></tr>
   <tr><td>P(θ &gt; ${f3(th0)} | data)</td><td class="n"><b>${f4(pAbove)}</b></td></tr>`;
  $("bNote").innerHTML = `The prior carries the weight of ${f3(pr.a + pr.b)} pseudo-observations against ${n} real ones: the posterior mean is ${pc(w)} prior mean (${f4(pr.a / (pr.a + pr.b))}) and ${pc(1 - w)} data (${f4(mle)}). The posterior is narrower than the prior and than the likelihood alone: combining the two sources of information reduces uncertainty. The credible interval answers &ldquo;where is &theta; with 95% probability, given the data and the prior&rdquo;; the Wilson interval is a statement about the procedure.`;
  runPrior();
}
function runPrior() {
  const { n, x, th0 } = bbInputs(), G = Array.from({ length: 400 }, (_, i) => (i + 0.5) / 400);
  const ser = PRIORS.map((p, i) => ({ name: p.name, color: COLS[i], width: 2.4, pts: G.map(t => [t, betaPdf(t, p.a + x, p.b + n - x)]) })), top = Math.max(...ser.flatMap(s => s.pts.map(q => q[1])));
  chart($("svgP1"), { series: ser, xmin: 0, xmax: 1, ymin: 0, ymax: top * 1.12, xlabel: "θ", ylabel: "posterior density", perRow: 1, H: 380 });
  $("pTab").innerHTML = `<tr><th>Prior</th><th>Posterior mean</th><th>95% credible interval</th><th>P(θ &gt; ${f3(th0)})</th></tr>` + PRIORS.map(p => { const a = p.a + x, b = p.b + n - x, S = betaSummary(a, b); return `<tr><td>${p.name}</td><td class="n">${f3(S.mean)}</td><td class="n">[${f3(S.lo)}, ${f3(S.hi)}]</td><td class="n">${f3(1 - betainc(th0, a, b))}</td></tr>`; }).join("") + `<tr><td>data only: x/n = ${f3(x / n)}</td><td colspan="3" style="white-space:normal;font-family:inherit">With n = ${n} observations ${n < 50 ? "the priors disagree noticeably" : "the priors agree closely"}.</td></tr>`;
}

/* ---------------- 4. wash-out ---------------- */
function newWash() { wSeed = (wSeed + 7919) >>> 0; runWash(); }
function runWash() {
  const th = Math.min(0.99, Math.max(0.01, +$("wt").value || 0.7)), N = Math.max(20, Math.min(5000, +$("wN").value || 500)), path = bernoulliPath(th, N, wSeed), ns = denseNs(N, 70);
  const cum = new Float64Array(N + 1); for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + path[i];
  const ser = PRIORS.map((p, i) => ({ name: p.name, color: COLS[i], width: 2.2, pts: ns.map(n => [n, (p.a + cum[n]) / (p.a + p.b + n)]) }));
  ser.push({ name: "frequentist x/n", color: COL.W, dash: "4 4", width: 1.4, opacity: .8, pts: ns.map(n => [n, cum[n] / n]) });
  chart($("svgW"), { series: ser, hlines: [{ y: th, color: COL.Y, dash: "6 4" }], xlog: true, xmin: 1, xmax: N, ymin: 0, ymax: 1, xlabel: "number of observations n", ylabel: "posterior mean", perRow: 1, H: 400 });
  const at = [10, 50, Math.min(N, 500), N].filter((v, i, a) => a.indexOf(v) === i && v <= N);
  $("wFinds").innerHTML = `<b>Posterior mean after n observations (true θ = ${th})</b><div class="tblwrap"><table class="res"><tr><th>Prior</th>${at.map(n => `<th>n = ${n}</th>`).join("")}</tr>${PRIORS.map(p => `<tr><td>${p.name}</td>${at.map(n => `<td class="n">${f3((p.a + cum[n]) / (p.a + p.b + n))}</td>`).join("")}</tr>`).join("")}<tr><td>x/n</td>${at.map(n => `<td class="n">${f3(cum[n] / n)}</td>`).join("")}</tr></table></div><ul class="plain"><li>For small n the five analyses give different answers: the prior matters.</li><li>As n grows the data term n·x̄ dominates the pseudo-counts a, b and all posterior means approach the same value (and the truth): the likelihood washes out the prior. The speed depends on how concentrated, and how wrong, the prior is.</li></ul>`;
}

/* ---------------- 5. Normal-Normal ---------------- */
function runNormal() {
  const m0 = +$("m0").value || 0, tau = Math.max(0.01, +$("tau").value || 1), sg = Math.max(0.01, +$("sg").value || 1), xb = +$("xb").value || 0, n = Math.max(1, Math.round(+$("nn").value) || 1);
  const pP = 1 / (tau * tau), pD = n / (sg * sg), pN = pP + pD, mn = (m0 * pP + xb * pD) / pN, sdN = Math.sqrt(1 / pN), sdD = sg / Math.sqrt(n), w = pP / pN;
  const lo = Math.min(m0 - 3.5 * tau, xb - 3.5 * sdD, mn - 3.5 * sdN), hi = Math.max(m0 + 3.5 * tau, xb + 3.5 * sdD, mn + 3.5 * sdN), G = Array.from({ length: 300 }, (_, i) => lo + (hi - lo) * i / 299);
  const nd = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const top = Math.max(1 / (sdN * 2.5066), 1 / (sdD * 2.5066), 1 / (tau * 2.5066)) * 1.15;
  chart($("svgN"), { series: [{ name: `prior N(${f3(m0)}, ${f3(tau)}²)`, color: COL.R, dash: "6 4", width: 2.2, pts: G.map(x => [x, nd(x, m0, tau)]) }, { name: `likelihood N(${f3(xb)}, ${f3(sdD)}²)`, color: COL.G, width: 2.2, pts: G.map(x => [x, nd(x, xb, sdD)]) }, { name: `posterior N(${f3(mn)}, ${f3(sdN)}²)`, color: COL.B, width: 3, pts: G.map(x => [x, nd(x, mn, sdN)]) }], xmin: lo, xmax: hi, ymin: 0, ymax: top, xlabel: "θ", ylabel: "density", perRow: 1, H: 330 });
  $("nTab").innerHTML = `<tr><th>Quantity</th><th>Value</th></tr><tr><td>Prior precision 1/τ²</td><td class="n">${f4(pP)}</td></tr><tr><td>Data precision n/σ²</td><td class="n">${f4(pD)}</td></tr><tr><td>Weight of the prior w = prior precision / total</td><td class="n">${pc(w)}</td></tr><tr><td>Posterior mean</td><td class="n"><b>${f4(mn)}</b></td></tr><tr><td>Posterior sd</td><td class="n">${f4(sdN)}</td></tr><tr><td><b>95% credible interval</b></td><td class="n">[${f4(mn - 1.959964 * sdN)}, ${f4(mn + 1.959964 * sdN)}]</td></tr><tr><td>95% confidence interval x̄ ± 1.96σ/√n</td><td class="n">[${f4(xb - 1.959964 * sdD)}, ${f4(xb + 1.959964 * sdD)}]</td></tr>`;
  $("nNote").innerHTML = `The posterior mean ${f3(mn)} lies between the prior mean ${f3(m0)} and the sample mean ${f3(xb)}, ${pc(w)} of the way towards the prior. Increase n (or &tau;) and the posterior moves to x&#772; and its interval to the confidence interval; reduce &tau; and the prior dominates.`;
}
initSelects(); runDiag(); runBeta(); runWash(); runNormal();
