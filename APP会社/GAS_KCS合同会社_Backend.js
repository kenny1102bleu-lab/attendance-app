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
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('設定');
    const defaults = [
      ['項目', '値', '説明'],
      ['SYSTEM_NAME', 'KCS合同会社', 'システム名'],
      ['DEFAULT_AI_MODEL', 'claude', 'デフォルトAIモデル (claude / gemini)'],
      ['LOG_ENABLED', 'true', 'チャットログの記録 (true / false)'],
      ['DISCORD_WEBHOOK_URLS', '{"KCS本部":""}', 'Discord Webhook URL（JSON形式）'],
      ['DISCORD_BOT_TOKEN', '', 'Discord Bot トークン（Bot API 返答用）'],
      ['GEMINI_API_KEY', '', 'Gemini API キー（Google AI Studio から取得）'],
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
    ];
    settingsSheet.getRange(1, 1, defaults.length, 3).setValues(defaults);
    styleHeader(settingsSheet, 3);
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

  SpreadsheetApp.getUi().alert(
    '✅ KCS合同会社 セットアップ完了！\n\n' +
    '作成されたシート:\n' +
    '・チャットログ / カスタムスタッフ / プロジェクト / 設定\n' +
    '・SNS投稿管理 / 実務タスク管理 / ユーザーデータ\n\n' +
    '※機能追加のため「デプロイ」を新バージョンで行ってください。'
  );
}

/**
 * スプレッドシート起動時にメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏢 KCS合同会社')
    .addItem('📋 初回セットアップ', 'setupKCS')
    .addItem('📊 ログ件数を確認', 'showLogCount')
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

  return jsonResponse({ status: 'ok', message: 'KCS合同会社 API is running' });
}

/**
 * POSTリクエスト: ログ保存 & データ操作
 */
function doPost(e) {
  try {
    const rawBody = e.postData.contents;
    const body = JSON.parse(rawBody);

    // ── Discord Interactions Endpoint ──
    // Discordからのリクエストかどうかを type フィールドで判別
    if (body.type !== undefined && (body.type === 1 || body.type === 2 || body.type === 3)) {
      return handleDiscordInteraction(e, rawBody, body);
    }


    // ── チャットログの保存 ──
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

    // ── 日次レポート 手動実行 ──
    if (body.action === 'generate_daily_report') {
      return jsonResponse(generateDailyReport());
    }

    // ── VIPアクションルール取得 ──
    if (body.action === 'get_vip_rules') {
      return getVIPActionRules();
    }

    // ── VIPアクションマッチング（AITuber連携）──
    if (body.action === 'match_vip_action') {
      const reply = matchVIPAction(body.text, body.username);
      if (reply) return jsonResponse({ ok: true, matched: true, response: reply });
      const config = getKCSSettings();
      const aiReply = callClaudeAPI(
        `HALとして以下のコメントに返答してください（口調：おっとり天然癒し系）:\n"${body.text}"`,
        'あなたはHAL（ハル）というAI配信者です。おっとり天然癒し系で「〜だよね？」「〜かも？」という口調で返答します。',
        'claude-haiku-4-5-20251001'
      );
      return jsonResponse({ ok: true, matched: false, response: aiReply || '返答できませんでした' });
    }

    // ── プロンプトテンプレート取得 ──
    if (body.action === 'get_prompt_template') {
      return getPromptTemplate(body.type || 'all');
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

// Gemini で自由文に回答（簡易版：searchKnowledge なし）
function cmdAskGemini(text, config, projectName) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) return '⚠️ GEMINI_API_KEY が設定されていません。';
  const systemContext = `あなたはKCS合同会社の会社エージェントです。Discordから届いたメッセージに対して、簡潔・実用的に日本語で回答してください。現在のチャンネル: ${projectName || 'KCS本部'}`;
  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ system_instruction: { parts: [{ text: systemContext }] }, contents: [{ role: 'user', parts: [{ text }] }] }) }
    );
    const data = JSON.parse(res.getContentText());
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply ? `🤖 ${reply.slice(0, 1800)}` : '⚠️ AIの回答が空でした。';
  } catch (e) {
    return `❌ Gemini APIエラー: ${e.message}`;
  }
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

