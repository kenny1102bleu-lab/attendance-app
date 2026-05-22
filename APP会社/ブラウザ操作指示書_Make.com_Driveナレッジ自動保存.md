# ブラウザ操作指示書 — Make.com Google DriveからObsidianへの自動画像保存設定

作成日: 2026-05-22  
所要時間: 約10分  
目的: Google Driveの指定フォルダに画像（スクリーンショットなど）を入れるだけで、Gemini Visionが自動解釈し、Obsidian（GitHub経由）へ自動で保存する仕組みを構築します。

---

## 🛠 やること（1行まとめ）

Make.comでGoogle Driveのフォルダを監視し、新しい画像が入ったらGASにファイルIDを送信する → GASが解析してObsidianに保存する

```text
あなた → Google Driveに画像をポイッ → Make.com（監視） → GAS（Gemini解釈） → Obsidianへ自動保存
```

---

## 📁 STEP 1：Google Driveのフォルダ準備

1. ご自身のGoogle Driveを開きます。
2. ナレッジ用画像を入れるための専用フォルダを作成します。
   - 例: **「Obsidian用画像」** 
   - （すでに運用中のフォルダがあれば、そちらをお使いいただけます）

---

## 🌐 STEP 2：Make.comでのシナリオ作成

1. https://www.make.com にアクセスしてログインします。
2. 左メニュー「**Scenarios**」をクリックし、右上の「**Create a new scenario**」をクリックします。
3. シナリオ名を `KCS Drive画像 → Obsidian保存` に変更します。

---

## 👁️ STEP 3：Google Drive「Watch Files in Folder」の設定

1. 画面中央の大きな「＋」をクリックし、`Google Drive` を検索して選択します。
2. アクション一覧から **Watch Files in Folder** を選択します。
3. **Connection**: 既存のGoogle接続を選びます（無ければ「Add」からGoogleアカウントを連携）。
4. **Folder**: 「Click here to choose folder」をクリックし、STEP 1で作ったフォルダ（例：「Obsidian用画像」）を選択します。
5. **Watch**: `New Files`（新しいファイルのみ）を選択します。
6. 設定が完了したら「**OK**」を押し、開始位置を「**From now on**（今から）」に設定します。

---

## 🚀 STEP 4：GASへデータを送る「HTTP」の設定

1. Driveモジュールの右側に表示される「＋（Add another module）」をクリックします。
2. 検索欄に `HTTP` と入力し、**Make a request** を選択します。
3. 以下のように設定します：

| 項目 | 設定する値 |
|---|---|
| **URL** | `（KCSバックエンドのGAS ウェブアプリURL）` |
| **Method** | `POST` |
| **Headers → Content-Type** | `application/json` |
| **Body type** | `Raw` |
| **Content type** | `JSON (application/json)` |

### Request content（そのままコピペして、変数を埋めてください）

```json
{
  "action": "drive_knowledge_image",
  "fileId": "{{1.id}}",
  "fileName": "{{1.title}}"
}
```
※ `{{1.id}}` と `{{1.title}}` の部分は、右側のパネルからGoogle Driveモジュールの `File ID` と `Title` を選んで挿入してください。

---

## ⏰ STEP 5：スケジュールの設定と有効化

1. 画面左下にある時計アイコンの横の「Run schedule」を **Every 1 minute**（1分間隔） または **Every 5 minutes**（5分間隔） に設定します。
2. 画面右下のカセットテープアイコン（**Save**）を押して保存します。
3. 画面左下のトグルスイッチを **ON** に切り替えます。

---

## 🎯 STEP 6：動作テスト

1. STEP 1で作成したGoogle Driveのフォルダに、テスト用の画像（スクショや参考資料の写真）をドラッグ＆ドロップで入れます。
2. Make.comの画面左下にある **「Run once（１回だけ実行）」** をクリックします。
3. モジュールの上に緑色のチェックマーク ✅ が付けば送信成功です！
4. 少し待つと、**Discordの「#knowledge」チャンネル**に完了通知が届き、GitHub経由で **Obsidianの「Knowledge/画像解析/」フォルダ** にマークダウンファイルが自動で追加されます！

---

> [!TIP]
> **ファイル名について**
> Google Driveに入れた時のファイル名（例: `スクリーンショット 2026-05-22.png`）が、そのままObsidianでのタイトル（ファイル名）として保存されます。

お疲れ様でした！これで画像ナレッジの完全自動化システムの完成です！
