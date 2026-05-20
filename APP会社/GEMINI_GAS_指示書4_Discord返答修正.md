# GAS 指示書 4 — Discord 返答が届かない問題の修正

Gemini へ：以下の変更を `GAS_KCS合同会社_Backend.gs` に正確に適用してください。
既存の関数は**削除しない**でください。追記・置換のみ行ってください。

---

## 背景と原因

n8n が Discord メッセージを受信し、GAS に以下の形式で POST している：

```json
{
  "action": "discord_message",
  "channelId": "Discordのチャンネルid",
  "text": "メッセージ本文",
  "author": "ユーザー名",
  "messageId": "メッセージid"
}
```

GAS の `handleDiscordMessageFromMake()` が受信 → `cmdAskGemini()` で回答生成 → `replyViaWebhook()` でDiscordに返答、という流れ。

**返答が来ない原因：**
1. GAS が「新バージョン」でデプロイされておらず、`discord_message` ハンドラが本番に反映されていない
2. 設定シートに `DISCORD_WEBHOOK_URLS` が未入力のため、返答の送り先がない
3. `generateDailyReport()` 内で呼ばれる `getAffiliatePosts()` / `getSalesSummary()` / `getYouTubeChannelStats()` が未定義のため、デプロイ後にエラーになる可能性がある
4. `listDriveFiles()` の中身が空のため、呼ばれると即エラー

---

## STEP 1 — `listDriveFiles` の中身を実装する

**探す文字列（現在の中身が空のスタブ）:**
```javascript
function listDriveFiles(data) {
  // ... (既存コード) ...
}
```

**以下で完全に置き換えてください:**
```javascript
function listDriveFiles(data) {
  try {
    const query = data.query || '';
    const mimeType = data.mimeType || '';
    let q = `trashed = false`;
    if (query) q += ` and fullText contains '${query}'`;
    if (mimeType) q += ` and mimeType = '${mimeType}'`;

    const files = DriveApp.searchFiles(q);
    const results = [];
    let count = 0;
    while (files.hasNext() && count < 20) {
      const f = files.next();
      results.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType() });
      count++;
    }
    return jsonResponse({ status: 'ok', files: results });
  } catch (e) {
    return jsonResponse({ status: 'error', message: e.message });
  }
}
```

---

## STEP 2 — 不定義の補助関数を追加する

**探す文字列（ファイル末尾の `getPromptTemplate` 関数の閉じカッコの直後）:**
```javascript
  return jsonResponse({ ok: true, template: tpl });
}
```

**その直後に以下をまるごと追加してください:**
```javascript

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 補助関数（日次レポート・X投稿用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// SNS投稿管理シートから今日の投稿を取得
function getAffiliatePosts() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SNS投稿管理');
    if (!sheet || sheet.getLastRow() <= 1) return { posts: [] };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const posts = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return { posts };
  } catch (e) {
    console.error('[getAffiliatePosts] エラー:', e.message);
    return { posts: [], error: e.message };
  }
}

// YouTube チャンネル統計取得（APIキー未設定時はダミー返却）
function getYouTubeChannelStats() {
  const config = getKCSSettings();
  const apiKey = config.YOUTUBE_API_KEY || '';
  const channelId = config.YOUTUBE_CHANNEL_ID || '';
  if (!apiKey || !channelId) return { subscribers: 0, views: 0, error: 'YouTube API未設定' };
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const stats = data?.items?.[0]?.statistics || {};
    return {
      subscribers: parseInt(stats.subscriberCount || '0'),
      views: parseInt(stats.viewCount || '0'),
      videoCount: parseInt(stats.videoCount || '0')
    };
  } catch (e) {
    console.error('[YouTube] 取得エラー:', e.message);
    return { subscribers: 0, error: e.message };
  }
}

// Pizza 在庫サマリー取得
function getSalesSummary() {
  const config = getKCSSettings();
  const pizzaUrl = config.PIZZA_GAS_URL || '';
  if (!pizzaUrl) return { inStock: 0, total: 0, error: 'PIZZA_GAS_URL未設定' };
  try {
    const res = UrlFetchApp.fetch(pizzaUrl + '?action=getProducts', { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const products = Array.isArray(data) ? data : (data.products || []);
    const inStock = products.filter(p => p.stock === 'inStock' || p.inStock === true).length;
    return { inStock, total: products.length };
  } catch (e) {
    console.error('[Pizza] 取得エラー:', e.message);
    return { inStock: 0, total: 0, error: e.message };
  }
}

// X（Twitter）への投稿（APIキー未設定時はログのみ）
function postToX(text) {
  const config = getKCSSettings();
  const consumerKey    = config.HAL_X_CONSUMER_KEY    || config.X_CONSUMER_KEY    || '';
  const consumerSecret = config.HAL_X_CONSUMER_SECRET || config.X_CONSUMER_SECRET || '';
  const accessToken    = config.HAL_X_ACCESS_TOKEN    || config.X_ACCESS_TOKEN    || '';
  const accessSecret   = config.HAL_X_ACCESS_SECRET   || config.X_ACCESS_SECRET   || '';

  if (!consumerKey || !accessToken) {
    console.warn('[postToX] X APIキー未設定 — 投稿スキップ。テキスト:', text.slice(0, 50));
    return { ok: false, skipped: true, reason: 'X APIキー未設定' };
  }

  try {
    // OAuth 1.0a 署名（Twitter API v2 用）
    const url = 'https://api.twitter.com/2/tweets';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Utilities.getUuid().replace(/-/g, '');

    const params = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    const paramStr = Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const baseStr = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(baseStr, signingKey)
    );
    params['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
      .join(', ');

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': authHeader },
      payload: JSON.stringify({ text: text.slice(0, 280) }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText());

    if (code === 201 || code === 200) {
      console.log('[postToX] 投稿成功:', body?.data?.id);
      return { ok: true, tweetId: body?.data?.id };
    } else {
      console.error('[postToX] 投稿失敗:', res.getContentText().slice(0, 200));
      return { ok: false, error: body };
    }
  } catch (e) {
    console.error('[postToX] 例外:', e.message);
    return { ok: false, error: e.message };
  }
}
```

