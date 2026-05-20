# Make.com × Discord → GAS 全自動フロー構築手順書

作成日: 2026-05-08  
対象: KCS合同会社ダッシュボード（nexus-co-66f9b.web.app）

---

## 全体の仕組み

```
スマホ Discord
  ↓ メッセージ送信
Make.com（Watch Messages）
  ↓ HTTP POST
GAS（KCS合同会社 Backend）
  ↓ コマンド解析 + Gemini AI
Discord Webhook（KCS本部に返信）
```

**GAS側はすでに実装済み。**  
Make.comのシナリオを作るだけで完成する。

---

## 事前確認（5分）

以下の情報を手元に用意してから始めること。

| 項目 | 値 | 場所 |
| --- | --- | --- |
| GAS URL | `https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec` | bridge.config.json |
| Discord Bot Token | GASスプレッドシート「設定」シートの `DISCORD_BOT_TOKEN` | 設定シート |
| KCS本部 チャンネルID | GASスプレッドシート「設定」シートの `DISCORD_CHANNELS` の値 | 設定シート |
| KCS本部 Webhook URL | GASスプレッドシート「設定」シートの `DISCORD_WEBHOOK_URLS` の値 | 設定シート |

> **チャンネルIDの確認方法:** Discord → サーバー設定 → KCS本部チャンネルを右クリック → 「チャンネルIDをコピー」

---

## Step 1: Make.com にシナリオを新規作成

