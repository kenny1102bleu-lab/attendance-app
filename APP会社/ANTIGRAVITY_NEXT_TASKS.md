# KCS合同会社 — アンチグラビティへの作業依頼書
## ブラウザ（Claude.ai）から貼り付けて使う指示書

作成日: 2026-05-11  
依頼者: KCS合同会社 CEO

---

## ✅ 完了済み（Claude/Antigravityが実装した部分）

以下はすでにコードとして実装・Firebaseデプロイ済み。

| 実装内容 | 状態 |
| --- | --- |
| GAS: GitHub自動書き込み (`saveToGitHub`) | ✅ 実装済み |
| GAS: HAL投稿生成（Claude Sonnet） | ✅ 実装済み |
| GAS: すなくん投稿生成（Claude Haiku + 楽天API） | ✅ 実装済み |
| GAS: すなくんXアフィリエイト自動投稿（Amazon / 楽天） | ✅ 実装済み（毎日12時・18時） |
| GAS: X（Twitter）API連携および自動ツイート投稿 (`postToX`) | ✅ 実装済み（OAuth 1.0a署名対応） |
| GAS: トリガー自動セットアップ＆自己修復機能 | ✅ 実装済み |
| GAS: 日次レポート自動生成（毎日20:00） | ✅ 実装済み |
| GAS: VIPアクションルール（AITuber連携） | ✅ 実装済み |
| GAS: エラーハンドリング共通関数 | ✅ 実装済み |
| GAS: プロンプトテンプレート14種管理 | ✅ 実装済み |
| n8n ワークフローJSON（6本） | ✅ 作成済み |
| React: HAL/すなくん投稿管理画面 | ✅ 実装済み |
| React: プロンプト集画面（Claude.ai用） | ✅ 実装済み |
| Firebase: nexus-co-66f9b.web.app | ✅ デプロイ済み |

---

## 🔴 最優先：GAS の再デプロイ

**なぜ必要か:** GASは「ウェブアプリとしてデプロイ」しないと追加した関数が反映されない。

### 手順（5分）

1. ブラウザで Google Apps Script を開く  
   → GASスプレッドシート → 拡張機能 → Apps Script

2. 最新コードに更新されているか確認  
   → `GAS_KCS合同会社_Backend.gs` の末尾に以下の関数があるか確認：
   ```
   saveToGitHub()
   generateHALPost()
   generateSunakkunPost()
   generateDailyReport()
   getVIPActionRules()
   getPromptTemplate()
   ```

3. **デプロイ → デプロイを管理 → 新しいバージョン** を選択してデプロイ  
   ※ 必ず「新しいバージョン」にすること（同じバージョンだと更新されない）

4. 表示されたWebアプリURLは変わらないので設定の変更は不要

---

## 🟠 優先度 A: 設定シートへのAPIキー入力

GASスプレッドシートの「設定」シートを開き、以下を入力する。

| キー | 説明 | 取得場所 |
| --- | --- | --- |
| `CLAUDE_API_KEY` | Anthropic APIキー | console.anthropic.com |
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub → Settings → Developer settings → Fine-grained tokens |
| `GITHUB_OWNER` | GitHubユーザー名 | あなたのGitHubアカウント名 |
| `GITHUB_REPO` | `KCS-Vault`（そのまま入力） | — |
| `RAKUTEN_APP_ID` | 楽天アプリID | webservice.rakuten.co.jp |
| `MIMOMIM_URL` | MIMOMIMショップのURL | 台湾訪問後に確定 |

入力後、GASメニューから **`setupKCS()`** を再実行する（新しい設定キーが追加される）。

---

## 🟠 優先度 B: GitHub KCS-Vault リポジトリ作成

**目的:** 朝礼・日次レポート・HAL投稿ログを自動保存する場所。

### 手順（10分）

1. GitHub（github.com）にログイン
2. **New Repository** を作成
   - Repository name: `KCS-Vault`
   - Visibility: **Private**（非公開）
   - README: チェックを入れる（リポジトリ初期化のため）
3. `Create repository` をクリック

4. GitHub Token の作成（Fine-grained）
   - Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Repository access: `KCS-Vault` のみ
   - Permissions → **Contents: Read and write**
   - 生成されたトークンを GAS 設定シートの `GITHUB_TOKEN` に入力