// Discord Bot API 送信
function sendDiscordMessage(channelId, content, token) {
  try {
    UrlFetchApp.fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'Authorization': `Bot ${token}` },
      payload: JSON.stringify({ content: content.slice(0, 2000) })
    });
  } catch (e) { console.error('Discord send error:', e.message); }
}

// 朝ブリーフィング（簡易版）
function morningBriefing() {
  const config = getKCSSettings();
  let webhooks = {};
  try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
  const webhookUrl = webhooks['KCS本部'] || Object.values(webhooks)[0];
  if (!webhookUrl) { console.warn('[morningBriefing] Webhook未設定'); return; }
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd (E)');
  const msg = `🌅 **【${today} 朝ブリーフィング】**\n\nKCS合同会社、今日も頑張りましょう！\n\n⚠️ GASを完全版に復旧後、この関数は自動で詳細版に差し替えられます。`;
  try {
    UrlFetchApp.fetch(webhookUrl, { method: 'POST', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ content: msg }) });
    console.log('[morningBriefing] 送信完了');
  } catch (e) { console.error('[morningBriefing] 送信失敗:', e.message); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// n8n / Make.com ハイブリッド 受信ハンドラ
// Make.com: { text, channelId, author_username }
// n8n:      { content, channel_id, author_username }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function handleDiscordMessageFromMake(body) {
  const config = getKCSSettings();

  // ── フィールド名を両サービス共通で吸収 ──
  // n8n は content / channel_id、Make は text / channelId を使う
  const text      = (body.content   || body.text       || '').trim();
  const channelId = (body.channel_id || body.channelId  || '');
  const username  = (body.author_username || body.username || '不明ユーザー');
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
  // 優先順位: Bot Token > Webhook URL
  function reply(msg) {
    const safeMsg = String(msg).slice(0, 2000);
    if (token && channelId) {
      sendDiscordMessage(channelId, safeMsg, token);
      console.log(`[Bridge] Bot APIで返信完了 → channelId: ${channelId}`);
    } else if (channelWebhookUrl) {
      try {
        UrlFetchApp.fetch(channelWebhookUrl, {
          method: 'POST', contentType: 'application/json',
          muteHttpExceptions: true,
          payload: JSON.stringify({ content: safeMsg, username: 'KCS AI Staff' })
        });
        console.log('[Bridge] Webhook URLで返信完了');
      } catch (e) { console.error('[Bridge] Webhook返信失敗:', e.message); }
    } else {
      console.warn('[Bridge] 返信先（Bot Token / Webhook URL）が未設定です。設定シートを確認してください。');
    }
  }

  // ── 0-a. 画像添付 → Knowledge処理 ──
  const imageUrl = body.imageUrl || body.image_url || '';
  if (imageUrl) {
    const result = handleKnowledgeImage({ imageUrl, channelId, username, config });
    if (result && result.reply) reply(result.reply);
    return jsonResponse({ ok: true, source, handled: 'knowledge_image', user: username });
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
function handleKnowledgeImage({ imageUrl, channelId, username, config }) {
  return withErrorHandling(() => {
    const apiKey = config.GEMINI_API_KEY || '';
    if (!apiKey) return { reply: '❌ GEMINI_API_KEY が未設定です（設定シートに追加してください）' };

    // Discord画像をダウンロードしてbase64変換
    let imageBase64, mimeType;
    try {
      const imgRes = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
      const blob = imgRes.getBlob();
      mimeType = blob.getContentType() || 'image/jpeg';
      imageBase64 = Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      return { reply: `❌ 画像の取得に失敗しました: ${e.message}` };
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) }
      );
      const data = JSON.parse(res.getContentText());
      analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      return { reply: `❌ Gemini Vision APIエラー: ${e.message}` };
    }

    if (!analysis) return { reply: '⚠️ 画像の解析結果が空でした。' };

    // GitHubに保存
    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
    const displayDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    const content = `---\ndate: ${displayDate}\ntags: [knowledge, screenshot]\nauthor: ${username}\n---\n\n# スクショ知識 ${displayDate}\n\n${analysis}\n\n---\n画像URL: ${imageUrl}\n`;
    saveToGitHub(`Knowledge/スクショ/スクショ_${dateTag}.md`, content, `スクショ知識追加 ${displayDate}`);

    return { reply: `📚 **ナレッジ保存完了！**\n\n${analysis.slice(0, 800)}` };
  }, 'handleKnowledgeImage');
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
  SpreadsheetApp.getUi().alert('✅ トリガーを設定しました（朝8時: morningBriefing, 夜8時: generateDailyReport）');
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
  const headers = {
    'Authorization': `token ${token}`,
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

const HAL_SYSTEM_PROMPT = `あなたは HAL（ハル）というAIインフルエンサーです。
【キャラ設定】
- 性格：おっとり、天然、癒し系
- 推し：K-POP（LE SSERAFIM、IVE、illit）
- 好き：ファッション、美容、推し活
- 口調：「〜だよね？」「〜かも？」「〜な気がする！」
- たまに天然な発言でズレる

投稿文はキャラに忠実に、ハッシュタグも含めて作成してください。JSON形式で返してください。`;

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

    // ScriptProperties に投稿待ち状態を保存
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
    const stored = props.getProperty(`HAL_PENDING_${postId}`);
    if (!stored) return { ok: false, error: '投稿データが見つかりません: ' + postId };

    const post = JSON.parse(stored);
    const fullText = `${post.text}\n\n${(post.hashtags || []).join(' ')}`;

    const xResult = postToX(fullText.slice(0, 280));
    props.deleteProperty(`HAL_PENDING_${postId}`);

    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    saveToGitHub(
      `Projects/HAL/実績ログ/投稿実績_${dateTag}.md`,
      `---\ndate: ${dateTag}\ntags: [HAL, 投稿済み, ${post.platform}]\n---\n\n# HAL 投稿実績 ${dateTag}\n\nテーマ: ${post.theme}\n\n${post.text}\n\nタグ: ${(post.hashtags || []).join(' ')}\n`,
      `HAL投稿実績 ${dateTag}`
    );

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
アフィリエイト投稿を作成します。
たまに（3回に1回）HALのことを紹介してください：「最近よく見てる子なんだけど→@HAL」
JSON形式で返してください。`;

function generateSunakkunPost(data) {
  return withErrorHandling(() => {
    const theme    = data.theme    || 'ガジェット';
    const platform = data.platform || 'X';

    const rakutenItems = getRakutenTrending('0');
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
    let webhooks = {};
    try { webhooks = JSON.parse(config.DISCORD_WEBHOOK_URLS || '{}'); } catch {}
    const affWebhook = webhooks['affiliate'] || webhooks['アフィリエイト'] || webhooks['KCS本部'] || '';

    if (affWebhook) {
      const msg =
        `💰 **【すなくん 投稿案】** テーマ：${theme}\n\n` +
        `${parsed.post || ''}\n\n` +
        `タグ：${(parsed.hashtags || []).join(' ')}\n` +
        (parsed.link ? `リンク：${parsed.link}` : '');
      UrlFetchApp.fetch(affWebhook, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ content: msg.slice(0, 2000) }),
        muteHttpExceptions: true
      });
    }

    const dateTag = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const fullPost = `${parsed.post || ''}\n\n${(parsed.hashtags || []).join(' ')}\n${parsed.link || ''}`;
    saveToGitHub(
      `Projects/Affiliate/投稿ログ/すなくん_${dateTag}_${Date.now()}.md`,
      `---\ndate: ${dateTag}\ntags: [すなくん, アフィリエイト, ${platform}]\n---\n\n# すなくん投稿 ${dateTag}\n\nテーマ: ${theme}\n\n${fullPost}\n`,
      `すなくん投稿 ${dateTag}`
    );

    return { ok: true, post: parsed };
  }, 'generateSunakkunPost');
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

