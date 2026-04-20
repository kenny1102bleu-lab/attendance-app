/**
 * KCS Agency Bridge v1.0
 * AIスタッフからの実務依頼をローカルPCで実行するための常駐プログラム
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import puppeteer from 'puppeteer';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const execAsync = promisify(exec);

// --- 設定 ---
// 優先順位: コマンドライン引数 → bridge.config.json → 環境変数
let GAS_URL = '';
if (process.argv.includes('--url')) {
  GAS_URL = process.argv[process.argv.indexOf('--url') + 1];
} else {
  // bridge.config.json から読み込む
  try {
    const configPath = path.join(__dirname, 'bridge.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    GAS_URL = config.GAS_URL || '';
  } catch { /* ファイルなければスキップ */ }
}
if (!GAS_URL) GAS_URL = process.env.KCS_GAS_URL || '';

const POLLING_INTERVAL = 10000; // 10秒おきにチェック

async function main() {
  if (!GAS_URL) {
    console.error('❌ エラー: GAS_URLが設定されていません。');
    console.log('bridge.config.json に {"GAS_URL": "https://..."} を記述してください。');
    process.exit(1);
  }

  console.log('🚀 KCS Agency Bridge 起動完了...');
  console.log(`📡 監視対象: ${GAS_URL}`);
  console.log('--------------------------------------------------');

  while (true) {
    try {
      await pollTasks();
    } catch (err) {
      console.error('❌ ポーリングエラー:', err.message);
    }
    await new Promise(r => setTimeout(r, POLLING_INTERVAL));
  }
}

async function pollTasks() {
  const res = await axios.post(GAS_URL, { action: 'get_pending_tasks' });
  const tasks = res.data;

  if (Array.isArray(tasks) && tasks.length > 0) {
    console.log(`📥 ${tasks.length} 件の新しいリクエストを検知しました。`);
    for (const task of tasks) {
      await handleTask(task);
    }
  }
}

async function handleTask(task) {
  console.log(`\n⚙️ 実行中: [${task.taskType}] ${task.staffName} からの依頼 (ID: ${task.taskId})`);
  console.log(`📝 指示: ${task.instruction}`);

  try {
    // 状態を「進行中」に更新
    await updateStatus(task.taskId, '進行中');

    let resultMsg = '';
    
    // --- タスク別の実行ロジック ---
    switch (task.taskType) {
      case 'video':
        resultMsg = await handleVideoTask(task);
        break;
      case 'image':
        resultMsg = await handleImageTask(task);
        break;
      case 'research':
        resultMsg = await handleResearchTask(task);
        break;
      case 'document':
        resultMsg = await handleDocumentTask(task);
        break;
      default:
        resultMsg = '未対応のタスク種別です。';
    }

    // 成功として更新
    await updateStatus(task.taskId, '完了', resultMsg);
    console.log(`✅ 完了: ${task.taskId}`);

  } catch (err) {
    console.error(`❌ 実行失敗 [${task.taskId}]:`, err.message);
    await updateStatus(task.taskId, 'エラー', err.message);
  }
}

async function updateStatus(taskId, status, result = '') {
  await axios.post(GAS_URL, {
    action: 'update_agency_task',
    taskId,
    status,
    result
  });
}

/**
 * 生成されたファイルをGoogleドライブにアップロードする
 */
async function uploadFileToDrive(filePath, taskId, task) {
  try {
    console.log(`📤 ファイルをドライブにアップロード中: ${path.basename(filePath)}`);
    const content = fs.readFileSync(filePath, { encoding: 'base64' });
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.mp4') contentType = 'video/mp4';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.txt') contentType = 'text/plain';

    const res = await axios.post(GAS_URL, {
      action: 'upload_to_drive',
      taskId: taskId,
      filename: path.basename(filePath),
      content: content,
      contentType: contentType,
      folderId: task.params?.folderId || '' // タスク個別のフォルダ指定があれば優先
    });

    if (res.data.status === 'ok') {
      console.log(`✅ ドライブ保存完了: ${res.data.url}`);
      return res.data.url;
    } else {
      throw new Error(res.data.message);
    }
  } catch (err) {
    console.warn(`⚠️ ドライブアップロード失敗: ${err.message}`);
    return `(ローカル保存のみ) ${filePath}`;
  }
}

// --- 各種ハンドラ ---

async function handleVideoTask(task) {
  console.log('🎬 動画合成を開始します (FFmpeg)...');
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  
  const outputFilePath = path.join(outputDir, `video_${task.taskId}.mp4`);
  const text = task.instruction || 'KCS AI Production';

  return new Promise((resolve, reject) => {
    // まずはダミーまたは背景画像を作成して合成する簡単な例
    // 本来は素材ダウンロードが必要ですが、初動はプレースホルダー的な動き
    ffmpeg()
      .input('color=c=black:s=1280x720:d=5')
      .inputFormat('lavfi')
      .videoFilters([
        {
          filter: 'drawtext',
          options: {
            text: text,
            fontsize: 48,
            fontcolor: 'white',
            x: '(w-text_w)/2',
            y: '(h-text_h)/2'
          }
        }
      ])
      .on('end', async () => {
        const driveUrl = await uploadFileToDrive(outputFilePath, task.taskId, task);
        resolve(`動画を生成し、ドライブに保存しました: ${driveUrl}`);
      })
      .on('error', (err) => reject(err))
      .save(outputFilePath);
  });
}

async function handleImageTask(task) {
  console.log('🎨 画像処理を開始します (Sharp)...');
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  
  const outputFilePath = path.join(outputDir, `image_${task.taskId}.png`);
  
  // テキスト入りの画像を生成（SharpのSVGオーバーレイを活用）
  const svgText = `
    <svg width="800" height="400">
      <rect width="100%" height="100%" fill="#2d3436" />
      <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="24">${task.instruction}</text>
    </svg>`;
    
  await sharp(Buffer.from(svgText))
    .png()
    .toFile(outputFilePath);
    
  const driveUrl = await uploadFileToDrive(outputFilePath, task.taskId, task);
  return `画像を生成し、ドライブに保存しました: ${driveUrl}`;
}

async function handleResearchTask(task) {
  console.log('🔍 ウェブリサーチを開始します (Puppeteer)...');
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    const query = task.instruction;

    // Google検索結果を取得
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ja`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('h3').forEach((h3, i) => {
        if (i >= 5) return;
        const title = h3.innerText.trim();
        const link = h3.closest('a')?.href || '';
        const snippet = h3.closest('[data-sokoban-container]')?.querySelector('[data-sncf]')?.innerText
          || h3.parentElement?.parentElement?.innerText?.replace(h3.innerText, '').trim().slice(0, 200)
          || '';
        if (title) items.push({ title, link, snippet });
      });
      return items;
    });

    await browser.close();

    if (results.length === 0) {
      return `「${query}」の検索結果が取得できませんでした。`;
    }

    const summary = results.map((r, i) =>
      `【${i + 1}】${r.title}\n${r.snippet}\n${r.link}`
    ).join('\n\n');

    return `「${query}」のリサーチ結果:\n\n${summary}`;
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

async function handleDocumentTask(task) {
  console.log('📄 資料作成を開始します...');
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const outputFilePath = path.join(outputDir, `doc_${task.taskId}.txt`);
  
  fs.writeFileSync(outputFilePath, `--- KCS AI DOCUMENT ---\n\n${task.instruction}\n\n作成日: ${new Date().toLocaleString()}`);
  
  const driveUrl = await uploadFileToDrive(outputFilePath, task.taskId, task);
  return `ドキュメントを作成し、ドライブに保存しました: ${driveUrl}`;
}

main();