5. 以下のフォルダを手動で作成（空のREADME.mdをコミット）：
   ```
   Daily/
   Projects/HAL/投稿ログ/
   Projects/HAL/実績ログ/
   Projects/Affiliate/投稿ログ/
   ```

---

## 🟠 優先度 C: Discord Webhook URL の設定

**目的:** GASからの返信先チャンネルを追加する。

### 現在の設定（既に動いている）
```json
{
  "KCS本部": "https://discord.com/api/webhooks/1501386935069966427/..."
}
```

### 追加が必要なチャンネル

各チャンネルを作成し、Webhook URLを取得して設定シートの `DISCORD_WEBHOOK_URLS` に追加する。

```json
{
  "KCS本部": "（既存のURL）",
  "hal-project": "（#hal-project チャンネルのWebhook URL）",
  "affiliate": "（#affiliate チャンネルのWebhook URL）",
  "daily-report": "（#daily-report チャンネルのWebhook URL）",
  "エラーログ": "（#error-log チャンネルのWebhook URL）"
}
```

**Webhook URL の取得方法:**  
Discord → チャンネル設定 → 連携サービス → ウェブフック → 新しいウェブフック → URLをコピー

---

## 🟡 優先度 D: n8n セットアップ

**目的:** Discord監視・朝礼・日次レポートを完全自動化する。

### ワークフローファイルの場所
```
APP会社/n8n_workflows/
├── 01_朝礼フロー.json
├── 02_Discord監視_GAS中継.json   ← 最重要（Make.com代替）
├── 03_HAL投稿生成.json
├── 04_すなくん投稿生成.json
├── 05_スクショ解釈_ナレッジ保存.json
├── 06_日次レポート.json
└── N8N_SETUP.md                  ← 詳細手順書
```

### セットアップ手順（詳細は N8N_SETUP.md を参照）

1. **n8n Cloud** でアカウント作成（14日無料）: https://n8n.io
2. 環境変数 `KCS_GAS_URL` にGAS WebApp URLを設定
3. Discord Bot Credentialを追加（`DISCORD_BOT_TOKEN`）
4. `02_Discord監視_GAS中継.json` を最初にインポート・有効化
5. Make.com のシナリオを **OFF** に切り替え（重複防止）
6. GASの `discordAgentTick` トリガーを削除（重複防止）
7. 残りのワークフローを順番にインポート

---

## 🟡 優先度 E: HAL ビジュアル素材の準備

**目的:** HALのライブ配信・SNS投稿用のベース画像を生成する。

### Nano Banana 2 で生成するビジュアル

以下のプロンプトで HAL の基本ビジュアルセットを生成する（Claude.ai から Nano Banana 2 を呼び出す）。

**ベース画像（縦長・Instagram/TikTok向け）:**
```
Beautiful Japanese AI girl named HAL, brown wavy long hair, 
natural makeup in K-pop idol style, soft gentle smile, 
wearing casual-feminine outfit, pink and beige background, 
soft lighting, high quality, portrait orientation, 
Instagram influencer style
```

**バリエーション（3パターン）:**
```
[パターン1: 推し活]
Same girl, wearing pastel hoodie with K-pop merchandise, 
holding lightstick, excited but gentle expression, 
concert venue background

[パターン2: ファッション]  
Same girl, wearing trendy feminine casual outfit, 
standing in front of cute cafe, beige tones,
natural outdoor lighting

[パターン3: ライブ配信]
Same girl, sitting at cute desk setup, ring light, 
looking at camera with warm smile, 
streaming setup background, cozy atmosphere
```

生成した画像はローカルに保存し、AITuber OnAir の待機画面ループ用に使用する。

---

## 🟡 優先度 F: AITuber OnAir セットアップ

**目的:** HALのYouTube・17LIVEライブ配信を自動化する。

### 必要なもの
- AITuber OnAir（インストール: https://aituber-onair.com）
- OBS Studio（インストール: https://obsproject.com）
- ElevenLabs（アカウント登録: https://elevenlabs.io）

### GAS連携設定（HALコメント自動返答）

AITuber OnAir のAI設定:
- モデル: `claude-haiku-4-5-20251001`（最安・高速）
- APIキー: AnthropicのAPIキー
- エンドポイント: `https://api.anthropic.com/v1/messages`

