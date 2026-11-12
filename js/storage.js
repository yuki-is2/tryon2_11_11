// 保存データ（ブラウザのlocalStorage）の読み書き
const KEY = 'tryon-app-v2';

export function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { clothes: [], outfits: [] };
  } catch {
    return { clothes: [], outfits: [] };
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    alert('保存に失敗しました（容量オーバーの可能性）。写真を小さくしてください。');
  }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
