// 视觉验证：复现 CurveChart 平滑化后的几何（与组件同源算法）
const w = 340, h = 150, pad = 26;
// 与截图同源：+0.25kg/周 × 284 周，起点 60
const curve = [];
for (let wk = 0; wk <= 284; wk++) curve.push({ week: wk, weightKg: 60 + 0.25 * wk });
curve.push({ week: 284, weightKg: 131 });
const sampled = curve.length > 40 ? curve.filter((_, i) => i % Math.ceil(curve.length / 40) === 0 || i === curve.length - 1) : curve;
const xs = sampled.map(p => p.week), ys = sampled.map(p => p.weightKg);
const minX = Math.min(...xs), maxX = Math.max(...xs, minX + 1);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const spanY = Math.max(maxY - minY, 0.5);
const px = wk => pad + ((wk - minX) / (maxX - minX)) * (w - pad * 2);
const py = kg => h - pad - ((kg - (minY - 0.5)) / (spanY + 1)) * (h - pad * 2);

function smoothPath(pts) {
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
const pts = sampled.map(p => ({ x: px(p.week), y: py(p.weightKg) }));
const d = smoothPath(pts);
const xN = pts[pts.length - 1].x, x0 = pts[0].x;
const area = `${d} L ${xN.toFixed(1)} ${h - pad} L ${x0.toFixed(1)} ${h - pad} Z`;
const step = Math.max(1, Math.floor((maxX - minX) / 5));
const marks = sampled.filter(p => p.week === maxX || (p.week % step === 0 && maxX - p.week >= step / 2));

let labels = "";
for (const m of marks) {
  const isLast = m.week === maxX;
  labels += `<circle cx='${px(m.week)}' cy='${py(m.weightKg)}' r='4' fill='white' stroke='#1a1a1a' stroke-width='2'/>`;
  if (!isLast) labels += `<text x='${px(m.week)}' y='${py(m.weightKg) - 8}' font-size='10' text-anchor='middle' fill='#666'>${m.weightKg.toFixed(0)}</text>`;
}
const html = `<!doctype html><meta charset='utf-8'><body style='margin:20px;background:#fffaf2;font-family:sans-serif'>
<div style='border:2px solid #333;border-radius:8px;padding:16px;max-width:420px'>
<div style='font-weight:bold'>体重预测曲线</div>
<div style='font-size:12px;color:#666'>起点 ${ys[0].toFixed(1)} kg &nbsp;&nbsp; <span style='color:#c0392b;font-weight:bold'>目标 ${ys[ys.length - 1].toFixed(1)} kg</span></div>
<svg viewBox='0 0 ${w} ${h}' width='100%'>
<path d='${area}' fill='#dbe7f5' opacity='0.45'/>
<path d='${d}' fill='none' stroke='#5b8fc9' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
${labels}
<text x='${pad}' y='${h - 6}' font-size='11' fill='#666'>第 ${minX} 周</text>
<text x='${w - pad}' y='${h - 6}' font-size='11' text-anchor='end' fill='#666'>第 ${maxX} 周（展示第一年）</text>
</svg>
<div style='font-size:12px'>计划速率：<span style='background:#fde9a9'>+0.25 kg/周</span></div>
</div>`;
require("fs").writeFileSync("C:/Users/lxtoa/AppData/Local/Temp/curve-test.html", html);
console.log("marks:", marks.map(m => m.week).join(","), "| 终点:", maxX, "| 采样点:", sampled.length);
