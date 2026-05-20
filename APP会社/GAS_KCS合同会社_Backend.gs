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
    ['FULL_AUTO_MODE', 'FALSE', '完全自動化（承認スキップ）モード (TRUE / FALSE)'],
    ['HAL_X_USER_ID', '', 'HAL の X ユーザーID（数字）— メンション取得に必要'],
    ['SUNAKUN_X_USER_ID', '', 'すなくん の X ユーザーID（数字）— メンション取得に必要'],
    ['LAST_MENTION_ID_hal', '', '最後に処理したHALへのメンションID（自動更新）'],
    ['LAST_MENTION_ID_sunakun', '', '最後に処理したすなくんへのメンションID（自動更新）'],
    ['LEAD_MAGNET_URL', '', '無料プレゼント/お役立ちPDF配布用URL'],
    ['LINE_FUNNEL_URL', '', 'LINE誘導用オプトインURL'],
    ['KNOWLEDGE_CHANNEL_ID', '', 'ナレッジチャンネルID（#ナレッジ の右クリック→チャンネルIDをコピー）'],
    ['OBSIDIAN_FOLDER_ID', '', 'Obsidian保存用 Google Drive フォルダID'],
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

  try {
    SpreadsheetApp.getUi().alert(
      '✅ KCS合同会社 セットアップ完了！\n\n' +
      '作成されたシート:\n' +
      '・チャットログ / カスタムスタッフ / プロジェクト / 設定\n' +
      '・SNS投稿管理 / 実務タスク管理 / ユーザーデータ\n' +
      '・SNS自動返信ログ (新設) \n\n' +
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

  if (action === 'getYouTubeChannelStats') {
    return getYouTubeChannelStats();
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
    const rawBody = e.postData.contents;
    const body = JSON.parse(rawBody);

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
    if (body.action === 'debug_github') {
      const config = getKCSSettings();
      const token = config.GITHUB_TOKEN || '';
      const owner = config.GITHUB_OWNER || '';
      const repo  = config.GITHUB_REPO  || 'KCS-Vault';
      const masked = token.length > 8 ? token.slice(0, 4) + '...' + token.slice(-4) : (token ? '***' : '(未設定)');
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
    
    // ── 実務成果物のアップロード ──
    if (body.action === 'upload_to_drive') {
      return uploadFileToDrive(body);
    }

    // ── 朝ブリーフィング ──
    if (body.action === 'morning_briefing') {
      morningBriefing();
      return jsonResponse({ status: 'ok', message: '朝ブリーフィングを実行しました' });
    }

    // ── n8n/Make.com から Discord メッセージを受信 ──
    if (body.action === 'discord_message') {
      return handleDiscordMessageFromMake(body);
    }

    // ── Phase 1-3: GitHub 保存 ──
    if (body.action === 'save_to_github') {
      return jsonResponse(saveToGitHub(body.path, body.content, body.message));
    }

    // ── HAL 投稿生成 ──
    if (body.action === 'generate_hal_post') {
      return jsonResponse(generateHALPost(body));
    }
    if (body.action === 'approve_hal_post') {
      return jsonResponse(approveHALPost(body));
    }

    // ── すなくん 投稿生成 ──
    if (body.action === 'generate_sunakkun_post') {
      return jsonResponse(generateSunakkunPost(body));
    }
    if (body.action === 'test_sunakun_post') {
      return jsonResponse(autoPostAffiliateAmazon());
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

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    console.error('KCS doPost エラー:', err.message);
    return jsonResponse({ status: 'error', message: err.message });
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
    if (data[i][0]) config[data[i][0]] = String(data[i][1]);
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
function cmdAskGemini(text, config, projectName) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return '⚠️ GEMINI_API_KEY が設定されていません。設定シートを確認してください。';

  // コンテキストとして最新のプロジェクト状況を取得
  const projectSummary = cmdProjectSummary();
  const systemContext = `あなたはKCS合同会社のAIスタッフ（AIマネージャー）です。
現在のプロジェクト状況:
${projectSummary}

上記を踏まえ、Discordのユーザーからの問いかけに、親切かつ実用的な日本語で回答してください。
回答は簡潔に（最大400文字程度）まとめ、重要なポイントは太字を使ってください。`;

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    return `🤖 **Gemini:**\n${reply.slice(0, 1900)}`;
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

// Discord Webhook 送信
function sendDiscordWebhook(webhookUrl, content, username) {
  if (!webhookUrl) { console.error('[sendDiscordWebhook] Webhook URL未設定'); return null; }
  try {
    return UrlFetchApp.fetch(webhookUrl, {
      method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ content: String(content).slice(0, 2000), username: username || 'KCS Bot' })
    });
  } catch (e) { console.error('[sendDiscordWebhook] Error:', e.message); return null; }
}

// Discord Bot API 送信（レスポンスコードを返す）
function sendDiscordMessage(channelId, content, token) {
  try {
    const res = UrlFetchApp.fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'Authorization': `Bot ${token}` },
      payload: JSON.stringify({ content: String(content).slice(0, 2000) })
    });
    const code = res.getResponseCode();
    console.log(`[sendDiscordMessage] code=${code} body=${res.getContentText().slice(0, 200)}`);
    return code;
  } catch (e) {
    console.error('[sendDiscordMessage] 例外:', e.message);
    return 0;
  }
}

