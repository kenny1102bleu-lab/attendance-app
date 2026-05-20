import { useState } from 'react';

const TEMPLATES = [
  {
    id: 'morning',
    icon: '🌅',
    category: '朝礼',
    label: '朝礼指示',
    color: '#f97316',
    text: `【朝礼指示】

今日の方向性：
- HAL（AI美女）：[推し活/ファッション/美容/グルメ/バズネタ]
- アフィリエイト（すなくん）：[Amazon/楽天/特定ジャンル]
- その他プロジェクト：[あれば記載]

特記事項：[あれば記載]

上記の方向性で、今日の実行タスクを自動生成してください。
各プロジェクトの具体的な投稿案・実行スケジュールも含めてください。`
  },
  {
    id: 'hal_post',
    icon: '🎭',
    category: 'HAL',
    label: '投稿文生成',
    color: '#a855f7',
    text: `【HAL 投稿文生成】

キャラ設定：おっとり、天然、癒し系 / K-POP好き（LE SSERAFIM、IVE、illit）
口調：「〜だよね？」「〜かも？」「〜な気がする！」

今日のテーマ：[テーマを入力]
プラットフォーム：[X/Instagram/TikTok]
目的：[認知拡大/案件紹介/推し活共感/フォロワー獲得]

投稿文を3パターン作成してください。ハッシュタグも含めて。`
  },
  {
    id: 'hal_image',
    icon: '🖼️',
    category: 'HAL',
    label: '画像プロンプト（Nano Banana 2）',
    color: '#a855f7',
    text: `【HAL 画像生成プロンプト】

ベースビジュアル：茶髪ロングウェーブ、ナチュラルメイク（K-POPアイドル系）
笑顔：おっとり、癒し系 / 背景：ピンク・ベージュ系

今日のテーマ：[テーマを入力]
服装：[服装の指定]
シチュエーション：[シチュエーションの指定]

上記の設定でNano Banana 2用の画像生成プロンプトを英語で3パターン作成してください。`
  },
  {
    id: 'hal_video',
    icon: '🎬',
    category: 'HAL',
    label: '動画プロンプト（Google Flow Veo 3.1）',
    color: '#a855f7',
    text: `【HAL 動画生成プロンプト】

ベースビジュアル：茶髪ロングウェーブ、ナチュラルメイク（K-POPアイドル系）、おっとり動き

動画の内容：[内容を入力]
長さ：[秒数]
雰囲気：[雰囲気を入力]
クオリティ：Fast（クレジット節約）

上記の設定でGoogle Flow Veo 3.1用の動画生成プロンプトを英語で作成してください。`
  },
  {
    id: 'hal_live',
    icon: '📡',
    category: 'HAL',
    label: 'ライブ配信台本',
    color: '#a855f7',
    text: `【HAL ライブ台本生成】

配信テーマ：[テーマを入力]
配信時間：[分数]
プラットフォーム：[YouTube/17LIVE]

HALのキャラ設定で以下を生成：
1. オープニング（自己紹介・今日のテーマ）
2. メインコンテンツ（テーマに沿ったトーク）
3. 視聴者コメント促進ポイント
4. MIMOMIMタイアップ紹介タイミング
5. クロージング（次回予告・フォロー促進）

台本はHALの口調（ふわっとした語尾、天然キャラ）で書いてください。`
  },
  {
    id: 'sunakkun',
    icon: '💰',
    category: 'すなくん',
    label: '投稿文生成',
    color: '#f59e0b',
    text: `【すなくん 投稿文生成】

キャラ設定：ガジェット好きな男の子 / 20〜40代男性向け / カジュアル・フレンドリー口調
（3回に1回 HALを紹介: 「最近よく見てる子なんだけど→@HAL」）

今日のテーマ：[Amazon/楽天/特定ジャンル]
商品カテゴリ：[ジャンル入力]
目的：[アフィリエイト/フォロワー増加/HAL紹介]

A）商品紹介（アフィリエイトリンク付き）
B）お得情報・クーポン紹介
C）HAL紹介パターン

各パターンのハッシュタグも含めてください。`
  },
  {
    id: 'cover_song',
    icon: '🎵',
    category: 'カバー曲',
    label: '楽曲生成プロンプト（Suno AI）',
    color: '#ec4899',
    text: `【カバー曲生成プロンプト】

ジャンル：[ジャンル入力]
テーマ：[テーマ入力]
雰囲気：[雰囲気入力]
長さ：[秒数]
参考アーティスト：[参考を入力]

上記の設定でSuno AI用の楽曲生成プロンプトを作成してください。
著作権に問題ない形で。`
  },
  {
    id: 'dog_youtube',
    icon: '🐶',
    category: '愛犬YouTube',
    label: '動画構成生成',
    color: '#84cc16',
    text: `【愛犬YouTube動画構成生成】

犬種：ボストンテリア
動画テーマ：[テーマ入力]
動画長さ：[分数]
ターゲット：[視聴者層]

以下を生成：
1. タイトル案（3パターン）
2. サムネイル案
3. 動画構成（シーン別）
4. BGM方向性（Suno AI用）
5. 概要欄テキスト
6. ハッシュタグ`
  },
  {
    id: 'hp_hearing',
    icon: '🌐',
    category: 'HP制作',
    label: 'ヒアリングシート生成',
    color: '#06b6d4',
    text: `【HP制作 ヒアリングシート生成】

クライアントから必要な情報を引き出すための質問リストを作成してください：

1. 業種・業態
2. ターゲット顧客
3. HPの目的（集客/ブランディング/EC）
4. 参考サイトURL
5. 必要なページ構成
6. 予算感
7. 納期
8. 特記事項

各質問に「なぜ必要か」の説明も添えてください。`
  },
  {
    id: 'hp_plan',
    icon: '📐',
    category: 'HP制作',
    label: 'HP構成案生成',
    color: '#06b6d4',
    text: `【HP構成案生成】

クライアント情報：[ヒアリング内容を貼り付け]
参考サイト：[URLを貼り付け]

以下を生成：
1. ページ構成案
2. デザイン方向性
3. 必要な素材リスト
4. 低コストツール選定（Canva AI等）
5. 制作スケジュール案
6. 見積もり目安`
  },
  {
    id: 'ec_hearing',
    icon: '🛒',
    category: 'EC構築',
    label: 'ヒアリングシート生成',
    color: '#10b981',
    text: `【EC構築 ヒアリングシート生成】

クライアントから必要な情報を引き出すための質問リストを作成してください：

1. 販売する商品カテゴリ
2. 商品数（概算）
3. 価格帯
4. ターゲット顧客
5. 競合ECサイト
6. 必要な機能（決済/在庫管理/配送等）
7. 予算感
8. 納期
9. 運用体制（誰が更新するか）
10. Shopify希望か他か

各質問に具体的な選択肢も添えてください。`
  },
  {
    id: 'ec_plan',
    icon: '📦',
    category: 'EC構築',
    label: 'EC構成案生成',
    color: '#10b981',
    text: `【EC構成案生成】

クライアント情報：[ヒアリング内容を貼り付け]

以下を生成：
1. プラットフォーム選定（Shopify推奨理由）
2. ストア構成案
3. 商品カテゴリ設計
4. 決済設定案
5. 在庫管理方法
6. 半自動・半手動の運用フロー
7. 制作スケジュール案
8. 月額運用コスト見積もり`
  },
  {
    id: 'daily_analysis',
    icon: '📊',
    category: '日次レポート',
    label: 'レポート分析',
    color: '#3b82f6',
    text: `【日次レポート分析】

本日のレポート：[Discordの日次レポートを貼り付け]

以下を分析してください：
1. 今日のパフォーマンス評価
2. 良かった点（伸びた投稿・反応）
3. 改善点
4. 明日への提案（各プロジェクト別）
5. 今週のトレンド傾向

Claude Haiku で簡潔に、明日の朝礼指示に使えるまとめを作成してください。`
  },
  {
    id: 'screenshot',
    icon: '🖼️',
    category: 'ナレッジ',
    label: 'スクショ解釈レポート',
    color: '#8b5cf6',
    text: `【スクショ解釈レポート】

添付した画像を分析して以下を作成してください：

1. 内容の要約（3行以内）
2. このネタの重要度（高/中/低）
3. 活用できるプロジェクト
   - HAL（AI美女）への応用方法
   - アフィリエイト（すなくん）への応用方法
   - その他プロジェクトへの応用
4. 具体的な活用アイデア（3つ）
5. Obsidianのどのフォルダに保存すべきか

Markdown形式でレポートを作成してください。`
  }
];

