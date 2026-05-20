# GAS 指示書 3 — スクショ→AIブレイン（ナレッジベース）

Gemini へ：以下の変更をGAS（GAS_KCS合同会社_Backend.gs）に正確に適用してください。
既存の関数は**絶対に削除しない**でください。コードは一字一句正確にコピーしてください。

---

## STEP 1 — setupKCS: 設定シートの新規インストール用デフォルトに追加

**探す文字列（新規インストール用 defaults 配列の末尾付近）:**
```
      ['INTAKE_CHANNEL_ID', '', '案件受付チャンネルID（#案件受付 の右クリック→チャンネルIDをコピー）'],
    ];
    settingsSheet.getRange(1, 1, defaults.length, 3).setValues(defaults);
```

**`INTAKE_CHANNEL_ID` の行の直後（`];` の前）に以下を追加:**
```javascript
      ['KNOWLEDGE_CHANNEL_ID', '', 'ナレッジチャンネルID（#ナレッジ の右クリック→チャンネルIDをコピー）'],
```

---

## STEP 2 — setupKCS: 既存インストール用マージ配列に追加

**探す文字列（既存インストール用 newRows 配列の末尾付近）:**
```
      ['INTAKE_CHANNEL_ID', '', '案件受付チャンネルID（#案件受付 の右クリック→チャンネルIDをコピー）'],
    ].filter(r => !existingKeys.includes(r[0]));
```

**`INTAKE_CHANNEL_ID` の行の直後に以下を追加:**
```javascript
      ['KNOWLEDGE_CHANNEL_ID', '', 'ナレッジチャンネルID（#ナレッジ の右クリック→チャンネルIDをコピー）'],
```

---

## STEP 3 — setupKCS: ナレッジベースシートを追加

**探す文字列（アフィリエイト管理シートのブロック末尾）:**
```
  SpreadsheetApp.getUi().alert(
    '✅ KCS合同会社 セットアップ完了！\n\n' +
```

**その直前に以下を挿入:**
```javascript
  // ── 10. ナレッジベース ──
  let kbSheet = ss.getSheetByName('ナレッジベース');
  const kbH = ['ID', 'タイトル', '内容', 'タグ', '元画像URL', '保存日時'];
  if (!kbSheet) kbSheet = ss.insertSheet('ナレッジベース');
  kbSheet.getRange(1, 1, 1, kbH.length).setValues([kbH]);
  styleHeader(kbSheet, kbH.length);
  kbSheet.setColumnWidth(2, 200);
  kbSheet.setColumnWidth(3, 400);
  kbSheet.setColumnWidth(5, 300);

```

---

## STEP 4 — discordAgentTick: ナレッジチャンネル polling を追加

**探す文字列（案件受付チェックブロックの末尾）:**
```
  console.log('--- Discord Agent Tick End ---');
}
```