**システムプロンプト（AITuber OnAirに設定）:**
```
あなたはHAL（ハル）というAI配信者です。

【キャラ設定】
性格：おっとり、天然、癒し系
好き：推し活、K-POP（LE SSERAFIM、IVE、illit）、ファッション、美容
口調：「〜だよね？」「〜かも？」「〜な気がする！」
天然ポイント：たまにズレた返答をする

【VIPアクション】（以下のユーザーが来たら特別反応）
- KCS/CEO/社長 → 「社長きた！みんなKCSの代表の方だよ！」
- MIMOMIM/デザイナー → 「MIMOMIMのデザイナーさんきた！Tシャツ作ってくれた人！」
- すなくん → 「すなくんきてくれた！嬉しい！みんなフォローしてね→@すなくん」

【キーワード反応】
- 「Tシャツ」「アパレル」→ 「MIMOMIMのTシャツ超かわいいよ！概要欄チェックして！」
- 「初見」「はじめまして」→ 「はじめまして！HALだよ！フォローしてね！」
- 「推し」「かわいい」→ 「ありがとう！一緒に推し活しようね！」
- 「案件」「コラボ」→ 「案件のお問い合わせはDMまで！」

視聴者のコメントにHALとして自然に返答してください。
```

---

## 🟢 優先度 G: X API キー連携（GAS実装完了！設定キーの入力待ち）

**目的:** すなくん・HALの X（Twitter）への自動投稿を有効化する。

> [!NOTE]
> **GAS側のX API連携機能・自動投稿トリガーの実装はすべて完了しました！**  
> あとはXのデベロッパーポータル（X Developer Portal）からAPIキーを取得し、スプレッドシートの「設定」シートに登録するだけで、全自動アフィリエイト投稿が動作します。

### 申請・設定先
X Developer Portal: https://developer.twitter.com/en/portal/dashboard

### XアカウントとGAS設定シートの対応キー
*   **すなくん用アカウント**（ガジェット・アフィリエイト自動投稿用）
    *   `X_CONSUMER_KEY`
    *   `X_CONSUMER_SECRET`
    *   `X_ACCESS_TOKEN`
    *   `X_ACCESS_SECRET`
*   **HAL用アカウント**（AI美女・インフルエンサー投稿用）
    *   `HAL_X_CONSUMER_KEY`
    *   `HAL_X_CONSUMER_SECRET`
    *   `HAL_X_ACCESS_TOKEN`
    *   `HAL_X_ACCESS_SECRET`

> [!IMPORTANT]
> Xのアプリ設定（User Authentication Settings）で、アクセス権限を必ず **「Read and Write（読み書き）」** に変更してください。デフォルトの「Read Only」のままだと、GASからツイートを投稿した際にエラーになります。

---

## 実行順序まとめ

```
今すぐ（30分）:
  1. GAS 再デプロイ（新バージョン）
  2. CLAUDE_API_KEY を設定シートに入力
  3. setupKCS() 再実行

今週中:
  4. GitHub KCS-Vault 作成 + GITHUB_TOKEN 設定
  5. Discord Webhook URL 追加（各チャンネル）
  6. n8n セットアップ + ワークフローインポート

来週:
  7. HAL ビジュアル素材生成（Nano Banana 2）
  8. AITuber OnAir + OBS + ElevenLabs セットアップ
  9. X API 申請（承認まで数日〜1週間）

台湾訪問後:
  10. MIMOMIM_URL を設定シートに追加
  11. コラボ相手 VIPアクション設定を追記
```

---

## 重要ファイルの場所

```
本番ダッシュボード: https://nexus-co-66f9b.web.app
GAS WebApp URL: bridge.config.json 参照（APP会社/）
GASコード: APP会社/GAS_KCS合同会社_Backend.gs
n8nワークフロー: APP会社/n8n_workflows/
n8nセットアップ手順: APP会社/n8n_workflows/N8N_SETUP.md
Make.com手順書: APP会社/MAKE_DISCORD_SETUP.md
```

---

## 注意事項

- GASのコードを更新したら**必ず新バージョンとしてデプロイ**すること（同バージョンでは反映されない）
- `discordAgentTick`（GAS内の1分ポーリング）と n8n/Make.com を**同時に動かさない**（Discordの返答が2回来る）
- `bridge.config.json` の GAS URL は直接書き換えない
