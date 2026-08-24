// co/ フォルダの各画像から、ギャラリー表示用の軽量サムネイル(webp)を co/thumbs/ に生成する。
// 元画像より新しいサムネイルが既にあればスキップする(差分ビルド)。
//
// 使い方: node scripts/generate-thumbs.mjs

import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CO_DIR = path.join(ROOT, "co");
const THUMBS_DIR = path.join(CO_DIR, "thumbs");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif"]);
const THUMB_WIDTH = 500;
const THUMB_QUALITY = 75;

function thumbNameFor(file) {
  return `${path.basename(file, path.extname(file))}.webp`;
}

async function main() {
  if (!existsSync(THUMBS_DIR)) mkdirSync(THUMBS_DIR, { recursive: true });

  const files = readdirSync(CO_DIR).filter((f) => {
    const full = path.join(CO_DIR, f);
    if (!statSync(full).isFile()) return false;
    return IMAGE_EXT.has(path.extname(f).toLowerCase());
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const srcPath = path.join(CO_DIR, file);
    const thumbPath = path.join(THUMBS_DIR, thumbNameFor(file));

    if (existsSync(thumbPath)) {
      const srcMtime = statSync(srcPath).mtimeMs;
      const thumbMtime = statSync(thumbPath).mtimeMs;
      if (thumbMtime >= srcMtime) {
        skipped++;
        continue;
      }
    }

    try {
      await sharp(srcPath)
        .rotate() // EXIF回転を反映
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbPath);
      created++;
    } catch (e) {
      failed++;
      console.warn(`失敗: ${file} (${e.message})`);
    }
  }

  console.log(`サムネイル生成完了: 新規/更新 ${created} 件, スキップ ${skipped} 件, 失敗 ${failed} 件`);
}

main();