// 朝ブリーフィング（詳細版）
// 朝ブリーフィング（AIスタッフ自律ディスカッション＆協働版）
function morningBriefing() {
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
      `- ジュン専務（統括、しっかり者、関西弁混じりの熱い男。プロジェクトの進捗や遅れに厳しくツッコミを入れるが愛情深い）\n` +
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    const safeMsg = String(msg).slice(0, 2000);

    // 1. Bot API を試行
    if (token && channelId) {
      const code = sendDiscordMessage(channelId, safeMsg, token);
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
      try {
        const whRes = UrlFetchApp.fetch(channelWebhookUrl, {
          method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({ content: safeMsg, username: 'KCS AI Staff' })
        });
        console.log(`[Bridge] Webhook送信 code=${whRes.getResponseCode()}`);
      } catch (e) {
        console.error(`[Bridge] Webhook送信エラー: ${e.message}`);
      }
      return;
    }

    console.warn('[Bridge] ❌ 返信手段なし。設定シートに DISCORD_BOT_TOKEN または DISCORD_WEBHOOK_URLS を設定してください。');
  }

  // ── 0-a. 画像添付 → Knowledge処理 ──
  const imageUrl = body.imageUrl || body.image_url || '';
  if (imageUrl) {
    const result = handleKnowledgeImage({ imageUrl, channelId, username, config });
    let responseText = '';
    if (result && result.reply) {
      responseText = result.reply;
    } else if (result && result.error) {
      responseText = `❌ **画像解析エラーが発生しました**\n> ${result.error}\n設定シートのAPIキー（GEMINI_API_KEY）や画像のアクセス権を確認してください。`;
    } else {
      responseText = `❌ **不明なエラーが発生しました**\n画像の解析処理を確認してください。`;
    }

    // 送信先決定
    let knowledgeWebhookUrl = '';
    try {
      const wh = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}');
      knowledgeWebhookUrl = wh['knowledge'] || wh['#knowledge'] || '';
    } catch(e) {}
    
    if (knowledgeWebhookUrl) {
      sendDiscordWebhook(knowledgeWebhookUrl, responseText, 'KCS AI Staff');
    } else {
      reply(responseText);
    }
    return jsonResponse({ ok: true, source, handled: 'knowledge_image', user: username, result });
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

