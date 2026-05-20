# GAS追加実装 指示書
## ファイル: `GAS_KCS合同会社_Backend.gs`

---

## 概要
以下の3機能を追加する。
1. **案件受付チャンネル** — `#案件受付` に投稿するとプロジェクトが自動登録される
2. **毎朝ブリーフィング** — 毎朝8時にDiscordへ今日の行動指針を自動送信
3. **トリガー自己修復** — トリガーが停止しても翌朝自動で再登録される

---

## STEP 1 — `onOpen()` にメニュー項目を追加

`.addItem('📱 アフィリエイト自動投稿セットアップ', 'setupAffiliateTrigger')` の後ろ（`.addToUi()` の直前）に追加する。

```javascript
    .addSeparator()
    .addItem('🌅 朝ブリーフィング 手動実行', 'morningBriefing')
    .addItem('⏰ 朝ブリーフィング トリガー設定', 'setupMorningBriefingTrigger')
    .addSeparator()
    .addItem('🔧 全トリガー 一括セットアップ', 'setupAllTriggers')
    .addItem('💊 トリガー自己修復 手動実行', 'manualHealTriggers')
```

---

## STEP 2 — `setupKCS()` の新規インストール側に設定項目を追加

`setupKCS()` 内の `const defaults = [` ブロックで、`'YOUTUBE_CHANNEL_ID'` の行の**直後**に追加する。

```javascript
      ['INTAKE_CHANNEL_ID', '', '案件受付チャンネルID（#案件受付 の右クリック→チャンネルIDをコピー）'],
```

---

## STEP 3 — `setupKCS()` の既存インストール側に設定項目を追加

同じ `setupKCS()` 内の `const newRows = [` ブロック（else節）で、`'OBSIDIAN_FOLDER_ID'` の行の**直後**に追加する。

```javascript
      ['INTAKE_CHANNEL_ID', '', '案件受付チャンネルID（#案件受付 の右クリック→チャンネルIDをコピー）'],
```

---

## STEP 4 — `doPost()` に案件受付アクションを追加

`doPost()` 内の `if (body.action === 'save_to_obsidian')` ブロックの**直後**に追加する。

```javascript
    if (body.action === 'morning_briefing') {
      morningBriefing();
      return jsonResponse({ status: 'ok', message: '朝ブリーフィングを実行しました' });
    }
```

---

## STEP 5 — `discordAgentTick()` の末尾に案件受付チェックを追加

`discordAgentTick()` 内の `console.log('--- Discord Agent Tick End ---');` の**直前**に追加する。

