/**
 * KCS X自動投稿スクリプト（GitHub Actions用）
 * twitter-api-v2 を使用してX（旧Twitter）に投稿する
 *
 * 環境変数:
 *   X_ACCOUNT         : 'sunakun' | 'hal'
 *   TWEET_TEXT        : 投稿するテキスト
 *   -- すなくん用 --
 *   X_CONSUMER_KEY    : Consumer Key
 *   X_CONSUMER_SECRET : Consumer Secret
 *   X_ACCESS_TOKEN    : Access Token
 *   X_ACCESS_SECRET   : Access Token Secret
 *   -- HAL用 --
 *   HAL_X_CONSUMER_KEY / HAL_X_CONSUMER_SECRET / HAL_X_ACCESS_TOKEN / HAL_X_ACCESS_SECRET
 */

import { TwitterApi } from 'twitter-api-v2';

const account   = process.env.X_ACCOUNT || 'sunakun';
const tweetText = process.env.TWEET_TEXT || '';

if (!tweetText.trim()) {
  console.log('⚠️ 投稿テキストが空です。スキップします。');
  process.exit(0);
}

const isHal = account === 'hal';

const keys = {
  appKey:       isHal ? process.env.HAL_X_CONSUMER_KEY    : process.env.X_CONSUMER_KEY,
  appSecret:    isHal ? process.env.HAL_X_CONSUMER_SECRET : process.env.X_CONSUMER_SECRET,
  accessToken:  isHal ? process.env.HAL_X_ACCESS_TOKEN    : process.env.X_ACCESS_TOKEN,
  accessSecret: isHal ? process.env.HAL_X_ACCESS_SECRET   : process.env.X_ACCESS_SECRET,
};

// キーの存在確認
const missingKeys = Object.entries(keys).filter(([, v]) => !v).map(([k]) => k);
if (missingKeys.length > 0) {
  console.error(`❌ 以下のAPIキーがGitHub Secretsに設定されていません: ${missingKeys.join(', ')}`);
  process.exit(1);
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

if (charCount > 280) {
  console.error(`❌ 文字数オーバー: ${charCount}文字`);
  process.exit(1);
}

console.log(`🐦 ${account.toUpperCase()} でXに投稿します...`);
console.log(`投稿内容:\n${tweetText}\n`);

try {
  const client = new TwitterApi(keys);
  const { data } = await client.v2.tweet(tweetText);

  console.log(`✅ X投稿成功！ Tweet ID: ${data.id}`);
  console.log(`🔗 https://x.com/i/web/status/${data.id}`);

  // GitHub Actions の出力に tweet_id をセット
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tweet_id=${data.id}\n`);
  }

  process.exit(0);
} catch (err) {
  console.error('❌ X投稿エラー:');
  console.error(JSON.stringify(err?.data || err?.message || err, null, 2));

  // CredentialsDepleted の場合は特別なメッセージ
  const errStr = JSON.stringify(err?.data || '');
  if (errStr.includes('CredentialsDepleted')) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  X API の月次クレジットが枯渇しています');
    console.error('   翌月初めに自動リセットされます');
    console.error('   または X Developer Basic ($100/月) にアップグレードで解決');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  process.exit(1);
}