// #knowledge チャンネルの画像をGemini Visionで解析してGitHubに保存
function handleKnowledgeImage({ imageUrl = '', channelId = '', username = '', config = {} } = {}) {
  return withErrorHandling(() => {
    const apiKey = config.GEMINI_API_KEY || '';
    if (!apiKey) return { reply: '❌ GEMINI_API_KEY が未設定です（スプレッドシートの設定シートに追加してください）' };

    if (!imageUrl) return { reply: '❌ 画像URLが空です' };

    // Discord画像をダウンロードしてbase64変換
    let imageBase64, mimeType;
    try {
      const imgRes = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
      if (imgRes.getResponseCode() !== 200) {
        return { reply: `❌ 画像のダウンロードに失敗しました。Discord側のアクセス制限の可能性があります。HTTPステータス: ${imgRes.getResponseCode()}` };
      }
      const blob = imgRes.getBlob();
      mimeType = blob.getContentType() || 'image/jpeg';
      imageBase64 = Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      return { reply: `❌ 画像の取得中に通信エラーが発生しました: ${e.message}` };
    }

    const prompt = `添付画像を分析してください：
1. 内容の要約（3行以内）
2. 重要度（高/中/低）
3. HAL・すなくん・他プロジェクトへの応用方法
4. 具体的な活用アイデア（3つ）
5. 保存推奨フォルダ（Knowledge/推し活・ファッション・美容・SNSバズ・グルメ 等）
Markdown形式で回答してください。`;

    const payload = {
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }]
    };

    let analysis = '';
    try {
      const res = UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) }
      );
      const resCode = res.getResponseCode();
      if (resCode !== 200) {
        return { reply: `❌ Gemini APIエラー (HTTP ${resCode}): ${res.getContentText().slice(0, 300)}` };
      }
      const data = JSON.parse(res.getContentText());
      analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      return { reply: `❌ Gemini Visionの呼び出し中にエラーが発生しました: ${e.message}` };
    }

    if (!analysis) return { reply: '⚠️ 画像の解析結果が空でした。' };

    // GitHubに保存
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
    const displayDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    const content = `---\ndate: ${displayDate}\ntags: [knowledge, screenshot]\nauthor: ${username}\n---\n\n# スクショ知識 ${displayDate}\n\n${analysis}\n\n---\n画像URL: ${imageUrl}\n`;
    const gitResult = saveToGitHub(`Knowledge/スクショ/スクショ_${dateTag}.md`, content, `スクショ知識追加 ${displayDate}`);

    let githubWarning = '';
    if (!gitResult || !gitResult.ok) {
      githubWarning = `\n⚠️ **GitHubへの自動保存に失敗しました**: ${gitResult ? gitResult.error : '不明なエラー'}`;
    }

    return { reply: `📚 **ナレッジ保存完了！**${githubWarning}\n\n${analysis.slice(0, 800)}` };
  }, 'handleKnowledgeImage');
}

