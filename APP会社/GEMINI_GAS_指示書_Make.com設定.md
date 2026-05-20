# Gemini への指示書 — Make.com Discord監視セットアップ

## あなたへの依頼

Make.com というサービスでDiscordの2つのチャンネルを監視するシナリオを作成してください。
ブラウザを操作して以下の2つのシナリオを設定します。

---

## 前提情報（必ず手元に用意）

| 項目 | 値 |
|---|---|
| Make.com ログインURL | https://www.make.com |
| GAS URL（転送先） | `https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec` |
| Discord Bot Token | Googleスプレッドシート「設定」シートの B45 セルの値 |
| 監視チャンネル1 | `kcs本部`（KCSのサーバー内） |
| 監視チャンネル2 | `ナレッジ`（KCSのサーバー内） |

---

## シナリオ1：KCS本部 テキスト監視

### 目的
`#kcs本部` に送ったメッセージを GAS に転送 → Gemini AI が返答する

---

### STEP 1: ログイン・新規シナリオ作成

1. https://www.make.com を開いてログイン
2. 左メニュー「**Scenarios**」をクリック
3. 既に「KCS Discord」という名前のシナリオがあれば → それをクリックしてトグルを **ON** にして終了（STEP 6へ）
4. なければ右上「**Create a new scenario**」をクリック

---

### STEP 2: Discord「Watch Messages」モジュール追加

1. 画面中央の「**＋**」をクリック
2. 検索欄に `Discord` と入力
3. 一覧から「**Discord**」を選択
4. アクション一覧から「**Watch Messages**」を選択

---

### STEP 3: Discord 接続設定

1. 「**Add**」ボタンをクリック（新規接続を作成）
2. 接続名に `KCS Discord Bot` と入力
3. 「**Bot Token**」欄に Googleスプレッドシート設定シートの **B45** の値を貼り付け
4. 「**Save**」をクリック
5. 「**Yes, subscribe**」をクリック（確認ダイアログが出た場合）

---

### STEP 4: チャンネル設定

接続後、以下の項目を設定:

| 設定項目 | 入力値 |
|---|---|
| Channel | ドロップダウンから `kcs本部` を選択 |
| Limit | `5` |

「**Watch from now on**」を選択すること（過去メッセージを取り込まないため）

「**OK**」をクリック

---

### STEP 5: フィルター追加（Bot返信のループ防止）

1. Watch Messages モジュールの右側にある「**→**」矢印をクリック
2. 「**Set up a filter**」をクリック
3. 以下を設定:

| 項目 | 値 |
|---|---|
| Label | `Bot除外` |
| Condition（左） | `Author: Bot` （`{{1.author.bot}}`） |
| Operator | `Does not equal` |
| Condition（右） | `true` |

4. 「**OK**」をクリック

---

### STEP 6: HTTP「Make a request」モジュール追加

1. フィルターの右側の「**＋**」をクリック
2. 検索欄に `HTTP` と入力
3. 「**HTTP**」→「**Make a request**」を選択
4. 以下を設定:

**URL欄:**
```
https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec
```

**Method:** `POST`

**Headers:**
「**Add item**」をクリック
- Name: `Content-Type`
- Value: `application/json`

**Body type:** `Raw`

**Content type:** `JSON (application/json)`

**Request content（以下をそのままコピペ）:**
```json
{
  "action": "discord_message",
  "channelId": "{{1.channel_id}}",
  "text": "{{1.content}}",
  "author": "{{1.author.username}}",
  "messageId": "{{1.id}}"
}
```

※ `{{1.channel_id}}` 等はマッピングパネルから選択するか、そのままテキストとして入力してください。

**Parse response:** `Yes`（チェックを入れる）

5. 「**OK**」をクリック

---

### STEP 7: スケジュール設定

1. 画面左下の「**時計アイコン**」または「**Scheduling**」をクリック
2. 「**Every**」→ `1` → 「**Minutes**」を選択
3. 「**OK**」をクリック

---

### STEP 8: 保存・有効化

1. 右下「**Save**」をクリック
2. 画面左下のトグルスイッチを「**ON**」に切り替える
3. 「**Run once**」をクリックして1回テスト実行

---

### STEP 9: 動作確認

1. Discord の `#kcs本部` に `こんにちは` と送信
2. 1〜2分以内に AI からの返答が来れば ✅ 成功

---

---

## シナリオ2：#knowledge 画像解析

### 目的
`#ナレッジ` チャンネルに画像を投稿 → GAS が Gemini Vision で解析 → GitHub に保存 → Discord に結果返信

---

### STEP 1: 新規シナリオ作成

1. Make.com → Scenarios → 「**Create a new scenario**」
2. シナリオ名: `KCS knowledge 画像解析`

---

### STEP 2: Discord「Watch Messages」モジュール

1. 「**＋**」→ `Discord` → **Watch Messages**
2. Connection: ドロップダウンから「**KCS Discord Bot**」を選択（シナリオ1で作成済み・再作成不要）
3. Channel: ドロップダウンから `ナレッジ` を選択
4. Limit: `5`
5. 「**Watch from now on**」を選択
6. 「**OK**」をクリック

---

### STEP 3: フィルター追加（画像添付のみ通過）

1. モジュール右の「**→**」→「**Set up a filter**」
2. 以下を設定:

| 項目 | 値 |
|---|---|
| Label | `画像のみ` |
| Condition（左） | `{{1.attachments[]}}` |
| Operator | `Exists` |

3. 「**OK**」をクリック

---

### STEP 4: HTTP「Make a request」モジュール

1. 「**＋**」→「**HTTP**」→「**Make a request**」
2. 以下を設定:

**URL:**
```
https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec
```

**Method:** `POST`

**Headers:**
- Name: `Content-Type` / Value: `application/json`

**Body type:** `Raw`

**Content type:** `JSON (application/json)`

**Request content:**
```json
{
  "action": "discord_message",
  "channelId": "{{1.channel_id}}",
  "text": "[画像添付]",
  "author": "{{1.author.username}}",
  "imageUrl": "{{1.attachments[].url}}"
}
```

**Parse response:** `Yes`

3. 「**OK**」をクリック

---

### STEP 5: スケジュール・保存・有効化

1. 時計アイコン → Every `1` Minutes
2. 「**Save**」
3. トグル → **ON**

---

### STEP 6: 動作確認

1. Discord の `#ナレッジ` チャンネルに**画像を1枚投稿**
2. 1〜2分以内に「📚 ナレッジ保存完了！」という返答が来れば ✅ 成功

---

## 完了チェックリスト

- [ ] シナリオ1「KCS Discord → GAS」作成・ON済み
- [ ] `#kcs本部` に「こんにちは」→ AI返答確認済み
- [ ] シナリオ2「KCS knowledge 画像解析」作成・ON済み
- [ ] `#ナレッジ` に画像投稿 → 解析結果返答確認済み

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| Make.com で 401エラー | Bot Token が間違い | スプレッドシート B45 の値を再確認 |
| シナリオは動くが Discord に返答なし | Webhook URL 未設定 | GAS 設定シートの `DISCORD_WEBHOOK_URLS` に KCS本部のWebhook URLを入力 |
| 返答が2回来る | 別のトリガーが重複 | GAS のトリガー一覧で `discordAgentTick` を削除 |
| `#ナレッジ` の画像で何も起きない | GEMINI_API_KEY 未設定 | GAS 設定シートの `GEMINI_API_KEY` を確認 |

---

*作成: 2026-05-16*
