import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

async function run() {
  if (!DISCORD_TOKEN || !GAS_WEBHOOK_URL || !CHANNEL_ID) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=10`, {
      headers: { 'Authorization': `Bot ${DISCORD_TOKEN}` }
    });
    
    if (!res.ok) {
      throw new Error(`Discord API error: ${res.statusText}`);
    }

    const messages = await res.json();
    const newMessages = messages.filter(msg => !msg.author.bot);

    if (newMessages.length > 0) {
      const gasRes = await fetch(GAS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'github-actions',
          channelId: CHANNEL_ID,
          messages: newMessages
        })
      });

      if (!gasRes.ok) {
        throw new Error(`GAS Webhook error: ${gasRes.statusText}`);
      }
      console.log(`Successfully forwarded ${newMessages.length} messages to GAS`);
    } else {
      console.log('No new messages to forward.');
    }
  } catch (err) {
    console.error('Error in discord_monitor:', err);
    process.exit(1);
  }
}

run();