```javascript
  // ── 案件受付チャンネル チェック ──
  const intakeChannelId = config.INTAKE_CHANNEL_ID;
  if (intakeChannelId) {
    const intakeKey = `DISCORD_LAST_MSG_${intakeChannelId}`;
    let intakeLastId = props.getProperty(intakeKey);

    if (!intakeLastId) {
      try {
        const initRes = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${intakeChannelId}/messages?limit=1`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const latest = JSON.parse(initRes.getContentText());
        if (Array.isArray(latest) && latest.length > 0) {
          props.setProperty(intakeKey, latest[0].id);
          console.log(`[案件受付] 初期化完了。次回から監視開始。`);
        }
      } catch (e) {
        console.error('[案件受付] 初期化エラー:', e.message);
      }
    } else {
      try {
        const res = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${intakeChannelId}/messages?after=${intakeLastId}&limit=5`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const messages = JSON.parse(res.getContentText());
        if (Array.isArray(messages) && messages.length > 0) {
          const sorted = messages.sort((a, b) => a.id > b.id ? 1 : -1);
          for (const msg of sorted) {
            if (!msg.author?.bot && msg.content?.trim()) {
              console.log(`[案件受付] 新規メッセージ受信: ${msg.content.slice(0, 50)}`);
              handleProjectIntake(msg.content, token, intakeChannelId, config);
            }
            props.setProperty(intakeKey, msg.id);
          }
        }
      } catch (e) {
        console.error('[案件受付] チェックエラー:', e.message);
      }
    }
  }
```

---

## STEP 6 — 新関数を5つ追加（ファイル末尾に追記）

ファイルの**一番最後**に以下をまとめて追加する。

```javascript
// ===================================================
// 📥 案件受付チャンネル
// ===================================================

function parseIntakeMessage(text, config) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt =
    `以下のDiscordメッセージから案件情報を抽出してJSON形式で返してください。\n` +
    `メッセージ:\n${text}\n\n` +
    `以下のJSON形式のみ返してください（情報がなければ空文字）:\n` +
    `{"clientName":"","content":"","budget":"","deadline":"","notes":""}\n` +
    `clientName が取得できない場合は "不明" にしてください。`;

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        muteHttpExceptions: true
      }
    );
    const data = JSON.parse(res.getContentText());
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = reply.match(/\{[\s\S]*?\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[parseIntakeMessage] エラー:', e.message);
  }
  return null;
}

function handleProjectIntake(messageText, token, intakeChannelId, config) {
  const parsed = parseIntakeMessage(messageText, config);
  if (!parsed || !parsed.clientName || parsed.clientName === '不明') {
    sendDiscordMessage(intakeChannelId,
      '⚠️ 案件情報を読み取れませんでした。\n\n以下のフォーマットで投稿してください：\n```\nクライアント: ○○株式会社\n内容: ECサイトのUI改善\n予算: 30万\n期限: 7月末\n```', token);
    return;
  }

  const projectName = parsed.clientName + (parsed.content ? ' — ' + parsed.content.slice(0, 25) : '');
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const projectId = 'proj_' + Date.now();

  // スプレッドシートに登録
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projSheet = ss.getSheetByName('プロジェクト') || ss.insertSheet('プロジェクト');
  projSheet.appendRow([projectId, projectName, parsed.content, '進行中', now, now]);

  // Discordチャンネル作成
  const guildId = config.DISCORD_GUILD_ID;
  let newChannelId = null;
  let newChannelName = null;
  if (token && guildId) {
    const channelName = 'pj-' + parsed.clientName
      .toLowerCase()
      .replace(/[\s　]+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 85) || 'project';
    try {
      const res = UrlFetchApp.fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ name: channelName, type: 0 }),
        muteHttpExceptions: true
      });
      const ch = JSON.parse(res.getContentText());
      if (ch.id) {
        newChannelId = ch.id;
        newChannelName = channelName;
        let channelMap = {};
        try { channelMap = JSON.parse(config.DISCORD_CHANNELS || '{}'); } catch {}
        channelMap[projectName] = ch.id;
        updateSettingValue('DISCORD_CHANNELS', JSON.stringify(channelMap));
      }
    } catch (e) {
      console.error('[案件受付] チャンネル作成エラー:', e.message);
    }
  }

  // Geminiで担当スタッフを決定
  let staffLine = '';
  if (config.GEMINI_API_KEY) {
    const staffPrompt =
      `KCS合同会社の新規案件に最適な担当スタッフを1名選んでください。\n` +
      `案件名: ${projectName}\n内容: ${parsed.content}\n\n` +
      `選択肢:\n` +
      `- ハルキ（プランナー）: ロードマップ・要件定義\n` +
      `- アカリ（プロデューサー）: アイデア・ブランディング\n` +
      `- ケンジ（プログラマー）: 開発・API連携・自動化\n` +
      `- リョウ（マーケター）: SNS・データ分析・SEO\n` +
      `- ユキ（コンテンツ）: 台本・YouTube・動画企画\n` +
      `- タクミ（セールス）: LP・マネタイズ・営業資料\n\n` +
      `{"staffName":"","emoji":"","reason":"（20字以内）"} のみ返してください。`;
    try {
      const res = UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.GEMINI_API_KEY}`,
        {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: staffPrompt }] }] }),
          muteHttpExceptions: true
        }
      );
      const data = JSON.parse(res.getContentText());
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const m = reply.match(/\{[\s\S]*?\}/);
      if (m) {
        const s = JSON.parse(m[0]);
        staffLine = `${s.emoji || '👤'} 担当: **${s.staffName}**（${s.reason}）`;
      }
    } catch (e) {
      console.error('[案件受付] スタッフ決定エラー:', e.message);
    }
  }

  // #案件受付 に受付完了を返信
  const reply =
    `✅ **案件受付完了！**\n\n` +
    `📋 **${projectName}**\n` +
    `👔 クライアント: ${parsed.clientName}\n` +
    `📝 内容: ${parsed.content}\n` +
    (parsed.budget   ? `💰 予算: ${parsed.budget}\n`  : '') +
    (parsed.deadline ? `📅 期限: ${parsed.deadline}\n` : '') +
    (parsed.notes    ? `📌 備考: ${parsed.notes}\n`    : '') +
    (newChannelName  ? `\n💬 専用チャンネル: #${newChannelName}\n` : '') +
    (staffLine       ? `${staffLine}\n` : '') +
    `🆔 プロジェクトID: \`${projectId}\``;
  sendDiscordMessage(intakeChannelId, reply, token);

  // 新チャンネルに初回ブリーフを投稿
  if (newChannelId) {
    const brief =
      `📋 **プロジェクト開始: ${projectName}**\n\n` +
      `👔 クライアント: ${parsed.clientName}\n` +
      `📝 概要: ${parsed.content}\n` +
      (parsed.budget   ? `💰 予算: ${parsed.budget}\n`  : '') +
      (parsed.deadline ? `📅 期限: ${parsed.deadline}\n` : '') +
      (parsed.notes    ? `📌 備考: ${parsed.notes}\n`    : '') +
      (staffLine       ? `\n${staffLine}\n` : '') +
      `\n進捗・連絡はこのチャンネルで管理します。`;
    sendDiscordMessage(newChannelId, brief, token);
  }

  console.log(`[案件受付] 処理完了: ${projectName}`);
}

