/**
 * KCS X自動投稿スクリプト（GitHub Actions用）
 * OAuth 2.0 Bearer Token 優先、フォールバックで OAuth 1.0a
 *
 * 環境変数:
 *   X_ACCOUNT        : 'sunakun' | 'hal'
 *   TWEET_TEXT       : 投稿するテキスト
 *   X_OAUTH2_TOKEN   : GASから取得したOAuth2アクセストークン（優先）
 *   X_CONSUMER_KEY / X_CONSUMER_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET
 *   HAL_X_CONSUMER_KEY / HAL_X_CONSUMER_SECRET / HAL_X_ACCESS_TOKEN / HAL_X_ACCESS_SECRET
 */

import { TwitterApi } from 'twitter-api-v2';

const account     = process.env.X_ACCOUNT || 'sunakun';
const tweetText   = process.env.TWEET_TEXT || '';
const oauth2Token = process.env.X_OAUTH2_TOKEN || '';

if (!tweetText.trim()) {
  console.log('⚠️ 投稿テキストが空です。スキップします。');
  process.exit(0);
}

// 文字数チェック（280バイト = 日本語140文字相当）
function countTwitterChars(text) {
  let count = 0;
  for (const char of text) {
    count += char.codePointAt(0) > 127 ? 2 : 1;
  }
  return count;
}

const charCount = countTwitterChars(tweetText);
console.log(`📝 投稿文字数: ${charCount}/280`);
console.log(`投稿内容:\n${tweetText}\n`);

if (charCount > 280) {
  console.error(`❌ 文字数オーバー: ${charCount}文字`);
  process.exit(1);
}

async function saveOutput(tweetId) {
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tweet_id=${tweetId}\n`);
  }
}

// ── OAuth 2.0 Bearer Token 優先 ──
if (oauth2Token) {
  console.log(`🔑 [${account.toUpperCase()}] OAuth 2.0 Bearer Token 方式で投稿...`);
  try {
    const client = new TwitterApi(oauth2Token);
    const { data } = await client.v2.tweet(tweetText);
    console.log(`✅ X投稿成功！ Tweet ID: ${data.id}`);
    console.log(`🔗 https://x.com/i/web/status/${data.id}`);
    await saveOutput(data.id);
    process.exit(0);
  } catch (err) {
    const errData = err?.data || err?.message;
    console.error('❌ OAuth2投稿失敗:', JSON.stringify(errData));
    console.log('🔄 OAuth 1.0a フォールバックを試みます...');
  }
}

// ── OAuth 1.0a フォールバック ──
const isHal = account === 'hal';
console.log(`🔑 [${account.toUpperCase()}] OAuth 1.0a 方式で投稿...`);

const keys = {
  appKey:       isHal ? process.env.HAL_X_CONSUMER_KEY    : process.env.X_CONSUMER_KEY,
  appSecret:    isHal ? process.env.HAL_X_CONSUMER_SECRET : process.env.X_CONSUMER_SECRET,
  accessToken:  isHal ? process.env.HAL_X_ACCESS_TOKEN    : process.env.X_ACCESS_TOKEN,
  accessSecret: isHal ? process.env.HAL_X_ACCESS_SECRET   : process.env.X_ACCESS_SECRET,
};

const missingKeys = Object.entries(keys).filter(([, v]) => !v).map(([k]) => k);
if (missingKeys.length > 0) {
  console.error(`❌ APIキー未設定: ${missingKeys.join(', ')}`);
  process.exit(1);
}

try {
  const client = new TwitterApi(keys);
  const { data } = await client.v2.tweet(tweetText);

  console.log(`✅ X投稿成功！ Tweet ID: ${data.id}`);
  console.log(`🔗 https://x.com/i/web/status/${data.id}`);
  await saveOutput(data.id);
  process.exit(0);

} catch (err) {
  console.error('❌ X投稿エラー:');
  console.error(JSON.stringify(err?.data || err?.message || err, null, 2));

  const errStr = JSON.stringify(err?.data || '');
  if (errStr.includes('CredentialsDepleted')) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  X API の月次クレジットが枯渇しています');
    console.error('   翌月初めに自動リセットされます');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  process.exit(1);
}
