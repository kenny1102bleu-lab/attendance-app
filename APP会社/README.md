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
| ブリッジ | Node.js (kcs-agency-bridge) |

---

## 機能一覧

- **AIスタッフチャット** — 役職・性格を持つAIスタッフ複数名とチャット
- **プロジェクト管理** — タスク・会議・進捗をDiscordチャンネルと連携
- **ラウンドテーブル** — 複数AIによるブレスト・議論
- **ロードマップ管理** — 開発・施策ロードマップ
- **外部アプリ監視** — KCS本番・Pizza通知アプリの死活監視
- **X（Twitter）運用** — 投稿管理・AIタイトル生成
- **YouTube動画管理** — パイプライン・かんばん・AI台本生成・API統計取得
- **勤怠管理** — スタッフ打刻・月次PDF生成
- **Discord Bot** — チャンネル別プロジェクトコンテキストで自動応答（1分ポーリング）

---

## ファイル構成と内容

### ルートファイル

| ファイル | 内容 |
|---|---|
| `CLAUDE.md` | Claude Code向けプロジェクト全体の仕様書・ルール |
| `OBSIDIAN_HANDOVER.md` | Obsidianナレッジ引継ぎ資料 |
| `README.md` | このファイル |
| `bridge.config.json` | KCS GAS URLを管理（直接編集禁止） |
| `appsscript.json` | GASランタイム設定（V8・アジア/東京・匿名アクセス許可） |
| `firebase.json` | Firebase Hosting設定（distフォルダを公開） |
| `.firebaserc` | Firebaseプロジェクト名（nexus-co-66f9b） |
| `.clasp.json` | clasp（GAS CLI）設定 |
| `.claspignore` | claspでアップロード除外するファイル |
| `.gitignore` | Gitの除外設定 |
| `.mcp.json` | Claude Code MCP設定 |
| `.env` | 環境変数（APIキー等・Git管理外） |
| `vite.config.js` | Viteビルド設定 |
| `eslint.config.js` | ESLint設定 |
| `package.json` | npmパッケージ定義・スクリプト |
| `index.html` | Viteエントリポイント |
| `payload.json` | APIテスト用ペイロードサンプル |
| `test-gemini.js` | Gemini API動作確認スクリプト |

### GASバックエンド

| ファイル | 内容 |
|---|---|
| `GAS_KCS合同会社_Backend.gs` | GASバックエンド本体。チャットログ・スタッフ管理・プロジェクト記録・SNS投稿・実務タスク・ユーザーデータ同期・Discord Botエージェント（複数チャンネルポーリング・Gemini連携）を含む |

### ブリッジ・エージェント

| ファイル | 内容 |
|---|---|
| `kcs-agency-bridge.mjs` | KCS Agency Bridge v1.0。AIスタッフからの実務依頼（動画生成・文書作成等）をローカルPCで実行する常駐プログラム |
| `core/index.js` | 全エージェントを起動しWebSocketサーバーに接続するメインエントリ |
| `core/agent-base.js` | エージェントの基底クラス |
| `core/message-bus.js` | エージェント間メッセージバス |
| `core/departments/index.js` | 部署別エージェント定義 |

### ファイル整理ツール

| ファイル | 内容 |
|---|---|
| `file_organizer/organizer.py` | ファイル自動整理スクリプト（メイン） |
| `file_organizer/file_organizer.py` | ファイル整理ロジック |
| `file_organizer/logs/organizer.log` | 整理実行ログ |

### フロントエンド（src/）

| ファイル | 内容 |
|---|---|
| `src/main.jsx` | Reactエントリポイント・Firebase初期化 |
| `src/App.jsx` | ルートコンポーネント。ルーティング・グローバル状態管理・監視ポーリング |
| `src/App.css` | 全コンポーネントのスタイル（CSS Custom Properties） |
| `src/index.css` | グローバルリセット・フォント設定 |
| `src/store.js` | AIスタッフ定義・Gemini/Claude API呼び出し・定数・データ永続化ヘルパー |
| `src/firebase.js` | Firebase初期化・FCM（プッシュ通知）設定 |

#### Views（画面）