// ===================================================
// 🔧 トリガー自己修復
// ===================================================

function checkAndHealTriggers(config) {
  const REQUIRED = [
    {
      name: 'discordAgentTick',
      create: () => ScriptApp.newTrigger('discordAgentTick').timeBased().everyMinutes(1).create()
    },
    {
      name: 'morningBriefing',
      create: () => ScriptApp.newTrigger('morningBriefing').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create()
    },
    {
      name: 'autoPostAffiliateAmazon',
      create: () => ScriptApp.newTrigger('autoPostAffiliateAmazon').timeBased().atHour(12).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create()
    },
    {
      name: 'autoPostAffiliateRakuten',
      create: () => ScriptApp.newTrigger('autoPostAffiliateRakuten').timeBased().atHour(18).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create()
    },
  ];

  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const healed = [];

  REQUIRED.forEach(req => {
    if (!existing.includes(req.name)) {
      try {
        req.create();
        healed.push(req.name);
        console.log(`[HealTrigger] 再登録: ${req.name}`);
      } catch (e) {
        console.error(`[HealTrigger] 再登録失敗: ${req.name} — ${e.message}`);
      }
    }
  });

  if (healed.length === 0) {
    console.log('[HealTrigger] 全トリガー正常');
    return;
  }

  const cfg = config || getKCSSettings();
  let webhooks = {};
  try { webhooks = JSON.parse(cfg.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
  const webhookUrl = webhooks['KCS本部'] || Object.values(webhooks)[0];
  if (webhookUrl) {
    const msg =
      `⚠️ **【トリガー自動復旧】**\n\n` +
      `以下のトリガーが停止していたため、自動で再登録しました：\n` +
      healed.map(n => `・\`${n}\``).join('\n') +
      `\n\n✅ システムは正常稼働中です。`;
    try {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({ content: msg }),
        muteHttpExceptions: true
      });
    } catch (e) {
      console.error('[HealTrigger] Discord通知失敗:', e.message);
    }
  }
}

function setupAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('discordAgentTick').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('morningBriefing').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  ScriptApp.newTrigger('autoPostAffiliateAmazon').timeBased().atHour(12).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  ScriptApp.newTrigger('autoPostAffiliateRakuten').timeBased().atHour(18).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();

  SpreadsheetApp.getUi().alert(
    '✅ 全トリガー 一括セットアップ完了！\n\n' +
    '・discordAgentTick  — 1分ごと（案件受付・Discord監視）\n' +
    '・morningBriefing   — 毎朝 8:00 JST\n' +
    '・Amazon自動投稿    — 毎日 12:00 JST\n' +
    '・楽天自動投稿      — 毎日 18:00 JST\n\n' +
    'PCがオフラインでも全自動で動きます。\n' +
    'トリガーが停止した場合は翌朝8時に自動復旧します。'
  );
}

function manualHealTriggers() {
  const ui = SpreadsheetApp.getUi();
  const before = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  checkAndHealTriggers(null);
  const after = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const healed = after.filter(n => !before.includes(n));

  ui.alert(
    healed.length === 0
      ? '✅ 全トリガー正常稼働中！\n\n復旧の必要はありませんでした。'
      : `⚠️ 以下のトリガーを復旧しました：\n\n` + healed.map(n => `・${n}`).join('\n')
  );
}

// ===================================================
// 🌅 毎朝ブリーフィング
// ===================================================

