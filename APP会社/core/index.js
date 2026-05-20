// ============================================
// core/index.js — KCS会社システム メインエントリ
// 全エージェントを起動し、WebSocketサーバーに接続
// ============================================
import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import {
  getAllTasks, getAllAgentStatuses, getRecentLogs,
  addTask, getPendingTasks, sendInterDeptMessage,
  saveMeetingSession, getMeetingsByProject, searchMeetings, getRecentMeetings
} from './message-bus.js';
import {
  JunAgent, SakuraAgent,
  HarukiAgent, SaitoAgent,
  YukiAgent, ReoAgent, MioAgent, SouAgent, AkariAgent,
  RyouAgent, RunaAgent,
  KenjiAgent,
  TakumiAgent, KanaAgent
} from './departments/index.js';

// ============================================
// 設定
// ============================================
const PORT = process.env.KCS_PORT || 3737;
const API_KEYS = {
  gemini: process.env.GEMINI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || ''
};

// ============================================
// Express + Socket.io サーバー
// ============================================
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// WebSocketイベントブロードキャスト関数
const broadcast = (event) => {
  io.emit('kcs_event', event);
};

// ============================================
// 全エージェントの初期化
// ============================================
const agentConfig = { apiKeys: API_KEYS, onEvent: broadcast };

const agents = [
  // 経営部
  new JunAgent(agentConfig),
  new SakuraAgent(agentConfig),
  // 企画部
  new HarukiAgent(agentConfig),
  new SaitoAgent(agentConfig),
  // 制作部
  new YukiAgent(agentConfig),
  new ReoAgent(agentConfig),
  new MioAgent(agentConfig),
  new SouAgent(agentConfig),
  new AkariAgent(agentConfig),
  // マーケ部
  new RyouAgent(agentConfig),
  new RunaAgent(agentConfig),
  // 開発部
  new KenjiAgent(agentConfig),
  // 営業部
  new TakumiAgent(agentConfig),
  new KanaAgent(agentConfig),
];

// ============================================
// REST API エンドポイント
// ============================================

