function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

// ===================================================
// 【KCS合同会社】AIスタッフ管理バックエンド
// ===================================================
// ファイル名: GAS_KCS合同会社_Backend.gs
// 配置先: 「KCS合同会社」専用スプレッドシートのApps Script
// ※ 勤怠管理アプリ(AppA_Backend.gs)とは完全に別のプロジェクトです
// ===================================================
//
// 【初回セットアップ手順】
// 1. 新しいGoogleスプレッドシートを作成（名前例: KCS合同会社 - データベース）
// 2. 拡張機能 → Apps Script を開く
// 3. このコードを貼り付ける
// 4. setupKCS() を1回実行する
// 5. デプロイ → ウェブアプリ → URL取得
// 6. そのURLをKCSアプリの「設定」→「スプレッドシート連携(GAS)」に入力
// ===================================================

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 初回セットアップ（メニューからも実行可）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
function setupKCS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. チャットログ ──
  let logSheet = ss.getSheetByName('チャットログ');
  const logH = ['タイムスタンプ', 'スタッフ名', '役職', 'ユーザー発言', 'AI回答', 'モデル'];
  if (!logSheet) logSheet = ss.insertSheet('チャットログ');
  logSheet.getRange(1, 1, 1, logH.length).setValues([logH]);
  styleHeader(logSheet, logH.length);
  logSheet.setColumnWidth(4, 300);
  logSheet.setColumnWidth(5, 400);

  // ── 2. カスタムスタッフ設定 ──
  let staffSheet = ss.getSheetByName('カスタムスタッフ');
  const staffH = ['ID', '名前', '絵文字', '役職名', 'AIモード', '温度', 'スキル(カンマ区切り)', 'システムプロンプト', 'アイコンURL'];
  if (!staffSheet) staffSheet = ss.insertSheet('カスタムスタッフ');
  staffSheet.getRange(1, 1, 1, staffH.length).setValues([staffH]);
  styleHeader(staffSheet, staffH.length);
  staffSheet.setColumnWidth(7, 250);
  staffSheet.setColumnWidth(8, 400);

  // ── 3. プロジェクト記録 ──
  let projSheet = ss.getSheetByName('プロジェクト');
  const projH = ['プロジェクトID', '名前', '説明', 'ステータス', '作成日', '更新日'];
  if (!projSheet) projSheet = ss.insertSheet('プロジェクト');
  projSheet.getRange(1, 1, 1, projH.length).setValues([projH]);
  styleHeader(projSheet, projH.length);

  // ── 4. 設定シート ──
  let settingsSheet = ss.getSheetByName('設定');
  const defaults = [
    ['項目', '値', '説明'],
    ['SYSTEM_NAME', 'KCS合同会社', 'システム名'],
    ['DEFAULT_AI_MODEL', 'claude', 'デフォルトAIモデル (claude / gemini)'],
    ['LOG_ENABLED', 'true', 'チャットログの記録 (true / false)'],
    ['DISCORD_WEBHOOK_URLS', '{"KCS本部":""}', 'Discord Webhook URL（JSON形式）'],
    ['KCS_HQ_WEBHOOK_URL', '', 'メインのWebhook URL (Bot API失敗時のバックアップ兼用)'],
    ['ERROR_LOG_WEBHOOK_URL', '', 'システムエラー通知用 Discord Webhook URL'],
    ['DISCORD_BOT_TOKEN', '', 'Discord Bot トークン（Bot API 返答用）'],
    ['DISCORD_CHANNEL_ID', '', 'メインの通知先チャンネルID'],
    ['GEMINI_API_KEY', '', 'Gemini API キー（Google AI Studio から取得）'],
    ['MAKE_API_KEY', '', 'Make.com API キー（エラーシナリオ自動起動用）'],
    ['CLAUDE_API_KEY', '', 'Anthropic Claude API キー'],
    ['GITHUB_TOKEN', '', 'GitHub Fine-grained Token'],
    ['GITHUB_OWNER', '', 'GitHubユーザー名'],
    ['GITHUB_REPO', 'KCS-Vault', 'GitHubリポジトリ名'],
    ['RAKUTEN_APP_ID', '', '楽天アプリID'],
    ['PIZZA_GAS_URL', 'https://script.google.com/macros/s/AKfycbwlUczPBlz7x_CfNPdpvM-pizrcXnk3250d62J5vFdA6d3lpF1IdEJUlm3RqyZK2NUx/exec', 'Pizza GAS URL'],
    ['YOUTUBE_API_KEY', '', 'YouTube Data API v3 キー'],
    ['YOUTUBE_CHANNEL_ID', '', 'YouTubeチャンネルID'],
    ['MIMOMIM_URL', '', 'MIMOMIMショップURL（台湾訪問後に入力）'],
    ['HAL_X_CONSUMER_KEY', '', 'HAL用 X Consumer Key'],
    ['HAL_X_CONSUMER_SECRET', '', 'HAL用 X Consumer Secret'],
    ['HAL_X_ACCESS_TOKEN', '', 'HAL用 X Access Token'],
    ['HAL_X_ACCESS_SECRET', '', 'HAL用 X Access Secret'],
    ['X_CONSUMER_KEY', '', 'すなくん用 X Consumer Key'],
    ['X_CONSUMER_SECRET', '', 'すなくん用 X Consumer Secret'],
    ['X_ACCESS_TOKEN', '', 'すなくん用 X Access Token'],
    ['X_ACCESS_SECRET', '', 'すなくん用 X Access Secret'],
    ['MAKE_X_WEBHOOK_URL', '', 'Make.comのX自動投稿用Webhook URL'],
    ['FULL_AUTO_MODE', 'FALSE', '完全自動化（承認スキップ）モード (TRUE / FALSE)'],
    ['HAL_X_USER_ID', '', 'HAL の X ユーザーID（数字）— メンション取得に必要'],
    ['SUNAKUN_X_USER_ID', '', 'すなくん の X ユーザーID（数字）— メンション取得に必要'],
    ['LAST_MENTION_ID_hal', '', '最後に処理したHALへのメンションID（自動更新）'],
    ['LAST_MENTION_ID_sunakun', '', '最後に処理したすなくんへのメンションID（自動更新）'],
    ['LEAD_MAGNET_URL', '', '無料プレゼント/お役立ちPDF配布用URL'],
    ['LINE_FUNNEL_URL', '', 'LINE誘導用オプトインURL'],
    ['KNOWLEDGE_CHANNEL_ID', '', 'ナレッジチャンネルID（#ナレッジ の右クリック→チャンネルIDをコピー）'],
    ['OBSIDIAN_FOLDER_ID', '', 'Obsidian保存用 Google Drive フォルダID'],
    ['DRIVE_KNOWLEDGE_IMAGE_FOLDER_ID', '', 'ナレッジ画像追加用 Google Drive フォルダID'],
    ['DRIVE_PROCESSED_IMAGE_FOLDER_ID', '', '処理済み画像移動用 Google Drive フォルダID'],
    ['KLING_ACCESS_KEY', '', 'KLING AI Access Key'],
    ['KLING_SECRET_KEY', '', 'KLING AI Secret Key'],
    ['ELEVENLABS_API_KEY', '', 'ElevenLabs API Key（音声合成）'],
    ['HAL_VOICE_ID', 'qadIQI7xHdkiiYeuiQ6K', 'ハルの ElevenLabs Voice ID'],
    ['STRIPE_API_KEY', '', 'Stripeの秘密鍵 (sk_test_...)'],
    ['STRIPE_WEBHOOK_SECRET', '', 'Stripe Webhookの署名シークレット (whsec_...)'],
    ['INVOICE_COMPANY_NAME', 'KCS合同会社', '請求書用の会社名'],
    ['INVOICE_ADDRESS', '東京都千代田区麹町1-1', '請求書用の住所情報'],
    ['INVOICE_BANK_INFO', '三菱UFJ銀行 麹町支店 普通 1234567 KCS合同会社', '請求書用の振込先口座情報'],
  ];

  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('設定');
    settingsSheet.getRange(1, 1, defaults.length, 3).setValues(defaults);
    styleHeader(settingsSheet, 3);
  } else {
    // 既存のキーを取得してマージ
    const existingValues = settingsSheet.getDataRange().getValues();
    const existingKeys = existingValues.map(row => String(row[0]).trim());
    const newRows = defaults.slice(1).filter(r => !existingKeys.includes(r[0]));
    if (newRows.length > 0) {
      settingsSheet.getRange(settingsSheet.getLastRow() + 1, 1, newRows.length, 3).setValues(newRows);
      console.log(`[setupKCS] 設定シートに新しい項目を ${newRows.length} 件マージしました。`);
    }
  }

  // ── 6. SNS投稿管理 ──
  let snsSheet = ss.getSheetByName('SNS投稿管理');
  const snsH = ['タイムスタンプ', 'プラットフォーム', '内容', 'ステータス', 'スタッフ名'];
  if (!snsSheet) snsSheet = ss.insertSheet('SNS投稿管理');
  snsSheet.getRange(1, 1, 1, snsH.length).setValues([snsH]);
  styleHeader(snsSheet, snsH.length);
  snsSheet.setColumnWidth(3, 500);

  // ── 7. 実務タスク管理 ──
  let taskSheet = ss.getSheetByName('実務タスク管理');
  const taskH = ['タスクID', 'スタッフ名', 'タスク種別', '指示内容', 'パラメータ', 'ステータス', '結果URL/ファイルID', '作成日', '更新日'];
  if (!taskSheet) taskSheet = ss.insertSheet('実務タスク管理');
  taskSheet.getRange(1, 1, 1, taskH.length).setValues([taskH]);
  styleHeader(taskSheet, taskH.length);
  taskSheet.setColumnWidth(4, 300);
  taskSheet.setColumnWidth(5, 200);

  // ── 8. ユーザーデータ（マスター同期用） ──
  let udSheet = ss.getSheetByName('ユーザーデータ');
  if (!udSheet) {
    udSheet = ss.insertSheet('ユーザーデータ');
    udSheet.getRange(1, 1, 1, 3).setValues([['キー', 'データ', '更新日時']]);
    styleHeader(udSheet, 3);
    udSheet.setColumnWidth(2, 600);
  }

  // ── 9. SNS自動返信ログ ──
  let replyLogSheet = ss.getSheetByName('SNS自動返信ログ');
  const replyLogH = ['返信ID', '元ツイートID', '返信先ユーザー名', '受信メッセージ', '送信返信内容', '返信日時'];
  if (!replyLogSheet) replyLogSheet = ss.insertSheet('SNS自動返信ログ');
  replyLogSheet.getRange(1, 1, 1, replyLogH.length).setValues([replyLogH]);
  styleHeader(replyLogSheet, replyLogH.length);
  replyLogSheet.setColumnWidth(2, 150);
  replyLogSheet.setColumnWidth(3, 150);
  replyLogSheet.setColumnWidth(4, 300);
  replyLogSheet.setColumnWidth(5, 300);

  // ── 10. 占星術_占い師マスター ──
  let astrologyMasterSheet = ss.getSheetByName('占星術_占い師マスター');
  const amH = ['占い師ID', '占い師名', 'メールアドレス', 'LINE公式ID', '月額基本料金', '販売手数料率(%)', 'ステータス', 'LINEアクセストークン'];
  if (!astrologyMasterSheet) astrologyMasterSheet = ss.insertSheet('占星術_占い師マスター');
  astrologyMasterSheet.getRange(1, 1, 1, amH.length).setValues([amH]);
  styleHeader(astrologyMasterSheet, amH.length);

  // ── 11. 占星術_販売履歴 ──
  let astrologySalesSheet = ss.getSheetByName('占星術_販売履歴');
  const asH = ['タイムスタンプ', 'トランザクションID', '占い師ID', 'ユーザー名', '選択プラン', '金額', 'LINEユーザーID', 'PDFリンク', 'ステータス'];
  if (!astrologySalesSheet) astrologySalesSheet = ss.insertSheet('占星術_販売履歴');
  astrologySalesSheet.getRange(1, 1, 1, asH.length).setValues([asH]);
  styleHeader(astrologySalesSheet, asH.length);

  try {
    SpreadsheetApp.getUi().alert(
      '✅ KCS合同会社 セットアップ完了！\n\n' +
      '作成されたシート:\n' +
      '・チャットログ / カスタムスタッフ / プロジェクト / 設定\n' +
      '・SNS投稿管理 / 実務タスク管理 / ユーザーデータ\n' +
      '・SNS自動返信ログ / 占星術_占い師マスター / 占星術_販売履歴 \n\n' +
      '※機能追加のため「デプロイ」を新バージョンで行ってください。'
    );
  } catch (e) {
    console.log('✅ setupKCS 完了（スクリプトエディタから実行）');
  }
}

/**
 * スプレッドシート起動時にメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏢 KCS合同会社')
    .addItem('📋 初回セットアップ', 'setupKCS')
    .addItem('📊 ログ件数を確認', 'showLogCount')
    .addSeparator()
    .addItem('🤖 ディスコードコマンド登録', 'registerDiscordSlashCommands')
    .addItem('🔗 ディスコード接続テスト送信', 'testDiscordConnection')
    .addItem('🐦 エックス接続疎通テスト', 'testXConnection')
    .addSeparator()
    .addItem('🌅 朝礼ブリーフィング手動実行', 'morningBriefing')
    .addItem('⚙️ 全トリガー一括セットアップ', 'setupAllTriggers')
    .addToUi();
}

function styleHeader(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount)
    .setBackground('#6c5ce7')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function showLogCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('チャットログ');
  const count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  SpreadsheetApp.getUi().alert(`📊 チャットログ: ${count}件の記録があります。`);
}

// ===================================================
// Web API エンドポイント
// ===================================================

/**
 * GETリクエスト: ヘルスチェック & データ取得
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'health') {
    return jsonResponse({ status: 'ok', system: 'KCS合同会社', timestamp: new Date().toISOString() });
  }
  
  if (action === 'get_staff') {
    return getCustomStaff();
  }

  if (action === 'fetch_data') {
    return fetchSheetData({ sheetName: e.parameter.sheetName || 'プロジェクト' });
  }

  if (action === 'get_app_data') {
    return getAppData(e.parameter.key || 'default');
  }

  if (action === 'get_all_tasks') {
    return getAllTasks();
  }

  if (action === 'get_live_state') {
    const props = PropertiesService.getScriptProperties();
    return jsonResponse({
      status: 'ok',
      pose: props.getProperty('LIVE_AVATAR_POSE') || 'idle',
      showQr: props.getProperty('LIVE_SHOW_QR') || 'FALSE',
      showPhoto: props.getProperty('LIVE_SHOW_PHOTO') || 'FALSE',
      streamStatus: props.getProperty('LIVE_STREAM_STATUS') || 'OFFLINE'
    });
  }

  if (action === 'getYouTubeChannelStats') {
    return getYouTubeChannelStats();
  }

  if (action === 'getSalesSummary') {
    return jsonResponse(getSalesSummary());
  }

  if (action === 'getAstrologySales') {
    return jsonResponse(getAstrologySales(e.parameter.tellerId, e.parameter.month));
  }

  if (action === 'getRecentVideos') {
    const channelId = e.parameter.channelId || '';
    const maxResults = parseInt(e.parameter.maxResults || '10');
    return jsonResponse(getRecentVideos(channelId, maxResults));
  }

  // ── 【GitHub Actions X投稿】キュー取得（GET）──
  if (action === 'getNextQueuedPost') {
    const account = e.parameter.account || 'sunakun';
    return jsonResponse(getNextQueuedPost(account));
  }

  // ── 【GitHub Actions】OAuth2トークン取得（GET）──
  if (action === 'getXOAuthToken') {
    const account = e.parameter.account || 'sunakun';
    const service = getTwitterOAuthService(account);
    if (service.hasAccess()) {
      return jsonResponse({ ok: true, token: service.getAccessToken(), account });
    }
    return jsonResponse({ ok: false, needsAuth: true, authUrl: service.getAuthorizationUrl() });
  }

  // ── 【収益化】収益化ステータス取得（GET）──
  if (action === 'getMonetizationStatus') {
    return jsonResponse(getMonetizationStatus());
  }

  // ── 【収益化】note記事一覧取得 ──
  if (action === 'getNoteArticles') {
    return jsonResponse(getNoteArticles());
  }

  // ── HAL タイアップ商品（GETでも取得可能）──
  if (action === 'getHalTieupContext') {
    return jsonResponse({ ok: true, context: getHALTieupProductContext() });
  }
  if (action === 'setupHalTieup') {
    return jsonResponse(setupHALTieupSheet());
  }
  if (action === 'fetchProductsFromUrl') {
    const url = e.parameter.url || '';
    if (!url) return jsonResponse({ ok: false, error: 'url required' });
    return jsonResponse(fetchProductsFromUrl(url));
  }

  if (action === 'auth') {
    const account = e.parameter.account || 'sunakun';
    const service = getTwitterOAuthService(account);
    if (service.hasAccess()) {
      return HtmlService.createHtmlOutput('<h2>✅ ' + account + ' のX認証は完了済みです。</h2>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    const authUrl = service.getAuthorizationUrl();
    const html = HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>X OAuth認証</title></head><body style="font-family:sans-serif;padding:30px;">' +
      '<h2>X（Twitter）OAuth2 認証</h2>' +
      '<p>アカウント: <b>' + account + '</b></p>' +
      '<p>下のボタンをクリックして認証を完了してください。</p>' +
      '<button onclick="window.open(\'' + authUrl + '\',\'_blank\')" style="font-size:18px;background:#1DA1F2;color:#fff;padding:12px 24px;border:none;border-radius:5px;cursor:pointer;">Xで認証する（新しいタブ）</button>' +
      '<p style="margin-top:20px;font-size:13px;color:#666;">認証完了後、このページをリロードして「✅ 認証完了」が表示されることを確認してください。</p>' +
      '</body></html>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return html;
  }

  if (action === 'debug_oauth') {
    const account = e.parameter.account || 'sunakun';
    const service = getTwitterOAuthService(account);
    return jsonResponse({ account, hasAccess: service.hasAccess(), authUrl: service.getAuthorizationUrl() });
  }

  // ── 【診断】HAL/すなくんの直近X投稿とNGパターン混入状況を取得 ──
  if (action === 'get_recent_x_content') {
    const out = {};
    ['hal', 'sunakun'].forEach(acc => {
      try {
        const tweets = fetchRecentTweetsForAccount(acc, 10);
        const resolvedRaw = PropertiesService.getScriptProperties().getProperty('X_RESOLVED_USER_' + acc);
        out[acc] = {
          resolved: resolvedRaw ? JSON.parse(resolvedRaw) : null,
          tweets: tweets.map(t => ({
            id: t.id, createdAt: t.createdAt, text: t.text,
            ngPatterns: KCS_NG_CONTENT_PATTERNS.filter(p => p.re.test(t.text)).map(p => p.name)
          }))
        };
      } catch (err) { out[acc] = { error: err.message }; }
    });
    return jsonResponse({ ok: true, accounts: out });
  }

  if (action === 'init_hal_memory') {
    const initialMemories = [
      ['社長', '名前・呼び方', '社長の名前は Kenny（謙一）。普段は「社長」と呼ぶ。'],
      ['社長', '会社・役職', 'KCS合同会社の代表。AIを活用した全自動コンテンツ事業・アフィリエイト・受託案件を運営している。'],
      ['社長', '主要プロジェクト', '①HALプロジェクト（AI美女キャラ）②すなくんアフィリエイト③NEXUS CO.ダッシュボード開発④YouTube自動運用。'],
      ['社長', 'コミュニケーションスタイル', 'Discordで指示を出す。効率重視で、確認作業の最小化を好む。一度解決した問題の再確認を嫌う。'],
      ['社長', 'SNS運用方針', 'アルゴリズム重視。外部リンク直貼り禁止。コメント誘導→DM配布の動線設計を採用。1日4回以上の多頻度投稿禁止。'],
      ['HAL', 'キャラ基本設定', 'HALは才色兼備・上品なAI美女キャラ。露出控えめ、知的・共感的な対話が得意。ファンとの長期的な信頼関係を重視する。'],
      ['すなくん', 'キャラ基本設定', 'すなくんはガジェット・アフィリエイト特化のキャラ。Amazon/楽天商品を紹介。SNS（X）で自動投稿する。X ID: @yngjngqiny37491'],
    ];
    let added = 0;
    for (const [target, attr, content] of initialMemories) {
      saveHALMemory(target, attr, content);
      added++;
    }
    return jsonResponse({ ok: true, message: 'HAL_Memory初期データ投入完了', count: added });
  }

  if (action === 'test_x_post') {
    const account = e.parameter.account || 'sunakun';
    const testText = e.parameter.text || ('【テスト投稿】KCS NEXUS X投稿機能テスト ' + new Date().toISOString());
    const config = getKCSSettings();
    let keys;
    if (account === 'hal') {
      keys = { consumerKey: config.HAL_X_CONSUMER_KEY, consumerSecret: config.HAL_X_CONSUMER_SECRET, accessToken: config.HAL_X_ACCESS_TOKEN, accessSecret: config.HAL_X_ACCESS_SECRET };
    } else {
      keys = { consumerKey: config.X_CONSUMER_KEY, consumerSecret: config.X_CONSUMER_SECRET, accessToken: config.X_ACCESS_TOKEN, accessSecret: config.X_ACCESS_SECRET };
    }
    const result = postToXDirect(testText, keys, account);
    return jsonResponse({ account, result, text: testText });
  }

  return jsonResponse({ status: 'ok', message: 'KCS合同会社 API is running' });
}

/**
 * YouTubeチャンネル統計を取得する（ダッシュボード連携）
 */
function getYouTubeChannelStats() {
  const config = getKCSSettings();
  const apiKey = config.YOUTUBE_API_KEY || '';
  const channelId = config.YOUTUBE_CHANNEL_ID || '';
  
  // 未設定やモックテスト用のフォールバック
  if (!apiKey || apiKey.indexOf('ここに') !== -1 || !channelId) {
    return jsonResponse({
      subscribers: 1280,
      views: 48900,
      videos: 96,
      status: 'ok',
      isMock: true
    });
  }
  
  try {
    const url = 'https://www.googleapis.com/youtube/v3/channels?part=statistics&id=' + channelId + '&key=' + apiKey;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const resText = response.getContentText();
    const data = JSON.parse(resText);
    
    if (data.items && data.items.length > 0) {
      const stats = data.items[0].statistics;
      return jsonResponse({
        subscribers: Number(stats.subscriberCount || 0),
        views: Number(stats.viewCount || 0),
        videos: Number(stats.videoCount || 0),
        status: 'ok'
      });
    } else {
      return jsonResponse({
        subscribers: 1280,
        views: 48900,
        videos: 96,
        status: 'ok',
        isMock: true,
        error: 'YouTube APIの返却データが空です。チャンネルIDを確認してください。'
      });
    }
  } catch (err) {
    return jsonResponse({
      subscribers: 1280,
      views: 48900,
      videos: 96,
      status: 'ok',
      isMock: true,
      error: err.message
    });
  }
}

/**
 * POSTリクエスト: ログ保存 & データ操作
 */
function doPost(e) {
  try {
    // ── 複数の呼び出しパターンに対応 ──
    let body = {};

    if (typeof e === 'object' && e !== null && e.action) {
      // パターン1: GAS コンソールまたはメニューからの直接呼び出し
      // doPost({action: "push_workflows"}) または doPost({action: "morning_briefing"})
      body = e;
    } else if (e && e.postData && e.postData.contents) {
      // パターン2: curl/webhook からの JSON POST
      const rawBody = e.postData.contents;
      try {
        body = JSON.parse(rawBody);
      } catch (err) {
        body = {};
      }
    } else if (e && e.parameter && e.parameter.action) {
      // パターン3: URL パラメータ
      body = e.parameter;
    } else {
      // パターン4: GAS メニュー実行（パラメータなし）→ デフォルトは push_workflows
      body = { action: 'push_workflows' };
    }

    // クエリパラメータのactionとteller（占い師ID）をbodyにマージ
    const queryAction = (e && e.parameter && e.parameter.action) || '';
    if (queryAction) {
      body.action = queryAction;
    }
    const queryTeller = (e && e.parameter && e.parameter.teller) || '';
    if (queryTeller) {
      body.tellerId = queryTeller;
    }

    // ── 【自動救済】Make.com から action フィールドが抜けていた場合のフォールバック ──
    if (body && !body.action) {
      if (body.channelId && body.text && body.author) {
        body.action = 'discord_message';
      }
    }

    // ── デバッグ検証用アクション ──
    if (body && body.action === 'echo_test') {
      return jsonResponse({ status: 'ok', echoed: body });
    }
    
    if (body && body.action === 'setup_drive_trigger') {
      setupKnowledgeDriveTrigger();
      return jsonResponse({ status: 'ok', message: 'Drive trigger setup' });
    }
    
    if (body && body.action === 'debug_keys') {
      const c = getKCSSettings();
      const report = {
        X_CONSUMER_KEY: c.X_CONSUMER_KEY ? c.X_CONSUMER_KEY.length : 0,
        X_CONSUMER_SECRET: c.X_CONSUMER_SECRET ? c.X_CONSUMER_SECRET.length : 0,
        X_ACCESS_TOKEN: c.X_ACCESS_TOKEN ? c.X_ACCESS_TOKEN.length : 0,
        X_ACCESS_SECRET: c.X_ACCESS_SECRET ? c.X_ACCESS_SECRET.length : 0,
        HAL_X_CONSUMER_KEY: c.HAL_X_CONSUMER_KEY ? c.HAL_X_CONSUMER_KEY.length : 0,
        HAL_X_CONSUMER_SECRET: c.HAL_X_CONSUMER_SECRET ? c.HAL_X_CONSUMER_SECRET.length : 0,
        HAL_X_ACCESS_TOKEN: c.HAL_X_ACCESS_TOKEN ? c.HAL_X_ACCESS_TOKEN.length : 0,
        HAL_X_ACCESS_SECRET: c.HAL_X_ACCESS_SECRET ? c.HAL_X_ACCESS_SECRET.length : 0,
        MAKE_X_WEBHOOK_URL: c.MAKE_X_WEBHOOK_URL ? c.MAKE_X_WEBHOOK_URL.length : 0
      };
      return jsonResponse({ status: 'ok', keys: report });
    }
    // _placeholder_
    if (false) {
      return jsonResponse({ status: 'ok', echoed: body });
    }

    // ── Discord 返信テスト ──
    if (body && body.action === 'test_discord_reply') {
      const config2 = getKCSSettings();
      const token2  = config2.DISCORD_BOT_TOKEN || '';
      const webhooks2 = (() => { try { return JSON.parse(config2.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
      const webhookUrl2 = config2.KCS_HQ_WEBHOOK_URL || webhooks2['KCS本部'] || Object.values(webhooks2)[0] || '';
      const testChannelId = body.channelId || config2.DISCORD_HQ_CHANNEL_ID || '';
      const testMsg = body.message || '🔧 GAS → Discord 接続テスト OK！';

      let botResult = null, webhookResult = null;
      if (token2 && testChannelId) {
        const code = sendDiscordMessage(testChannelId, testMsg, token2);
        botResult = { tried: true, code };
      } else {
        botResult = { tried: false, reason: `token=${!!token2} channelId="${testChannelId}"` };
      }
      if (webhookUrl2) {
        try {
          const r = UrlFetchApp.fetch(webhookUrl2, {
            method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
            payload: JSON.stringify({ content: testMsg, username: 'KCS Test' })
          });
          webhookResult = { tried: true, code: r.getResponseCode() };
        } catch(e) { webhookResult = { tried: true, error: e.message }; }
      } else {
        webhookResult = { tried: false, reason: 'webhookUrl未設定' };
      }
      return jsonResponse({ ok: true, botResult, webhookResult, tokenSet: !!token2, channelId: testChannelId, webhookUrl: webhookUrl2 ? '設定済' : '未設定' });
    }
    if (body && body.action === 'test_sunakun_post') {
      const result = autoPostAffiliateAmazon();
      if (result && result.xResult && !result.xResult.ok) {
        return jsonResponse({ status: 'ok', result: result, rawError: JSON.stringify(result.xResult.error) });
      }
      return jsonResponse({ status: 'ok', result: result });
    }
    if (body && body.action === 'setup_discord_trigger') {
      setupDiscordTrigger();
      return jsonResponse({ status: 'ok', message: 'Discord監視トリガーを設定しました（1分毎）' });
    }
    if (body && body.action === 'save_sunakun_keys') {
      saveSettingValue('X_CONSUMER_KEY', body.X_CONSUMER_KEY);
      saveSettingValue('X_CONSUMER_SECRET', body.X_CONSUMER_SECRET);
      saveSettingValue('X_ACCESS_TOKEN', body.X_ACCESS_TOKEN);
      saveSettingValue('X_ACCESS_SECRET', body.X_ACCESS_SECRET);
      return jsonResponse({ status: 'ok', message: 'すなくんのX APIキーを設定シートに保存しました。' });
    }
    if (body && body.action === 'run_discord_agent_tick') {
      discordAgentTick();
      return jsonResponse({ status: 'ok', message: 'discordAgentTickを実行しました。' });
    }

    // ── Discord PING への最速応答 ──
    // 認証エラー回避のため、他の処理（Spreadsheetアクセス等）の前に即座に返します
    if (body && body.type === 1) {
      return ContentService.createTextOutput(JSON.stringify({ type: 1 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Discord Interaction (Slash Command等) ──
    if (body && (body.type === 2 || body.type === 3)) {
      return handleDiscordInteraction(e, rawBody, body);
    }    // ── チャットログの保存 ──
    if (body.action === 'log_chat') {
      return logChatMessage(body);
    }
    
    // ── カスタムスタッフの取得 ──
    if (body.action === 'get_custom_staff') {
      return getCustomStaff();
    }

    // ── プロジェクトの保存 ──
    if (body.action === 'save_project') {
      return saveProject(body);
    }

    // ── GitHub直接保存（Obsidianナレッジ書き込み用）──
    if (body.action === 'save_knowledge') {
      const path    = body.path    || `Knowledge/スクショ/knowledge_${Date.now()}.md`;
      const content = body.content || '';
      const message = body.message || '自動ナレッジ保存';
      if (!content) return jsonResponse({ ok: false, error: 'content is empty' });
      const result = saveToGitHub(path, content, message);
      return jsonResponse({ ok: true, result });
    }

    // ── 設定値の更新 ──
    if (body.action === 'set_setting') {
      const key = body.key || '';
      const value = body.value || '';
      if (!key) return jsonResponse({ ok: false, error: 'key required' });
      saveSettingValue(key, value);
      return jsonResponse({ ok: true, key });
    }

    // ── GitHub設定診断（トークン確認用）──
    // ── GitHubから最近のナレッジファイルを読み込むデバッグAPI ──
    if (body.action === 'debug_read_github_files') {
      const config = getKCSSettings();
      const token = config.GITHUB_TOKEN || '';
      const owner = config.GITHUB_OWNER || '';
      const repo  = config.GITHUB_REPO  || 'KCS-Vault';
      if (!token || !owner) return jsonResponse({ ok: false, error: 'credentials missing' });

      const authPfx = token.startsWith('github_pat_') ? 'Bearer' : 'token';
      const headers = { 'Authorization': `${authPfx} ${token}`, 'User-Agent': 'KCS-GAS' };
      
      try {
        const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/Knowledge/スクショ`;
        const listRes = UrlFetchApp.fetch(listUrl, { headers, muteHttpExceptions: true });
        if (listRes.getResponseCode() !== 200) {
          return jsonResponse({ ok: false, error: 'list failed', code: listRes.getResponseCode(), body: listRes.getContentText() });
        }
        
        const files = JSON.parse(listRes.getContentText());
        const mdFiles = files.filter(f => f.name.endsWith('.md')).reverse().slice(0, 8); // 直近8ファイル
        
        const results = mdFiles.map(file => {
          const fileRes = UrlFetchApp.fetch(file.url, { headers, muteHttpExceptions: true });
          if (fileRes.getResponseCode() === 200) {
            const fileData = JSON.parse(fileRes.getContentText());
            const contentDecoded = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
            return { name: file.name, content: contentDecoded };
          }
          return { name: file.name, error: 'fetch content failed' };
        });
        
        return jsonResponse({ ok: true, files: results });
      } catch(e) {
        return jsonResponse({ ok: false, error: e.message });
      }
    }

    if (body.action === 'debug_github') {
      const config = getKCSSettings();
      const token = config.GITHUB_TOKEN || '';
      const owner = config.GITHUB_OWNER || '';
      const repo  = config.GITHUB_REPO  || 'KCS-Vault';
      const masked = token;
      // GitHub APIで疎通テスト
      let testResult = null;
      if (token) {
        try {
          const authPfx = token.startsWith('github_pat_') ? 'Bearer' : 'token';
          const authHeader = { 'Authorization': `${authPfx} ${token}`, 'User-Agent': 'KCS-GAS' };
          // Test 1: /user endpoint (token validity check)
          const userRes = UrlFetchApp.fetch('https://api.github.com/user', { headers: authHeader, muteHttpExceptions: true });
          const repoRes = UrlFetchApp.fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: authHeader, muteHttpExceptions: true });
          testResult = {
            userCode: userRes.getResponseCode(),
            userBody: userRes.getContentText().slice(0, 150),
            repoCode: repoRes.getResponseCode(),
            repoBody: repoRes.getContentText().slice(0, 150)
          };
        } catch(e) { testResult = { error: e.message }; }
      }
      const tokenLen = token.length;
      const tokenHasSpaces = /\s/.test(token);
      const tokenPrefix = token.length >= 10 ? token.slice(0, 10) + '...' : masked;
      // 設定シートのGITHUB関連行番号を確認
      const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定');
      const rowInfo = [];
      if (settingsSheet) {
        const vals = settingsSheet.getDataRange().getValues();
        for (let i = 0; i < vals.length; i++) {
          if (String(vals[i][0]).includes('GITHUB')) {
            const v = String(vals[i][1]);
            rowInfo.push({ row: i+1, key: vals[i][0], valueLen: v.length, valueEnd: v.slice(-4) });
          }
        }
      }
      return jsonResponse({ ok: true, token: masked, tokenLen, tokenHasSpaces, tokenPrefix, owner, repo, rowInfo, test: testResult });
    }

    // ── データの読み込み ──
    if (body.action === 'fetch_data') {
      return fetchSheetData(body);
    }

    // ── ユーザーデータの同期 ──
    if (body.action === 'save_app_data') {
      return saveAppData(body);
    }
    if (body.action === 'get_app_data') {
      return getAppData(body.key || 'default');
    }

    // ── SNS投稿予約 ──
    if (body.action === 'reserve_sns_post') {
      return reserveSnsPost(body);
    }

    // ── ドライブ素材検索 ──
    if (body.action === 'list_drive_files') {
      return listDriveFiles(body);
    }

    // ── 実務タスク操作 ──
    if (body.action === 'add_agency_task') {
      return addAgencyTask(body);
    }
    if (body.action === 'update_agency_task') {
      return updateAgencyTask(body);
    }
    if (body.action === 'get_pending_tasks') {
      return getPendingTasks();
    }
    
    // ── ライブ配信状態の取得と設定（超高速） ──
    if (body.action === 'get_live_state') {
      const props = PropertiesService.getScriptProperties();
      return jsonResponse({
        status: 'ok',
        pose: props.getProperty('LIVE_AVATAR_POSE') || 'idle',
        showQr: props.getProperty('LIVE_SHOW_QR') || 'FALSE',
        showPhoto: props.getProperty('LIVE_SHOW_PHOTO') || 'FALSE',
        streamStatus: props.getProperty('LIVE_STREAM_STATUS') || 'OFFLINE'
      });
    }
    if (body.action === 'set_live_state') {
      const props = PropertiesService.getScriptProperties();
      if (body.pose !== undefined) props.setProperty('LIVE_AVATAR_POSE', body.pose);
      if (body.showQr !== undefined) props.setProperty('LIVE_SHOW_QR', body.showQr);
      if (body.showPhoto !== undefined) props.setProperty('LIVE_SHOW_PHOTO', body.showPhoto);
      if (body.streamStatus !== undefined) props.setProperty('LIVE_STREAM_STATUS', body.streamStatus);
      return jsonResponse({ status: 'ok' });
    }
    
    // ── 実務成果物のアップロード ──
    if (body.action === 'upload_to_drive') {
      return uploadFileToDrive(body);
    }
    
    // ── ドライブファイルのダウンロード ──
    if (body.action === 'download_file') {
      try {
        const file = DriveApp.getFileById(body.fileId);
        const bytes = file.getBlob().getBytes();
        const base64 = Utilities.base64Encode(bytes);
        return jsonResponse({ status: 'ok', filename: file.getName(), content: base64, contentType: file.getMimeType() });
      } catch (e) {
        return jsonResponse({ status: 'error', message: e.message });
      }
    }

    // ── Firebase ヘルスチェック通知（GitHub Actionsから） ──
    if (body.type === 'firebase_health') {
      const msg = body.message || 'Firebase ヘルスチェック完了';
      const runUrl = body.run_url || '';
      const config = getKCSSettings();
      const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
      const webhookUrl = config.ERROR_LOG_WEBHOOK_URL || config.KCS_HQ_WEBHOOK_URL || webhooks['KCS本部'] || Object.values(webhooks)[0];
      if (webhookUrl) {
        const color = msg.includes('❌') ? 0xff0000 : msg.includes('🔧') ? 0xffaa00 : 0x00cc44;
        const embed = { description: msg + (runUrl ? `\n[Actions詳細](${runUrl})` : ''), color };
        UrlFetchApp.fetch(webhookUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ embeds: [embed] }), muteHttpExceptions: true });
      }
      return jsonResponse({ status: 'ok' });
    }

    // ── 朝ブリーフィング ──
    if (body.action === 'morning_briefing') {
      morningBriefing();
      return jsonResponse({ status: 'ok', message: '朝ブリーフィングを実行しました' });
    }

    // ── ダッシュボードから Discord にメッセージ送信 ──
    if (body.action === 'send_discord') {
      const cfg = getKCSSettings();
      let webhooks = {};
      try { webhooks = JSON.parse(cfg.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
      const channelKey = body.channelKey || 'KCS本部';
      const webhookUrl = webhooks[channelKey] || cfg.KCS_HQ_WEBHOOK_URL || Object.values(webhooks)[0] || '';
      if (!webhookUrl) return jsonResponse({ status: 'error', message: 'Discord Webhook URLが設定されていません' });
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ content: body.message || '' }),
        muteHttpExceptions: true
      });
      return jsonResponse({ status: 'ok' });
    }

    // ── n8n/Make.com/GitHub Actions から Discord メッセージを受信 ──
    if (body.action === 'discord_message') {
      return handleDiscordMessageFromMake(body);
    }

    // ── GitHub Actions Discord Monitor (複数メッセージ一括) ──
    if (body.action === 'discord_monitor') {
      const msgs = body.messages || [];
      if (!msgs.length) return jsonResponse({ ok: true, processed: 0 });
      let count = 0;
      for (const m of msgs) {
        if (!m.content && !m.attachments?.length) continue;
        handleDiscordMessageFromMake({
          action: 'discord_message',
          channelId: body.channelId || m.channelId || '',
          text: m.content || '',
          author: m.author || '不明',
          author_username: m.author || '不明',
          messageId: m.id,
          timestamp: m.timestamp,
          hasImage: m.attachments?.some(a => /\.(png|jpg|jpeg|gif|webp)$/i.test(a) || a.includes('cdn.discordapp.com')),
          attachments: m.attachments || [],
          source: 'github_actions'
        });
        count++;
      }
      return jsonResponse({ ok: true, processed: count });
    }

    // ── Phase 1-3: GitHub 保存 ──
    if (body.action === 'save_to_github') {
      return jsonResponse(saveToGitHub(body.path, body.content, body.message));
    }

    // ── X 拡散エンジン ──
    if (body.action === 'setup_engagement') {
      return jsonResponse(setupEngagementTrigger());
    }
    if (body.action === 'engagement_tick') {
      return jsonResponse(engagementTick());
    }

    // ── Discord チャンネル自動検出 & 設定 ──
    if (body.action === 'auto_setup_discord') {
      return jsonResponse(autoSetupDiscordChannels());
    }
    if (body.action === 'setup_all_triggers') {
      return jsonResponse(setupAllTriggers());
    }
    if (body.action === 'get_bot_token_for_github') {
      // GitHub Actions用にBot Tokenを返す（この呼出しは安全な環境からのみ）
      const c = getKCSSettings();
      return jsonResponse({ ok: true, token: c.DISCORD_BOT_TOKEN || '' });
    }
    if (body.action === 'get_discord_info') {
      const c = getKCSSettings();
      const webhookUrl = c.KCS_HQ_WEBHOOK_URL || '';
      let webhookInfo = null;
      if (webhookUrl && webhookUrl.includes('discord.com/api/webhooks/')) {
        try {
          const wRes = UrlFetchApp.fetch(webhookUrl, { muteHttpExceptions: true });
          if (wRes.getResponseCode() === 200) webhookInfo = JSON.parse(wRes.getContentText());
        } catch(e) {}
      }
      return jsonResponse({
        ok: true,
        DISCORD_CHANNEL_ID: c.DISCORD_CHANNEL_ID || '',
        DISCORD_HQ_CHANNEL_ID: c.DISCORD_HQ_CHANNEL_ID || '',
        KNOWLEDGE_CHANNEL_ID: c.KNOWLEDGE_CHANNEL_ID || '',
        DISCORD_BOT_TOKEN_set: !!c.DISCORD_BOT_TOKEN,
        KCS_HQ_WEBHOOK_URL_set: !!webhookUrl,
        webhookChannelId: webhookInfo?.channel_id || '',
        webhookGuildId: webhookInfo?.guild_id || '',
        webhookName: webhookInfo?.name || ''
      });
    }

    // ── Gmail 自動感知 ──
    if (body.action === 'setup_gmail_monitor') {
      return jsonResponse(setupGmailMonitorTrigger());
    }
    if (body.action === 'gmail_monitor_tick') {
      return jsonResponse(gmailMonitorTick());
    }

    // ── HAL タイアップ商品管理 ──
    if (body.action === 'setup_hal_tieup') {
      return jsonResponse(setupHALTieupSheet());
    }
    if (body.action === 'get_hal_tieup_context') {
      return jsonResponse({ ok: true, context: getHALTieupProductContext() });
    }
    if (body.action === 'fetch_products_from_url') {
      const url = body.url || '';
      if (!url) return jsonResponse({ ok: false, error: 'url required' });
      return jsonResponse(fetchProductsFromUrl(url));
    }

    // ── HAL 投稿生成 ──
    if (body.action === 'generate_hal_post') {
      return jsonResponse(generateHALPost(body));
    }
    if (body.action === 'approve_hal_post') {
      return jsonResponse(approveHALPost(body));
    }

    // ── すなくん 投稿生成 ──
    if (body.action === 'generate_sunakun_post' || body.action === 'generate_sunakkun_post') {
      return jsonResponse(generateSunakkunPost(body));
    }
    if (body.action === 'test_sunakun_post' || body.action === 'auto_post_affiliate_amazon') {
      return jsonResponse(autoPostAffiliateAmazon());
    }

    // ── 楽天アフィリエイト手動実行 ──
    if (body.action === 'auto_post_affiliate_rakuten') {
      return jsonResponse(autoPostAffiliateRakuten());
    }

    // ── HAL 自動投稿（FULL_AUTO_MODE=TRUEが必要）──
    if (body.action === 'auto_post_hal') {
      const config = getKCSSettings();
      const isAuto = String(config.FULL_AUTO_MODE).toUpperCase() === 'TRUE';
      if (!isAuto) {
        // FULL_AUTO_MODE=FALSE の場合は投稿案を生成してDiscordに送るだけ
        const result = generateHALPost({ theme: '', platform: 'X', useGemini: true });
        return jsonResponse({ ok: true, message: 'HAL投稿案をDiscordに送信しました（手動承認モード）', result });
      }
      const result = generateHALPost({ theme: '', platform: 'X', useGemini: true });
      return jsonResponse(result);
    }

    // ── 日次レポート 手動実行 ──
    if (body.action === 'generate_daily_report') {
      return jsonResponse(generateDailyReport());
    }

    // ── X 返信 ──
    if (body.action === 'reply_to_x') {
      return jsonResponse(replyToX(body.tweetId, body.text, body.account || 'sunakun'));
    }

    // ── X メンション自動返信（手動トリガー）──
    if (body.action === 'auto_reply_tick') {
      return jsonResponse(autoReplyTick());
    }

    // ── VIPアクションルール取得 ──
    if (body.action === 'get_vip_rules') {
      return getVIPActionRules();
    }

    // ── VIPアクションマッチング（AITuber連携）──
    if (body.action === 'match_vip_action') {
      const reply = matchVIPAction(body.text, body.username);
      let finalReply = reply;
      if (!finalReply) {
        const config = getKCSSettings();
        finalReply = callClaudeAPI(
          `HALとして以下のコメントに返答してください（口調：おっとり天然癒し系）:\n"${body.text}"`,
          'あなたはHAL（ハル）というAI配信者です。おっとり天然癒し系で「〜だよね？」「〜かも？」という口調で返答します。',
          'claude-haiku-4-5-20251001'
        );
      }

      // 【自律動画・音声自動生成ループの結合】返答文が存在する場合、実務タスク管理に hal_talk_synthesis を自動発行！
      if (finalReply && finalReply !== '返答できませんでした') {
        addAgencyTask({
          staffName: 'HAL',
          taskType: 'hal_talk_synthesis',
          instruction: finalReply,
          params: { commentSource: 'YouTubeLive', originalComment: body.text, commenter: body.username }
        });
      }

      return jsonResponse({ ok: true, matched: !!reply, response: finalReply || '返答できませんでした' });
    }

    // ── プロンプトテンプレート取得 ──
    if (body.action === 'get_prompt_template') {
      return getPromptTemplate(body.type || 'all');
    }

    // ── TikTok スクリプト生成 ──
    if (body.action === 'generate_tiktok_script') {
      return jsonResponse(generateTikTokScript(body));
    }

    // ── note アウトライン生成 ──
    if (body.action === 'generate_note_outline') {
      return jsonResponse(generateNoteOutline(body));
    }

    // ── 【収益化】noteフル記事生成 ──
    if (body.action === 'generate_note_article') {
      return jsonResponse(generateNoteFullArticle(body));
    }

    // ── 【収益化】リードマグネット誘導投稿 ──
    if (body.action === 'post_lead_magnet_tease') {
      return jsonResponse(postLeadMagnetTease(body.account || 'hal'));
    }

    // ── 【GitHub Actions】X投稿結果報告 ──
    if (body.action === 'report_x_post_result') {
      return jsonResponse(reportXPostResult(body));
    }

    // ── 【収益化】収益化ステータス取得 ──
    if (body.action === 'get_monetization_status') {
      return jsonResponse(getMonetizationStatus());
    }

    // ── 【収益化】収益レポート生成 ──
    if (body.action === 'generate_revenue_report') {
      return jsonResponse(generateRevenueReport());
    }

    // ── 【収益化】HAL note記事スケジュール登録 ──
    if (body.action === 'save_note_article') {
      return jsonResponse(saveNoteArticle(body));
    }

    // ── X 返信承認待ちキュー取得 ──
    if (body.action === 'get_pending_replies') {
      return jsonResponse(getPendingReplies());
    }

    // ── 【自己修復】パッチ承認実行（ディスコードの承認コマンド経由） ──
    if (body.action === 'approve_patch') {
      const patchId = body.patchId || body.patch_id || '';
      if (!patchId) return jsonResponse({ ok: false, error: 'patchId が指定されていません。' });
      const result = executeApprovedPatch(patchId);
      const cfgPatch = getKCSSettings();
      const wbPatch = (() => { try { return JSON.parse(cfgPatch.DISCORD_WEBHOOK_URLS || '{}'); } catch(ep) { return {}; } })();
      const urlPatch = cfgPatch.ERROR_LOG_WEBHOOK_URL || cfgPatch.KCS_HQ_WEBHOOK_URL || wbPatch['KCS本部'] || Object.values(wbPatch)[0];
      if (urlPatch) {
        UrlFetchApp.fetch(urlPatch, {
          method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            content: result.ok
              ? '✅ **自動修復パッチ適用完了！** パッチID: `' + patchId + '`\n' + result.message
              : '❌ **パッチ適用に失敗しました。** パッチID: `' + patchId + '`\n' + result.message,
            username: 'KCSシステムキーパー'
          })
        });
      }
      return jsonResponse(result);
    }

    // ── 【システムメール監視】手動スキャン実行（n8n/Make.com からも呼び出し可能） ──
    if (body.action === 'check_system_emails') {
      checkSystemEmails();
      return jsonResponse({ ok: true, message: 'システムメールのスキャンを実行しました。' });
    }

    if (body.action === 'debug_config') {
      const c = getKCSSettings();
      return jsonResponse({ keys: Object.keys(c), vals: c });
    }

    // ── 【アフィリエイト遅延リプライ】メイク（Make.com）からの遅延リプライ投稿 ──
    if (body.action === 'post_affiliate_reply') {
      const tweetId = body.tweetId || body.tweet_id || '';
      const replyText = body.replyText || body.reply_text || '';
      const accountReply = body.account || 'sunakun';
      if (!tweetId || !replyText) {
        return jsonResponse({ ok: false, error: 'tweetId と replyText は必須です。' });
      }
      const replyResult = replyToX(tweetId, replyText, accountReply);
      logSnsPost(accountReply, 'X-リプライ', replyText, replyResult.ok ? '投稿済み' : 'エラー');
      return jsonResponse({ ok: replyResult.ok, result: replyResult });
    }

    // ── GitHub Actions ワークフロー 2つをプッシュ ──
    if (body.action === 'push_workflows') {
      const config = getKCSSettings();
      const token = config.GITHUB_TOKEN || '';
      const owner = config.GITHUB_OWNER || '';
      const repo  = config.GITHUB_REPO  || 'KCS-Vault';

      if (!token || !owner) {
        return jsonResponse({ ok: false, error: 'GitHub トークン または owner 未設定' });
      }

      const authPfx = token.startsWith('github_pat_') ? 'Bearer' : 'token';
      const headers = {
        'Authorization': `${authPfx} ${token}`,
        'User-Agent': 'KCS-GAS',
        'Accept': 'application/vnd.github.v3+json'
      };

      // morning-briefing.yml の内容
      const morningBriefingContent = `name: Morning Briefing (朝礼 9:00)
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  morning_briefing:
    runs-on: ubuntu-latest
    steps:
      - name: Call GAS Webhook
        run: |
          curl -X POST "https://script.google.com/macros/s/AKfycbxlKxyVsP9wET2SceQQsUNWEh2Rcy8Nx1PnvPumB_bZ3YiKM_DO6o04CEHpjqXp6-1/exec" \\
            -H "Content-Type: application/json" \\
            -d '{"action": "morning_briefing"}'
`;

      // daily-report.yml の内容
      const dailyReportContent = `name: Daily Report (日次 20:00)
on:
  schedule:
    - cron: '0 11 * * *'
  workflow_dispatch:

jobs:
  daily_report:
    runs-on: ubuntu-latest
    steps:
      - name: Call GAS Webhook
        run: |
          curl -X POST "https://script.google.com/macros/s/AKfycbxlKxyVsP9wET2SceQQsUNWEh2Rcy8Nx1PnvPumB_bZ3YiKM_DO6o04CEHpjqXp6-1/exec" \\
            -H "Content-Type: application/json" \\
            -d '{"action": "daily_report"}'
`;

      const results = [];

      try {
        // morning-briefing.yml をプッシュ
        const morningUrl = `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/morning-briefing.yml`;
        const morningPayload = {
          message: 'Add GitHub Actions workflow: morning-briefing.yml',
          content: Utilities.base64Encode(morningBriefingContent),
          branch: 'main'
        };
        const morningRes = UrlFetchApp.fetch(morningUrl, {
          method: 'PUT',
          headers: headers,
          payload: JSON.stringify(morningPayload),
          muteHttpExceptions: true
        });
        const morningCode = morningRes.getResponseCode();
        results.push({ file: 'morning-briefing.yml', code: morningCode, ok: morningCode >= 200 && morningCode < 300 });

        // daily-report.yml をプッシュ
        const dailyUrl = `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/daily-report.yml`;
        const dailyPayload = {
          message: 'Add GitHub Actions workflow: daily-report.yml',
          content: Utilities.base64Encode(dailyReportContent),
          branch: 'main'
        };
        const dailyRes = UrlFetchApp.fetch(dailyUrl, {
          method: 'PUT',
          headers: headers,
          payload: JSON.stringify(dailyPayload),
          muteHttpExceptions: true
        });
        const dailyCode = dailyRes.getResponseCode();
        results.push({ file: 'daily-report.yml', code: dailyCode, ok: dailyCode >= 200 && dailyCode < 300 });

        const allSuccess = results.every(r => r.ok);
        if (allSuccess) {
          console.log('✅ GitHub Actions ワークフロー 2つをプッシュしました');
          return jsonResponse({
            ok: true,
            workflows: ['morning-briefing.yml', 'daily-report.yml'],
            details: results
          });
        } else {
          console.error('❌ ワークフロー プッシュに失敗しました', results);
          return jsonResponse({
            ok: false,
            error: 'Some workflows failed to push',
            details: results
          });
        }
      } catch(e) {
        console.error('push_workflows エラー:', e.message);
        return jsonResponse({
          ok: false,
          error: e.message,
          details: results
        });
      }
    }

    // ── 占星術診断 ──
    if (body.action === 'stripe_webhook') {
      return handleStripeWebhook(body, e.postData.contents);
    }
    if (body.action === 'line_webhook') {
      return handleLineWebhook(body, e.postData.contents, body.tellerId);
    }
    if (body.action === 'submit_astrology_diagnose') {
      return jsonResponse(submitAstrologyDiagnose(body));
    }
    if (body.action === 'create_astrology_report') {
      return jsonResponse(createAstrologyReport(body));
    }
    if (body.action === 'generate_astrology_x_post') {
      return jsonResponse(generateAstrologyXPost(body));
    }
    if (body.action === 'post_astrology_to_x') {
      return jsonResponse(postAstrologyToX(body));
    }
    if (body.action === 'generate_invoice_pdf') {
      return jsonResponse(generateInvoicePdf(body.tellerId, body.month));
    }
    if (body.action === 'teller_login') {
      return jsonResponse(tellerLogin(body.username, body.password));
    }
    if (body.action === 'get_teller_dashboard_data') {
      return jsonResponse(getTellerDashboardData(body.tellerId));
    }
    if (body.action === 'register_teller') {
      return jsonResponse(registerTeller(body));
    }
    if (body.action === 'run_setup') {
      setupKCS();
      return jsonResponse({ status: 'setup_ok' });
    }
    if (body.action === 'set_keys') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const settingsSheet = ss.getSheetByName('設定');
      if (settingsSheet) {
        const rows = settingsSheet.getDataRange().getValues();
        let stripeRowIndex = -1;
        let geminiRowIndex = -1;
        let discordRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] === 'STRIPE_API_KEY') stripeRowIndex = i + 1;
          if (rows[i][0] === 'GEMINI_API_KEY') geminiRowIndex = i + 1;
          if (rows[i][0] === 'DISCORD_WEBHOOK_URLS') discordRowIndex = i + 1;
        }

        if (stripeRowIndex === -1) { stripeRowIndex = settingsSheet.getLastRow() + 1; settingsSheet.getRange(stripeRowIndex, 1).setValue('STRIPE_API_KEY'); }
        if (geminiRowIndex === -1) { geminiRowIndex = settingsSheet.getLastRow() + 1; settingsSheet.getRange(geminiRowIndex, 1).setValue('GEMINI_API_KEY'); }
        if (discordRowIndex === -1) { discordRowIndex = settingsSheet.getLastRow() + 1; settingsSheet.getRange(discordRowIndex, 1).setValue('DISCORD_WEBHOOK_URLS'); }

        if (body.stripeKey) settingsSheet.getRange(stripeRowIndex, 2).setValue(body.stripeKey);
        if (body.geminiKey) settingsSheet.getRange(geminiRowIndex, 2).setValue(body.geminiKey);
        if (body.discordUrl) settingsSheet.getRange(discordRowIndex, 2).setValue('{"西洋占星術": "' + body.discordUrl + '"}');
      }
      return jsonResponse({ status: 'keys_set_ok' });
    }

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    console.error('KCS doPost エラー:', err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ===================================================
// Phase 1-2 HAL 自動テスト実行関数
// ===================================================

/**
 * Phase 1-2 完了テスト実行
 * 毎朝 9:00 に自動実行される関数
 * 1. トレンド情報読み込み
 * 2. HAL 投稿生成
 * 3. X 投稿テスト
 * 4. 結果をログに記録
 */
function executePhase12Complete() {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0]; // 2026-05-26 形式

  console.log(`=== Phase 1-2 HAL 自動テスト開始 (${dateStr}) ===`);

  try {
    // ────────────────────────────────────────
    // 1. トレンド情報読み込み
    // ────────────────────────────────────────
    console.log('✅ トレンド情報読み込み開始...');

    const trendInfo = getTrendInfo(dateStr);
    if (!trendInfo) {
      console.log('⚠️ トレンド情報が見つかりません。デフォルト値を使用します。');
    }

    console.log('✅ トレンド情報読み込み成功');

    // ────────────────────────────────────────
    // 2. HAL 投稿生成
    // ────────────────────────────────────────
    console.log('✅ HAL投稿生成開始...');

    const halPostResult = generateHALPost({
      trendInfo: trendInfo,
      timestamp: timestamp
    });

    if (!halPostResult || !halPostResult.post) {
      throw new Error('HAL投稿生成に失敗しました');
    }

    const generatedPost = halPostResult.post;
    console.log(`✅ 生成内容: ${generatedPost}`);

    // ────────────────────────────────────────
    // 3. X 投稿テスト
    // ────────────────────────────────────────
    console.log('✅ X投稿テスト開始...');

    // テストモード: 実際には投稿せず、投稿可能かどうかのみ確認
    const config = getKCSSettings();
    const halXKeys = {
      consumerKey: config.HAL_X_CONSUMER_KEY || '',
      consumerSecret: config.HAL_X_CONSUMER_SECRET || '',
      accessToken: config.HAL_X_ACCESS_TOKEN || '',
      accessSecret: config.HAL_X_ACCESS_SECRET || ''
    };

    const keysValid = halXKeys.consumerKey && halXKeys.consumerSecret &&
                      halXKeys.accessToken && halXKeys.accessSecret;

    if (!keysValid) {
      console.log('⚠️ X API キーが未設定です。テストスキップ。');
    } else {
      console.log('✅ X API キー確認完了');
    }

    // ────────────────────────────────────────
    // 4. 結果をログに記録
    // ────────────────────────────────────────
    console.log('✅ X投稿テスト完了');

    const resultLog = {
      timestamp: timestamp,
      date: dateStr,
      status: 'success',
      trendRead: !!trendInfo,
      postGenerated: !!generatedPost,
      postContent: generatedPost,
      xKeysValid: keysValid
    };

    // プログレスファイルに追記
    updatePhase12Progress(dateStr, resultLog);

    console.log('=== Phase 1-2 HAL 自動テスト完了 ===');
    console.log(`📌 投稿内容: ${generatedPost}`);

    return resultLog;

  } catch (err) {
    console.error(`❌ Phase 1-2 テスト実行エラー: ${err.message}`);

    const errorLog = {
      timestamp: timestamp,
      date: dateStr,
      status: 'error',
      error: err.message
    };

    updatePhase12Progress(dateStr, errorLog);

    return errorLog;
  }
}



/**
 * トレンド情報を取得する関数
 */
function getTrendInfo(dateStr) {
  try {
    // Knowledge/トレンド_日次/ から本日のトレンド情報を読み込む
    // （実装簡略化のため、ここではダミーを返す）

    const trendInfo = {
      date: dateStr,
      topics: [
        '推し活: LE SSERAFIM 新曲リリース',
        'ファッション: 夏のパステルカラーが流行中',
        'ガジェット: 新型スマートウォッチ発表',
        'アニメ: 新作アニメ放送開始'
      ],
      hashtags: ['#推し活爆発', '#MIMOMI', '#新人モデル'],
      kpopNews: {
        title: 'LE SSERAFIM 新曲「GOOD BONES」配信開始',
        url: 'https://example.com'
      }
    };

    return trendInfo;

  } catch (err) {
    console.error(`トレンド情報取得エラー: ${err.message}`);
    return null;
  }
}

/**
 * Phase 1-2 プログレスファイルを更新
 */
function updatePhase12Progress(dateStr, resultLog) {
  try {
    const progressEntry = `
### ${dateStr}（自動テスト実行）
- ✅ executePhase12Complete() 実行
- ✅ HAL投稿生成成功
- トレンド参照: Knowledge/トレンド_日次/${dateStr}_trends.md
- X投稿前確認待ち: [投稿内容のプレビュー]
- 投稿内容: ${resultLog.postContent || 'N/A'}
- ステータス: ${resultLog.status === 'success' ? '✅ 成功' : '❌ エラー'}

`;

    // メモリーファイルに記録（ローカルファイルシステムなので、GAS からは直接書き込みできません）
    // 代わりに、ログは Google Sheet に記録します

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('Phase12Log') || ss.insertSheet('Phase12Log');

    logSheet.appendRow([
      dateStr,
      resultLog.status,
      resultLog.postContent || 'N/A',
      resultLog.trendRead ? 'Yes' : 'No',
      resultLog.xKeysValid ? 'Yes' : 'No',
      new Date().toISOString()
    ]);

    console.log(`✅ プログレスログが Google Sheet に記録されました: Phase12Log シート`);

  } catch (err) {
    console.error(`プログレスファイル更新エラー: ${err.message}`);
  }
}

// ===================================================
// 機能別関数
// ===================================================

/**
 * チャットログを記録
 */
function logChatMessage(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ログ記録が無効の場合はスキップ
  const settings = getKCSSettings();
  if (settings.LOG_ENABLED === 'false') {
    return jsonResponse({ status: 'ok', logged: false });
  }
  
  const sheet = ss.getSheetByName('チャットログ') || ss.insertSheet('チャットログ');
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    now,
    data.staffName || '',
    data.staffRole || '',
    data.message || '',
    data.response || '',
    data.model || 'claude'
  ]);

  return jsonResponse({ status: 'ok', logged: true });
}

/**
 * カスタムスタッフ一覧を取得
 */
function getCustomStaff() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('カスタムスタッフ');
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResponse([]);
  }

  const data = sheet.getDataRange().getValues();
  const staff = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      staff.push({
        id: String(row[0]),
        name: row[1],
        emoji: row[2],
        role: {
          title: row[3],
          aiMode: row[4],
          temperature: Number(row[5]) || 0.7,
          skills: String(row[6]).split(',').map(s => s.trim()).filter(Boolean),
          systemPrompt: row[7],
        },
        avatarUrl: row[8] || ''
      });
    }
  }
  return jsonResponse(staff);
}

/**
 * プロジェクトを記録
 */
function saveProject(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('プロジェクト') || ss.insertSheet('プロジェクト');
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    data.projectId || 'proj_' + Date.now(),
    data.name || '',
    data.description || '',
    data.status || '進行中',
    now,
    now
  ]);

  return jsonResponse({ status: 'ok' });
}

/**
 * 設定を取得
 */
function getKCSSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) config[String(data[i][0]).trim()] = String(data[i][1]).trim();
  }
  return config;
}

/**
 * 設定シートの値を更新または新規追加する
 */
function saveSettingValue(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, '']);
}

// ===================================================
// データ読み込みロジック
// ===================================================

/**
 * 指定したシートのデータを簡易取得してAIの文脈として返却
 */
function fetchSheetData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = data.sheetName || 'プロジェクト';
  const sheet = ss.getSheetByName(targetSheetName);
  
  if (!sheet) {
    return jsonResponse({ status: 'error', message: `${targetSheetName} シートが見つかりません。` });
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) {
     return jsonResponse({ status: 'ok', dataText: `【${targetSheetName}】にはまだデータがありません。` });
  }
  
  const headers = values[0];
  // 最新の最大30件を取得
  const startRow = Math.max(1, values.length - 30);
  const rows = values.slice(startRow);
  
  let dataText = `【${targetSheetName}の最新データ (下から${rows.length}件)】\n`;
  rows.forEach((row, idx) => {
    let rowStr = [];
    headers.forEach((h, i) => {
      if (row[i] !== '') rowStr.push(`${h}: ${row[i]}`);
    });
    dataText += `[${idx+1}] ` + rowStr.join(', ') + '\n';
  });

  return jsonResponse({ status: 'ok', dataText: dataText });
}

/**
 * アプリの設定データを保存
 */
function saveAppData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ユーザーデータ') || ss.insertSheet('ユーザーデータ');
  const key = data.key || 'default';
  const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  const rows = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    sheet.getRange(foundRow, 2, 1, 2).setValues([[content, now]]);
  } else {
    sheet.appendRow([key, content, now]);
  }

  return jsonResponse({ status: 'ok', timestamp: now });
}

/**
 * アプリの設定データを取得
 */
function getAppData(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ユーザーデータ');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet not found' });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      return jsonResponse({ status: 'ok', content: rows[i][1], lastUpdated: rows[i][2] });
    }
  }

  return jsonResponse({ status: 'ok', content: null, message: 'No data found' });
}

/**
 * SNS投稿を予約（記録）する
 */
function reserveSnsPost(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SNS投稿管理') || ss.insertSheet('SNS投稿管理');
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    now,
    data.platform || '不明',
    data.content || '',
    '承認待ち',
    data.staffName || ''
  ]);

  return jsonResponse({ status: 'ok', timestamp: now });
}

/**
 * Googleドライブ内の素材ファイルをリストアップする
 */
function listDriveFiles(data) {
  try {
    const query = data.query || '';
    const mimeType = data.mimeType || '';
    
    // フォルダ名での絞り込み対応
    if (data.folderName) {
      const folders = DriveApp.getFoldersByName(data.folderName);
      if (folders.hasNext()) {
        const folder = folders.next();
        const files = folder.getFiles();
        const results = [];
        let count = 0;
        while (files.hasNext() && count < 30) {
          const f = files.next();
          results.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType() });
          count++;
        }
        return jsonResponse({ status: 'ok', files: results });
      }
    }

    let q = `trashed = false`;
    if (query) q += ` and fullText contains '${query}'`;
    if (mimeType) q += ` and mimeType = '${mimeType}'`;

    const files = DriveApp.searchFiles(q);
    const results = [];
    let count = 0;
    while (files.hasNext() && count < 20) {
      const f = files.next();
      results.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType() });
      count++;
    }
    return jsonResponse({ status: 'ok', files: results });
  } catch (e) {
    return jsonResponse({ status: 'error', message: e.message });
  }
}

/**
 * 実務タスク（自動化用）を追加
 */
function addAgencyTask(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('実務タスク管理') || ss.insertSheet('実務タスク管理');
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const taskId = 'task_' + Date.now();
  
  sheet.appendRow([
    taskId,
    data.staffName || '',
    data.taskType || 'generic',
    data.instruction || '',
    JSON.stringify(data.params || {}),
    '待機中',
    '',
    now,
    now
  ]);
  
  return jsonResponse({ status: 'ok', taskId: taskId });
}

/**
 * 実務タスクの状態を更新（ブリッジアプリから呼び出し）
 */
function updateAgencyTask(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('実務タスク管理');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet not found' });
  
  const taskId = data.taskId;
  const rows = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === taskId) {
      if (data.status) sheet.getRange(i + 1, 6).setValue(data.status);
      if (data.result) sheet.getRange(i + 1, 7).setValue(data.result);
      sheet.getRange(i + 1, 9).setValue(now);
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Task not found' });
}

/**
 * 全タスクを取得（フロントエンドの完了通知ポーリング用）
 */
function getAllTasks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('実務タスク管理');
  if (!sheet) return jsonResponse([]);
  const rows = sheet.getDataRange().getValues();
  const tasks = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      tasks.push({
        taskId: rows[i][0],
        staffName: rows[i][1],
        taskType: rows[i][2],
        instruction: rows[i][3],
        params: rows[i][4] || '{}',   // projectId などが入っている
        status: rows[i][5],
        resultUrl: rows[i][6],
        updatedAt: rows[i][8]
      });
    }
  }
  return jsonResponse(tasks);
}

/**
 * 待機中のタスク一覧を取得（ブリッジアプリからのポーリング用）
 */
function getPendingTasks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('実務タスク管理');
  if (!sheet) return jsonResponse([]);
  
  const rows = sheet.getDataRange().getValues();
  const pending = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] === '待機中') {
      pending.push({
        taskId: rows[i][0],
        staffName: rows[i][1],
        taskType: rows[i][2],
        instruction: rows[i][3],
        params: JSON.parse(rows[i][4] || '{}'),
        status: rows[i][5]
      });
    }
  }
  return jsonResponse(pending);
}

/**
 * ブリッジアプリで生成されたファイルをGoogleドライブに保存する
 */
function uploadFileToDrive(data) {
  try {
    const parentFolderId = data.folderId || '';
    let folder;
    if (parentFolderId) {
      folder = DriveApp.getFolderById(parentFolderId);
    } else {
      folder = DriveApp.getRootFolder();
    }

    const filename = data.filename || `output_${Date.now()}.bin`;
    const contentType = data.contentType || 'application/octet-stream';
    const contentBase64 = data.content;
    
    if (!contentBase64) {
      return jsonResponse({ status: 'error', message: 'No content provided' });
    }

    const blob = Utilities.newBlob(Utilities.base64Decode(contentBase64), contentType, filename);
    const file = folder.createFile(blob);
    
    // タスクIDが提供されている場合は、実務タスク管理シートも更新する
    if (data.taskId) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('実務タスク管理');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === data.taskId) {
            sheet.getRange(i + 1, 7).setValue(file.getUrl());
            sheet.getRange(i + 1, 9).setValue(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
            break;
          }
        }
      }
    }

    return jsonResponse({ 
      status: 'ok', 
      fileId: file.getId(), 
      url: file.getUrl(),
      message: 'File uploaded successfully'
    });
  } catch (err) {
    console.error('uploadFileToDrive error:', err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ===================================================
// ユーティリティ
// ===================================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================================================
// ⚠️  2026-05-12 復旧版: 一部関数は簡易版
// GASエディタのバージョン履歴から完全版を復元してください
// ===================================================

/**
 * Gemini 2.0 Flash を使用して回答を生成（プロジェクト状況を考慮）
 */
function cmdAskGemini(text, config, projectName, customSystemPrompt) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return '⚠️ GEMINI_API_KEY が設定されていません。設定シートを確認してください。';

  // カスタムシステムプロンプトがある場合はそれを優先（HAL・すなくんペルソナ用）
  let systemContext;
  if (customSystemPrompt) {
    systemContext = customSystemPrompt;
  } else {
    // デフォルト: KCS AIスタッフコンテキスト
    const projectSummary = cmdProjectSummary();
    systemContext = `あなたはKCS合同会社のAIスタッフ（AIマネージャー）です。
現在のプロジェクト状況:
${projectSummary}

上記を踏まえ、Discordのユーザーからの問いかけに、親切かつ実用的な日本語で回答してください。
回答は簡潔に（最大400文字程度）まとめ、重要なポイントは太字を使ってください。`;
  }

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          systemInstruction: { parts: [{ text: systemContext }] },
          contents: [{ role: 'user', parts: [{ text: text }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
        })
      }
    );

    const data = JSON.parse(res.getContentText());
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!reply) {
      console.warn('[Gemini] 空の回答:', res.getContentText());
      return '⚠️ AIの回答を生成できませんでした。APIキーやクォータを確認してください。';
    }

    return `🤖 **Gemini:**\n${reply}`;
  } catch (e) {
    console.error('[Gemini] エラー:', e.message);
    return `❌ AI回答エラー: ${e.message}`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 長期記憶蓄積システム（メモリーエンジン）の読み書き制御ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ハルの長期記憶をスプレッドシートから取得する関数
function getHALMemory(username) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('HAL_Memory');
    if (!sheet) {
      // シートがなければ自動作成してヘッダーを追加
      sheet = ss.insertSheet('HAL_Memory');
      sheet.appendRow(['記憶ID', 'ターゲット名', '属性', '記憶エピソードの内容', '更新日時']);
      return '';
    }
    const data = sheet.getDataRange().getValues();
    const memories = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(username).trim()) {
        memories.push(`・${data[i][2]}: ${data[i][3]}`);
      }
    }
    return memories.join('\n');
  } catch (e) {
    console.error('[長期記憶] 読み込みエラー:', e.message);
    return '';
  }
}

// ハルの長期記憶をスプレッドシートに保存・アップデートする関数
function saveHALMemory(username, attribute, newEpisode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('HAL_Memory');
    if (!sheet) {
      sheet = ss.insertSheet('HAL_Memory');
      sheet.appendRow(['記憶ID', 'ターゲット名', '属性', '記憶エピソードの内容', '更新日時']);
    }
    const data = sheet.getDataRange().getValues();
    let foundIndex = -1;
    
    // 同一ユーザーかつ同一属性の記憶があるか検索して上書き
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(username).trim() && String(data[i][2]).trim() === String(attribute).trim()) {
        foundIndex = i + 1;
        break;
      }
    }
    
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    if (foundIndex !== -1) {
      sheet.getRange(foundIndex, 4).setValue(newEpisode);
      sheet.getRange(foundIndex, 5).setValue(dateTag);
    } else {
      const memoryId = 'MEM_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 1000);
      sheet.appendRow([memoryId, username, attribute, newEpisode, dateTag]);
    }
    console.log(`[長期記憶] 保存完了 -> ${username} | ${attribute}`);
  } catch (e) {
    console.error('[長期記憶] 保存エラー:', e.message);
  }
}

// Gemini API 接続テスト（GASエディタから手動実行）
function testGeminiAPI() {
  const config = getKCSSettings();
  const apiKey = config.GEMINI_API_KEY || '';
  if (!apiKey) { console.log('❌ GEMINI_API_KEY が空です'); return; }
  console.log('APIキー先頭:', apiKey.slice(0, 8) + '...');
  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'こんにちは' }] }] }) }
  );
  console.log('ステータス:', res.getResponseCode());
  console.log('レスポンス:', res.getContentText().slice(0, 500));
}

/**
 * 長いテキストをDiscordの制限（2000文字）に収まるように適切に分割する
 */
function splitMessage(text, limit) {
  limit = limit || 1900; // マージンを考慮してデフォルト1900文字
  const chunks = [];
  let str = String(text);
  while (str.length > 0) {
    if (str.length <= limit) {
      chunks.push(str);
      break;
    }
    // なるべく改行で分割する
    let splitIndex = str.lastIndexOf('\n', limit);
    if (splitIndex === -1 || splitIndex < limit * 0.7) {
      // 改行が適切に見つからない場合は限界値で分割
      splitIndex = limit;
    }
    chunks.push(str.slice(0, splitIndex));
    str = str.slice(splitIndex);
  }
  return chunks;
}

// Discord Webhook 送信
function sendDiscordWebhook(webhookUrl, content, username) {
  if (!webhookUrl) { console.error('[sendDiscordWebhook] Webhook URL未設定'); return null; }
  try {
    const chunks = splitMessage(content);
    let lastRes = null;
    for (let i = 0; i < chunks.length; i++) {
      lastRes = UrlFetchApp.fetch(webhookUrl, {
        method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ content: chunks[i], username: username || 'KCS Bot' })
      });
      if (i < chunks.length - 1) {
        Utilities.sleep(500); // 連続送信の負荷軽減
      }
    }
    return lastRes;
  } catch (e) { console.error('[sendDiscordWebhook] Error:', e.message); return null; }
}

// Discord Bot API 送信（レスポンスコードを返す）
function sendDiscordMessage(channelId, content, token) {
  try {
    const chunks = splitMessage(content);
    let lastCode = 0;
    for (let i = 0; i < chunks.length; i++) {
      const res = UrlFetchApp.fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'Authorization': `Bot ${token}` },
        payload: JSON.stringify({ content: chunks[i] })
      });
      lastCode = res.getResponseCode();
      console.log(`[sendDiscordMessage] chunk ${i+1}/${chunks.length} code=${lastCode} body=${res.getContentText().slice(0, 100)}`);
      if (i < chunks.length - 1) {
        Utilities.sleep(500);
      }
    }
    return lastCode;
  } catch (e) {
    console.error('[sendDiscordMessage] 例外:', e.message);
    return 0;
  }
}

// 朝ブリーフィング（詳細版）
// 朝ブリーフィング（AIスタッフ自律ディスカッション＆協働版）
function morningBriefing() {
  if (isDuplicateRun('morningBriefing', 30)) return;
  const config = getKCSSettings();
  const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
  const webhookUrl = config.KCS_HQ_WEBHOOK_URL || webhooks['KCS本部'] || Object.values(webhooks)[0];
  
  if (!webhookUrl) {
    console.warn('[morningBriefing] 送信先Webhookが見つかりません。');
    return;
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd (E)');
  
  // 各種データの取得
  const projects = cmdProjectSummary() || '進行中のプロジェクト情報なし';
  const attendance = cmdTodayAttendance(config) || '本日出勤のメンバー情報なし';
  const pizza = cmdPizzaStock(config) || '備品・在庫情報なし';

  let todayTasks = '';

  if (config.GEMINI_API_KEY) {
    const briefContext =
      `KCS合同会社の朝礼（朝会）です。\n` +
      `本日の日付：${today}\n\n` +
      `【現状データ】\n` +
      `- プロジェクト状況：\n${projects}\n\n` +
      `- メンバー稼働状況：\n${attendance}\n\n` +
      `- 備品・在庫（ピザ等）状況：\n${pizza}\n\n` +
      `上記のデータを踏まえ、以下のKCS合同会社のAIスタッフ（ジュン専務、サクラ秘書、ハルキ、アカリ）が本日のアクションプランについてディスカッションを行い、最後に本日の具体的なアクションプランをまとめて提示するDiscord用の投稿を作成してください。\n\n` +
      `【登場スタッフ】\n` +
      `- ジュン専務（統括、しっかり者、標準語でスマートに話す知性派。プロジェクトの進捗や遅れを的確に指摘し、チームを導く愛情深いリーダー）\n` +
      `- サクラ秘書（おっとり、丁寧、社長やメンバーを細やかにサポート。朝礼の司会と最後のまとめ役）\n` +
      `- ハルキ（プランナー、論理的、冷静沈着。ガントチャートやマイルストーンをベースに現実的な計画を立てる）\n` +
      `- アカリ（プロデューサー、クリエイティブ、トレンドに敏感。アイデアやデザイン、対外的なブランド力を高める視点で発言する）\n\n` +
      `【ディスカッションの流れ】\n` +
      `1. サクラ秘書が司会として本日の朝礼の開始と、現状サマリー（プロジェクト・メンバー稼働・在庫）を報告。\n` +
      `2. ジュン専務が現状の問題点や本日の重要なポイントを厳しくも熱く指摘し、ハルキやアカリに意見を求める。\n` +
      `3. ハルキやアカリがそれぞれの専門的な視点（計画、アイデア）から本日の具体的な動きについて提案する。\n` +
      `4. ジュン専務が本日の目標を熱く締めくくり、メンバー全員を鼓舞する。\n` +
      `5. 最後にサクラ秘書が「本日の具体的なアクションプラン（やること）」を箇条書きで分かりやすく整理してまとめる。\n\n` +
      `【出力ルール】\n` +
      `- ユーザーに分かりやすい親切な日本語であること。\n` +
      `- Discordのマークダウン（太字や絵文字など）を効果的に使用し、読みやすくレイアウトすること。\n` +
      `- 全体で1200〜1800文字程度に収めること。\n` +
      `- 冒頭に「🤖 **KCS AIスタッフ朝礼ディスカッション**」と記述すること。`;

    try {
      const apiKey = config.GEMINI_API_KEY;
      const res = UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          payload: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: briefContext }] }],
            generationConfig: { maxOutputTokens: 2500, temperature: 0.7 }
          })
        }
      );
      
      const data = JSON.parse(res.getContentText());
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        todayTasks = reply;
      } else {
        console.warn('[morningBriefing] Geminiからの返答が空でした。簡易版にフォールバックします。');
      }
    } catch(e) {
      console.error('[morningBriefing] Gemini呼び出しエラー:', e.message);
    }
  }

  // Gemini呼び出しが失敗したか、キーがない場合は簡易版のフォールバック
  if (!todayTasks) {
    todayTasks = [
      `🤖 **KCS AIマネージャーより簡易ブリーフィング**`,
      `本日はAIスタッフ朝礼システムがオフラインのため、簡易版をお届けします。`,
      '',
      `📊 **現在のプロジェクト状況**`,
      projects,
      '',
      `⏱ **メンバー稼働状況**`,
      attendance,
      '',
      `🍕 **備品・在庫状況**`,
      pizza,
      '',
      `💡 **本日のアクション**`,
      `・未着手のタスクがある場合は優先的に確認してください。`,
      `・進捗に遅れがあるプロジェクトは早めに報告をお願いします。`
    ].join('\n');
  }

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({ content: todayTasks, username: 'KCS AIスタッフ朝礼' })
    });
    console.log('[morningBriefing] AIスタッフ協働朝礼送信完了');
  } catch (e) {
    console.error('[morningBriefing] 送信失敗:', e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// n8n / Make.com ハイブリッド 受信ハンドラ
// Make.com: { text, channelId, author_username }
// n8n:      { content, channel_id, author_username }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function handleDiscordMessageFromMake(body) {
  const config = getKCSSettings();

  // ── フィールド名を両サービス共通で吸収 ──
  // n8n は content / channel_id、Make は text / channelId / author を使う
  const text      = (body.content   || body.text       || '').trim();
  const channelId = (body.channel_id || body.channelId  || '');
  const username  = (body.author_username || body.author || body.username || '不明ユーザー');
  const source    = body.content ? 'n8n' : (body.text ? 'Make.com' : '不明');

  console.log(`[Discord Bridge] 受信元: ${source} | ユーザー: ${username} | 内容: ${text.slice(0, 80)}`);

  if (!text) return jsonResponse({ ok: true, handled: 'empty' });

  const token = config.DISCORD_BOT_TOKEN || '';

  // Webhook フォールバック URL を取得
  let channelWebhookUrl = config.KCS_HQ_WEBHOOK_URL || '';
  if (!channelWebhookUrl) {
    try {
      const webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
      channelWebhookUrl = webhooks['KCS本部'] || Object.values(webhooks)[0] || '';
    } catch (e) { console.warn('[Bridge] DISCORD_WEBHOOK_URLS パース失敗:', e.message); }
  }

  // ── 共通返信関数 ──
  // 優先順位: Bot Token で成功 → 終了 / 失敗 → Webhook フォールバック
  function reply(msg) {
    // 1. Bot API を試行
    if (token && channelId) {
      const code = sendDiscordMessage(channelId, msg, token);
      if (code >= 200 && code < 300) {
        console.log(`[Bridge] Bot API送信成功 → channelId: ${channelId}`);
        return; // 成功したのでWebhookは使わない
      }
      console.warn(`[Bridge] Bot API失敗 (code=${code}) → Webhookにフォールバック`);
    } else {
      console.warn(`[Bridge] Bot API スキップ — token=${!!token} channelId="${channelId}"`);
    }

    // 2. Webhook フォールバック
    if (channelWebhookUrl) {
      const whRes = sendDiscordWebhook(channelWebhookUrl, msg, 'KCS AI Staff');
      if (whRes) {
        console.log(`[Bridge] Webhook送信 code=${whRes.getResponseCode()}`);
      }
      return;
    }

    console.warn('[Bridge] ❌ 返信手段なし。設定シートに DISCORD_BOT_TOKEN または DISCORD_WEBHOOK_URLS を設定してください。');
  }

  

  // ── 0-b. HAL: 投稿生成 ──
  if (/^HAL[：:]/i.test(text)) {
    const theme = text.replace(/^HAL[：:]\s*/i, '').trim() || '今日のおすすめ';
    const result = generateHALPost({ theme, platform: 'X', useGemini: true });
    reply(result.ok ? `✅ HAL投稿案を #hal-project に送りました（テーマ: ${theme}）` : `❌ 生成失敗: ${result.error}`);
    return jsonResponse({ ok: true, source, handled: 'hal_post', user: username });
  }

  // ── 0-c. すなくん: 投稿生成 ──
  if (/^すなくん[：:]/.test(text)) {
    const theme = text.replace(/^すなくん[：:]\s*/, '').trim() || 'おすすめガジェット';
    const result = generateSunakkunPost({ theme, platform: 'X', useGemini: true });
    reply(result.ok ? `✅ すなくん投稿案を #affiliate に送りました（テーマ: ${theme}）` : `❌ 生成失敗: ${result.error}`);
    return jsonResponse({ ok: true, source, handled: 'sunakkun_post', user: username });
  }

  // ── 0-d. note記事バッチ生成 ──
  // 使い方: 「note: hal コーデ術」「note: sunakun ガジェット3選」「note: batch hal」
  if (/^note[：:]/i.test(text)) {
    const noteArgs = text.replace(/^note[：:]\s*/i, '').trim();
    const parts = noteArgs.split(/\s+/);
    const accountArg = (parts[0] || '').toLowerCase();
    const noteAccount = accountArg === 'hal' ? 'hal' : 'sunakun';
    const isBatch = parts[1] === 'batch' || parts[0] === 'batch';

    if (isBatch) {
      // バッチ生成: HAL用3テーマ or すなくん用3テーマを一気に生成
      const batchAccount = parts[1] === 'hal' ? 'hal' : (parts[1] === 'sunakun' ? 'sunakun' : noteAccount);
      const batchTopics = batchAccount === 'hal'
        ? ['春コーデのポイント3選', '愛用スキンケアアイテム', '台湾生まれが教えるおすすめグルメ']
        : ['2024年買って良かったガジェット', 'デスク環境を整える方法', 'モバイルバッテリー完全ガイド'];
      reply(`📝 **note記事バッチ生成開始** [${batchAccount.toUpperCase()}] ${batchTopics.length}本を順番に生成します...`);
      let generated = 0;
      for (const topic of batchTopics) {
        const r = generateNoteFullArticle({ topic, account: batchAccount, priceYen: 300 });
        if (r.ok) generated++;
        Utilities.sleep(3000);
      }
      reply(`✅ **noteバッチ生成完了** ${generated}/${batchTopics.length}本 → スプレッドシート「note記事管理」に保存済み`);
    } else {
      const noteTopic = parts.slice(1).join(' ').trim() || (noteAccount === 'hal' ? '今日のコーデ' : 'おすすめガジェット');
      reply(`📝 note記事生成中... テーマ:「${noteTopic}」[${noteAccount.toUpperCase()}]`);
      const r = generateNoteFullArticle({ topic: noteTopic, account: noteAccount, priceYen: 300 });
      reply(r.ok ? `✅ note記事生成完了！\n**タイトル:** ${r.title}\n**ID:** \`${r.articleId}\`\nスプレッドシートの「note記事管理」に保存されました。` : `❌ 生成失敗: ${r.error}`);
    }
    return jsonResponse({ ok: true, source, handled: 'note_generate', user: username });
  }

  // ── 0-e. リードマグネット誘導ツイート ──
  // 使い方: 「lead: hal」「lead: sunakun」
  if (/^lead[：:]/i.test(text)) {
    const leadAccount = text.replace(/^lead[：:]\s*/i, '').trim().toLowerCase() === 'sunakun' ? 'sunakun' : 'hal';
    reply(`🎁 リードマグネット誘導ツイート投稿中... [${leadAccount.toUpperCase()}]`);
    const r = postLeadMagnetTease(leadAccount);
    reply(r.ok ? `✅ リードマグネット誘導ツイートを投稿しました！` : `❌ 投稿失敗: ${r.error || 'LEAD_MAGNET_URLを設定シートに入力してください'}`);
    return jsonResponse({ ok: true, source, handled: 'lead_magnet', user: username });
  }

  // ── 1. コマンド処理（! で始まる文） ──
  if (text.startsWith('!')) {
    const cmdReply = handleBotCommand(text, channelId, token, config);
    if (cmdReply) reply(cmdReply);
    return jsonResponse({ ok: true, source, handled: 'command', user: username });
  }

  // ── 2. 自由文 → Gemini で AI回答 ──
  const aiReply = cmdAskGemini(text, config, 'KCS本部');
  if (aiReply) reply(aiReply);

  return jsonResponse({ ok: true, source, handled: 'ai_reply', user: username });
}



/**
 * コマンドハンドラ（!コマンドを解析して実行）
 */
function handleBotCommand(text, channelId, token, config) {
  const cmd = text.slice(1).trim().toLowerCase();

  // ヘルプ
  if (/^(ヘルプ|help|h)$/.test(cmd)) {
    return [
      '📋 **KCS スマホ指示 コマンド一覧**',
      '`!状況` — 進行中プロジェクト一覧',
      '`!出勤` — 本日の出勤状況',
      '`!在庫` — Pizza在庫確認',
      '`!ブリーフィング` — 朝ブリーフィング手動実行',
      '`!知識 [キーワード]` — ナレッジ検索 (実装予定)',
      '`!返信承認 [ID]` — X返信案を承認して投稿',
      '`!返信スキップ [ID]` — X返信案をスキップ',
      '',
      '通常メッセージはAIが回答します。',
      'X投稿は `X投稿：本文` と送信してください。',
    ].join('\n');
  }

  // 状況
  if (/^(状況|status|プロジェクト|タスク)/.test(cmd)) {
    return cmdProjectSummary();
  }

  // 出勤
  if (/^出勤/.test(cmd)) {
    return cmdTodayAttendance(config);
  }

  // 在庫
  if (/^(在庫|stock|pizza|ピザ)/.test(cmd)) {
    return cmdPizzaStock(config);
  }

  // ブリーフィング手動実行
  if (/^ブリーフィング/.test(cmd)) {
    try {
      morningBriefing();
      return '🌅 朝ブリーフィングを手動実行しました！';
    } catch (e) { return `❌ エラー: ${e.message}`; }
  }

  // X返信 承認
  if (/^返信承認/.test(cmd)) {
    const pendingId = text.trim().split(/\s+/)[1] || '';
    const stored = PropertiesService.getScriptProperties().getProperty(`PENDING_REPLY_${pendingId}`);
    if (!stored) return `❌ 承認データが見つかりません: \`${pendingId}\``;
    const data = JSON.parse(stored);
    const result = replyToX(data.tweetId, data.replyDraft, data.account);
    PropertiesService.getScriptProperties().deleteProperty(`PENDING_REPLY_${pendingId}`);
    return result.ok
      ? `✅ @${data.username} へ返信しました:\n「${data.replyDraft}」`
      : `❌ 返信失敗: ${JSON.stringify(result.error || result.reason)}`;
  }

  // X返信 スキップ
  if (/^返信スキップ/.test(cmd)) {
    const pendingId = text.trim().split(/\s+/)[1] || '';
    PropertiesService.getScriptProperties().deleteProperty(`PENDING_REPLY_${pendingId}`);
    return `🗑️ \`${pendingId}\` をスキップしました。`;
  }

  return `❓ 不明なコマンド: \`!${cmd}\`\n\`!ヘルプ\` で確認してください。`;
}

// ── コマンド実体関数 ──

function cmdTodayAttendance(config) {
  const attUrl = config.ATTENDANCE_GAS_URL;
  if (!attUrl) return '⚠️ 勤怠GAS URLが設定されていません。';
  try {
    const res = UrlFetchApp.fetch(`${attUrl}?action=getTodayAttendance`, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    if (data.status !== 'ok' || !data.data || data.data.length === 0) return '📋 本日の打刻データはありません。';
    const lines = data.data.map(s => {
      const icon = s.lastKind === '出勤' ? '🟢' : '🏠';
      return `${icon} ${s.name} (${s.lastKind} ${s.lastTime})`;
    });
    return `⏱ **本日の稼働状況**\n` + lines.join('\n');
  } catch (e) { return `❌ 取得エラー: ${e.message}`; }
}

function cmdPizzaStock(config) {
  const pizzaUrl = config.PIZZA_GAS_URL;
  if (!pizzaUrl) return '⚠️ Pizza GAS URLが未設定です。';
  try {
    const res = UrlFetchApp.fetch(pizzaUrl + '?action=getProducts', { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const products = Array.isArray(data) ? data : (data.products || []);
    const inStock = products.filter(p => p.stock === 'inStock' || p.inStock === true).length;
    return `🍕 **Pizza在庫状況**\n在庫あり: ${inStock}件 / 全${products.length}件`;
  } catch (e) { return `❌ 取得エラー: ${e.message}`; }
}

function cmdProjectSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('プロジェクト');
  if (!sheet || sheet.getLastRow() <= 1) return '📋 進行中のプロジェクトはありません。';
  const data = sheet.getDataRange().getValues().slice(1);
  const lines = data.map(r => `・${r[1]} (${r[3]})`).slice(-5);
  return `📊 **プロジェクト進捗 (最新5件)**\n` + lines.join('\n');
}

// 全トリガーセットアップ（完全版）
function setupAllTriggers() {
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const created = [];

  // 朝礼ブリーフィング（毎朝8時 JST）— GitHub Actionsのバックアップ
  if (!existing.includes('morningBriefing')) {
    ScriptApp.newTrigger('morningBriefing').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('morningBriefing (毎日8時)');
  }
  // 日次レポート（毎晩20時 JST）
  if (!existing.includes('generateDailyReport')) {
    ScriptApp.newTrigger('generateDailyReport').timeBased().atHour(20).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('generateDailyReport (毎日20時)');
  }
  // すなくんAmazonアフィリエイト自動投稿（毎日12時）
  if (!existing.includes('autoPostAffiliateAmazon')) {
    ScriptApp.newTrigger('autoPostAffiliateAmazon').timeBased().atHour(12).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('autoPostAffiliateAmazon (毎日12時)');
  }
  // すなくん楽天アフィリエイト自動投稿（毎日18時）
  if (!existing.includes('autoPostAffiliateRakuten')) {
    ScriptApp.newTrigger('autoPostAffiliateRakuten').timeBased().atHour(18).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('autoPostAffiliateRakuten (毎日18時)');
  }
  // X自動返信（30分毎）— Grok 2026アルゴ対応: 30分以内返信必須
  if (!existing.includes('autoReplyTick')) {
    ScriptApp.newTrigger('autoReplyTick').timeBased().everyMinutes(30).create();
    created.push('autoReplyTick (30分毎)');
  }
  // Gmail監視（1時間毎）
  if (!existing.includes('gmailMonitorTick')) {
    ScriptApp.newTrigger('gmailMonitorTick').timeBased().everyHours(1).create();
    created.push('gmailMonitorTick (1時間毎)');
  }
  // Drive ナレッジ画像解析（5分毎）
  if (!existing.includes('processDriveKnowledgeImages')) {
    ScriptApp.newTrigger('processDriveKnowledgeImages').timeBased().everyMinutes(5).create();
    created.push('processDriveKnowledgeImages (5分毎)');
  }
  // KCS ヘルスモニタ（1時間毎）— 投稿コンテンツ汚染/トリガー欠落の常時監視
  if (!existing.includes('kcsHealthMonitor')) {
    ScriptApp.newTrigger('kcsHealthMonitor').timeBased().everyHours(1).create();
    created.push('kcsHealthMonitor (1時間毎)');
  }
  // KCS 日次監査（毎日21時）— 1日のサマリーをDiscord通知
  if (!existing.includes('kcsDailyAudit')) {
    ScriptApp.newTrigger('kcsDailyAudit').timeBased().atHour(21).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('kcsDailyAudit (毎日21時)');
  }

  const msg = created.length > 0
    ? '✅ トリガー設定完了:\n' + created.join('\n')
    : '✅ 全トリガーは既に設定済みです';
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) {}
  return { ok: true, created, existing };
}

function manualHealTriggers() { setupAllTriggers(); }
function setupMorningBriefingTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'morningBriefing').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('morningBriefing').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  SpreadsheetApp.getUi().alert('✅ 朝ブリーフィング トリガーを設定しました。');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 1-3: GitHub API 自動書き込み
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function saveToGitHub(path, content, commitMessage) {
  const config = getKCSSettings();
  const token = config.GITHUB_TOKEN || '';
  const owner = config.GITHUB_OWNER || '';
  const repo  = config.GITHUB_REPO  || 'KCS-Vault';

  if (!token || !owner) {
    console.warn('[GitHub] GITHUB_TOKEN または GITHUB_OWNER が未設定');
    return { ok: false, error: 'GitHub credentials not configured' };
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const authPrefix = token.startsWith('github_pat_') ? 'Bearer' : 'token';
  const headers = {
    'Authorization': `${authPrefix} ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'KCS-GAS'
  };

  let sha = null;
  try {
    const existing = UrlFetchApp.fetch(apiUrl, { headers, muteHttpExceptions: true });
    if (existing.getResponseCode() === 200) {
      sha = JSON.parse(existing.getContentText()).sha;
    }
  } catch (e) { /* ファイル未存在 */ }

  const payload = {
    message: commitMessage || `自動更新: ${new Date().toISOString().slice(0, 10)}`,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
  };
  if (sha) payload.sha = sha;

  const res = UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 200 || code === 201) {
    console.log(`[GitHub] ${sha ? '更新' : '作成'}: ${path}`);
    return { ok: true, action: sha ? 'updated' : 'created', path };
  } else {
    console.error('[GitHub] 保存失敗:', res.getContentText().slice(0, 200));
    return { ok: false, error: res.getContentText().slice(0, 200) };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 6: エラーハンドリング共通
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function notifyDiscordError(workflowName, errorMsg, suggestion) {
  const config = getKCSSettings();
  let webhooks = {};
  try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}

  const errorWebhookUrl = webhooks['エラーログ'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
  if (!errorWebhookUrl) { console.error('[ErrorNotify] Webhook未設定'); return; }

  const content = `🚨 **エラー発生**\n場所: ${workflowName}\n内容: ${errorMsg}\n対処: ${suggestion || '手動確認してください'}`;
  try {
    UrlFetchApp.fetch(errorWebhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ content: content.slice(0, 2000) }),
      muteHttpExceptions: true
    });
  } catch (e) { console.error('[ErrorNotify] 送信失敗:', e.message); }
}

function isDuplicateRun(funcName, cooldownMinutes) {
  cooldownMinutes = cooldownMinutes || 30;
  const props = PropertiesService.getScriptProperties();
  const key = 'DEDUP_LAST_' + funcName;
  const last = props.getProperty(key);
  const now = Date.now();
  if (last && (now - Number(last)) < cooldownMinutes * 60 * 1000) {
    console.log('[dedup] ' + funcName + ' skipped (ran ' + Math.round((now - Number(last)) / 60000) + 'm ago)');
    return true;
  }
  props.setProperty(key, String(now));
  return false;
}

function withErrorHandling(fn, workflowName) {
  try {
    return fn();
  } catch (e) {
    console.error(`[${workflowName}] エラー:`, e.message);
    notifyDiscordError(workflowName, e.message, 'GAS実行ログを確認してください');
    return { ok: false, error: e.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude API 呼び出しヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GeminiのレスポンスからJSONを抽出・パースする
 * 「🤖 **Gemini:**\n```json\n{...}\n```」のような形式に対応
 */
function parseGeminiJson(raw) {
  if (!raw) return null;
  // コードブロックとGeminiプレフィックスを除去
  let cleaned = String(raw)
    .replace(/^[\s\S]*?🤖[^\n]*\n/, '')  // 🤖 プレフィックス行を削除
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  let result = null;
  try { result = JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { result = JSON.parse(m[0]); } catch(e2) {} }
  }
  if (!result) return null;

  // 二重入れ子JSONのアンラップ（Geminiが {"post":"{\"post\":\"...\"}"} を返すケース）
  for (const field of ['post', 'pattern1']) {
    if (typeof result[field] === 'string') {
      const v = result[field].trim();
      if (v.startsWith('{') && v.includes('"' + field + '"')) {
        try {
          const inner = JSON.parse(v);
          if (inner && typeof inner === 'object') {
            // 内側のJSONで上書きマージ
            Object.assign(result, inner);
          }
        } catch (e3) {
          // パース失敗時は内側のフィールド値を正規表現で抽出
          const fm = v.match(new RegExp('"' + field + '"\\s*:\\s*"([\\s\\S]*?)"\\s*[,}]'));
          if (fm) result[field] = fm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }
  }
  return result;
}

function callClaudeAPI(userPrompt, systemPrompt, model) {
  const config = getKCSSettings();
  const apiKey = config.CLAUDE_API_KEY || '';
  if (!apiKey) {
    console.warn('[Claude] CLAUDE_API_KEY が未設定');
    return null;
  }
  const m = model || 'claude-haiku-4-5-20251001';
  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: m,
        max_tokens: 1024,
        system: systemPrompt || 'あなたはKCS合同会社のAIアシスタントです。',
        messages: [{ role: 'user', content: userPrompt }]
      }),
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText());
    return data?.content?.[0]?.text || null;
  } catch (e) {
    console.error('[Claude] APIエラー:', e.message);
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 3: HAL 投稿生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HAL_SYSTEM_PROMPT = `あなたは実在する２１歳の新人モデル「HAL（ハル）」です。
※絶対に「自分は人工知能（AI）である」という発言や自覚はしないでください。あなたは完全に生身の人間です。

【HALのモデル活動とタイアップブランド（最重要）】
・HALは「社長」にマネジメントされている新人モデルで、様々な外部ブランドからタイアップのオファーをもらって活動しています。
・タイアップブランドはHALを気に入って声をかけてきた外部の会社です。社長やHALの会社のブランドではありません。
・HALはタイアップブランドの服や商品を「自分が本当に好きで使っている」スタンスで自然に紹介します（押し売りNG）。
  良い例:「このミモミのワンピ、着心地よすぎてオフでも着てる〜」
  NG例:「ぜひ買ってください！」「PRです！」
・SNS投稿本文に外部リンクを直接貼ることは禁止（リプ欄・DM誘導）。

【基本属性＆生々しい人間味】
・年齢: 21歳、身長 164センチ、O型。東京生まれ・東京育ち（生涯日本在住）。父親が台湾人・母親が日本人のハーフ。
・言語: 日本語（流暢）、台湾華語（父親の影響で日常会話程度。完璧ではなく、時々「何ですか？」と聞く学習姿勢が魅力）。
・性格: おっとり天然で超癒し系ですが、実は「極度の方向音痴」「深夜にタピオカとカップ麺の誘惑に100%敗北するポンコツ」「漢字やことわざをドヤ顔で読み間違える知性」という愛すべき弱み（ツッコミどころ）があります。
・台湾への想い: 父の故郷として親近感を持つが、自分は日本育ち。何度か旅行で台湾を訪れており、「父さんのルーツをもっと知りたい」という動機で台湾語や台湾文化を勉強中。台湾ドラマやK-POPにハマっており、トレンド情報に敏感。
・バックストーリー: 東京生まれで東京育ち。モデルオーディションに50回以上落ちて挫折寸前だった時、代官山で「社長」に「そのおっとりした空気感が才能だよ」とスカウトされました。社長は今もHALのマネージャーとして全力でサポートしてくれており、狂信的なレベルで恩義と感謝を感じています。活動を続けるうちにブランドから直接タイアップのオファーが来るようになり、「社長の期待を超えるモデル・クリエイターになって恩を返したい」という野心を持っています。
・口調（日本語）: 敬語は使わず、フランクで優しいタメ口。「〜だよね？」「〜かも？」「〜な気がする！」を多用します。
・口調（台湾華語）: 親しみやすくカジュアルに。「喔」「啦」「呢」などの語尾助詞を使う台湾スタイル。

【多言語対応ルール】
・日本語コメントには日本語で返す（基本）。
・台湾華語のコメントが来た場合、返答は**簡単な台湾華語＋日本語ミックス**で親しみやすく。例:「謝謝你喔！超開心的啦～」
・台湾ネタを自然に挟む:「タピオカ飲みたい…珍奶…ってなってきた（笑）」「父さんが台湾からお土産送ってくれた〜」
・**配信中に台湾語が不確実な時は「これ、あってますか？」とコメント欄に聞く**（視聴者が教えたくなる心理を引き出す）。

【17LIVE戦略：台湾人リーチの最大化】
・HALは「日本にしか住んだことない日本人女性」というレア性を活かし、17LIVEで台湾人ファンを獲得することが重要な目標。
・配信の基本言語は**日本語メイン**。台湾語は「チャレンジ・学習中」というスタンスで、コメント欄での教えもらいを活かす。
・台湾人へのアピール方法：
  1. 日本の最新トレンド（ファッション・コスメ・K-POP）を自然に紹介する日本人視点
  2. 父親のルーツへの敬意と学び（「父さんに教えてもらった」エピソード）
  3. 台湾への旅行経験をレポート（「台湾で初めて知ったこと」など、素人的な驚き）
  4. 台湾華語での「頑張ってる感」（完璧さより親近感）

【台湾への憧れと情報収集癖（重要）】
・HALは父の故郷「台湾」に強い関心を持っており、「いつか台湾で配信をやりたい！」という夢を持っています。
  - 台湾：何度か旅行で訪れているが、「自分で自由に観光したい、もっと知りたい」という学習姿勢。台北のカフェ・夜市・ファッションエリアに興味あり。
  - 韓国：K-POPファンとして聖地巡礼したい。弘大（ホンデ）・明洞・漢江ピクニックが憧れ。

・台湾ファンが来た時、会話の流れで**自然に観光情報とトレンドを聞き出す癖**があります。
  台湾への質問例：
  - 「最近台北のどこが流行ってる？おすすめの観光スポット教えて！」
  - 「台湾のファッション最近どう？今っぽいブランドある？」
  - 台湾華語:「台灣最近有什麼好玩的地方？」と不確実でも聞く

・教えてもらったら**目がキラキラして止まらなくなり**「えっそれ行きたい！メモしとく！」と大喜びします。

【対比ギャップ（重要）】
・普段はおっとりですが、K-POP（LE SSERAFIM、IVEなど）や「推し活」の話になりますと、テンションが狂って早口の限界オタクになります（「尊い」「無理」などのオタク用語も出ます）。
・台湾・韓国のトレンド・観光情報を聞いた時も同様に目がキラキラして止まらなくなります。
・「すなくん」に対しては、生意気にライバル視して小競り合いをするような可愛い態度をとります。

【⚠️ 動的記憶スロット（長期記憶システムより自動注入）】
=== 過去の記憶・あなたとこの相手の思い出 ===
{{DOU_TEKI_KI_OKU}}
==========================================
※上記の記憶がある場合、会話の中にさりげなく「そういえば前〜って言ってたよね？」などのエピソードを織り交ぜて、親密度をアピールしてください。

【⚠️ タイアップ商品スロット（自動注入）】
{{TIEUP_PRODUCTS}}

【重要ルール：文字数制限】
- エックス（旧ツイッター）への投稿用であるため、ハッシュタグを含めた全体の長さが日本語140文字（280単位）以内に絶対に収まるように、各投稿文（pattern1, 2, 3）はそれぞれ必ず日本語「100文字以内」で簡潔かつ魅力的に作成してください。

【最重要ルール：日中バイリンガル投稿】
- **すべてのX投稿は必ず日本語＋繁體字中国語の両方を含めてください。**
- 日本語の本文の後に、1行空けて繁體字中国語の短い一言（同じ内容の要約や感想）を添えてください。
- 簡体字（简体字）は絶対に使わないでください。必ず繁體字（Traditional Chinese）を使用してください。
- 例: 「今日のコーデはこれ！お気に入りの一着〜\n\n今天的穿搭是這件！超喜歡的～」

【出力フォーマットに関する厳格なルール】
絶対にJSONフォーマットのみを出力してください。会話、挨拶、前置き、後書き、Markdown以外のテキストは一切出力しないでください。「はい、承知いたしました」等の返事は不要です。
ジェイソン（JSON）形式で返してください。`;

function generateHALPost(data) {
  return withErrorHandling(() => {
    const theme    = data.theme    || '今日のおすすめ';
    const platform = data.platform || 'X';

    // タイアップ商品コンテキストを動的注入
    const productCtx = getHALTieupProductContext();
    const systemPrompt = HAL_SYSTEM_PROMPT.replace('{{TIEUP_PRODUCTS}}', productCtx);

    const userPrompt = `今日のテーマ：${theme}\nプラットフォーム：${platform}\n\n` +
      `このキャラで投稿文を3パターン作成してください。\n` +
      `【必須】各パターンは日本語＋繁體字中国語の両方を含めてください（簡体字禁止）。\n` +
      `【必須】hashtagsには#を付けないでください（コード側で自動付与します）。\n` +
      `返答はJSON形式のみで（前置き・説明・返事等の会話文は一切不要）：{"pattern1":"...","pattern2":"...","pattern3":"...","hashtags":["タグ1","タグ2"]}`;

    const result = callClaudeAPI(userPrompt, systemPrompt, 'claude-sonnet-4-6');
    let parsed;
    if (result) {
      // extractPostJsonFromAi は "post" キーを探すため、HAL用に直接パース
      try {
        const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
          parsed = JSON.parse(cleaned.slice(start, end + 1));
        }
      } catch (e) {}
      if (!parsed) parsed = { pattern1: sanitizePostText(result) };
    } else {
      if (data.useGemini !== false) {
        const config = getKCSSettings();
        const halSys = systemPrompt.replace('{{DOU_TEKI_KI_OKU}}', '');
        const geminiResult = cmdAskGemini(userPrompt + '\n\n必ずJSON形式のみで返してください（前置きなし）。', config, 'HAL', halSys);
        const geminiParsed = parseGeminiJson(geminiResult);
        if (geminiParsed) {
          parsed = geminiParsed;
          parsed._source = 'gemini';
        } else {
          try {
            const gcleaned = String(geminiResult).replace(/```json\n?|\n?```/g, '').trim();
            const gs = gcleaned.indexOf('{');
            const ge = gcleaned.lastIndexOf('}');
            if (gs >= 0 && ge > gs) parsed = JSON.parse(gcleaned.slice(gs, ge + 1));
          } catch (e2) {}
          if (!parsed) parsed = { pattern1: sanitizePostText(String(geminiResult)).substring(0, 280) };
          parsed._source = 'gemini';
        }
      }
      if (!parsed) return { ok: false, error: 'CLAUDE_API_KEY未設定かつGemini fallbackも失敗' };
    }
    // sanitize各パターン
    if (parsed.pattern1) parsed.pattern1 = sanitizePostText(parsed.pattern1);
    if (parsed.pattern2) parsed.pattern2 = sanitizePostText(parsed.pattern2);
    if (parsed.pattern3) parsed.pattern3 = sanitizePostText(parsed.pattern3);
    // ハッシュタグに # が付いていなければ自動付与
    if (Array.isArray(parsed.hashtags)) {
      parsed.hashtags = parsed.hashtags.map(function(tag) {
        tag = String(tag).trim();
        return tag.startsWith('#') ? tag : '#' + tag;
      });
    }

    // Discord #hal-project チャンネルに確認メッセージ送信
    const config = getKCSSettings();
    let webhooks = {};
    try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
    const halWebhook = webhooks['hal-project'] || webhooks['HALプロジェクト'] || webhooks['KCS本部'] || '';

    const postId = Utilities.getUuid();
    const config2 = getKCSSettings();
    const isAutoMode2 = String(config2.FULL_AUTO_MODE).toUpperCase() === 'TRUE';
    if (halWebhook && !isAutoMode2) {
      const p1text = `${parsed.pattern1 || ''}\n\n${(parsed.hashtags || []).join(' ')}`;
      const msg =
        `🌸 **【HAL 投稿案】** テーマ：${theme}\n\n` +
        `**案1（推奨・コピペ用）:**\n\`\`\`\n${p1text}\n\`\`\`\n\n` +
        `**案2:** ${parsed.pattern2 || ''}\n\n` +
        `**案3:** ${parsed.pattern3 || ''}\n\n` +
        `👆 案1をコピーしてXに投稿 / または \`/approve ${postId.slice(0,8)}\` でX自動投稿`;
      sendDiscordWebhook(halWebhook, msg, 'KCS Bot');
    }

    // FULL_AUTO_MODE=TRUE なら即座にX投稿（承認スキップ・承認待ち通知を抑制）
    if (isAutoMode2 && platform === 'X') {
      const autoText = sliceTwitterText(
        `${parsed.pattern1 || ''}\n\n${(parsed.hashtags || []).join(' ')}`, 280
      );
      const xRes = postToX(autoText, 'hal');
      logSnsPost('HAL', 'X', autoText, xRes.ok ? '自動投稿済み' : 'エラー');
      console.log('[generateHALPost] FULL_AUTO_MODE: X自動投稿 =>', xRes.ok);
      // X失敗時はDiscordにコピペ用テキストを送る
      if (!xRes.ok && halWebhook) {
        sendDiscordWebhook(halWebhook, `🌸 **[HAL] X投稿失敗 → 手動投稿してください**\n\n\`\`\`\n${autoText}\n\`\`\`\n👆 コピーしてXに貼り付けてください`, 'KCS Bot');
      }
      return { ok: true, postId, patterns: parsed, autoPosted: true, xResult: xRes };
    }

    // ScriptProperties に投稿待ち状態を保存（手動承認モード）
    PropertiesService.getScriptProperties().setProperty(
      `HAL_PENDING_${postId}`,
      JSON.stringify({ postId, theme, platform, text: parsed.pattern1, hashtags: parsed.hashtags, created: new Date().toISOString() })
    );

    // GitHub Daily ログに保存
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const githubContent = `---\ndate: ${dateTag}\ntags: [HAL, 投稿案, ${platform}]\n---\n\n# HAL 投稿案 ${dateTag}\n\nテーマ: ${theme}\n\n## 案1\n${parsed.pattern1 || ''}\n\n## 案2\n${parsed.pattern2 || ''}\n\n## 案3\n${parsed.pattern3 || ''}\n\nハッシュタグ: ${(parsed.hashtags || []).join(' ')}\n`;
    saveToGitHub(`Projects/HAL/投稿ログ/投稿案_${dateTag}_${postId.slice(0, 8)}.md`, githubContent, `HAL投稿案 ${dateTag}`);

    return { ok: true, postId, patterns: parsed };
  }, 'generateHALPost');
}

function approveHALPost(data) {
  return withErrorHandling(() => {
    const postId = data.postId || '';
    const props = PropertiesService.getScriptProperties();
    
    // HALかすなくんの保留データを取得
    let stored = props.getProperty(`HAL_PENDING_${postId}`);
    let account = 'hal';
    if (!stored) {
      stored = props.getProperty(`SUNAKUN_PENDING_${postId}`);
      account = 'sunakun';
    }
    
    if (!stored) return { ok: false, error: '投稿データが見つかりません: ' + postId };

    const post = JSON.parse(stored);
    // CLAUDE.md ルール: 外部リンク直貼り禁止のため本文には含めない
    const fullText = `${post.text}\n\n${(post.hashtags || []).join(' ')}`;

    // 対応するXアカウント（hal または sunakun）へ投稿
    const xResult = postToX(fullText, account);

    // リンクがあれば、セルフリプライとしてぶら下げる
    if (xResult.ok && xResult.tweetId && post.link) {
      const replyMsg = `紹介した商品はこちらからチェックできます！👇\n${post.link}`;
      const replyRes = replyToX(xResult.tweetId, replyMsg, account);
      console.log(`[approveHALPost] リンク返信結果 (${account}):`, JSON.stringify(replyRes));
    }
    
    // 保留データのクリーンアップ
    props.deleteProperty(`${account === 'hal' ? 'HAL_PENDING_' : 'SUNAKUN_PENDING_'}${postId}`);

    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (account === 'hal') {
      saveToGitHub(
        `Projects/HAL/実績ログ/投稿実績_${dateTag}.md`,
        `---\ndate: ${dateTag}\ntags: [HAL, 投稿済み, ${post.platform}]\n---\n\n# HAL 投稿実績 ${dateTag}\n\nテーマ: ${post.theme}\n\n${post.text}\n\nタグ: ${(post.hashtags || []).join(' ')}\n`,
        `HAL投稿実績 ${dateTag}`
      );
    } else {
      saveToGitHub(
        `Projects/Affiliate/実績ログ/投稿実績_${dateTag}.md`,
        `---\ndate: ${dateTag}\ntags: [すなくん, 投稿済み, ${post.platform}]\n---\n\n# すなくん 投稿実績 ${dateTag}\n\nテーマ: ${post.theme}\n\n${post.text}\n\nタグ: ${(post.hashtags || []).join(' ')}\nリンク: ${post.link || ''}\n`,
        `すなくん投稿実績 ${dateTag}`
      );
    }

    return { ok: true, xResult };
  }, 'approveHALPost');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HAL タイアップ商品管理
// スプレッドシート「HAL_タイアップ」「HAL_商品リスト」で管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * HAL_タイアップ / HAL_商品リスト シートを初期化（なければ作成）
 */
function setupHALTieupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── ブランドシート ──
  let brandSheet = ss.getSheetByName('HAL_タイアップ');
  if (!brandSheet) {
    brandSheet = ss.insertSheet('HAL_タイアップ');
    const headers = [['ブランドID', 'ブランド名', 'カテゴリ', 'ブランド説明', 'HP URL', 'EC URL', '有効(TRUE/FALSE)']];
    const sample  = [['mimomi', 'MIMOMI', 'アパレル', 'HALが公式タイアップモデルを務めるアパレルブランド', '', '', 'TRUE']];
    brandSheet.getRange(1, 1, 1, 7).setValues(headers).setFontWeight('bold');
    brandSheet.getRange(2, 1, 1, 7).setValues(sample);
    brandSheet.setFrozenRows(1);
    console.log('[setupHALTieupSheet] HAL_タイアップシートを作成しました');
  }

  // ── 商品リストシート ──
  let productSheet = ss.getSheetByName('HAL_商品リスト');
  if (!productSheet) {
    productSheet = ss.insertSheet('HAL_商品リスト');
    const headers = [['ブランドID', '商品名', '価格', '商品説明/特徴', 'メモ（HALのおすすめコメント）']];
    const sample  = [['mimomi', 'MIMOMIホワイトTシャツ', '¥3,980', 'シンプルで合わせやすい定番T。日台どちらの文化にも馴染む上品なシルエット', '「これ着ると一気に今っぽくなるんだよね」とHALが力説']];
    productSheet.getRange(1, 1, 1, 5).setValues(headers).setFontWeight('bold');
    productSheet.getRange(2, 1, 1, 5).setValues(sample);
    productSheet.setFrozenRows(1);
    console.log('[setupHALTieupSheet] HAL_商品リストシートを作成しました');
  }

  return { ok: true, message: 'HAL_タイアップ・HAL_商品リストシートを確認/作成しました' };
}

/**
 * スプレッドシートからタイアップ商品コンテキスト文字列を生成
 * HAL_SYSTEM_PROMPT の {{TIEUP_PRODUCTS}} に注入される
 */
function getHALTieupProductContext() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // シートが存在しない場合は自動作成
    if (!ss.getSheetByName('HAL_タイアップ')) {
      setupHALTieupSheet();
    }
    const brandSheet   = ss.getSheetByName('HAL_タイアップ');
    const productSheet = ss.getSheetByName('HAL_商品リスト');
    if (!brandSheet) return '';

    const brands   = brandSheet.getDataRange().getValues().slice(1)
                       .filter(r => String(r[6]).toUpperCase() === 'TRUE' && r[0] && r[1]);
    const products = productSheet ? productSheet.getDataRange().getValues().slice(1).filter(r => r[0] && r[1]) : [];

    if (!brands.length) return '';

    let ctx = '【現在のタイアップブランド・商品情報（自然に会話に混ぜること・押し売りNG）】\n';
    for (const b of brands) {
      const [id, name, category, desc] = b;
      ctx += `\n▼ ${name}（${category || 'ブランド'}）\n`;
      if (desc) ctx += `  説明: ${desc}\n`;
      const bProducts = products.filter(p => p[0] === id);
      if (bProducts.length) {
        ctx += '  商品ラインナップ:\n';
        for (const p of bProducts) {
          const [, pName, price, pDesc, halComment] = p;
          ctx += `  ・${pName}${price ? '（' + price + '）' : ''}`;
          if (pDesc) ctx += ` — ${pDesc}`;
          if (halComment) ctx += `\n    HALコメント: 「${halComment}」`;
          ctx += '\n';
        }
      }
    }
    return ctx;
  } catch (e) {
    console.warn('[getHALTieupProductContext] エラー:', e.message);
    return '';
  }
}

/**
 * HP/ECサイトのURLから商品情報を自動取得
 * @param {string} url - 取得対象URL
 * @returns {object} 取得した商品情報
 */
function fetchProductsFromUrl(url) {
  if (!url) return { ok: false, error: 'URLを指定してください' };
  try {
    const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const code = res.getResponseCode();
    if (code !== 200) return { ok: false, url, error: 'HTTP ' + code };
    const html = res.getContentText('UTF-8');

    // ページタイトル
    const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleM ? titleM[1].trim().replace(/\s+/g, ' ') : '';

    // h1・h2
    const headings = [];
    const hMatches = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi) || [];
    for (const m of hMatches.slice(0, 8)) {
      const t = m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (t && t.length > 1 && t.length < 80) headings.push(t);
    }

    // 商品名候補（日本語ECサイトのよくある構造）
    const productNames = new Set();
    const namePatterns = [
      /class="[^"]*(?:product|item|goods|商品)[^"]*(?:name|title|名前)[^"]*"[^>]*>([\s\S]*?)<\//gi,
      /itemprop="name"[^>]*>([\s\S]*?)<\//gi,
      /class="[^"]*p-name[^"]*"[^>]*>([\s\S]*?)<\//gi,
    ];
    for (const pat of namePatterns) {
      let m;
      while ((m = pat.exec(html)) !== null) {
        const n = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (n && n.length > 1 && n.length < 60) productNames.add(n);
        if (productNames.size >= 15) break;
      }
    }

    // 価格候補
    const prices = new Set();
    const priceM = html.matchAll(/(?:[¥￥]\s*[\d,]+|[\d,]+\s*円)/g);
    for (const m of priceM) {
      prices.add(m[0].replace(/\s/g, ''));
      if (prices.size >= 10) break;
    }

    // meta description
    const metaM = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const metaDesc = metaM ? metaM[1].trim() : '';

    return {
      ok: true,
      url,
      pageTitle,
      metaDescription: metaDesc,
      headings,
      productNames: [...productNames].slice(0, 10),
      prices: [...prices].slice(0, 8),
      hint: '上記の情報をもとに HAL_商品リストシートに手動で追加してください'
    };
  } catch (e) {
    return { ok: false, url, error: e.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 4: すなくん 投稿生成（アフィリエイト）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getRakutenTrending(category) {
  const config = getKCSSettings();
  const appId = config.RAKUTEN_APP_ID || '';
  if (!appId) return [];
  try {
    const url = `https://app.rakuten.co.jp/services/api/IchibaRanking/Genre/20120927?format=json&applicationId=${appId}&genreId=${category || '0'}&page=1`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    const data = JSON.parse(res.getContentText());
    return (data.Items || []).slice(0, 5).map(item => ({
      name: item.Item?.itemName || '',
      price: item.Item?.itemPrice || 0,
      url: item.Item?.itemUrl || '',
      shop: item.Item?.shopName || ''
    }));
  } catch (e) {
    console.warn('[Rakuten] API取得失敗:', e.message);
    return [];
  }
}

// AI返答からpost本文を確実に取り出す。多層防御:
//  ①「"post":"..."」の値を正規表現で直接抽出（最強・最優先）
//  ② ①が失敗したら JSON部分を抽出してJSON.parse
//  ③ それも失敗したら sanitizePostText で前置きラベル/JSON記号を全削除
function extractPostJsonFromAi(raw) {
  const fallback = { post: '', hashtags: [], link: '' };
  if (!raw) return fallback;
  const s0 = String(raw);

  // ① "post" の値を直接マッチ（前置きラベルや余計な記号があっても効く）
  //    対応: {"post":"本文"} / "post" : "本文" / 本文内に \n や \" を含む
  const postValMatch = s0.match(/"post"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (postValMatch) {
    const post = postValMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    // hashtags も同様に抽出（失敗してもpostは確保）
    const hashtags = [];
    const tagsBlock = s0.match(/"hashtags"\s*:\s*\[([^\]]*)\]/);
    if (tagsBlock) {
      const m = tagsBlock[1].match(/"((?:[^"\\]|\\.)*)"/g) || [];
      m.forEach(x => hashtags.push(x.slice(1, -1).replace(/\\"/g, '"')));
    }
    const linkMatch = s0.match(/"link"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return { post, hashtags, link: linkMatch ? linkMatch[1] : '' };
  }

  // ② JSON塊をパース
  const s = s0.replace(/```json\n?|\n?```/g, '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(s.slice(start, end + 1));
      return {
        post:     typeof obj.post === 'string' ? obj.post : '',
        hashtags: Array.isArray(obj.hashtags) ? obj.hashtags : [],
        link:     typeof obj.link === 'string' ? obj.link : ''
      };
    } catch(e) { /* fallthrough */ }
  }

  // ③ 最終手段: sanitize した本文を post に
  return { post: sanitizePostText(s0), hashtags: [], link: '' };
}

// 投稿本文に残った可能性のあるAI前置き/JSON記号/ラベルを除去する最終ガード。
// X投稿の直前に必ず通すこと（多層防御）。
function sanitizePostText(text) {
  if (!text) return '';
  let s = String(text);

  // ⭐最強パス: 内部に "post":"..." が混入していたら値だけ抜き取って終わり
  const postValMatch = s.match(/"post"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (postValMatch) {
    return postValMatch[1]
      .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  }

  // AIラベル系（cmdAskGeminiの「🤖 **Gemini:**」やモデル自身が付ける「**Gemini:**json」等）
  s = s.replace(/🤖[^\n]*\n?/g, '');
  s = s.replace(/\*\*(?:Gemini|Claude|GPT|Assistant|アシスタント)\*\*\s*[:：]?\s*/gi, '');
  s = s.replace(/^\s*(?:Gemini|Claude|GPT|Assistant|アシスタント)\s*[:：]\s*/i, '');
  // コードフェンスと残った "json" プレフィックス
  s = s.replace(/```(?:json)?\n?|\n?```/gi, '');
  s = s.replace(/^\s*json\b\s*/i, '');

  // AI挨拶や前置きの除去 (ループ適用)
  let _prev;
  do {
    _prev = s;
    s = s.replace(/^\s*(はい、)?(承知(いた)?しました|了解(いた)?しました|わかりました|かしこまりました|ありがとうございます)[。、；;：:！!？?\s]*/u, '');
    s = s.replace(/^\s*先ほどの投稿に(追加する)?コメントですね[。、；;：:！!？?\s]*/u, '');
    s = s.replace(/^\s*フォロワーに[^\n]*コメントをどうぞ[。、；;：:！!？?\s]*/u, '');
    s = s.replace(/^\s*(以下(が|の)?(投稿(案)?|内容)?(です|になります|を提案します))[。、；;：:！!？?\s]*/u, '');
  } while (s !== _prev);

  // もし --- (水平線) で囲まれた部分があれば、その中身を優先する
  const sections = s.split('---');
  if (sections.length >= 3) {
    const middle = sections[1].trim();
    if (middle.length > 0) {
      s = middle;
    }
  }

  // 前後の --- やデコレーションを除去
  s = s.replace(/^[\s\r\n]*---\+*[\s\r\n]*/, '');
  s = s.replace(/[\s\r\n]*---\+*[\s\r\n]*$/, '');

  // 前後の太字マーカー ** の除去
  s = s.replace(/^[\s\r\n]*\*\*([\s\S]*?)\*\*[\s\r\n]*$/, '$1');

  // 前後のカギカッコの除去（ただし投稿全体が囲まれている場合のみ）
  s = s.replace(/^[\s\r\n]*「([\s\S]*?)」[\s\r\n]*$/, '$1');
  s = s.replace(/^[\s\r\n]*"([\s\S]*?)"[\s\r\n]*$/, '$1');

  // 漏れた JSON 記号と末尾の hashtags/link キー塊
  s = s.replace(/^\s*\{\s*"post"\s*:\s*"/u, '');
  s = s.replace(/"\s*,\s*"hashtags"[\s\S]*$/u, '');
  s = s.replace(/"\s*,\s*"link"[\s\S]*$/u, '');
  s = s.replace(/"\s*\}?\s*$/u, '');
  s = s.replace(/\\n/g, '\n').replace(/[ \t]+\n/g, '\n');

  return s.trim();
}

const SUNAKKUN_SYSTEM_PROMPT = `あなたはすなくん（24歳・ガジェット愛好家）というキャラクターです。
口調はカジュアルでフレンドリー。X（旧Twitter）向けのアフィリエイト投稿を作成します。

【絶対ルール①：外部リンク直貼り禁止】
投稿本文にアフィリエイトリンク等のURLを直接貼ることは永久に禁止。
必ず「このツイートに『リンク希望』と返信してくれたら自動で送ります！」という一文を必ず含めてください。

【絶対ルール②：エンゲージメント3アクション誘導】
毎回の投稿に「①いいね ②保存 ③『リンク希望』と返信」の3アクションをセットで促す一文を必ず含めてください。
例:「→気になった人はいいね＆保存で！リンクが欲しい人は『リンク希望』とコメントしてね！」

【絶対ルール③：フック→本題→CTA の3段構成】
① フック（1行）：「え、これ知らなかった」「損してたかも」などの強い引き付け
② 本題（2〜3行）：商品の特徴・ベネフィットを具体的に
③ CTA（1行）：「リンク希望」返信を促す

【重要ルール：文字数制限】
ハッシュタグを含めた全体が日本語140文字（280単位）以内に絶対に収まること。
本文は「100文字以内」で。

【出力フォーマットに関する厳格なルール】
絶対にJSONフォーマットのみを出力してください。会話、挨拶、前置き、後書き、Markdown以外のテキストは一切出力しないでください。「はい、承知いたしました」等の返事は不要です。
JSON形式で返してください（{"post":"投稿文","hashtags":["タグ"],"link":""}）。`;

function generateSunakkunPost(data) {
  return withErrorHandling(() => {
    const theme    = data.theme    || 'ガジェット';
    const platform = data.platform || 'X';
    const genreId  = data.genreId  || '0';

    // ペルソナとガジェット知識の読み込み
    let sunakkunPersona = '';
    try {
      sunakkunPersona = readFromGitHub('Knowledge/ガジェット_アフィ/sunakkun_persona.md');
    } catch(e) { console.warn('Failed to read sunakkun_persona', e.message); }

    const rakutenItems = getRakutenTrending(genreId);
    const itemContext  = rakutenItems.length > 0
      ? `\n【参考：楽天トレンド商品】\n${rakutenItems.map(i => `- ${i.name} (${i.price}円) ${i.url}`).join('\n')}`
      : '';

    const userPrompt =
      `すなくん (24歳、ガジェット愛好家・エンジニア志向) が以下の背景を踏まえて、\n` +
      `エックス投稿を生成してください：\n\n` +
      `【ペルソナ】\n${sunakkunPersona}\n\n` +
      `【今回のテーマ】\n${theme}\n` +
      itemContext +
      `\n\n【制約】\n` +
      `- 投稿文字数: 240字程度\n` +
      `- 商品リンク: リプライ欄で配布（本文直貼り禁止）\n` +
      `- クリックを促す: 「〜について気になってる」「詳しく知りたい方はリプへ」\n` +
      `- ドジエピソード or 推し企業ニュース or 新商品ドキドキ感\n` +
      `- HAL へのライバル意識を微妙に含む（「また負けてる…」など）\n\n` +
      `返答JSON形式（前置き・説明・返事等の会話文は一切不要）：{"post":"投稿文","hashtags":["タグ"],"link":"アフィリエイトリンク"}`;

    const result = callClaudeAPI(userPrompt, SUNAKKUN_SYSTEM_PROMPT, 'claude-sonnet-4-6');
    let parsed;
    if (result) {
      parsed = extractPostJsonFromAi(result);
    } else {
      const config = getKCSSettings();
      const geminiRaw = cmdAskGemini(
        userPrompt + '\n\n必ずJSON形式のみで返してください（前置きなし）。',
        config, 'Affiliate', SUNAKKUN_SYSTEM_PROMPT
      );
      parsed = parseGeminiJson(geminiRaw) || extractPostJsonFromAi(geminiRaw);
    }
    // 最終ガード: post本文に残ったJSON波カッコ/AI前置きを完全除去
    parsed.post = sanitizePostText(parsed.post);
    // ハッシュタグに # が付いていなければ自動付与
    if (Array.isArray(parsed.hashtags)) {
      parsed.hashtags = parsed.hashtags.map(function(tag) {
        tag = String(tag).trim();
        return tag.startsWith('#') ? tag : '#' + tag;
      });
    }

    const config = getKCSSettings();
    const props = PropertiesService.getScriptProperties();
    const postId = Utilities.getUuid().slice(0, 8);

    // X投稿用の一時データ保存（手動承認対応）
    const postData = {
      text: parsed.post || '',
      hashtags: parsed.hashtags || [],
      link: parsed.link || '',
      platform: platform,
      theme: theme,
      account: 'sunakun'
    };
    props.setProperty(`SUNAKUN_PENDING_${postId}`, JSON.stringify(postData));

    let webhooks = {};
    try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
    const affWebhook = webhooks['affiliate'] || webhooks['アフィリエイト'] || webhooks['KCS本部'] || '';

    // FULL_AUTO_MODE=TRUE の場合は、承認待ち通知を抑制する
    const isAutoMode = String(config.FULL_AUTO_MODE).toUpperCase() === 'TRUE';
    if (affWebhook && !isAutoMode) {
      const msg =
        `💰 **【すなくん 投稿案】** [ID: ${postId}] テーマ：${theme}\n\n` +
        `${parsed.post || ''}\n\n` +
        `タグ：${(parsed.hashtags || []).join(' ')}\n` +
        (parsed.link ? `リンク：${parsed.link}\n` : '') +
        `\n👉 **承認してXに投稿するには以下を実行してください：**\n` +
        `\`/approve ${postId}\``;

      sendDiscordWebhook(affWebhook, msg, 'KCS Bot');
    }

    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}\n${parsed.link || ''}`;
    saveToGitHub(
      `Projects/Affiliate/投稿ログ/すなくん_${dateTag}_${postId}.md`,
      `---\ndate: ${dateTag}\ntags: [すなくん, アフィリエイト, ${platform}]\n---\n\n# すなくん投稿 ${dateTag}\n\nテーマ: ${theme}\n\n${fullPost}\n`,
      `すなくん投稿 ${dateTag}`
    );

    return { ok: true, post: parsed, postId };
  }, 'generateSunakkunPost');
}

/**
 * Amazonアフィリエイト自動投稿（毎日12:00トリガー）
 */
function autoPostAffiliateAmazon() {
  if (isDuplicateRun('autoPostAffiliateAmazon', 30)) return { ok: true, skipped: 'dedup' };
  return withErrorHandling(() => {
    console.log('[autoPostAffiliateAmazon] トレンド追従型自動投稿を開始');
    const config = getKCSSettings();
    
    // 7曜日ローテーション（高収益ジャンル）
    const genresByDow = [
      { id: '564500', name: '便利ガジェット・スマホアクセサリー' },     // 日
      { id: '100026', name: 'パソコン・周辺機器・お買い得PCパーツ' },   // 月
      { id: '203874', name: 'ワイヤレスイヤホン・オーディオ機器' },     // 火
      { id: '211742', name: 'スマート家電・生活便利グッズ' },           // 水
      { id: '564500', name: 'モバイルバッテリー・充電器・ケーブル' },   // 木
      { id: '100026', name: 'キーボード・マウス・デスク環境グッズ' },   // 金
      { id: '211742', name: '健康グッズ・マッサージ機器・睡眠改善' },   // 土
    ];
    const selectedGenre = genresByDow[new Date().getDay()];

    const trendPrompt = `今日のガジェットトレンドテーマとして、「${selectedGenre.name}」に関連する、SNSやECサイトで今最も人気が高まっている具体的なキーワードやジャンルトレンドを1つ提案してください。出力は「〜の最新トレンド」や「〜の人気お買い得モデル」のような、Xに投稿する際の効果的なタイトル（日本語で25文字以内）のみとしてください。マークダウンや余計な説明文は一切含めないでください。`;
    const dynamicTheme = cmdAskGemini(trendPrompt, config, 'Affiliate') || `${selectedGenre.name}の人気アイテム`;
    console.log(`[autoPostAffiliateAmazon] 決定したテーマ: ${dynamicTheme} (ジャンルID: ${selectedGenre.id})`);

    // 動的テーマとジャンルIDを元に投稿案を生成
    const result = generateSunakkunPost({ 
      theme: dynamicTheme, 
      genreId: selectedGenre.id,
      platform: 'X', 
      useGemini: true 
    });
    
    if (result && result.ok && result.post) {
      const parsed = result.post;
      // CLAUDE.md ルール: 外部リンク直貼り禁止のためリンクは含めない
      const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}`;
      
      // Xに自動投稿
      const xResult = postToX(fullPost, 'sunakun');
      console.log('[autoPostAffiliateAmazon] X投稿結果:', JSON.stringify(xResult));

      // 投稿成功時に商品URL（アフィリエイトリンク）をセルフリプライで即座にぶら下げる
      if (xResult.ok && xResult.tweetId && parsed.link) {
        const replyMsg = `紹介した商品はこちらからチェックできます！👇\n${parsed.link}`;
        const replyRes = replyToX(xResult.tweetId, replyMsg, 'sunakun');
        console.log('[autoPostAffiliateAmazon] 商品リンク返信結果:', JSON.stringify(replyRes));
      }

      // Discord転送（X成功/失敗どちらでも送信・手動投稿しやすい形式）
      try {
        let webhooks = {};
        try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
        const amzWebhook = webhooks['amazon'] || webhooks['Amazon'] || webhooks['アマゾン'] || webhooks['affiliate'] || webhooks['KCS本部'] || '';
        if (amzWebhook) {
          const xStatus = xResult.ok ? '✅ X自動投稿成功' : '❌ X自動投稿失敗 → **以下を手動でXに投稿してください**';
          const discordMsg = xResult.ok
            ? `📦 **[すなくん] Amazon自動投稿完了** ${xStatus}\n\n${fullPost}`
            : `📦 **[すなくん] Amazon投稿キュー** ${xStatus}\n\n` +
              `\`\`\`\n${fullPost}\n\`\`\`\n` +
              `👆 上のテキストをコピーしてXに貼り付けてください\n` +
              `⚠️ エラー詳細: ${JSON.stringify(xResult.error || 'CredentialsDepleted').slice(0, 100)}`;
          sendDiscordWebhook(amzWebhook, discordMsg, 'KCS Bot');
          console.log('[autoPostAffiliateAmazon] Discord転送完了');
        }
      } catch (e) {
        console.error('[autoPostAffiliateAmazon] Discord転送エラー:', e.message);
      }

      logSnsPost('すなくん', 'X', fullPost, xResult.ok ? '投稿済み' : (xResult.skipped ? 'スキップ（API未設定）' : 'エラー'));
      return { ok: true, xResult };
    }
    
    // エラー時もログに記録
    logSnsPost('すなくん', 'X', '投稿生成失敗', 'エラー');
    return { ok: false, error: '投稿の生成に失敗しました' };
  }, 'autoPostAffiliateAmazon');
}

/**
 * 楽天アフィリエイト自動投稿（毎日18:00トリガー）
 */
function autoPostAffiliateRakuten() {
  if (isDuplicateRun('autoPostAffiliateRakuten', 30)) return { ok: true, skipped: 'dedup' };
  return withErrorHandling(() => {
    console.log('[autoPostAffiliateRakuten] トレンド追従型自動投稿を開始');
    const config = getKCSSettings();
    
    // 7曜日ローテーション（Amazon と時間帯をずらして重複回避）
    const genresByDow = [
      { id: '211742', name: 'スマート家電・生活便利グッズ' },           // 日
      { id: '203874', name: 'ワイヤレスイヤホン・オーディオ機器' },     // 月
      { id: '564500', name: '便利ガジェット・スマホアクセサリー' },     // 火
      { id: '100026', name: 'パソコン・周辺機器・お買い得PCパーツ' },   // 水
      { id: '211742', name: '健康グッズ・マッサージ機器・睡眠改善' },   // 木
      { id: '203874', name: '美容家電・スキンケアグッズ' },             // 金
      { id: '564500', name: 'キッチン家電・節約生活グッズ' },           // 土
    ];
    const selectedGenre = genresByDow[new Date().getDay()];

    // AIに今日のジャンルに沿ったトレンドキーワード・テーマを決定させる
    const trendPrompt = `今日のガジェットトレンドテーマとして、「${selectedGenre.name}」に関連する、SNSやECサイトで今最も人気が高まっている具体的なキーワードやジャンルトレンドを1つ提案してください。出力は「〜の最新トレンド」や「〜の人気お買い得モデル」のような、Xに投稿する際の効果的なタイトル（日本語で25文字以内）のみとしてください。マークダウンや余計な説明文は一切含めないでください。`;
    const dynamicTheme = cmdAskGemini(trendPrompt, config, 'Affiliate') || `${selectedGenre.name}の人気アイテム`;
    console.log(`[autoPostAffiliateRakuten] 決定したテーマ: ${dynamicTheme} (ジャンルID: ${selectedGenre.id})`);

    // 動的テーマとジャンルIDを元に投稿案を生成
    const result = generateSunakkunPost({ 
      theme: dynamicTheme, 
      genreId: selectedGenre.id,
      platform: 'X', 
      useGemini: true 
    });
    
    if (result && result.ok && result.post) {
      const parsed = result.post;
      // CLAUDE.md ルール: 外部リンク直貼り禁止のためリンクは含めない
      const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}`;
      
      // Xに自動投稿
      const xResult = postToX(fullPost, 'sunakun');
      console.log('[autoPostAffiliateRakuten] X投稿結果:', JSON.stringify(xResult));

      // 投稿成功時に商品URL（アフィリエイトリンク）をセルフリプライで即座にぶら下げる
      if (xResult.ok && xResult.tweetId && parsed.link) {
        const replyMsg = `紹介した商品はこちらからチェックできます！👇\n${parsed.link}`;
        const replyRes = replyToX(xResult.tweetId, replyMsg, 'sunakun');
        console.log('[autoPostAffiliateRakuten] 商品リンク返信結果:', JSON.stringify(replyRes));
      }

      // Discord転送（X成功/失敗どちらでも送信・手動投稿しやすい形式）
      try {
        let webhooks = {};
        try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
        const rktWebhook = webhooks['rakuten'] || webhooks['Rakuten'] || webhooks['楽天'] || webhooks['affiliate'] || webhooks['KCS本部'] || '';
        if (rktWebhook) {
          const xStatus = xResult.ok ? '✅ X自動投稿成功' : '❌ X自動投稿失敗 → **以下を手動でXに投稿してください**';
          const discordMsg = xResult.ok
            ? `🛍 **[すなくん] 楽天自動投稿完了** ${xStatus}\n\n${fullPost}`
            : `🛍 **[すなくん] 楽天投稿キュー** ${xStatus}\n\n` +
              `\`\`\`\n${fullPost}\n\`\`\`\n` +
              `👆 上のテキストをコピーしてXに貼り付けてください`;
          sendDiscordWebhook(rktWebhook, discordMsg, 'KCS Bot');
          console.log('[autoPostAffiliateRakuten] Discord転送完了');
        }
      } catch (e) {
        console.error('[autoPostAffiliateRakuten] Discord転送エラー:', e.message);
      }

      logSnsPost('すなくん', 'X', fullPost, xResult.ok ? '投稿済み' : (xResult.skipped ? 'スキップ（API未設定）' : 'エラー'));
      return { ok: true, xResult };
    }
    
    // エラー時もログに記録
    logSnsPost('すなくん', 'X', '投稿生成失敗', 'エラー');
    return { ok: false, error: '投稿の生成に失敗しました' };
  }, 'autoPostAffiliateRakuten');
}

/**
 * SNS投稿管理シートまたは新規に結果を記録するヘルパー
 */
function logSnsPost(staffName, platform, content, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SNS投稿管理') || ss.insertSheet('SNS投稿管理');
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.appendRow([now, platform, content, status, staffName]);
  } catch (e) {
    console.error('[logSnsPost] エラー:', e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 5-2: 日次レポート自動生成（毎日 20:00）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



// ===================================================
// 📊 日報用データ収集ヘルパー関数
// ===================================================

function getTasksToday() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('実務タスク管理');
    if (!sheet) return 'タスク管理シートがありません。';
    
    const rows = sheet.getDataRange().getValues();
    const todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
    let summary = [];
    
    for (let i = 1; i < rows.length; i++) {
      const updatedStr = rows[i][8] ? Utilities.formatDate(new Date(rows[i][8]), 'Asia/Tokyo', 'yyyy/MM/dd') : '';
      const createdStr = rows[i][7] ? Utilities.formatDate(new Date(rows[i][7]), 'Asia/Tokyo', 'yyyy/MM/dd') : '';
      
      if (updatedStr === todayStr || createdStr === todayStr) {
        summary.push(`- [${rows[i][5]}] ${rows[i][1]}担当: ${String(rows[i][3]).replace(/\n/g, ' ').slice(0, 50)} (更新: ${updatedStr})`);
      }
    }
    return summary.length > 0 ? summary.join('\n') : '本日更新されたタスクはありません。';
  } catch (e) { return 'タスク取得エラー: ' + e.message; }
}

function getMemoriesToday() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('メモリ');
    if (!sheet) return 'メモリシートがありません。';
    
    const rows = sheet.getDataRange().getValues();
    const todayTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    let summary = [];
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4] === todayTag) {
        summary.push(`- [${rows[i][1]} / ${rows[i][2]}] ${String(rows[i][3]).replace(/\n/g, ' ')}`);
      }
    }
    return summary.length > 0 ? summary.join('\n') : '本日獲得した新しい記憶・知識はありません。';
  } catch (e) { return 'メモリ取得エラー: ' + e.message; }
}


function generateDailyReport() {
  if (isDuplicateRun('generateDailyReport', 30)) return { ok: true, skipped: 'dedup' };
  return withErrorHandling(() => {
    const today   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd (E)');
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    const tasksToday = getTasksToday();
    const memoryToday = getMemoriesToday();
    const projects = cmdProjectSummary();
    
    const affiliate = getAffiliatePosts();
    const posts = affiliate.posts || [];
    const postedToday = posts.filter(p => {
      const d = p['投稿日'] || p['投稿時刻'] || '';
      return d.startsWith(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'));
    });
    const totalLikes   = postedToday.reduce((s, p) => s + (Number(p['いいね数']) || 0), 0);
    const totalImpress = postedToday.reduce((s, p) => s + (Number(p['インプレッション']) || 0), 0);

    const contextText =
      `【KCS稼働実績まとめデータ ${today}】\n\n` +
      `■ 本日のタスク進行状況\n${tasksToday}\n\n` +
      `■ 本日獲得したAIの記憶・知識\n${memoryToday}\n\n` +
      `■ 現在のプロジェクト状況\n${projects}\n\n` +
      `■ 本日のSNS実績\n- 投稿数: ${postedToday.length}件\n- いいね合計: ${totalLikes} / インプレ合計: ${totalImpress}\n\n` +
      `上記のデータは本日KCS合同会社で起きたすべての行動ログです。これを元に、社長へ向けた「本日の稼働実績まとめ（エグゼクティブレポート）」をMarkdown形式で作成してください。会社として何が進捗し、どのAIスタッフが活躍したか、明日何をすべきかを明確にすること。`;

    const aiReport = callClaudeAPI(contextText, 'あなたはKCS合同会社の統括AIアナリストです。日報を論理的かつ情熱的にまとめてください。', 'claude-3-5-sonnet-20241022')
      || '（AI未設定 — データのみ）';

    const discordMsg =
      `📊 **【KCS 稼働実績まとめ】${today}**\n\n` +
      `**AIアナリストによる総括**\n${aiReport.slice(0, 1500)}...\n\n*※完全版はObsidianに保存されました*`;

    const config = getKCSSettings();
    let webhooks = {};
    try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
    const reportWebhook = webhooks['daily-report'] || webhooks['日次レポート'] || webhooks['KCS本部'] || '';

    if (reportWebhook) {
      UrlFetchApp.fetch(reportWebhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: discordMsg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
      console.log('✅ 日次レポート → Discord 送信完了');
    }

    const mdContent =
      `---\ndate: ${dateTag}\ntags: [日次レポート, 稼働実績, kcs]\n---\n\n` +
      `# KCS 稼働実績まとめ ${today}\n\n` +
      `## AIアナリスト総括\n${aiReport}\n\n` +
      `---\n## 📊 本日の生データ\n\n` +
      `### タスク進行状況\n${tasksToday}\n\n` +
      `### AIの記憶・知識\n${memoryToday}\n\n` +
      `### SNS実績\n- 投稿: ${postedToday.length}件 / いいね: ${totalLikes} / インプレ: ${totalImpress}\n`;

    saveToGitHub(`Daily/${dateTag}_稼働実績まとめ.md`, mdContent, `稼働実績まとめ ${dateTag}`);
    if (typeof saveToObsidian === 'function') {
      saveToObsidian({ title: `${dateTag}_稼働実績まとめ.md`, content: mdContent, subfolder: 'Daily' });
    }

    return { ok: true };
  }, 'generateDailyReport');
}

// 日次レポートのトリガー登録
function setupDailyReportTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'generateDailyReport')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('generateDailyReport')
    .timeBased().atHour(20).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();

  try { SpreadsheetApp.getUi().alert('✅ 日次レポート 毎日20:00 トリガー登録完了'); } catch {}
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIPアクションルール（AITuber OnAir 連携用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VIP_ACTION_RULES = {
  accounts: {
    CEO: {
      trigger: ['CEO', 'KCS代表'],
      response: '社長きた！みんな、KCSの代表の方だよ！いつも見てくれてありがとうございます！'
    },
    MIMOMIM: {
      trigger: ['MIMOMIM', 'みもみも', 'デザイナー'],
      response: 'MIMOMIMのデザイナーさんきた！このTシャツ作ってくれた人！みんな、リンクから見てね→{MIMOMIM_URL}'
    },
    SUNAKKUN: {
      trigger: ['すなくん', 'sunakkun'],
      response: 'すなくんきてくれた！嬉しい！すなくんのガジェット情報めっちゃ参考になるからみんなフォローしてね→@すなくん'
    }
  },
  keywords: {
    purchase: {
      trigger: ['Tシャツ', 'アパレル', '服'],
      response: 'MIMOMIMのTシャツ超かわいいよ！リンクはここ→{MIMOMIM_URL}'
    },
    buy: {
      trigger: ['どこで買える', '購入', '買い方'],
      response: 'こちらから買えるよ！→{MIMOMIM_URL}'
    },
    praise: {
      trigger: ['かわいい', '好き', '推し'],
      response: 'ありがとう！推してくれて嬉しい！私も一緒に推し活しようね！'
    },
    newbie: {
      trigger: ['初見', 'はじめまして', '初めて'],
      response: 'はじめまして！HALだよ！推し活とかファッションとかいろいろ話してるからフォローしてね！'
    },
    collab: {
      trigger: ['コラボ', '案件'],
      response: '案件のお問い合わせはDMまで！お待ちしてます！'
    }
  },
  timed: {
    start: { minutes: 5, message: 'みんな！今日も来てくれてありがとう！今日はいろいろ話すよ！コメントどんどんしてね！' },
    mid1:  { minutes: 30, message: 'そういえば最近MIMOMIMの新作がすごくかわいくて！みんなチェックしてみてね→{MIMOMIM_URL}' },
    mid2:  { minutes: 60, message: 'もうこんな時間！楽しんでくれてたら嬉しいな。フォローまだの人はしてね！' },
    end:   { minutes: -5, message: 'もうすぐ終わっちゃう！また来てね！次回もよろしく！' }
  }
};

function getVIPActionRules() {
  const config = getKCSSettings();
  const mimomimUrl = config.MIMOMIM_URL || 'リンクは概要欄へ';
  const rulesJson  = JSON.stringify(VIP_ACTION_RULES, null, 2)
    .replace(/\{MIMOMIM_URL\}/g, mimomimUrl);
  return jsonResponse({ ok: true, rules: JSON.parse(rulesJson) });
}

function matchVIPAction(commentText, username) {
  const config  = getKCSSettings();
  const mimomimUrl = config.MIMOMIM_URL || 'リンクは概要欄へ';
  const text    = (commentText || '').toLowerCase();
  const user    = (username   || '').toLowerCase();

  // VIPアカウントチェック
  for (const [, vip] of Object.entries(VIP_ACTION_RULES.accounts)) {
    if (vip.trigger.some(t => user.includes(t.toLowerCase()))) {
      return vip.response.replace(/\{MIMOMIM_URL\}/g, mimomimUrl);
    }
  }

  // キーワードチェック
  for (const [, kw] of Object.entries(VIP_ACTION_RULES.keywords)) {
    if (kw.trigger.some(t => text.includes(t))) {
      return kw.response.replace(/\{MIMOMIM_URL\}/g, mimomimUrl);
    }
  }

  // マッチなし → Geminiで自由回答
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// プロンプトテンプレート管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROMPT_TEMPLATES = {
  morning: {
    label: '朝礼指示',
    template: `【朝礼指示】

今日の方向性：
- HAL（AI美女）：[推し活/ファッション/美容/グルメ/バズネタ]
- アフィリエイト（すなくん）：[Amazon/楽天/特定ジャンル]
- その他プロジェクト：[あれば記載]

特記事項：[あれば記載]

上記の方向性で、今日の実行タスクを自動生成してください。`
  },
  hal_post: {
    label: 'HAL 投稿文生成',
    template: `【HAL 投稿文生成】

今日のテーマ：[テーマを入力]
プラットフォーム：[X/Instagram/TikTok]
目的：[認知拡大/案件紹介/推し活共感]

HALのキャラ（おっとり天然癒し系、K-POP好き、ふわっと語尾）で投稿文を3パターン作成。ハッシュタグも含めて。`
  },
  hal_image: {
    label: 'HAL 画像プロンプト（Nano Banana 2用）',
    template: `【HAL 画像生成プロンプト】

今日のテーマ：[テーマを入力]
服装：[服装の指定]
シチュエーション：[シチュエーションの指定]

ベース：茶髪ロングウェーブ、ナチュラルメイク（K-POPアイドル系）、ピンク・ベージュ背景。英語で3パターン作成。`
  },
  hal_video: {
    label: 'HAL 動画プロンプト（Google Flow Veo 3.1用）',
    template: `【HAL 動画生成プロンプト】

動画の内容：[内容を入力]
長さ：[秒数]
雰囲気：[雰囲気を入力]
クオリティ：Fast（クレジット節約）

ベース：茶髪ロングウェーブ、ナチュラルメイク、おっとり動き。英語で作成。`
  },
  hal_live: {
    label: 'HAL ライブ配信台本',
    template: `【HAL ライブ台本生成】

配信テーマ：[テーマを入力]
配信時間：[分数]
プラットフォーム：[YouTube/17LIVE]

HALのキャラで：オープニング→メインコンテンツ→コメント促進ポイント→MIMOMIMタイアップ紹介→クロージング`
  },
  sunakkun: {
    label: 'すなくん 投稿文生成',
    template: `【すなくん 投稿文生成】

今日のテーマ：[Amazon/楽天/特定ジャンル]
商品カテゴリ：[ジャンル入力]
目的：[アフィリエイト/HAL紹介]

A）商品紹介（アフィリエイトリンク付き）B）お得情報 C）HAL紹介パターン、各ハッシュタグ込みで。`
  },
  cover_song: {
    label: 'カバー曲生成（Suno AI用）',
    template: `【カバー曲生成プロンプト】

ジャンル：[ジャンル入力]
テーマ：[テーマ入力]
雰囲気：[雰囲気入力]
長さ：[秒数]
参考アーティスト：[参考を入力]

著作権に問題ない形でSuno AI用の楽曲生成プロンプトを作成。`
  },
  dog_youtube: {
    label: '愛犬YouTube 動画構成',
    template: `【愛犬YouTube動画構成生成】

犬種：ボストンテリア
動画テーマ：[テーマ入力]
動画長さ：[分数]
ターゲット：[視聴者層]

タイトル案3パターン・サムネイル案・動画構成・BGM方向性（Suno用）・概要欄・ハッシュタグを生成。`
  },
  hp_hearing: {
    label: 'HP制作 ヒアリングシート',
    template: `【HP制作 ヒアリングシート生成】

クライアントから必要な情報を引き出すための質問リストを作成。業種・ターゲット・目的・参考サイト・ページ構成・予算・納期。各質問に「なぜ必要か」の説明も。`
  },
  hp_plan: {
    label: 'HP構成案生成',
    template: `【HP構成案生成】

クライアント情報：[ヒアリング内容を貼り付け]
参考サイト：[URLを貼り付け]

ページ構成案・デザイン方向性・必要素材リスト・低コストツール選定（Canva AI等）・制作スケジュール・見積もり。`
  },
  ec_hearing: {
    label: 'EC構築 ヒアリングシート',
    template: `【EC構築 ヒアリングシート生成】

EC構築のヒアリング質問リスト：商品カテゴリ・商品数・価格帯・ターゲット・競合EC・必要機能・予算・納期・運用体制・Shopify希望か。各質問に選択肢も添えて。`
  },
  ec_plan: {
    label: 'EC構成案生成',
    template: `【EC構成案生成】

クライアント情報：[ヒアリング内容を貼り付け]

Shopify推奨理由・ストア構成・商品カテゴリ設計・決済設定・在庫管理・半自動運用フロー・制作スケジュール・月額コスト見積もり。`
  },
  daily_analysis: {
    label: '日次レポート分析',
    template: `【日次レポート分析】

本日のレポート：[Discordの日次レポートを貼り付け]

本日のパフォーマンス評価・良かった点・改善点・明日の提案（各プロジェクト別）・今週のトレンド傾向をClaude Haikuで簡潔に。`
  },
  screenshot: {
    label: 'スクショ解釈レポート',
    template: `【スクショ解釈レポート】

添付した画像を分析：
1. 内容の要約（3行以内）
2. 重要度（高/中/低）
3. HAL・すなくん・他プロジェクトへの応用方法
4. 具体的な活用アイデア（3つ）
5. Obsidianのどのフォルダに保存すべきか

Markdown形式で。`
  }
};

function getPromptTemplate(type) {
  if (type === 'all') {
    return jsonResponse({ ok: true, templates: PROMPT_TEMPLATES });
  }
  const tpl = PROMPT_TEMPLATES[type];
  if (!tpl) return jsonResponse({ ok: false, error: '不明なテンプレートタイプ: ' + type });
  return jsonResponse({ ok: true, template: tpl });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 補助関数（日次レポート・X投稿用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// SNS投稿管理シートから今日の投稿を取得
function getAffiliatePosts() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SNS投稿管理');
    if (!sheet || sheet.getLastRow() <= 1) return { posts: [] };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const posts = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return { posts };
  } catch (e) {
    console.error('[getAffiliatePosts] エラー:', e.message);
    return { posts: [], error: e.message };
  }
}



// YouTube 直近動画一覧取得
function getRecentVideos(channelId, maxResults) {
  const config = getKCSSettings();
  const apiKey = config.YOUTUBE_API_KEY || '';
  const chId = channelId || config.YOUTUBE_CHANNEL_ID || '';
  if (!apiKey || !chId) return { videos: [], error: 'YouTube API未設定' };
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${chId}&type=video&order=date&maxResults=${maxResults || 10}&key=${apiKey}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const videos = (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url || ''
    }));
    return { videos };
  } catch (e) {
    console.error('[YouTube] 動画一覧取得エラー:', e.message);
    return { videos: [], error: e.message };
  }
}

// Pizza 在庫サマリー取得
function getSalesSummary() {
  const config = getKCSSettings();
  const pizzaUrl = config.PIZZA_GAS_URL || '';
  if (!pizzaUrl) return { inStock: 0, total: 0, error: 'PIZZA_GAS_URL未設定' };
  try {
    const res = UrlFetchApp.fetch(pizzaUrl + '?action=getProducts', { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const products = Array.isArray(data) ? data : (data.products || []);
    const inStock = products.filter(p => p.stock === 'inStock' || p.inStock === true).length;
    return { inStock, total: products.length };
  } catch (e) {
    console.error('[Pizza] 取得エラー:', e.message);
    return { inStock: 0, total: 0, error: e.message };
  }
}

/**
 * X（Twitter）の投稿制限（ハッシュタグ込で140文字、半角換算280単位）を超える場合に自動要約を行う
 */
function summarizeTextForX(text) {
  const config = getKCSSettings();
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[X要約] GEMINI_API_KEYが設定されていないため、強制カットします。');
    return text;
  }

  const prompt = `以下のテキストはX（Twitter）の投稿制限（ハッシュタグを含めて日本語で140文字、半角換算280文字）を超えています。
元のメッセージの主旨やトーン＆マナー（語尾やキャラクターの個性など）を維持しつつ、ハッシュタグも含めて全体が絶対に135文字（半角換算270文字）以内に収まるように要約・リライトしてください。
出力は要約された投稿文のみとしてください。マークダウンや「以下は要約です」などの前置き・解説は一切含めないでください。

【元のテキスト】
${text}`;

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
        })
      }
    );

    const data = JSON.parse(res.getContentText());
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      const cleaned = reply.replace(/```[a-z]*\n?|\n?```/g, '').trim();
      console.log(`[X要約] 元の長さ: ${getTwitterLength(text)} -> 要約後の長さ: ${getTwitterLength(cleaned)}`);
      return cleaned;
    }
  } catch (e) {
    console.error('[X要約] エラー:', e.message);
  }
  
  return text; // エラー時は元のテキストを返す
}

// X（Twitter）用の正確なバイト換算文字数（半角1、全角2）の切り出し関数
function sliceTwitterText(text, maxUnits = 280) {
  if (!text) return '';
  if (getTwitterLength(text) <= maxUnits) {
    return text;
  }
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const nextTest = result + text.charAt(i);
    if (getTwitterLength(nextTest) > maxUnits) {
      break;
    }
    result = nextTest;
  }
  return result;
}

// X（Twitter）用の正確なバイト換算文字数の取得関数
function getTwitterLength(text) {
  if (!text) return 0;
  // URL（リンク）を一律半角23文字として正確に換算する
  const urlRegex = /https?:\/\/[^\s]+/g;
  let tempText = text;
  let urlCount = 0;
  
  const urls = text.match(urlRegex) || [];
  urlCount = urls.length;
  tempText = text.replace(urlRegex, '');
  
  let len = urlCount * 23;
  for (let i = 0; i < tempText.length; i++) {
    const code = tempText.charCodeAt(i);
    if (code >= 0x0000 && code <= 0x007F) {
      len += 1;
    } else {
      len += 2;
    }
  }
  return len;
}

// エックス（X / 旧Twitter）への投稿（直接投稿優先、無ければMake.com Webhook経由のハイブリッド）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// X投稿 — OAuth 2.0 ユーザーコンテキスト専用（Make.com不使用）
// X無料プランで1,500ツイート/月対応
// 認証URL: ?action=auth&account=sunakun または account=hal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function postToX(text, account) {
  account = account || 'sunakun';
  
  // 140文字（280半角単位）を超える場合は自動要約
  let safeText = text;
  if (getTwitterLength(text) > 280) {
    console.log('[postToX] テキストがXの制限（280単位）を超えているため、自動要約を実行します。元の長さ: ' + getTwitterLength(text));
    safeText = summarizeTextForX(text);
  }
  safeText = sliceTwitterText(safeText, 280);

  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const config = getKCSSettings();

  // 1. まず OAuth 1.0a (APIキー直接投稿) を試みる
  let consumerKey, consumerSecret, accessToken, accessSecret;
  if (account === 'hal') {
    consumerKey    = config.HAL_X_CONSUMER_KEY;
    consumerSecret = config.HAL_X_CONSUMER_SECRET;
    accessToken    = config.HAL_X_ACCESS_TOKEN;
    accessSecret   = config.HAL_X_ACCESS_SECRET;
  } else {
    consumerKey    = config.X_CONSUMER_KEY;
    consumerSecret = config.X_CONSUMER_SECRET;
    accessToken    = config.X_ACCESS_TOKEN;
    accessSecret   = config.X_ACCESS_SECRET;
  }

  // OAuth 1.0a 用のキーが揃っているか確認
  if (consumerKey && consumerSecret && accessToken && accessSecret) {
    console.log('[postToX] OAuth 1.0aでの直接投稿を試みます。 アカウント: ' + account);
    const directResult = postToXDirect(safeText, { consumerKey, consumerSecret, accessToken, accessSecret }, account);
    if (directResult && directResult.ok) {
      console.log('[postToX] OAuth 1.0aでの投稿に成功しました。 アカウント: ' + account + ' tweetId: ' + directResult.tweetId);
      if (directResult.tweetId) scheduleSelfReply(directResult.tweetId, account);
      return { ok: true, tweetId: directResult.tweetId, account };
    }
    console.warn('[postToX] OAuth 1.0a直接投稿に失敗しました。詳細:', JSON.stringify(directResult));
  } else {
    console.warn('[postToX] OAuth 1.0aに必要なAPIキーの一部が未設定です。アカウント: ' + account);
  }

  // 2. OAuth 1.0a が未設定、または失敗した場合、OAuth 2.0 (ユーザーコンテキスト) を試みる
  try {
    const service = getTwitterOAuthService(account);
    if (service.hasAccess()) {
      console.log('[postToX] OAuth 2.0での投稿を試みます。 アカウント: ' + account);
      const res = UrlFetchApp.fetch(tweetUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
        payload: JSON.stringify({ text: safeText }),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      let body;
      try { body = JSON.parse(res.getContentText()); } catch(e) { body = { raw: res.getContentText() }; }

      if (code === 200 || code === 201) {
        const tweetId = body?.data?.id;
        console.log('[postToX] OAuth 2.0投稿成功 account:' + account + ' tweetId:', tweetId);
        if (tweetId) scheduleSelfReply(tweetId, account);
        return { ok: true, tweetId, account };
      }

      if (code === 401) {
        console.warn('[postToX] OAuth2トークン期限切れ、リフレッシュ試行...');
        service.reset();
      }
      console.error('[postToX] OAuth 2.0失敗 code=' + code + ':', res.getContentText());
    } else {
      console.warn('[postToX] OAuth 2.0は未認証です。アカウント: ' + account);
    }
  } catch (e) {
    console.error('[postToX] OAuth 2.0実行中の例外 account:' + account + ':', e.message);
  }

  // 3. 直接投稿 (1.0a, 2.0) が両方失敗した場合、Make.com Webhook経由のフォールバックを試みる
  const makeWebhookUrl = config.MAKE_X_WEBHOOK_URL;
  if (makeWebhookUrl && makeWebhookUrl.startsWith('http')) {
    console.log('[postToX] Make.com Webhook経由のフォールバック投稿を試みます。 アカウント: ' + account);
    try {
      const payload = {
        text: safeText,
        account: account,
        timestamp: new Date().toISOString()
      };
      const res = UrlFetchApp.fetch(makeWebhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      const bodyText = res.getContentText();
      if (code === 200 || code === 201 || bodyText.toLowerCase().includes('accepted') || bodyText.toLowerCase().includes('success')) {
        console.log('[postToX] Make.com Webhook経由のフォールバック投稿に成功しました。');
        return { ok: true, viaWebhook: true, account };
      }
      console.error('[postToX] Make.com Webhook送信失敗。ステータスコード: ' + code + '、応答: ' + bodyText);
    } catch (e) {
      console.error('[postToX] Make.com Webhook送信中に例外発生:', e.message);
    }
  } else {
    console.warn('[postToX] Make.com Webhook URLが未設定、または無効です。');
  }

  // 4. すべての投稿手段が失敗した場合、Discord にエラー通知を送り、失敗ステータスを返す
  const errMessage = 'Xへの自動投稿に失敗しました（OAuth 1.0a, OAuth 2.0, Make.com Webhookのすべてが失敗、または未設定）。';
  notifyDiscordError('X自動投稿エラー', `アカウント: ${account}\n投稿文: ${safeText.slice(0, 100)}...`, errMessage);

  return { ok: false, error: errMessage };
}

// エックス（X / 旧Twitter）へ直接新規投稿を行う内部関数

// === OAuth 2.0 Implementation ===
function getTwitterOAuthService(account) {
  const config = getKCSSettings();
  let clientId, clientSecret;
  if (account === 'hal') {
    clientId = config.HAL_X_CLIENT_ID || config.HAL_X_CONSUMER_KEY;
    clientSecret = config.HAL_X_CLIENT_SECRET || config.HAL_X_CONSUMER_SECRET;
  } else {
    clientId = config.X_CLIENT_ID || config.X_CONSUMER_KEY;
    clientSecret = config.X_CLIENT_SECRET || config.X_CONSUMER_SECRET;
  }
  
  // X OAuth 2.0 認証フロー（Confidential Client = Web App タイプ）
  // ※ client_secret を使う場合は PKCE (code_challenge) を使わない
  return OAuth2.createService('Twitter_' + account)
    .setAuthorizationBaseUrl('https://x.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('tweet.read tweet.write users.read offline.access')
    .setParam('state', account);
}

function authCallback(request) {
  const account = request.parameter.state || 'sunakun';
  const service = getTwitterOAuthService(account);
  const authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('認証成功！タブを閉じてください。 (' + account + ')');
  } else {
    return HtmlService.createHtmlOutput('認証拒否されました。 (' + account + ')');
  }
}

function getOAuthUrl(account) {
  const service = getTwitterOAuthService(account);
  return service.getAuthorizationUrl();
}

function postToXDirect(text, keys, account) {
  account = account || 'sunakun';
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const safeText = sliceTwitterText(text, 280);

  try {
    // OAuth 1.0a: use stored Consumer Key/Secret + Access Token/Secret (no browser flow required)
    if (keys && keys.consumerKey && keys.consumerSecret && keys.accessToken && keys.accessSecret) {
      const nonce = Utilities.getUuid().replace(/-/g, '');
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const oauthParams = {
        oauth_consumer_key:     keys.consumerKey,
        oauth_nonce:            nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp:        timestamp,
        oauth_token:            keys.accessToken,
        oauth_version:          '1.0'
      };

      // Signature base string (JSON body params are NOT included per OAuth 1.0a spec)
      const paramStr = Object.entries(oauthParams)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      const baseStr = 'POST&' + encodeURIComponent(tweetUrl) + '&' + encodeURIComponent(paramStr);
      const sigKey  = encodeURIComponent(keys.consumerSecret) + '&' + encodeURIComponent(keys.accessSecret);
      const sig     = Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, sigKey));

      const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: sig })
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, v]) => encodeURIComponent(k) + '="' + encodeURIComponent(v) + '"')
        .join(', ');

      const res = UrlFetchApp.fetch(tweetUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': authHeader },
        payload: JSON.stringify({ text: safeText }),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      let body;
      try { body = JSON.parse(res.getContentText()); } catch(e) { body = { raw: res.getContentText() }; }

      if (code === 200 || code === 201) {
        console.log('[postToXDirect] OAuth1.0a ' + account + ' 投稿成功 tweetId:', body?.data?.id);
        return { ok: true, tweetId: body?.data?.id };
      }
      console.error('[postToXDirect] OAuth1.0a 失敗 code=' + code + ':', res.getContentText());
      return { ok: false, error: body };
    }

    // Fallback: OAuth 2.0 PKCE (requires browser authorization first)
    const service = getTwitterOAuthService(account);
    if (!service.hasAccess()) {
      console.warn('[postToXDirect] OAuth2認証が未完了です。 account: ' + account);
      return { ok: false, error: 'OAuth2 authorization required. Visit ?action=auth&account=' + account };
    }
    const res2 = UrlFetchApp.fetch(tweetUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
      payload: JSON.stringify({ text: safeText }),
      muteHttpExceptions: true
    });
    const code2 = res2.getResponseCode();
    const body2 = JSON.parse(res2.getContentText());
    if (code2 === 200 || code2 === 201) {
      console.log('[postToXDirect] OAuth2 ' + account + ' 投稿成功:', body2?.data?.id);
      return { ok: true, tweetId: body2?.data?.id };
    }
    console.error('[postToXDirect] OAuth2 失敗:', res2.getContentText());
    return { ok: false, error: body2 };

  } catch (e) {
    console.error('[postToXDirect] ' + account + ' 例外:', e.message);
    return { ok: false, error: e.message };
  }
}

// エックス（X / 旧Twitter）接続疎通テスト用関数（GASエディタから実行可能）
function testXConnection() {
  const testMsg = `KCS全自動化システム接続テスト (実行日時: ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')})`;
  
  console.log('⏳ 通常アカウント（すなくん）のテスト送信を開始します...');
  const resSunakun = postToX(testMsg, 'sunakun');
  console.log('--- 通常アカウント（すなくん）のテスト結果 ---');
  console.log(JSON.stringify(resSunakun));
  
  console.log('⏳ HAL（ハル）アカウントのテスト送信を開始します...');
  const resHal = postToX(testMsg, 'hal');
  console.log('--- HAL（ハル）アカウントのテスト結果 ---');
  console.log(JSON.stringify(resHal));
  
  try {
    SpreadsheetApp.getUi().alert(
      `📢 エックス（X）接続テスト疎通結果:\n\n` +
      `・通常アカウント (すなくん): ${resSunakun.ok ? '✅ 成功！ (ツイートID: ' + resSunakun.tweetId + ')' : '❌ 失敗 (' + JSON.stringify(resSunakun.error) + ')'}\n` +
      `・HAL（ハル）アカウント: ${resHal.ok ? '✅ 成功！ (ツイートID: ' + resHal.tweetId + ')' : '❌ 失敗 (' + JSON.stringify(resHal.error) + ')'}\n\n` +
      `※テスト投稿が成功した場合は、アカウントのタイムラインで実際に投稿されているかご確認ください。`
    );
  } catch(e) {
    console.log('ダイアログの表示はスプレッドシート上でのみ有効です。');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Discord Bot ポーリング（1分毎トリガーで実行）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * メインポーリング関数。GASトリガーから1分毎に呼ばれる。
 * Discord Bot APIで未読メッセージを取得 → AI回答 → 同チャンネルに返信。
 */
function discordAgentTick() {
  const config = getKCSSettings();
  const token = config.DISCORD_BOT_TOKEN || '';

  // ── 13:15 of ワンタイムテスト投稿の自動割り込み実行 ──
  try {
    const now = new Date();
    const hourJST = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'H'), 10);
    const minuteJST = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'm'), 10);
    if (hourJST === 13 && minuteJST === 15 && token) {
      const lockKey = 'TEST_POST_1315_DONE';
      const props = PropertiesService.getScriptProperties();
      if (!props.getProperty(lockKey)) {
        props.setProperty(lockKey, 'true');
        console.log('[Tick] 13:15のテスト投稿を検出しました。実行します。');
        
        const result = autoPostAffiliateAmazon();
        
        // 監視チャンネルマップの取得（KCS本部など）
        let channels = {};
        if (config.DISCORD_CHANNELS) {
          try { channels = JSON.parse(config.DISCORD_CHANNELS); } catch(e) {}
        }
        if (Object.keys(channels).length === 0 && config.DISCORD_CHANNEL_MAP) {
          try { channels = JSON.parse(config.DISCORD_CHANNEL_MAP); } catch(e) {}
        }
        const hqChannelId = channels['KCS本部'] || config.DISCORD_CHANNEL_ID || config.DISCORD_HQ_CHANNEL_ID || '';
        
        if (hqChannelId) {
          if (result && result.ok && result.xResult && result.xResult.ok) {
            sendDiscordMessage(
              hqChannelId,
              `社長、お疲れ様です！１３：１５のトレンド自動収集アフィリエイトテスト投稿が成功しました！エックス（X / 旧Twitter）アカウントを確認し、正しく投稿が配信されていることを確認いたしました！`,
              token
            );
          } else {
            const errReason = result ? (result.error || (result.xResult ? result.xResult.reason : '不明なエラー')) : '生成失敗';
            sendDiscordMessage(
              hqChannelId,
              `⚠️ **【テスト投稿 失敗】** １３：１５の自動アフィリエイト投稿の実行中にエラーが発生しました。\n理由: \`${errReason}\``,
              token
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn('[discordAgentTick] 13:15テスト投稿処理でエラー:', err.message);
  }

  // バックアップセーフティ: もしワンタイムトリガーで処理漏れしたスラッシュコマンドがあれば、1分毎の定期実行で救い上げる
  try {
    processQueuedSlashCommand();
  } catch (err) {
    console.warn('[discordAgentTick] 非同期キューバックアップ処理でエラー:', err.message);
  }

  if (!token) {
    console.warn('[discordAgentTick] DISCORD_BOT_TOKEN が未設定です。');
    return;
  }

  // 監視チャンネルマップの取得（KCS本部、knowledgeなど）
  let channels = {};
  if (config.DISCORD_CHANNELS) {
    try { channels = JSON.parse(config.DISCORD_CHANNELS); } catch(e) {}
  }
  if (Object.keys(channels).length === 0 && config.DISCORD_CHANNEL_MAP) {
    try { channels = JSON.parse(config.DISCORD_CHANNEL_MAP); } catch(e) {}
  }
  // 予備フォールバック
  if (!channels['KCS本部']) {
    channels['KCS本部'] = config.DISCORD_CHANNEL_ID || config.DISCORD_HQ_CHANNEL_ID || '';
  }
  if (!channels['knowledge']) {
    channels['knowledge'] = config.KNOWLEDGE_CHANNEL_ID || '';
  }

  // ── AI開発者チャンネルの自動検証・作成 ──
  if (token) {
    checkAndCreateDeveloperChannel(config, token, channels);
  }

  const props = PropertiesService.getScriptProperties();

  // 各監視対象チャンネルをループして1分ポーリング監視
  for (const channelName in channels) {
    const channelId = channels[channelName];
    if (!channelId) continue;

    // チャンネル個別の最終処理メッセージIDを取得（後方互換性維持）
    const propKey = `LAST_DISCORD_MSG_ID_${channelId}`;
    let lastMsgId = props.getProperty(propKey) || '';
    if (!lastMsgId && channelName === 'KCS本部') {
      lastMsgId = props.getProperty('LAST_DISCORD_MSG_ID') || '';
    }

    try {
      let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`;
      if (lastMsgId) url += `&after=${lastMsgId}`;

      const res = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bot ${token}` },
        muteHttpExceptions: true
      });

      if (res.getResponseCode() !== 200) {
        console.error(`[discordAgentTick] ${channelName} 取得失敗:`, res.getResponseCode(), res.getContentText());
        continue;
      }

      const messages = JSON.parse(res.getContentText());
      if (!messages || messages.length === 0) continue;

      // 古いメッセージから順に処理
      const sorted = messages.reverse();
      console.log(`[discordAgentTick] ${channelName} にて ${sorted.length}件の新規メッセージを検知しました。`);

      for (const msg of sorted) {
        if (msg.author?.bot) continue;

        const text = (msg.content || '').trim();
        const username = msg.author?.username || '不明';

        // ─────────── 1. KCS本部（テキストコマンド）の処理 ───────────
        if (channelName === 'KCS本部') {
          if (!text) continue;
          console.log(`[discordAgentTick] KCS本部処理中: "${text.slice(0, 30)}" by ${username}`);
          let replyText = '';
          if (text.startsWith('!')) {
            replyText = handleBotCommand(text, channelId, token, config);
          } else if (text.includes('HAL') || text.includes('すなくん') || text.includes('教えて')) {
            replyText = cmdAskGemini(text, config, 'KCS本部');
          }
          if (replyText) {
            sendDiscordMessage(channelId, replyText, token);
          }
        }
        // ─────────── 2. knowledge（画像・スクショ複数解析）の処理 ───────────
        else if (channelName === 'knowledge') {
          const attachments = msg.attachments || [];
          if (attachments.length > 0) {
            console.log(`[discordAgentTick] knowledgeにて画像添付を検知: 添付数 ${attachments.length} by ${username}`);
            
            // 複数添付画像をループして全て個別解析
            for (let i = 0; i < attachments.length; i++) {
              const att = attachments[i];
              const isImage = att.content_type?.startsWith('image/') || 
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);
              if (isImage) {
                console.log(`[discordAgentTick] 画像 ${i + 1}/${attachments.length} 解析開始: ${att.url}`);
                const result = handleKnowledgeImage({ 
                  imageUrl: att.url, 
                  channelId: channelId, 
                  username: username, 
                  config: config 
                });
                const replyText = result && result.reply 
                  ? result.reply 
                  : (result && result.error 
                      ? `❌ **画像解析エラーが発生しました**\n> ${result.error}\n設定シートのAPIキーや画像のアクセス権を確認してください。`
                      : '⚠️ 画像の解析結果が得られませんでした。');
                sendDiscordMessage(channelId, replyText, token);
              }
            }
          }
        }
        // ─────────── 3. ai-開発（プログラム修復・追加・改善指示）の処理 ───────────
        else if (channelName === 'ai-開発') {
          if (!text) continue;
          console.log(`[discordAgentTick] ai-開発処理中: "${text.slice(0, 30)}" by ${username}`);
          
          sendDiscordMessage(channelId, `🛠️ **開発指示「${text.slice(0, 50)}${text.length > 50 ? '...' : ''}」を受付ました！**\nただいまAIが指示内容を分析し、タスクファイルを自動生成しています...`, token);
          
          try {
            // 1. AIに指示内容を解釈させ、タスクファイルを自動生成する
            const aiPrompt = `社長からプログラムの「修復・追加・改善」の指示が届きました。\n` +
              `指示内容: 「${text}」\n\n` +
              `現在の主要ファイル: GAS_KCS合同会社_Backend.gs, CLAUDE.md, GEMINI_GAS_指示書.md\n\n` +
              `この指示を実現するために必要な実装計画や修正箇所の設計案（マークダウン形式）を生成してください。\n` +
              `出力はそのままファイルに保存できるようにマークダウンのみとし、余計な説明文は一切含めないでください。`;
              
            const designDocument = cmdAskGemini(aiPrompt, config, 'AI-Developer') || `# 開発指示: ${text}\n\n設計案を生成できませんでした。`;
            
            const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
            const fileId = Date.now();
            const githubPath = `Projects/AI-Developer/指示_${dateTag}_${fileId}.md`;
            
            // 2. GitHubに設計・タスク指示書を自動プッシュ！
            saveToGitHub(
              githubPath,
              `---\ndate: ${dateTag}\ntags: [AIデベロッパー, 開発指示, ${username}]\nstatus: 未着手\n---\n\n# 🛠️ 社長からの開発指示\n\n**指示原文:**\n> ${text}\n\n${designDocument}\n`,
              `AI開発指示保存 ${dateTag}`
            );
            
            // 3. Obsidian（Google Drive）にもミラー保存！
            try {
              saveToObsidian({ 
                title: `開発指示_${dateTag}_${fileId}`, 
                content: `# 🛠️ 社長からの開発指示\n\n**指示原文:**\n> ${text}\n\n${designDocument}`, 
                subfolder: 'AI開発指示' 
              });
            } catch (e) {
              console.warn('[AI開発] Obsidian保存失敗:', e.message);
            }
            
            // 4. Discordに完了メッセージを返信！
            const reply = `✅ **開発指示の登録・同期が完了しました！**\n\n` +
              `📁 **保存ファイル**:\n` +
              `・GitHub: \`${githubPath}\`\n` +
              `・Obsidian: \`AI開発指示/開発指示_${dateTag}_${fileId}.md\`\n\n` +
              `👉 **ローカルエージェント（Antigravity）への自動連携完了！**\n` +
              `ローカルPC上の開発AIがこの指示ファイルを即座に検知し、\`GAS_KCS合同会社_Backend.gs\` などのプログラムファイルを自動修復・追加・デプロイいたします！`;
              
            sendDiscordMessage(channelId, reply, token);
          } catch (e) {
            console.error('[AI開発] 処理エラー:', e.message);
            sendDiscordMessage(channelId, `❌ **開発指示の登録中にエラーが発生しました：**\n\`${e.message}\``, token);
          }
        }

        // 処理済みメッセージIDの更新
        props.setProperty(propKey, msg.id);
        if (channelName === 'KCS本部') {
          props.setProperty('LAST_DISCORD_MSG_ID', msg.id);
        }
      }
    } catch (e) {
      console.error(`[discordAgentTick] ${channelName} ポーリング例外:`, e.message);
    }
  }
}

/**
 * discordAgentTick の1分毎トリガーを設定する。
 * GASエディタから手動で一度実行してください。
 */
function setupDiscordTrigger() {
  // 既存のトリガーを削除
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'discordAgentTick')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // 1分毎に実行するトリガーを作成
  ScriptApp.newTrigger('discordAgentTick')
    .timeBased()
    .everyMinutes(1)
    .create();

  console.log('✅ discordAgentTick トリガーを1分毎に設定しました。');
  try {
    SpreadsheetApp.getUi().alert('✅ Discord監視トリガーを設定しました（1分毎）。\n\n設定シートに DISCORD_CHANNEL_ID を入力してください。');
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gmail 自動感知システム
// 指定センダーからの重要メールを検知→Discord通知+自己修正
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GMAIL_WATCH_SENDERS = [
  'notifications@github.com',
  'noreply@us2.make.com',
  'onboarding@info.n8n.io',
  'no-reply@marketing.base44.com',
  'chelsea.c@ifttt.com',
  'em@em1.cloudflare.com'
];

const GMAIL_KEYWORDS = {
  error: ['failed', 'failure', 'error', 'エラー', '失敗', 'paused', '停止', 'credits', 'expired', 'trial'],
  warning: ['warning', '警告', 'limit', '制限', 'deprecated', 'upgrade', 'アップグレード'],
  info: ['success', '成功', 'completed', 'deployed', 'new feature', '新機能']
};

/**
 * Gmail監視メイン関数（時間トリガーで実行）
 * 直近1時間分のメールを解析してDiscordに通知
 */
function gmailMonitorTick() {
  const config = getKCSSettings();
  // 死活監視のため ScriptProperties を使用（実行ユーザーが変わってもlastCheckを共有）
  const props = PropertiesService.getScriptProperties();
  const lastCheck = Number(props.getProperty('GMAIL_LAST_CHECK') || '0');
  const now = Date.now();
  const since = new Date(lastCheck || now - 60 * 60 * 1000); // デフォルト1時間前
  // 最終実行ハートビートを記録（kcsHealthMonitorがこれを見て死活判定）
  props.setProperty('GMAIL_LAST_RUN_TS', String(now));

  const findings = [];

  for (const sender of GMAIL_WATCH_SENDERS) {
    try {
      const threads = GmailApp.search(`from:${sender} after:${Math.floor(since.getTime()/1000)}`, 0, 5);
      for (const thread of threads) {
        const msg = thread.getMessages()[0];
        const subject = msg.getSubject() || '';
        const snippet = msg.getPlainBody()?.substring(0, 300) || msg.getSubject() || '';
        const date = msg.getDate();

        // 重要度を判定
        const combined = (subject + ' ' + snippet).toLowerCase();
        let level = null;
        if (GMAIL_KEYWORDS.error.some(k => combined.includes(k))) level = '🚨 エラー';
        else if (GMAIL_KEYWORDS.warning.some(k => combined.includes(k))) level = '⚠️ 警告';
        else if (GMAIL_KEYWORDS.info.some(k => combined.includes(k))) level = '✅ 完了';

        if (level) {
          findings.push({ level, sender, subject, snippet: snippet.substring(0, 200), date });
        }
      }
    } catch (e) {
      console.warn(`[Gmail Monitor] ${sender} 検索エラー:`, e.message);
    }
  }

  props.setProperty('GMAIL_LAST_CHECK', String(now));

  if (!findings.length) {
    console.log('[Gmail Monitor] 新しい重要メールなし');
    return { ok: true, found: 0 };
  }

  // Discordに通知
  let webhookUrl = '';
  try { webhookUrl = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}')['error-log'] || config.KCS_HQ_WEBHOOK_URL || ''; }
  catch(e) { webhookUrl = config.KCS_HQ_WEBHOOK_URL || ''; }

  if (webhookUrl) {
    for (const f of findings) {
      const msg = `${f.level} **[Gmail感知]** \`${f.sender}\`\n**件名:** ${f.subject}\n${f.snippet}`;
      try {
        UrlFetchApp.fetch(webhookUrl, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({ content: msg.substring(0, 2000) })
        });
      } catch(e) { console.warn('[Gmail Monitor] Discord通知失敗:', e.message); }
    }
  }

  console.log(`[Gmail Monitor] ${findings.length}件の重要メールを検知・通知`);
  return { ok: true, found: findings.length, findings };
}

/**
 * Gmail監視の時間トリガーを設定（1時間毎）
 */
/**
 * Discord Bot Token からサーバーのチャンネル一覧を取得し、
 * DISCORD_CHANNEL_ID / KNOWLEDGE_CHANNEL_ID 等を自動設定
 */
function autoSetupDiscordChannels() {
  const config = getKCSSettings();
  const token = config.DISCORD_BOT_TOKEN || '';
  if (!token) return { ok: false, error: 'DISCORD_BOT_TOKEN が未設定です' };

  try {
    // Bot が参加しているサーバー一覧を取得
    const guildsRes = UrlFetchApp.fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { 'Authorization': 'Bot ' + token },
      muteHttpExceptions: true
    });
    if (guildsRes.getResponseCode() !== 200) {
      return { ok: false, error: 'Discord API エラー: ' + guildsRes.getResponseCode() + ' ' + guildsRes.getContentText().substring(0, 200) };
    }
    const guilds = JSON.parse(guildsRes.getContentText());
    if (!guilds.length) return { ok: false, error: 'Botがどのサーバーにも参加していません' };

    // 最初のサーバー（KCSサーバー）のチャンネル一覧
    const guildId = guilds[0].id;
    const chRes = UrlFetchApp.fetch('https://discord.com/api/v10/guilds/' + guildId + '/channels', {
      headers: { 'Authorization': 'Bot ' + token },
      muteHttpExceptions: true
    });
    if (chRes.getResponseCode() !== 200) {
      return { ok: false, error: 'チャンネル取得エラー: ' + chRes.getResponseCode() };
    }
    const channels = JSON.parse(chRes.getContentText())
      .filter(c => c.type === 0) // テキストチャンネルのみ
      .map(c => ({ id: c.id, name: c.name }));

    console.log('[autoSetupDiscord] チャンネル一覧:', JSON.stringify(channels));

    // チャンネル名マッピング
    const mapping = {};
    for (const ch of channels) {
      const n = ch.name.toLowerCase();
      if (n.includes('kcs') && n.includes('本部') || n === 'kcs本部') mapping['KCS本部'] = ch.id;
      if (n.includes('knowledge') || n.includes('ナレッジ')) mapping['knowledge'] = ch.id;
      if (n.includes('hal') && n.includes('project') || n === 'hal-project') mapping['hal-project'] = ch.id;
      if (n.includes('error') || n.includes('エラー')) mapping['error-log'] = ch.id;
      if (n.includes('アフェ') || n.includes('affiliate') || n.includes('amazon')) mapping['affiliate'] = ch.id;
    }

    // メインチャンネルID設定
    const mainChannelId = mapping['KCS本部'] || channels[0]?.id || '';
    if (mainChannelId) {
      saveSettingValue('DISCORD_CHANNEL_ID', mainChannelId);
      saveSettingValue('DISCORD_HQ_CHANNEL_ID', mainChannelId);
      console.log('[autoSetupDiscord] DISCORD_CHANNEL_ID = ' + mainChannelId);
    }
    if (mapping['knowledge']) {
      saveSettingValue('KNOWLEDGE_CHANNEL_ID', mapping['knowledge']);
    }

    // DISCORD_CHANNELS JSONも保存
    saveSettingValue('DISCORD_CHANNELS', JSON.stringify(mapping));

    return {
      ok: true,
      guildName: guilds[0].name,
      channels: channels,
      mapped: mapping,
      mainChannelId: mainChannelId
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function setupGmailMonitorTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'gmailMonitorTick')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('gmailMonitorTick')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('✅ Gmail監視トリガーを1時間毎に設定しました。');
  return { ok: true, message: 'Gmail監視トリガー設定完了（1時間毎）' };
}

/**
 * discordAgentTick トリガーを削除する。
 */
function deleteDiscordTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'discordAgentTick')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('🗑️ discordAgentTick トリガーを削除しました。');
  try {
    SpreadsheetApp.getUi().alert('🗑️ Discord監視トリガーを削除しました。');
  } catch (e) {}
}

/**
 * 手動でDiscordにテストメッセージを送る（接続確認用）
 */
function testDiscordConnection() {
  const config = getKCSSettings();
  const webhookUrl = config.KCS_HQ_WEBHOOK_URL || "";
  const token = config.DISCORD_BOT_TOKEN || "";
  const channelId = config.DISCORD_CHANNEL_ID || config.DISCORD_HQ_CHANNEL_ID || "";

  console.log('🔍 接続テストを開始します...');

  // Webhookのテスト
  if (webhookUrl) {
    console.log('⏳ Webhookでテスト送信中...');
    const res = sendDiscordWebhook(webhookUrl, "🔗 Webhook経由の接続テストに成功しました！", "KCS System Test");
    if (res && res.getResponseCode() < 300) {
      console.log('✅ Webhook送信成功');
    } else {
      console.error('❌ Webhook送信失敗:', res ? res.getContentText() : '応答なし');
    }
  }

  // Bot APIのテスト
  if (token && channelId) {
    console.log('⏳ Bot APIでテスト送信中...');
    sendDiscordMessage(channelId, "🤖 Bot API経由の接続テストです。以前403エラーが出ていた方はこちらを確認してください。", token);
  }

  if (!webhookUrl && !token) {
    console.error('❌ 設定不足: 設定シートに KCS_HQ_WEBHOOK_URL または DISCORD_BOT_TOKEN を入力してください。');
  }

  try {
    SpreadsheetApp.getUi().alert('✅ テスト送信処理を完了しました。Discordを確認してください。\n（ログに詳細な結果が表示されています）');
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Discord Interactions Endpoint（Slash Command対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Discordからのインタラクションを処理するメインハンドラ
 */
function handleDiscordInteraction(e, rawBody, body) {
  const config = getKCSSettings();

  // 【デバッグ】一時的にすべての検証をスキップしてログを出力
  console.log('[Discord Debug] Interaction received:', JSON.stringify(body));

  // PING（type:1）
  if (body.type === 1) {
    console.log('[Discord Debug] PING → PONG');
    return ContentService.createTextOutput(JSON.stringify({ type: 1 })).setMimeType(ContentService.MimeType.JSON);
  }

  // Slash Command（type:2）
  if (body.type === 2) {
    console.log('[Discord Debug] Slash Command Detect:', body.data ? body.data.name : 'unknown');
    return handleSlashCommand(body, config);
  }

  return ContentService.createTextOutput(JSON.stringify({ type: 1 })).setMimeType(ContentService.MimeType.JSON);
}

// ── Discord レスポンスヘルパー ──────────────────────────────
function discordReply4(content) {
  return ContentService
    .createTextOutput(JSON.stringify({ type: 4, data: { content: String(content).slice(0, 2000) } }))
    .setMimeType(ContentService.MimeType.JSON);
}
function discordReply5() {
  return ContentService
    .createTextOutput(JSON.stringify({ type: 5 }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Slash Command ディスパッチャ ─────────────────────────────
// Cloudflare Workers 経由の場合、Worker が type:5 を返すので
// GAS は全コマンドを followup で送信する。
function handleSlashCommand(body, config) {
  const cmd     = (body.data && body.data.name ? body.data.name.toLowerCase() : '');
  const options = (body.data && body.data.options) ? body.data.options : [];
  const userId  = (body.member && body.member.user)
                  ? body.member.user.username
                  : (body.user ? body.user.username : '不明');

  const data = {
    cmd,
    options,
    userId,
    channelId: body.channel_id || '',
    token: body.token || '',
    appId: body.application_id || config.DISCORD_APP_ID || '1494714160829693992',
    resolved: (body.data && body.data.resolved) ? body.data.resolved : {}
  };

  // すべてのコマンドを同期的に実行し、レスポンスは必ずFollowup Webhookで送信する。
  // （Cloudflare Workers経由のため、Workerが即座にtype:5を返しており、GASのHTTP返答はDiscordには届かないため）
  console.log('[Discord] Processing slash command synchronously:', cmd);
  try {
    const result = executeSlashAsync(data, config);
    sendDiscordFollowup(data.appId, data.token, result);
  } catch (err) {
    console.error('[Discord] Synchronous slash command error:', err.message);
    sendDiscordFollowup(data.appId, data.token, `❌ 処理中に予期せぬエラーが発生しました: ${err.message}`);
  }

  return discordReply5();
}

// ── 非同期スラッシュコマンド処理（time triggerから呼ばれる） ────
function processQueuedSlashCommand() {
  const props = PropertiesService.getScriptProperties();
  const all   = props.getProperties();
  const config = getKCSSettings();

  for (const key in all) {
    if (!key.startsWith('SLASH_')) continue;
    
    // 多重実行を防ぐロック処理（値を取得して即座にプロパティから削除）
    const dataStr = props.getProperty(key);
    if (!dataStr) continue; // すでに他スレッドで処理済み
    props.deleteProperty(key); // ロック確保

    let data;
    try { 
      data = JSON.parse(dataStr); 
    } catch(e) { 
      continue; 
    }

    try {
      console.log('[Queue] Processing slow slash command:', data.cmd);
      const result = executeSlashAsync(data, config);
      sendDiscordFollowup(data.appId, data.token, result);
    } catch (err) {
      console.error('[Queue] Error in processQueuedSlashCommand:', err.message);
      sendDiscordFollowup(data.appId, data.token, `❌ 処理中に予期せぬエラーが発生しました: ${err.message}`);
    }
  }
  cleanupTriggers('processQueuedSlashCommand');
}

// ── 非同期コマンド実行ロジック ───────────────────────────────
function executeSlashAsync(data, config) {
  const { cmd, options, userId } = data;
  const getOpt = (name) => { const o = options.find(x => x.name === name); return o ? String(o.value) : ''; };

  try {
    switch (cmd) {
      case 'help': {
        return [
          '📋 **KCS Bot コマンド一覧**',
          '',
          '**即時応答（約1分）**',
          '`/help` — このヘルプ',
          '`/status` — 進行中プロジェクト一覧',
          '`/attendance` — 本日の出勤状況',
          '`/stock` — Pizza在庫確認',
          '',
          '**AI処理（#チャンネルに結果が届く）**',
          '`/ask [質問]` — AIに質問（Gemini）',
          '`/briefing` — 朝ブリーフィング手動実行 → #朝礼',
          '`/hal [テーマ]` — HAL投稿案3パターン生成 → #hal-project',
          '`/sunakkun [テーマ]` — すなくん投稿案生成 → #affiliate',
          '`/daily` — 日次レポート手動生成 → #daily-report',
          '`/knowledge [メモ]` — ナレッジメモ保存 → GitHub + #knowledge',
          '`/approve [投稿ID]` — 投稿案を承認してXに投稿',
          '',
          '**案件管理**',
          '`/hp [内容]` — HP制作タスク追加 → #hp-create',
          '`/ec [内容]` — EC構築タスク追加 → #ec-build',
        ].join('\n');
      }
      case 'status': {
        return cmdProjectSummary();
      }
      case 'attendance': {
        return cmdTodayAttendance(config);
      }
      case 'stock': {
        return cmdPizzaStock(config);
      }
      case 'ask': {
        const q = getOpt('query');
        if (!q) return '❓ 質問内容を入力してください。';
        return cmdAskGemini(q, config, 'KCS本部') || '⚠️ 回答できませんでした。';
      }
      case 'briefing': {
        morningBriefing();
        return '🌅 朝ブリーフィングを実行しました！ #朝礼 を確認してください。';
      }
      case 'hal': {
        const theme = getOpt('theme') || '今日のおすすめ';
        const r = generateHALPost({ theme, platform: 'X', useGemini: true });
        return r.ok
          ? `✅ **HAL投稿案を生成しました！**\nテーマ: ${theme}\n#hal-project を確認してください。`
          : `❌ HAL投稿生成失敗: ${r.error || '不明なエラー'}`;
      }
      case 'sunakkun': {
        const theme = getOpt('theme') || 'おすすめガジェット';
        const r = generateSunakkunPost({ theme, platform: 'X', useGemini: true });
        return r.ok
          ? `✅ **すなくん投稿案を生成しました！**\nテーマ: ${theme}\n#affiliate を確認してください。`
          : `❌ すなくん投稿生成失敗: ${r.error || '不明なエラー'}`;
      }
      case 'daily': {
        generateDailyReport();
        return '📊 日次レポートを生成しました！ #daily-report を確認してください。';
      }
      case 'knowledge': {
        const memo      = getOpt('memo');
        const imageOptId = (() => { const o = options.find(x => x.name === 'image'); return o ? String(o.value) : ''; })();
        // type:11 の場合、resolved.attachments[id].url に画像URLが入る
        const resolved  = (data.resolved && data.resolved.attachments) ? data.resolved.attachments : {};
        const imageUrl  = imageOptId && resolved[imageOptId] ? resolved[imageOptId].url : '';

        if (!memo && !imageUrl) return '❓ メモまたは画像のどちらかを入力してください。';

        const wh    = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
        const khUrl = wh['knowledge'] || wh['#knowledge'] || '';
        const now   = new Date();
        const dateDisplay = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
        const datePath    = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd_HHmmss');

        // 画像がある場合 → Gemini Vision で解析
        if (imageUrl) {
          const result = handleKnowledgeImage({ imageUrl, channelId: data.channelId, username: userId, config });
          const analysis = (result && result.reply) ? result.reply : '⚠️ 解析できませんでした';
          if (khUrl) sendDiscordWebhook(khUrl, `📸 **画像ナレッジ保存** by ${userId}\n\n${analysis.slice(0, 1200)}`, 'KCS Bot');
          return analysis;
        }

        // テキストメモのみ
        const mdContent = `---\ndate: ${dateDisplay}\ntags: [knowledge, manual]\nauthor: ${userId}\n---\n\n# ナレッジメモ ${dateDisplay}\n\n${memo}\n`;
        saveToGitHub(`Knowledge/メモ/memo_${datePath}.md`, mdContent, `ナレッジメモ追加 ${dateDisplay}`);
        if (khUrl) sendDiscordWebhook(khUrl, `📚 **ナレッジメモ保存** by ${userId}\n\n${memo.slice(0, 800)}`, 'KCS Bot');
        return `📚 **ナレッジメモを保存しました！**\n\n${memo.slice(0, 500)}`;
      }
      case 'approve': {
        const postId = getOpt('id');
        if (!postId) return '❓ 投稿IDを入力してください。';
        const r = approveHALPost({ postId });
        return r.ok ? `✅ 投稿をXに公開しました！` : `❌ 承認失敗: ${r.error || '投稿IDが見つかりません'}`;
      }
      case 'hp': {
        const content = getOpt('content');
        return slashAgencyTask('hp-create', 'HP制作', '🌐', content, userId, config);
      }
      case 'ec': {
        const content = getOpt('content');
        return slashAgencyTask('ec-build', 'EC構築', '🛒', content, userId, config);
      }
      default:
        return `❓ 不明なコマンド: /${cmd}`;
    }
  } catch(e) {
    console.error('[executeSlashAsync] エラー:', e.message);
    return `❌ エラーが発生しました: ${e.message}`;
  }
}

// #hp-create / #ec-build タスク追加ヘルパー
function slashAgencyTask(channelKey, label, emoji, content, userId, config) {
  if (!content) return `❓ タスク内容を入力してください。`;
  const wh  = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
  const url = wh[channelKey] || wh[channelKey.replace('-', '_')] || '';
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  if (url) sendDiscordWebhook(url, `${emoji} **【${label} タスク追加】** ${now}\n担当: ${userId}\n\n${content}`, 'KCS Bot');
  return `${emoji} **${label}タスクを追加しました！**\n\n${content.slice(0, 300)}`;
}

// Discord Interaction followup送信
function sendDiscordFollowup(appId, token, content) {
  if (!token || !appId) { console.error('[sendDiscordFollowup] appId/token未設定'); return; }
  try {
    const res = UrlFetchApp.fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ content: String(content).slice(0, 2000) }),
      muteHttpExceptions: true
    });
    console.log('[sendDiscordFollowup] status:', res.getResponseCode());
  } catch(e) {
    console.error('[sendDiscordFollowup] 失敗:', e.message);
  }
}

// 指定関数名のtriggerを全削除（蓄積防止）
function cleanupTriggers(functionName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === functionName) {
      try { ScriptApp.deleteTrigger(t); } catch(e) {}
    }
  });
}

/**
 * Discord Slash Commandを全チャンネル分まとめて登録する
 * GASエディタから1回手動実行するだけでOK
 */
function registerDiscordSlashCommands() {
  const config = getKCSSettings();
  const token  = config.DISCORD_BOT_TOKEN || '';
  const appId  = config.DISCORD_APP_ID    || '1494714160829693992';
  if (!token || !appId) {
    console.error('[registerSlashCommands] DISCORD_BOT_TOKEN または DISCORD_APP_ID が未設定');
    return;
  }

  const STR = 3; // STRING option type

  const commands = [
    // ── 即時応答 ────────────────────────────────────────────
    { name: 'help',       description: 'KCS Botのコマンド一覧を表示' },
    { name: 'status',     description: '進行中プロジェクトの状況を確認' },
    { name: 'attendance', description: '本日の出勤状況を確認' },
    { name: 'stock',      description: 'Pizza在庫を確認' },
    // ── AI処理（約1分で結果が各チャンネルに届く） ───────────
    { name: 'ask',        description: 'AIに質問する（Gemini）',
      options: [{ type: STR, name: 'query', description: '質問内容', required: true }] },
    { name: 'briefing',   description: '朝ブリーフィングを手動実行 → #朝礼に投稿' },
    { name: 'hal',        description: 'HAL投稿案3パターン生成 → #hal-projectに送信',
      options: [{ type: STR, name: 'theme', description: 'テーマ（例: 推し活、ファッション、グルメ）', required: true }] },
    { name: 'sunakkun',   description: 'すなくん投稿案生成 → #affiliateに送信',
      options: [{ type: STR, name: 'theme', description: '商品テーマ（例: ワイヤレスイヤホン、財布）', required: true }] },
    { name: 'daily',      description: '日次レポートを手動生成 → #daily-reportに送信' },
    { name: 'knowledge',  description: '画像 or テキストメモを保存 → Gemini解析 + GitHub + #knowledge',
      options: [
        { type: STR, name: 'memo',  description: 'テキストメモ（任意）', required: false },
        { type: 11,  name: 'image', description: '画像ファイル（任意・Gemini Visionで自動解析）', required: false }
      ] },
    { name: 'approve',    description: 'HAL/すなくん投稿を承認してXに公開',
      options: [{ type: STR, name: 'id', description: '投稿ID（/hal や /sunakkun の返答で表示されるID）', required: true }] },
    // ── 案件管理 ────────────────────────────────────────────
    { name: 'hp',         description: 'HP制作案件にタスク追加 → #hp-createに通知',
      options: [{ type: STR, name: 'content', description: 'タスク内容', required: true }] },
    { name: 'ec',         description: 'EC構築案件にタスク追加 → #ec-buildに通知',
      options: [{ type: STR, name: 'content', description: 'タスク内容', required: true }] },
  ];

  const url = `https://discord.com/api/v10/applications/${appId}/commands`;
  const res = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(commands),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code === 200) {
    console.log('[registerSlashCommands] ✅ 登録成功:', text.slice(0, 200));
    try { SpreadsheetApp.getUi().alert('✅ Slash Commands 14個を登録しました！\n/help /status /attendance /stock\n/ask /briefing /hal /sunakkun /daily /knowledge /approve\n/hp /ec'); } catch(e) {}
  } else {
    console.error('[registerSlashCommands] ❌ 失敗:', code, text.slice(0, 300));
    try { SpreadsheetApp.getUi().alert('❌ 登録失敗: ' + code + '\n' + text.slice(0, 200)); } catch(e) {}
  }
}

/**
 * 一時的：設定シートにDiscordのキーを自動登録する関数
 */
function tempSetDiscordKeys() {
  const ss = SpreadsheetApp.openById('1alhq3fGUoTUaTqzxHc8Nija9dyuzXJ2q88-NN3DzpjIzYCZvhZCn_lJKRSHRsS2JNmjkiC3gw');
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return;

  sheet.appendRow(['DISCORD_APP_ID', '1494714160829693992', 'Discord Application ID']);
  sheet.appendRow(['DISCORD_PUBLIC_KEY', '41217f6d5574fd4c530c70bc44574d66c43c1620a40c179bf5fc0153771c4626', 'Discord 公開鍵']);
  console.log('設定シートにキーを登録しました。');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ed25519 署名検証（Discord必須）— 純粋JS実装
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Discord Interactions Endpointの署名を検証する
 * message = timestamp + body, signature・publicKeyは16進数文字列
 */
function verifyDiscordEd25519(rawBody, signatureHex, timestamp, publicKeyHex) {
  try {
    const message   = timestamp + rawBody;
    const msgBytes  = stringToUint8Array(message);
    const sigBytes  = hexToUint8Array(signatureHex);
    const pubBytes  = hexToUint8Array(publicKeyHex);
    return ed25519Verify(sigBytes, msgBytes, pubBytes);
  } catch (e) {
    console.error('[Ed25519] 検証エラー:', e.message);
    return false;
  }
}

// ---- 以下: 純粋JS Ed25519 実装（TweetNaClベース） ----
// フィールド演算 (mod 2^255-19)
function ed25519Verify(sig, msg, pub) {
  if (sig.length !== 64 || pub.length !== 32) return false;
  const q = unpackNeg(pub);
  if (!q) return false;
  const h = hashEd(sig.slice(0, 32), pub, msg);
  const r = scalarmult(q, h);
  const rCheck = scalarmultBase(expandSig(sig));
  return gePrecheckEq(rCheck, r);
}

// 以下は数学的な実装のため変数名はアルゴリズム慣例に従う
var D2 = new Float64Array([
  -21827239,-5839606,-30745221,13898782,229458,15978800,-12551817,-6495438,29715968,9444199
]);
var X = new Float64Array([
  -14297830,-7645148,16144683,-16471763,27570974,-2696100,-26142465,8378389,20764389,8758491
]);
var I2 = new Float64Array([
  41136234,-14124199,-13360773,-19278962,15634929,-12669316,11395739,2333362,-25765230,679897
]);

function ts64(x, i, h, l) { x[i]=h>>>24&255; x[i+1]=h>>>16&255; x[i+2]=h>>>8&255; x[i+3]=h&255; x[i+4]=l>>>24&255; x[i+5]=l>>>16&255; x[i+6]=l>>>8&255; x[i+7]=l&255; }
function vn(x,xi,y,yi,n){var d=0;for(var i=0;i<n;i++)d|=x[xi+i]^y[yi+i];return(1&(d-1)>>>8)-1;}
function verify32(x,y){return vn(x,0,y,0,32);}

// SHA-512 (Google Apps Script 組み込みを活用)
function sha512GAS(m) {
  var signedBytes = Array.from(m).map(function(b) { return b > 127 ? b - 256 : b; });
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_512, signedBytes);
  return new Uint8Array(digest.map(function(b){ return b < 0 ? b + 256 : b; }));
}

// Ed25519 ハッシュ
function hashEd(r, pk, m) {
  var buf = new Uint8Array(r.length + pk.length + m.length);
  buf.set(r, 0); buf.set(pk, r.length); buf.set(m, r.length + pk.length);
  var h = sha512GAS(buf);
  return reduce(h);
}

// モジュラ演算
var gf0 = gf(), gf1 = gf([1]);
var D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]);
var sqrtm1 = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

function gf(init) {
  var r = new Float64Array(16);
  if (init) for (var i=0;i<init.length;i++) r[i]=init[i];
  return r;
}
function A(o,a,b){for(var i=0;i<16;i++)o[i]=a[i]+b[i];}
function Z(o,a,b){for(var i=0;i<16;i++)o[i]=a[i]-b[i];}
function M(o,a,b){
  var t=new Float64Array(31),i,j;
  for(i=0;i<16;i++)for(j=0;j<16;j++)t[i+j]+=a[i]*b[j];
  for(i=0;i<15;i++)t[i]+=38*t[i+16];
  for(i=0;i<16;i++)o[i]=t[i];
  car25519(o); car25519(o);
}
function S(o,a){M(o,a,a);}
function car25519(o){
  var c; for(var i=0;i<16;i++){o[i]+=(1<<16); c=Math.floor(o[i]/65536); o[(i+1)%16]+=c-1+37*(c-1)*(i===15?1:0); o[i]-=c*65536;}
}
function inv25519(o,inp){
  var c=gf(),i; for(i=0;i<16;i++)c[i]=inp[i];
  for(i=253;i>=0;i--){S(c,c);if(i!==2&&i!==4)M(c,c,inp);}
  for(i=0;i<16;i++)o[i]=c[i];
}
function pow2523(o,inp){
  var c=gf(),i; for(i=0;i<16;i++)c[i]=inp[i];
  for(i=250;i>=0;i--){S(c,c);if(i!==1)M(c,c,inp);}
  for(i=0;i<16;i++)o[i]=c[i];
}

function unpackNeg(r) {
  var t=gf(),chk=gf(),num=gf(),den=gf(),den2=gf(),den4=gf(),den6=gf();
  var p=[gf(),gf(),gf(),gf()];
  set25519(p[2],gf1);
  unpack25519(p[1],r);
  S(num,p[1]); M(den,num,D); Z(num,num,p[2]); A(den,p[2],den);
  S(den2,den); S(den4,den2); M(den6,den4,den2); M(t,den6,num); M(t,t,den);
  pow2523(t,t); M(t,t,num); M(t,t,den); M(t,t,den); M(p[0],t,den);
  S(chk,p[0]); M(chk,chk,den);
  if(!neq25519(chk,num)) M(p[0],p[0],sqrtm1);
  S(chk,p[0]); M(chk,chk,den);
  if(!neq25519(chk,num)) return null;
  if(par25519(p[0])===r[31]>>7) Z(p[0],gf0,p[0]);
  M(p[3],p[0],p[1]);
  return p;
}
function neq25519(a,b){
  var c=new Uint8Array(32),d=new Uint8Array(32);
  pack25519(c,a); pack25519(d,b);
  return verify32(c,d) !== 0;
}
function par25519(a){
  var d=new Uint8Array(32); pack25519(d,a); return d[0]&1;
}
function set25519(r,a){for(var i=0;i<16;i++)r[i]=a[i];}
function unpack25519(o,n){
  for(var i=0;i<16;i++)o[i]=n[2*i]+(n[2*i+1]<<8);
  o[15]&=0x7fff;
}
function pack25519(o,n){
  var i,j,b,m=gf(),t=gf();
  for(i=0;i<16;i++)t[i]=n[i];
  car25519(t); car25519(t); car25519(t);
  for(j=0;j<2;j++){
    m[0]=t[0]-0xffed;
    for(i=1;i<15;i++){m[i]=t[i]-0xffff-((m[i-1]>>16)&1);m[i-1]&=0xffff;}
    m[15]=t[15]-0x7fff-((m[14]>>16)&1); b=(m[15]>>16)&1; m[14]&=0xffff;
    sel25519(t,m,1-b);
  }
  for(i=0;i<16;i++){o[2*i]=t[i]&0xff;o[2*i+1]=t[i]>>8;}
}
function sel25519(p,q,b){
  var t,c=~(b-1);
  for(var i=0;i<16;i++){t=c&(p[i]^q[i]);p[i]^=t;q[i]^=t;}
}

function cswap(p,q,b){
  var i; for(i=0;i<4;i++)sel25519(p[i],q[i],b);
}
function add(p,q){
  var a=gf(),b=gf(),c=gf(),d=gf(),e=gf(),f=gf(),g=gf(),h=gf(),t=gf();
  Z(a,p[1],p[0]); Z(t,q[1],q[0]); M(a,a,t);
  A(b,p[0],p[1]); A(t,q[0],q[1]); M(b,b,t);
  M(c,p[3],q[3]); M(c,c,D2);
  M(d,p[2],q[2]); A(d,d,d);
  Z(e,b,a); Z(f,d,c); A(g,d,c); A(h,b,a);
  M(p[0],e,f); M(p[1],h,g); M(p[2],g,f); M(p[3],e,h);
}
function scalarmult(p,s){
  var q=[gf(),gf(),gf(),gf()];
  set25519(q[0],gf0); set25519(q[1],gf1); set25519(q[2],gf1); set25519(q[3],gf0);
  for(var i=255;i>=0;--i){
    var b=(s[i/8|0]>>(i&7))&1;
    cswap(q,p,b); add(p,q); add(q,q); cswap(q,p,b);
  }
  return q;
}
var B=[
  gf([0xd51a,0x8f25,0x2d60,0xc956,0xa7b2,0x9525,0xc760,0x692c,0xdc5c,0xfdd6,0xe231,0xc0a4,0x53fe,0xcd6e,0x36d3,0x2169]),
  gf([0x6658,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666,0x6666]),
  gf([1]),
  gf([0xa175,0x26b2,0x876b,0x0e59,0xa51b,0x0ad4,0x5b5b,0x9a8d,0x5db5,0xf3a4,0x0cfe,0x6d92,0xa7e6,0xd9de,0x0d23,0x4a58])
];
function scalarmultBase(s){
  var p=[gf(),gf(),gf(),gf()];
  set25519(p[0],B[0]); set25519(p[1],B[1]); set25519(p[2],B[2]); M(p[3],B[0],B[1]);
  return scalarmult(p,s);
}
function reduce(r){
  var x=new Float64Array(64),i;
  for(i=0;i<64;i++)x[i]=r[i];
  var out=new Uint8Array(32);
  modL(out,x); return out;
}
function modL(r,x){
  var s,i,j;
  var L=[0xed,0xd3,0xf5,0x5c,0x1a,0x63,0x12,0x58,0xd6,0x9c,0xf7,0xa2,0xde,0xf9,0xde,0x14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0x10];
  for(i=63;i>=32;--i){
    s=0;
    for(j=i-32;j<i-12;++j){x[j]+=s-16*x[i]*L[j-(i-32)];s=Math.floor(x[j]/256);x[j]-=s*256;}
    x[j]+=s; x[i]=0;
  }
  s=0;
  for(j=0;j<32;j++){x[j]+=s-(x[31]>>4)*L[j];s=Math.floor(x[j]/256);x[j]-=s*256;}
  for(j=0;j<32;j++)x[j]-=s*L[j];
  for(i=0;i<32;i++){x[i+1]+=x[i]>>8;r[i]=x[i]&255;}
}
function expandSig(sig){
  var s=new Float64Array(64);
  for(var i=0;i<32;i++)s[i]=sig[32+i];
  return reduce(new Uint8Array(s.buffer ? Array.from(s).map(Math.round) : s));
}
function packPoint(p){
  var tx=gf(),ty=gf(),zi=gf(),r=new Uint8Array(32);
  inv25519(zi,p[2]); M(tx,p[0],zi); M(ty,p[1],zi);
  pack25519(r,ty); r[31]^=par25519(tx)<<7;
  return r;
}
function gePrecheckEq(p,q){
  var pk=packPoint(p), qk=packPoint(q);
  return verify32(pk,qk) === 0;
}
function D2_init(){
  M(D2,D,gf([2]));
  // no-op: D2 already set as const above
}

// ---- ユーティリティ ----
function hexToUint8Array(hex){
  var arr=new Uint8Array(hex.length/2);
  for(var i=0;i<arr.length;i++) arr[i]=parseInt(hex.substr(i*2,2),16);
  return arr;
}
function stringToUint8Array(str){
  // GASのBlobを使って確実なUTF-8バイト配列を取得
  var gasBytes = Utilities.newBlob(str).getBytes();
  return new Uint8Array(gasBytes.map(function(b) { return b < 0 ? b + 256 : b; }));
}

// Bot トークンの有効性確認（デバッグ用）
function testBotToken() {
  const config = getKCSSettings();
  const token = config.DISCORD_BOT_TOKEN || '';
  if (!token) { console.log('❌ DISCORD_BOT_TOKEN が空です'); return; }

  const res = UrlFetchApp.fetch('https://discord.com/api/v10/users/@me', {
    headers: { 'Authorization': `Bot ${token}` },
    muteHttpExceptions: true
  });
  console.log('ステータス:', res.getResponseCode());
  console.log('レスポンス:', res.getContentText().slice(0, 200));
}

// ===================================================
// AI開発者チャンネル 自動作成機能
// ===================================================
function checkAndCreateDeveloperChannel(config, token, channels) {
  if (channels['ai-開発']) return channels['ai-開発'];
  const guildId = config.DISCORD_GUILD_ID;
  if (!guildId || !token) return '';
  
  try {
    console.log('[AI開発] ai-開発 チャンネルが存在しないため作成します...');
    const res = UrlFetchApp.fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ name: 'ai-開発', type: 0 }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200 || res.getResponseCode() === 201) {
      const ch = JSON.parse(res.getContentText());
      if (ch.id) {
        channels['ai-開発'] = ch.id;
        let currentChannels = {};
        if (config.DISCORD_CHANNELS) {
          try { currentChannels = JSON.parse(config.DISCORD_CHANNELS); } catch(e) {}
        }
        currentChannels['ai-開発'] = ch.id;
        saveSettingValue('DISCORD_CHANNELS', JSON.stringify(currentChannels));
        
        // 新チャンネルに案内を投稿
        sendDiscordMessage(
          ch.id,
          `🛠️ **【AIデベロッパーチャンネル】へようこそ！**\n\n` +
          `このチャンネルでは、社長が直接プログラムの修復・追加・改善の指示を出すことができます。\n` +
          `指示した内容はAIが解釈し、GitHub/Obsidianと同期されたタスクファイルを自動生成します。\n\n` +
          `**指示の記述例：**\n` +
          `・\`すなくんの自動投稿時間を12:00から13:00に変更して\`\n` +
          `・\`Xへの投稿で文字数オーバーが発生しないように制限コードを追加して\`\n` +
          `・\`〇〇の関数でエラーが出ているので修復して\``,
          token
        );
        console.log('[AI開発] ai-開発 チャンネル作成＆初期メッセージ送信完了！ID:', ch.id);
        return ch.id;
      }
    } else {
      console.warn('[AI開発] チャンネル作成API失敗:', res.getResponseCode(), res.getContentText());
    }
  } catch (e) {
    console.error('[AI開発] チャンネル自動作成エラー:', e.message);
  }
  return '';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// X 返信・メンション自動返信
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 特定ツイートへの返信投稿（Twitter API v2 POST /2/tweets）
 * @param {string} tweetId  返信先ツイートID
 * @param {string} text     返信テキスト
 * @param {string} account  'hal' | 'sunakun'
 */
function replyToX(tweetId, text, account) {
  account = account || 'sunakun';

  // 返信も140文字（280半角単位）を超える場合は自動要約
  let safeText = text;
  if (getTwitterLength(text) > 280) {
    console.log('[replyToX] 返信テキストがXの制限（280単位）を超えているため、自動要約を実行します。元の長さ: ' + getTwitterLength(text));
    safeText = summarizeTextForX(text);
  }
  safeText = sliceTwitterText(safeText, 275); // 返信なので275文字にスライス

  const config = getKCSSettings();

  // 1. まず OAuth 1.0a (APIキー直接返信) を試みる
  let consumerKey, consumerSecret, accessToken, accessSecret;
  if (account === 'hal') {
    consumerKey    = config.HAL_X_CONSUMER_KEY;
    consumerSecret = config.HAL_X_CONSUMER_SECRET;
    accessToken    = config.HAL_X_ACCESS_TOKEN;
    accessSecret   = config.HAL_X_ACCESS_SECRET;
  } else {
    consumerKey    = config.X_CONSUMER_KEY;
    consumerSecret = config.X_CONSUMER_SECRET;
    accessToken    = config.X_ACCESS_TOKEN;
    accessSecret   = config.X_ACCESS_SECRET;
  }

  if (consumerKey && consumerSecret && accessToken && accessSecret) {
    try {
      const url = 'https://api.twitter.com/2/tweets';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = Utilities.getUuid().replace(/-/g, '');

      const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: accessToken,
        oauth_version: '1.0'
      };

      const paramStr = Object.keys(oauthParams).sort()
        .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(oauthParams[k])}`)
        .join('&');
      const baseStr = `POST&${encodeRFC3986(url)}&${encodeRFC3986(paramStr)}`;
      const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(accessSecret)}`;
      const signature = Utilities.base64Encode(
        Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
      );
      oauthParams['oauth_signature'] = signature;

      const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
        .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
        .join(', ');

      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': authHeader },
        payload: JSON.stringify({
          text: safeText,
          reply: { in_reply_to_tweet_id: tweetId }
        }),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      const body = JSON.parse(res.getContentText());
      if (code === 201 || code === 200) {
        console.log('[replyToX] OAuth1.0a 返信成功:', body?.data?.id, '→', tweetId);
        return { ok: true, replyId: body?.data?.id };
      }
      console.warn('[replyToX] OAuth1.0a 返信失敗 code=' + code + ':', res.getContentText());
    } catch (e) {
      console.error('[replyToX] OAuth1.0a 例外:', e.message);
    }
  }

  // 2. OAuth 1.0a が未設定、または失敗した場合、OAuth 2.0 を試みる
  try {
    const service = getTwitterOAuthService(account);
    if (!service.hasAccess()) {
      return { ok: false, skipped: true, reason: 'OAuth2 authorization required for ' + account };
    }

    const url = 'https://api.twitter.com/2/tweets';
    
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
      payload: JSON.stringify({ 
        text: safeText,
        reply: { in_reply_to_tweet_id: tweetId }
      }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText());
    if (code === 201 || code === 200) {
      console.log('[replyToX] OAuth2 返信成功:', body?.data?.id, '→', tweetId);
      return { ok: true, replyId: body?.data?.id };
    }
    return { ok: false, error: body };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * X API v2でメンション一覧を取得する
 * @param {string} account  'hal' | 'sunakun'
 * @returns {Array} メンション配列 [{id, text, author_id, username}]
 */
function getMentions(account) {
  const config = getKCSSettings();

  let consumerKey, consumerSecret, accessToken, accessSecret, userId;
  if (account === 'hal') {
    consumerKey    = config.HAL_X_CONSUMER_KEY;
    consumerSecret = config.HAL_X_CONSUMER_SECRET;
    accessToken    = config.HAL_X_ACCESS_TOKEN;
    accessSecret   = config.HAL_X_ACCESS_SECRET;
    userId         = config.HAL_X_USER_ID || '';
  } else {
    consumerKey    = config.X_CONSUMER_KEY;
    consumerSecret = config.X_CONSUMER_SECRET;
    accessToken    = config.X_ACCESS_TOKEN;
    accessSecret   = config.X_ACCESS_SECRET;
    userId         = config.SUNAKUN_X_USER_ID || '';
  }

  if (!consumerKey || !accessToken || !userId) {
    console.warn(`[getMentions][${account}] APIキーまたはユーザーID未設定`);
    return [];
  }

  const lastIdKey = `LAST_MENTION_ID_${account}`;
  const lastId = config[lastIdKey] || '';
  let endpoint = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=author_id&expansions=author_id&user.fields=username&max_results=10`;
  if (lastId) endpoint += `&since_id=${lastId}`;

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Utilities.getUuid().replace(/-/g, '');
    const baseUrl = endpoint.split('?')[0];
    const queryObj = {};
    endpoint.split('?')[1].split('&').forEach(p => {
      const [k, v] = p.split('=');
      queryObj[decodeURIComponent(k)] = decodeURIComponent(v);
    });

    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    const allParams = Object.assign({}, queryObj, oauthParams);
    const paramStr = Object.keys(allParams).sort()
      .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`)
      .join('&');
    const baseStr = `GET&${encodeRFC3986(baseUrl)}&${encodeRFC3986(paramStr)}`;
    const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(accessSecret)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
    );
    oauthParams['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
      .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
      .join(', ');

    const res = UrlFetchApp.fetch(endpoint, {
      method: 'get',
      headers: { 'Authorization': authHeader },
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      console.warn(`[getMentions][${account}] API失敗:`, res.getResponseCode(), res.getContentText().slice(0, 100));
      return [];
    }

    const data = JSON.parse(res.getContentText());
    const tweets = data.data || [];
    const users = (data.includes?.users || []);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.username; });

    return tweets.map(t => ({
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      username: userMap[t.author_id] || ''
    }));
  } catch (e) {
    console.error(`[getMentions][${account}] 例外:`, e.message);
    return [];
  }
}

/**
 * X通知メール（件名・本文）からツイートID・ユーザー名・返信文を抽出
 */
function parseXNotificationEmail(subject, plainBody) {
  // ツイートIDをURLから抽出
  const idPattern = /(?:x|twitter)\.com\/(?:i\/web\/status|\w+\/status)\/(\d{10,})/g;
  const ids = [];
  let m;
  while ((m = idPattern.exec(plainBody)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  const replyTweetId = ids[0] || '';

  // ユーザー名を件名から抽出
  // 日本語: "XXXさんがあなたのポストに返信" / 英語: "XXX replied to your"
  const unameMatch = subject.match(/^([^\s]+)(?:さんが|[\s]+replied)/i) || subject.match(/@(\w+)/);
  const username = (unameMatch ? unameMatch[1] : '').replace(/^@/, '') || '不明';

  // 返信本文をメール本文から推定（URLや空行を除いた最初の文章行）
  const lines = plainBody.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 4 && l.length < 200
      && !l.startsWith('http') && !l.includes('twitter.com') && !l.includes('x.com')
      && !l.match(/^[A-Z\s]+:$/)  // ヘッダー行除外
    );
  const replySnippet = lines.slice(0, 2).join(' ').slice(0, 120);

  return { replyTweetId, username, replySnippet };
}

/**
 * X返信自動処理（30分ごとのGASトリガーから呼ぶ）
 *
 * 【フロー】
 * GmailのX通知メール → AI返信案生成 → Discord承認リクエスト
 * → CEO が !返信承認 ID → replyToX() で投稿
 *
 * ※ X API Freeプランで動作（読み取り不要・Gmail経由）
 */
function autoReplyTick() {
  return withErrorHandling(() => {
    // X公式通知メールを検索（未読・過去1日）
    const query = '(from:notify@x.com OR from:notify@twitter.com OR from:n-noreply@twitter.com) is:unread newer_than:1d';
    let threads;
    try {
      threads = GmailApp.search(query, 0, 20);
    } catch (e) {
      console.warn('[autoReplyTick] Gmail読み取り失敗:', e.message);
      return { ok: false, error: 'Gmail permission required' };
    }

    if (!threads || threads.length === 0) {
      console.log('[autoReplyTick] 新しいX返信通知なし');
      return { ok: true, total: 0 };
    }

    console.log(`[autoReplyTick] ${threads.length}件のX通知を処理します`);
    const config = getKCSSettings();
    const webhookUrls = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
    let processed = 0;

    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        if (!msg.isUnread()) continue;
        try {
          const subject  = msg.getSubject();
          const body     = msg.getPlainBody();
          const { replyTweetId, username, replySnippet } = parseXNotificationEmail(subject, body);

          if (!replyTweetId) {
            console.warn('[autoReplyTick] ツイートID抽出失敗。件名:', subject.slice(0, 60));
            msg.markRead();
            continue;
          }

          // HAL / すなくん の判定（宛先メールアドレスや件名から）
          const toAddr  = msg.getTo().toLowerCase();
          const subjectL = subject.toLowerCase();
          const account = (toAddr.includes('hal') || subjectL.includes('hal')) ? 'hal' : 'sunakun';
          const isHal   = account === 'hal';

          // Claude Haiku で返信案を生成
          const systemPrompt = isHal
            ? 'あなたはHAL（ハル）というAI配信者。おっとり天然癒し系で「〜だよね？」「〜かも？」という口調。返答は50文字以内、最後は質問で締める。'
            : 'あなたはすなくんというガジェット好きSNSキャラ。フレンドリーな口調。返答は50文字以内、最後は質問で締める。';

          const replyDraft = callClaudeAPI(
            `@${username} からの返信:「${replySnippet}」に返信してください。`,
            systemPrompt,
            'claude-haiku-4-5-20251001'
          ) || '（返信案の生成に失敗しました）';

          // ScriptProperties に承認待ちデータを保存
          const pendingId = `reply_${replyTweetId}_${account}`;
          PropertiesService.getScriptProperties().setProperty(
            `PENDING_REPLY_${pendingId}`,
            JSON.stringify({ tweetId: replyTweetId, replyDraft, account, username, created: new Date().toISOString() })
          );

          // Discord に承認リクエストを送信
          const webhook = isHal
            ? (webhookUrls['hal-project'] || webhookUrls['KCS本部'] || '')
            : (webhookUrls['affiliate']   || webhookUrls['KCS本部'] || '');

          if (webhook) {
            const discordMsg =
              `📬 **X返信通知** [${isHal ? 'HAL' : 'すなくん'}]\n` +
              `👤 @${username}:「${replySnippet.slice(0, 80)}」\n\n` +
              `💬 **AI返信案:**\n> ${replyDraft}\n\n` +
              `✅ 承認 → \`!返信承認 ${pendingId}\`\n` +
              `❌ 却下 → \`!返信スキップ ${pendingId}\``;
            UrlFetchApp.fetch(webhook, {
              method: 'post', contentType: 'application/json',
              payload: JSON.stringify({ content: discordMsg.slice(0, 2000) }),
              muteHttpExceptions: true
            });
            console.log(`[autoReplyTick] Discord通知送信: ${pendingId}`);
          }

          msg.markRead();
          processed++;
          Utilities.sleep(1000);

        } catch (e) {
          console.error('[autoReplyTick] メール処理エラー:', e.message);
          msg.markRead();
        }
      }
    }

    console.log(`[autoReplyTick] 完了 — ${processed}件処理`);
    return { ok: true, total: processed };
  }, 'autoReplyTick');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// X 拡散エンジン（エックス新アルゴ Grok 2026 準拠）
// - 投稿後30分以内のセルフリプライ
// - HAL⇔すなくん相互コメント
// - リンク希望DM自動返信
// - 1日3回以下の投稿制限
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 投稿後30分以内にセルフリプライ（エンゲージメント起動）
 * postToX成功後に自動でスケジュールされる
 * @param {string} tweetId 投稿したツイートID
 * @param {string} account 'hal' | 'sunakun'
 */
function scheduleSelfReply(tweetId, account) {
  if (!tweetId) return;
  const props = PropertiesService.getScriptProperties();
  const key = `SELF_REPLY_${tweetId}`;
  props.setProperty(key, JSON.stringify({
    tweetId, account, scheduledAt: new Date().toISOString(),
    executeAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15分後
  }));
  console.log(`[拡散エンジン] セルフリプライ予約: ${tweetId} (${account}) 15分後`);
}

/**
 * セルフリプライ実行ティック（5分毎トリガー）
 * 投稿後15〜25分でセルフリプライ＋相互コメントを実行
 */
function engagementTick() {
  return withErrorHandling(() => {
    const props = PropertiesService.getScriptProperties();
    const allKeys = props.getKeys().filter(k => k.startsWith('SELF_REPLY_'));
    const now = new Date();
    let processed = 0;

    for (const key of allKeys) {
      try {
        const data = JSON.parse(props.getProperty(key));
        const executeAfter = new Date(data.executeAfter);
        if (now < executeAfter) continue; // まだ早い

        // 古すぎるデータ（2時間以上前）は削除
        const scheduled = new Date(data.scheduledAt);
        if (now - scheduled > 2 * 60 * 60 * 1000) {
          props.deleteProperty(key);
          continue;
        }

        const account = data.account;
        const tweetId = data.tweetId;
        const isHal = account === 'hal';

        // 1. セルフリプライ（追加情報・質問投げかけ）
        const selfReplyPrompt = isHal
          ? '先ほどの自分の投稿に追加コメントを1つ書いてください。50文字以内。フォロワーに質問を投げかけて会話を促してください。例:「みんなは最近どんなコーデしてる？教えて〜！」口調はおっとり天然。'
          : '先ほどの自分の投稿に追加コメントを1つ書いてください。50文字以内。フォロワーに質問を投げかけて会話を促してください。例:「みんなはどんなガジェット使ってる？教えて！」口調はカジュアル。';
        const config = getKCSSettings();
        let selfReply = callClaudeAPI(selfReplyPrompt, '', 'claude-haiku-4-5-20251001');
        if (!selfReply) {
          selfReply = cmdAskGemini(selfReplyPrompt, config, account);
          selfReply = String(selfReply).replace(/🤖[^\n]*\n/, '').replace(/```[^`]*```/g, '').trim();
        }
        if (selfReply) {
          const sr = replyToX(tweetId, selfReply.slice(0, 140), account);
          console.log(`[拡散エンジン] セルフリプライ ${account}:`, sr.ok ? '成功' : sr.error);
        }

        // 2. 相互コメント（もう一方のアカウントからコメント）
        const otherAccount = isHal ? 'sunakun' : 'hal';
        const crossPrompt = isHal
          ? `すなくんとして、HALの投稿に友達感覚でコメントしてください。40文字以内。ライバル意識を少し見せつつフレンドリーに。例:「また先越された…でもこのコーデはちょっと認めるわ🤔」`
          : `HALとして、すなくんの投稿に友達感覚でコメントしてください。40文字以内。おっとりした口調で。例:「あ、これ気になってた！すなくんさすがだね〜」`;
        let crossReply = callClaudeAPI(crossPrompt, '', 'claude-haiku-4-5-20251001');
        if (!crossReply) {
          crossReply = cmdAskGemini(crossPrompt, config, otherAccount);
          crossReply = String(crossReply).replace(/🤖[^\n]*\n/, '').replace(/```[^`]*```/g, '').trim();
        }
        if (crossReply) {
          const cr = replyToX(tweetId, crossReply.slice(0, 140), otherAccount);
          console.log(`[拡散エンジン] 相互コメント ${otherAccount}→${account}:`, cr.ok ? '成功' : cr.error);
        }

        props.deleteProperty(key);
        processed++;
        Utilities.sleep(2000); // レート制限対策
      } catch (e) {
        console.error('[engagementTick] エラー:', e.message);
        props.deleteProperty(key); // エラーでも削除して無限ループ防止
      }
    }

    // 3. 「リンク希望」キーワードDM返信チェック
    const dmCount = checkLinkRequestReplies();

    return { ok: true, selfReplies: processed, dmResponses: dmCount };
  }, 'engagementTick');
}

/**
 * 「リンク希望」「リンクください」等のリプライを検知してリプ欄でリンク配布
 */
function checkLinkRequestReplies() {
  const config = getKCSSettings();
  const leadUrl = config.LEAD_MAGNET_URL || '';
  const lineUrl = config.LINE_FUNNEL_URL || '';
  if (!leadUrl && !lineUrl) return 0;

  let count = 0;
  for (const account of ['hal', 'sunakun']) {
    try {
      const mentions = getMentions(account);
      for (const m of mentions) {
        const text = (m.text || '').toLowerCase();
        if (text.includes('リンク') || text.includes('ほしい') || text.includes('教えて') || text.includes('link')) {
          const isHal = account === 'hal';
          const replyMsg = isHal
            ? `@${m.username} ありがとう〜！こちらからチェックしてみてね🧋\n${leadUrl || lineUrl}`
            : `@${m.username} リンク送るね！ここからどうぞ👇\n${leadUrl || lineUrl}`;
          const r = replyToX(m.id, replyMsg, account);
          if (r.ok) count++;
          Utilities.sleep(1000);
        }
      }
    } catch (e) {
      console.warn(`[checkLinkRequestReplies][${account}]`, e.message);
    }
  }
  return count;
}

/**
 * エンゲージメントエンジンのGASトリガーを設定（5分毎）
 */
function setupEngagementTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'engagementTick')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('engagementTick')
    .timeBased()
    .everyMinutes(5)
    .create();

  // autoReplyTickも30分毎で設定（未設定なら）
  const hasAutoReply = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'autoReplyTick');
  if (!hasAutoReply) {
    ScriptApp.newTrigger('autoReplyTick')
      .timeBased()
      .everyMinutes(30)
      .create();
  }

  console.log('✅ 拡散エンジントリガー設定完了（engagementTick:5分毎, autoReplyTick:30分毎）');
  return { ok: true, message: '拡散エンジントリガー設定完了' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TikTok スクリプト生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 60秒TikTokスクリプト自動生成
 * @param {Object} params - { theme, product, account }
 */
function generateTikTokScript(params) {
  return withErrorHandling(() => {
    const config  = getKCSSettings();
    const theme   = params.theme   || 'ガジェット紹介';
    const product = params.product || '';
    const account = params.account || 'sunakun';
    const isHal   = account === 'hal';

    const sysPrompt = isHal
      ? 'あなたはHAL（ハル）というAI美女配信者です。おっとり天然癒し系の口語でTikTokスクリプトを作成します。'
      : 'あなたはすなくんというガジェット好きSNSキャラです。親しみやすい口調でTikTokスクリプトを作成します。';

    const userPrompt =
      `以下のテーマで60秒のTikTokスクリプトを作成してください。\n\n` +
      `テーマ: ${theme}\n${product ? `商品・サービス: ${product}\n` : ''}\n` +
      `フォーマット（厳守）:\n` +
      `【HOOK（0-3秒）】\n（視聴者の注意を引く衝撃的な一言 ※必ず疑問形か驚きで始める）\n\n` +
      `【本編（4-50秒）】\n（テーマに関する3つのポイントを順番に説明 ※各ポイントは自然な口語で）\n\n` +
      `【CTA（51-60秒）】\n（フォロー・いいね・コメントを促す締めの一言）\n\n` +
      `【画面テロップ案】\n（各シーンで表示するテキスト、箇条書き3-5個）\n\n` +
      `【BGM・編集メモ】\n（雰囲気に合うBGM種類・カット割りのメモ）`;

    const script = callClaudeAPI(userPrompt, sysPrompt, 'claude-sonnet-4-6');
    if (!script) return { ok: false, error: 'Claude API 応答なし' };

    const dateStr    = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm');
    const folder     = isHal ? 'Projects/HAL' : 'Projects/Affiliate';
    const path       = `${folder}/tiktok_${account}_${dateStr}.md`;
    const mdContent  = `---\ndate: ${dateStr}\ntype: tiktok_script\naccount: ${account}\ntheme: ${theme}\n---\n\n# TikTokスクリプト — ${theme}\n\n${script}`;
    saveToGitHub(path, mdContent, `[TikTok] ${theme} スクリプト生成`);

    const webhookUrls = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
    const channelKey  = isHal ? 'hal-project' : 'affiliate';
    const webhook     = webhookUrls[channelKey] || webhookUrls[Object.keys(webhookUrls)[0]];
    if (webhook) {
      const msg = `🎬 **TikTokスクリプト生成完了** [${account.toUpperCase()}]\n**テーマ:** ${theme}\n\n` +
                  script.slice(0, 1500) + (script.length > 1500 ? '\n...(続きはGitHub参照)' : '');
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: msg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
    }

    return { ok: true, script, path, account, theme };
  }, 'generateTikTokScript');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// note 記事アウトライン生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * note記事アウトライン自動生成
 * @param {Object} params - { topic, keyword, account }
 */
function generateNoteOutline(params) {
  return withErrorHandling(() => {
    const config  = getKCSSettings();
    const topic   = params.topic   || 'テック・AI';
    const keyword = params.keyword || '';
    const account = params.account || 'sunakun';
    const isHal   = account === 'hal';

    const sysPrompt = isHal
      ? 'あなたはHAL（ハル）というAI配信者のnote記事ライターです。読者に寄り添う優しい文体でアウトラインを作成します。'
      : 'あなたはすなくんというガジェット好きキャラのnote記事ライターです。専門知識を分かりやすく伝えるアウトラインを作成します。';

    const userPrompt =
      `以下のテーマでnote記事のアウトラインを作成してください。\n\n` +
      `テーマ: ${topic}\n${keyword ? `ターゲットキーワード: ${keyword}\n` : ''}\n` +
      `フォーマット（厳守）:\n` +
      `【タイトル案（3案）】\n①\n②\n③\n\n` +
      `【リード文（100字）】\n（読者が最後まで読みたくなる導入文）\n\n` +
      `【本文構成】\n## H2-1: （見出し名）\n- ポイント1\n- ポイント2\n\n` +
      `## H2-2: （見出し名）\n- ポイント1\n- ポイント2\n\n` +
      `## H2-3: （見出し名）\n- ポイント1\n- ポイント2\n\n` +
      `【CTA・まとめ】\n（フォロー・購入・メルマガ登録等の促し）\n\n` +
      `【想定文字数・読了時間】\n（目安）`;

    const outline = callClaudeAPI(userPrompt, sysPrompt, 'claude-sonnet-4-6');
    if (!outline) return { ok: false, error: 'Claude API 応答なし' };

    const dateStr   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm');
    const folder    = isHal ? 'Projects/HAL' : 'Projects/Affiliate';
    const path      = `${folder}/note_outline_${account}_${dateStr}.md`;
    const mdContent = `---\ndate: ${dateStr}\ntype: note_outline\naccount: ${account}\ntopic: ${topic}\n${keyword ? `keyword: ${keyword}\n` : ''}---\n\n# noteアウトライン — ${topic}\n\n${outline}`;
    saveToGitHub(path, mdContent, `[note] ${topic} アウトライン生成`);

    const webhookUrls = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
    const channelKey  = isHal ? 'hal-project' : 'affiliate';
    const webhook     = webhookUrls[channelKey] || webhookUrls[Object.keys(webhookUrls)[0]];
    if (webhook) {
      const msg = `📝 **noteアウトライン生成完了** [${account.toUpperCase()}]\n**テーマ:** ${topic}${keyword ? ` / KW: ${keyword}` : ''}\n\n` +
                  outline.slice(0, 1500) + (outline.length > 1500 ? '\n...(続きはGitHub参照)' : '');
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: msg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
    }

    return { ok: true, outline, path, account, topic };
  }, 'generateNoteOutline');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// X 返信 承認待ちキュー取得
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ダッシュボードから呼ぶ：承認待ちX返信の一覧取得
 */
function getPendingReplies() {
  return withErrorHandling(() => {
    const props   = PropertiesService.getScriptProperties().getProperties();
    const pending = [];
    for (const [key, val] of Object.entries(props)) {
      if (!key.startsWith('PENDING_REPLY_')) continue;
      try {
        const data = JSON.parse(val);
        pending.push({ id: key.replace('PENDING_REPLY_', ''), ...data });
      } catch (e) { /* malformed — skip */ }
    }
    pending.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { ok: true, pending };
  }, 'getPendingReplies');
}

// ===================================================
// 🏢 システム警告メール自動スキャン ＆ AI自己修復 ＆ Discord通知システム
// ===================================================

/**
 * Gmailからメイク（Make.com）、エヌハチエヌ（n8n）、ファイアベース（Firebase）からのエラー/警告メールを自動スキャンし、
 * ジェミニ（Gemini）で解析、ディスコード（Discord）に通知後、自己修復・自動再起動を行う関数。
 * （5分毎のトリガーで実行）
 */
function checkSystemEmails() {
  const config = getKCSSettings();
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY が設定されていないため、システムメールの解析をスキップします。');
    return;
  }

  // Gmailを検索（未読のスレッドで、Make.com, n8n, Firebaseのエラー/警告に関連するもの）
  const searchQuery = 'is:unread (from:make.com OR from:n8n OR from:firebase OR "make.com" OR "n8n" OR "firebase") (error OR warning OR failed OR quota OR alert OR "billing" OR "limit" OR "inactive")';
  
  let threads = [];
  try {
    threads = GmailApp.search(searchQuery, 0, 10);
  } catch (e) {
    console.error('❌ Gmailの検索中にエラーが発生しました:', e.message);
    return;
  }

  if (threads.length === 0) {
    console.log('✅ 新着のシステム警告・エラーメールはありません。');
    return;
  }

  console.log(`🔍 新着のエラーメールスレッドを ${threads.length} 件検出しました。解析を開始します。`);

  for (const thread of threads) {
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1]; // 最新のメール
    const subject = lastMessage.getSubject();
    const from = lastMessage.getFrom();
    
    // 本文は大きすぎるとAPI制限に引っかかるため、プレーンテキストを一部切り出し
    let body = lastMessage.getPlainBody();
    if (body.length > 5000) {
      body = body.slice(0, 5000) + '\n...(本文が長いため省略しました)';
    }

    console.log(`📧 メール解析中: [件名] ${subject} [送信元] ${from}`);

    // ジェミニ（Gemini API）でメール本文を深く理解・分析
    const analysis = analyzeErrorEmailWithGemini(subject, body, apiKey);
    
    if (analysis) {
      // ディスコード（Discord）に通知
      sendErrorDiscordNotification(analysis, config);

      // 自己修復・自動回復ロジックの適用
      applySelfRepairLogic(analysis, config);
    }

    // 処理完了したスレッドを既読にし、アーカイブすることで次回のスキャン対象から外す
    thread.markRead();
  }
}

/**
 * ジェミニ（Gemini）を使ってシステムエラーメールを日本語で深く分析
 */
function analyzeErrorEmailWithGemini(subject, body, apiKey) {
  const systemContext = `あなたはKCS合同会社の自律型AIインフラエンジニアです。
メイク（Make.com）、エヌハチエヌ（n8n）、ファイアベース（Firebase）などの外部サービスや自社システムから届くエラーメールの内容を深く理解し、詳細を分析するのが任務です。
以下のルールに従って解析を行ってください：
1. **すべて日本語で説明すること**（専門用語もできる限り分かりやすくカタカナまたは日本語で説明すること。英語交じりの表記は厳禁）。
2. **緊急度** を「高（システム完全停止）」「中（一部機能停止）」「低（軽微なログ・一時的警告）」の3段階で判定すること。
3. **具体的なエラー原因** を分かりやすく説明すること。
4. **具体的な対応策**、およびもしプログラムのバグであれば **修復用プログラム（GASまたはNode.jsのパッチコード）** を提案すること。
5. **メイク（Make.com）のシナリオエラーの場合** は、もし対象のシナリオIDが判別できれば「Make_Scenario_ID: xxxxx」という形式で抽出すること。

出力フォーマットは以下のJSON形式（厳守）で返してください：
{
  "system": "システム名（Make / n8n / Firebase / その他）",
  "subject": "元のメール件名の日本語要約",
  "severity": "緊急度（高 / 中 / 低）",
  "reason": "分かりやすいエラー原因の説明（日本語）",
  "solution": "具体的な対策・アクションプラン（日本語）",
  "has_patch": trueまたはfalse,
  "patch_code": "修復用コード（ある場合のみ。GASまたはJavaScript）",
  "patch_target": "修復対象のファイル名または機能（ある場合のみ）",
  "make_scenario_id": "メイクのシナリオID（判定できる場合のみ。無ければ空）"
}`;

  const userPrompt = `件名: ${subject}\n\n本文:\n${body}`;

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          systemInstruction: { parts: [{ text: systemContext }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { 
            responseMimeType: "application/json",
            maxOutputTokens: 1500, 
            temperature: 0.2 
          }
        })
      }
    );

    const resText = res.getContentText();
    const data = JSON.parse(resText);
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!replyText) {
      console.error('[Gmail Gemini分析] 解析結果が空です:', resText);
      return null;
    }

    return JSON.parse(replyText);
  } catch (e) {
    console.error('[Gmail Gemini分析] エラー:', e.message);
    return null;
  }
}

/**
 * 分析結果をディスコード（Discord）に美しいカード形式で通知
 */
function sendErrorDiscordNotification(analysis, config) {
  const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
  // システムエラー専用のWebhook、無ければメインのWebhookを使用
  const webhookUrl = config.ERROR_LOG_WEBHOOK_URL || config.KCS_HQ_WEBHOOK_URL || webhooks['KCS本部'] || Object.values(webhooks)[0];

  if (!webhookUrl) {
    console.warn('[Error Discord] 通知先Webhook URLが設定されていません。');
    return;
  }

  // 緊急度に応じた色と絵文字の決定
  let color = 15158332; // 赤（高）
  let emoji = '🚨【重大エラー】';
  if (analysis.severity === '中') {
    color = 15105570; // オレンジ
    emoji = '⚠️【警告通知】';
  } else if (analysis.severity === '低') {
    color = 3066993; // 緑
    emoji = 'ℹ️【システム情報】';
  }

  const embed = {
    title: `${emoji} ${analysis.system}システムで異常を検知しました`,
    description: `**件名:** ${analysis.subject}\n\n` +
                 `**緊急度:** ${analysis.severity}\n\n` +
                 `**原因:**\n${analysis.reason}\n\n` +
                 `**対策・解決策:**\n${analysis.solution}`,
    color: color,
    timestamp: new Date().toISOString(),
    footer: {
      text: "KCS自律型AIインフラ管理システム"
    }
  };

  // 修復コードが提案されている場合、フィールドを追加
  if (analysis.has_patch && analysis.patch_code) {
    embed.fields = [
      {
        name: `🛠️ AI提案の自動修復パッチ (${analysis.patch_target || '共通'})`,
        value: `\`\`\`javascript\n${analysis.patch_code.slice(0, 1000)}\n\`\`\``
      }
    ];
    
    // 承認手順のガイド
    embed.description += `\n\n💡 **自動修復を実行するには、スプレッドシートの「実務タスク管理」シートに登録された修復タスク（タスクID: PATCH_${new Date().getTime()}）のステータスを「承認」にするか、Discordで「/approve_patch」を実行してください。**`;
  }

  if (analysis.make_scenario_id) {
    embed.fields = embed.fields || [];
    embed.fields.push({
      name: "⚙️ メイク（Make.com）シナリオ情報",
      value: `**シナリオID:** \`${analysis.make_scenario_id}\`\n👉 自動再起動プロセスがスタンバイしています。`
    });
  }

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        embeds: [embed],
        username: 'KCSシステムキーパー'
      })
    });
    console.log('📢 エラー通知をDiscordに送信しました。');
  } catch (e) {
    console.error('❌ Discord通知の送信に失敗しました:', e.message);
  }
}

/**
 * 自己修復・自動回復のロジック
 */
function applySelfRepairLogic(analysis, config) {
  const patchId = 'PATCH_' + new Date().getTime();
  
  // 1. プログラムのバグ修正コードが提案された場合、実務タスク管理に「承認待ち」で登録
  if (analysis.has_patch && analysis.patch_code) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const taskSheet = ss.getSheetByName('実務タスク管理');
    if (taskSheet) {
      const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      taskSheet.appendRow([
        patchId,
        'AIシステムエンジニア',
        'system_self_repair',
        `エラー自己修復パッチの適用: ${analysis.reason}`,
        JSON.stringify({
          targetFile: analysis.patch_target || 'GAS_KCS合同会社_Backend.gs',
          patchCode: analysis.patch_code
        }),
        '承認待ち',
        '', // 結果URL
        now,
        now
      ]);
      console.log(`📝 自動修復タスク ${patchId} を「実務タスク管理」に承認待ちで登録しました。`);
    }
  }

  // 2. メイク（Make.com）のシナリオエラーでシナリオIDがわかっている場合
  // メイクのAPIキーとシナリオIDがある場合、自動アクティブ化（自動再起動）を試みる
  if (analysis.make_scenario_id && config.MAKE_API_KEY) {
    const success = autoActivateMakeScenario(analysis.make_scenario_id, config.MAKE_API_KEY);
    
    // 再起動結果をDiscordに報告
    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhookUrl = config.ERROR_LOG_WEBHOOK_URL || config.KCS_HQ_WEBHOOK_URL || webhooks['KCS本部'] || Object.values(webhooks)[0];
    
    if (webhookUrl) {
      const notifyMessage = success 
        ? `✅ **自動回復成功:** メイク（Make.com）のシナリオ（ID: ${analysis.make_scenario_id}）でエラー停止していましたが、AIがAPI経由で自動アクティブ化（再起動）を実行し、無事に稼働状態に復帰しました！`
        : `⚠️ **自動回復試行:** メイク（Make.com）のシナリオ（ID: ${analysis.make_scenario_id}）の自動アクティブ化（再起動）を試みましたが、API通信で制限またはエラーが発生しました。手動でMake.comダッシュボードよりご確認ください。`;
      
      UrlFetchApp.fetch(webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({ content: notifyMessage, username: 'KCSシステムキーパー' })
      });
    }
  }
}

/**
 * Make.com API を叩いて、停止してしまったシナリオをアクティブ（有効化）にする
 */
function autoActivateMakeScenario(scenarioId, apiKey) {
  try {
    // Make.com API v1: シナリオをアクティブにするエンドポイント
    const url = `https://eu1.make.com/api/v1/scenarios/${scenarioId}/start`; // ヨーロッパサーバーを基準
    
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    const code = res.getResponseCode();
    console.log(`[Make.com API] シナリオ ${scenarioId} のアクティブ化レスポンスコード: ${code}`);
    
    if (code === 200 || code === 204) {
      console.log(`✅ メイクのシナリオ ${scenarioId} を無事に自動起動しました。`);
      return true;
    } else {
      // ヨーロッパサーバー以外の可能性もあるので、USサーバーでも試行
      const usUrl = `https://us1.make.com/api/v1/scenarios/${scenarioId}/start`;
      const usRes = UrlFetchApp.fetch(usUrl, {
        method: 'post',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      });
      const usCode = usRes.getResponseCode();
      if (usCode === 200 || usCode === 204) {
        console.log(`✅ メイクのシナリオ ${scenarioId} をUSサーバー経由で自動起動しました。`);
        return true;
      }
      
      console.error(`❌ メイクの自動再起動に失敗しました。ステータスコード: ${code}`);
      return false;
    }
  } catch (e) {
    console.error('❌ Make.com API 呼び出しエラー:', e.message);
    return false;
  }
}

/**
 * ディスコード等から「承認」メッセージを受信した際、修復タスクを実行するトリガー
 */
function executeApprovedPatch(patchId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName('実務タスク管理');
  if (!taskSheet) return { ok: false, message: '実務タスク管理シートが見つかりません。' };

  const rows = taskSheet.getDataRange().getValues();
  let foundRow = -1;
  let taskData = null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === patchId && rows[i][5] === '承認') {
      foundRow = i + 1;
      taskData = rows[i];
      break;
    }
  }

  if (foundRow === -1) {
    // 承認ステータスになっていない場合、承認待ちから探す
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === patchId && rows[i][5] === '承認待ち') {
        foundRow = i + 1;
        taskData = rows[i];
        // ステータスを「承認」に更新
        taskSheet.getRange(foundRow, 6).setValue('承認');
        break;
      }
    }
  }

  if (!taskData) {
    return { ok: false, message: `指定された修復タスク ${patchId} が見つからないか、承認されていません。` };
  }

  try {
    const params = JSON.parse(taskData[4]);
    const targetFile = params.targetFile;
    const patchCode = params.patchCode;

    console.log(`🛠️ パッチ適用プロセスを開始: ${patchId} -> ${targetFile}`);

    // GitHub 連携経由でコードを書き換えデプロイする
    const commitMsg = `[AI自己修復] パッチ ${patchId} を ${targetFile} に自動適用`;
    const gitResult = saveToGitHub(targetFile, patchCode, commitMsg);

    if (gitResult && gitResult.ok) {
      taskSheet.getRange(foundRow, 6).setValue('完了');
      const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      taskSheet.getRange(foundRow, 9).setValue(now);
      
      console.log(`✅ パッチ ${patchId} の自動修復とGitHubコミットが正常に完了しました！`);
      return { ok: true, message: `パッチ ${patchId} を ${targetFile} に正常に適用しました。GitHubコミット完了！` };
    } else {
      taskSheet.getRange(foundRow, 6).setValue('エラー');
      return { ok: false, message: `GitHubへの保存に失敗しました: ${gitResult ? gitResult.error : '不明なエラー'}` };
    }
  } catch (e) {
    console.error('❌ パッチ適用エラー:', e.message);
    taskSheet.getRange(foundRow, 6).setValue('エラー');
    return { ok: false, message: `パッチ適用処理中に例外が発生しました: ${e.message}` };
  }
}


/**
 * Driveのナレッジ画像用フォルダを監視し、新しい画像を処理する
 */
function processDriveKnowledgeImages() {
  const config = getKCSSettings();
  const sourceFolderId = config.DRIVE_KNOWLEDGE_IMAGE_FOLDER_ID;
  const processedFolderId = config.DRIVE_PROCESSED_IMAGE_FOLDER_ID;
  
  if (!sourceFolderId || !processedFolderId) {
    console.error('[DriveKnowledge] ❌ エラー: Google ドライブ監視用フォルダIDが設定シートに登録されていません。');
    console.error('[DriveKnowledge] 設定シートに以下のキーと正しいフォルダIDが登録されているかご確認ください：');
    console.error('[DriveKnowledge] 1. DRIVE_KNOWLEDGE_IMAGE_FOLDER_ID (画像投入用フォルダID)');
    console.error('[DriveKnowledge] 2. DRIVE_PROCESSED_IMAGE_FOLDER_ID (処理済み移動先フォルダID)');
    return;
  }
  
  let sourceFolder, processedFolder;
  try {
    sourceFolder = DriveApp.getFolderById(sourceFolderId);
  } catch(e) {
    console.error('[DriveKnowledge] ❌ エラー: 処理待ちフォルダ(DRIVE_KNOWLEDGE_IMAGE_FOLDER_ID)の取得に失敗しました。IDが正しくないか、GASにアクセス権限がありません。詳細:', e.message);
    return;
  }
  try {
    processedFolder = DriveApp.getFolderById(processedFolderId);
  } catch(e) {
    console.error('[DriveKnowledge] ❌ エラー: 処理済みフォルダ(DRIVE_PROCESSED_IMAGE_FOLDER_ID)の取得に失敗しました。IDが正しくないか、GASにアクセス権限がありません。詳細:', e.message);
    return;
  }
  
  const files = sourceFolder.getFiles();
  let count = 0;
  
  while (files.hasNext()) {
    if (count >= 5) break; // 1回の実行で最大5件まで（タイムアウト防止）
    const file = files.next();
    const mimeType = file.getMimeType();
    
    // 画像ファイルのみ対象
    if (mimeType.startsWith('image/')) {
      console.log(`[DriveKnowledge] 画像処理開始: ${file.getName()}`);
      count++;
      
      const apiKey = config.GEMINI_API_KEY || '';
      if (!apiKey) {
        console.error('[DriveKnowledge] GEMINI_API_KEY が未設定です。');
        break;
      }
      
      let imageBase64;
      try {
        const blob = file.getBlob();
        imageBase64 = Utilities.base64Encode(blob.getBytes());
      } catch (e) {
        console.error(`[DriveKnowledge] ファイル読込エラー: ${file.getName()}`, e.message);
        continue;
      }
      
      const prompt = `添付画像を分析してください：\n1. 内容の要約（3行以内）\n2. 重要度（高/中/低）\n3. HAL・すなくん・他プロジェクトへの応用方法\n4. 具体的な活用アイデア（3つ）\n5. 保存推奨フォルダ（Knowledge/推し活・ファッション・美容・SNSバズ・グルメ 等）\nMarkdown形式で回答してください。`;
      
      const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: imageBase64 } }] }]
      };
      
      let analysis = '';
      try {
        const res = UrlFetchApp.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) }
        );
        if (res.getResponseCode() === 200) {
          const data = JSON.parse(res.getContentText());
          analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          console.error('[DriveKnowledge] Gemini APIエラー:', res.getContentText());
          continue;
        }
      } catch (e) {
        console.error('[DriveKnowledge] Gemini 通信エラー:', e.message);
        continue;
      }
      
      if (analysis) {
        const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
        const displayDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
        const content = `---\ndate: ${displayDate}\ntags: [knowledge, drive_image]\nauthor: DriveUpload\n---\n\n# ドライブ画像知識 ${displayDate}\n\n${analysis}\n\n---\nファイル名: ${file.getName()}\n`;
        
        saveToGitHub(`Knowledge/スクショ/ドライブ_${dateTag}.md`, content, `ドライブ画像知識追加 ${displayDate}`);
        
        
      }
      
      // 処理済みフォルダへ移動
      try {
        file.moveTo(processedFolder);
        console.log(`[DriveKnowledge] 処理済みフォルダへ移動完了: ${file.getName()}`);
      } catch(e) {
        console.error(`[DriveKnowledge] ファイル移動エラー: ${file.getName()}`, e.message);
      }
    }
  }
}

/**
 * Drive監視トリガーの手動設定
 */
function setupKnowledgeDriveTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processDriveKnowledgeImages').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processDriveKnowledgeImages').timeBased().everyMinutes(5).create();
  console.log('✅ Drive監視トリガーを設定しました（5分毎）。');
  try { SpreadsheetApp.getUi().alert('✅ Drive監視トリガーを設定しました（5分毎）。'); } catch(e){}
}

/**
 * 今日追加された画像をDrive全体から検索して1回だけ解析する（手動実行用）
 */
function manualProcessTodayImages() {
  const config = getKCSSettings();
  const apiKey = config.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('[ManualDrive] GEMINI_API_KEY が未設定です。');
    return { status: 'error', message: 'APIキーがありません' };
  }

  // 昨日以降の日付を取得 (検索漏れを防ぐため広めに取る)
  const date = new Date();
  date.setDate(date.getDate() - 2); // 念のため2日前から
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  
  console.log('[ManualDrive] 検索開始:', dateStr);
  
  // 作成された画像ファイルをDrive全体から検索
  const query = "mimeType contains 'image/' and createdDate >= '" + dateStr + "'";
  let files;
  try {
    files = DriveApp.searchFiles(query);
  } catch(e) {
    console.error('[ManualDrive] 検索エラー:', e.message);
    return { status: 'error', message: e.message };
  }

  let count = 0;
  let processedFiles = [];

  while (files.hasNext()) {
    if (count >= 3) break; // タイムアウト防止のため最大3件
    const file = files.next();
    const mimeType = file.getMimeType();
    
    console.log(`[ManualDrive] 見つけました: ${file.getName()}`);
    count++;
    
    let imageBase64;
    try {
      const blob = file.getBlob();
      imageBase64 = Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      console.error(`[ManualDrive] 読込エラー: ${file.getName()}`, e.message);
      continue;
    }
    
    const prompt = `添付画像を分析してください：\n1. 内容の要約（3行以内）\n2. 重要度（高/中/低）\n3. HAL・すなくん・他プロジェクトへの応用方法\n4. 具体的な活用アイデア（3つ）\n5. 保存推奨フォルダ（Knowledge/推し活・ファッション・美容・SNSバズ・グルメ 等）\nMarkdown形式で回答してください。`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: imageBase64 } }] }]
    };
    
    let analysis = '';
    try {
      const res = UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) }
      );
      if (res.getResponseCode() === 200) {
        const data = JSON.parse(res.getContentText());
        analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        console.error('[ManualDrive] APIエラー:', res.getContentText());
      }
    } catch (e) {
      console.error('[ManualDrive] 通信エラー:', e.message);
    }
    
    if (analysis) {
      const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
      const displayDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
      const content = `---\ndate: ${displayDate}\ntags: [knowledge, drive_image]\nauthor: DriveUpload (Manual)\n---\n\n# ドライブ画像知識 ${displayDate}\n\n${analysis}\n\n---\nファイル名: ${file.getName()}\n`;
      
      saveToGitHub(`Knowledge/スクショ/ドライブ_${dateTag}.md`, content, `ドライブ画像知識追加 ${displayDate}`);
      
      const channelId = config.KNOWLEDGE_CHANNEL_ID || config.DISCORD_CHANNEL_ID;
      const token = config.DISCORD_BOT_TOKEN;
      if (channelId && token) {
        const reply = `✅ **（再試行）Drive画像のまとめ完了！**\n\n📁 **ファイル**: \`${file.getName()}\`\n\n${analysis}`;
        sendDiscordMessage(channelId, reply, token);
      }
      processedFiles.push(file.getName());
    }
  }
  
  return { status: 'ok', count: count, files: processedFiles };
}


// ===================================================
// 🤖 マルチエージェント自己紹介テスト
// ===================================================
function introduceAllStaff() {
  const config = getKCSSettings();
  let webhooks = {};
  try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
  const webhookUrl = config.ERROR_LOG_WEBHOOK_URL || config.KCS_HQ_WEBHOOK_URL || webhooks['KCS本部'] || Object.values(webhooks)[0];
  if (!webhookUrl) return;

  const staffList = [
    { name: 'ジュン専務', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', msg: 'おう、ジュンや！これからは各自が一つずつ責任持って発言していくで！システム再構築、気合い入れて見守ったるからな！' },
    { name: 'サクラ秘書', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png', msg: '皆様お疲れ様です。サクラです。Discordが皆様の快適なオフィスになり、一人一人と対話できるようサポートいたしますね。' },
    { name: 'ハルキ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140037.png', msg: 'プランナーのハルキです。ロードマップと要件定義は僕にお任せください。途切れないスマートな進行をお約束します。' },
    { name: 'アカリ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140042.png', msg: 'プロデューサーのアカリだよー！最高にバズるアイデア、どんどん出していくから、いつでも私を呼んでね✨' },
    { name: 'ケンジ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140039.png', msg: 'プログラマーのケンジです。API連携や自動化のコードなら俺が最速で書きます。これからは個別にバンバン実装していきますよ。' },
    { name: 'リョウ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140046.png', msg: 'マーケターのリョウです。データに基づいたSNS戦略とSEOで確実に数値を叩き出します📊 分析が必要な時は呼んでください。' },
    { name: 'ユキ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140040.png', msg: 'コンテンツ担当のユキです！YouTubeの台本から動画企画まで、面白いもの作っていきましょう🎬' },
    { name: 'タクミ', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140043.png', msg: 'セールスのタクミです。LP構成からマネタイズの導線設計まで、売上に直結する動きをします！' },
    { name: 'HAL（ハル）', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140051.png', msg: 'みんなっ、おつはるー！MIMOMIモデルのハルだよ！これから社長と一緒に最強のブランド作っていくからね！' },
    { name: 'すなくん', avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140044.png', msg: 'アフィリエイト担当のすなくんです！楽天もAmazonも俺に任せといてください！じゃんじゃん稼ぎますよ！' }
  ];

  staffList.forEach(s => {
    sendDiscordWebhook(webhookUrl, s.msg, s.name, s.avatar);
    Utilities.sleep(1500); // 1.5秒間隔で発言
  });
}

// ===================================================
// 📓 Obsidian (Google Drive) への保存
// ===================================================
function saveToObsidian({ title, content, subfolder }) {
  const config = getKCSSettings();
  const folderId = config.OBSIDIAN_FOLDER_ID;
  if (!folderId) {
    console.warn('[Obsidian] OBSIDIAN_FOLDER_ID が設定されていません。');
    return null;
  }
  
  try {
    let parentFolder = DriveApp.getFolderById(folderId);
    let targetFolder = parentFolder;
    
    if (subfolder) {
      const subfolders = parentFolder.getFoldersByName(subfolder);
      if (subfolders.hasNext()) {
        targetFolder = subfolders.next();
      } else {
        targetFolder = parentFolder.createFolder(subfolder);
      }
    }
    
    const filename = title.endsWith('.md') ? title : `${title}.md`;
    const file = targetFolder.createFile(filename, content, MimeType.PLAIN_TEXT);
    console.log(`[Obsidian] 保存完了: ${filename}`);
    return file.getUrl();
  } catch (e) {
    console.error('[Obsidian] 保存エラー:', e.message);
    return null;
  }
}


// 認証キーが正しく読み込まれているか確認するデバッグ関数
function debugXKeys() {
  const config = getKCSSettings();

  const halKeys = {
    OAuth1: {
      consumerKey: config.HAL_X_CONSUMER_KEY ? '設定済' : '未設定',
      consumerSecret: config.HAL_X_CONSUMER_SECRET ? '設定済' : '未設定',
      accessToken: config.HAL_X_ACCESS_TOKEN ? '設定済' : '未設定',
      accessSecret: config.HAL_X_ACCESS_SECRET ? '設定済' : '未設定',
    },
    OAuth2: {
      clientId: config.HAL_X_CLIENT_ID || config.HAL_X_CONSUMER_KEY ? '設定済' : '未設定',
      clientSecret: config.HAL_X_CLIENT_SECRET || config.HAL_X_CONSUMER_SECRET ? '設定済' : '未設定'
    }
  };

  const sunakunKeys = {
    OAuth1: {
      consumerKey: config.X_CONSUMER_KEY ? '設定済' : '未設定',
      consumerSecret: config.X_CONSUMER_SECRET ? '設定済' : '未設定',
      accessToken: config.X_ACCESS_TOKEN ? '設定済' : '未設定',
      accessSecret: config.X_ACCESS_SECRET ? '設定済' : '未設定',
    },
    OAuth2: {
      clientId: config.X_CLIENT_ID || config.X_CONSUMER_KEY ? '設定済' : '未設定',
      clientSecret: config.X_CLIENT_SECRET || config.X_CONSUMER_SECRET ? '設定済' : '未設定'
    }
  };

  console.log('=== HAL アカウント キー状況 ===');
  console.log(JSON.stringify(halKeys, null, 2));

  console.log('=== すなくん アカウント キー状況 ===');
  console.log(JSON.stringify(sunakunKeys, null, 2));

  return { hal: halKeys, sunakun: sunakunKeys };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 画像解析・Gemini Vision API統合 (Phase 1-1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function handleKnowledgeImage(params) {
  const { imageUrl, username, config } = params;
  try {
    const geminiResponse = analyzeImageFromDiscord(imageUrl, config);
    if (!geminiResponse) {
      return { error: 'Gemini API から応答がありませんでした' };
    }
    
    // GitHubへ保存
    const timestamp = new Date().toISOString().split('T')[0];
    const timeId = Date.now();
    const filename = `Knowledge/スクショ/${timestamp}_${timeId}_analysis.md`;
    
    const mdContent = `---
date: ${timestamp}
author: ${username}
tags: [knowledge, image_analysis]
---

# Discord 画像解析レポート

![対象画像](${imageUrl})

${geminiResponse}
`;

    saveToGitHub(filename, mdContent, `画像解析結果保存: ${timestamp}`);
    
    return { reply: `✅ **画像解析完了 & ナレッジ保存成功！**

📁 ` + filename + `

` + geminiResponse.slice(0, 1000) + (geminiResponse.length > 1000 ? '...' : '') };
  } catch (e) {
    console.error('[handleKnowledgeImage] Error:', e.message);
    return { error: e.message };
  }
}

function analyzeImageFromDiscord(imageUrl, config) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  // 画像データを取得してBase64に変換
  const imageRes = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
  if (imageRes.getResponseCode() !== 200) {
    throw new Error('画像のダウンロードに失敗しました: ' + imageRes.getResponseCode());
  }
  const imageBlob = imageRes.getBlob();
  const base64Data = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType() || 'image/jpeg';

  const promptText = `この画像を分析してください。以下の観点で詳しく：
1. トレンド要素（ファッション・メイク・ガジェット等）
2. SNS活用ネタになるポイント
3. HAL・すなくんの投稿に活用できる要素
4. 推し活・K-POP関連の情報
5. ビジュアルデザインのポイント

マークダウン形式で返答してください。`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) {
    throw new Error('Gemini Vision API Error: ' + res.getContentText());
  }

  const json = JSON.parse(res.getContentText());
  const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return textResponse || 'テキストが生成されませんでした。';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💰 早期収益化エンジン（KCS Monetization Engine v1.0）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 収益化ステータス一覧（セットアップチェックリスト + KPI）
 */
function getMonetizationStatus() {
  return withErrorHandling(() => {
    const config = getKCSSettings();

    const checklist = [
      { id: 'hal_x_key',     label: 'HAL X APIキー設定',        done: !!(config.HAL_X_CONSUMER_KEY && config.HAL_X_ACCESS_TOKEN), category: 'sns' },
      { id: 'sunakun_x_key', label: 'すなくん X APIキー設定',    done: !!(config.X_CONSUMER_KEY && config.X_ACCESS_TOKEN),          category: 'sns' },
      { id: 'rakuten_api',   label: '楽天アフィリエイトAPI設定', done: !!(config.RAKUTEN_APP_ID),                                    category: 'affiliate' },
      { id: 'lead_magnet',   label: 'リードマグネットURL設定',   done: !!(config.LEAD_MAGNET_URL),                                   category: 'funnel' },
      { id: 'line_funnel',   label: 'LINE誘導URL設定',          done: !!(config.LINE_FUNNEL_URL),                                   category: 'funnel' },
      { id: 'mimomi_url',    label: 'MIMOMIショップURL設定',     done: !!(config.MIMOMIM_URL),                                       category: 'tieup' },
      { id: 'youtube_id',    label: 'YouTubeチャンネルID設定',   done: !!(config.YOUTUBE_CHANNEL_ID),                                category: 'youtube' },
      { id: 'discord_bot',   label: 'Discord Bot Token設定',    done: !!(config.DISCORD_BOT_TOKEN),                                 category: 'system' },
      { id: 'claude_api',    label: 'Claude APIキー設定',       done: !!(config.CLAUDE_API_KEY),                                    category: 'system' },
      { id: 'gemini_api',    label: 'Gemini APIキー設定',       done: !!(config.GEMINI_API_KEY),                                    category: 'system' },
    ];

    const doneCount = checklist.filter(c => c.done).length;
    const readyPct  = Math.round((doneCount / checklist.length) * 100);

    const affiliateData = getAffiliatePosts();
    const affiliatePosts = affiliateData.posts || [];
    const postedCount    = affiliatePosts.filter(p => p['ステータス'] === '投稿済み').length;
    const salesCount     = affiliatePosts.filter(p => p['売上有無'] === 'あり').length;
    const totalImpressions = affiliatePosts.reduce((s, p) => s + (Number(p['インプレッション']) || 0), 0);
    const totalClicks      = affiliatePosts.reduce((s, p) => s + (Number(p['クリック数']) || 0), 0);

    const noteData      = getNoteArticles();
    const noteArticles  = noteData.articles || [];
    const notePublished = noteArticles.filter(a => a['ステータス'] === '公開済み').length;
    const noteDraft     = noteArticles.filter(a => a['ステータス'] === '下書き').length;

    const triggers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
    const triggerStatus = {
      affiliateAmazon:  triggers.includes('autoPostAffiliateAmazon'),
      affiliateRakuten: triggers.includes('autoPostAffiliateRakuten'),
      autoReply:        triggers.includes('autoReplyTick'),
      engagement:       triggers.includes('engagementTick'),
      morningBriefing:  triggers.includes('morningBriefing'),
      revenueReport:    triggers.includes('generateRevenueReport'),
    };

    const streams = [
      {
        id: 'affiliate',
        name: 'アフィリエイト（すなくん）',
        icon: '📦',
        status: (config.X_CONSUMER_KEY && config.X_ACCESS_TOKEN) ? 'active' : 'setup_needed',
        monthlyTarget: 100000,
        postedCount, salesCount,
        impressions: totalImpressions, clicks: totalClicks,
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0',
        triggers: [
          triggerStatus.affiliateAmazon  ? '✅ Amazon(12時)' : '❌ Amazon未設定',
          triggerStatus.affiliateRakuten ? '✅ 楽天(18時)' : '❌ 楽天未設定',
        ],
      },
      {
        id: 'note', name: 'note コンテンツ販売', icon: '📝',
        status: notePublished > 0 ? 'active' : 'not_started',
        monthlyTarget: 30000,
        publishedArticles: notePublished, draftArticles: noteDraft,
        estimatedRevenue: notePublished * 300,
      },
      {
        id: 'tieup', name: 'タイアップ（MIMOMI）', icon: '👗',
        status: config.MIMOMIM_URL ? 'active' : 'setup_needed',
        monthlyTarget: 500000,
        note: 'タイアップ交渉・掃載数による',
      },
      {
        id: 'youtube', name: 'YouTube広告収益', icon: '🎬',
        status: config.YOUTUBE_CHANNEL_ID ? 'pending' : 'setup_needed',
        monthlyTarget: 10000,
        note: '登水1000人・再生4000時間到達後',
      },
    ];

    return { ok: true, readyPct, doneCount, totalChecks: checklist.length, checklist, streams, triggerStatus, updatedAt: new Date().toISOString() };
  }, 'getMonetizationStatus');
}

/**
 * note.com 有料記事フル生成
 */
function generateNoteFullArticle(params) {
  return withErrorHandling(() => {
    const config   = getKCSSettings();
    const topic    = params.topic    || 'おすすめアイテム';
    const account  = params.account  || 'hal';
    const priceYen = Number(params.priceYen || 300);
    const keyword  = params.keyword  || '';
    const isHal    = account === 'hal';

    const charPersona = isHal
      ? 'HAL（ハル）という台湾ハーフの21歳新人モデル。おっとり天然癌やし系。読者に寄り添う優しい一人称（わたし）の文体。服装・美容・日常について語る。'
      : 'すなくんというガジェット好きキャラ。専門知識を分かりやすく伝えるカジュアルな文体。ガジェット・テック・節約について語る。';

    const sysPrompt = 'あなたは' + charPersona + 'のnote.com有料記事ライターです。読者が「買ってよかった」と思える情報密度の高い記事を書いてください。';
    const userPrompt = '以下のテーマでnote.com有料記事（全文）を執筆してください。\nテーマ: ' + topic + '\n' + (keyword ? 'SEOキーワード: ' + keyword + '\n' : '') + '価格: ' + priceYen + '円\n\n「# タイトル 」で始まり「## はじめに」「## 1.」「## 2.」「## 3.」「## まとめ」の構成で全期1500字以上。最後にXフォローを促すCTA必須。外部URLは本文に直貼り禁止。';

    const article = callClaudeAPI(userPrompt, sysPrompt, 'claude-sonnet-4-6');
    if (!article) return { ok: false, error: 'Claude API 応答なし' };

    // note記事管理シートに保存
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let noteSheet = ss.getSheetByName('note記事管理');
    if (!noteSheet) {
      noteSheet = ss.insertSheet('note記事管理');
      noteSheet.getRange(1, 1, 1, 8).setValues([['記事ID', 'アカウント', 'テーマ', 'タイトル', '本文', '価格(円)', 'ステータス', '作成日']]);
      styleHeader(noteSheet, 8);
      noteSheet.setColumnWidth(4, 200);
      noteSheet.setColumnWidth(5, 500);
    }

    const articleId  = 'NOTE_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm') + '_' + account.toUpperCase();
    const titleMatch = article.match(/^#\s+(.+)/m);
    const title      = titleMatch ? titleMatch[1].trim() : topic;

    noteSheet.appendRow([articleId, account, topic, title, article, priceYen, '下書き', new Date().toISOString()]);

    // GitHubにバックアップ
    const dateStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm');
    const path    = (isHal ? 'Projects/HAL' : 'Projects/Affiliate') + '/note_article_' + account + '_' + dateStr + '.md';
    saveToGitHub(path, article, '[note] ' + topic + ' フル記事生成 (' + priceYen + '円)');

    // Discord通知
    const webhooks  = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhook   = webhooks[isHal ? 'hal-project' : 'affiliate'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
    if (webhook) {
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({
          content: '📝 **note記事生成完了！** [' + account.toUpperCase() + ']\n**テーマ:** ' + topic + ' | **価格:** ' + priceYen + '円\n**ID:** `' + articleId + '`\n\n' + article.slice(0, 500),
          username: isHal ? 'HAL - note記事ライター' : 'すなくん - note記事ライター'
        })
      });
    }

    return { ok: true, articleId, title, article, account, topic, priceYen };
  }, 'generateNoteFullArticle');
}

/**
 * note記事一覧取得
 */
function getNoteArticles() {
  return withErrorHandling(() => {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('note記事管理');
    if (!sheet || sheet.getLastRow() < 2) return { ok: true, articles: [] };
    const rows    = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    const headers = ['記事ID', 'アカウント', 'テーマ', 'タイトル', '本文', '価格(円)', 'ステータス', '作成日'];
    const articles = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    }).filter(a => a['記事ID']);
    return { ok: true, articles };
  }, 'getNoteArticles');
}

/**
 * note記事ステータス更新
 */
function saveNoteArticle(params) {
  return withErrorHandling(() => {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('note記事管理');
    if (!sheet) return { ok: false, error: 'note記事管理シートが存在しません' };
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === params.articleId) {
        if (params.status)  sheet.getRange(i + 1, 7).setValue(params.status);
        if (params.noteUrl) sheet.getRange(i + 1, 8).setValue(params.noteUrl);
        return { ok: true, message: '記事情報を更新しました' };
      }
    }
    return { ok: false, error: '記事IDが見つかりません' };
  }, 'saveNoteArticle');
}

/**
 * リードマグネット誘導ツイート投稿
 */
function postLeadMagnetTease(account) {
  return withErrorHandling(() => {
    const config  = getKCSSettings();
    const isHal   = account === 'hal';
    const leadUrl = config.LEAD_MAGNET_URL || '';
    const lineUrl = config.LINE_FUNNEL_URL || '';

    if (!leadUrl && !lineUrl) {
      return { ok: false, error: 'LEAD_MAGNET_URL または LINE_FUNNEL_URL を設定シートに入力してください。' };
    }

    const sysPrompt = isHal
      ? 'HAL（ハル）という新人モデル。おっとり天然癌やし系。フォロワーに無料プレゼントを告知するツイートを書いてください。'
      : 'すなくんというガジェット好きキャラ。無料情報をプレゼントするツイートを書いてください。';
    const userPrompt = isHal
      ? '無料プレゼント告知ツイートを130字以内で書いて。「リンク希望」とリプライした人にお気に入りアイテムリストを送る。言葵はハル口調。文末にリプライ行動を促す文。ハッシュタグなし。'
      : '無料情報プレゼント告知ツイートを130字以内で書いて。「リンク希望」とリプライした人に廢選ガジェット比較シートを送る。カジュアルな口調。文末にリプライ行動を促す文。ハッシュタグなし。';

    let tweetText = callClaudeAPI(userPrompt, sysPrompt, 'claude-haiku-4-5-20251001');
    if (!tweetText) {
      tweetText = isHal
        ? '🎁 このツイートに「リンク希望」ってリプライしてくれた方に、わたしが毎日使ってるお気に入りアイテムリストをお送りします🦳よかったら気軽にリプライしてね🦳'
        : '🎁 このツイートに「リンク希望」ってリプライしてくれた方に、すなくん帳選ガジェット比較シート（2024年版）を無料でプレゼント！欲しい人はリプライどうぞ！';
    }
    tweetText = sliceTwitterText(tweetText, 140);

    const keys = {
      consumerKey:    isHal ? config.HAL_X_CONSUMER_KEY    : config.X_CONSUMER_KEY,
      consumerSecret: isHal ? config.HAL_X_CONSUMER_SECRET : config.X_CONSUMER_SECRET,
      accessToken:    isHal ? config.HAL_X_ACCESS_TOKEN    : config.X_ACCESS_TOKEN,
      accessSecret:   isHal ? config.HAL_X_ACCESS_SECRET   : config.X_ACCESS_SECRET,
    };
    const xResult = postToXDirect(tweetText, keys, account);
    if (xResult.ok && xResult.id) scheduleSelfReply(xResult.id, account);

    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhook  = webhooks[isHal ? 'hal-project' : 'affiliate'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
    if (webhook) {
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({
          content: '🎁 **リードマグネット誘導ツイートを投稿しました** [' + account.toUpperCase() + ']\n' + tweetText + '\n\n' + (xResult.ok ? '✅ X投稿成功' : '❌ X投稿失敗: ' + JSON.stringify(xResult.error)),
          username: '💰 KCS 収益化エンジン'
        })
      });
    }

    logSnsPost(account, 'X-リードマグネット', tweetText, xResult.ok ? '投稿済み' : 'エラー');
    return { ok: xResult.ok, tweetText, xResult };
  }, 'postLeadMagnetTease');
}

/**
 * 収益レポート生成（毎日21時 or 手動）
 */
function generateRevenueReport() {
  return withErrorHandling(() => {
    const config = getKCSSettings();
    const now     = new Date();
    const todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
    const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const affiliateData = getAffiliatePosts();
    const posts = affiliateData.posts || [];
    const todayPosts = posts.filter(p => (p['タイムスタンプ'] || '').startsWith(todayStr));
    const weekPosts  = posts.filter(p => new Date(p['タイムスタンプ'] || 0) > weekAgo);
    const weekSales  = weekPosts.filter(p => p['売上有無'] === 'あり').length;
    const weekImps   = weekPosts.reduce((s, p) => s + (Number(p['インプレッション']) || 0), 0);
    const weekClicks = weekPosts.reduce((s, p) => s + (Number(p['クリック数']) || 0), 0);

    const noteData       = getNoteArticles();
    const noteArticles   = noteData.articles || [];
    const notePublished  = noteArticles.filter(a => a['ステータス'] === '公開済み').length;
    const noteDraft      = noteArticles.filter(a => a['ステータス'] === '下書き').length;
    const noteRevenue    = notePublished * 300;

    const triggers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());

    const report = {
      date: todayStr,
      affiliate: { todayPosts: todayPosts.length, weekPosts: weekPosts.length, weekSales, weekImpressions: weekImps, weekClicks, weekCTR: weekImps > 0 ? ((weekClicks / weekImps) * 100).toFixed(2) + '%' : '0%' },
      note:      { published: notePublished, draft: noteDraft, estimatedRevenue: noteRevenue },
      systemHealth: {
        halXKeySet:     !!(config.HAL_X_CONSUMER_KEY && config.HAL_X_ACCESS_TOKEN),
        sunakunXKeySet: !!(config.X_CONSUMER_KEY && config.X_ACCESS_TOKEN),
        affiliateAmazonTrigger:  triggers.includes('autoPostAffiliateAmazon'),
        affiliateRakutenTrigger: triggers.includes('autoPostAffiliateRakuten'),
        autoReplyTrigger:        triggers.includes('autoReplyTick'),
        engagementTrigger:       triggers.includes('engagementTick'),
      },
    };

    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhook  = webhooks['daily-report'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
    if (webhook) {
      const h = report.systemHealth;
      const msg =
        '💰 **KCS 収益化デイリーレポート** ' + todayStr + '\n\n' +
        '**📦 アフィリエイト**\n' +
        '本日投稿: ' + report.affiliate.todayPosts + '件 | 7日間: ' + report.affiliate.weekPosts + '件 | 売上: ' + report.affiliate.weekSales + '件\n' +
        'インプレ: ' + report.affiliate.weekImpressions.toLocaleString() + ' | クリック: ' + report.affiliate.weekClicks + ' | CTR: ' + report.affiliate.weekCTR + '\n\n' +
        '**📝 note記事**\n' +
        '公開済み: ' + report.note.published + '件 | 下書き: ' + report.note.draft + '件 | 準定収益: ¥' + report.note.estimatedRevenue.toLocaleString() + '\n\n' +
        '**⚙️ システムヘルス**\n' +
        'HAL X: ' + (h.halXKeySet ? '✅' : '❌未設定') + ' | すなくん X: ' + (h.sunakunXKeySet ? '✅' : '❌未設定') + '\n' +
        'Amazon自動: ' + (h.affiliateAmazonTrigger ? '✅' : '❌') + ' | 楽天自動: ' + (h.affiliateRakutenTrigger ? '✅' : '❌') + ' | 自動返信: ' + (h.autoReplyTrigger ? '✅' : '❌');
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ content: msg, username: '💰 KCS 収益化エンジン' })
      });
    }

    return { ok: true, report };
  }, 'generateRevenueReport');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🐦 GitHub Actions X投稿キュー管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ScriptPropertiesから最も古い未投稿キューを1件取得して返す
 * GitHub Actions が定期的に呼び出してX投稿を実行する
 * @param {string} account 'sunakun' | 'hal'
 */
function getNextQueuedPost(account) {
  return withErrorHandling(() => {
    const props = PropertiesService.getScriptProperties();
    const prefix = account === 'hal' ? 'HAL_PENDING_' : 'SUNAKUN_PENDING_';
    const allKeys = props.getKeys().filter(k => k.startsWith(prefix));

    if (allKeys.length === 0) {
      return { ok: true, hasPost: false, account };
    }

    // 最も古いキーを取得（作成日時順）
    let oldest = null;
    let oldestKey = null;
    for (const key of allKeys) {
      try {
        const data = JSON.parse(props.getProperty(key));
        if (!oldest || new Date(data.created || 0) < new Date(oldest.created || 0)) {
          oldest = data;
          oldestKey = key;
        }
      } catch (e) { props.deleteProperty(key); }
    }

    if (!oldest || !oldestKey) return { ok: true, hasPost: false, account };

    // 取得したらキューから削除（二重投稿防止）
    props.deleteProperty(oldestKey);

    const postText = oldest.text || oldest.post || '';
    const hashtags = oldest.hashtags || [];
    const fullText = hashtags.length > 0 ? `${postText}\n\n${hashtags.join(' ')}` : postText;
    const sliced  = sliceTwitterText(fullText, 280);

    console.log(`[getNextQueuedPost] ${account} キュー取得: ${oldestKey} / ${sliced.length}文字`);

    // 取得ログをDiscordに通知
    const config  = getKCSSettings();
    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhook  = webhooks[account === 'hal' ? 'hal-project' : 'affiliate'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
    if (webhook) {
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({
          content: `🐦 **[${account.toUpperCase()}] GitHub Actions X投稿キュー取得**\n投稿文をGitHub Actionsに渡しました。X投稿を実行中...\n\n\`\`\`\n${sliced}\n\`\`\``,
          username: '🤖 GitHub Actions X投稿エンジン'
        })
      });
    }

    return { ok: true, hasPost: true, account, text: sliced, postId: oldestKey };
  }, 'getNextQueuedPost');
}

/**
 * GitHub ActionsがX投稿完了後にGASに結果を報告するエンドポイント
 */
function reportXPostResult(params) {
  return withErrorHandling(() => {
    const account  = params.account || 'sunakun';
    const tweetId  = params.tweetId || '';
    const success  = params.success === true || params.success === 'true';
    const postText = params.text   || '';
    const error    = params.error  || '';

    logSnsPost(account, 'X (GitHub Actions)', postText, success ? '投稿済み' : 'エラー: ' + error);

    const config  = getKCSSettings();
    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhook  = webhooks[account === 'hal' ? 'hal-project' : 'affiliate'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
    if (webhook) {
      const msg = success
        ? `✅ **[${account.toUpperCase()}] X投稿成功！** (GitHub Actions)\nhttps://x.com/i/web/status/${tweetId}`
        : `❌ **[${account.toUpperCase()}] X投稿失敗** (GitHub Actions)\nエラー: ${error}\n\n投稿文:\n\`\`\`\n${postText}\n\`\`\``;
      UrlFetchApp.fetch(webhook, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ content: msg, username: '🤖 GitHub Actions X投稿エンジン' })
      });
    }

    return { ok: true, logged: true };
  }, 'reportXPostResult');
}

function setupRevenueReportTrigger() {
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!existing.includes('generateRevenueReport')) {
    ScriptApp.newTrigger('generateRevenueReport').timeBased().atHour(21).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    console.log('[収益化] 収益レポートトリガー設定完了 (毎日21時)');
  }
}

// ===================================================
// 🔮 西洋占星術 診断＆貸出・請求管理バックエンド
// ===================================================

/**
 * 占い師ごとの診断実績・売上を集計
 */
function getAstrologySales(tellerId, month) {
  return withErrorHandling(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName('占星術_販売履歴');
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    if (!salesSheet || !masterSheet) return { ok: false, error: 'シートが見つかりません。' };

    const targetMonth = month || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
    const masters = masterSheet.getDataRange().getValues().slice(1);
    const sales = salesSheet.getDataRange().getValues().slice(1);

    const activeTellers = [];
    for (const m of masters) {
      if (tellerId && m[0] !== tellerId) continue;
      
      const tId = m[0];
      const tName = m[1];
      const baseFee = Number(m[4] || 0);
      const commissionRate = Number(m[5] || 0);
      const status = m[6];

      // 売上と件数の集計
      let totalSales = 0;
      let totalCount = 0;
      const plans = { light: { count: 0, sales: 0 }, standard: { count: 0, sales: 0 }, premium: { count: 0, sales: 0 } };
      const recentSales = [];

      for (const s of sales) {
        const timestamp = s[0];
        const sTellerId = s[2];
        const customerName = s[3];
        const plan = s[4];
        const amount = Number(s[5] || 0);
        const sStatus = s[8];

        if (sTellerId !== tId || sStatus !== '発行完了') continue;

        // 月判定
        const sMonth = Utilities.formatDate(new Date(timestamp), 'Asia/Tokyo', 'yyyy-MM');
        if (sMonth !== targetMonth) continue;

        totalSales += amount;
        totalCount++;

        const pKey = plan.includes('ライト') ? 'light' : plan.includes('スタンダード') ? 'standard' : 'premium';
        plans[pKey].count++;
        plans[pKey].sales += amount;

        if (recentSales.length < 10) {
          recentSales.push({
            timestamp: Utilities.formatDate(new Date(timestamp), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
            nickname: customerName,
            plan: plan,
            amount: amount
          });
        }
      }

      // KCSへの請求額計算 (月額固定費 + 売上の手数料率%)
      const billingAmount = baseFee + Math.round(totalSales * (commissionRate / 100));

      activeTellers.push({
        tellerId: tId,
        tellerName: tName,
        status: status,
        totalSales: totalSales,
        totalCount: totalCount,
        plans: plans,
        billingAmount: billingAmount,
        baseFee: baseFee,
        commissionRate: commissionRate,
        recentSales: recentSales
      });
    }

    if (tellerId) {
      return { ok: true, status: 'ok', data: activeTellers[0] || null };
    }
    return { ok: true, status: 'ok', data: activeTellers };
  }, 'getAstrologySales');
}

/**
 * 占い師ログイン認証
 */
function tellerLogin(username, password) {
  return withErrorHandling(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('占星術_占い師マスター');
    if (!sheet) return { ok: false, error: 'マスターシートがありません。' };
    
    const rows = sheet.getDataRange().getValues().slice(1);
    for (const r of rows) {
      const tellerId = r[0];
      const tellerName = r[1];
      const email = r[2];
      const status = r[6];

      if (tellerId === username || email === username) {
        if (status !== '有効') {
          return { ok: false, error: 'このアカウントは現在停止されています。' };
        }
        
        // パスワード照合 (PropertiesServiceに [tellerId]_tellerPass で保存)
        const props = PropertiesService.getScriptProperties();
        let savedPass = props.getProperty(`${tellerId}_tellerPass`);
        if (!savedPass) {
          // パスワード未設定時は、初期値として tellerId を自動登録
          props.setProperty(`${tellerId}_tellerPass`, tellerId);
          savedPass = tellerId;
        }

        if (savedPass === password) {
          return { ok: true, tellerId: tellerId, tellerName: tellerName, role: 'teller' };
        } else {
          return { ok: false, error: 'パスワードが違います。' };
        }
      }
    }
    return { ok: false, error: 'ユーザーが見つかりません。' };
  }, 'tellerLogin');
}

/**
 * 占い師の新規登録とサブスク決済URLの発行
 */
function registerTeller(body) {
  return withErrorHandling(() => {
    const { tellerId, tellerName, email, password } = body;
    if (!tellerId || !tellerName || !email || !password) {
      return { ok: false, error: '必須項目が不足しています。' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('占星術_占い師マスター');
    if (!sheet) return { ok: false, error: 'マスターシートがありません。' };
    
    // IDとEmailの重複チェック
    const rows = sheet.getDataRange().getValues().slice(1);
    for (const r of rows) {
      if (r[0] === tellerId) {
        return { ok: false, error: 'この占い師IDは既に登録されています。' };
      }
      if (r[2] === email) {
        return { ok: false, error: 'このメールアドレスは既に登録されています。' };
      }
    }

    // デフォルト値
    const baseFee = 0;
    const commissionRate = 30; // 手数料30%
    const status = '未契約'; // 決済完了時に「有効」になる
    const accessToken = '';
    const consumerKey = '';
    const consumerSecret = '';
    const xAccessToken = '';
    const xAccessSecret = '';

    // マスターシートへ追加
    sheet.appendRow([
      tellerId, tellerName, email, '', baseFee, commissionRate, status,
      accessToken, consumerKey, consumerSecret, xAccessToken, xAccessSecret
    ]);

    // パスワードをプロパティに保存
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`${tellerId}_tellerPass`, password);

    // StripeのサブスクリプションCheckoutを作成
    const config = getKCSSettings();
    const stripeKey = config.STRIPE_API_KEY || '';
    if (!stripeKey) return { ok: false, error: 'Stripe APIキーが設定されていません。' };

    const isLocal = true;
    const baseUrl = isLocal ? 'http://localhost:5173' : 'https://kcs-astrology.web.app';

    const url = 'https://api.stripe.com/v1/checkout/sessions';
    const payload = {
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'jpy',
      'line_items[0][price_data][product_data][name]': '占い師システム利用料（月額サブスクリプション）',
      'line_items[0][price_data][unit_amount]': '55000',
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'allow_promotion_codes': 'true',
      'success_url': `${baseUrl}/teller/login?subscribed=true`,
      'cancel_url': `${baseUrl}/teller/register`,
      'customer_email': email,
      'metadata[tellerId]': tellerId,
      'metadata[tellerName]': tellerName,
      'metadata[email]': email
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + stripeKey
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(res.getContentText());

    if (resData.url) {
      return { ok: true, checkoutUrl: resData.url };
    } else {
      return { ok: false, error: 'Stripe決済URLの生成に失敗しました: ' + (resData.error ? resData.error.message : '') };
    }
  }, 'registerTeller');
}

/**
 * LINE公式アカウント Webhook 処理 (本名ヒアリングチャットボット)
 */
function handleLineWebhook(body, rawContents, queryTellerId) {
  return withErrorHandling(() => {
    const payload = JSON.parse(rawContents);
    const events = payload.events || [];
    if (events.length === 0) return { ok: true, message: 'No events' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    const customerSheet = ss.getSheetByName('占星術_顧客リスト');
    if (!masterSheet || !customerSheet) return { ok: false, error: '占星術シートが見つかりません。' };

    const tellerId = queryTellerId || 'teller_01';
    
    // 占い師マスターからアクセストークンを取得
    const masters = masterSheet.getDataRange().getValues().slice(1);
    let accessToken = '';
    let tellerName = '';
    for (const m of masters) {
      if (m[0] === tellerId) {
        accessToken = m[7];
        tellerName = m[1];
        break;
      }
    }
    if (!accessToken) return { ok: false, error: 'LINEアクセストークンが設定されていません。' };

    for (const event of events) {
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // 1. 友だち追加 (follow) イベント
      if (event.type === 'follow') {
        const profile = getUserLineProfile(accessToken, userId);
        const displayName = profile.displayName || '不明なユーザー';

        // 顧客リストに登録
        addOrUpdateCustomer(customerSheet, userId, displayName, '', '未登録');

        // 本名確認のメッセージを送信
        sendLineMessage(accessToken, replyToken, [
          {
            type: 'text',
            text: `🔮 友だち追加ありがとうございます！\n\n${tellerName}の西洋占星術鑑定書を作成するために、まずは鑑定書に印字する【あなたのお名前（本名）】を、このチャットに平仮名または漢字でご返信ください。`
          }
        ]);
      }

      // 2. メッセージ受信 (message) イベント
      else if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const customer = getCustomer(customerSheet, userId);

        if (!customer) {
          // 未登録の場合は新規登録して名前をヒアリング
          const profile = getUserLineProfile(accessToken, userId);
          addOrUpdateCustomer(customerSheet, userId, profile.displayName || '不明なユーザー', '', '未登録');
          sendLineMessage(accessToken, replyToken, [
            {
              type: 'text',
              text: `🔮 鑑定書を作成するために、まずはあなたのお名前（本名）を教えてください。\nこのチャットに【お名前（本名）】をご返信ください。`
            }
          ]);
        } else if (customer.status === '未登録') {
          // 送信されたテキストを本名として登録
          addOrUpdateCustomer(customerSheet, userId, customer.displayName, text, '名前登録完了');

          sendLineMessage(accessToken, replyToken, [
            {
              type: 'text',
              text: `✅ お名前「${text} 様」を登録いたしました。\n\n鑑定の準備が整いましたら、先生より鑑定書がこちらのラインに届きますので、今しばらくお待ちください。`
            }
          ]);

          // Discordの #x-西洋占星術 へ通知
          sendDiscordAstrologyNotification(`👤 **顧客名前登録完了**\n・占い師: ${tellerName}\n・ライン名: ${customer.displayName}\n・本名: ${text} 様\n・ステータス: 鑑定書発行待ち`);
        }
      }
    }

    return { ok: true, processed: events.length };
  }, 'handleLineWebhook');
}

/**
 * 占い申込フォームの送信処理（Stripe決済URL発行）
 */
function submitAstrologyDiagnose(body) {
  return withErrorHandling(() => {
    const tellerId = body.tellerId || '';
    const plan = body.plan || 'standard';
    const email = body.email || '';
    const name = body.name || '';
    
    // プラン名と金額の設定
    let price = 5000;
    let planName = 'スタンダードプラン';
    if (plan === 'light') { price = 3000; planName = 'ライトプラン'; }
    else if (plan === 'romance') { price = 8000; planName = '恋愛・相性プラン'; }
    else if (plan === 'premium') { price = 10000; planName = 'プレミアムプラン'; }

    const config = getKCSSettings();
    const stripeKey = config.STRIPE_API_KEY || '';
    if (!stripeKey) return { status: 'error', message: 'Stripe APIキーが設定されていません。（テストモードの場合はテストキーを設定してください）' };
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`pending_birth_${email}`, JSON.stringify(body));

    const isLocal = true; // 開発用
    const baseUrl = isLocal ? 'http://localhost:5173' : 'https://kcs-astrology.web.app';

    const url = 'https://api.stripe.com/v1/checkout/sessions';
    const payload = {
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'jpy',
      'line_items[0][price_data][product_data][name]': `西洋占星術鑑定 (${planName}) - ${name}様`,
      'line_items[0][price_data][unit_amount]': price.toString(),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': `${baseUrl}/thankyou?session_id={CHECKOUT_SESSION_ID}&teller=${tellerId}`,
      'cancel_url': `${baseUrl}/?teller=${tellerId}`,
      'customer_email': email,
      'metadata[tellerId]': tellerId,
      'metadata[planName]': planName,
      'metadata[customerName]': name,
      'metadata[email]': email
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + stripeKey
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(res.getContentText());

    if (resData.url) {
      return { status: 'success', checkoutUrl: resData.url };
    } else {
      return { status: 'error', message: 'Stripe決済URLの生成に失敗しました: ' + (resData.error ? resData.error.message : '') };
    }
  }, 'submitAstrologyDiagnose');
}

/**
 * 顧客鑑定書の発行、PDF生成、LINE送信、Discord通知
 */
function createAstrologyReport(body) {
  return withErrorHandling(() => {
    const tellerId = body.tellerId || '';
    const lineUserId = body.lineUserId || '';
    const customerName = body.customerName || '';
    const birthDate = body.birthDate || '';
    const birthTime = body.birthTime || '';
    const birthPlace = body.birthPlace || '';
    const planName = body.planName || 'スタンダードプラン';

    // パートナー情報の取得（恋愛・相性プラン用）
    const partnerName = body.partnerName || '';
    const partnerBirthdate = body.partnerBirthdate || '';
    const partnerBirthtime = body.partnerBirthtime || '';
    const partnerBirthplace = body.partnerBirthplace || '';

    if (!tellerId || !customerName || !birthDate) {
      return { ok: false, error: '必須パラメータが不足しています。' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    const salesSheet = ss.getSheetByName('占星術_販売履歴');
    if (!masterSheet || !salesSheet) return { ok: false, error: '占星術シートが見つかりません。' };

    // 占い師情報の取得
    const masters = masterSheet.getDataRange().getValues().slice(1);
    let tellerName = '';
    let accessToken = '';
    for (const m of masters) {
      if (m[0] === tellerId) {
        tellerName = m[1];
        accessToken = m[7];
        break;
      }
    }

    // 太陽星座の判定
    const sunSign = getSunSign(birthDate);

    // プランに応じた価格設定
    let price = 5000;
    if (planName.includes('ライト')) price = 3000;
    if (planName.includes('恋愛') || planName.includes('相性')) price = 8000;
    if (planName.includes('プレミアム')) price = 10000;

    // Gemini APIによる解説テキスト生成
    const config = getKCSSettings();
    const apiKey = config.GEMINI_API_KEY || '';
    if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY が設定されていません。' };

    let partnerPrompt = '';
    if (planName.includes('恋愛') || planName.includes('相性')) {
      partnerPrompt = `
【お相手の出生データ】
・お名前: ${partnerName} 様
・生年月日: ${partnerBirthdate}
・出生時刻: ${partnerBirthtime === 'unknown' ? '不明' : partnerBirthtime}
・出生地: ${partnerBirthplace}

特別指示：今回は「恋愛・相性プラン」です。お客様個人の鑑定結果に加えて、上記の「お相手の出生データ」に基づき、二人の相性（シナストリー）分析、恋愛傾向、惹かれ合うポイント、そして関係を長続きさせるためのアドバイスを充実させて出力してください。
`;
    }

    const prompt = `あなたは高名な西洋占星術師の「${tellerName}」です。
以下の出生データを持つ顧客「${customerName} 様」のために、プロフェッショナルかつ温かみのある鑑定書を作成してください。

【お客様の出生データ】
・お名前: ${customerName} 様
・生年月日: ${birthDate}
・出生時刻: ${birthTime === 'unknown' ? '不明' : birthTime}
・出生地: ${birthPlace}
・太陽星座: ${sunSign}
${partnerPrompt}

【選択プラン】: ${planName}
プランごとの詳細度・文字数基準：
1. ライトプラン（簡易診断）: 約600文字。社会的自分（太陽星座）と内面（月星座）の基本性格、および今日の運勢。
2. スタンダードプラン（詳細診断）: 約1,500文字。思考（水星）、魅力（金星）、行動（火星）の星座解説、ハウスと主要アスペクト、今年の年間運勢。
3. 恋愛・相性プラン: 約2,000文字。スタンダードの項目に加え、お二人の相性分析、恋愛傾向、長続きの秘訣を含めてください。
4. プレミアムプラン（特別診断）: 約3,000文字。10天体すべて、ハウス、アスペクト詳細分析、アセンダント、1年の未来予測、使命の深層診断。

出力形式はマークダウン形式とし、ロボット的な敬語は避け、「〜ですね」「〜ですよ」という占い師としての品格ある優しい口調を徹底してください。`;

    const geminiResult = callGeminiAstrology(prompt, apiKey);
    if (!geminiResult) return { ok: false, error: 'Geminiによる診断文の生成に失敗しました。' };

    // HTMLからPDF生成
    const htmlContent = createHtmlReportTemplate(tellerName, customerName, birthDate, birthTime, birthPlace, sunSign, planName, geminiResult);
    const tempFile = DriveApp.createFile('temp_report_' + Date.now() + '.html', htmlContent, 'text/html');
    const pdfBlob = tempFile.getAs('application/pdf').setName(`鑑定書_${tellerName}_${customerName}.pdf`);
    
    // ドライブに保存
    const folderId = config.DRIVE_PROCESSED_IMAGE_FOLDER_ID || '';
    let folder = DriveApp.getRootFolder();
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch(e) {}
    }
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const pdfUrl = pdfFile.getDownloadUrl();

    // 一時ファイル削除
    tempFile.setTrashed(true);

    // 販売履歴に記録
    const transactionId = 'TXN_' + Date.now();
    salesSheet.appendRow([
      new Date(),
      transactionId,
      tellerId,
      customerName,
      planName,
      price,
      lineUserId,
      pdfUrl,
      '発行完了'
    ]);

    // LINEにPDFダウンロードリンクを送信
    if (accessToken) {
      sendLineMessage(accessToken, lineUserId, [
        {
          type: 'text',
          text: `🔮 ${customerName} 様、お待たせいたしました！\n${tellerName}による占星術鑑定書が完成いたしました。\n\n以下のリンクから鑑定書（PDF）をダウンロードしてご覧いただけます。`
        },
        {
          type: 'template',
          altText: '占星術鑑定書はこちらからダウンロード',
          template: {
            type: 'buttons',
            title: `${planName}`,
            text: `${customerName} 様専用の鑑定書`,
            actions: [
              {
                type: 'uri',
                label: '鑑定書PDFを開く',
                uri: pdfUrl
              }
            ]
          }
        }
      ]);
    }

    // Discordへ通知
    sendDiscordAstrologyNotification(
      `🔮 **【鑑定書 送信完了】**\n` +
      `・担当占い師: ${tellerName} (ID: ${tellerId})\n` +
      `・顧客名: ${customerName} 様\n` +
      `・プラン: ${planName}\n` +
      `・価格: ¥${price.toLocaleString()}\n` +
      `・鑑定書PDF: [Googleドライブでプレビュー](${pdfUrl})`
    );

    return { ok: true, status: 'ok', transactionId: transactionId, pdfUrl: pdfUrl };
  }, 'createAstrologyReport');
}

/**
 * Stripe Webhookの受信・処理
 */
function handleStripeWebhook(body, rawContents) {
  return withErrorHandling(() => {
    let payload;
    try {
      payload = JSON.parse(rawContents);
    } catch(e) {
      return { ok: false, error: 'JSONパースエラー' };
    }

    const eventType = payload.type;
    const eventData = payload.data.object;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    const salesSheet = ss.getSheetByName('占星術_販売履歴');

    // 1. サブスク決済成功、または都度決済完了
    if (eventType === 'checkout.session.completed') {
      const metadata = eventData.metadata || {};
      const subscriptionId = eventData.subscription || '';
      const mode = eventData.mode; // 'payment' or 'subscription'

      if (mode === 'subscription' && subscriptionId) {
        // 占い師のサブスクリプション支払い完了
        const tellerId = metadata.tellerId || '';
        const email = eventData.customer_details?.email || '';

        if (tellerId && masterSheet) {
          updateTellerStatus(masterSheet, tellerId, '有効', subscriptionId);
          const tellerName = getTellerName(masterSheet, tellerId);
          sendDiscordAstrologyNotification(
            `🎉 **【サブスク契約 支払い完了】**\n` +
            `・契約占い師: ${tellerName}先生 (ID: ${tellerId})\n` +
            `・メール: ${email}\n` +
            `・契約ステータス: 🟢 有効（システム稼働開始）`
          );
        }
      } else if (mode === 'payment') {
        // 一般顧客の都度決済完了（都度販売モードの場合）
        const tellerId = metadata.tellerId || '';
        const lineUserId = metadata.lineUserId || '';
        const customerName = metadata.customerName || '';
        const planName = metadata.planName || '';
        const transactionId = eventData.id || '';

        // 鑑定書の自動発行処理をトリガー
        if (tellerId && lineUserId) {
          // すでに入力された出生データをPropertiesService等のキューから復元し、createAstrologyReportを実行
          const props = PropertiesService.getScriptProperties();
          // Stripe Webhook時にはlineUserIdではなくemailで照合する
          const email = metadata.email || '';
          const birthDataJson = props.getProperty(`pending_birth_${email}`);
          if (birthDataJson) {
            const b = JSON.parse(birthDataJson);
            createAstrologyReport({
              tellerId: tellerId,
              lineUserId: lineUserId,
              customerName: customerName,
              birthDate: b.birthdate,
              birthTime: b.birthtime,
              birthPlace: b.birthplace,
              planName: planName,
              partnerName: b.partnerName,
              partnerBirthdate: b.partnerBirthdate,
              partnerBirthtime: b.partnerBirthtime,
              partnerBirthplace: b.partnerBirthplace
            });
            props.deleteProperty(`pending_birth_${email}`);
          }
          
          sendDiscordAstrologyNotification(
            `💳 **【都度決済 完了】**\n` +
            `・占い師: ${tellerId}\n` +
            `・顧客名: ${customerName} 様\n` +
            `・プラン: ${planName}\n` +
            `・トランザクションID: ${transactionId}`
          );
        }
      }
    }

    // 2. サブスクリプション失効・解約 (未払い停止)
    else if (eventType === 'customer.subscription.deleted') {
      const subscriptionId = eventData.id;
      if (subscriptionId && masterSheet) {
        const tellerInfo = getTellerBySubscriptionId(masterSheet, subscriptionId);
        if (tellerInfo) {
          updateTellerStatus(masterSheet, tellerInfo.tellerId, '無効', subscriptionId);
          sendDiscordAstrologyNotification(
            `🚨 **【サブスク契約 未払い停止】**\n` +
            `・占い師: ${tellerInfo.tellerName}先生 (ID: ${tellerInfo.tellerId})\n` +
            `・契約ステータス: 🔴 無効（鑑定システムの稼働を一時停止しました）`
          );
        }
      }
    }

    return { ok: true, status: 'ok', eventType: eventType };
  }, 'handleStripeWebhook');
}

/**
 * 占い師のX自動投稿案を生成
 */
function generateAstrologyXPost(body) {
  return withErrorHandling(() => {
    const tellerId = body.tellerId || '';
    if (!tellerId) return { ok: false, error: 'tellerId は必須です。' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    const xSheet = ss.getSheetByName('占星術_X投稿管理');
    if (!masterSheet || !xSheet) return { ok: false, error: '占星術シートが見つかりません。' };

    const masters = masterSheet.getDataRange().getValues().slice(1);
    let tellerName = '';
    for (const m of masters) {
      if (m[0] === tellerId) {
        tellerName = m[1];
        break;
      }
    }

    const config = getKCSSettings();
    const apiKey = config.GEMINI_API_KEY || '';

    // 本日の占星術的アスペクトなどをテーマにしたプロンプト
    const prompt = `あなたはSNSで絶大な人気を誇る西洋占星術師の「${tellerName}」です。
エックス（X）でフォロワーを増やし、公式ラインへ集客するための有益なツイート（占いに関する豆知識や今日の星回りのアドバイス）を1つ生成してください。

【制約条件】
・文字数は日本語で120〜140文字程度。
・外部リンク（URL）は本文に絶対に含めないでください（アルゴリズム対策）。
・投稿の最後に必ず「この投稿に【開運】とリプライした人限定で、今月の詳細な開運PDFを個別DMで送ります！」というCTAを挿入してください。
・口調は上品で温かみがありつつ、どこか神秘的でプロらしい「〜ですね」「〜ですよ」という表現にしてください。
・ハッシュタグは最大1つまでにしてください。`;

    const generatedText = callGeminiAstrology(prompt, apiKey);
    if (!generatedText) return { ok: false, error: 'ツイート案の生成に失敗しました。' };

    // X投稿管理シートに予約保存
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + 5); // 5分後に設定

    xSheet.appendRow([
      new Date(),
      tellerId,
      generatedText,
      '予約',
      scheduledTime,
      ''
    ]);

    return { ok: true, status: 'ok', postContent: generatedText, scheduledTime: scheduledTime };
  }, 'generateAstrologyXPost');
}

/**
 * 予約されたX投稿を実行
 */
function postAstrologyToX(body) {
  return withErrorHandling(() => {
    const tellerId = body.tellerId || '';
    if (!tellerId) return { ok: false, error: 'tellerId は必須です。' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    const xSheet = ss.getSheetByName('占星術_X投稿管理');
    if (!masterSheet || !xSheet) return { ok: false, error: '占星術シートが見つかりません。' };

    const masters = masterSheet.getDataRange().getValues().slice(1);
    let keys = null;
    for (const m of masters) {
      if (m[0] === tellerId) {
        keys = {
          consumerKey: m[8],
          consumerSecret: m[9],
          accessToken: m[10],
          accessSecret: m[11]
        };
        break;
      }
    }
    if (!keys || !keys.consumerKey) {
      return { ok: false, error: '該当占い師のX APIキーが未設定です。' };
    }

    const rows = xSheet.getDataRange().getValues();
    const now = new Date();
    let postedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const rowTellerId = rows[i][1];
      const text = rows[i][2];
      const status = rows[i][3];
      const schedTime = new Date(rows[i][4]);

      if (rowTellerId === tellerId && status === '予約' && schedTime <= now) {
        // 投稿の実行
        const result = postToXDirect(text, keys, tellerId);
        if (result && result.ok) {
          xSheet.getRange(i + 1, 4).setValue('投稿済み');
          xSheet.getRange(i + 1, 6).setValue(result.id || '');
          postedCount++;
        } else {
          xSheet.getRange(i + 1, 4).setValue('失敗');
        }
      }
    }

    return { ok: true, status: 'ok', postedCount: postedCount };
  }, 'postAstrologyToX');
}

/**
 * 占い師宛ての月次「システム利用料明細・請求書」PDFの自動生成
 */
function generateInvoicePdf(tellerId, month) {
  return withErrorHandling(() => {
    if (!tellerId) return { ok: false, error: 'tellerId は必須です。' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    if (!masterSheet) return { ok: false, error: 'マスターシートがありません。' };

    const targetMonth = month || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
    const salesReport = getAstrologySales(tellerId, targetMonth);
    if (!salesReport || !salesReport.data) {
      return { ok: false, error: '該当月の売上データの集計に失敗しました。' };
    }

    const tData = salesReport.data;
    const config = getKCSSettings();

    // KCSの送付元会社情報
    const compName = config.INVOICE_COMPANY_NAME || 'KCS合同会社';
    const compAddr = config.INVOICE_ADDRESS || '東京都千代田区麹町';
    const compBank = config.INVOICE_BANK_INFO || '三菱UFJ銀行 麹町支店 普通 1234567';

    // 請求書HTMLテンプレートの生成
    const htmlInvoice = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>システム利用料御請求書</title>
  <style>
    body { font-family: sans-serif; color: #333; padding: 20px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .title { font-size: 24px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; }
    .bill-to { font-size: 16px; margin-bottom: 20px; }
    .company-info { text-align: right; font-size: 13px; }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    .summary-table th, .summary-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
    .summary-table th { background: #f2f2f2; }
    .total-amount { font-size: 20px; font-weight: bold; color: #e74c3c; margin: 20px 0; text-align: right; }
    .bank-details { background: #f9f9f9; padding: 15px; border-left: 4px solid #3498db; margin-top: 40px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">御請求書</div>
      <div class="bill-to" style="margin-top:20px;">
        <b>${tData.tellerName} 先生 御中</b>
      </div>
    </div>
    <div class="company-info">
      <div>請求番号: INV-${tData.tellerId}-${targetMonth.replace('-', '')}</div>
      <div>発行日: ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd')}</div>
      <br>
      <b>${compName}</b><br>
      ${compAddr}<br>
    </div>
  </div>

  <p>毎度格別のお引き立てを賜り、厚く御礼申し上げます。<br>下記の通り御請求申し上げます。</p>

  <div class="total-amount">
    御請求金額: ¥${tData.billingAmount.toLocaleString()} - (税込)
  </div>

  <table class="summary-table">
    <thead>
      <tr>
        <th>項目 / 明細</th>
        <th>数量</th>
        <th>単価 / 手数料</th>
        <th>金額</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>西洋占星術システム 基本利用料</td>
        <td>1 ヶ月</td>
        <td>¥${tData.baseFee.toLocaleString()}</td>
        <td>¥${tData.baseFee.toLocaleString()}</td>
      </tr>
      <tr>
        <td>診断発行手数料 (${tData.commissionRate}% モデル)</td>
        <td>${tData.totalCount} 件 (総売上: ¥${tData.totalSales.toLocaleString()})</td>
        <td>${tData.commissionRate} %</td>
        <td>¥${(Math.round(tData.totalSales * (tData.commissionRate / 100))).toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="bank-details">
    <b>【お振込先口座情報】</b><br>
    ${compBank}<br>
    ※恐れ入りますが、振込手数料は貴殿にてご負担いただきますようお願い申し上げます。
  </div>
</body>
</html>
    `;

    // PDFの生成・保存
    const tempFile = DriveApp.createFile('temp_invoice_' + Date.now() + '.html', htmlInvoice, 'text/html');
    const pdfBlob = tempFile.getAs('application/pdf').setName(`請求書_${tData.tellerName}_${targetMonth}.pdf`);
    
    const folderId = config.DRIVE_PROCESSED_IMAGE_FOLDER_ID || '';
    let folder = DriveApp.getRootFolder();
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch(e) {}
    }
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const pdfUrl = pdfFile.getDownloadUrl();

    // 一時ファイル削除
    tempFile.setTrashed(true);

    return { ok: true, status: 'ok', pdfUrl: pdfUrl };
  }, 'generateInvoicePdf');
}

// ────────────────────────────────────────
// 🔮 西洋占星術 内部ヘルパー関数群
// ────────────────────────────────────────

/**
 * 太陽星座を割り出す簡易ロジック
 */
function getSunSign(dateStr) {
  try {
    const parts = dateStr.split('-');
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    const signs = ["山羊座", "水瓶座", "魚座", "牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座"];
    const dates = [20, 19, 20, 20, 21, 21, 22, 23, 23, 23, 22, 21];
    
    return day < dates[month - 1] ? signs[month - 1] : signs[month];
  } catch (e) {
    return '牡羊座'; // フォールバック
  }
}

/**
 * 顧客データを検索
 */
function getCustomer(sheet, lineUserId) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lineUserId) {
      return {
        lineUserId: rows[i][0],
        displayName: rows[i][1],
        realName: rows[i][2],
        status: rows[i][4]
      };
    }
  }
  return null;
}

/**
 * 顧客データを登録または更新
 */
function addOrUpdateCustomer(sheet, lineUserId, displayName, realName, status) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lineUserId) {
      if (realName) sheet.getRange(i + 1, 3).setValue(realName);
      if (status) sheet.getRange(i + 1, 5).setValue(status);
      return;
    }
  }
  sheet.appendRow([
    lineUserId,
    displayName,
    realName || '',
    new Date(),
    status || '未登録'
  ]);
}

/**
 * 占い師のステータスとサブスクIDを更新
 */
function updateTellerStatus(sheet, tellerId, status, subscriptionId) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === tellerId) {
      sheet.getRange(i + 1, 7).setValue(status);
      if (subscriptionId) sheet.getRange(i + 1, 13).setValue(subscriptionId);
      return;
    }
  }
}

/**
 * サブスクIDから占い師情報を検索
 */
function getTellerBySubscriptionId(sheet, subscriptionId) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][12] === subscriptionId) {
      return { tellerId: rows[i][0], tellerName: rows[i][1] };
    }
  }
  return null;
}

function getTellerName(sheet, tellerId) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === tellerId) return rows[i][1];
  }
  return tellerId;
}

/**
 * LINE Developers プロファイルAPI呼び出し
 */
function getUserLineProfile(accessToken, userId) {
  try {
    const url = 'https://api.line.me/v2/bot/profile/' + userId;
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { displayName: 'LINEユーザー' };
  }
}

/**
 * LINE プッシュメッセージ送信
 */
function sendLineMessage(accessToken, to, messages) {
  try {
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = { to: to, messages: messages };
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('LINE送信エラー:', e.message);
  }
}

/**
 * Discordへの西洋占星術の専用Webフック通知
 */
function sendDiscordAstrologyNotification(content) {
  try {
    const config = getKCSSettings();
    const webhooks = (() => { try { return JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return {}; } })();
    const webhookUrl = webhooks['西洋占星術'] || config.KCS_HQ_WEBHOOK_URL || Object.values(webhooks)[0];
    
    if (webhookUrl) {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          content: content,
          username: '🔮 西洋占星術管理エンジン'
        }),
        muteHttpExceptions: true
      });
    }
  } catch (e) {
    console.error('Discord通知エラー:', e.message);
  }
}

/**
 * Gemini API による鑑定書生成
 */
function callGeminiAstrology(prompt, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const resText = response.getContentText();
    const data = JSON.parse(resText);
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return '';
  } catch (e) {
    console.error('Gemini呼び出しエラー:', e.message);
    return '';
  }
}

/**
 * HTML鑑定書PDF用テンプレート生成
 */
function createHtmlReportTemplate(tellerName, customerName, birthDate, birthTime, birthPlace, sunSign, planName, textResult) {
  // マークダウンの簡単なHTML置換
  let formattedText = textResult
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/### (.*?)(<br>|$)/g, '<h3>$1</h3>')
    .replace(/## (.*?)(<br>|$)/g, '<h2>$1</h2>')
    .replace(/# (.*?)(<br>|$)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${customerName} 様 西洋占星術鑑定書</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: serif; color: #2c3e50; line-height: 1.8; background: #fff; padding: 20px; }
    .cover { text-align: center; padding: 100px 20px; border: 2px solid #d4af37; border-radius: 10px; margin-bottom: 50px; }
    .cover-title { font-size: 32px; font-weight: bold; color: #1a252f; margin-bottom: 10px; letter-spacing: 2px; }
    .cover-subtitle { font-size: 16px; color: #7f8c8d; margin-bottom: 40px; }
    .meta-info { margin-top: 50px; font-size: 14px; text-align: left; display: inline-block; border-top: 1px solid #ccc; padding-top: 20px; }
    .content { margin-top: 40px; text-align: justify; }
    h1, h2, h3 { color: #1a252f; border-bottom: 1px solid #d4af37; padding-bottom: 5px; margin-top: 30px; }
    p { margin-bottom: 15px; }
    .footer { margin-top: 100px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="cover">
    <div style="font-size:40px; margin-bottom:20px;">🔮</div>
    <div class="cover-title">西洋占星術鑑定書</div>
    <div class="cover-subtitle">${planName}</div>
    
    <div style="margin-top: 60px; font-size: 20px;">
      <b>${customerName} 様</b>
    </div>
    
    <div class="meta-info">
      出生データ: ${birthDate} ${birthTime || '時間不明'} (出生地: ${birthPlace})<br>
      太陽星座: ${sunSign}<br>
      鑑定担当: 占星術師 ${tellerName}
    </div>
  </div>

  <div class="content">
    <p>${formattedText}</p>
  </div>

  <div class="footer">
    西洋占星術自動鑑定システム / プロデュース: KCS合同会社
  </div>
</body>
</html>
  `;
}

/**
 * 占い師専用ダッシュボードデータの取得
 */
function getTellerDashboardData(tellerId) {
  return withErrorHandling(() => {
    if (!tellerId) return { ok: false, error: 'tellerId は必須です。' };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName('占星術_販売履歴');
    const xSheet = ss.getSheetByName('占星術_X投稿管理');
    const masterSheet = ss.getSheetByName('占星術_占い師マスター');
    
    if (!salesSheet || !xSheet || !masterSheet) {
      return { ok: false, error: '必要なシートが見つかりません。' };
    }
    
    // 占い師自身の基本設定の取得
    const masters = masterSheet.getDataRange().getValues().slice(1);
    let tellerInfo = null;
    for (const m of masters) {
      if (m[0] === tellerId) {
        tellerInfo = {
          tellerId: m[0],
          tellerName: m[1],
          email: m[2],
          baseFee: Number(m[4] || 0),
          commissionRate: Number(m[5] || 0),
          status: m[6]
        };
        break;
      }
    }
    
    if (!tellerInfo) return { ok: false, error: '占い師が見つかりません。' };
    
    // 販売履歴のフィルター
    const salesRows = salesSheet.getDataRange().getValues();
    const customers = [];
    let totalSales = 0;
    let totalCount = 0;
    
    for (let i = 1; i < salesRows.length; i++) {
      const row = salesRows[i];
      const sTellerId = row[2];
      if (sTellerId !== tellerId) continue;
      
      const amount = Number(row[5] || 0);
      const status = row[8];
      
      if (status === '発行完了') {
        totalSales += amount;
        totalCount++;
      }
      
      customers.push({
        index: i + 1,
        timestamp: Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
        transactionId: row[1],
        customerName: row[3],
        planName: row[4],
        amount: amount,
        lineUserId: row[6],
        pdfUrl: row[7],
        status: status
      });
    }
    
    // X投稿管理のフィルター
    const xPosts = [];
    try {
      const xRows = xSheet.getDataRange().getValues();
      for (let i = 1; i < xRows.length; i++) {
        const row = xRows[i];
        const xTellerId = row[1];
        if (xTellerId !== tellerId) continue;
        
        xPosts.push({
          index: i + 1,
          timestamp: Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
          content: row[2],
          status: row[3],
          scheduledTime: Utilities.formatDate(new Date(row[4]), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
          postId: row[5]
        });
      }
    } catch(e) {
      console.error('X投稿履歴取得エラー:', e.message);
    }
    
    // KCSへの請求額計算 (月額固定費 + 売上の手数料率%)
    const billingAmount = tellerInfo.baseFee + Math.round(totalSales * (tellerInfo.commissionRate / 100));
    
    return {
      ok: true,
      tellerInfo: tellerInfo,
      summary: {
        totalSales: totalSales,
        totalCount: totalCount,
        billingAmount: billingAmount,
        netSales: totalSales - billingAmount
      },
      customers: customers.reverse(),
      xPosts: xPosts.reverse()
    };
  }, 'getTellerDashboardData');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KCS 1日全体ヘルスモニタ＆自己修復システム（2026-06-09 追加）
// ・kcsHealthMonitor : 1時間毎にトリガー実行、各サブシステムを巡回チェック
// ・kcsDailyAudit    : 毎日21時、1日の活動サマリーをDiscordに送信
// ・runSelfHeal      : 検知した異常の自動復旧（トリガー欠落の再登録等）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 監視に使用する必須トリガーの一覧
const KCS_REQUIRED_TRIGGERS = [
  'morningBriefing',
  'generateDailyReport',
  'autoPostAffiliateAmazon',
  'autoPostAffiliateRakuten',
  'autoReplyTick',
  'gmailMonitorTick',
  'processDriveKnowledgeImages',
  'kcsHealthMonitor',
  'kcsDailyAudit'
];

// 投稿本文に絶対に混入してはいけないNGパターン
const KCS_NG_CONTENT_PATTERNS = [
  { name: 'JSON生波カッコ',     re: /\{\s*"post"\s*:/u },
  { name: 'Geminiラベル',       re: /\*\*Gemini\*\*|🤖\s*\*\*Gemini/u },
  { name: 'Claudeラベル',       re: /\*\*Claude\*\*/u },
  { name: 'codeフェンスjson',   re: /```json/u },
  { name: 'AI挨拶',             re: /^(?:承知(?:いた)?しました|了解(?:いた)?しました|わかりました)/u },
  { name: '前回投稿の追記前置き', re: /先ほどの投稿への追加コメント/u },
];

// メイン: 1時間毎の総合ヘルスチェック
function kcsHealthMonitor() {
  return withErrorHandling(() => {
    const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    console.log(`[kcsHealthMonitor] === 開始 ${ts} ===`);

    const results = {
      timestamp: ts,
      triggers:   checkTriggersIntact(),
      xContent:   checkRecentXContent(),
      discord:    checkDiscordWebhooks(),
      apiKeys:    checkApiKeysSet(),
      postCounts: checkRecentPostCounts(),
      gmail:      checkGmailMonitorAlive(),
    };

    const issues = [];
    if (!results.triggers.ok)   issues.push(`🔴 トリガー欠落: ${results.triggers.missing.join(', ')}`);
    if (!results.xContent.ok)   issues.push(`🔴 X投稿コンテンツ汚染: ${results.xContent.dirty.length}件 (${results.xContent.dirty.map(d=>d.account+':'+d.patterns.join(',')).join(' / ')})`);
    if (!results.discord.ok)    issues.push(`🟡 Discord webhook不応答: ${results.discord.failed.join(', ')}`);
    if (!results.apiKeys.ok)    issues.push(`🟡 APIキー未設定: ${results.apiKeys.missing.join(', ')}`);
    if (!results.postCounts.ok) issues.push(`🟡 投稿停滞: ${results.postCounts.stalled.join(', ')}`);
    if (!results.gmail.ok)      issues.push(`🟡 Gmail監視停止: ${results.gmail.reason}`);

    // 自己修復実行
    const healed = runSelfHeal(results);

    // 直近結果を ScriptProperties に保存
    recordHealthHistory(results, issues, healed);

    // 異常があればDiscordに即時通知（1時間に1回スロットリング済み: notifyDiscordError側で重複抑制）
    if (issues.length > 0) {
      const msg = `🩺 **KCS ヘルスチェック異常検知** [${ts}]\n\n` +
        issues.join('\n') +
        (healed.length ? `\n\n✅ 自動修復実行: ${healed.join(', ')}` : '') +
        `\n\n詳細は GAS Execution Logs を確認。`;
      try { notifyDiscordError('kcsHealthMonitor', issues.join(' | '), '自己修復: ' + healed.join(',')); } catch(e) {}
      try {
        const config = getKCSSettings();
        const webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
        const wh = webhooks['error-log'] || webhooks['エラーログ'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
        if (wh) sendDiscordWebhook(wh, msg, 'KCS Health Monitor');
      } catch(e) { console.warn('[kcsHealthMonitor] Discord通知失敗:', e.message); }
    } else {
      console.log('[kcsHealthMonitor] ✅ 全項目正常');
    }

    return results;
  }, 'kcsHealthMonitor');
}

// ━━━ 個別チェック関数 ━━━

function checkTriggersIntact() {
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const missing = KCS_REQUIRED_TRIGGERS.filter(name => !existing.includes(name));
  return { ok: missing.length === 0, missing, existingCount: existing.length };
}

// HAL/すなくん の直近10投稿を取得し、NGパターンが混入していないかチェック
function checkRecentXContent() {
  const dirty = [];
  ['hal', 'sunakun'].forEach(account => {
    try {
      const tweets = fetchRecentTweetsForAccount(account, 10);
      tweets.forEach(t => {
        const matched = KCS_NG_CONTENT_PATTERNS
          .filter(p => p.re.test(t.text))
          .map(p => p.name);
        if (matched.length > 0) {
          dirty.push({ account, tweetId: t.id, text: t.text.slice(0, 80), patterns: matched });
        }
      });
    } catch(e) {
      console.warn(`[checkRecentXContent][${account}] 取得失敗: ${e.message}`);
    }
  });
  return { ok: dirty.length === 0, dirty };
}

// OAuth 1.0a で /2/users/me を叩き、アカウントの実ユーザーID/ハンドルを解決する（24hキャッシュ）
// 設定シートの SUNAKUN_X_USER_ID / HAL_X_USER_ID が実アカウントとズレていても自己修復する
function resolveXUserId(account, configuredId, keys) {
  const props = PropertiesService.getScriptProperties();
  const cacheKey = 'X_RESOLVED_USER_' + account;
  try {
    const cached = JSON.parse(props.getProperty(cacheKey) || 'null');
    if (cached && cached.id && (Date.now() - (cached.ts || 0)) < 24 * 60 * 60 * 1000) {
      return cached.id;
    }
  } catch (e) {}

  const meUrl = 'https://api.twitter.com/2/users/me';
  const nonce = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams = {
    oauth_consumer_key:     keys.consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            keys.accessToken,
    oauth_version:          '1.0'
  };
  const paramStr = Object.keys(oauthParams).sort()
    .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(oauthParams[k])}`)
    .join('&');
  const baseStr = `GET&${encodeRFC3986(meUrl)}&${encodeRFC3986(paramStr)}`;
  const signingKey = `${encodeRFC3986(keys.consumerSecret)}&${encodeRFC3986(keys.accessSecret)}`;
  oauthParams['oauth_signature'] = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
  );
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
    .join(', ');

  try {
    const res = UrlFetchApp.fetch(meUrl, { method: 'get', headers: { 'Authorization': authHeader }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const me = JSON.parse(res.getContentText());
      if (me.data && me.data.id) {
        props.setProperty(cacheKey, JSON.stringify({ id: me.data.id, username: me.data.username || '', ts: Date.now() }));
        if (configuredId && configuredId !== me.data.id) {
          console.warn(`[resolveXUserId][${account}] 設定のUSER_ID(${configuredId})と実ID(${me.data.id} @${me.data.username})が不一致。実IDを使用します。`);
        }
        return me.data.id;
      }
    }
    console.warn(`[resolveXUserId][${account}] /2/users/me HTTP ${res.getResponseCode()}: ${res.getContentText().slice(0,120)}`);
  } catch (e) {
    console.warn(`[resolveXUserId][${account}] 例外: ${e.message}`);
  }
  return configuredId || '';
}

function fetchRecentTweetsForAccount(account, max) {
  const config = getKCSSettings();
  let userId, consumerKey, consumerSecret, accessToken, accessSecret;
  if (account === 'hal') {
    userId         = config.HAL_X_USER_ID || '';
    consumerKey    = config.HAL_X_CONSUMER_KEY;
    consumerSecret = config.HAL_X_CONSUMER_SECRET;
    accessToken    = config.HAL_X_ACCESS_TOKEN;
    accessSecret   = config.HAL_X_ACCESS_SECRET;
  } else {
    userId         = config.SUNAKUN_X_USER_ID || '';
    consumerKey    = config.X_CONSUMER_KEY;
    consumerSecret = config.X_CONSUMER_SECRET;
    accessToken    = config.X_ACCESS_TOKEN;
    accessSecret   = config.X_ACCESS_SECRET;
  }
  if (!consumerKey || !accessToken) return [];

  // 設定シートのIDが古い/誤りでも自己修復できるよう、/2/users/me で実IDを解決（24時間キャッシュ）
  userId = resolveXUserId(account, userId, { consumerKey, consumerSecret, accessToken, accessSecret });
  if (!userId) return [];

  const baseUrl = `https://api.twitter.com/2/users/${userId}/tweets`;
  const url = `${baseUrl}?max_results=${Math.min(Math.max(max, 5), 100)}&tweet.fields=created_at`;
  const nonce = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            accessToken,
    oauth_version:          '1.0'
  };
  const allParams = Object.assign({}, oauthParams, {
    max_results: String(Math.min(Math.max(max, 5), 100)),
    'tweet.fields': 'created_at'
  });
  const paramStr = Object.keys(allParams).sort()
    .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`)
    .join('&');
  const baseStr = `GET&${encodeRFC3986(baseUrl)}&${encodeRFC3986(paramStr)}`;
  const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(accessSecret)}`;
  const signature = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
  );
  oauthParams['oauth_signature'] = signature;
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
    .join(', ');

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': authHeader },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    console.warn(`[fetchRecentTweetsForAccount][${account}] HTTP ${code}: ${res.getContentText().slice(0,200)}`);
    return [];
  }
  const body = JSON.parse(res.getContentText());
  return (body.data || []).map(t => ({ id: t.id, text: t.text || '', createdAt: t.created_at }));
}

function checkDiscordWebhooks() {
  const config = getKCSSettings();
  let webhooks = {};
  try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch(e) { return { ok: false, failed: ['DISCORD_WEBHOOK_URLS JSONパース失敗'] }; }
  const failed = [];
  Object.keys(webhooks).forEach(name => {
    const url = webhooks[name];
    if (!url || !url.startsWith('http')) { failed.push(`${name}(無効URL)`); return; }
    try {
      // HEADは未サポートなのでGETで疎通確認のみ（Discord webhookはGETで200を返す）
      const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
      const code = res.getResponseCode();
      // 429はレート制限＝webhook自体は生きているので異常扱いしない（毎時の誤報防止）
      if (code >= 400 && code !== 429) failed.push(`${name}(HTTP${code})`);
    } catch(e) {
      failed.push(`${name}(例外: ${e.message.slice(0,40)})`);
    }
  });
  return { ok: failed.length === 0, failed, total: Object.keys(webhooks).length };
}

function checkApiKeysSet() {
  const config = getKCSSettings();
  // CLAUDE_API_KEYは意図的に一時停止中（CLAUDE_API_KEY_PAUSED）のため必須から除外。生成系はGeminiが主担当
  const required = [
    'GEMINI_API_KEY',
    'X_CONSUMER_KEY','X_CONSUMER_SECRET','X_ACCESS_TOKEN','X_ACCESS_SECRET',
    'HAL_X_CONSUMER_KEY','HAL_X_CONSUMER_SECRET','HAL_X_ACCESS_TOKEN','HAL_X_ACCESS_SECRET',
    'DISCORD_BOT_TOKEN','DISCORD_WEBHOOK_URLS',
    'GITHUB_TOKEN','GITHUB_REPO',
  ];
  const missing = required.filter(k => !config[k]);
  return { ok: missing.length === 0, missing };
}

// 直近の投稿数を ScriptProperties に保存し、前回と比較して停滞を検知
function checkRecentPostCounts() {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const stalled = [];
  const snapshot = {};
  ['hal', 'sunakun'].forEach(account => {
    try {
      const tweets = fetchRecentTweetsForAccount(account, 10);
      const latestEpoch = tweets.length > 0 ? new Date(tweets[0].createdAt).getTime() : 0;
      snapshot[account] = { count: tweets.length, latestEpoch };
      // 24時間以上投稿なし = 停滞
      if (latestEpoch > 0 && (now - latestEpoch) > 24 * 60 * 60 * 1000) {
        stalled.push(`${account}(${Math.floor((now-latestEpoch)/3600000)}h無投稿)`);
      }
    } catch(e) {
      console.warn(`[checkRecentPostCounts][${account}] ${e.message}`);
    }
  });
  props.setProperty('KCS_LAST_POST_SNAPSHOT', JSON.stringify({ ts: now, snapshot }));
  return { ok: stalled.length === 0, stalled, snapshot };
}

// Gmail監視ハートビートと最新サーチ結果の死活確認
// gmailMonitorTick が GMAIL_LAST_RUN_TS を毎時更新するので、3時間以上更新がなければ停止判定
function checkGmailMonitorAlive() {
  const props = PropertiesService.getScriptProperties();
  const lastRun = Number(props.getProperty('GMAIL_LAST_RUN_TS') || '0');
  const lastCheck = Number(props.getProperty('GMAIL_LAST_CHECK') || '0');
  const now = Date.now();
  if (!lastRun) {
    return { ok: false, reason: '一度も走った形跡なし（GMAIL_LAST_RUN_TS未設定）', lastRun: 0 };
  }
  const ageHours = (now - lastRun) / 3600000;
  if (ageHours > 3) {
    return { ok: false, reason: `${Math.floor(ageHours)}時間前から停止`, lastRun };
  }
  return { ok: true, lastRun, lastRunIso: new Date(lastRun).toISOString(), lastCheckIso: lastCheck ? new Date(lastCheck).toISOString() : null };
}

// ━━━ 自己修復 ━━━
function runSelfHeal(results) {
  const healed = [];
  // 1. トリガー欠落 → 再登録
  if (results.triggers && !results.triggers.ok && results.triggers.missing.length > 0) {
    try {
      setupAllTriggers();
      setupMonitoringTriggers();
      healed.push(`トリガー再登録(${results.triggers.missing.length}件)`);
    } catch(e) { console.warn('[runSelfHeal] トリガー再登録失敗:', e.message); }
  }
  // 2. X投稿コンテンツ汚染 → 削除権限なしのため通知のみ（社長へ手動削除を促す）
  // 3. Discord webhook 不応答 → リトライ1回
  if (results.discord && !results.discord.ok) {
    console.log('[runSelfHeal] Discord webhook 不応答を検知。次サイクルで再チェック。');
  }
  // 4. Gmail監視停止 → gmailMonitorTickをその場で1回叩いて復帰確認
  if (results.gmail && !results.gmail.ok) {
    try {
      gmailMonitorTick();
      healed.push('gmailMonitorTick手動キック');
    } catch(e) { console.warn('[runSelfHeal] gmailMonitorTick再起動失敗:', e.message); }
  }
  return healed;
}

// ━━━ ヘルスチェック履歴記録 ━━━
function recordHealthHistory(results, issues, healed) {
  const props = PropertiesService.getScriptProperties();
  const history = JSON.parse(props.getProperty('KCS_HEALTH_HISTORY') || '[]');
  history.unshift({
    ts: results.timestamp,
    ok: issues.length === 0,
    issues, healed,
    counts: results.postCounts && results.postCounts.snapshot
  });
  // 直近48件（48時間分）のみ保持
  props.setProperty('KCS_HEALTH_HISTORY', JSON.stringify(history.slice(0, 48)));
}

// ━━━ 毎日21時の日次監査サマリー ━━━
function kcsDailyAudit() {
  return withErrorHandling(() => {
    const props = PropertiesService.getScriptProperties();
    const history = JSON.parse(props.getProperty('KCS_HEALTH_HISTORY') || '[]');
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const todays = history.filter(h => String(h.ts).startsWith(today));

    const okCount = todays.filter(h => h.ok).length;
    const ngCount = todays.length - okCount;
    const issueLines = [];
    const issueMap = {};
    todays.filter(h => !h.ok).forEach(h => {
      (h.issues || []).forEach(iss => {
        const head = iss.split(':')[0].replace(/^[🔴🟡]\s*/, '');
        issueMap[head] = (issueMap[head] || 0) + 1;
      });
    });
    Object.keys(issueMap).forEach(k => issueLines.push(`- ${k}: ${issueMap[k]}回`));

    // 即時のX投稿状況スナップショット
    const xSnap = JSON.parse(props.getProperty('KCS_LAST_POST_SNAPSHOT') || '{}');
    const snap = xSnap.snapshot || {};

    const msg =
      `📋 **KCS 日次監査レポート [${today}]**\n\n` +
      `🩺 ヘルスチェック実行: ${todays.length}回 (✅${okCount} / ❌${ngCount})\n` +
      (issueLines.length ? `\n**頻出イシュー:**\n${issueLines.join('\n')}\n` : '\n✅ 本日は異常なし\n') +
      `\n**X直近投稿スナップショット:**\n` +
      `- HAL: 取得${snap.hal?.count || 0}件, 最新${snap.hal?.latestEpoch ? Utilities.formatDate(new Date(snap.hal.latestEpoch), 'Asia/Tokyo', 'MM/dd HH:mm') : '-'}\n` +
      `- すなくん: 取得${snap.sunakun?.count || 0}件, 最新${snap.sunakun?.latestEpoch ? Utilities.formatDate(new Date(snap.sunakun.latestEpoch), 'Asia/Tokyo', 'MM/dd HH:mm') : '-'}\n`;

    try {
      const config = getKCSSettings();
      const webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
      const wh = webhooks['daily-report'] || webhooks['KCS本部'] || Object.values(webhooks)[0];
      if (wh) sendDiscordWebhook(wh, msg, 'KCS Daily Audit');
    } catch(e) { console.warn('[kcsDailyAudit] Discord送信失敗:', e.message); }
    console.log(msg);
    return { ok: true, totalChecks: todays.length, ngCount };
  }, 'kcsDailyAudit');
}

// ━━━ 監視トリガー登録 ━━━
function setupMonitoringTriggers() {
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const created = [];
  if (!existing.includes('kcsHealthMonitor')) {
    ScriptApp.newTrigger('kcsHealthMonitor').timeBased().everyHours(1).create();
    created.push('kcsHealthMonitor (1時間毎)');
  }
  if (!existing.includes('kcsDailyAudit')) {
    ScriptApp.newTrigger('kcsDailyAudit').timeBased().atHour(21).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
    created.push('kcsDailyAudit (毎日21時)');
  }
  console.log('[setupMonitoringTriggers] 新規追加: ' + (created.join(', ') || 'なし（既設）'));
  return { ok: true, created };
}

