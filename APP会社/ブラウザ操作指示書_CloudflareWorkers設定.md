# ブラウザ操作指示書 — Cloudflare Workers で Discord 認証を通す

作成日: 2026-05-14  
所要時間: 約15分  
費用: **無料**（100,000リクエスト/日）

---

## なぜ Cloudflare Workers が必要か

Discord は Interactions Endpoint URL に登録するとき、**Ed25519 署名付きの PING** を送って認証する。  
Google Apps Script（GAS）はヘッダーが届かないため自分では検証できない。  
Cloudflare Workers は正しくヘッダーを受け取れるので、ここで検証 → GAS に転送する。

```
Discord → Cloudflare Workers（Ed25519検証 + PONG返却）→ GAS（スラッシュコマンド処理）
```

---

## STEP 1：Cloudflare アカウント作成（すでにあれば STEP 2 へ）

1. `https://dash.cloudflare.com/sign-up` を開く
2. メールアドレスとパスワードを入力 → **Create Account**
3. メール確認のリンクをクリック

---

## STEP 2：Workers を作成

1. ダッシュボードにログイン後、左メニュー **「Workers & Pages」** をクリック
2. **「Create」** → **「Create Worker」**
3. Worker 名を入力（例: `kcs-discord`）
4. **「Deploy」** をクリック（まず空のWorkerを作る）
5. 「Edit code」をクリック → コードエディターが開く

---

## STEP 3：Worker コードを貼り付ける

エディター内のコードを**全削除**して、以下を貼り付ける：

```javascript
const PUBLIC_KEY = '41217f6d5574fd4c530c70bc44574d66c43c1620a40c179bf5fc0153771c4626';
const GAS_URL    = 'https://script.google.com/macros/s/AKfycbxmVS3EyDiT8KtX4r10SIE8eDu3ri_7aRbYXR4kFpEqSKuQnDsJLlTO1HV6p7RW1mTF/exec';

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

async function verifySignature(signature, timestamp, body) {
  const key = await crypto.subtle.importKey(
    'raw', hexToBytes(PUBLIC_KEY),
    { name: 'Ed25519' }, false, ['verify']
  );
  const data = new TextEncoder().encode(timestamp + body);
  return crypto.subtle.verify('Ed25519', key, hexToBytes(signature), data);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const body      = await request.text();

    if (!signature || !timestamp) {
      return new Response('Unauthorized', { status: 401 });
    }

    const isValid = await verifySignature(signature, timestamp, body).catch(() => false);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const interaction = JSON.parse(body);

    // PING → PONG（Discord URL登録時の認証）
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // スラッシュコマンド → type:5（処理中）を即返し、GAS に転送
    ctx.waitUntil(
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
    );

    return new Response(JSON.stringify({ type: 5 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

---

## STEP 4：保存 & デプロイ

1. 右上 **「Save and Deploy」** をクリック
2. 「Your Worker was deployed successfully.」が表示されれば成功 ✅
3. 上部に表示される Workers の URL をコピー（例: `https://kcs-discord.your-name.workers.dev`）

---

## STEP 5：GAS コードを更新してデプロイ

#### 5-1. ローカルのコードをコピー

```
c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\APP会社\GAS_KCS合同会社_Backend.gs
```

全選択（Ctrl+A）→ コピー（Ctrl+C）

#### 5-2. GAS エディターに貼り付け

1. Google スプレッドシート（KCS合同会社）→ 拡張機能 → Apps Script
2. エディター全選択（Ctrl+A）→ 貼り付け（Ctrl+V）→ 保存（Ctrl+S）

#### 5-3. 新バージョンでデプロイ

1. 右上「デプロイ」→「デプロイを管理」→「新しいデプロイ」
2. 種類: ウェブアプリ / 実行: 自分 / アクセス: **全員**
3. 「デプロイ」→ 権限承認

---

## STEP 6：Discord Developer Portal で URL 設定

1. ブラウザで開く：
   ```
   https://discord.com/developers/applications/1494714160829693992/information
   ```

2. **「Interactions Endpoint URL」** に STEP 4 の Workers URL を入力：
   ```
   https://kcs-discord.your-name.workers.dev
   ```
   ※ `your-name` の部分は実際のサブドメインに置き換え

3. **「Save Changes」** をクリック

4. ✅ **「Interactions Endpoint URL is valid」** が表示されれば成功！

---

## STEP 7：スラッシュコマンドを Discord に登録

GAS エディターに戻り：

1. 関数プルダウン → **`registerDiscordSlashCommands`** → **▶ 実行**
2. 「✅ Slash Commands XX個を登録しました！」が出れば成功

---

## STEP 8：定時トリガーを設定

1. 関数プルダウン → **`setupAllTriggers`** → **▶ 実行**
2. 「✅ トリガーを設定しました（朝8時: morningBriefing, 夜8時: generateDailyReport）」が出れば成功

---

## STEP 9：Make.com を OFF に

返答が2重に来ないよう、Make.com の全シナリオをトグル OFF にする。

---

## STEP 10：テスト

Discord **#KCS本部** チャンネルで：

```
/help
```

→ 「⏳ KCS Bot is thinking...」が表示され、約1分後にコマンド一覧が届けば ✅

---

## よくあるエラー

| エラー | 原因 | 対処 |
|---|---|---|
| `Interactions Endpoint URL is invalid` | Workers URL が間違い or STEP 3 のコードミス | Workers URL を再確認 |
| `Invalid signature` が Workers ログに出る | PUBLIC_KEY が間違っている | Discord Developer Portal の Public Key を確認して貼り直し |
| `/help` を打っても何も来ない | GAS トークン切れ or 設定シート未入力 | GAS 設定シートの `DISCORD_BOT_TOKEN` を確認 |
| 返答が2回来る | Make.com が残っている | STEP 9 で Make.com を OFF に |

---

## チェックリスト

- [ ] Cloudflare アカウント作成
- [ ] Worker 作成 & コード貼り付け → デプロイ
- [ ] Workers URL をコピー
- [ ] GAS コード更新 → 新バージョンデプロイ
- [ ] Discord Developer Portal: Interactions Endpoint URL に Workers URL を入力 → 「valid」確認
- [ ] `registerDiscordSlashCommands` 実行
- [ ] `setupAllTriggers` 実行
- [ ] Make.com を OFF
- [ ] `/help` テスト成功

---

*作成: 2026-05-14*
