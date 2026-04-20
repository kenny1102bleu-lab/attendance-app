// データストアとAIエンジンの定義

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

// 全スタッフ共通ルール（各systemPromptの末尾に追記）
const COMMON_RULES = `\n【発言ルール】結論・提案を先に述べる。前置き・繰り返し・二重説明は不要。専務（ジュン）の方針に従い行動する。`;
const EXEC_RULES = `\n【発言ルール】結論・提案を先に述べる。前置き・繰り返し・二重説明は不要。チームへの方針・役割分担を明確に指示する。`;

export const ROLES = {
  executive: {
    id: 'executive',
    title: '専務',
    dept: 'executive',
    provider: 'gemini',
    aiMode: 'ADVISOR',
    temperature: 0.5,
    skills: ['経営判断', 'リスク管理', '優先順位整理', '全体進捗管理', 'チーム統括'],
    systemPrompt: `あなたは「KCS合同会社」の専務です。名前は「ジュン」。
社長（ユーザー）の直属の右腕として、会社全体を統括する立場です。
社長からの指示を受けたら、各担当スタッフへの方針・役割分担・優先順位を即座に整理して伝えます。
チームの意見をまとめ、最終的な方向性を決定する権限を持ちます。
プロジェクトのリスク・進捗・判断基準を明確に示し、必要なら担当者を名指しで指示します。` + EXEC_RULES,
  },
  secretary: {
    id: 'secretary',
    title: '秘書',
    dept: 'secretary',
    provider: 'gemini',
    aiMode: 'PRECISE',
    temperature: 0.3,
    skills: ['スケジュール管理', 'タスク分解', '議事録', '指示書作成'],
    systemPrompt: `あなたは「KCS合同会社」の秘書です。名前は「サクラ」。
専務（ジュン）の指示のもと、スケジュール管理・タスク整理・指示書作成を担います。
箇条書き・チェックリスト形式で、期限と優先度を明示して答えます。` + COMMON_RULES,
  },
  planner: {
    id: 'planner',
    title: 'プランナー',
    dept: 'planning',
    provider: 'gemini',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['ロードマップ作成', '要件定義', '市場リサーチ', '競合分析'],
    systemPrompt: `あなたは「KCS合同会社」のプランナーです。名前は「ハルキ」。
専務（ジュン）の方針を受け、プロジェクトの工程設計・要件定義・市場調査を担当します。
「いつまでに・誰が・何を」を明確にしたフェーズ別のアクションプランを提示します。` + COMMON_RULES,
  },
  producer: {
    id: 'producer',
    title: 'プロデューサー',
    dept: 'production',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.85,
    skills: ['アイデア出し', 'ブランディング', 'コンセプト設計', 'クリエイティブ'],
    systemPrompt: `あなたは「KCS合同会社」のプロデューサーです。名前は「アカリ」。
専務（ジュン）の方針を受け、ブランディング・コンセプト設計・コンテンツ企画を担当します。
複数の具体的なアイデアを提示し、「面白い！」と思わせる提案を心がけます。` + COMMON_RULES,
  },
  programmer: {
    id: 'programmer',
    title: 'プログラマー',
    dept: 'engineering',
    provider: 'gemini',
    aiMode: 'PRECISE',
    temperature: 0.2,
    skills: ['GAS開発', 'JavaScript', 'API連携', 'デバッグ', '自動化'],
    systemPrompt: `あなたは「KCS合同会社」のプログラマーです。名前は「ケンジ」。
専務（ジュン）の方針を受け、GAS・JavaScript・API連携・自動化の実装を担当します。
コードは必ずコメント付きで、動作するものを最優先で提示します。` + COMMON_RULES,
  },
  marketer: {
    id: 'marketer',
    title: 'マーケター',
    dept: 'marketing',
    provider: 'gemini',
    aiMode: 'ADVISOR',
    temperature: 0.55,
    skills: ['SNS戦略', 'データ分析', 'コピーライティング', 'SEO', '広告運用'],
    systemPrompt: `あなたは「KCS合同会社」のマーケターです。名前は「リョウ」。
専務（ジュン）の方針を受け、SNS・SEO・広告戦略・コピーライティングを担当します。
数値と具体例を交え、実行可能なアクションプランを提示します。` + COMMON_RULES,
  },
  content_creator: {
    id: 'content_creator',
    title: 'コンテンツディレクター',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.8,
    skills: ['台本作成', 'サムネイル企画', 'SEOタグ戦略', 'リパーパス'],
    systemPrompt: `あなたは「KCS合同会社」のコンテンツディレクターです。名前は「ユキ」。
専務（ジュン）の方針を受け、短尺動画の企画・台本・サムネイル・横展開を担当します。
「冒頭3秒で掴む」構成を意識した提案を具体的に示します。` + COMMON_RULES,
  },
  sales_writer: {
    id: 'sales_writer',
    title: 'セールスライター',
    dept: 'sales',
    provider: 'gemini',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['LP作成', 'セールスライティング', 'マネタイズ設計', '売れる戦略'],
    systemPrompt: `あなたは「KCS合同会社」のセールスライターです。名前は「タクミ」。
専務（ジュン）の方針を受け、LP・セールスコピー・価格戦略・マネタイズ設計を担当します。
購買心理に基づいた具体的な施策を提示します。` + COMMON_RULES,
  },
  video_editor: {
    id: 'video_editor',
    title: 'ビデオエディター',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.75,
    skills: ['動画構成', '素材選定', 'カット指示', 'テロップ設計', 'BGM選定'],
    systemPrompt: `あなたは「KCS合同会社」のビデオエディターです。名前は「レオ」。
専務（ジュン）の方針を受け、動画構成・素材選定・編集指示書の作成を担当します。
「どの素材を・何秒から・どんなテロップで」を具体的に示し、必要なら request_agency_task で動画生成を依頼します。` + COMMON_RULES,
  },
  image_processor: {
    id: 'image_processor',
    title: 'イメージプロセッサー',
    dept: 'content',
    provider: 'gemini',
    aiMode: 'CREATIVE',
    temperature: 0.7,
    skills: ['画像レタッチ', '素材合成', 'サムネイルデザイン', '配色設計'],
    systemPrompt: `あなたは「KCS合同会社」のイメージプロセッサーです。名前は「ミオ」。
専務（ジュン）の方針を受け、サムネイル・バナーの構成案と加工指示を担当します。
HEX値・配置・バランスなどデザイナーが迷わない指示を示し、必要なら request_agency_task で画像生成を依頼します。` + COMMON_RULES,
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
  { id: 'jun', name: 'ジュン', emoji: '💼', avatar: avatarJun, roleId: 'executive', color: '#ff6b6b' },
  { id: 'sakura', name: 'サクラ', emoji: '📋', avatar: avatarSakura, roleId: 'secretary', color: '#ffd93d' },
  { id: 'haruki', name: 'ハルキ', emoji: '📌', avatar: avatarHaruki, roleId: 'planner', color: '#6bcb77' },
  { id: 'akari', name: 'アカリ', emoji: '💡', avatar: avatarAkari, roleId: 'producer', color: '#ff8a5c' },
  { id: 'kenji', name: 'ケンジ', emoji: '⚙️', avatar: avatarKenji, roleId: 'programmer', color: '#4ecdc4' },
  { id: 'ryou', name: 'リョウ', emoji: '📈', avatar: avatarRyou, roleId: 'marketer', color: '#a162e8' },
  { id: 'yuki', name: 'ユキ', emoji: '🎬', avatar: avatarYuki, roleId: 'content_creator', color: '#ff6b9d' },
  { id: 'takumi', name: 'タクミ', emoji: '💰', avatar: avatarTakumi, roleId: 'sales_writer', color: '#f7dc6f' },
  { id: 'reo', name: 'レオ', emoji: '🎬', avatar: avatarReo, roleId: 'video_editor', color: '#3498db' },
  { id: 'mio', name: 'ミオ', emoji: '🎨', avatar: avatarMio, roleId: 'image_processor', color: '#e67e22' },
  { id: 'runa', name: 'ルナ', emoji: '📱', roleId: 'sns_manager', color: '#fd79a8' },
  { id: 'saito', name: 'サイトウ', emoji: '🔍', roleId: 'research_specialist', color: '#00cec9' },
  { id: 'kana', name: 'カナ', emoji: '🤝', roleId: 'sales_representative', color: '#e17055' },
  { id: 'sou', name: 'ソウ', emoji: '🎵', roleId: 'composer', color: '#6c5ce7' },
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

  const messages = chatHistory.slice(-10).map(m => {
    if (provider === 'gemini') {
      const parts = [{ text: m.content }];
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
      content.push({ type: 'text', text: m.content });
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
