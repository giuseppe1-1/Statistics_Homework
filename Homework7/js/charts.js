"use strict";
/* ===== SVG charts shared by the pages ===== */
const $ = id => document.getElementById(id);
const tick = () => new Promise(r => setTimeout(r, 0));
const COL = { B: "#4aa8ee", R: "#ffa94d", G: "#52c98f", P: "#ff7ab6", Y: "#ffd166", W: "#dbe7f1", red: "#ff6b81" };
const fmtN = v => Math.round(v).toLocaleString("en-US");
function fmtV(x) { const a = Math.abs(x); return a === 0 ? "0" : (a >= 1e5 || a < 1e-3) ? x.toExponential(3) : (+x.toPrecision(5)).toString(); }
const fmt3 = x => (+x.toFixed(3)).toString();
/* ---------- generic SVG chart (lines, markers, log axes) ---------- */
function linTicks(lo, hi, n) {
  const step0 = (hi - lo) / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
  for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + 1e-9 * step; i++) out.push(+(i * step).toPrecision(12));
  return out;
}
function tickLabel(v) { if (v === 0) return "0"; const a = Math.abs(v); return (a >= 1e5 || a < 1e-3) ? v.toExponential(0).replace("e+", "e") : String(+v.toPrecision(3)); }
const decade = e => `10<tspan dy="-5" font-size="9">${e}</tspan>`;
let uid = 0;

