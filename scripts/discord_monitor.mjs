/**
 * KCS Discord Monitor - GitHub Actions で定期実行 (every 10 minutes)
 * Make.com のDiscordポーリングシナリオを完全代替
 *
 * 機能:
 *   - 複数チャンネル監視（カンマ区切りで複数指定可）
 *   - 直近15分のメッセージのみ処理（重複送信防止）
 *   - 画像添付ファイルも検知してGASに転送
 *   - GAS の handleDiscordMessageFromMake と互換フォーマットで送信
 *
 * 必要なGitHub Secrets:
 *   DISCORD_TOKEN       - Discord Bot Token (Bot xxx...)
 *   GAS_WEBHOOK_URL     - GAS Webapp URL
 *   DISCORD_CHANNEL_IDS - 監視チャンネルID（カンマ区切り複数可）
 *                         例: "1234567890,9876543210"
 */

import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const CHANNEL_IDS = (process.env.DISCORD_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

// シークレット未設定時はグレースフルに終了（ワークフロー失敗を防ぐ）
if (!DISCORD_TOKEN || !DISCORD_TOKEN.startsWith('Bot ') && !DISCORD_TOKEN.match(/^[A-Za-z0-9_.-]{50,}/)) {
  console.log('[Discord Monitor] DISCORD_TOKEN が未設定または無効です。スキップ。');
  console.log('設定: GitHub > attendance-app > Settings > Secrets > DISCORD_TOKEN');
  process.exit(0);
}
if (!CHANNEL_IDS.length) {
  console.log('[Discord Monitor] DISCORD_CHANNEL_IDS が未設定です。スキップ。');
  console.log('設定: GitHub > attendance-app > Settings > Secrets > DISCORD_CHANNEL_IDS');
  process.exit(0);
}
if (!GAS_WEBHOOK_URL) {
  console.log('[Discord Monitor] GAS_WEBHOOK_URL が未設定です。スキップ。');
  process.exit(0);
}

const BOT_TOKEN = DISCORD_TOKEN.startsWith('Bot ') ? DISCORD_TOKEN : `Bot ${DISCORD_TOKEN}`;

// 直近15分以内のメッセージのみ処理
const WINDOW_MS = 15 * 60 * 1000;
const cutoffTime = Date.now() - WINDOW_MS;

async function getMessages(channelId, limit = 50) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers: { Authorization: BOT_TOKEN } }
  );
  if (res.status === 401) throw new Error('DISCORD_TOKEN が無効です（401 Unauthorized）');
  if (res.status === 403) {
    console.log(`[Discord Monitor] チャンネル ${channelId}: アクセス権限なし (403)。スキップ。`);
    return [];
  }
  if (!res.ok) {
    console.warn(`[Discord Monitor] チャンネル ${channelId}: API エラー ${res.status}`);
    return [];
  }
  return res.json();
}

async function sendToGAS(payload) {
  const res = await fetch(GAS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.ok;
}

let totalSent = 0;
let totalSkipped = 0;

for (const channelId of CHANNEL_IDS) {
  try {
    console.log(`[Discord Monitor] チャンネル ${channelId} を監視...`);
    const messages = await getMessages(channelId);

    // 直近15分以内のメッセージのみ絞り込み（ボット自身は除外）
    const recent = messages.filter(m => {
      if (m.author?.bot) return false;
      const msgTime = new Date(m.timestamp).getTime();
      return msgTime >= cutoffTime;
    });

    console.log(`  → ${messages.length} 件取得 / ${recent.length} 件が対象（直近15分）`);

    for (const msg of recent) {
      const hasImage = (msg.attachments || []).some(a =>
        a.content_type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(a.filename || '')
      );
      const attachmentUrls = (msg.attachments || []).map(a => a.url);

      // Make.com 互換フォーマットで GAS に送信
      const payload = {
        action: 'discord_message',
        channelId: channelId,
        text: msg.content || '',
        author: msg.author?.username || '不明',
        author_username: msg.author?.username || '不明',
        messageId: msg.id,
        timestamp: msg.timestamp,
        hasImage: hasImage,
        attachments: attachmentUrls,
        source: 'github_actions'
      };

      const ok = await sendToGAS(payload);
      if (ok) {
        totalSent++;
        console.log(`  ✓ 送信: [${msg.author?.username}] ${(msg.content || '(添付ファイル)').substring(0, 60)}`);
      } else {
        console.warn(`  ✗ 送信失敗: message ${msg.id}`);
      }
    }
  } catch (err) {
    if (err.message.includes('401')) {
      console.error('[Discord Monitor] Bot Token が無効です:', err.message);
      process.exit(1); // 無効なトークンは即停止（無駄なAPI呼び出しを防ぐ）
    }
    console.error(`[Discord Monitor] チャンネル ${channelId} エラー:`, err.message);
  }
}

console.log(`[Discord Monitor] 完了: ${totalSent} 件送信, ${totalSkipped} 件スキップ`);