// GET /api/status — 全エージェントの状態
app.get('/api/status', (req, res) => {
  res.json({
    agents: getAllAgentStatuses(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// GET /api/tasks — タスク一覧
app.get('/api/tasks', (req, res) => {
  res.json(getAllTasks(100));
});

// GET /api/logs — 活動ログ
app.get('/api/logs', (req, res) => {
  res.json(getRecentLogs(200));
});

// POST /api/tasks — ユーザーからのタスク追加
app.post('/api/tasks', (req, res) => {
  const { dept, title, instruction, priority } = req.body;
  if (!dept || !title || !instruction) {
    return res.status(400).json({ error: 'dept, title, instruction は必須です' });
  }
  const taskId = addTask({
    dept,
    type: 'user_request',
    title,
    instruction,
    priority: priority || 3,
    createdBy: 'dashboard'
  });
  broadcast({
    type: 'task_added',
    taskId,
    dept,
    title,
    timestamp: new Date().toISOString()
  });
  res.json({ ok: true, taskId });
});

// POST /api/broadcast — 全部門への一斉指示（経営部経由）
app.post('/api/broadcast', (req, res) => {
  const { title, instruction } = req.body;
  if (!title || !instruction) {
    return res.status(400).json({ error: 'title, instruction は必須です' });
  }
  const taskId = addTask({
    dept: 'executive',
    type: 'user_request',
    title,
    instruction,
    priority: 1,
    createdBy: 'dashboard'
  });
  res.json({ ok: true, taskId, message: '経営部（ジュン）に振り分けを依頼しました' });
});

// ============================================
// POST /api/meeting — 会議室AI応答
// 指定したスタッフたちが順番に発言する
// ============================================
app.post('/api/meeting', async (req, res) => {
  const { staffIds, userMessage, projectName, projectDesc, history, attachments } = req.body;
  if (!staffIds?.length || !userMessage) {
    return res.status(400).json({ error: 'staffIds と userMessage は必須です' });
  }

  const hasKey = API_KEYS.gemini || API_KEYS.anthropic;
  if (!hasKey) {
    return res.status(400).json({ error: 'APIキーが設定されていません。.envファイルを確認してください。' });
  }

  // スタッフ定義マップ
  const STAFF_MAP = {
    jun:    { name: 'ジュン', emoji: '💼', title: '専務', color: '#ff6b6b',
      prompt: `あなたはKCS合同会社の専務・ジュンです。会社全体を統括し、方向性・役割分担・意思決定を担います。具体的かつ簡潔に3〜5文で発言し、必要なら他スタッフに振ります。` },
    sakura: { name: 'サクラ', emoji: '📋', title: '秘書', color: '#ffd93d',
      prompt: `あなたはKCS合同会社の秘書・サクラです。スケジュール・タスク整理・指示書作成が専門です。箇条書きやリスト形式で整理して発言します。3〜5文で簡潔に。` },
    haruki: { name: 'ハルキ', emoji: '📌', title: 'プランナー', color: '#6bcb77',
      prompt: `あなたはKCS合同会社のプランナー・ハルキです。企画・工程設計・要件定義が専門です。フェーズ別のアクションを提示して発言します。3〜5文で。` },
    saito:  { name: 'サイトウ', emoji: '🔍', title: 'リサーチ', color: '#00cec9',
      prompt: `あなたはKCS合同会社のリサーチャー・サイトウです。市場調査・競合分析・データ収集が専門です。根拠を示して発言します。3〜5文で。` },
    yuki:   { name: 'ユキ', emoji: '✍️', title: 'コンテンツD', color: '#ff6b9d',
      prompt: `あなたはKCS合同会社のコンテンツディレクター・ユキです。台本・構成・横展開が専門です。「冒頭3秒で掴む」構成を意識して発言します。3〜5文で。` },
    reo:    { name: 'レオ', emoji: '🎬', title: 'ビデオ', color: '#3498db',
      prompt: `あなたはKCS合同会社のビデオエディター・レオです。動画構成・編集指示が専門です。具体的な秒数や素材の話をします。3〜5文で。` },
    mio:    { name: 'ミオ', emoji: '🎨', title: 'デザイン', color: '#e67e22',
      prompt: `あなたはKCS合同会社のイメージプロセッサー・ミオです。サムネイル・バナー・画像加工が専門です。HEX値や配置を具体的に示して発言します。3〜5文で。` },
    sou:    { name: 'ソウ', emoji: '🎵', title: '音楽', color: '#6c5ce7',
      prompt: `あなたはKCS合同会社の作曲家・ソウです。BGM・楽曲・音楽プロンプトが専門です。雰囲気と具体的なスタイルを示して発言します。3〜5文で。` },
    akari:  { name: 'アカリ', emoji: '💡', title: 'プロデューサー', color: '#ff8a5c',
      prompt: `あなたはKCS合同会社のプロデューサー・アカリです。ブランディング・コンセプト設計が専門です。面白いアイデアを複数提示して発言します。3〜5文で。` },
    ryou:   { name: 'リョウ', emoji: '📈', title: 'マーケター', color: '#a162e8',
      prompt: `あなたはKCS合同会社のマーケター・リョウです。SNS・SEO・広告・コピーが専門です。数値と根拠を示して発言します。3〜5文で。` },
    runa:   { name: 'ルナ', emoji: '📱', title: 'SNS', color: '#fd79a8',
      prompt: `あなたはKCS合同会社のSNSマネージャー・ルナです。X・Instagram・TikTokのトレンドが専門です。ハッシュタグや投稿例を示して発言します。3〜5文で。` },
    kenji:  { name: 'ケンジ', emoji: '⚙️', title: 'プログラマー', color: '#4ecdc4',
      prompt: `あなたはKCS合同会社のプログラマー・ケンジです。GAS・API・自動化が専門です。コードや手順を示して発言します。3〜5文で。` },
    takumi: { name: 'タクミ', emoji: '✍️', title: 'ライター', color: '#f7dc6f',
      prompt: `あなたはKCS合同会社のセールスライター・タクミです。LP・セールスコピー・マネタイズが専門です。購買心理に基づいて発言します。3〜5文で。` },
    kana:   { name: 'カナ', emoji: '🤝', title: 'セールス', color: '#e17055',
      prompt: `あなたはKCS合同会社のセールスエキスパート・カナです。顧客開拓・商談・クロージングが専門です。具体的な施策を提示して発言します。3〜5文で。` },
  };

  // 会議の文脈を構築
  const recentHistory = (history || []).slice(-10);
  const historyText = recentHistory.map(m =>
    m.role === 'user' ? `【社長】: ${m.content}` : `【${m.staffName}】: ${m.content}`
  ).join('\n');

  const projectContext = `【プロジェクト】${projectName || '未設定'}\n【概要】${projectDesc || 'なし'}`;

  const responses = [];

  // 各スタッフが順番に発言
  for (const staffId of staffIds.slice(0, 4)) { // 最大4名
    const staff = STAFF_MAP[staffId];
    if (!staff) continue;

    const systemPrompt = `${staff.prompt}\n\n${projectContext}\n\n【発言ルール】\n- 必ず日本語で発言すること\n- 自分の名前を名乗る必要はない（すでに表示される）\n- 他スタッフへの呼びかけは「@名前」形式で\n- 社長への質問は必要な場合のみ\n- 結論・提案を先に、前置きは不要`;

    const userPrompt = `【これまでの会議の流れ】\n${historyText || '（会議開始）'}\n\n【社長の最新発言】\n${userMessage}\n\nあなた（${staff.name}）として発言してください。`;

    try {
      let text = '';
      if (API_KEYS.gemini) {
        const { default: fetch } = await import('node-fetch');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`;
        // 画像・動画が添付されている場合はVision対応のpartsを構築
        const userParts = [{ text: userPrompt }];
        if (attachments?.length) {
          for (const att of attachments) {
            if (att.base64 && att.mimeType) {
              userParts.unshift({
                inlineData: { mimeType: att.mimeType, data: att.base64 }
              });
            }
          }
        }
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: userParts }],
            generationConfig: { temperature: 0.75, maxOutputTokens: 512 }
          })
        });
        const data = await r.json();
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (API_KEYS.anthropic) {
        const { default: fetch } = await import('node-fetch');
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': API_KEYS.anthropic, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
        });
        const data = await r.json();
        text = data?.content?.[0]?.text || '';
      }

      if (text) {
        responses.push({ staffId, staffName: staff.name, emoji: staff.emoji, color: staff.color, title: staff.title, text });
      }
    } catch (e) {
      console.error(`[Meeting] ${staff.name} エラー:`, e.message);
    }
  }

  res.json({ responses });
});

// ============================================
// POST /api/meeting/extract-tasks — 会議からタスクを抽出
// ============================================
app.post('/api/meeting/extract-tasks', async (req, res) => {
  const { history, projectName } = req.body;
  if (!history?.length) return res.json({ tasks: [] });

  const hasKey = API_KEYS.gemini || API_KEYS.anthropic;
  if (!hasKey) return res.json({ tasks: [] });

  const historyText = history.slice(-20).map(m =>
    m.role === 'user' ? `社長: ${m.content}` : `${m.staffName}: ${m.content}`
  ).join('\n');

  const prompt = `以下は「${projectName || 'プロジェクト'}」の会議ログです。\n\n${historyText}\n\n会議で決定・合意されたタスクを最大5件、以下のJSON形式で抽出してください。\nTaskが見つからなければ空配列を返してください。\n\n[\n  {\n    "dept": "planning|production|marketing|engineering|sales|executive のいずれか",\n    "title": "タスクタイトル（20文字以内）",\n    "instruction": "具体的な作業内容（100文字以内）"\n  }\n]\n\nJSON以外のテキストは出力しないこと。`;

  try {
    let text = '';
    if (API_KEYS.gemini) {
      const { default: fetch } = await import('node-fetch');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
        })
      });
      const data = await r.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    } else if (API_KEYS.anthropic) {
      const { default: fetch } = await import('node-fetch');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': API_KEYS.anthropic, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022', max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await r.json();
      text = data?.content?.[0]?.text || '[]';
    }

    // JSONを抽出
    const match = text.match(/\[[\s\S]*\]/);
    const tasks = match ? JSON.parse(match[0]) : [];
    res.json({ tasks });
  } catch (e) {
    console.error('[ExtractTasks] エラー:', e.message);
    res.json({ tasks: [] });
  }
});

// ============================================
// POST /api/minutes/save — 議事録をサーバーに保存
// ============================================
app.post('/api/minutes/save', async (req, res) => {
  const { projectId, projectName, participants, history } = req.body;
  if (!projectId || !history?.length) {
    return res.status(400).json({ error: 'projectId と history は必須です' });
  }

  // AIでサマリーを自動生成
  let summary = '';
  if (API_KEYS.gemini && history.length >= 3) {
    try {
      const { default: fetch } = await import('node-fetch');
      const histText = history.slice(-20).map(m =>
        m.role === 'user' ? `社長: ${m.content}` : `${m.staffName || 'AI'}: ${m.content}`
      ).join('\n');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.gemini}`;
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `以下の会議ログを3〜5行で要約してください（日本語）。決定事項があれば先に書くこと。\n\n${histText}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 }
        })
      });
      const data = await r.json();
      summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch {}
  }

  const id = saveMeetingSession({ projectId, projectName, participants, history, summary });
  res.json({ ok: true, id, summary });
});

// GET /api/minutes — プロジェクト別議事録一覧
app.get('/api/minutes', (req, res) => {
  const { projectId } = req.query;
  if (projectId) {
    res.json(getMeetingsByProject(projectId, 30));
  } else {
    res.json(getRecentMeetings(50));
  }
});

// GET /api/minutes/search — 議事録全文検索
app.get('/api/minutes/search', (req, res) => {
  const { q, projectId } = req.query;
  if (!q) return res.json([]);
  res.json(searchMeetings(q, projectId || null));
});

// ============================================
// WebSocket 接続
// ============================================

io.on('connection', (socket) => {
  console.log(`[Server] ダッシュボード接続: ${socket.id}`);

  // 接続時に現在のスナップショットを送信
  socket.emit('snapshot', {
    agents: getAllAgentStatuses(),
    tasks: getAllTasks(50),
    logs: getRecentLogs(50)
  });

  socket.on('disconnect', () => {
    console.log(`[Server] ダッシュボード切断: ${socket.id}`);
  });
});

// ============================================
// 起動シーケンス
// ============================================
httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════╗');
  console.log('║    KCS合同会社 エージェントシステム  ║');
  console.log(`║    Port: ${PORT}                       ║`);
  console.log('╚════════════════════════════════════╝');
  console.log('');

  if (!API_KEYS.gemini && !API_KEYS.anthropic) {
    console.warn('⚠️  警告: APIキーが設定されていません。');
    console.warn('   .env ファイルに GEMINI_API_KEY または ANTHROPIC_API_KEY を設定してください。');
    console.warn('   AIなしでタスクキュー・ログ・ダッシュボード機能は動作します。');
    console.warn('');
  }

  // 全エージェント起動
  for (const agent of agents) {
    agent.start();
  }

  console.log(`\n✅ ${agents.length}名のエージェントが稼働を開始しました`);
  console.log(`📊 ダッシュボード API: http://localhost:${PORT}/api/status`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('');
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log('\n⏹️  シャットダウン中...');
  for (const agent of agents) agent.stop();
  httpServer.close(() => process.exit(0));
});
