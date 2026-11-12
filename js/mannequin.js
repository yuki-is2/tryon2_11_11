// 3Dマネキン本体。服は garment.js が作った立体を着せる
import * as THREE from 'three';
import { bodyAt } from './body.js';
import { buildGarment } from './garment.js';

const skin = () => new THREE.MeshStandardMaterial({ color: 0xd9c3a5, roughness: 0.8 });

function cyl(rt, rb, h, x, y, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), mat);
  m.position.set(x, y, 0);
  return m;
}

// 体型データ(bodyAt)どおりの楕円断面の胴体
function torso(mat) {
  const y0 = 0.86, y1 = 1.46, g = new THREE.CylinderGeometry(1, 1, y1 - y0, 40, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + (y0 + y1) / 2, b = bodyAt(y);
    p.setXYZ(i, p.getX(i) * b.a, y, p.getZ(i) * b.c);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

export class Mannequin {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // 服もこの中に入れる（体型スライダーで一緒に伸縮）
    this.group.add(this.body);
    this.worn = { top: null, bottom: null };
    this.token = { top: 0, bottom: 0 };

    const s = skin();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), s);
    head.position.set(0, 1.62, 0);
    this.body.add(head, cyl(0.05, 0.05, 0.12, 0, 1.5, s), torso(s));
    for (const x of [-0.255, 0.255]) this.body.add(cyl(0.04, 0.035, 0.6, x, 1.12, s));
    for (const x of [-0.1, 0.1]) this.body.add(cyl(0.075, 0.055, 0.88, x, 0.44, s));
  }

  // item=null で脱がせる。戻り値は着丈・身幅の比較情報
  async wear(category, item) {
    const t = ++this.token[category];
    const prev = this.worn[category];
    if (prev) { this.body.remove(prev); this.worn[category] = null; }
    if (!item) return null;
    const { group, info } = await buildGarment(item);
    if (t !== this.token[category]) return null; // 連打対策
    this.body.add(group);
    this.worn[category] = group;
    return info;
  }

  setShape(height, width) { this.body.scale.set(width, height, width); }
}
