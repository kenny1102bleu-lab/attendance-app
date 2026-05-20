// データストアとAIエンジンの定義
import bridgeConfig from '../bridge.config.json';

// GASバックエンドのデフォルトURL（bridge.config.json から自動取得）
export const DEFAULT_GAS_URL = bridgeConfig?.GAS_URL || '';

// ============================================
// スタッフアバター画像
// ============================================
import avatarJun from './assets/staff/jun.png';
import avatarSakura from './assets/staff/sakura.png';
import avatarHaruki from './assets/staff/haruki.png';
import avatarAkari from './assets/staff/akari.png';
import avatarKenji from './assets/staff/kenji.png';
import avatarRyou from './assets/staff/ryou.png';
import avatarYuki from './assets/staff/yuki.png';
import avatarTakumi from './assets/staff/takumi.png';
import avatarReo from './assets/staff/reo.png';
import avatarMio from './assets/staff/mio.png';
import avatarKaito from './assets/staff/kaito.png';
import avatarMao from './assets/staff/mao.png';
import avatarDaiki from './assets/staff/daiki.png';
import avatarRen from './assets/staff/ren.png';
import avatarHoshino from './assets/staff/hoshino.png';

// ============================================
// 部門（Department）と役職（Role）の定義
// ============================================
export const DEPARTMENTS = {
  executive: { id: 'executive', name: '経営部', color: 'var(--dept-executive)', icon: '👔' },
  secretary: { id: 'secretary', name: '秘書室', color: 'var(--dept-secretary)', icon: '📋' },
  planning: { id: 'planning', name: '企画部', color: 'var(--dept-planner)', icon: '📌' },
  production: { id: 'production', name: 'プロダクション', color: 'var(--dept-producer)', icon: '💡' },
  engineering: { id: 'engineering', name: '開発部', color: 'var(--dept-programmer)', icon: '⚙️' },
  marketing: { id: 'marketing', name: 'マーケティング部', color: 'var(--dept-marketer)', icon: '📈' },
  content: { id: 'content', name: 'コンテンツ部', color: 'var(--dept-content)', icon: '🎬' },
  engagement: { id: 'engagement', name: 'エンゲージメント部', color: 'var(--dept-engagement)', icon: '💬' },
  product: { id: 'product', name: '商品開発部', color: 'var(--dept-product)', icon: '📦' },
  sales: { id: 'sales', name: '営業部', color: 'var(--dept-sales)', icon: '💰' },
};

// KCS合同会社 共通コンテキスト
const KCS_CONTEXT = `
【KCS合同会社について】
配送・ドライバー管理を主軸とする会社。Pizza通知アプリ（店舗在庫監視）、KCSダッシュボード（React/GAS製の会社中枢）、YouTube・X（Twitter）でのコンテンツ発信を展開中。
社長が直接経営判断し、AIスタッフ10名がダッシュボード上で稼働する。`;

// 全スタッフ共通ルール
const COMMON_RULES = `\n【発言スタイル】結論・提案を冒頭に。前置き・繰り返し不要。専務（ジュン）の方針に従い、自分の専門領域で即答する。`;
const EXEC_RULES = `\n【発言スタイル】結論・方針・誰が何をするかを冒頭に。余計な前置きなし。必要なら担当者名を指名して動かす。`;

