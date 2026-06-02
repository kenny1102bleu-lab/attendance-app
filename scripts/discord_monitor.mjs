/**
 * Discord Monitor for KCS System
 * GitHub Actions から定期実行 (*/10 * * * *)
 * Discord チャンネルの未読メッセージを取得し GAS Webhook に転送する
 * 
 * Required secrets:
 *   DISCORD_TOKEN      - Discord Bot Token
 *   GAS_WEBHOOK_URL    - GAS Webapp URL
 *   DISCORD_CHANNEL_ID - Monitoring target channel ID
 */

import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// シークレット未設定時はグレースフルに終了
if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID) {
  console.log('[Discord Monitor] DISCORD_TOKEN または DISCORD_CHANNEL_ID が未設定です。スキップします。');
  console.log('設定方法: GitHub > Settings > Secrets and variables > Actions');
  process.exit(0);
}

if (!GAS_WEBHOOK_URL) {
  console.log('[Discord Monitor] GAS_WEBHOOK_URL が未設定です。スキップします。');
  process.exit(0);
}

async function getRecentMessages(channelId, limit = 20) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function sendToGAS(messages) {
  const res = await fetch(GAS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'discord_monitor',
      channelId: DISCORD_CHANNEL_ID,
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        author: m.author?.username,
        timestamp: m.timestamp
      }))
    })
  });
  const text = await res.text();
  console.log('[Discord Monitor] GAS 転送結果:', res.status, text.substring(0, 200));
  return res.ok;
}

try {
  console.log(`[Discord Monitor] チャンネル ${DISCORD_CHANNEL_ID} を監視中...`);
  const messages = await getRecentMessages(DISCORD_CHANNEL_ID);
  console.log(`[Discord Monitor] ${messages.length} 件のメッセージを取得`);
  
  if (messages.length > 0) {
    await sendToGAS(messages);
  } else {
    console.log('[Discord Monitor] 新しいメッセージなし');
  }
  console.log('[Discord Monitor] 完了');
} catch (err) {
  console.error('[Discord Monitor] エラー:', err.message);
  process.exit(1);
}