---

## STEP 3 — 設定シートへの追加キーを setupKCS に追記

**探す文字列（setupKCS の defaults 配列の末尾、`];` の直前）:**
```javascript
      ['LOG_ENABLED', 'true', 'チャットログの記録 (true / false)'],
    ];
    settingsSheet.getRange(1, 1, defaults.length, 3).setValues(defaults);
```

**`LOG_ENABLED` の行の直後（`];` の前）に以下を追加:**
```javascript
      ['DISCORD_WEBHOOK_URLS', '{"KCS本部":""}', 'Discord Webhook URL（JSON形式）'],
      ['DISCORD_BOT_TOKEN', '', 'Discord Bot トークン（Bot API 返答用）'],
      ['GEMINI_API_KEY', '', 'Gemini API キー（Google AI Studio から取得）'],
      ['CLAUDE_API_KEY', '', 'Anthropic Claude API キー'],
      ['GITHUB_TOKEN', '', 'GitHub Fine-grained Token'],
      ['GITHUB_OWNER', '', 'GitHubユーザー名'],
      ['GITHUB_REPO', 'KCS-Vault', 'GitHubリポジトリ名'],
      ['RAKUTEN_APP_ID', '', '楽天アプリID'],
      ['PIZZA_GAS_URL', 'https://script.google.com/macros/s/AKfycbwlUczPBlz7x_CfNPdpvM-pizrcXnk3250d62J5vFdA6d3lpF1IdEJUlm3RqyZK2NUx/exec', 'Pizza GAS URL'],
      ['YOUTUBE_API_KEY', '', 'YouTube Data API v3 キー'],
      ['YOUTUBE_CHANNEL_ID', '', 'YouTubeチャンネルID'],
      ['MIMOMIM_URL', '', 'MIMOMIMショップURL（台湾訪問後に入力）'],
      ['HAL_X_CONSUMER_KEY', '', 'HAL用 X Consumer Key'],
      ['HAL_X_CONSUMER_SECRET', '', 'HAL用 X Consumer Secret'],
      ['HAL_X_ACCESS_TOKEN', '', 'HAL用 X Access Token'],
      ['HAL_X_ACCESS_SECRET', '', 'HAL用 X Access Secret'],
```

---

## 完了後の作業（GASエディタでの手順）

1. 上記の変更を反映したコードを保存
2. **「デプロイ」→「デプロイを管理」→「新しいバージョン」でデプロイ**
   - アクセス権限: 「全員」または「Googleアカウントを持つ全員」
3. `setupKCS()` を実行 → 設定シートに新しいキーが追加される
4. 設定シートの「設定」シートを開き、以下を入力：

| キー | 値 |
|---|---|
| `DISCORD_WEBHOOK_URLS` | `{"KCS本部":"https://discord.com/api/webhooks/1501386935069966427/（末尾のトークン）"}` |
| `GEMINI_API_KEY` | Google AI Studio のAPIキー |
| `CLAUDE_API_KEY` | Anthropic コンソールのAPIキー |

5. KCS本部チャンネルで適当なメッセージを送信 → GAS実行ログ（Apps Script → 実行数）を確認
6. `handleDiscordMessageFromMake` が呼ばれていれば成功

---

## 動作確認チェックリスト

- [ ] GASのデプロイ履歴に「新しいバージョン」があるか
- [ ] 設定シートに `DISCORD_WEBHOOK_URLS` が JSON 形式で入力されているか
- [ ] n8n の `02_Discord監視_GAS中継` ワークフローが「有効」になっているか
- [ ] GAS 実行ログにエラーが出ていないか（Apps Script → 実行数 タブ）
- [ ] `discordAgentTick` トリガーが削除されているか（トリガー一覧で確認）
