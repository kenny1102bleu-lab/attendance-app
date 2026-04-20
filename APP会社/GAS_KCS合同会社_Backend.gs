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
    const body = JSON.parse(e.postData.contents);

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
  // ... (既存コード) ...
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
