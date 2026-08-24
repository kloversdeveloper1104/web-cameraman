// co/ フォルダの画像一覧から data/images.json を自動生成する。
// 既存のキャプション(text)は data/images.json があればそれを、なければ index.html に
// 埋め込まれていた images 配列を読んで引き継ぐ。
//
// 使い方: node scripts/generate-manifest.mjs

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CO_DIR = path.join(ROOT, "co");
const MANIFEST_PATH = path.join(ROOT, "data", "images.json");
const INDEX_HTML_PATH = path.join(ROOT, "index.html");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif"]);

function loadExistingCaptions() {
  // 優先: data/images.json
  if (existsSync(MANIFEST_PATH)) {
    const arr = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    const map = new Map();
    for (const { src, text } of arr) {
      const file = path.basename(src);
      if (!map.has(file)) map.set(file, text ?? "");
    }
    return map;
  }

  // 初回: index.html に埋め込まれた images 配列から移行
  if (existsSync(INDEX_HTML_PATH)) {
    const html = readFileSync(INDEX_HTML_PATH, "utf8");
    const match = html.match(/const\s+images\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      try {
        // JS配列リテラル(末尾カンマ・シングルクォート等含む)を安全にevalせず
        // 簡易パースするため Function 経由でリテラルとして評価する
        const arr = Function(`"use strict"; return (${match[1]});`)();
        const map = new Map();
        let dupes = 0;
        for (const { src, text } of arr) {
          const file = path.basename(src);
          if (map.has(file)) {
            dupes++;
            continue; // 重複srcは最初の1件を採用(58.jpgの重複バグ対策)
          }
          map.set(file, text ?? "");
        }
        if (dupes > 0) {
          console.log(`index.html の images 配列から ${dupes} 件の重複エントリを除外しました。`);
        }
        return map;
      } catch (e) {
        console.warn("index.html の images 配列の解析に失敗しました:", e.message);
      }
    }
  }

  return new Map();
}

function numericKey(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

function main() {
  const existing = loadExistingCaptions();

  const filesOnDisk = readdirSync(CO_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXT.has(ext);
  });
  const onDiskSet = new Set(filesOnDisk);

  const missing = [...existing.keys()].filter((f) => !onDiskSet.has(f));
  if (missing.length > 0) {
    console.log(`co/ に存在しないため削除: ${missing.join(", ")}`);
  }

  const added = filesOnDisk.filter((f) => !existing.has(f));
  if (added.length > 0) {
    console.log(`新規追加(キャプション未設定): ${added.join(", ")}`);
  }

  const result = filesOnDisk
    .sort((a, b) => {
      const na = numericKey(a);
      const nb = numericKey(b);
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    })
    .map((file) => ({
      src: `co/${file}`,
      text: existing.get(file) ?? "",
    }));

  writeFileSync(MANIFEST_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`data/images.json を書き出しました (${result.length} 件)。`);
}

main();
