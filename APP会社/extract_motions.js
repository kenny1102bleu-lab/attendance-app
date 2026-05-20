// ============================================
// extract_motions.js — 特徴的モーション（仕草）自動切り出し・MP4生成スクリプト
// ============================================
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Windows環境対応の FFmpeg パス登録
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const downloadsDir = 'C:\\Users\\kenny\\Downloads';
const publicDir = path.join(__dirname, 'public');

// 入力動画ファイルパス
const winterVideoPath = path.join(downloadsDir, '[日本語字幕] 251012 過去1で日本語を喋るウィンターのWeverseライブ！（有明コン後） #aespa.mp4');
const ayakaVideoPath = path.join(downloadsDir, '河北彩伽　インスタライブ　2024_11_03.mp4');

// モーションの定義（開始時間（秒）、長さ（秒）、説明）
const winterMotions = [
  { start: 30, duration: 10, name: 'winter_motion_01.mp4', desc: 'あまあま小首かしげトーク（ウィンター）' },
  { start: 90, duration: 10, name: 'winter_motion_02.mp4', desc: '無邪気な両手パタパタはにかみ笑顔（ウィンター）' },
  { start: 150, duration: 10, name: 'winter_motion_03.mp4', desc: '深く優しくうなずく共感ポーズ（ウィンター）' },
  { start: 240, duration: 8, name: 'winter_motion_04_cheek_puff.mp4', desc: 'ほっぺ膨らませ拗ね顔ぷくー（ウィンター）' },
  { start: 315, duration: 6, name: 'winter_motion_05_wink.mp4', desc: 'あざと狙い撃ちウィンク（ウィンター）' },
  { start: 430, duration: 8, name: 'winter_motion_06_laugh_clap.mp4', desc: '大爆笑パチパチ拍手（ウィンター）' }
];

const ayakaMotions = [
  { start: 40, duration: 10, name: 'ayaka_motion_01.mp4', desc: '髪を耳にかけて照れる大人の色気仕草（河北彩伽）' },
  { start: 110, duration: 10, name: 'ayaka_motion_02.mp4', desc: 'おっとり包み込むような女神の微笑み（河北彩伽）' },
  { start: 180, duration: 10, name: 'ayaka_motion_03.mp4', desc: '優しく見つめながら「うん、うん」と肯く仕草（河北彩伽）' },
  { start: 260, duration: 9, name: 'ayaka_motion_04_shy_laugh.mp4', desc: '照れ隠し両手顔覆いはにかみ（河北彩伽）' },
  { start: 350, duration: 8, name: 'ayaka_motion_05_heart.mp4', desc: 'おっとり両手ハート感謝（河北彩伽）' },
  { start: 465, duration: 8, name: 'ayaka_motion_06_double_peace.mp4', desc: '愛嬌ダブルピース（河北彩伽）' }
];

function cutClip(inputPath, outputPath, startTime, duration, desc) {
  console.log(`🎬 【${desc}】を抽出中...`);
  
  if (!fs.existsSync(inputPath)) {
    throw new Error(`入力ファイルが見つかりません: ${inputPath}`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 20',
        '-c:a aac',
        '-b:a 128k'
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`  └ ✅ 切り出し完了: ${path.basename(outputPath)}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`  └ ❌ エラー: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

async function main() {
  console.log('🚀 HAL専用モーションテンプレート（３種類 × ２人分）の切り出しプロセスを開始します...');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    // 1. ウィンターのモーション切り出し
    for (const m of winterMotions) {
      const outPath = path.join(publicDir, m.name);
      await cutClip(winterVideoPath, outPath, m.start, m.duration, m.desc);
    }

    // 2. 河北彩伽のモーション切り出し
    for (const m of ayakaMotions) {
      const outPath = path.join(publicDir, m.name);
      await cutClip(ayakaVideoPath, outPath, m.start, m.duration, m.desc);
    }

    console.log('\n✨ すべてのモーションサンプルの切り出しが成功しました！ ✨');
    console.log(`📂 保存先ディレクトリ: ${publicDir}`);
    console.log('\nこれで各10秒間の神仕草モーション動画（MP4）が生成されました。');
  } catch (err) {
    console.error('\n❌ モーション抽出中にエラーが発生しました:', err.message);
  }
}

main();
