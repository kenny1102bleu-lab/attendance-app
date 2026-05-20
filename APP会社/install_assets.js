// ============================================
// install_assets.js — HALの公式アセット（Google Drive）自動ダウンロード・配置スクリプト
// ============================================
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google DriveのファイルID（社長の共有フォルダから取得）
const PHOTO_FILE_ID = '1EsQ8ZAdv6_mbidNGTiLT2cxB9scUjwt0'; // IMG_7121.PNG
const VIDEO_FILE_ID = '1RiSDVQAsrnOBETaGVkLiPGWQdotTZcMG'; // gemini_generated_video_C52E415C.mp4

const publicDir = path.join(__dirname, 'public');

// 出力パス
const photoOutputPath = path.join(publicDir, 'hal_avatar.png');
const videoOutputPath = path.join(publicDir, 'hal_live.webm');

async function downloadFile(fileId, outputPath, name) {
  const url = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
  console.log(`📥 Google Drive から ${name} をダウンロード中...`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ ダウンロード＆配置完了: ${path.basename(outputPath)}`);
        resolve();
      });
      writer.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error(`❌ ${name} のダウンロードに失敗しました:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 HALアセット自動セットアップを開始します...');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    // 1. 写真のダウンロード (hal_avatar.png)
    await downloadFile(PHOTO_FILE_ID, photoOutputPath, '公式アバター写真 (IMG_7121.PNG)');
    
    // 2. 動画のダウンロード (hal_live.webm)
    await downloadFile(VIDEO_FILE_ID, videoOutputPath, '公式ループ動画 (gemini_generated_video_C52E415C.mp4)');

    console.log('\n✨ すべてのアセットが正常にセットアップされました！ ✨');
    console.log(`👉 アバター写真: ${photoOutputPath}`);
    console.log(`👉 ライブループ動画: ${videoOutputPath}`);
    console.log('\nこれでブラウザ内アバター画面（React）が公式アセットで美しく描画されます！');
  } catch (err) {
    console.error('\n❌ セットアップ中にエラーが発生しました。インターネット接続やGoogle Drive共有設定を確認してください。');
  }
}

main();