1. [Make.com](https://www.make.com) にログイン
2. 左メニュー「Scenarios」→「＋ Create a new scenario」
3. シナリオ名: `KCS Discord → GAS 中継`

---

## Step 2: Discord「Watch Messages」モジュールを追加

### 2-1. モジュールの追加

1. ＋ をクリック → 検索バーに `Discord` → **Discord** を選択
2. アクション一覧から **Watch Messages** を選択

### 2-2. Discord接続設定

1. 「Add」をクリックして新規接続を作成
2. 接続名: `KCS Discord Bot`
3. **Bot Token** 欄に GAS設定シートの `DISCORD_BOT_TOKEN` の値を貼り付け
4. 「Save」→「Yes, subscribe」

### 2-3. チャンネル設定

| 設定項目 | 入力値 |
| --- | --- |
| Channel | KCS本部チャンネルID（数字のみ） |
| Limit | `5`（1回の実行で最大5件取得） |

> **重要:** 「Watch from now on」を選択すること（過去メッセージを再処理しないため）

---

## Step 3: フィルター追加（Botの返信を無視）

Watch Messagesモジュールの右側に **フィルター** を追加する。

1. モジュール間の → をクリック → 「Set up a filter」
2. フィルター名: `Botメッセージ除外`
3. 条件設定:

```
Condition 1:
  Author → is not → true  （Author.botがtrueでない）

Condition 2（AND）:
  Content → is not empty
```

> Make.comでは `{{1.author.bot}}` が `true` のものを除外する。

---

## Step 4: HTTP「Make a request」モジュールを追加

1. フィルターの右側に ＋ → `HTTP` → **Make a request** を選択
2. 以下のように設定:

### URL

```
https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec
```

### Method

```
POST
```

### Headers

| Name | Value |
| --- | --- |
| `Content-Type` | `application/json` |

### Body type

```
Raw
```

### Content type

```
JSON (application/json)
```

### Request content（JSONボディ）

```json
{
  "action": "discord_message",
  "channelId": "{{1.channel_id}}",
  "text": "{{1.content}}",
  "author": "{{1.author.username}}",
  "messageId": "{{1.id}}"
}
```

> `{{1.xxx}}` はDiscordモジュールの出力変数。マッピングパネルから選択できる。

### Parse response

```
Yes（チェックを入れる）
```

---

## Step 5: スケジュール設定

シナリオ左下の時計アイコン → スケジュール設定:

| 設定 | 値 |
| --- | --- |
| 実行間隔 | **Every 1 minute**（1分ごと） |
| 最大エラー | 3回 |

---

## Step 6: シナリオを保存・有効化

1. 右下「Save」→「OK」
2. 左下のトグルを「ON」に切り替え
3. 「Run once」で1回テスト実行

---

## Step 7: 動作確認

### テスト手順

1. スマホのDiscordで **KCS本部チャンネル** に以下を送信:

```
!ヘルプ
```

2. 数秒〜1分以内に以下が返ってくればOK:

```
📋 KCS スマホ指示 コマンド一覧
!状況 — 進行中プロジェクト一覧
!出勤 — 本日の出勤状況
...
```

### Make.comの実行ログ確認

1. Make.com → シナリオ画面 → 「History」タブ
2. 実行履歴が「Success」になっているか確認
3. エラーが出ていればHTTPモジュールの出力を確認

---

## 使えるコマンド一覧

Discordから以下のコマンドを送ると自動で返答が来る:

| コマンド | 機能 |
| --- | --- |
| `!ヘルプ` | コマンド一覧を表示 |
| `!状況` | 進行中プロジェクト一覧 |
| `!出勤` | 本日の出勤状況（AppA GAS連携） |
| `!在庫` | Pizza在庫確認 |
| `!ブリーフィング` | 朝ブリーフィングを手動実行 |
| `!x設定` | X API 認証情報ウィザード（対話形式） |
| `!知識 [キーワード]` | ナレッジベースをキーワード検索 |
| 自由文（コマンド以外） | Gemini AIが回答（ナレッジ参照付き） |
| `X投稿：本文` | X（Twitter）に直接投稿 |

---

## よくあるエラーと対処

### Make.comでエラー: 401 / 403

→ Discord Bot Token が間違っている。GAS設定シートの `DISCORD_BOT_TOKEN` を再確認。  
→ BotにKCS本部チャンネルの「メッセージを読む」権限があるか確認（Discord サーバー設定 → ロール）

### Make.comは成功するが返答が来ない

→ GAS設定シートの `DISCORD_WEBHOOK_URLS` に `KCS本部` のWebhook URLが入っているか確認。  
→ GAS実行ログを確認: GASエディター → 実行数 → 最新の実行を開く

### 返答が2回来る

→ GASの `discordAgentTick`（1分ポーリング）とMake.comが両方処理している。  
→ 対処: GASのメニューから「discordAgentTick」トリガーを一時削除。Make.comに一本化する。

```
GAS スプレッドシート → 拡張機能 → Apps Script
→ トリガー（時計アイコン） → discordAgentTick を削除
```

---

## アーキテクチャ（完成後）

```
スマホ Discord
  │
  ▼（Watch Messages）
Make.com（1分ごとポーリング）
  │
  ▼（HTTP POST）
GAS doPost
  │
  ├─ !コマンド → handleBotCommand()
  │     ├─ !状況 → 実務タスク管理シート
  │     ├─ !出勤 → AppA GAS API
  │     ├─ !在庫 → Pizza GAS API
  │     └─ !x設定 → X API ウィザード
  │
  └─ 自由文 → cmdAskGemini()
        └─ ナレッジベース検索（RAG）
        └─ Gemini 2.0 Flash
  │
  ▼（Webhook POST）
Discord KCS本部チャンネル（返信）
```

---

## 完了チェックリスト

- [ ] Make.com シナリオ作成済み
- [ ] Discord Watch Messages モジュール設定済み（Bot Token入力）
- [ ] Botメッセージ除外フィルター追加済み
- [ ] HTTP POST モジュール設定済み（GAS URL + JSONボディ）
- [ ] 実行間隔: 1分に設定済み
- [ ] シナリオ: ON に切り替え済み
- [ ] `!ヘルプ` テスト送信 → 返答確認済み
- [ ] GAS `discordAgentTick` トリガーを削除（重複防止）

---

## 【Scenario 2】#knowledge チャンネル 画像解析フロー（新規）

> Make.com 無料枠の2本目（2シナリオまで無料）

### 全体の仕組み

```
スマホ Discord（#knowledge チャンネルに画像を投稿）
  ↓ Watch Messages（画像フィルター）
Make.com Scenario 2
  ↓ HTTP POST（imageUrl 付き）
GAS → Gemini Vision で解析 → Discord返信 + GitHub保存
```

---

### Step 1: 新規シナリオを作成

1. Make.com → Scenarios → 「＋ Create a new scenario」
2. シナリオ名: `KCS #knowledge 画像解析`

---

### Step 2: Discord「Watch Messages」モジュール

1. ＋ → `Discord` → **Watch Messages**
2. Connection: 既存の `KCS Discord Bot` を選択（再作成不要）
3. Channel: `#knowledge` チャンネルのID（数字のみ）
4. Limit: `5`

---

### Step 3: フィルター追加（画像添付のみ通過）

モジュール間の → → 「Set up a filter」

```
フィルター名: 画像添付フィルター
Condition:
  {{1.attachments[]}} → exists（空でない）
```

---

### Step 4: HTTP「Make a request」モジュール

| 設定 | 値 |
|---|---|
| URL | `https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec` |
| Method | `POST` |
| Body type | `Raw` |
| Content type | `JSON (application/json)` |

**Request content（JSONボディ）:**

```json
{
  "action": "discord_message",
  "channelId": "{{1.channel_id}}",
  "text": "[画像添付]",
  "author": "{{1.author.username}}",
  "imageUrl": "{{1.attachments[].url}}"
}
```

> `{{1.attachments[].url}}` は最初の添付ファイルのURLが入る

---

### Step 5: スケジュール・保存・有効化

| 設定 | 値 |
|---|---|
| 実行間隔 | Every 1 minute |

→ 「Save」→ トグルを「ON」

---

### Step 6: テスト

1. Discord の `#knowledge` チャンネルに**画像を投稿**
2. 1分以内に GAS が Gemini Vision で解析し、Discord に結果が返ってくれば成功
3. GitHub の `KCS-Vault/Knowledge/スクショ/` にもファイルが保存される

---

## ハイブリッド構成まとめ（完成後）

| 役割 | サービス |
|---|---|
| Discord テキスト監視（KCS本部・コマンド・HAL・すなくん） | **Make.com Scenario 1** |
| Discord 画像監視（#knowledge） | **Make.com Scenario 2** |
| 朝礼 毎朝9時 | **n8n** |
| 日次レポート 毎晩20時 | **n8n** |
| 全ロジック・AI処理・Discord返信 | **GAS** |