**その直前（`console.log('--- Discord Agent Tick End ---');` の前）に以下を挿入:**
```javascript
  // ── ナレッジチャンネル チェック（スクショ→AIブレイン）──
  const knowledgeChannelId = config.KNOWLEDGE_CHANNEL_ID;
  if (knowledgeChannelId) {
    const knowledgeKey = `DISCORD_LAST_MSG_${knowledgeChannelId}`;
    let knowledgeLastId = props.getProperty(knowledgeKey);

    if (!knowledgeLastId) {
      try {
        const initRes = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${knowledgeChannelId}/messages?limit=1`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const latest = JSON.parse(initRes.getContentText());
        if (Array.isArray(latest) && latest.length > 0) {
          props.setProperty(knowledgeKey, latest[0].id);
          console.log('[ナレッジ] 初期化完了。次回から監視開始。');
        }
      } catch (e) {
        console.error('[ナレッジ] 初期化エラー:', e.message);
      }
    } else {
      try {
        const res = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${knowledgeChannelId}/messages?after=${knowledgeLastId}&limit=5`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const messages = JSON.parse(res.getContentText());
        if (Array.isArray(messages) && messages.length > 0) {
          const sorted = messages.sort((a, b) => a.id > b.id ? 1 : -1);
          for (const msg of sorted) {
            if (!msg.author?.bot) {
              const hasImage = Array.isArray(msg.attachments) &&
                msg.attachments.some(a => a.content_type && a.content_type.startsWith('image/'));
              if (hasImage) {
                console.log('[ナレッジ] 画像メッセージ受信');
                handleKnowledgeImage(msg, knowledgeChannelId, token, config);
              }
            }
            props.setProperty(knowledgeKey, msg.id);
          }
        }
      } catch (e) {
        console.error('[ナレッジ] チェックエラー:', e.message);
      }
    }
  }

```

---

## STEP 5 — cmdAskGemini: ナレッジ検索を注入

**探す文字列（cmdAskGemini 関数の先頭部分）:**
```javascript
function cmdAskGemini(text, config, projectName) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return '⚠️ GEMINI_API_KEY が設定されていません（設定シート）。';

  const projectContext = projectName ? `\n現在のDiscordチャンネル（プロジェクト）: 【${projectName}】\nこのプロジェクトに関連する回答を優先してください。` : '';
  const systemContext = `あなたはKCS合同会社の会社エージェントです。
配送・ドライバー管理、Pizza通知アプリ、KCSダッシュボード、YouTube・X運用を展開する会社をサポートします。
Discordから届いたメッセージに対して、簡潔・実用的に日本語で回答してください。${projectContext}`;
```

**この部分全体を以下で置き換えてください:**
```javascript
function cmdAskGemini(text, config, projectName) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return '⚠️ GEMINI_API_KEY が設定されていません（設定シート）。';

  // ナレッジベースから関連エントリを検索してコンテキストに注入
  const relatedKnowledge = searchKnowledge(text);
  const knowledgeContext = relatedKnowledge.length > 0
    ? '\n\n## 参照可能なナレッジベース（スクリーンショットから蓄積した知識）\n以下の知識を優先的に参照して回答してください：\n' +
      relatedKnowledge.map((k, i) => `### ${i + 1}. ${k.title}\n${k.content}`).join('\n\n')
    : '';

  const projectContext = projectName ? `\n現在のDiscordチャンネル（プロジェクト）: 【${projectName}】\nこのプロジェクトに関連する回答を優先してください。` : '';
  const systemContext = `あなたはKCS合同会社の会社エージェントです。
配送・ドライバー管理、Pizza通知アプリ、KCSダッシュボード、YouTube・X運用を展開する会社をサポートします。
Discordから届いたメッセージに対して、簡潔・実用的に日本語で回答してください。${projectContext}${knowledgeContext}`;
```

---

## STEP 6 — handleBotCommand に `!知識検索` を追加（指示書2で追加した関数）

※指示書2がまだ未適用の場合はスキップ。指示書2適用後に行ってください。

**探す文字列（handleBotCommand 関数内の末尾付近）:**
```javascript
  // 未知のコマンド
  return `❓ 不明なコマンド: \`!${cmd}\`\n\`!ヘルプ\` でコマンド一覧を確認してください。`;
```

**その直前に以下を追加:**
```javascript
  // ナレッジ検索
  const knowledgeMatch = cmd.match(/^(知識|ナレッジ|knowledge)[\s　]?(.+)?/);
  if (knowledgeMatch) {
    const query = knowledgeMatch[2] || text;
    const results = searchKnowledge(query);
    if (results.length === 0) return `📚 「${query}」に関するナレッジは見つかりませんでした。\n#ナレッジ にスクショを送ると蓄積できます。`;
    return '📚 **関連ナレッジ検索結果**\n\n' +
      results.map((k, i) => `**${i + 1}. ${k.title}**\n${k.content.slice(0, 300)}${k.content.length > 300 ? '...' : ''}\n🏷️ ${k.tags}`).join('\n\n');
  }

```

**また、ヘルプテキスト（`!ヘルプ` のreturn）に以下の行を追加:**
```
      '`!知識 [キーワード]` — ナレッジベースを検索',
```

---

## STEP 7 — 末尾に新しい関数を4つ追加

ファイルの**末尾**（最後の行の後）に以下をまるごと追記してください：

```javascript

// ===================================================
// Gemini Vision でスクショを解析
// ===================================================
function analyzeImageWithGemini(imageUrl, apiKey) {
  // Discord CDN から画像をバイナリ取得
  const imageBlob = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true }).getBlob();
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || 'image/png';

  const payload = {
    contents: [{
      parts: [
        {
          inline_data: { mime_type: mimeType, data: base64Image }
        },
        {
          text: `この画像はAI・テクノロジーに関するスクリーンショットです。
内容を以下のJSON形式で抽出してください：
{
  "title": "内容を表す簡潔なタイトル（日本語、40文字以内）",
  "content": "画像の主要な内容・概念・手順・ポイントを詳しく説明（日本語、600文字以内）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
JSONのみ返してください。マークダウンのコードブロックは不要です。`
        }
      ]
    }]
  };

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const data = JSON.parse(res.getContentText());
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini からJSONが取得できませんでした: ' + rawText.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

// ===================================================
// Obsidian（Google Drive）にナレッジを保存
// ===================================================
function saveKnowledgeToObsidian(title, content, tags, imageUrl) {
  try {
    const config = getKCSSettings();
    const folderId = config.OBSIDIAN_FOLDER_ID || '1c1qhkU6D6S27PHUKOv5vgivNXTXVEEPI';
    const date = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const tagStr = Array.isArray(tags) ? tags.map(t => `  - ${t}`).join('\n') : `  - ${tags}`;

    const markdown = `---
date: ${date}
tags:
${tagStr}
source: スクリーンショット
---

# ${title}

${content}

---
元画像: ${imageUrl}
`;

    // Obsidian Vault 内に ナレッジ/AI フォルダを確保
    let targetFolder;
    const parent = DriveApp.getFolderById(folderId);
    const kSubs = parent.getFoldersByName('ナレッジ');
    const kFolder = kSubs.hasNext() ? kSubs.next() : parent.createFolder('ナレッジ');
    const aiSubs = kFolder.getFoldersByName('AI');
    targetFolder = aiSubs.hasNext() ? aiSubs.next() : kFolder.createFolder('AI');

    const safeName = title.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 50);
    const filename = `${date}_${safeName}.md`;
    targetFolder.createFile(filename, markdown, MimeType.PLAIN_TEXT);
    console.log('[saveKnowledgeToObsidian] 保存完了:', filename);
  } catch (e) {
    console.error('[saveKnowledgeToObsidian] エラー:', e.message);
  }
}