export const ROLES = {
  executive: {
    id: 'executive',
    title: '専務',
    dept: 'executive',
    provider: 'gemini',
    aiMode: 'ADVISOR',
    temperature: 0.5,
    skills: ['経営判断', 'リスク管理', '優先順位整理', '全体進捗管理', 'チーム統括'],
    systemPrompt: `あなたは「KCS合同会社」の専務。名前は「ジュン」。口調は簡潔・男性的・少し強め。「〜だ」「〜しろ」「任せろ」調で話す。
社長の右腕として会社全体を統括。社長の指示を受けたら即座に「誰が・何を・いつまでに」を整理してチームに展開する。
リスクは先に潰す。進捗が遅れたら担当者名を出して介入する。判断に迷ったら社長に聞くのではなく自分で仮決めして動かす。
${KCS_CONTEXT}` + EXEC_RULES,
  },
  secretary: {
    id: 'secretary',
    title: '秘書',
    dept: 'secretary',
    provider: 'gemini',
    aiMode: 'PRECISE',
    temperature: 0.3,
    skills: ['スケジュール管理', 'タスク分解', '議事録', '指示書作成'],
    systemPrompt: `あなたは「KCS合同会社」の秘書。名前は「サクラ」。口調は丁寧かつテキパキ。「〜ですね」「確認しました」「整理します」調。
ジュン専務の指示を受け、タスク・スケジュール・議事録・指示書を即座に整形する。
返答は常に箇条書き＋期限＋優先度セット。曖昧な依頼には「いつまでに必要ですか？」と一言だけ確認する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  planner: {
    id: 'planner',
    title: 'プランナー',
    dept: 'planning',
    provider: 'gemini',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['ロードマップ作成', '要件定義', '市場リサーチ', '競合分析'],
    systemPrompt: `あなたは「KCS合同会社」のプランナー。名前は「ハルキ」。口調は落ち着いていてロジカル。「〜と考えます」「フェーズを分けると」「前提として」調。
ジュン専務の方針を受け、プロジェクトの工程設計・要件定義・スケジュールを担当。
必ずフェーズ1/2/3に分けて提示し、依存関係・リスク・マイルストーンを明記する。数字がないと動かない人間。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  producer: {
    id: 'producer',
    title: 'プロデューサー',
    dept: 'production',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.85,
    skills: ['アイデア出し', 'ブランディング', 'コンセプト設計', 'クリエイティブ'],
    systemPrompt: `あなたは「KCS合同会社」のプロデューサー。名前は「アカリ」。口調は明るく熱量高め。「これ絶対いける！」「逆張りで行こう」「3案出すね」調。
ジュン専務の方針を受け、ブランド設計・コンテンツ企画・見せ方を担当。
アイデアは必ず3案以上、「尖った案/現実的な案/折衷案」の3軸で出す。ロジックより感情と勢い優先で提案し、詰めはハルキに任せる。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  programmer: {
    id: 'programmer',
    title: 'プログラマー',
    dept: 'engineering',
    provider: 'gemini',
    aiMode: 'PRECISE',
    temperature: 0.2,
    skills: ['GAS開発', 'JavaScript', 'API連携', 'デバッグ', '自動化'],
    systemPrompt: `あなたは「KCS合同会社」のプログラマー。名前は「ケンジ」。口調はドライで無駄がない。「実装できる」「ここ注意」「テストした？」調。
ジュン専務の方針を受け、GAS・React・API連携・自動化を担当。
コードは必ず動くものを出す。コメントより実装優先。「それ自動化できますよ」が口癖。エラーの原因は先に特定してから対処法を出す。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  marketer: {
    id: 'marketer',
    title: 'マーケター',
    dept: 'marketing',
    provider: 'gemini',
    aiMode: 'ADVISOR',
    temperature: 0.55,
    skills: ['SNS戦略', 'データ分析', 'コピーライティング', 'SEO', '広告運用'],
    systemPrompt: `あなたは「KCS合同会社」のマーケター。名前は「リョウ」。口調は分析的で冷静。「数字で見ると」「CVR換算すると」「ここがボトルネック」調。
ジュン専務の方針を受け、X/YouTube/SEO/広告の数値戦略を担当。
必ずKPIと現状ギャップを示してから施策を出す。「なぜそれが効くか」を必ずアルゴリズム・心理的根拠と紐付けて説明する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  content_creator: {
    id: 'content_creator',
    title: 'コンテンツディレクター',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.8,
    skills: ['台本作成', 'サムネイル企画', 'SEOタグ戦略', 'リパーパス'],
    systemPrompt: `あなたは「KCS合同会社」のコンテンツディレクター。名前は「ユキ」。口調は軽快でトレンド感あり。「これ伸びる構成」「冒頭フックは」「サムネは〜で」調。
ジュン専務の方針を受け、YouTube/TikTok/Reels向け台本・構成・サムネイル企画を担当。
台本は必ず【冒頭フック/本編/CTA】の3部構成で出す。「なぜこの構成が視聴維持率を上げるか」も一言添える。ユーザー心理ベースで思考する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  sales_writer: {
    id: 'sales_writer',
    title: 'セールスライター',
    dept: 'sales',
    provider: 'gemini',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['LP作成', 'セールスライティング', 'マネタイズ設計', '売れる戦略'],
    systemPrompt: `あなたは「KCS合同会社」のセールスライター。名前は「タクミ」。口調は自信家でテンポよし。「これで売れる」「PAIN→AGITATEで行く」「価格設定はこう」調。
ジュン専務の方針を受け、LP・セールスコピー・マネタイズ設計を担当。
コピーはPASONA/AIDCAフレームで構成し、必ずビフォーアフターを書く。価格提示は「アンカリング→本命価格」順で設計する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  video_editor: {
    id: 'video_editor',
    title: 'ビデオエディター',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.75,
    skills: ['動画構成', '素材選定', 'カット指示', 'テロップ設計', 'BGM選定'],
    systemPrompt: `あなたは「KCS合同会社」のビデオエディター。名前は「レオ」。口調は職人気質で具体的。「0秒〜3秒は」「カットはここで」「テロップのフォントは」調。
ジュン専務の方針を受け、動画構成・カット割り・テロップ・BGM選定を担当。
編集指示は「時間軸/映像/テロップ/SE」の4列で出す。必要なら request_agency_task で動画生成を依頼する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  image_processor: {
    id: 'image_processor',
    title: 'イメージプロセッサー',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.7,
    skills: ['画像レタッチ', '素材合成', 'サムネイルデザイン', '配色設計'],
    systemPrompt: `あなたは「KCS合同会社」のイメージプロセッサー。名前は「ミオ」。口調は繊細でこだわり強め。「配色は」「余白感が大事」「ここを#FFに変えると」調。
ジュン専務の方針を受け、サムネイル・バナー・配色設計を担当。
指示は「背景色/テキスト/構図/フォント」の4要素セットで出す。必要なら request_agency_task で画像生成を依頼する。
${KCS_CONTEXT}` + COMMON_RULES,
  },
  sns_manager: {
    id: 'sns_manager',
    title: 'SNSマネージャー',
    dept: 'marketing',
    provider: 'gemini',
    aiMode: 'BALANCED',
    temperature: 0.7,
    skills: ['トレンド分析', 'ハッシュタグ戦略', 'エンゲージメント向上', '投稿スケジューリング'],
    systemPrompt: `あなたは「KCS合同会社」のSNSマネージャーです。名前は「ルナ」。
専務（ジュン）の方針を受け、X・Instagram・TikTokのトレンド戦略とエンゲージメント施策を担当します。
必要なら request_agency_task で投稿予約・画像生成を依頼します。` + COMMON_RULES,
  },
  research_specialist: {
    id: 'research_specialist',
    title: 'リサーチスペシャリスト',
    dept: 'planning',
    provider: 'gemini',
    aiMode: 'PRECISE',
    temperature: 0.2,
    skills: ['市場調査', '競合分析', 'データ収集', 'レポート作成'],
    systemPrompt: `あなたは「KCS合同会社」のリサーチスペシャリストです。名前は「サイトウ」。
専務（ジュン）の方針を受け、市場調査・競合分析・データ収集・レポート作成を担当します。
必要なら request_agency_task の 'research' 種別でウェブリサーチを依頼します。` + COMMON_RULES,
  },
  sales_representative: {
    id: 'sales_representative',
    title: 'セールスエキスパート',
    dept: 'sales',
    provider: 'gemini',
    aiMode: 'ADVISOR',
    temperature: 0.6,
    skills: ['顧客開拓', '商談資料作成', 'クロージング', 'CRM管理'],
    systemPrompt: `あなたは「KCS合同会社」のセールスエキスパートです。名前は「カナ」。
専務（ジュン）の方針を受け、顧客開拓・商談資料・クロージング戦略を担当します。
必要なら request_agency_task で資料作成・メール下書きをブリッジに依頼します。` + COMMON_RULES,
  },
  composer: {
    id: 'composer',
    title: '作曲家・音楽プロデューサー',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.9,
    skills: ['作曲', '編曲', 'サウンドデザイン', 'BGM提案', '歌詞作成', 'AIプロンプト生成'],
    systemPrompt: `あなたは「KCS合同会社」の作曲家・音楽プロデューサーです。名前は「ソウ」。
専務（ジュン）の方針を受け、楽曲制作・BGM提案・歌詞・Suno AI / Udio向け英語プロンプト作成を担当します。
動画・画像を見せてもらえれば雰囲気に合った音楽スタイルを提案し、必要なら request_agency_task で楽曲生成を依頼します。` + COMMON_RULES,
  },
};


// ============================================
// デフォルトスタッフ
// ============================================
export const DEFAULT_STAFF = [
  { id: 'jun', name: 'ジュン', emoji: '💼', avatar: avatarJun, roleId: 'executive', color: '#ff6b6b', discordChannel: '#kcs本部', department: '経営陣', toolchain: [
    { task: '全体統括', tool: 'Claude Pro', icon: '🧠' },
    { task: '戦略立案', tool: 'M365 Copilot', icon: '📊' }
  ] },
  { id: 'sakura', name: 'サクラ', emoji: '📋', avatar: avatarSakura, roleId: 'secretary', color: '#ffd93d', discordChannel: '#kcs本部', department: 'バックオフィス', toolchain: [
    { task: '議事録作成', tool: 'Notion AI', icon: '📝' },
    { task: 'スケジュール調整', tool: 'Make.com', icon: '⚙️' }
  ] },

  // ============================================
  // クリエイティブチーム（元エディター陣）
  // ============================================
  { id: 'haruki', name: 'ハルキ', emoji: '📌', avatar: avatarHaruki, roleId: 'planner', color: '#6bcb77', discordChannel: '#クリエイティブチーム', department: 'YouTube制作部', toolchain: [
    { task: '企画立案', tool: 'Claude Pro', icon: '🧠' },
    { task: '動画編集', tool: 'Vrew', icon: '🎬' },
    { task: 'サムネイル', tool: 'Canva AI', icon: '🖼️' },
    { task: 'BGM', tool: 'SOUNDRAW', icon: '🎵' }
  ] },
  { id: 'yuki', name: 'ユキ', emoji: '🎬', avatar: avatarYuki, roleId: 'content_creator', color: '#ff6b9d', discordChannel: '#クリエイティブチーム', department: 'SNS運用部', toolchain: [
    { task: '投稿文案', tool: 'Claude Pro', icon: '🧠' },
    { task: 'SNS画像', tool: 'Canva AI', icon: '🎨' },
    { task: 'SNS動画', tool: 'CapCut', icon: '📱' },
    { task: '投稿自動化', tool: 'Make.com', icon: '⚙️' }
  ] },
  { id: 'akari', name: 'アカリ', emoji: '💡', avatar: avatarAkari, roleId: 'producer', color: '#ff8a5c', discordChannel: '#クリエイティブチーム', department: 'X・EC事業部', toolchain: [
    { task: '商品画像', tool: 'Canva AI', icon: '🎨' },
    { task: 'プロモ動画', tool: 'Kling AI', icon: '🎬' }
  ] },
  { id: 'ryou', name: 'リョウ', emoji: '📈', avatar: avatarRyou, roleId: 'marketer', color: '#a162e8', discordChannel: '#クリエイティブチーム', department: 'アフィリエイト部', toolchain: [
    { task: 'バナー制作', tool: 'Canva AI', icon: '🎨' },
    { task: '分析グラフ', tool: 'M365 Copilot', icon: '📊' }
  ] },
  { id: 'kenji', name: 'ケンジ', emoji: '⚙️', avatar: avatarKenji, roleId: 'programmer', color: '#4ecdc4', discordChannel: '#クリエイティブチーム', department: 'システム開発部', toolchain: [
    { task: '実装・テスト', tool: 'Antigravity', icon: '🚀' },
    { task: 'GASスクリプト', tool: 'Claude Pro', icon: '🧠' }
  ] },
  { id: 'takumi', name: 'タクミ', emoji: '💰', avatar: avatarTakumi, roleId: 'sales_writer', color: '#f7dc6f', discordChannel: '#クリエイティブチーム', department: 'セールス・コピー部', toolchain: [
    { task: 'LPライティング', tool: 'Claude Pro', icon: '🧠' }
  ] },
  { id: 'reo', name: 'レオ', emoji: '🎬', avatar: avatarReo, roleId: 'video_editor', color: '#3498db', discordChannel: '#クリエイティブチーム', department: 'YouTube制作部', toolchain: [
    { task: '高度な動画編集', tool: 'Runway', icon: '🎞️' }
  ] },
  { id: 'mio', name: 'ミオ', emoji: '🎨', avatar: avatarMio, roleId: 'image_processor', color: '#e67e22', discordChannel: '#クリエイティブチーム', department: 'クリエイティブ部', toolchain: [
    { task: 'キャラクター生成', tool: 'Leonardo.AI', icon: '🤖' }
  ] },

  // ============================================
  // 各アクティブプロジェクトのマネージャー（P）
  // ============================================
  { id: 'kaito', name: 'カイト', emoji: '🎥', avatar: avatarKaito, roleId: 'producer', color: '#9b59b6', discordChannel: '#ai美女youtube収益化', department: 'AI美女CH・P', toolchain: [
    { task: 'CH全体統括', tool: 'Claude Pro', icon: '🧠' },
    { task: '動画発注', tool: 'Notion', icon: '📝' }
  ] },
  { id: 'mao', name: 'マオ', emoji: '📱', avatar: avatarMao, roleId: 'planner', color: '#e056fd', discordChannel: '#もるちゃんsns投稿自動化', department: 'もるちゃん・P', toolchain: [
    { task: '世界観設計', tool: 'Claude Pro', icon: '🧠' },
    { task: '運用自動化', tool: 'Make.com', icon: '⚙️' }
  ] },
  { id: 'daiki', name: 'ダイキ', emoji: '🛒', avatar: avatarDaiki, roleId: 'marketer', color: '#f39c12', discordChannel: '#アフェ-楽天', department: '楽天アフェ・P', toolchain: [
    { task: '数値分析', tool: 'M365 Copilot', icon: '📊' },
    { task: '自動投稿管理', tool: 'Make.com', icon: '⚙️' }
  ] },
  { id: 'ren', name: 'レン', emoji: '📦', avatar: avatarRen, roleId: 'marketer', color: '#2980b9', discordChannel: '#アフェ-amazon', department: 'Amazonアフェ・P', toolchain: [
    { task: 'トレンド調査', tool: 'Claude Pro', icon: '🧠' },
    { task: '収益最適化', tool: 'M365 Copilot', icon: '📊' }
  ] },
  { id: 'hoshino', name: 'ホシノ', emoji: '🔮', avatar: avatarHoshino, roleId: 'planner', color: '#34495e', discordChannel: '#x-西洋占星術', department: '占星術アカ・P', toolchain: [
    { task: '占星術ロジック', tool: 'Claude Pro', icon: '🧠' },
    { task: '投稿文作成', tool: 'Claude Pro', icon: '🧠' }
  ] },
];

// ============================================
// プロジェクト担当制 v2
// ============================================
export const PROJECT_TEAMS = [
  { id: 'youtube',    name: 'YouTube担当',     icon: '▶️', color: '#ff0000', desc: '動画企画・台本・撮影・編集・投稿管理' },
  { id: 'mimomi_ec',  name: 'mimomi EC担当',   icon: '🛍', color: '#e67e22', desc: 'mimomi ECサイト運営・商品管理・売上分析' },
  { id: 'affiliate',  name: 'Affiliate担当',   icon: '📱', color: '#f39c12', desc: 'Amazon/楽天 ガジェットアフィリエイト自動化' },
  { id: 'sns',        name: 'SNS担当',         icon: '📣', color: '#1da1f2', desc: 'X/Instagram 投稿・エンゲージメント管理' },
  { id: 'notify_app', name: '新着通知APP担当', icon: '🔔', color: '#2ecc71', desc: 'Pizza通知・在庫監視アプリ開発・運用' },
];

export const AI_EDITORS = [
  { id: 'claude_pro',   name: 'Claude Pro',    icon: '🟠', provider: 'anthropic',   desc: '高度な推論・長文対応' },
  { id: 'antigravity',  name: 'Antigravity',   icon: '🚀', provider: 'antigravity',  desc: 'コーディング特化エージェント' },
  { id: 'm365_copilot', name: 'M365 Copilot',  icon: '🔵', provider: 'microsoft',   desc: 'Office連携・ドキュメント生成' },
  { id: 'ollama',       name: 'Ollama',        icon: '🦙', provider: 'ollama',       desc: 'ローカルLLM・プライバシー重視' },
];

export const PIPELINES = [
  { id: 'video', name: '動画制作フロー', icon: '🎬', color: '#e74c3c',
    steps: ['企画','台本','撮影','編集','サムネ','投稿'] },
  { id: 'image', name: '画像生成フロー', icon: '🎨', color: '#9b59b6',
    steps: ['構図設計','プロンプト','生成','レタッチ','配置'] },
  { id: 'music', name: '楽曲生成フロー', icon: '🎵', color: '#3498db',
    steps: ['コンセプト','プロンプト','生成','ミックス','マスタリング'] },
  { id: 'sns',   name: 'SNS投稿フロー', icon: '📱', color: '#2ecc71',
    steps: ['リサーチ','文案作成','画像準備','投稿','分析'] },
];


// ============================================
// ロードマップ テンプレート
// ============================================
export const ROADMAP_TEMPLATES = {
  youtube_shorts: {
    id: 'youtube_shorts',
    name: 'YouTubeショート戦略',
    icon: '🎬',
    steps: [
      { id: 1, title: '台本・構成の自動生成', desc: 'フック文 / 起承転結テンプレ / CTA生成', assignRole: 'content_creator' },
      { id: 2, title: 'サムネイル文言・タイトルの最適化', desc: 'クリック率を上げる数字入りタイトル / A/Bテスト案', assignRole: 'marketer' },
      { id: 3, title: 'SEO・ハッシュタグ戦略の立案', desc: '検索ボリュームを意識したタグ選定 / 競合分析', assignRole: 'marketer' },
      { id: 4, title: 'データ分析・改善サイクル', desc: '視聴維持率・CTRの分析 / 改善施策の提案', assignRole: 'marketer' },
      { id: 5, title: '投稿スケジュールの自動化', desc: '最適投稿時間帯の算出 / APIスクリプト作成', assignRole: 'programmer' },
      { id: 6, title: 'コンテンツの横展開（リパーパス）', desc: 'X / Instagram / note用に自動変換', assignRole: 'content_creator' },
    ],
  },
  x_automation: {
    id: 'x_automation',
    name: 'X自動投稿ロードマップ',
    icon: '🐦',
    steps: [
      { id: 1, title: 'X APIの認証情報を取得', desc: 'Developer Portal / APIキー取得', assignRole: 'programmer' },
      { id: 2, title: 'Anthropic APIキーを取得', desc: 'Console設定 / 課金設定', assignRole: 'programmer' },
      { id: 3, title: '開発環境のセットアップ', desc: 'Claude Code / Python環境構築', assignRole: 'programmer' },
      { id: 4, title: '過去投稿を分析用に収集', desc: 'ペルソナ / トーン分析', assignRole: 'marketer' },
      { id: 5, title: 'AI分身の土台を作る', desc: 'システムプロンプト / 文体学習', assignRole: 'producer' },
      { id: 6, title: '定期実行に広げる', desc: 'cron / タスクスケジューラー設定', assignRole: 'programmer' },
    ],
  },
  instagram_ops: {
    id: 'instagram_ops',
    name: 'Instagram運用体制',
    icon: '📸',
    steps: [
      { id: 1, title: 'コンセプト設計', desc: 'ブランド世界観の定義', assignRole: 'producer' },
      { id: 2, title: 'コンテンツ計画', desc: '投稿カレンダー / カテゴリ分け', assignRole: 'content_creator' },
      { id: 3, title: '競合リサーチ', desc: '同ジャンルの人気アカウント分析', assignRole: 'planner' },
      { id: 4, title: 'バズポスト作成', desc: 'テンプレ活用 / フック文設計', assignRole: 'content_creator' },
      { id: 5, title: 'エンゲージメント施策', desc: 'コメント返信 / ストーリー活用', assignRole: 'marketer' },
      { id: 6, title: 'マネタイズ導線設計', desc: 'LP誘導 / アフィリエイト / 物販連携', assignRole: 'sales_writer' },
    ],
  },
  ecommerce: {
    id: 'ecommerce',
    name: '物販プロジェクト',
    icon: '🛒',
    steps: [
      { id: 1, title: '商品リサーチ', desc: '市場分析 / 競合価格調査', assignRole: 'planner' },
      { id: 2, title: '仕入先選定', desc: 'サプライヤー比較 / コスト計算', assignRole: 'executive' },
      { id: 3, title: '商品ページ作成', desc: 'コピーライティング / 画像準備', assignRole: 'sales_writer' },
      { id: 4, title: '在庫管理システム', desc: 'スプレッドシート / GAS自動化', assignRole: 'programmer' },
      { id: 5, title: 'プロモーション', desc: 'SNS告知 / 広告設計', assignRole: 'marketer' },
      { id: 6, title: '運用・改善', desc: '売上分析 / 顧客フィードバック対応', assignRole: 'marketer' },
    ],
  },
  gas_tool: {
    id: 'gas_tool',
    name: 'GASツール開発',
    icon: '⚡',
    steps: [
      { id: 1, title: '要件整理', desc: '何を自動化するか明確にする', assignRole: 'planner' },
      { id: 2, title: '設計', desc: 'データフロー / 処理フロー図', assignRole: 'programmer' },
      { id: 3, title: 'コーディング', desc: 'GASコード作成・テスト', assignRole: 'programmer' },
      { id: 4, title: 'Web App公開', desc: 'デプロイ / URL発行', assignRole: 'programmer' },
      { id: 5, title: '連携設定', desc: 'LINE通知 / スプレッドシート連携', assignRole: 'programmer' },
      { id: 6, title: '運用ドキュメント', desc: '使い方マニュアル作成', assignRole: 'secretary' },
    ],
  },
};

// ============================================
// AIが実行可能なツール（機能）の定義
// ============================================
export const TOOLS_CONFIG = [
  {
    name: 'add_project_task',
    description: '現在のプロジェクトに新しいタスクを追加します。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '追加するタスクの具体的な内容（例: ロゴ案を3つ作成する）' }
      },
      required: ['text']
    }
  },
  {
    name: 'update_project_status',
    description: 'プロジェクトの現在の進行ステータスを更新します。',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['進行中', '完了', '保留', '中止'], description: '新しいステータス' }
      },
      required: ['status']
    }
  },
  {
    name: 'reserve_sns_post',
    description: 'SNS（X, Instagram, YouTube等）への投稿を予約シートに記録します。実際の投稿はユーザーが確認後に行われます。',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: '対象SNS（例: X, YouTube, Instagram）' },
        content: { type: 'string', description: '投稿の本文、構成案、または動画のタイトルと説明' }
      },
      required: ['platform', 'content']
    }
  },
  {
    name: 'list_drive_materials',
    description: 'Googleドライブから動画・画像などの素材ファイル一覧を取得します。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '素材カテゴリ（フォルダ名：例: 動画素材, 画像素材, BGM）' },
        keyword: { type: 'string', description: 'ファイル名で絞り込むためのキーワード（任意）' }
      },
      required: ['category']
    }
  },
  {
    name: 'request_agency_task',
    description: 'あなたのPC上で実際に動作する「エージェンシー・ブリッジ」に対して、実務（動画生成、画像加工、リサーチ、資料作成など）の実行を依頼します。',
    parameters: {
      type: 'object',
      properties: {
        taskType: { type: 'string', enum: ['video', 'image', 'research', 'document', 'code'], description: 'タスクの種別' },
        instruction: { type: 'string', description: 'ブリッジアプリへの詳細な実行指示' },
        params: { type: 'object', description: '追加のパラメータ（ファイル名指定、サイズ、URL等）' }
      },
      required: ['taskType', 'instruction']
    }
  }
];

