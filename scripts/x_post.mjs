/**
 * KCS X自動投稿スクリプト（GitHub Actions用）
 * agent-twitter-client を使用（X APIクレジット不要・Cookie認証方式）
 *
 * 環境変数:
 *   X_ACCOUNT        : 'sunakun' | 'hal'
 *   TWEET_TEXT       : 投稿するテキスト
 *   -- すなくん用 --
 *   SUNAKUN_X_USERNAME  : Xユーザー名
 *   SUNAKUN_X_PASSWORD  : Xパスワード
 *   -- HAL用 --
 *   HAL_X_USERNAME      : Xユーザー名
 *   HAL_X_PASSWORD      : Xパスワード
 */

import { Scraper } from 'agent-twitter-client';

const account   = process.env.X_ACCOUNT || 'sunakun';
const tweetText = process.env.TWEET_TEXT || '';

if (!tweetText.trim()) {
  console.log('⚠️ 投稿テキストが空です。スキップします。');
  process.exit(0);
}

const isHal = account === 'hal';
const username = isHal ? process.env.HAL_X_USERNAME : process.env.SUNAKUN_X_USERNAME;
const password = isHal ? process.env.HAL_X_PASSWORD : process.env.SUNAKUN_X_PASSWORD;

if (!username || !password) {
  console.error(`❌ ${account.toUpperCase()} のXログイン情報が未設定です。`);
  console.error('GitHub Secrets に以下を設定してください:');
  console.error(isHal ? '  HAL_X_USERNAME / HAL_X_PASSWORD' : '  SUNAKUN_X_USERNAME / SUNAKUN_X_PASSWORD');
  process.exit(1);
}

// 文字数チェック
function countTwitterChars(text) {
  let count = 0;
  for (const char of text) {
    count += char.codePointAt(0) > 127 ? 2 : 1;
  }
  return count;
}

const charCount = countTwitterChars(tweetText);
console.log(`📝 投稿文字数: ${charCount}/280`);
console.log(`🐦 [${account.toUpperCase()}] @${username} でXに投稿します...`);
console.log(`投稿内容:\n${tweetText}\n`);

try {
  const scraper = new Scraper();

  // ログイン
  console.log('🔐 Xにログイン中...');
  await scraper.login(username, password);

  const loggedIn = await scraper.isLoggedIn();
  if (!loggedIn) {
    console.error('❌ Xへのログインに失敗しました。ユーザー名/パスワードを確認してください。');
    process.exit(1);
  }
  console.log('✅ ログイン成功');

  // ツイート投稿
  console.log('📤 投稿中...');
  const result = await scraper.sendTweet(tweetText);

  // レスポンスからツイートIDを抽出
  let tweetId = '';
  try {
    const body = await result.json();
    tweetId = body?.data?.create_tweet?.tweet_results?.result?.rest_id || '';
  } catch (e) {
    // JSONパース失敗時はレスポンスステータスで判定
  }

  if (result.ok || result.status === 200) {
    console.log(`✅ X投稿成功！${tweetId ? ` Tweet ID: ${tweetId}` : ''}`);
    if (tweetId) console.log(`🔗 https://x.com/${username}/status/${tweetId}`);

    // GitHub Actions の出力にセット
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `tweet_id=${tweetId}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `success=true\n`);
    }
  } else {
    console.error(`❌ X投稿失敗 (HTTP ${result.status})`);
    try {
      const errBody = await result.text();
      console.error('レスポンス:', errBody.slice(0, 500));
    } catch (e) {}

    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `success=false\n`);
    }
    process.exit(1);
  }

  // ログアウト
  await scraper.logout();
  console.log('🔓 ログアウト完了');
  process.exit(0);

} catch (err) {
  console.error('❌ エラー:', err.message || err);
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `success=false\n`);
  }
  process.exit(1);
}
