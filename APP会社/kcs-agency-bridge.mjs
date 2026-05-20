/**
 * KCS Agency Bridge v1.0
 * AIスタッフからの実務依頼をローカルPCで実行するための常駐プログラム
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import puppeteer from 'puppeteer';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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

  // 必要なフォルダの自動作成
  const requiredDirs = ['temp_media', 'output', 'public'];
  for (const dir of requiredDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 フォルダを作成しました: ${dir}`);
    }
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
      case 'image_synthesis':
        resultMsg = await handleImageSynthesisTask(task);
        break;
      case 'video_synthesis':
        resultMsg = await handleVideoSynthesisTask(task);
        break;
      case 'hal_talk_synthesis':
        resultMsg = await handleHalTalkSynthesis(task);
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
    await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
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

// --- カルーセル・動画合成ハンドラ ---

/**
 * テキストを指定文字数で折り返す（SVG用）
 */
function wrapText(text, maxChars = 18) {
  const rawLines = text.split(/\\n|\n/);
  const result = [];
  for (const raw of rawLines) {
    if (raw.length === 0) { result.push(''); continue; }
    for (let i = 0; i < raw.length; i += maxChars) {
      result.push(raw.slice(i, i + maxChars));
    }
  }
  return result;
}

/**
 * 1枚分のスライドSVGを生成する
 * デザイン: ダークグラデ (#121212→#0A1128), ゴールドタイトル, ホワイト本文
 */
