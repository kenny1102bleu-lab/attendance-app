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

  SpreadsheetApp.getUi().alert(
    '✅ KCS合同会社 セットアップ完了！\n\n' +
    '作成されたシート:\n' +
    '・チャットログ（AI会話の記録）\n' +
    '・カスタムスタッフ（追加スタッフ管理）\n' +
    '・プロジェクト（進行管理）\n' +
    '・設定（システム設定）\n\n' +
    '次のステップ: 「デプロイ」→「ウェブアプリ」でURLを発行してください。'
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
// ユーティリティ
// ===================================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
