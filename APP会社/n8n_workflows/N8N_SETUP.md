# n8n セットアップ手順書（ハイブリッド構成版）

作成日: 2026-05-11 / 更新: 2026-05-13

---

## ⚠️ ハイブリッド構成について

n8n 無料版は `discordTrigger` ノードが動作しないため、**Make.com × n8n ハイブリッド**構成を採用。

| 役割 | 担当 |
| --- | --- |
| Discord メッセージ監視（テキスト・コマンド・HAL・すなくん） | **Make.com Scenario 1** |
| Discord 画像監視（#knowledge） | **Make.com Scenario 2** |
| スケジュール実行（朝礼・日次レポート） | **n8n（このファイルの内容）** |
| 全ロジック・AI処理・Discord返信 | **GAS** |

**n8n にインポートするのは 01 と 06 の2本のみ。02〜05 は Make.com + GAS が担当。**

---

## 事前確認

| 変数名 | 値 | 設定場所 |
| --- | --- | --- |
| `KCS_GAS_URL` | `https://script.google.com/macros/s/AKfycbxmVS3E.../exec` | n8n 環境変数 |

---

## Step 1: n8n アカウント準備

### オプション A: n8n Cloud（推奨・14日間無料）

1. <https://n8n.io> でアカウント作成
2. 14日トライアル開始

### オプション B: セルフホスト（無料・永続）

```bash
# VPS（DigitalOcean / Vultr）でDockerインストール後
docker run -d --name n8n -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=yourpassword \
  n8nio/n8n
```

---

## Step 2: 環境変数の設定

n8n の **Settings → Variables** に以下を追加：

| 変数名 | 値 |
| --- | --- |
| `KCS_GAS_URL` | GAS WebApp URL |

---

## Step 3: Discord Credentials の追加

1. n8n → **Credentials** → **Add Credential**
2. `Discord Bot API` を選択
3. Bot Token を入力（GASスプレッドシート「設定」シートの `DISCORD_BOT_TOKEN`）
4. 名前: `KCS Discord Bot`

---

## Step 4: ワークフローのインポート（2本のみ）

> ⚠️ **02〜05 は n8n にインポートしない。** Make.com + GAS が担当する。

| ファイル | 機能 | インポート |
| --- | --- | --- |
| `01_朝礼フロー.json` | 毎朝9時 朝礼ブリーフィング | ✅ する |
| `06_日次レポート.json` | 毎日20時 日次レポート | ✅ する |
| `02_Discord監視_GAS中継.json` | Discord監視 | ❌ Make.com Scenario 1 が担当 |
| `03_HAL投稿生成.json` | HAL投稿生成 | ❌ GAS が自動ルーティング |
| `04_すなくん投稿生成.json` | すなくん投稿生成 | ❌ GAS が自動ルーティング |
| `05_スクショ解釈_ナレッジ保存.json` | 画像解釈 | ❌ Make.com Scenario 2 が担当 |

**インポート手順:** n8n → Workflows → Import from File

---

## Step 5: GAS 設定シートに追加するキー

GASスプレッドシート「設定」シートに以下を追加（`setupKCS()` を再実行すると自動追加）：

| キー | 説明 |
| --- | --- |
| `CLAUDE_API_KEY` | Anthropic APIキー（HAL/すなくん生成用） |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_OWNER` | GitHubユーザー名 |
| `GITHUB_REPO` | `KCS-Vault`（デフォルト） |
| `RAKUTEN_APP_ID` | 楽天APIアプリID（トレンド収集） |

---

## Step 6: Discord チャンネルと Webhook 設定

GASスプレッドシート「設定」シートの `DISCORD_WEBHOOK_URLS` を以下のJSON形式に更新：

```json
{
  "KCS本部": "https://discord.com/api/webhooks/...",
  "hal-project": "https://discord.com/api/webhooks/...",
  "affiliate": "https://discord.com/api/webhooks/...",
  "daily-report": "https://discord.com/api/webhooks/...",
  "エラーログ": "https://discord.com/api/webhooks/..."
}
```

各チャンネルのWebhook URL取得：Discord → チャンネル編集 → 連携サービス → Webhook

---

## Make.com から n8n への移行

現在 Make.com で稼働中の場合：

1. `02_Discord監視_GAS中継.json` を n8n でインポート・有効化
2. Make.com のシナリオを **OFF** に切り替え
3. GAS の `discordAgentTick` トリガーが残っていれば削除（重複防止）

---

## 動作確認

各ワークフロー有効化後、Discordで以下を送信：

```
!ヘルプ
```

数秒以内に返答が来れば成功。

---

## HAL 投稿フロー（使い方）

Discordの朝礼チャンネルで：

```
HAL: 今日のK-POPネタ
```

→ GASが Claude Sonnet で3案生成  
→ `#hal-project` チャンネルに確認メッセージ  
→ ✅ リアクションを押すと案1を X に投稿  
→ 投稿ログが GitHub KCS-Vault に自動保存

---

## GitHub KCS-Vault の構成

```
KCS-Vault/
├── Daily/
│   ├── 2026-05-11_日次レポート.md（自動生成）
│   └── ...
├── Projects/
│   ├── HAL/
│   │   ├── 投稿ログ/（投稿案を自動保存）
│   │   └── 実績ログ/（投稿済みを自動保存）
│   └── Affiliate/
│       └── 投稿ログ/（すなくん投稿を自動保存）
└── ...（ブリーフィングはObsidian/Google Driveに保存）
```

GitHub リポジトリ作成手順：
1. GitHub → New Repository → `KCS-Vault` → Private → Create
2. `GITHUB_TOKEN` は Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens → Contents: Read & Write
