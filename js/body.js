// マネキンの体型データ（単位：m）。y=高さ。a=半幅、c=半奥行き
const KEYS = [ // [y, a, c]  上から下へ
  [1.50, 0.150, 0.090], [1.45, 0.170, 0.100], [1.38, 0.190, 0.110],
  [1.20, 0.180, 0.105], [1.02, 0.165, 0.100], [0.92, 0.185, 0.115],
  [0.80, 0.180, 0.090], [0.00, 0.175, 0.080],
];

export const BODY = { shoulderY: 1.46, waistY: 1.02, hipY: 0.88, chestY: 1.25 };

export function bodyAt(y) {
  if (y >= KEYS[0][0]) return { a: KEYS[0][1], c: KEYS[0][2] };
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [y0, a0, c0] = KEYS[i], [y1, a1, c1] = KEYS[i + 1];
    if (y <= y0 && y >= y1) {
      const t = (y0 - y) / (y0 - y1);
      return { a: a0 + (a1 - a0) * t, c: c0 + (c1 - c0) * t };
    }
  }
  const l = KEYS[KEYS.length - 1];
  return { a: l[1], c: l[2] };
}

// 楕円の周長（ラマヌジャン近似）
export const perimeter = (a, b) =>
  Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
