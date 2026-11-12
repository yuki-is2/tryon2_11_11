import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mannequin } from './mannequin.js';
import { processGarmentImage } from './preprocess.js';
import { load, save, newId } from './storage.js';

const $ = (id) => document.getElementById(id);
const data = load();
const wearing = { top: null, bottom: null };

// ---- 3Dシーン ----
const wrap = $('canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ecf1);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
camera.position.set(0, 1.1, 3.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
wrap.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888899, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(2, 4, 3);
scene.add(sun);
const back = new THREE.DirectionalLight(0xffffff, 0.6);
back.position.set(-2, 3, -3);
scene.add(back);
const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshStandardMaterial({ color: 0xcfd4dc }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const mannequin = new Mannequin();
scene.add(mannequin.group);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 2;
controls.update();

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

// ---- 着せ替え ----
const find = (id) => data.clothes.find((c) => c.id === id) || null;
const NAME = { top: 'トップス', bottom: 'ボトムス' };

async function applyWearing() {
  renderList();
  const lines = [];
  for (const cat of ['top', 'bottom']) {
    try {
      const info = await mannequin.wear(cat, find(wearing[cat]));
      if (info) {
        const d = info.garmentCirc - info.bodyCirc;
        lines.push(`${NAME[cat]}：${cat === 'top' ? '胴回り' : 'ウエスト'} 服${info.garmentCirc.toFixed(0)}cm / マネキン${info.bodyCirc.toFixed(0)}cm（ゆとり${d >= 0 ? '+' : ''}${d.toFixed(0)}cm）、丈 ${info.lengthCm}cm（マネキン${cat === 'top' ? '肩〜腰' : '腰〜床'} ${info.bodyLenCm.toFixed(0)}cm）`);
      }
    } catch (e) { console.error(e); alert('服の3D化に失敗しました：' + e.message); }
  }
  $('fit-info').innerHTML = lines.join('<br>');
}

function renderList() {
  for (const cat of ['top', 'bottom']) {
    const box = $('list-' + cat);
    box.replaceChildren();
    data.clothes.filter((c) => c.category === cat).forEach((c) => {
      const el = document.createElement('div');
      el.className = 'item' + (wearing[cat] === c.id ? ' selected' : '');
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.backgroundImage = `url(${c.front})`;
      sw.style.backgroundSize = 'contain';
      sw.style.backgroundRepeat = 'no-repeat';
      const name = document.createElement('div'); name.textContent = c.name;
      const del = document.createElement('button');
      del.className = 'sub'; del.textContent = '削除';
      del.onclick = (e) => {
        e.stopPropagation();
        data.clothes = data.clothes.filter((x) => x.id !== c.id);
        if (wearing[cat] === c.id) wearing[cat] = null;
        save(data); applyWearing();
      };
      el.append(sw, name, del);
      el.onclick = () => { wearing[cat] = wearing[cat] === c.id ? null : c.id; applyWearing(); };
      box.appendChild(el);
    });
  }
}

// ---- 服の登録（前処理つき）----
const pending = { front: null, back: null, frontFile: null, backFile: null };

async function preprocess(side) {
  const file = pending[side + 'File'];
  if (!file) return;
  try {
    const r = await processGarmentImage(file, +$('f-tol').value);
    pending[side] = r.dataUrl;
    $('prev-' + side).replaceChildren(r.canvas);
  } catch (e) { pending[side] = null; alert(e.message); }
}
for (const side of ['front', 'back']) {
  $('f-' + side).onchange = (e) => { pending[side + 'File'] = e.target.files[0]; preprocess(side); };
}
$('f-tol').onchange = () => { preprocess('front'); preprocess('back'); };

function updateLabels() {
  const top = $('f-cat').value === 'top';
  $('l-width').textContent = top ? '身幅（脇下の平置き幅）' : 'ウエスト幅（平置き）';
  $('l-length').textContent = top ? '着丈（肩〜裾）' : '総丈（ウエスト〜裾）';
  $('f-width').value = top ? 52 : 40;
  $('f-length').value = top ? 68 : 98;
}
$('f-cat').onchange = updateLabels;

$('btn-add').onclick = () => {
  const name = $('f-name').value.trim();
  if (!name) return alert('服の名前を入力してください');
  if (!pending.front || !pending.back) return alert('前と後ろの画像を両方登録してください');
  data.clothes.push({
    id: newId(), name, category: $('f-cat').value,
    widthCm: +$('f-width').value, lengthCm: +$('f-length').value,
    front: pending.front, back: pending.back,
  });
  save(data);
  $('f-name').value = ''; $('f-front').value = ''; $('f-back').value = '';
  $('prev-front').replaceChildren(); $('prev-back').replaceChildren();
  Object.assign(pending, { front: null, back: null, frontFile: null, backFile: null });
  renderList();
};

// ---- コーデ保存 ----
function renderOutfits() {
  const box = $('list-outfit'); box.replaceChildren();
  data.outfits.forEach((o) => {
    const row = document.createElement('div'); row.className = 'outfit';
    const label = document.createElement('span'); label.textContent = o.name;
    label.onclick = () => { wearing.top = o.top; wearing.bottom = o.bottom; applyWearing(); };
    const del = document.createElement('button'); del.className = 'sub'; del.textContent = '削除';
    del.onclick = () => { data.outfits = data.outfits.filter((x) => x.id !== o.id); save(data); renderOutfits(); };
    row.append(label, del); box.appendChild(row);
  });
}
$('btn-save-outfit').onclick = () => {
  if (!wearing.top && !wearing.bottom) return alert('先に服を着せてください');
  const name = $('o-name').value.trim() || `コーデ${data.outfits.length + 1}`;
  data.outfits.push({ id: newId(), name, top: wearing.top, bottom: wearing.bottom });
  save(data); $('o-name').value = ''; renderOutfits();
};

// ---- その他 ----
$('btn-rotate').onclick = () => { controls.autoRotate = !controls.autoRotate; };
$('btn-clear').onclick = () => { wearing.top = wearing.bottom = null; applyWearing(); };
const shape = () => mannequin.setShape(+$('s-height').value, +$('s-width').value);
$('s-height').oninput = shape; $('s-width').oninput = shape;

updateLabels(); renderList(); renderOutfits();
