/**
 * KCS X自動投稿スクリプト（GitHub Actions用）
 * agent-twitter-client を使用（X APIクレジット不要）
 *
 * 認証方式（優先順）:
 * 方式0: キャッシュ済みセッションCookie（再ログインによるBOT検知/レート制限回避）
 * 方式1: OAuth 1.0a キー（loginWithV2）— APIクレジット不要
 * 方式2: ユーザー名+パスワード+メール（login）— フォールバック
 */

import { Scraper } from 'agent-twitter-client';
import fs from 'fs';
import path from 'path';

const account   = process.env.X_ACCOUNT || 'sunakun';
const tweetText = process.env.TWEET_TEXT || '';

if (!tweetText.trim()) {
  console.log('⚠️ 投稿テキストが空です。スキップします。');
  process.exit(0);
}

const isHal = account === 'hal';

const COOKIE_DIR = '.x-cookies';
const COOKIE_FILE = path.join(COOKIE_DIR, `${account}.json`);

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

function saveCookies(scraper) {
  try {
    fs.mkdirSync(COOKIE_DIR, { recursive: true });
    // tough-cookie の Cookie オブジェクト配列 → 文字列配列で保存
    return scraper.getCookies().then((cookies) => {
      const serialized = cookies.map((c) => c.toString());
      fs.writeFileSync(COOKIE_FILE, JSON.stringify(serialized, null, 2));
      console.log(`💾 セッションCookieを保存しました (${serialized.length}件)`);
    });
  } catch (e) {
    console.warn('⚠️ Cookie保存に失敗:', e.message);
    return Promise.resolve();
  }
}

async function tryLoginWithCookies(scraper) {
  if (!fs.existsSync(COOKIE_FILE)) return false;
  console.log('🔑 方式0: キャッシュ済みセッションCookieでログイン...');
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await scraper.setCookies(cookies);
    const ok = await scraper.isLoggedIn();
    console.log(ok ? '✅ Cookieログイン成功（再ログイン回避）' : '❌ Cookieログイン失敗（期限切れの可能性）');
    return ok;
  } catch (e) {
    console.error('❌ Cookieログインエラー:', e.message?.slice(0, 200));
    return false;
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

  // 方式0: キャッシュ済みCookie（最優先・再ログイン頻度を下げてBOT検知を回避）
  let loggedIn = await tryLoginWithCookies(scraper);
  let usedCache = loggedIn;

  // 方式1: OAuth 1.0a キー
  if (!loggedIn) {
    loggedIn = await tryLoginWithKeys(scraper);
  }

  // 方式2: ユーザー名+パスワード+メール
  if (!loggedIn) {
    loggedIn = await tryLoginWithPassword(scraper);
  }

  if (!loggedIn) {
    console.error('❌ 全てのログイン方式が失敗しました');
    // キャッシュが古くて無効だった場合は削除し、次回は新規ログインから始める
    if (usedCache === false && fs.existsSync(COOKIE_FILE)) {
      try { fs.unlinkSync(COOKIE_FILE); } catch (e) {}
    }
    setOutput('success', 'false');
    process.exit(1);
  }

  // 新規ログイン（Cookie未使用）で成功した場合はCookieを保存して次回以降の再ログインを回避
  if (!usedCache) {
    await saveCookies(scraper);
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
    // 投稿成功時にも最新Cookieを保存しなおす（CSRFトークン等の更新を反映）
    await saveCookies(scraper);
  } else {
    console.error(`❌ X投稿失敗 (HTTP ${result.status})`);
    try { console.error('Response:', (await result.text()).slice(0, 500)); } catch (e) {}
    // 投稿自体が失敗した場合、Cookieが原因の可能性があるため破棄して次回は再ログインさせる
    if (usedCache && fs.existsSync(COOKIE_FILE)) {
      try { fs.unlinkSync(COOKIE_FILE); } catch (e) {}
    }
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