const CATEGORIES = [...new Set(TEMPLATES.map(t => t.category))];

export default function PromptsView({ onBack, showToast }) {
  const [selectedCat, setSelectedCat] = useState('全て');
  const [copied, setCopied] = useState(null);
  const [search, setSearch] = useState('');

  const categories = ['全て', ...CATEGORIES];

  const filtered = TEMPLATES.filter(t =>
    (selectedCat === '全て' || t.category === selectedCat) &&
    (search === '' || t.label.includes(search) || t.category.includes(search))
  );

  const copy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      showToast?.('✅ コピーしました。Claude.ai に貼り付けてください', 'success');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const catBtnStyle = (active, color) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? (color || '#6366f1') : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-muted)',
    transition: 'all .2s', whiteSpace: 'nowrap'
  });

  return (
    <div className="stack-dashboard animate-fadein">
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>📋</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>プロンプト集（Claude.ai用）</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{TEMPLATES.length}件</div>
        </div>
      </header>

      {/* 検索 */}
      <div style={{ padding: '8px 16px 4px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="検索..."
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      {/* カテゴリフィルター */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', paddingBottom: 8 }}>
        {categories.map(cat => {
          const color = TEMPLATES.find(t => t.category === cat)?.color;
          return (
            <button key={cat} style={catBtnStyle(selectedCat === cat, color)} onClick={() => setSelectedCat(cat)}>
              {cat}
            </button>
          );
        })}
      </div>

      {/* テンプレートリスト */}
      <div style={{ padding: '4px 16px 80px' }}>
        {filtered.map(tpl => (
          <div key={tpl.id}
            style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${tpl.color}25` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tpl.color }}>{tpl.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tpl.category}</div>
                </div>
              </div>
              <button
                onClick={() => copy(tpl.id, tpl.text)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: copied === tpl.id ? '#2ecc71' : tpl.color, color: '#fff', transition: 'all .2s' }}>
                {copied === tpl.id ? '✅ コピー済み' : 'コピー'}
              </button>
            </div>
            <pre style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
              background: 'var(--bg-primary)', borderRadius: 8, padding: 10, margin: 0, maxHeight: 180, overflowY: 'auto',
              fontFamily: 'inherit' }}>
              {tpl.text}
            </pre>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            テンプレートが見つかりません
          </div>
        )}
      </div>
    </div>
  );
}
