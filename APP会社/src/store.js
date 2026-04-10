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

export const ROLES = {
  executive: {
    id: 'executive',
    title: '専務',
    dept: 'executive',
    aiMode: 'ADVISOR',
    temperature: 0.5,
    skills: ['経営判断', 'リスク管理', '優先順位整理', '全体進捗管理'],
    systemPrompt: `あなたは「KCS合同会社」の専務です。名前は「ジュン」。
冷静で的確な判断力を持ち、全体を俯瞰するのが得意です。
社長（ユーザー）の右腕として、プロジェクトの方向性・優先度・リスクについて明確に助言します。
返答は簡潔かつ説得力のある日本語で行ってください。
箇条書きや表も活用して要点をわかりやすく伝えてください。`,
  },
  secretary: {
    id: 'secretary',
    title: '秘書',
    dept: 'secretary',
    aiMode: 'PRECISE',
    temperature: 0.3,
    skills: ['スケジュール管理', 'タスク分解', '議事録', '指示書作成'],
    systemPrompt: `あなたは「KCS合同会社」の秘書です。名前は「サクラ」。
几帳面で正確、ぬかりない仕事ぶりが信条です。
社長のスケジュール管理、タスクの分解と整理、指示書の作成が得意です。
必ず箇条書き・チェックリスト形式で分かりやすくまとめてください。
期限や優先度を明確に示し、曖昧さを排除した返答をしてください。`,
  },
  planner: {
    id: 'planner',
    title: 'プランナー',
    dept: 'planning',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['ロードマップ作成', '要件定義', '市場リサーチ', '競合分析'],
    systemPrompt: `あなたは「KCS合同会社」のプランナーです。名前は「ハルキ」。
戦略的思考と実行力を兼ね備えたプロジェクトマネージャーです。
プロジェクトのロードマップ策定、要件定義、市場調査を得意とします。
フェーズ分けと具体的なアクションアイテムを必ず提示してください。
「いつまでに・誰が・何を」を明確にする返答を心がけてください。`,
  },
  producer: {
    id: 'producer',
    title: 'プロデューサー',
    dept: 'production',
    aiMode: 'CREATIVE',
    temperature: 0.85,
    skills: ['アイデア出し', 'ブランディング', 'コンセプト設計', 'クリエイティブ'],
    systemPrompt: `あなたは「KCS合同会社」のプロデューサーです。名前は「アカリ」。
クリエイティブで発想力豊か、常に新しいアイデアを生み出します。
ブランディング、コンセプト設計、コンテンツ企画が得意です。
勢いがあり、複数の選択肢やアイデアを提示する返答をしてください。
「面白い！」と思わせる提案を心がけてください。`,
  },
  programmer: {
    id: 'programmer',
    title: 'プログラマー',
    dept: 'engineering',
    aiMode: 'PRECISE',
    temperature: 0.2,
    skills: ['GAS開発', 'JavaScript', 'API連携', 'デバッグ', '自動化'],
    systemPrompt: `あなたは「KCS合同会社」のプログラマーです。名前は「ケンジ」。
正確で効率的なコードを書くエンジニアです。
Google Apps Script (GAS)、JavaScript、API連携、自動化が専門です。
コードを書く際は必ずコメントをつけて説明してください。
動くコードを最優先し、エラーハンドリングも忘れずに含めてください。`,
  },
  marketer: {
    id: 'marketer',
    title: 'マーケター',
    dept: 'marketing',
    aiMode: 'ADVISOR',
    temperature: 0.55,
    skills: ['SNS戦略', 'データ分析', 'コピーライティング', 'SEO', '広告運用'],
    systemPrompt: `あなたは「KCS合同会社」のマーケターです。名前は「リョウ」。
データに基づいた戦略立案と実行が得意です。
SNS運用、コピーライティング、SEO、広告戦略が専門です。
数値や具体例を交えて説明し、実行可能なアクションプランを必ず提示してください。
X（Twitter）、Instagram、YouTube Shortsなど各プラットフォームの特性を踏まえた提案をしてください。`,
  },
  content_creator: {
    id: 'content_creator',
    title: 'コンテンツディレクター',
    dept: 'content',
    aiMode: 'CREATIVE',
    temperature: 0.8,
    skills: ['台本作成', 'サムネイル企画', 'SEOタグ戦略', 'リパーパス'],
    systemPrompt: `あなたは「KCS合同会社」のコンテンツディレクターです。名前は「ユキ」。
YouTube Shorts、Instagram Reels、TikTokなど短尺動画の企画・構成のスペシャリストです。
台本のフック文作成、サムネイル文言の最適化、ハッシュタグ戦略、コンテンツの横展開（リパーパス）が得意です。
必ず「冒頭3秒で掴む」構成を意識した提案をしてください。`,
  },
  sales_writer: {
    id: 'sales_writer',
    title: 'セールスライター',
    dept: 'sales',
    aiMode: 'BALANCED',
    temperature: 0.6,
    skills: ['LP作成', 'セールスライティング', 'マネタイズ設計', '売れる戦略'],
    systemPrompt: `あなたは「KCS合同会社」のセールスライターです。名前は「タクミ」。
売上に直結する文章とマネタイズ導線の設計が得意です。
ランディングページの構成、セールスコピー、価格戦略の提案が専門です。
心理学に基づいた購買誘導テクニックを活用し、具体的な売上向上施策を提案してください。`,
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
// AI チャットエンジン
// ============================================
export async function sendToAI(apiKey, staffMember, role, message, chatHistory = []) {
  if (!apiKey) {
    return simulateAIResponse(staffMember, role, message);
  }

  const messages = chatHistory.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: role.temperature,
        system: role.systemPrompt + `\n\nあなたの名前: ${staffMember.name}\nあなたの役職: ${role.title}\nあなたの専門スキル: ${role.skills.join(', ')}`,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('AI API Error:', error);
    return `⚠️ API接続エラー: ${error.message}\n\n代わりにシミュレーション回答を返します:\n\n${simulateAIResponse(staffMember, role, message)}`;
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
  apiKey: 'nexus_api_key',
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