| ファイル | 内容 |
|---|---|
| `src/views/LoginView.jsx` | ログイン画面（パスワード認証） |
| `src/views/HomeView.jsx` | ダッシュボードトップ。外部アプリ監視・クイックアクションカード |
| `src/views/ChatView.jsx` | AIスタッフチャット。スタッフ選択・履歴表示・GASクラウド同期 |
| `src/views/ProjectsView.jsx` | プロジェクト管理。タスク・会議・進捗・Discordチャンネル連携 |
| `src/views/AttendanceView.jsx` | 勤怠管理。スタッフ打刻・月次PDF生成・スタッフ編集モーダル |
| `src/views/XView.jsx` | X（Twitter）運用。投稿管理・AIタイトル生成・スケジュール |
| `src/views/YouTubeView.jsx` | YouTube管理。動画パイプライン・かんばん・AI台本生成・YouTube API統計取得 |
| `src/views/RoadmapView.jsx` | ロードマップ管理（開発・施策） |
| `src/views/DiscussionView.jsx` | ラウンドテーブル（複数AIによる議論） |
| `src/views/StaffManagementView.jsx` | スタッフ管理（カスタムスタッフの追加・編集） |
| `src/views/SettingsView.jsx` | 設定画面。APIキー・GAS URL・YouTube APIキー管理 |

#### Components（コンポーネント）

| ファイル | 内容 |
|---|---|
| `src/components/AgentCompany/AgentCompany.jsx` | エージェント会社UIコンポーネント |
| `src/components/AgentCompany/MeetingRoom.jsx` | 会議室コンポーネント |
| `src/components/AgentCompany/MinutesViewer.jsx` | 議事録ビューアー |
| `src/components/AgentCompany/AgentCompany.css` | エージェントUI専用スタイル |
| `src/components/FormattedMessage.jsx` | Markdownレンダリングコンポーネント |

#### Assets（画像）

| ファイル | 内容 |
|---|---|
| `src/assets/staff/` | AIスタッフのアバター画像（jun, sakura, haruki, akari, kenji, ryou, mio, reo, takumi, yuki） |
| `src/assets/kcs_logo.jpg` | KCSロゴ |
| `src/assets/hero.png` | ヒーローイメージ |

#### Public

| ファイル | 内容 |
|---|---|
| `public/manifest.json` | PWAマニフェスト |
| `public/sw.js` | Service Worker（FCMプッシュ通知受信） |
| `public/favicon.svg` | ファビコン |
| `public/icons.svg` | アイコンセット |

### Claude Code設定

| ファイル | 内容 |
|---|---|
| `.claude/settings.local.json` | Claude Code権限・ツール設定 |
| `.claude/commands/deploy.md` | `/deploy` スラッシュコマンド定義 |
| `.claude/commands/discord-send.md` | `/discord-send` スラッシュコマンド定義 |
| `.claude/commands/new-card.md` | `/new-card` スラッシュコマンド定義 |
| `.claude/commands/obsidian-save.md` | `/obsidian-save` スラッシュコマンド定義 |

---

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー (localhost:5173)
npm run build      # プロダクションビルド
firebase deploy --only hosting  # 本番デプロイ
```

### GASバックエンド初期セットアップ

1. Googleスプレッドシートを新規作成
2. 拡張機能 → Apps Script を開く
3. `GAS_KCS合同会社_Backend.gs` の内容を貼り付け
4. `setupKCS()` を実行してシートを初期化
5. デプロイ → ウェブアプリ → URLをアプリの設定に入力

### Discord Bot セットアップ

1. [Discord Developer Portal](https://discord.com/developers/applications) でBotを作成
2. GAS設定シートに以下を入力:
   - `DISCORD_BOT_TOKEN` — BotのToken
   - `DISCORD_CHANNELS` — `{"チャンネル名":"チャンネルID"}` 形式のJSON
   - `GEMINI_API_KEY` — Gemini APIキー
   - `ATTENDANCE_GAS_URL` — 勤怠GASのデプロイURL
3. GASで `setupDiscordTrigger()` を実行（1分間隔のポーリング開始）

### KCS Agency Bridge

```bash
npm run bridge    # ブリッジ常駐プロセス起動
npm run server    # Coreサーバー起動
```

---

## 関連システム

| システム | URL |
|---|---|
| KCS本番 | <https://nexus-co-66f9b.web.app> |
| Pizza通知アプリ | <https://pizza-hi-sta.web.app> |
| Firebase PJ | nexus-co-66f9b |
| GitHub | <https://github.com/kenny1102bleu-lab/attendance-app> |