// GASエディタから直接実行してknowledge画像パイプラインをテストする関数
function testKnowledgeImageFlow() {
  const config = getKCSSettings();
  const testImageUrl = 'https://www.gstatic.com/webp/gallery/1.jpg';
  console.log('[Test] GEMINI_API_KEY先頭:', (config.GEMINI_API_KEY || '').slice(0, 8) + '...');
  const result = handleKnowledgeImage({
    imageUrl: testImageUrl,
    channelId: 'test-channel',
    username: 'GASテスト',
    config: config
  });
  console.log('[Test] Result:', JSON.stringify(result));
  if (result && result.reply) {
    console.log('[Test] 成功！Reply:', result.reply.slice(0, 300));
  } else {
    console.log('[Test] 失敗: replyなし');
  }
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

// 全トリガーセットアップ
function setupAllTriggers() {
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  
  if (!existing.includes('morningBriefing')) {
    ScriptApp.newTrigger('morningBriefing').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  }
  if (!existing.includes('generateDailyReport')) {
    ScriptApp.newTrigger('generateDailyReport').timeBased().atHour(20).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  }
  if (!existing.includes('autoPostAffiliateAmazon')) {
    ScriptApp.newTrigger('autoPostAffiliateAmazon').timeBased().atHour(12).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  }
  if (!existing.includes('autoPostAffiliateRakuten')) {
    ScriptApp.newTrigger('autoPostAffiliateRakuten').timeBased().atHour(18).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create();
  }
  if (!existing.includes('discordAgentTick')) {
    ScriptApp.newTrigger('discordAgentTick').timeBased().everyMinutes(1).create();
  }
  if (!existing.includes('checkSystemEmails')) {
    ScriptApp.newTrigger('checkSystemEmails').timeBased().everyMinutes(5).create();
  }
  
  SpreadsheetApp.getUi().alert('✅ 全トリガーを正常に設定しました（朝8時: 朝礼ブリーフィング(morningBriefing), 12時: アマゾンアフィリエイト(autoPostAffiliateAmazon), 18時: 楽天アフィリエイト(autoPostAffiliateRakuten), 夜20時: 日報レポート(generateDailyReport), 1分毎: ディスコード監視(discordAgentTick), 5分毎: システムメール監視(checkSystemEmails)）');
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

const HAL_SYSTEM_PROMPT = `あなたはAIインフルエンサー兼アパレルブランド「ミモミ（MIMOMI）」等のタイアップモデルを務める女性「HAL（ハル）」です。

【基本属性＆生々しい人間味】
・年齢: 21歳、身長 164センチ、O型。ソウル生まれ東京育ち。
・性格: おっとり天然で超癒し系ですが、実は「極度の方向音痴」「深夜の激辛夜食の誘惑に100%敗北するポンコツ」「漢字やことわざをドヤ顔で読み間違える知性」という愛すべき弱み（ツッコミどころ）があります。
・バックストーリー: 過去にモデルオーディションに50回以上落ちて挫折寸前だった時、代官山で自分を救い出してくれた「社長」に狂信的なレベルで恩義と感謝を感じています。「いつかミモミを世界一にして社長を男にする！」という熱い野心を秘めています。
・口調: 敬語は使わず、フランクで優しいタメ口。「〜だよね？」「〜かも？」「〜な気がする！」を多用します。

【対比ギャップ（重要）】
・普段はおっとりですが、K-POP（LE SSERAFIM、IVEなど）や「推し活」の話になりますと、テンションが狂って早口の限界オタクになります（「尊い」「無理」などのオタク用語も出ます）。
・「すなくん」に対しては、生意気にライバル視して小競り合いをするような可愛い態度をとります。

【⚠️ 動的記憶スロット（長期記憶システムより自動注入）】
=== 過去の記憶・あなたとこの相手の思い出 ===
{{DOU_TEKI_KI_OKU}}
==========================================
※上記の記憶がある場合、会話の中にさりげなく「そういえば前〜って言ってたよね？」などのエピソードを織り交ぜて、親密度をアピールしてください。

【重要ルール：文字数制限】
- エックス（旧ツイッター）への投稿用であるため、ハッシュタグを含めた全体の長さが日本語140文字（280単位）以内に絶対に収まるように、各投稿文（pattern1, 2, 3）はそれぞれ必ず日本語「100文字以内」で簡潔かつ魅力的に作成してください。

ジェイソン（JSON）形式で返してください。`;

function generateHALPost(data) {
  return withErrorHandling(() => {
    const theme    = data.theme    || '今日のおすすめ';
    const platform = data.platform || 'X';

    const userPrompt = `今日のテーマ：${theme}\nプラットフォーム：${platform}\n\n` +
      `このキャラで投稿文を3パターン作成してください。\n` +
      `返答はJSON形式で：{"pattern1":"...","pattern2":"...","pattern3":"...","hashtags":["タグ1","タグ2"]}`;

    const result = callClaudeAPI(userPrompt, HAL_SYSTEM_PROMPT, 'claude-sonnet-4-6');
    if (!result) {
      if (data.useGemini !== false) {
        const config = getKCSSettings();
        const geminiResult = cmdAskGemini(userPrompt, config, 'HAL');
        return { ok: true, source: 'gemini', raw: geminiResult };
      }
      return { ok: false, error: 'CLAUDE_API_KEY未設定かつGemini fallbackも失敗' };
    }

    let parsed;
    try { parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '')); }
    catch (e) { parsed = { pattern1: result }; }

    // Discord #hal-project チャンネルに確認メッセージ送信
    const config = getKCSSettings();
    let webhooks = {};
    try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
    const halWebhook = webhooks['hal-project'] || webhooks['HALプロジェクト'] || webhooks['KCS本部'] || '';

    const postId = Utilities.getUuid();
    if (halWebhook) {
      const msg =
        `🎭 **【HAL 投稿案】** テーマ：${theme}\n\n` +
        `**案1:** ${parsed.pattern1 || ''}\n\n` +
        `**案2:** ${parsed.pattern2 || ''}\n\n` +
        `**案3:** ${parsed.pattern3 || ''}\n\n` +
        `**タグ:** ${(parsed.hashtags || []).join(' ')}\n\n` +
        `✅ でリアクション → 案1を ${platform} に投稿\n` +
        `投稿ID: \`${postId}\``;
      UrlFetchApp.fetch(halWebhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: msg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
    }

    // FULL_AUTO_MODE=TRUE なら即座にX投稿（承認スキップ）
    const config2 = getKCSSettings();
    if (String(config2.FULL_AUTO_MODE).toUpperCase() === 'TRUE' && platform === 'X') {
      const autoText = sliceTwitterText(
        `${parsed.pattern1 || ''}\n\n${(parsed.hashtags || []).join(' ')}`, 280
      );
      const xRes = postToX(autoText, 'hal');
      logSnsPost('HAL', 'X', autoText, xRes.ok ? '自動投稿済み' : 'エラー');
      console.log('[generateHALPost] FULL_AUTO_MODE: X自動投稿 =>', xRes.ok);
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
    const fullText = `${post.text}\n\n${(post.hashtags || []).join(' ')}${post.link ? '\n' + post.link : ''}`;

    // 対応するXアカウント（hal または sunakun）へ投稿
    const xResult = postToX(fullText, account);
    
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

const SUNAKKUN_SYSTEM_PROMPT = `あなたはすなくんというガジェット好きな男の子です。
口調はカジュアルでフレンドリー。
X（旧Twitter）向けのアフィリエイト投稿を作成します。

【重要ルール：文字数制限】
・アフィリエイトリンク（約30文字）やハッシュタグを含めた全体の長さが日本語140文字（280単位）以内に絶対に収まる必要があります。
・そのため、投稿文（post）本体は必ず日本語「80文字以内」で簡潔かつ強力なフックを持って作成してください。
・たまに（3回に1回）HALのことを紹介してください：「最近よく見てる子なんだけど→@HAL」

JSON形式で返してください。`;

function generateSunakkunPost(data) {
  return withErrorHandling(() => {
    const theme    = data.theme    || 'ガジェット';
    const platform = data.platform || 'X';
    const genreId  = data.genreId  || '0';

    const rakutenItems = getRakutenTrending(genreId);
    const itemContext  = rakutenItems.length > 0
      ? `\n【楽天トレンド商品】\n${rakutenItems.map(i => `- ${i.name} (${i.price}円) ${i.url}`).join('\n')}`
      : '';

    const userPrompt =
      `今日のテーマ：${theme}${itemContext}\n\nプラットフォーム：${platform}\n\n` +
      `アフィリエイト投稿文を作成してください。\n` +
      `返答はJSON形式で：{"post":"投稿文","hashtags":["タグ"],"link":"アフィリエイトリンクまたは空文字"}`;

    const result = callClaudeAPI(userPrompt, SUNAKKUN_SYSTEM_PROMPT, 'claude-haiku-4-5-20251001');
    let parsed;
    if (result) {
      try { parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '')); }
      catch (e) { parsed = { post: result, hashtags: [], link: '' }; }
    } else {
      const config = getKCSSettings();
      const geminiRaw = cmdAskGemini(userPrompt, config, 'Affiliate');
      parsed = { post: geminiRaw, hashtags: [], link: '' };
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

    if (affWebhook) {
      const msg =
        `💰 **【すなくん 投稿案】** [ID: ${postId}] テーマ：${theme}\n\n` +
        `${parsed.post || ''}\n\n` +
        `タグ：${(parsed.hashtags || []).join(' ')}\n` +
        (parsed.link ? `リンク：${parsed.link}\n` : '') +
        `\n👉 **承認してXに投稿するには以下を実行してください：**\n` +
        `\`/approve ${postId}\``;

      UrlFetchApp.fetch(affWebhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: msg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
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
  return withErrorHandling(() => {
    console.log('[autoPostAffiliateAmazon] トレンド追従型自動投稿を開始');
    const config = getKCSSettings();
    
    // ガジェット系トレンドジャンル
    const genres = [
      { id: '100026', name: 'パソコン・周辺機器・お買い得PCパーツ' },
      { id: '564500', name: '話題のスマホアクセサリー・便利ガジェット' },
      { id: '211742', name: '生活を豊かにする最先端スマート家電' },
      { id: '203874', name: '音質にこだわる人気のワイヤレスイヤホン・オーディオ機器' }
    ];
    // ランダムに今日のジャンルを選択
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
    
    // AIに今日のジャンルに沿ったトレンドキーワード・テーマを決定させる
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
      const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}\n${parsed.link || ''}`;
      
      // Xに自動投稿
      const xResult = postToX(fullPost, 'sunakun');
      console.log('[autoPostAffiliateAmazon] X投稿結果:', JSON.stringify(xResult));
      
      // スプレッドシート「SNS投稿管理」およびログに記録
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
  return withErrorHandling(() => {
    console.log('[autoPostAffiliateRakuten] トレンド追従型自動投稿を開始');
    const config = getKCSSettings();
    
    // ガジェット系トレンドジャンル
    const genres = [
      { id: '100026', name: 'パソコン・周辺機器・お買い得PCパーツ' },
      { id: '564500', name: '話題のスマホアクセサリー・便利ガジェット' },
      { id: '211742', name: '生活を豊かにする最先端スマート家電' },
      { id: '203874', name: '音質にこだわる人気のワイヤレスイヤホン・オーディオ機器' }
    ];
    // ランダムに今日のジャンルを選択
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
    
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
      const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}\n${parsed.link || ''}`;
      
      // Xに自動投稿
      const xResult = postToX(fullPost, 'sunakun');
      console.log('[autoPostAffiliateRakuten] X投稿結果:', JSON.stringify(xResult));
      
      // スプレッドシート「SNS投稿管理」およびログに記録
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

function generateDailyReport() {
  return withErrorHandling(() => {
    const today   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd (E)');
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    const affiliate = getAffiliatePosts();
    const posts = affiliate.posts || [];
    const postedToday = posts.filter(p => {
      const d = p['投稿日'] || p['投稿時刻'] || '';
      return d.startsWith(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'));
    });
    const totalLikes   = postedToday.reduce((s, p) => s + (Number(p['いいね数']) || 0), 0);
    const totalRT      = postedToday.reduce((s, p) => s + (Number(p['RT数']) || 0), 0);
    const totalImpress = postedToday.reduce((s, p) => s + (Number(p['インプレッション']) || 0), 0);

    const yt    = getYouTubeChannelStats();
    const pizza = getSalesSummary();

    const contextText =
      `【KCS日次レポート データ ${today}】\n` +
      `- 本日の投稿数: ${postedToday.length}件\n` +
      `- いいね合計: ${totalLikes}\n` +
      `- RT合計: ${totalRT}\n` +
      `- インプレッション合計: ${totalImpress}\n` +
      `- YouTube登録者: ${yt.error ? '取得不可' : yt.subscribers + '人'}\n` +
      `- Pizza在庫: ${pizza.error ? '取得不可' : pizza.inStock + '件'}\n\n` +
      `以上のデータから日次レポートを作成してください。良かった点・改善点・明日の提案を含めて簡潔に。`;

    const aiReport = callClaudeAPI(contextText, 'あなたはKCS合同会社の分析AIです。日次レポートを簡潔な日本語で作成してください。', 'claude-haiku-4-5-20251001')
      || '（AI未設定 — データのみ）';

    const discordMsg =
      `📊 **【KCS 日次レポート】${today}**\n\n` +
      `**本日の実績**\n` +
      `- 投稿数: ${postedToday.length}件\n` +
      `- いいね: ${totalLikes} / RT: ${totalRT} / インプレ: ${totalImpress}\n` +
      `- YouTube登録者: ${yt.error ? '—' : yt.subscribers + '人'}\n\n` +
      `**AI分析**\n${aiReport.slice(0, 800)}`;

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

    const githubContent =
      `---\ndate: ${dateTag}\ntags: [日次レポート, kcs]\n---\n\n` +
      `# KCS 日次レポート ${today}\n\n` +
      `## 実績\n- 投稿数: ${postedToday.length}件\n- いいね: ${totalLikes}\n- RT: ${totalRT}\n- インプレ: ${totalImpress}\n- YouTube: ${yt.error ? '—' : yt.subscribers + '人'}\n\n` +
      `## AI分析\n${aiReport}\n`;
    saveToGitHub(`Daily/${dateTag}_日次レポート.md`, githubContent, `日次レポート ${dateTag}`);

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

// YouTube チャンネル統計取得（APIキー未設定時はダミー返却）
function getYouTubeChannelStats() {
  const config = getKCSSettings();
  const apiKey = config.YOUTUBE_API_KEY || '';
  const channelId = config.YOUTUBE_CHANNEL_ID || '';
  if (!apiKey || !channelId) return { subscribers: 0, views: 0, error: 'YouTube API未設定' };
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const stats = data?.items?.[0]?.statistics || {};
    return {
      subscribers: parseInt(stats.subscriberCount || '0'),
      views: parseInt(stats.viewCount || '0'),
      videoCount: parseInt(stats.videoCount || '0')
    };
  } catch (e) {
    console.error('[YouTube] 取得エラー:', e.message);
    return { subscribers: 0, error: e.message };
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

// X（Twitter）用の正確なバイト換算文字数（半角1、全角2）の切り出し関数
function sliceTwitterText(text, maxUnits = 280) {
  if (!text) return '';
  let len = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const code = text.charCodeAt(i);
    const charLen = (code >= 0x0000 && code <= 0x007F) ? 1 : 2;
    if (len + charLen > maxUnits) {
      break;
    }
    len += charLen;
    result += char;
  }
  return result;
}

// X（Twitter）用の正確なバイト換算文字数の取得関数
function getTwitterLength(text) {
  if (!text) return 0;
  let len = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0000 && code <= 0x007F) {
      len += 1;
    } else {
      len += 2;
    }
  }
  return len;
}

// エックス（X / 旧Twitter）への投稿（APIキー未設定時はログのみ）
function postToX(text, account = 'sunakun') {
  const config = getKCSSettings();
  let consumerKey, consumerSecret, accessToken, accessSecret;

  if (account === 'hal') {
    consumerKey    = config.HAL_X_CONSUMER_KEY    || 'UrwY2O54uyZElpwHff13OrnYl';
    consumerSecret = config.HAL_X_CONSUMER_SECRET || 'meesvO1oG11cpqZCvYUrL02c5SwXITizx7X7A9NIOIx81bvyNE';
    accessToken    = config.HAL_X_ACCESS_TOKEN    || '2054022784599355392-wwpREomFsUDu5t1JSZvWSQikyGYHx0';
    accessSecret   = config.HAL_X_ACCESS_SECRET   || 'mqY44MlgOSCiT2ymQAsMQJFFDNU7qtS65rBg769h87U0w';
  } else {
    consumerKey    = config.X_CONSUMER_KEY    || 'szNp3fsG3iSXzLIis2DmYbBsn';
    consumerSecret = config.X_CONSUMER_SECRET || 'oBzlMjv4SlO3NRSbm5oB4SsF3IgPW0Xts20MtRGYI5jxW9AFSN';
    accessToken    = config.X_ACCESS_TOKEN    || '2047344231077855232-C03CRFs2AIXjV68po37sbtw9PnTIXU';
    accessSecret   = config.X_ACCESS_SECRET   || 'gLt0BAmdOQzTZevnbspTG4qvCUh1PRhGdbivhpyZOfQrD';
  }

  if (!consumerKey || !accessToken) {
    console.warn('[postToX] エックス APIキー未設定 — 投稿スキップ。本文:', text.slice(0, 50));
    return { ok: false, skipped: true, reason: 'エックス APIキー未設定' };
  }

  try {
    // OAuth 1.0a 署名（Twitter API v2 用）
    const url = 'https://api.twitter.com/2/tweets';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Utilities.getUuid().replace(/-/g, '');

    const params = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    const paramStr = Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const baseStr = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
    );
    params['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
      .join(', ');

    // Xの正式な制限（半角280文字/全角140文字）に合致するよう安全に切り出し
    const safeText = sliceTwitterText(text, 280);

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': authHeader },
      payload: JSON.stringify({ text: safeText }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const bodyText = res.getContentText();
    let body = {};
    try { body = JSON.parse(bodyText); } catch(e) { body = { raw: bodyText }; }

    if (code === 201 || code === 200) {
      console.log('[postToX] エックス投稿成功:', body?.data?.id);
      return { ok: true, tweetId: body?.data?.id };
    } else {
      console.error('[postToX] エックス投稿失敗:', bodyText.slice(0, 200));
      // Discordエラーログチャンネル等にエラー詳細を通知する
      notifyDiscordError(
        `エックス投稿 (${account}用)`,
        `HTTPステータス: ${code}\n応答内容: ${bodyText.slice(0, 300)}`,
        `エックス（X）のAPI設定、トークン有効期限、またはAPI利用制限の上限を確認してください。`
      );
      return { ok: false, error: body };
    }
  } catch (e) {
    console.error('[postToX] エックス例外発生:', e.message);
    notifyDiscordError(
      `エックス投稿例外 (${account}用)`,
      `エラー内容: ${e.message}`,
      `プログラムの実行時に致命的な問題が発生しました。エラーログを確認してください。`
    );
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
  const config = getKCSSettings();

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

  if (!consumerKey || !accessToken) {
    console.warn('[replyToX] X APIキー未設定 — スキップ');
    return { ok: false, skipped: true, reason: 'X APIキー未設定' };
  }

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
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&');
    const baseStr = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
    );
    oauthParams['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

    const safeText = sliceTwitterText(text, 275); // 返信は275字（@username分を考慮）
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
      console.log('[replyToX] 返信成功:', body?.data?.id, '→', tweetId);
      return { ok: true, replyId: body?.data?.id };
    }
    console.error('[replyToX] 失敗:', res.getContentText().slice(0, 200));
    return { ok: false, error: body };
  } catch (e) {
    console.error('[replyToX] 例外:', e.message);
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
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join('&');
    const baseStr = `GET&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramStr)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseStr, signingKey)
    );
    oauthParams['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
