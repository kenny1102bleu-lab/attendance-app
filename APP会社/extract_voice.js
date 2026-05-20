// ============================================
// extract_voice.js — HALの音声サンプル自動抽出・MP3生成スクリプト
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

// 出力音声ファイルパス
const winterAudioOutput = path.join(publicDir, 'winter_voice.mp3');
const ayakaAudioOutput = path.join(publicDir, 'ayaka_voice.mp3');

function extractVoice(inputPath, outputPath, startTime, duration, name) {
  console.log(`🎬 ${name} から喋り声（MP3）を抽出中...`);
  
  if (!fs.existsSync(inputPath)) {
    throw new Error(`入力ファイルが見つかりません: ${inputPath}`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions([
        '-q:a 0',      // 最高品質の可変ビットレート
        '-map a',      // 音声ストリームのみを抽出
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`  └ FFmpeg 起動完了（${name}）`);
      })
      .on('end', () => {
        console.log(`  └ ✅ 抽出＆変換完了: ${path.basename(outputPath)}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`  └ ❌ エラーが発生しました: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

async function main() {
  console.log('🚀 HAL音声サンプル（ウィンター × 河北彩伽）の自動抽出プロセスを開始します...');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    // 1. ウィンターの動画から抽出
    // 開始位置: 120秒（2分）から、長さ: 120秒（2分間）のクリアな喋り声を切り出します
    await extractVoice(winterVideoPath, winterAudioOutput, 120, 120, 'ウィンター Weverseライブ動画');

    // 2. 河北彩伽の動画から抽出
    // 開始位置: 60秒（1分）から、長さ: 120秒（2分間）のクリアな喋り声を切り出します
    await extractVoice(ayakaVideoPath, ayakaAudioOutput, 60, 120, '河北彩伽 インスタライブ動画');

    console.log('\n✨ すべての音声サンプルの抽出が完了しました！ ✨');
    console.log(`👉 ウィンター音声: ${winterAudioOutput}`);
    console.log(`👉 河北彩伽音声  : ${ayakaAudioOutput}`);
    console.log('\n💬 次のステップ:');
    console.log('1. イレブンラボ（ElevenLabs）の「VoiceLab」を開きます。');
    console.log('2. 抽出された2つのMP3音声をアップロードしてブレンドします。');
    console.log('3. 比率は「ウィンター：60%」「河北彩伽：40%」に設定します！');
  } catch (err) {
    console.error('\n❌ 音声抽出処理中に例外エラーが発生しました:', err.message);
  }
}

main();
