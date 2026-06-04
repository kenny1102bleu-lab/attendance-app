/**
 * KCS X自動投稿スクリプト（GitHub Actions用）
 * agent-twitter-client を使用（X APIクレジット不要）
 *
 * 2つの認証方式に対応:
 * 方式1: OAuth 1.0a キー（loginWithV2）— APIクレジット不要
 * 方式2: ユーザー名+パスワード+メール（login）— フォールバック
 */

import { Scraper } from 'agent-twitter-client';
import fs from 'fs';

const account   = process.env.X_ACCOUNT || 'sunakun';
const tweetText = process.env.TWEET_TEXT || '';

if (!tweetText.trim()) {
  console.log('⚠️ 投稿テキストが空です。スキップします。');
  process.exit(0);
}

const isHal = account === 'hal';

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
console.log(`🐦 [${account.toUpperCase()}] Xに投稿します...`);
console.log(`投稿内容:\n${tweetText}\n`);

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function tryLoginWithKeys(scraper) {
  const appKey = isHal ? process.env.HAL_X_CONSUMER_KEY : process.env.X_CONSUMER_KEY;
  const appSecret = isHal ? process.env.HAL_X_CONSUMER_SECRET : process.env.X_CONSUMER_SECRET;
  const accessToken = isHal ? process.env.HAL_X_ACCESS_TOKEN : process.env.X_ACCESS_TOKEN;
  const accessSecret = isHal ? process.env.HAL_X_ACCESS_SECRET : process.env.X_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) return false;

  console.log('🔑 方式1: OAuth 1.0a キーでログイン...');
  try {
    await scraper.login(
      undefined, undefined, undefined, undefined,
      appKey, appSecret, accessToken, accessSecret
    );
    const ok = await scraper.isLoggedIn();
    console.log(ok ? '✅ OAuth 1.0a ログイン成功' : '❌ OAuth 1.0a ログイン失敗');
    return ok;
  } catch (e) {
    console.error('❌ OAuth 1.0a エラー:', e.message?.slice(0, 200));
    return false;
  }
}

async function tryLoginWithPassword(scraper) {
  const username = isHal ? process.env.HAL_X_USERNAME : process.env.SUNAKUN_X_USERNAME;
  const password = isHal ? process.env.HAL_X_PASSWORD : process.env.SUNAKUN_X_PASSWORD;
  const email = isHal ? process.env.HAL_X_EMAIL : process.env.SUNAKUN_X_EMAIL;

  if (!username || !password) return false;

  console.log('🔑 方式2: ユーザー名+パスワード+メールでログイン...');
  try {
    await scraper.login(username, password, email || undefined);
    const ok = await scraper.isLoggedIn();
    console.log(ok ? '✅ パスワードログイン成功' : '❌ パスワードログイン失敗');
    return ok;
  } catch (e) {
    console.error('❌ パスワードログインエラー:', e.message?.slice(0, 200));
    return false;
  }
}

try {
  const scraper = new Scraper();

  // 方式1: OAuth 1.0a キー
  let loggedIn = await tryLoginWithKeys(scraper);

  // 方式2: ユーザー名+パスワード+メール
  if (!loggedIn) {
    loggedIn = await tryLoginWithPassword(scraper);
  }

  if (!loggedIn) {
    console.error('❌ 全てのログイン方式が失敗しました');
    setOutput('success', 'false');
    process.exit(1);
  }

  // ツイート投稿
  console.log('📤 投稿中...');
  const result = await scraper.sendTweet(tweetText);

  let tweetId = '';
  try {
    const body = await result.json();
    tweetId = body?.data?.create_tweet?.tweet_results?.result?.rest_id || '';
  } catch (e) {}

  if (result.ok || result.status === 200) {
    console.log(`✅ X投稿成功！${tweetId ? ` Tweet ID: ${tweetId}` : ''}`);
    if (tweetId) console.log(`🔗 https://x.com/i/web/status/${tweetId}`);
    setOutput('tweet_id', tweetId);
    setOutput('success', 'true');
  } else {
    console.error(`❌ X投稿失敗 (HTTP ${result.status})`);
    try { console.error('Response:', (await result.text()).slice(0, 500)); } catch (e) {}
    setOutput('success', 'false');
    process.exit(1);
  }

  await scraper.logout().catch(() => {});
  process.exit(0);

} catch (err) {
  console.error('❌ エラー:', err.message || err);
  setOutput('success', 'false');
  process.exit(1);
}
