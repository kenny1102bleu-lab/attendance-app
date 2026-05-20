# GAS 緊急修正 — KCS本部コマンド & ナレッジ画像検出

## 問題の原因

1. **KCS本部 `!` コマンド**: チャンネルIDが `DISCORD_CHANNELS` JSON に入っているため、ポーリング対象外になっていた
2. **ナレッジ画像検出**: Discord が `content_type` を返さない場合、ファイル名チェックがなく画像を見逃していた

---

## STEP 1 — ナレッジ画像検出の修正

**探す文字列（1229行付近）:**
```javascript
              const hasImage = Array.isArray(msg.attachments) &&
                msg.attachments.some(a => a.content_type && a.content_type.startsWith('image/'));
```

**以下で完全に置き換えてください:**
```javascript
              const hasImage = Array.isArray(msg.attachments) &&
                msg.attachments.some(a =>
                  (a.content_type && a.content_type.startsWith('image/')) ||
                  /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i.test(a.filename || '')
                );
```

---

## STEP 2 — KCS本部 専用ポーリングブロックを追加

**探す文字列（ナレッジチャンネルチェックブロックの直前）:**
```javascript
  // ── ナレッジチャンネル チェック（スクショ→AIブレイン）──
  const knowledgeChannelId = config.KNOWLEDGE_CHANNEL_ID;
```

**その直前に以下をまるごと挿入してください:**
```javascript
  // ── KCS本部チャンネル コマンドポーリング（DISCORD_CHANNELS JSONから取得）──
  const discordChannelsMap = (() => {
    try { return JSON.parse(config.DISCORD_CHANNELS || '{}'); } catch(e) { return {}; }
  })();
  const hqChannelId = discordChannelsMap['KCS本部'];

  if (hqChannelId) {
    const hqKey = `DISCORD_LAST_MSG_HQ_${hqChannelId}`;
    let hqLastId = props.getProperty(hqKey);

    if (!hqLastId) {
      try {
        const initRes = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${hqChannelId}/messages?limit=1`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const latest = JSON.parse(initRes.getContentText());
        if (Array.isArray(latest) && latest.length > 0) {
          props.setProperty(hqKey, latest[0].id);
          console.log('[KCS本部] 初期化完了。次回から監視開始。');
        }
      } catch (e) {
        console.error('[KCS本部] 初期化エラー:', e.message);
      }
    } else {
      try {
        const res = UrlFetchApp.fetch(
          `https://discord.com/api/v10/channels/${hqChannelId}/messages?after=${hqLastId}&limit=5`,
          { headers: { 'Authorization': `Bot ${token}` }, muteHttpExceptions: true }
        );
        const hqMessages = JSON.parse(res.getContentText());
        if (Array.isArray(hqMessages) && hqMessages.length > 0) {
          const hqSorted = hqMessages.sort((a, b) => a.id > b.id ? 1 : -1);
          for (const msg of hqSorted) {
            if (msg.author?.bot) { props.setProperty(hqKey, msg.id); continue; }
            const text = (msg.content || '').trim();

            // セットアップウィザード中は最優先で処理
            const setupState = props.getProperty('SETUP_STATE');
            const setupChannel = props.getProperty('SETUP_CHANNEL_ID');
            if (setupState && setupChannel === hqChannelId) {
              if (text) handleXSetupWizard(text, hqChannelId, msg.id, token);
              props.setProperty(hqKey, msg.id);
              continue;
            }

            // ! コマンド
            if (text && text.startsWith('!')) {
              console.log(`[KCS本部] !コマンド受信: ${text}`);
              const cmdReply = handleBotCommand(text, hqChannelId, token, config);
              if (cmdReply) sendDiscordMessage(hqChannelId, cmdReply, token);
              props.setProperty(hqKey, msg.id);
              continue;
            }

            // 自由文 → Gemini 回答（ナレッジ参照付き）
            if (text) {
              console.log(`[KCS本部] 自由文受信: ${text.slice(0, 30)}`);
              const reply = cmdAskGemini(text, config, 'KCS本部');
              if (reply) sendDiscordMessage(hqChannelId, reply, token);
            }

            props.setProperty(hqKey, msg.id);
          }
        }
      } catch (e) {
        console.error('[KCS本部] チェックエラー:', e.message);
      }
    }
  }

```

---

## 完了後の手順

1. GASを保存・デプロイ（新バージョン）
2. KCS本部で `!ヘルプ` と送信 → コマンド一覧が返ってくるか確認
3. #ナレッジ にスクショを送信 → 「📸 解析中...」が返ってくるか確認

## チェックポイント

- 設定シートに `DISCORD_CHANNELS` の値が `{"KCS本部":"チャンネルID"}` の形式で入っているか確認
- 設定シートに `KNOWLEDGE_CHANNEL_ID` にチャンネルIDが入っているか確認
- BotがKCS本部・#ナレッジ 両方のチャンネルを読める権限があるか確認
