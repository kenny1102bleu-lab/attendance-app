# KCS合同会社 ダッシュボード — 実装ステータス

最終更新: 2026-05-11

---

## Phase 1–9: 実装完了 ✅

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase 1 | GAS: GitHub自動書き込み (`saveToGitHub`) | ✅ 実装済み |
| Phase 2 | GAS: HAL投稿生成（Claude Sonnet） | ✅ 実装済み |
| Phase 3 | GAS: すなくん投稿生成（Claude Haiku + 楽天API） | ✅ 実装済み |
| Phase 4 | GAS: 日次レポート自動生成（毎日20:00） | ✅ 実装済み |
| Phase 5 | GAS: エラーハンドリング共通関数 | ✅ 実装済み |
| Phase 6 | GAS: VIPアクションルール（AITuber連携） | ✅ 実装済み |
| Phase 7 | GAS: プロンプトテンプレート14種管理 | ✅ 実装済み |
| Phase 8 | n8n ワークフローJSON（6本）作成・インポート | ✅ 本番稼働中 |
| Phase 9 | React: HALView / PromptsView 追加 | ✅ 実装済み |

---

## n8n 本番稼働状態（2026-05-11 確認）

```
Discord受信の唯一の入口: n8n Webhook (02_Discord監視_GAS中継)
Make.com: OFF（シナリオ停止済み）
GAS discordAgentTick トリガー: 削除済み
重複実行: なし
```

### 稼働中ワークフロー（6本）

| ファイル | 内容 | トリガー |
|---|---|---|
| 01_朝礼フロー.json | 朝礼ブリーフィング | 毎日 9:00 |
| 02_Discord監視_GAS中継.json | Discord → GAS 中継（最重要） | Discord メッセージ |
| 03_HAL投稿生成.json | "HAL:" プレフィックスで投稿生成 | Discord メッセージ |
| 04_すなくん投稿生成.json | アフィリエイト投稿自動生成 | 12:00 / 19:00 / 22:00 |
| 05_スクショ解釈_ナレッジ保存.json | 画像添付 → ナレッジ保存 | Discord 添付ファイル |
| 06_日次レポート.json | 日次レポート生成 | 毎日 20:00 |

---

## 残タスク

### 🔴 最優先（GASが動かない）

- [ ] GAS を**新バージョンとして再デプロイ**（新関数を反映させるため必須）
- [ ] GAS設定シートに `CLAUDE_API_KEY` を入力 → `setupKCS()` 再実行

### 🟠 今週中

- [ ] GitHub `KCS-Vault` リポジトリ作成（Private）+ Fine-grained Token 発行
  - フォルダ構造: `Daily/`, `Projects/HAL/投稿ログ/`, `Projects/Affiliate/投稿ログ/`
  - 設定シートに `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` 入力
- [ ] Discord Webhook URL 追加
  - `#hal-project`, `#affiliate`, `#daily-report`, `#error-log` チャンネルを作成
  - 各チャンネルの Webhook URL を `DISCORD_WEBHOOK_URLS` に追加
- [ ] 楽天API: `RAKUTEN_APP_ID` を設定シートに入力

### 🟡 来週

- [ ] HAL ビジュアル素材生成（Nano Banana 2）
  - プロンプトは `ANTIGRAVITY_NEXT_TASKS.md` に記載
- [ ] AITuber OnAir + OBS + ElevenLabs セットアップ（ローカルPC）
  - AITuber OnAir: `claude-haiku-4-5-20251001` + システムプロンプト設定済み（イレブンラボ連携）
- [ ] X API 申請（承認まで数日〜1週間）
  - HAL用 / すなくん用の各 Consumer Key 等を設定シートに入力

### 🟢 台湾訪問後

- [ ] `MIMOMIM_URL` を設定シートに追加
- [ ] コラボ相手の VIPアクション設定を GAS に追記

---

## 重要ファイルの場所

```
本番ダッシュボード : https://nexus-co-66f9b.web.app
GAS WebApp URL    : bridge.config.json 参照（直接編集禁止）
GASコード         : APP会社/GAS_KCS合同会社_Backend.gs
n8nワークフロー   : APP会社/n8n_workflows/（ローカルのみ、GitHub未同期）
n8nセットアップ   : APP会社/n8n_workflows/N8N_SETUP.md
次のタスク指示書  : APP会社/ANTIGRAVITY_NEXT_TASKS.md
```
