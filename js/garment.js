// 前・後ろ2枚の画像から、マネキンに合わせた立体の服を作る
import * as THREE from 'three';
import { bodyAt, perimeter, BODY } from './body.js';

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
});
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const SLEEVE_ANGLE = 20 * Math.PI / 180; // 袖が体の側面から下に垂れる角度

function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  return c;
}

// 各行の服の幅(px)＝アルファ>128の左右端の距離
function rowWidths(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  return Array.from({ length: h }, (_, y) => {
    let mn = w, mx = -1;
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) { if (x < mn) mn = x; mx = x; }
    return mx >= 0 ? mx - mn + 1 : 0;
  });
}
const smooth = (a, k = 2) => a.map((_, i) => {
  let s = 0, n = 0;
  for (let j = i - k; j <= i + k; j++) if (a[j] !== undefined) { s += a[j]; n++; }
  return s / n;
});

export async function buildGarment(item) {
  const [fi, bi] = await Promise.all([loadImage(item.front), loadImage(item.back)]);
  const fc = toCanvas(fi), bc = toCanvas(bi);
  const H = fc.height, isTop = item.category === 'top';
  const lenM = item.lengthCm / 100;

  // 服の実寸スケール：基準帯の幅(px)＝身幅(cm)、画像の高さ(px)＝着丈(cm)
  const wpx = rowWidths(fc);
  const band = isTop ? [0.6, 0.85] : [0.05, 0.2];
  const bandW = median(wpx.slice(Math.floor(band[0] * H), Math.ceil(band[1] * H)).filter((v) => v > 0));
  const pxPerCmX = bandW / item.widthCm;
  const totalW = fc.width / pxPerCmX / 100; // 画像全体の実幅(m)
  const B = item.widthCm / 200;             // 身幅の半分(m)
  const half = smooth(wpx).map((p) => p / pxPerCmX / 200); // 各行の半幅(m)
  const yTop = isTop ? BODY.shoulderY : BODY.waistY;

  // 画像上の点(u,v)を、体の周りの3D座標へ変換
  function point(u, v, sign) {
    const x = (u - 0.5) * totalW;
    const Wt0 = half[Math.min(H - 1, Math.floor(v * H))];
    const Wt = Math.max(0.04, isTop ? Math.min(Wt0, B) : Wt0);
    const y = Math.max(0.02, yTop - v * lenM);
    const bd = bodyAt(y), k = bd.c / bd.a;
    const ag = (4 * Wt) / perimeter(1, k); // 生地の周長(=4×半幅)から楕円の大きさを逆算
    const a = Math.max(ag, bd.a * 1.04), c = Math.max(ag * k, bd.c * 1.04); // 体にめり込まない
    if (Math.abs(x) <= Wt) {
      const th = (x / Wt) * Math.PI / 2; // 前面=-90°〜+90°
      return [a * Math.sin(th), y, sign * c * Math.cos(th)];
    }
    const e = Math.abs(x) - Wt, s = Math.sign(x); // 袖：脇から腕に沿って垂らす
    return [s * (a + e * Math.sin(SLEEVE_ANGLE)), y - e * Math.cos(SLEEVE_ANGLE), sign * 0.058 * Math.min(1, e / 0.05)];
  }

  function shell(canvas, sign, flip) {
    const NX = 60, NY = 80, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY;
      pos.push(...point(u, v, sign));
      uv.push(flip ? 1 - u : u, 1 - v);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9,
    }));
  }

  const group = new THREE.Group();
  group.add(shell(fc, 1, false));  // 前面（前から撮った画像）
  group.add(shell(bc, -1, true));  // 背面（後ろから撮った画像は左右反転して貼る）

  const refY = isTop ? BODY.chestY : BODY.waistY, bd = bodyAt(refY);
  const info = {
    garmentCirc: item.widthCm * 2,
    bodyCirc: perimeter(bd.a, bd.c) * 100,
    lengthCm: item.lengthCm,
    bodyLenCm: isTop ? (BODY.shoulderY - BODY.hipY) * 100 : BODY.waistY * 100,
  };
  return { group, info };
}