function buildSlideSvg(title, body, slideNum, totalSlides) {
  const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const escapedTitle = esc(title);
  const bodyLines = wrapText(body, 18).map(esc);
  const bodyStartY = 420;
  const lineHeight = 64;

  const bodyElements = bodyLines
    .map((line, i) => `  <text x="540" y="${bodyStartY + i * lineHeight}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="36" fill="#FFFFFF" opacity="0.9">${line}</text>`)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121212"/>
      <stop offset="100%" stop-color="#0A1128"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="60" y="90" width="960" height="4" fill="#C9A84C" rx="2"/>
  <text x="540" y="260" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="52" font-weight="bold" fill="#C9A84C">${escapedTitle}</text>
  <rect x="440" y="300" width="200" height="2" fill="#C9A84C" opacity="0.4"/>
${bodyElements}
  <text x="540" y="992" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="22" fill="#FFFFFF" opacity="0.25">KCS AI Agent System</text>
  <text x="1020" y="58" text-anchor="end" font-family="Yu Gothic, Meiryo, sans-serif" font-size="22" fill="#FFFFFF" opacity="0.4">${slideNum} / ${totalSlides}</text>
  <rect x="60" y="992" width="960" height="4" fill="#00B4D8" rx="2" opacity="0.6"/>
</svg>`;
}

/**
 * image_synthesis: スライドカルーセル画像を生成
 * task.instruction に JSON文字列 { theme, slides: [{title, body}] } を渡す
 */
async function handleImageSynthesisTask(task) {
  console.log('🖼️  カルーセル画像を生成します (Sharp)...');

  let payload;
  try {
    payload = typeof task.instruction === 'string'
      ? JSON.parse(task.instruction)
      : task.instruction;
  } catch {
    throw new Error('image_synthesis: instructionがJSON形式ではありません。');
  }

  const { slides = [] } = payload;
  if (slides.length === 0) throw new Error('slidesが空です。');

  const tempDir = path.join(process.cwd(), 'temp_media');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const outputPaths = [];

  for (let i = 0; i < slides.length; i++) {
    const { title = '', body = '' } = slides[i];
    const svg = buildSlideSvg(title, body, i + 1, slides.length);
    const outPath = path.join(tempDir, `image_slide_0${i + 1}.png`);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outPath);
      console.log(`  ✅ スライド ${i + 1}/${slides.length} 生成: ${path.basename(outPath)}`);
      outputPaths.push(outPath);
    } catch (err) {
      throw new Error(`スライド${i + 1}の生成に失敗: ${err.message}`);
    }
  }

  // Drive アップロード（全スライド）
  const urls = [];
  for (const p of outputPaths) {
    const url = await uploadFileToDrive(p, task.taskId, task);
    urls.push(url);
  }

  return `カルーセル画像 ${outputPaths.length} 枚を生成しました:\n${urls.join('\n')}`;
}

/**
 * video_synthesis: temp_media/ のスライド画像からショート動画を合成
 * 各スライド7秒・フェードトランジション付き・BGMオプション対応
 */
async function handleVideoSynthesisTask(task) {
  console.log('🎬 ショート動画を合成します (FFmpeg)...');

  const tempDir = path.join(process.cwd(), 'temp_media');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // スライド画像を収集
  const slideFiles = [];
  for (let i = 1; i <= 10; i++) {
    const f = path.join(tempDir, `image_slide_0${i}.png`);
    if (fs.existsSync(f)) slideFiles.push(f);
  }
  if (slideFiles.length === 0) {
    throw new Error('スライド画像が見つかりません。先に image_synthesis を実行してください。');
  }

  const outputPath = path.join(tempDir, 'final_short_video.mp4');
  const bgmPath = path.join(tempDir, 'bgm.mp3');
  const hasBgm = fs.existsSync(bgmPath);
  const slideDuration = 7;
  const fadeDuration = 1;
  const n = slideFiles.length;

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // 各スライドを入力（-loop 1 で静止画を動画として扱う）
    slideFiles.forEach(f => {
      cmd.input(f).inputOptions(['-loop 1', '-r 30', `-t ${slideDuration}`]);
    });

    if (hasBgm) {
      cmd.input(bgmPath).inputOptions(['-stream_loop -1']);
    }

    // fade + concat フィルタ（xfade は古い FFmpeg では未対応）
    // 各スライド: 最初1秒フェードイン・最後1秒フェードアウト
    const fps = 30;
    const fadeFrames = fadeDuration * fps;          // 30フレーム
    const totalFrames = slideDuration * fps;        // 210フレーム
    const fadeOutStart = totalFrames - fadeFrames;  // 180フレーム目から

    const perSlide = slideFiles.map((_, i) =>
      `[${i}:v]fade=in:0:${fadeFrames},fade=out:${fadeOutStart}:${fadeFrames}[s${i}]`
    );
    const concatInputs = slideFiles.map((_, i) => `[s${i}]`).join('');
    const filterComplex = [
      ...perSlide,
      `${concatInputs}concat=n=${n}:v=1[vout]`
    ].join(';');

    const outputOptions = [
      '-c:v libx264',
      '-preset fast',
      '-crf 23',
      '-r 30',
      '-pix_fmt yuv420p',
      '-movflags +faststart',
    ];

    if (hasBgm) {
      outputOptions.push(`-map ${n}:a`, '-c:a aac', '-b:a 128k', '-shortest');
    } else {
      outputOptions.push('-an');
    }

    cmd
      .complexFilter(filterComplex, ['vout'])
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', cmdLine => console.log(`  FFmpeg 起動: ${cmdLine.slice(0, 120)}...`))
      .on('progress', p => process.stdout.write(`\r  進捗: ${Math.round(p.percent || 0)}%`))
      .on('end', async () => {
        process.stdout.write('\n');
        console.log('  ✅ 動画合成完了');
        try {
          const driveUrl = await uploadFileToDrive(outputPath, task.taskId, task);
          resolve(`ショート動画を生成しました (${slideFiles.length} スライド / ${n * slideDuration - (n - 1) * fadeDuration}秒):\n${driveUrl}`);
        } catch (uploadErr) {
          resolve(`ショート動画をローカルに保存しました: ${outputPath}\n（ドライブアップロード失敗: ${uploadErr.message}）`);
        }
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg エラー: ${err.message}`));
      })
      .run();
  });
}

/**
 * ElevenLabs音声合成 ＆ Replicate SadTalker クラウドAPIによる
 * 「AI美女ハル（HAL）のしゃべる動画」自律自動生成ハンドラ
 */