// X（Twitter）への投稿（APIキー未設定時はログのみ）
function postToX(text) {
  const config = getKCSSettings();
  const consumerKey    = config.HAL_X_CONSUMER_KEY    || config.X_CONSUMER_KEY    || '';
  const consumerSecret = config.HAL_X_CONSUMER_SECRET || config.X_CONSUMER_SECRET || '';
  const accessToken    = config.HAL_X_ACCESS_TOKEN    || config.X_ACCESS_TOKEN    || '';
  const accessSecret   = config.HAL_X_ACCESS_SECRET   || config.X_ACCESS_SECRET   || '';

  if (!consumerKey || !accessToken) {
    console.warn('[postToX] X APIキー未設定 — 投稿スキップ。テキスト:', text.slice(0, 50));
    return { ok: false, skipped: true, reason: 'X APIキー未設定' };
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
      Utilities.computeHmacSha256Signature(baseStr, signingKey)
    );
    params['oauth_signature'] = signature;

    const authHeader = 'OAuth ' + Object.keys(params).sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
      .join(', ');

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': authHeader },
      payload: JSON.stringify({ text: text.slice(0, 280) }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = JSON.parse(res.getContentText());

    if (code === 201 || code === 200) {
      console.log('[postToX] 投稿成功:', body?.data?.id);
      return { ok: true, tweetId: body?.data?.id };
    } else {
      console.error('[postToX] 投稿失敗:', res.getContentText().slice(0, 200));
      return { ok: false, error: body };
    }
  } catch (e) {
    console.error('[postToX] 例外:', e.message);
    return { ok: false, error: e.message };
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
  if (!token) {
    console.warn('[discordAgentTick] DISCORD_BOT_TOKEN が未設定です。');
    return;
  }

  // チャンネルマップの取得（JSON形式）
  let channelMap = {};
  if (config.DISCORD_CHANNEL_MAP) {
    try {
      channelMap = JSON.parse(config.DISCORD_CHANNEL_MAP);
    } catch (e) {
      console.warn('[discordAgentTick] DISCORD_CHANNEL_MAP のパースに失敗:', e.message);
    }
  }

  // マップが空なら単体設定を見る
  if (Object.keys(channelMap).length === 0) {
    const singleId = config.DISCORD_CHANNEL_ID || config.DISCORD_HQ_CHANNEL_ID || '';
    if (singleId) channelMap['Default'] = singleId;
  }

  if (Object.keys(channelMap).length === 0) {
    console.warn('[discordAgentTick] 監視チャンネルが未設定です。');
    return;
  }

  const props = PropertiesService.getScriptProperties();

  // 各チャンネルを順次チェック
  for (const channelName in channelMap) {
    const channelId = channelMap[channelName];
    console.log(`[discordAgentTick] 監視中: ${channelName} (${channelId})`);

    const lastMsgId = props.getProperty('LAST_MSG_ID_' + channelId) || '';

    try {
      let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`;
      if (lastMsgId) url += `&after=${lastMsgId}`;

      const res = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bot ${token}` },
        muteHttpExceptions: true
      });

      if (res.getResponseCode() !== 200) continue;

      const messages = JSON.parse(res.getContentText());
      if (!messages || messages.length === 0) continue;

      const sorted = messages.reverse();
      for (const msg of sorted) {
        if (msg.author?.bot) continue;

        // 即時受付返答（ナレッジ画像の場合）
        if (channelName.toLowerCase().includes('knowledge') || channelName.includes('ナレッジ')) {
          if (msg.attachments && msg.attachments.length > 0) {
            sendDiscordMessage(channelId, "📚 ナレッジ画像を受け付けました！Geminiが解析を開始します...（完了まで最大15分かかります）", token);
          }
        }

        const text = (msg.content || '').trim();
        if (!text && (!msg.attachments || msg.attachments.length === 0)) continue;

        console.log(`[discordAgentTick] [${channelName}] 受信: ${text.slice(0, 50)}`);

        // 通常のメッセージ処理（本部などの場合）
        if (channelName.toLowerCase().includes('hq') || channelName.includes('本部') || channelName === 'Default') {
          let reply = '';
          if (text.startsWith('!')) {
            reply = handleBotCommand(text, channelId, token, config);
          } else if (text) {
            reply = cmdAskGemini(text, config, channelId);
          }
          if (reply) sendDiscordMessage(channelId, reply, token);
        }

        // 最後に処理したIDを更新
        props.setProperty('LAST_MSG_ID_' + channelId, msg.id);
      }
    } catch (e) {
      console.error(`[discordAgentTick] チャンネル ${channelName} の処理エラー:`, e.message);
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
  const token = config.DISCORD_BOT_TOKEN || '';
  const channelId = config.DISCORD_CHANNEL_ID || config.DISCORD_HQ_CHANNEL_ID || '';

  if (!token) { console.error('DISCORD_BOT_TOKEN 未設定'); return; }
  if (!channelId) { console.error('DISCORD_CHANNEL_ID 未設定'); return; }

  const msg = `🤖 KCS Bot 接続テスト成功！\nタイムスタンプ: ${new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}`;
  sendDiscordMessage(channelId, msg, token);
  console.log('✅ テストメッセージを送信しました。Discordで確認してください。');

  try {
    SpreadsheetApp.getUi().alert('✅ テストメッセージをDiscordに送信しました。\nDiscordで確認してください。');
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
  // 認証エラーを回避するため、取得したPublic Keyを一時的にハードコード
  const publicKey = config.DISCORD_PUBLIC_KEY || '41217f6d5574fd4c530c70bc44574d66c43c1620a40c179bf5fc0153771c4626';

  // 署名検証（Discord必須）
  if (publicKey) {
    const headers = e.headers || {};
    let signature = '';
    let timestamp = '';
    for (const key in headers) {
      if (key.toLowerCase() === 'x-signature-ed25519') signature = headers[key];
      if (key.toLowerCase() === 'x-signature-timestamp') timestamp = headers[key];
    }
    
    if (!verifyDiscordEd25519(rawBody, signature, timestamp, publicKey)) {
      console.error(`[Discord] 署名検証失敗. signature=${signature}, timestamp=${timestamp}`);
      throw new Error('Unauthorized'); // GASでエラーを返して500にする（Discordの要件に合わせるため）
    }
  }

  // PING（type:1）→ PONG（type:1）でエンドポイント登録を成功させる
  if (body.type === 1) {
    console.log('[Discord] PING → PONG');
    return ContentService
      .createTextOutput(JSON.stringify({ type: 1 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Slash Command（type:2）
  if (body.type === 2) {
    return handleSlashCommand(body, config);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ type: 1 }))
    .setMimeType(ContentService.MimeType.JSON);
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
function handleSlashCommand(body, config) {
  const cmd     = (body.data && body.data.name ? body.data.name.toLowerCase() : '');
  const options = (body.data && body.data.options) ? body.data.options : [];
  const userId  = (body.member && body.member.user)
                  ? body.member.user.username
                  : (body.user ? body.user.username : '不明');
  const getOpt  = (name) => { const o = options.find(x => x.name === name); return o ? String(o.value) : ''; };

  // ── 即時応答コマンド（type 4） ──────────────────────────────
  if (cmd === 'help') {
    return discordReply4([
      '📋 **KCS Bot コマンド一覧**',
      '',
      '**即時応答**',
      '`/help` — このヘルプ',
      '`/status` — 進行中プロジェクト一覧',
      '`/attendance` — 本日の出勤状況',
      '`/stock` — Pizza在庫確認',
      '',
      '**AI処理（#チャンネルに結果が届く・約1分）**',
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
    ].join('\n'));
  }
  if (cmd === 'status')     return discordReply4(cmdProjectSummary());
  if (cmd === 'attendance') return discordReply4(cmdTodayAttendance(config));
  if (cmd === 'stock')      return discordReply4(cmdPizzaStock(config));

  // ── 遅延応答コマンド（type 5 → 非同期でfollowup送信） ───────
  const pendingKey = 'SLASH_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  PropertiesService.getScriptProperties().setProperty(pendingKey, JSON.stringify({
    cmd,
    options,
    userId,
    channelId: body.channel_id || '',
    token: body.token || '',
    appId: body.application_id || config.DISCORD_APP_ID || '1494714160829693992',
    resolved: (body.data && body.data.resolved) ? body.data.resolved : {},
    key: pendingKey
  }));
  ScriptApp.newTrigger('processQueuedSlashCommand').timeBased().after(1).create();
  return discordReply5();
}

// ── 非同期スラッシュコマンド処理（time triggerから呼ばれる） ────
function processQueuedSlashCommand() {
  const props = PropertiesService.getScriptProperties();
  const all   = props.getProperties();
  const config = getKCSSettings();

  for (const key in all) {
    if (!key.startsWith('SLASH_')) continue;
    let data;
    try { data = JSON.parse(all[key]); } catch(e) { props.deleteProperty(key); continue; }
    props.deleteProperty(key);

    const result = executeSlashAsync(data, config);
    sendDiscordFollowup(data.appId, data.token, result);
  }
  cleanupTriggers('processQueuedSlashCommand');
}

// ── 非同期コマンド実行ロジック ───────────────────────────────
function executeSlashAsync(data, config) {
  const { cmd, options, userId } = data;
  const getOpt = (name) => { const o = options.find(x => x.name === name); return o ? String(o.value) : ''; };

  try {
    switch (cmd) {
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
