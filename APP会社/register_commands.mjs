// Discord スラッシュコマンド登録スクリプト
// 実行: node c:\tmp\register_commands.mjs <BOT_TOKEN>

const TOKEN  = process.argv[2];
const APP_ID = '1494714160829693992';

if (!TOKEN) {
  console.error('使い方: node register_commands.mjs <BOT_TOKEN>');
  process.exit(1);
}

const commands = [
  { name: 'help',       description: 'KCS Botのコマンド一覧を表示' },
  { name: 'status',     description: '進行中プロジェクトの状況を確認' },
  { name: 'attendance', description: '本日の出勤状況を確認' },
  { name: 'stock',      description: 'Pizza在庫を確認' },
  { name: 'ask',        description: 'AIに質問する（Gemini）',
    options: [{ type: 3, name: 'query', description: '質問内容', required: true }] },
  { name: 'briefing',   description: '朝ブリーフィングを手動実行' },
  { name: 'hal',        description: 'HAL投稿案3パターン生成',
    options: [{ type: 3, name: 'theme', description: 'テーマ', required: true }] },
  { name: 'sunakkun',   description: 'すなくん投稿案生成',
    options: [{ type: 3, name: 'theme', description: '商品テーマ', required: true }] },
  { name: 'daily',      description: '日次レポートを手動生成' },
  { name: 'knowledge',  description: '画像orメモを保存→Gemini解析+GitHub',
    options: [
      { type: 3,  name: 'memo',  description: 'テキストメモ', required: false },
      { type: 11, name: 'image', description: '画像ファイル', required: false }
    ]},
  { name: 'approve',    description: 'HAL投稿をXに公開',
    options: [{ type: 3, name: 'id', description: '投稿ID', required: true }] },
  { name: 'hp',         description: 'HP制作タスク追加',
    options: [{ type: 3, name: 'content', description: 'タスク内容', required: true }] },
  { name: 'ec',         description: 'EC構築タスク追加',
    options: [{ type: 3, name: 'content', description: 'タスク内容', required: true }] },
];

const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bot ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commands)
});

const data = await res.json();
if (res.ok) {
  console.log(`✅ ${data.length}個のコマンドを登録しました！`);
  data.forEach(c => console.log(` - /${c.name}`));
} else {
  console.error('❌ 失敗:', res.status, JSON.stringify(data));
}