function morningBriefing() {
  const config = getKCSSettings();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd (E)');
  const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  // トリガー自己修復
  checkAndHealTriggers(config);

  // データ収集
  const affiliate = getAffiliatePosts();
  const draftCount = (affiliate.posts || []).filter(p => p['ステータス'] === '下書き').length;
  const postedToday = (affiliate.posts || []).filter(p => {
    const d = p['投稿日'] || '';
    return d.startsWith(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'));
  }).length;
  const dayCategory = affiliate.dayCategory || getDayCategory();
  const yt = getYouTubeChannelStats();
  const pizza = getSalesSummary();

  // Gemini で「今日やること」を生成
  const briefContext =
    `今日は ${today}。KCS合同会社の朝ブリーフィング用に「今日やること」リストを作ってください。\n` +
    `状況:\n` +
    `- アフィリエイト下書き: ${draftCount}件\n` +
    `- 今日の投稿済み: ${postedToday}件\n` +
    `- 今日のカテゴリ: ${dayCategory}\n` +
    `- Pizzaアプリ在庫: ${pizza.error ? '取得不可' : pizza.inStock + '件'}\n` +
    `- YouTube登録者: ${yt.error ? '取得不可' : yt.subscribers + '人'}\n\n` +
    `優先度の高い順に3〜5個の具体的なアクションを箇条書きにしてください（日本語・簡潔に）。`;

  let todayTasks = '（AI生成スキップ）';
  if (config.GEMINI_API_KEY) {
    const aiReply = cmdAskGemini(briefContext, config, 'KCS本部');
    todayTasks = aiReply.replace(/^🤖\s*/, '');
  }

  // Discord メッセージ作成
  const pizzaLine = pizza.error ? '🍕 Pizza在庫: 取得失敗' : `🍕 Pizza在庫: ${pizza.inStock}件 在庫あり`;
  const ytLine = yt.error ? '▶️ YouTube: 取得失敗' : `▶️ YouTube: 登録者 ${yt.subscribers.toLocaleString()}人 / 再生 ${yt.views.toLocaleString()}回`;

  const discordMsg =
    `🌅 **【朝のブリーフィング】${today}**\n\n` +
    `📊 **現状サマリー**\n${pizzaLine}\n${ytLine}\n` +
    `📝 アフィリエイト下書き: ${draftCount}件\n` +
    `📂 今日のカテゴリ: ${dayCategory}\n\n` +
    `✅ **今日やること**\n${todayTasks}`;

  // Discord Webhook に送信
  let webhooks = {};
  try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
  const webhookUrl = webhooks['KCS本部'] || Object.values(webhooks)[0];
  if (webhookUrl) {
    try {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'POST', contentType: 'application/json',
        payload: JSON.stringify({ content: discordMsg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
    } catch (e) {
      console.error('❌ Discord 送信エラー:', e.message);
    }
  }

  // Obsidian（Google Drive）に保存
  const obsidianContent =
    `---\ndate: ${dateTag}\ntags: [ブリーフィング, 朝会, kcs]\n---\n\n` +
    `# 🌅 朝のブリーフィング ${today}\n\n` +
    `## 現状サマリー\n- ${pizzaLine}\n- ${ytLine}\n` +
    `- アフィリエイト下書き: ${draftCount}件\n- 今日のカテゴリ: ${dayCategory}\n\n` +
    `## 今日やること\n${todayTasks}\n`;
  try {
    saveToObsidian({ title: `朝ブリーフィング_${dateTag}`, content: obsidianContent, subfolder: 'ブリーフィング' });
  } catch (e) {
    console.error('❌ Obsidian 保存エラー:', e.message);
  }

  try {
    SpreadsheetApp.getUi().alert(
      '✅ 朝ブリーフィング 完了！\n\n・Discord に送信しました\n・Obsidian に保存しました\n\n今日やること:\n' + todayTasks.slice(0, 300)
    );
  } catch {}
}

function setupMorningBriefingTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'morningBriefing')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('morningBriefing')
    .timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();

  SpreadsheetApp.getUi().alert(
    '✅ 朝ブリーフィング トリガー登録完了！\n\n毎朝 8:00 JST に自動実行されます。'
  );
}
```

---

## STEP 7 — デプロイ後にやること（GASメニューから）

1. **新バージョンでデプロイ**（デプロイ → デプロイを管理 → 新バージョン）
2. メニュー `🔧 全トリガー 一括セットアップ` を実行
3. 設定シートの `INTAKE_CHANNEL_ID` 欄に `#案件受付` チャンネルのIDを貼り付け

---

## 動作確認

- `#案件受付` に以下を投稿して1分以内に返信が来るか確認：
```
クライアント: テスト株式会社
内容: Webサイトリニューアル
予算: 50万
期限: 8月末
```
- 翌朝8時にDiscordの `KCS本部` にブリーフィングが届くか確認