function chart(svg, o) {
  const W = o.W || 520, H = o.H || 300, l = o.l || 56, r = 24, b = o.xlabel ? 50 : 32;
  const named = o.series.filter(s => s.name), per = o.perRow || 2, rows = o.legend === false ? 0 : Math.ceil(named.length / per);
  const t = 12 + 19 * rows;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const fx = v => o.xlog ? Math.log10(v) : v, fy = v => o.ylog ? Math.log10(v) : v;
  const x0 = fx(o.xmin), x1 = fx(o.xmax), y0 = fy(o.ymin), y1 = fy(o.ymax);
  const px = v => l + (W - l - r) * (fx(v) - x0) / (x1 - x0), py = v => H - b - (H - b - t) * (fy(v) - y0) / (y1 - y0);
  const id = "cl" + (++uid);
  let s = `<clipPath id="${id}"><rect x="${l}" y="${t}" width="${W - l - r}" height="${H - b - t}"/></clipPath>`;
  // ticks
  const xt = o.xticks ? o.xticks.map(v => ({ v, lab: fmtN(v) })) : o.xlog
    ? Array.from({ length: Math.floor(x1) - Math.ceil(x0) + 1 }, (_, i) => Math.ceil(x0) + i).map(e => ({ v: Math.pow(10, e), lab: decade(e) }))
    : linTicks(o.xmin, o.xmax, 6).map(v => ({ v, lab: tickLabel(v) }));
  const yt = o.ylog
    ? Array.from({ length: Math.floor(y1) - Math.ceil(y0) + 1 }, (_, i) => Math.ceil(y0) + i).map(e => ({ v: Math.pow(10, e), lab: decade(e) }))
    : linTicks(o.ymin, o.ymax, 5).map(v => ({ v, lab: tickLabel(v) }));
  yt.forEach(k => { const y = py(k.v); s += `<line class="gr" x1="${l}" x2="${W - r}" y1="${y}" y2="${y}"/><text class="tx" x="${l - 6}" y="${y + 3.5}" font-size="12.5" text-anchor="end">${k.lab}</text>`; });
  xt.forEach(k => { const x = px(k.v); s += `<line class="gr" x1="${x}" x2="${x}" y1="${t}" y2="${H - b}" stroke-opacity=".5"/><text class="tx" x="${x}" y="${H - b + 18}" font-size="12.5" text-anchor="middle">${k.lab}</text>`; });
  s += `<line class="ax" x1="${l}" y1="${t}" x2="${l}" y2="${H - b}"/><line class="ax" x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}"/>`;
  if (o.xlabel) s += `<text class="tx2" x="${(l + W - r) / 2}" y="${H - 7}" font-size="13.5" text-anchor="middle">${o.xlabel}</text>`;
  if (o.ylabel) s += `<text class="tx2" x="13" y="${(t + H - b) / 2}" font-size="13.5" text-anchor="middle" transform="rotate(-90 13 ${(t + H - b) / 2})">${o.ylabel}</text>`;
  // series
  s += `<g clip-path="url(#${id})">`;
  (o.hlines || []).forEach(h => { const y = py(h.y); s += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="${h.color}" stroke-width="1.4" ${h.dash ? `stroke-dasharray="${h.dash}"` : ""}/>`; });
  o.series.forEach(se => {
    const dash = se.dash ? `stroke-dasharray="${se.dash}"` : "";
    let run = [];
    const flush = () => { if (run.length > 1) s += `<polyline fill="none" stroke="${se.color}" stroke-width="${se.width || 2}" stroke-opacity="${se.opacity || 1}" ${dash} stroke-linejoin="round" points="${run.join(" ")}"/>`; run = []; };
    se.pts.forEach(p => { if (p === null || (o.ylog && p[1] < o.ymin)) { flush(); return; } run.push(px(p[0]).toFixed(1) + "," + py(p[1]).toFixed(1)); });
    flush();
    if (se.marker) se.pts.forEach(p => { if (!p || (o.ylog && p[1] < o.ymin)) return; s += p[2] === "zero" ? `<circle cx="${px(p[0])}" cy="${py(p[1])}" r="4" fill="none" stroke="${se.color}" stroke-width="1.8"/>` : `<circle cx="${px(p[0])}" cy="${py(p[1])}" r="3.6" fill="${se.color}"/>`; });
  });
  s += `</g>`;
  // legend
  const cw = (W - l - r) / per;
  named.forEach((se, k) => {
    const lx = l + 4 + (k % per) * cw, ly = 15 + Math.floor(k / per) * 19;
    s += `<line x1="${lx}" x2="${lx + 16}" y1="${ly - 4}" y2="${ly - 4}" stroke="${se.color}" stroke-width="2.4" ${se.dash ? `stroke-dasharray="${se.dash}"` : ""}/>${se.marker ? `<circle cx="${lx + 8}" cy="${ly - 4}" r="3.4" fill="${se.color}"/>` : ""}<text class="tx2" x="${lx + 21}" y="${ly}" font-size="12.5">${se.name}</text>`;
  });
  svg.innerHTML = s;
}

/* ---------- histogram with theoretical normal density ---------- */
function histChart(svg, o) {
  const W = o.W || 520, H = o.H || 280, l = 54, r = 12, t = 30, b = 38, small = W < 400, fs = small ? 11.5 : 12.5;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  let xa = Math.min(...o.bars.map(q => q.x0)), xb = Math.max(...o.bars.map(q => q.x1));
  const pad = (xb - xa) * 0.06 || 1; xa -= pad; xb += pad;
  const curve = []; if (o.pdf) for (let i = 0; i <= 160; i++) { const x = xa + (xb - xa) * i / 160; curve.push([x, o.pdf(x)]); }
  if (o.vline) { xa = Math.min(xa, o.vline.x - pad); xb = Math.max(xb, o.vline.x + pad); }
  const ymax = Math.max(...o.bars.map(q => q.d), ...curve.map(c => c[1])) * 1.12;
  const px = v => l + (W - l - r) * (v - xa) / (xb - xa), py = v => H - b - (H - b - t) * v / ymax;
  let s = "";
  linTicks(0, ymax, 4).forEach(v => { s += `<line class="gr" x1="${l}" x2="${W - r}" y1="${py(v)}" y2="${py(v)}"/><text class="tx" x="${l - 5}" y="${py(v) + 3.5}" font-size="${fs}" text-anchor="end">${tickLabel(v)}</text>`; });
  linTicks(xa, xb, small ? 4 : 6).forEach(v => { s += `<text class="tx" x="${px(v)}" y="${H - b + 17}" font-size="${fs}" text-anchor="middle">${tickLabel(v)}</text><line class="ax" x1="${px(v)}" x2="${px(v)}" y1="${H - b}" y2="${H - b + 3}"/>`; });
  o.bars.forEach(q => { s += `<rect class="bar bar${o.model}" x="${px(q.x0) + 0.4}" y="${py(q.d)}" width="${Math.max(px(q.x1) - px(q.x0) - 0.8, 0.5)}" height="${H - b - py(q.d)}"/>`; });
  if (curve.length) s += `<polyline fill="none" stroke="#ff6b81" stroke-width="2" points="${curve.map(c => px(c[0]).toFixed(1) + "," + py(c[1]).toFixed(1)).join(" ")}"/>`;
  if (o.vline) s += `<line x1="${px(o.vline.x)}" x2="${px(o.vline.x)}" y1="${t}" y2="${H - b}" stroke="#ffd166" stroke-width="2" stroke-dasharray="6 4"/>`;
  s += `<line class="ax" x1="${l}" y1="${t}" x2="${l}" y2="${H - b}"/><line class="ax" x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}"/>`;
  s += `<text class="tx2" x="${l}" y="18" font-size="${small ? 13 : 14}" font-weight="700">${o.title}</text>`;
  if (o.sub) s += `<text class="tx" x="${W - r}" y="18" font-size="${fs}" text-anchor="end">${o.sub}</text>`;
  if (o.xlabel) s += `<text class="tx" x="${(l + W - r) / 2}" y="${H - 5}" font-size="11" text-anchor="middle">${o.xlabel}</text>`;
  svg.innerHTML = s;
}