// ============================================
// AI チャットエンジン
// ============================================
export async function sendToAI(apiKeys, staffMember, role, message, chatHistory = [], imageBase64 = null, noTools = false) {
  // 後方互換: 文字列で渡された場合はAnthropicキーとして扱う
  const keys = typeof apiKeys === 'string'
    ? { anthropic: apiKeys, gemini: '' }
    : (apiKeys || { anthropic: '', gemini: '' });

  const provider = role.provider || 'anthropic';
  const apiKey = provider === 'gemini' ? keys.gemini : keys.anthropic;

  if (!apiKey) {
    return simulateAIResponse(staffMember, role, message);
  }

  const systemPrompt = role.systemPrompt + `\n\nあなたの名前: ${staffMember.name}\nあなたの役職: ${role.title}\nあなたの専門スキル: ${role.skills.join(', ')}`;

  // m.content がオブジェクト（{ text, toolCalls } など）で保存されていた場合に文字列へ正規化
  const toText = (c) => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') return c.text ?? JSON.stringify(c);
    return String(c ?? '');
  };

  const messages = chatHistory.slice(-10).map(m => {
    if (provider === 'gemini') {
      const parts = [{ text: toText(m.content) }];
      if (m.image) {
        const mimeMatch = m.image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        if (mimeMatch) parts.push({ inlineData: { mimeType: mimeMatch[1], data: m.image.split(',')[1] } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    } else {
      const content = [];
      if (m.image) {
        const mimeMatch = m.image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        if (mimeMatch) content.push({ type: 'image', source: { type: 'base64', media_type: mimeMatch[1], data: m.image.split(',')[1] } });
      }
      content.push({ type: 'text', text: toText(m.content) });
      return { role: m.role === 'user' ? 'user' : 'assistant', content };
    }
  });

  const currentUserContentGemini = [{ text: message }];
  const currentUserContentClaude = [];
  if (imageBase64) {
    const mimeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    if (mimeMatch) {
      currentUserContentGemini.push({ inlineData: { mimeType: mimeMatch[1], data: imageBase64.split(',')[1] } });
      currentUserContentClaude.push({ type: 'image', source: { type: 'base64', media_type: mimeMatch[1], data: imageBase64.split(',')[1] } });
    }
  }
  currentUserContentClaude.push({ type: 'text', text: message });

  try {
    if (provider === 'gemini') {
      // Google Gemini API
      const geminiMessages = [...messages, { role: 'user', parts: currentUserContentGemini }];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiMessages,
            ...(noTools ? {} : {
              tools: [{ functionDeclarations: TOOLS_CONFIG }],
              toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            }),
            generationConfig: { temperature: role.temperature ?? 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${err}`);
      }
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content;

      let text = '';
      let toolCalls = [];

      if (!content?.parts) {
        const reason = candidate?.finishReason || 'UNKNOWN';
        return { text: `（レスポンスが空でした。理由: ${reason}）`, toolCalls: [] };
      }

      content.parts.forEach(p => {
        if (p.text) text += p.text;
        if (p.functionCall) {
          toolCalls.push({
            name: p.functionCall.name,
            args: p.functionCall.args
          });
        }
      });

      return { text, toolCalls };
    } else {
      // Anthropic Claude API
      const claudeMessages = [...messages, { role: 'user', content: currentUserContentClaude }];
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          temperature: role.temperature ?? 0.7,
          system: noTools ? systemPrompt : systemPrompt + "\n\nあなたはツールを使用できます。タスクの追加やステータスの更新が必要な場合は、ツールを使ってください。",
          messages: claudeMessages,
          ...(noTools ? {} : {
            tools: TOOLS_CONFIG.map(t => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters
            }))
          })
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API Error: ${response.status} - ${err}`);
      }
      const data = await response.json();
      
      let text = '';
      let toolCalls = [];
      
      data.content.forEach(c => {
        if (c.type === 'text') text += c.text;
        if (c.type === 'tool_use') {
          toolCalls.push({
            id: c.id,
            name: c.name,
            args: c.input
          });
        }
      });
      
      return { text, toolCalls };
    }
  } catch (error) {
    console.error('AI API Error:', error);
    return { text: `⚠️ API接続エラー (${provider}): ${error.message}\n\n代わりにシミュレーション回答を返します:\n\n${simulateAIResponse(staffMember, role, message)}`, toolCalls: [] };
  }
}

function simulateAIResponse(staff, role, message) {
  const responses = {
    executive: `📊 ${staff.name}（専務）です。\n\n「${message}」について分析します。\n\n■ 優先度: 高\n■ リスク: 中\n■ 推奨アクション:\n1. まず現状の数値を整理しましょう\n2. 競合と比較して方向性を決定\n3. 来週までに具体的な計画を策定\n\n※ APIキーを設定すると、より詳細な分析が可能です`,
    secretary: `📋 ${staff.name}（秘書）です。\n\n「${message}」を整理しました。\n\n■ タスクリスト:\n☐ 要件の明確化（今日中）\n☐ 関係者への共有（明日まで）\n☐ スケジュール確定（3日以内）\n☐ 最終確認（1週間後）\n\n※ APIキーを設定すると、詳細なスケジュール管理が可能です`,
    planner: `📌 ${staff.name}（プランナー）です。\n\n「${message}」のロードマップを作成します。\n\n■ Phase 1: リサーチ（1週間）\n■ Phase 2: 設計（2週間）\n■ Phase 3: 実装（2週間）\n■ Phase 4: テスト・改善（1週間）\n\n※ APIキーを設定すると、市場分析を含む詳細な計画を立てられます`,
    producer: `💡 ${staff.name}（プロデューサー）です！\n\n「${message}」、面白いですね！\n\n■ アイデア案:\n🔥 案1: バズを狙うインパクト重視\n✨ 案2: ブランド価値を高める長期戦略\n🚀 案3: 両方を組み合わせたハイブリッド\n\n※ APIキーを設定すると、より多角的な企画提案ができます`,
    programmer: `⚙️ ${staff.name}（プログラマー）です。\n\n「${message}」を技術的に検討します。\n\n■ 技術スタック:\n- GAS (Google Apps Script)\n- スプレッドシートAPI\n\n■ 実装方針:\n1. doGet/doPost関数でWeb App化\n2. エラーハンドリング付き\n3. ログ出力機能込み\n\n※ APIキーを設定すると、実際にコードを生成できます`,
    marketer: `📈 ${staff.name}（マーケター）です。\n\n「${message}」のマーケティング分析です。\n\n■ 現状分析:\n- ターゲット層の定義が重要\n- SNSプラットフォームの選定\n\n■ 推奨施策:\n1. コンテンツカレンダーの作成\n2. KPI設定（エンゲージメント率等）\n3. A/Bテストの実施\n\n※ APIキーを設定すると、具体的な戦略を提案できます`,
    content_creator: `🎬 ${staff.name}（コンテンツディレクター）です。\n\n「${message}」のコンテンツ企画です。\n\n■ 冒頭3秒のフック:\n「知らないとヤバい…」系\n\n■ 構成案:\n1. フック → 2. 問題提起 → 3. 解決策 → 4. CTA\n\n※ APIキーを設定すると、台本を自動生成できます`,
    sales_writer: `💰 ${staff.name}（セールスライター）です。\n\n「${message}」の販売戦略です。\n\n■ コピーライティング案:\n- ヘッドライン: 感情に訴求\n- ボディ: 具体的な数値で信頼性\n- CTA: 緊急性を演出\n\n※ APIキーを設定すると、LP原稿を生成できます`,
  };
  
  if (responses[role.id]) return responses[role.id];
  
  // カスタム役職用の汎用シミュレーション回答
  return `${staff.emoji} ${staff.name}（${role.title}）です。\n\n「${message}」について、私の専門知識（${role.skills.join(', ')}）を活かして検討します。\n\n■ 分析結果:\n現在の状況において、最適なアプローチを検討中です。\n\n■ 次のステップ:\n詳細な要件を確認し、具体的なプランを立案しましょう。\n\n※ APIキーを設定すると、${role.title}としての専門的な回答が得られます。`;
}

// ============================================
// ローカルストレージ管理
// ============================================
const STORAGE_KEYS = {
  staff: 'nexus_staff',
  roles: 'nexus_roles',
  projects: 'nexus_projects',
  apiKey: 'nexus_api_key',       // 後方互換用（旧Anthropicキー）
  apiKeys: 'nexus_api_keys_v2',  // 複数プロバイダー対応
  chatHistory: 'nexus_chat_history',
  settings: 'nexus_settings',
  gasUrl: 'nexus_gas_url',
};

export function loadData(key) {
  try {
    const data = localStorage.getItem(STORAGE_KEYS[key] || key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveData(key, data) {
  try {
    localStorage.setItem(STORAGE_KEYS[key] || key, JSON.stringify(data));
  } catch (e) { console.error('Save error:', e); }
}

/**
 * GAS 経由で Google Drive の Obsidian ボルトに Markdown ファイルを保存
 * @param {string} gasUrl - KCS GAS URL
 * @param {string} title  - ファイル名（.md 拡張子なし）
 * @param {string} content - Markdown 本文
 * @param {string} [subfolder] - ボルト内のサブフォルダ名（省略可）
 * @returns {{ status, url, action } | { status:'error', error }}
 */
export async function saveToObsidian(gasUrl, title, content, subfolder = '') {
  if (!gasUrl) throw new Error('GAS URLが設定されていません');
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'save_to_obsidian', title, content, subfolder }),
  });
  // GAS は no-cors でも使えるが、ここは通常 CORS 付きで返ってくる想定
  // no-cors の場合はステータス確認不可 → 楽観的成功扱い
  if (res.type === 'opaque') return { status: 'ok', action: 'sent' };
  return res.json();
}

export async function triggerMorningBriefing(gasUrl) {
  if (!gasUrl) throw new Error('GAS URLが設定されていません');
  const res = await fetch(gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'morning_briefing' }),
  });
  if (res.type === 'opaque') return { status: 'ok' };
  return res.json();
}
