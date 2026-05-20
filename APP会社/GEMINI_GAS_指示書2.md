# GAS 指示書 2 — X API ウィザード + スマホ指示コマンド

Gemini へ：以下の変更をGAS（GAS_KCS合同会社_Backend.gs）に正確に適用してください。
コードは一字一句正確にコピーし、既存の関数は**絶対に削除しない**でください。

---

## STEP 1 — discordAgentTick を修正（コマンド優先処理）

**探す文字列（1071〜1073行付近）:**
```
      if (!text) {
        props.setProperty(lastIdKey, msg.id);
        continue;
      }

      // ーー ① Webhook が設定されている場合は、Webhook(n8n等) に転送して自動返信 ーー
```

**この2つのブロックの間に以下を挿入してください:**
```javascript
      // ── セットアップウィザード中か確認（最優先）──
      const setupState = props.getProperty('SETUP_STATE');
      const setupChannel = props.getProperty('SETUP_CHANNEL_ID');
      if (setupState && setupChannel === channelId) {
        handleXSetupWizard(text, channelId, msg.id, token);
        props.setProperty(lastIdKey, msg.id);
        continue;
      }

      // ── ! コマンド（webhookより前に処理）──
      if (text.startsWith('!')) {
        const cmdReply = handleBotCommand(text, channelId, token, config);
        if (cmdReply) sendDiscordMessage(channelId, cmdReply, token);
        props.setProperty(lastIdKey, msg.id);
        continue;
      }

```

---

## STEP 2 — 末尾に新しい関数を5つ追加

ファイルの**末尾**（最後の行の後）に以下をまるごと追記してください：

```javascript

// ===================================================
// Discord メッセージ削除（認証情報保護）
// ===================================================
function deleteDiscordMessage(channelId, messageId, token) {
  try {
    UrlFetchApp.fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: 'delete',
        headers: { 'Authorization': `Bot ${token}` },
        muteHttpExceptions: true
      }
    );
    console.log(`[deleteDiscordMessage] 削除完了: ${messageId}`);
  } catch (e) {
    console.error('[deleteDiscordMessage] エラー:', e.message);
  }
}

// ===================================================
// 設定シートの値を更新
// ===================================================
function saveSettingValue(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      console.log(`[saveSettingValue] ${key} を設定シートに保存`);
      return;
    }
  }
  console.warn(`[saveSettingValue] キーが見つかりません: ${key}`);
}

// ===================================================
// X API セットアップウィザード 開始
// ===================================================
function startXSetupWizard(channelId, token) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SETUP_STATE', 'x_ck');
  props.setProperty('SETUP_CHANNEL_ID', channelId);
  sendDiscordMessage(
    channelId,
    '🔑 **X API セットアップ開始**\n' +
    'Twitter Developer Portal から認証情報を取得して、一つずつ貼り付けてください。\n' +
    '⚠️ 貼り付けたメッセージは即座に削除されます（セキュリティ保護）\n\n' +
    'まず **Consumer Key (API Key)** を送信してください：',
    token
  );
}

// ===================================================
// X API セットアップウィザード ステップ処理
// ===================================================
function handleXSetupWizard(text, channelId, messageId, token) {
  const X_SETUP_STEPS = [
    { state: 'x_ck', key: 'X_CONSUMER_KEY',    label: 'Consumer Key (API Key)' },
    { state: 'x_cs', key: 'X_CONSUMER_SECRET', label: 'Consumer Secret (API Secret)' },
    { state: 'x_at', key: 'X_ACCESS_TOKEN',     label: 'Access Token' },
    { state: 'x_as', key: 'X_ACCESS_SECRET',    label: 'Access Secret' },
  ];

  const props = PropertiesService.getScriptProperties();
  const state = props.getProperty('SETUP_STATE');
  const step = X_SETUP_STEPS.find(s => s.state === state);
  if (!step) return;

  // メッセージを即削除（セキュリティ）
  deleteDiscordMessage(channelId, messageId, token);

  // 設定シートに保存
  saveSettingValue(step.key, text.trim());

  // 次のステップへ
  const idx = X_SETUP_STEPS.indexOf(step);
  const next = X_SETUP_STEPS[idx + 1];

  if (next) {
    props.setProperty('SETUP_STATE', next.state);
    sendDiscordMessage(
      channelId,
      `✅ **${step.label}** 保存完了（メッセージ削除済み）\n\n次に **${next.label}** を送信してください：`,
      token
    );
  } else {
    props.deleteProperty('SETUP_STATE');
    props.deleteProperty('SETUP_CHANNEL_ID');
    sendDiscordMessage(
      channelId,
      '🎉 **X API 設定完了！**\n全ての認証情報を設定シートに保存しました。\n\n' +
      '`X投稿：テスト投稿です` と送信して動作確認してください。',
      token
    );
  }
}

// ===================================================
// ! コマンドハンドラ（スマホ指示 from KCS本部）
// ===================================================
function handleBotCommand(text, channelId, token, config) {
  const cmd = text.slice(1).trim(); // ! を除く

  // X API セットアップウィザード起動
  if (/^x設定/.test(cmd)) {
    startXSetupWizard(channelId, token);
    return null; // 内部でメッセージ送信済み
  }

  // ヘルプ
  if (/^(ヘルプ|help|h)$/.test(cmd)) {
    return [
      '📋 **KCS スマホ指示 コマンド一覧**',
      '`!状況` — 進行中プロジェクト一覧',
      '`!出勤` — 本日の出勤状況',
      '`!在庫` — Pizza在庫確認',
      '`!ブリーフィング` — 朝ブリーフィング手動実行',
      '`!x設定` — X API 認証情報ウィザード',
      '',
      '通常メッセージはAIが回答します。',
      'X投稿は `X投稿：本文` と送信してください。',
    ].join('\n');
  }

  // 状況・プロジェクト
  if (/^(状況|status|プロジェクト|タスク)/.test(cmd)) {
    return cmdProjectSummary();
  }

  // 出勤
  if (/^出勤/.test(cmd)) {
    return cmdTodayAttendance(config);
  }

  // 在庫
  if (/^(在庫|stock|pizza|ピザ)/.test(cmd)) {
    return cmdPizzaStock(config);
  }

  // ブリーフィング手動実行
  if (/^ブリーフィング/.test(cmd)) {
    try {
      morningBriefing();
      return '🌅 朝ブリーフィングを手動実行しました！';
    } catch (e) {
      return `❌ ブリーフィングエラー: ${e.message}`;
    }
  }

  // 未知のコマンド
  return `❓ 不明なコマンド: \`!${cmd}\`\n\`!ヘルプ\` でコマンド一覧を確認してください。`;
}
```

---

## STEP 3 — Botに「メッセージの管理」権限を付与（Discord Developer Portal）

1. https://discord.com/developers/applications を開く
2. Bot のアプリを選択 → **Bot** タブ
3. **Privileged Gateway Intents** の `MESSAGE CONTENT INTENT` が ON になっているか確認
4. **OAuth2 → URL Generator** で `MANAGE_MESSAGES` スコープを Bot 権限に追加
5. サーバーのBot権限で「メッセージの管理」が許可されていることを確認

（すでに管理者権限でBotを招待済みの場合はスキップ可）

---

## 完了後の確認

1. GASを**保存・デプロイ**（新バージョンとして）
2. KCS本部で `!ヘルプ` と送信してコマンド一覧が返ってくるか確認
3. `!x設定` でウィザード開始 → 認証情報を順番に入力
4. 設定シートの `X_CONSUMER_KEY` 等に値が入っているか確認
5. `X投稿：テスト投稿` でXへの実投稿テスト
