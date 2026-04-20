# KCS合同会社 ダッシュボード

KCS合同会社の会社中枢システム。AIスタッフ管理・プロジェクト管理・外部アプリ監視・Discord Bot連携を一画面に集約したSaaSスタイルのダッシュボード。

**本番URL**: <https://nexus-co-66f9b.web.app>

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | React + Vite (SPA) |
| スタイル | CSS Custom Properties |
| 状態管理 | useState / localStorage |
| バックエンド | Google Apps Script (GAS) |
| ホスティング | Firebase Hosting |
| AI | Gemini API / Claude API |
| Bot | Discord Bot API v10 |

---

## 機能一覧

- **AIスタッフチャット** — 役職・性格を持つAIスタッフ6名とチャット
- **プロジェクト管理** — タスク・会議・進捗をDiscordチャンネルと連携
- **ラウンドテーブル** — 複数AIによるブレスト・議論
- **ロードマップ管理** — 開発・施策ロードマップ
- **外部アプリ監視** — KCS本番・Pizza通知アプリの死活監視
- **X（Twitter）運用** — 投稿管理・AIタイトル生成
- **YouTube動画管理** — パイプライン・かんばん・AI台本生成・API統計取得
- **勤怠管理** — スタッフ打刻・月次PDF生成
- **Discord Bot** — チャンネル別プロジェクトコンテキストで自動応答

---

## ファイル構成

```text
APP会社/
├── src/
│   ├── App.jsx                     # ルート + ルーティング
│   ├── App.css                     # 全スタイル
│   ├── store.js                    # AI呼び出し・定数・データ永続化
│   ├── views/
│   │   ├── HomeView.jsx            # ダッシュボード
│   │   ├── ChatView.jsx            # AIスタッフチャット
│   │   ├── ProjectsView.jsx        # プロジェクト管理
│   │   ├── AttendanceView.jsx      # 勤怠管理
│   │   ├── XView.jsx               # X運用管理
│   │   ├── YouTubeView.jsx         # YouTube管理
│   │   ├── RoadmapView.jsx         # ロードマップ
│   │   ├── DiscussionView.jsx      # ラウンドテーブル
│   │   ├── StaffManagementView.jsx # スタッフ管理
│   │   ├── SettingsView.jsx        # 設定
│   │   └── LoginView.jsx           # ログイン
│   └── components/
│       ├── AgentCompany/           # エージェント系コンポーネント
│       └── FormattedMessage.jsx    # Markdown表示
├── GAS_KCS合同会社_Backend.gs      # GASバックエンド本体
├── bridge.config.json              # GAS URL設定（編集禁止）
├── firebase.json                   # Firebase設定
└── appsscript.json                 # GAS設定
```

---

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー (localhost:5173)
npm run build      # プロダクションビルド
firebase deploy --only hosting  # 本番デプロイ
```

### GASバックエンド

1. Googleスプレッドシートを新規作成
2. 拡張機能 → Apps Script を開く
3. `GAS_KCS合同会社_Backend.gs` の内容を貼り付け
4. `setupKCS()` を実行してシートを初期化
5. デプロイ → ウェブアプリ → URLをアプリの設定に入力

### Discord Bot

1. [Discord Developer Portal](https://discord.com/developers/applications) でBotを作成
2. GAS設定シートに `DISCORD_BOT_TOKEN` と `DISCORD_CHANNELS` を入力
3. GASで `setupDiscordTrigger()` を実行（1分間隔のポーリング開始）

---

## 関連システム

| システム | URL |
|---|---|
| KCS本番 | <https://nexus-co-66f9b.web.app> |
| Pizza通知アプリ | <https://pizza-hi-sta.web.app> |
| Firebase PJ | nexus-co-66f9b |
