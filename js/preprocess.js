// 服画像の前処理：背景除去 → 最大領域抽出 → 切り抜き → 左右中心合わせ
const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
});
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };

function floodOutside(w, h, isFg) {
  const out = new Uint8Array(w * h), st = new Int32Array(w * h);
  let sp = 0;
  const push = (i) => { if (!out[i] && !isFg[i]) { out[i] = 1; st[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = st[--sp], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return out;
}

function largest(mask, w, h) {
  const lab = new Int32Array(w * h), st = new Int32Array(w * h);
  let n = 0, best = 0, bestN = 0;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || lab[s]) continue;
    n++; let sp = 0, cnt = 0; st[sp++] = s; lab[s] = n;
    while (sp) {
      const i = st[--sp], x = i % w, y = (i / w) | 0; cnt++;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && mask[j] && !lab[j]) { lab[j] = n; st[sp++] = j; }
      }
    }
    if (cnt > bestN) { bestN = cnt; best = n; }
  }
  return Uint8Array.from(lab, (v) => (v === best ? 1 : 0));
}

function erode(m, w, h) {
  const o = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    o[i] = m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w] ? 1 : 0;
  }
  return o;
}

/** @returns {canvas, dataUrl} 背景透過・切り抜き・左右中心合わせ済みの画像 */
export async function processGarmentImage(file, tol = 40, maxSize = 360) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  const r = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * r), h = Math.round(img.height * r);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;

  // 1) 背景色＝画像の四辺の中央値
  const edge = [];
  for (let x = 0; x < w; x++) edge.push((x) * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y++) edge.push(y * w * 4, (y * w + w - 1) * 4);
  const bg = [0, 1, 2].map((c) => median(edge.map((i) => d[i + c])));

  // 2) 背景色から離れた画素＝服。外側から塗りつぶして背景を確定
  const isFg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const dr = d[i * 4] - bg[0], dg = d[i * 4 + 1] - bg[1], db = d[i * 4 + 2] - bg[2];
    isFg[i] = Math.sqrt(dr * dr + dg * dg + db * db) > tol ? 1 : 0;
  }
  const outside = floodOutside(w, h, isFg);
  let mask = Uint8Array.from(outside, (v) => (v ? 0 : 1));
  mask = erode(largest(mask, w, h), w, h); // 3) 最大領域のみ＋縁の1px除去

  // 4) 外接矩形と左右中心
  let x0 = w, x1 = 0, y0 = h, y1 = 0; const centers = [];
  for (let y = 0; y < h; y++) {
    let mn = w, mx = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < mn) mn = x; mx = x; }
    if (mx >= 0) { centers.push((mn + mx) / 2); x0 = Math.min(x0, mn); x1 = Math.max(x1, mx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (!centers.length) throw new Error('服を検出できませんでした。背景を無地にして撮影してください。');
  const cx = median(centers);
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = mask[i] ? 255 : 0;
  ctx.putImageData(im, 0, 0);

  // 5) 切り抜き＋左右対称の中心に合わせたキャンバスへ
  const half = Math.ceil(Math.max(cx - x0, x1 - cx)) + 1, bh = y1 - y0 + 1;
  const out = document.createElement('canvas'); out.width = half * 2; out.height = bh;
  out.getContext('2d').drawImage(cv, x0, y0, x1 - x0 + 1, bh, half - (cx - x0), 0, x1 - x0 + 1, bh);
  return { canvas: out, dataUrl: out.toDataURL('image/webp', 0.85) };
}