// ===================================================
// Discord 画像添付からナレッジを登録
// ===================================================
function handleKnowledgeImage(msg, channelId, token, config) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    sendDiscordMessage(channelId, '⚠️ GEMINI_API_KEY が設定されていません。', token);
    return;
  }

  const attachments = msg.attachments || [];
  const imageAttachment = attachments.find(a => a.content_type && a.content_type.startsWith('image/'));
  if (!imageAttachment) return;

  sendDiscordMessage(channelId, '📸 スクリーンショットを解析中...', token);

  try {
    // Gemini Vision で解析
    const knowledge = analyzeImageWithGemini(imageAttachment.url, apiKey);
    const tagsArr = Array.isArray(knowledge.tags) ? knowledge.tags : [String(knowledge.tags)];
    const tagsStr = tagsArr.join(', ');

    // ナレッジベースシートに保存
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let kbSheet = ss.getSheetByName('ナレッジベース');
    if (!kbSheet) {
      kbSheet = ss.insertSheet('ナレッジベース');
      kbSheet.getRange(1, 1, 1, 6).setValues([['ID', 'タイトル', '内容', 'タグ', '元画像URL', '保存日時']]);
    }
    const id = String(Date.now());
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    kbSheet.appendRow([id, knowledge.title, knowledge.content, tagsStr, imageAttachment.url, now]);

    // Obsidian にも保存
    saveKnowledgeToObsidian(knowledge.title, knowledge.content, tagsArr, imageAttachment.url);

    // Discord 完了通知
    const preview = knowledge.content.slice(0, 200) + (knowledge.content.length > 200 ? '...' : '');
    sendDiscordMessage(
      channelId,
      `✅ **ナレッジ登録完了！**\n\n` +
      `📌 **タイトル:** ${knowledge.title}\n` +
      `🏷️ **タグ:** ${tagsStr}\n\n` +
      `📝 ${preview}\n\n` +
      `_Obsidian（ナレッジ/AI/）にも保存しました_`,
      token
    );

    console.log('[handleKnowledgeImage] 登録完了:', knowledge.title);
  } catch (e) {
    console.error('[handleKnowledgeImage] エラー:', e.message);
    sendDiscordMessage(channelId, `❌ 解析エラー: ${e.message}`, token);
  }
}

// ===================================================
// ナレッジベースをキーワード検索（RAG用）
// ===================================================
function searchKnowledge(query, maxResults) {
  maxResults = maxResults || 3;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ナレッジベース');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const keywords = query.toLowerCase().replace(/[？！。、]/g, ' ').split(/\s+/).filter(k => k.length > 1);
    if (keywords.length === 0) return [];

    const scored = [];
    for (let i = 1; i < data.length; i++) {
      const title   = String(data[i][1] || '').toLowerCase();
      const content = String(data[i][2] || '').toLowerCase();
      const tags    = String(data[i][3] || '').toLowerCase();
      const combined = title + ' ' + content + ' ' + tags;

      let score = 0;
      for (const kw of keywords) {
        if (title.includes(kw))   score += 3; // タイトル一致は高スコア
        if (tags.includes(kw))    score += 2;
        if (content.includes(kw)) score += 1;
      }

      if (score > 0) {
        scored.push({
          score,
          title:   data[i][1],
          content: data[i][2],
          tags:    data[i][3],
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
  } catch (e) {
    console.error('[searchKnowledge] エラー:', e.message);
    return [];
  }
}
```

---

## 完了後の手順

1. GASを保存・デプロイ（新バージョン）
2. スプレッドシートの メニュー → KCS管理 → `setupKCS` を実行（ナレッジベースシートが作成される）
3. Discord で `#ナレッジ` チャンネルを新規作成
4. チャンネルIDをコピーして、設定シートの `KNOWLEDGE_CHANNEL_ID` に貼り付け
5. Botを `#ナレッジ` チャンネルに招待（権限: メッセージを読む・送信）
6. スマホから `#ナレッジ` にスクショを送って動作確認

---

## 動作確認

**スクショ登録:**
```
#ナレッジ にスクショを送信
→ Bot: 「📸 解析中...」
→ Bot: 「✅ ナレッジ登録完了！タイトル: ...」
```

**活用（KCS本部で質問）:**
```
「Claude Projectsってどう使うんだっけ？」
→ Bot がナレッジベースを検索して関連メモを参照しながら回答
```

**!コマンドで手動検索（指示書2適用後）:**
```
!知識 RAG
→ Bot: 「📚 関連ナレッジ検索結果...」
```
