# ブラウザ操作指示書 — Make.com Discord監視を有効化する

作成日: 2026-05-16  
所要時間: 約10分  
目的: Discordに送ったメッセージにAIが自動返答できるようにする

---

## やること（1行まとめ）

Make.com で Discord を監視して、メッセージを GAS に転送する → GAS が AI で返答する

```
あなた → Discord #kcs本部 → Make.com（監視）→ GAS → Gemini AI → Discord返信
```

---

## STEP 1：Make.com にログイン

1. https://www.make.com にアクセスしてログイン
2. 左メニュー「**Scenarios**」をクリック

---

## STEP 2：既存シナリオがある場合（ON にするだけ）

「KCS Discord」または「KCS Discord → GAS」という名前のシナリオがあれば：

1. シナリオ名をクリック
2. 左下のトグルが **OFF** になっていたら → **ON** にする
3. 完了 → STEP 6 に進む

---

## STEP 3：シナリオがない場合 — 新規作成

1. 右上「**Create a new scenario**」をクリック
2. シナリオ名: `KCS Discord → GAS`

---

## STEP 4：モジュール設定

### 4-1. Discord「Watch Messages」

1. ＋ をクリック → 検索欄に `Discord` → **Watch Messages** を選択
2. 「Add」→ 接続名: `KCS Discord Bot` → Bot Token 欄に設定シートの `DISCORD_BOT_TOKEN` を貼り付け → Save
3. Channel: `KCS本部` を選択（または数字のチャンネルIDを入力）
4. Limit: `5`
5. 「Watch from now on」を選択

### 4-2. フィルター（Bot返信ループ防止）

モジュール間の矢印 → をクリック → 「Set up a filter」

```
条件: Author → Is bot → does not equal → true
```

### 4-3. HTTP「Make a request」

1. ＋ → `HTTP` → **Make a request**
2. 以下を設定:

| 項目 | 値 |
|---|---|
| URL | `https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec` |
| Method | `POST` |
| Headers → Content-Type | `application/json` |
| Body type | `Raw` |
| Content type | `JSON (application/json)` |

**Request content（そのままコピペ）:**

```json
{
  "action": "discord_message",
  "channelId": "{{1.channel_id}}",
  "text": "{{1.content}}",
  "author": "{{1.author.username}}",
  "messageId": "{{1.id}}"
}
```

---

## STEP 5：スケジュール設定 & 保存

1. 画面左下の時計アイコン → **Every 1 minute**（1分ごと）
2. 右下「**Save**」をクリック
3. 左下のトグルを **ON** に切り替え

---

## STEP 6：動作テスト

1. Discord の **#kcs本部** に以下を送信:

```
こんにちは、テスト
```

2. 1分以内に AI の返答が来れば成功 ✅
3. 来ない場合 → Make.com の「History」タブでエラーを確認

---

## よくあるエラー

| エラー | 原因 | 対処 |
|---|---|---|
| 401 / 403 | Bot Token が間違い | 設定シート B45 の値を再確認 |
| 返答が来ない | GAS の Webhook URL 未設定 | 設定シートの `DISCORD_WEBHOOK_URLS` を確認 |
| 返答が2回来る | discordAgentTick トリガーが残っている | GAS のトリガー画面で `discordAgentTick` を削除 |

---

## チェックリスト

- [ ] Make.com ログイン済み
- [ ] シナリオを ON にした（または新規作成してON）
- [ ] `こんにちは` テスト → 返答確認済み

---

*作成: 2026-05-16*