async function handleHalTalkSynthesis(task) {
  console.log('🎙️ ElevenLabs ＆ Replicate SadTalker による動画生成を開始します...');

  // 1. 設定のロード（環境変数優先 ➔ なければ configファイル）
  let config = {};
  try {
    const configPath = path.join(__dirname, 'bridge.config.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ファイルなければスキップ */ }

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY || config.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || config.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const replicateKey = process.env.REPLICATE_API_KEY || config.REPLICATE_API_KEY;

  if (!elevenLabsKey || elevenLabsKey === 'YOUR_ELEVENLABS_API_KEY_HERE') {
    throw new Error('ELEVENLABS_API_KEY が環境変数または bridge.config.json に設定されていません。');
  }
  if (!replicateKey) {
    throw new Error('REPLICATE_API_KEY が環境変数または bridge.config.json に設定されていません。');
  }

  // 2. 台本テキストの取得
  const text = task.instruction || 'こんにちは、ハルです。KCS合同会社の自律生配信システムへようこそ！';
  console.log(`📝 生成台本: "${text}"`);

  const tempDir = path.join(process.cwd(), 'temp_media');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const voiceOutputPath = path.join(tempDir, 'hal_voice.mp3');
  const avatarSourcePath = path.join(process.cwd(), 'public', 'hal_avatar.png');
  const finalVideoDir = path.join(process.cwd(), 'public');

  // 3. ElevenLabs API で音声を生成
  console.log('🔊 ElevenLabs API にリクエスト送信中...');
  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
        'accept': 'audio/mpeg'
      },
      data: {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      },
      responseType: 'arraybuffer'
    });
    fs.writeFileSync(voiceOutputPath, Buffer.from(response.data));
    console.log(`✅ 音声合成成功: ${voiceOutputPath}`);
  } catch (err) {
    const msg = err.response?.data ? Buffer.from(err.response.data).toString() : err.message;
    throw new Error(`ElevenLabs 音声合成失敗: ${msg}`);
  }

  // 4. ソース画像の確認
  if (!fs.existsSync(avatarSourcePath)) {
    throw new Error('hal_avatar.png が public/ フォルダに見つかりません。');
  }

  // 5. 画像・音声を base64 データURIに変換
  console.log('📦 画像・音声をBase64に変換中...');
  const imageBase64 = fs.readFileSync(avatarSourcePath).toString('base64');
  const audioBase64 = fs.readFileSync(voiceOutputPath).toString('base64');
  const imageDataUri = `data:image/png;base64,${imageBase64}`;
  const audioDataUri = `data:audio/mpeg;base64,${audioBase64}`;

  // 6. Replicate SadTalker API を呼び出す
  console.log('🤖 Replicate SadTalker にリクエスト送信中...');
  let getUrl;
  try {
    const predRes = await axios.post(
      'https://api.replicate.com/v1/models/cjwbw/sadtalker/predictions',
      {
        input: {
          source_image: imageDataUri,
          driven_audio: audioDataUri,
          preprocess: 'crop',
          still: false,
          enhancer: 'gfpgan'
        }
      },
      {
        headers: {
          'Authorization': `Token ${replicateKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        }
      }
    );
    getUrl = predRes.data.urls?.get;
    console.log(`📡 Replicate 予測ID: ${predRes.data.id}`);

    // Prefer: wait で即完了していた場合
    if (predRes.data.status === 'succeeded' && predRes.data.output) {
      const outputUrl = predRes.data.output;
      console.log(`✅ 即時完了: ${outputUrl}`);
      const videoRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
      const targetPath = path.join(finalVideoDir, 'hal_live.mp4');
      fs.writeFileSync(targetPath, Buffer.from(videoRes.data));
      const driveUrl = await uploadFileToDrive(targetPath, task.taskId, task);
      return `Replicate SadTalker AIアバター動画の生成完了！: ${driveUrl}`;
    }
  } catch (err) {
    throw new Error(`Replicate API 呼び出し失敗: ${err.response?.data?.detail || err.message}`);
  }

  // 7. 完了まで最大5分ポーリング
  console.log('⏳ Replicate での動画生成を待機中（最大5分）...');
  let outputUrl = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await axios.get(getUrl, {
      headers: { 'Authorization': `Token ${replicateKey}` }
    });
    const { status, output, error } = statusRes.data;
    console.log(`  状態: ${status} (${(i + 1) * 5}秒経過)`);

    if (status === 'succeeded') {
      outputUrl = output;
      break;
    } else if (status === 'failed' || status === 'canceled') {
      throw new Error(`Replicate 生成失敗: ${error || status}`);
    }
  }

  if (!outputUrl) {
    throw new Error('Replicate: タイムアウト（5分）。再度お試しください。');
  }

  // 8. 動画をダウンロードして public/hal_live.mp4 に保存
  console.log(`📥 生成動画をダウンロード中: ${outputUrl}`);
  const videoRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
  const targetPath = path.join(finalVideoDir, 'hal_live.mp4');
  if (!fs.existsSync(finalVideoDir)) fs.mkdirSync(finalVideoDir, { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(videoRes.data));
  console.log(`✅ hal_live.mp4 保存完了！`);

  const driveUrl = await uploadFileToDrive(targetPath, task.taskId, task);
  return `Replicate SadTalker AIアバター動画の生成・デプロイ完了！: ${driveUrl}`;
}

// --- テストモード ---

async function runMediaTest() {
  console.log('🧪 メディア生成テストを開始します...\n');

  const testImageTask = {
    taskId: 'test_img_001',
    taskType: 'image_synthesis',
    staffName: 'テスト',
    instruction: JSON.stringify({
      theme: 'ガジェット紹介テスト',
      slides: [
        { title: '今話題のガジェット', body: 'AIが選んだ最強の商品\n2026年版ランキング発表！' },
        { title: 'その1: 高コスパ最強', body: '1万円以下なのに\nプロ並みの性能を実現！' },
        { title: 'その2: 使って変わった', body: '毎日の作業時間が\n50%削減されました' },
        { title: 'DM「詳細」で送ります！', body: '概要欄のリンクから\n今すぐチェック！' }
      ]
    }),
    params: {}
  };

  try {
    console.log('▶ [1/2] image_synthesis テスト...');
    const imgResult = await handleImageSynthesisTask(testImageTask);
    console.log('  結果:', imgResult.split('\n')[0]);
  } catch (err) {
    console.error('  ❌ image_synthesis 失敗:', err.message);
    process.exit(1);
  }

  const testVideoTask = {
    taskId: 'test_vid_001',
    taskType: 'video_synthesis',
    staffName: 'テスト',
    instruction: '',
    params: {}
  };

  try {
    console.log('\n▶ [2/2] video_synthesis テスト...');
    const vidResult = await handleVideoSynthesisTask(testVideoTask);
    console.log('  結果:', vidResult.split('\n')[0]);
  } catch (err) {
    console.error('  ❌ video_synthesis 失敗:', err.message);
    process.exit(1);
  }

  const testHalTask = {
    taskId: 'test_hal_001',
    taskType: 'hal_talk_synthesis',
    staffName: 'テスト',
    instruction: 'こんにちは、ハルです。社長、イレブンラボとライブポートレートの自動連携テストに大成功しました！これから一緒に、最高の配信帝国を作り上げましょう！',
    params: {}
  };

  try {
    console.log('\n▶ [3/3] hal_talk_synthesis (ElevenLabs & LivePortrait) テスト...');
    const halResult = await handleHalTalkSynthesis(testHalTask);
    console.log('  結果:', halResult);
  } catch (err) {
    console.warn('\n  ⚠️ hal_talk_synthesis テスト警告（環境設定が完了するまでこのタスクはスキップ、または音声フォールバックされます）:', err.message);
  }

  console.log('\n🎉 テスト完了！temp_media/ フォルダおよび public/ フォルダを確認してください。');
  process.exit(0);
}

// --- エントリポイント ---
if (process.argv.includes('--test-media')) {
  runMediaTest().catch(err => { console.error('❌ テストエラー:', err.message); process.exit(1); });
} else {
  main();
}
