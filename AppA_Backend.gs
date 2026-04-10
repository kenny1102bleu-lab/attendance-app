// ===================================================
// アプリA：打刻バックエンド (1_AppA_Backend.gs)
// ============= 役割 =================================
// ・LINE/QRからの打刻を受け取り、生データとして保存
// ・ドライバーへのリアルタイム実績返信
// ・「設定シート」による一元管理
// ===================================================

/**
 * 簡易セットアップ（不足シートの補完・既存シートのヘッダー最新化）
 * 【重要】既存のデータ（2行目以降）は一切消去せず、ヘッダー（1行目）のみ上書きします。
 */
function setupA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 設定シート
  let set = ss.getSheetByName('設定');
  if (!set) {
    set = ss.insertSheet('設定');
    const defaultSettings = [
      ['項目', '値', '説明'],
      ['LINE_ACCESS_TOKEN', 'ここにトークンを入力', 'LINEチャネルアクセストークン'],
      ['LINE_NOTIFY_TOKEN', '', '管理者通知用LINE Notifyトークン(任意)'],
      ['UNIT_PRICE_SALES', '137.5', '売上単価（税込1個あたり）'],
      ['UNIT_PRICE_LABOR', '80', '人件費単価（1個あたり）'],
      ['RENTAL_FEE_H', '120', '車両レンタル料（1時間あたり）'],
      ['COMPANY_NAME', 'KCS合同会社', '会社名'],
      ['REPORT_SS_ID', '', '連携先：管理ダッシュボードのSS_ID'],
      ['CORP_REPORT_SS_ID', '', '連携先：会社提出用SS_ID'],
      ['SHIFT_SS_ID', '18IrG3sZXSgsCWJCa9mhmgWUNZT3RXdnV', '外部連携：シフト表スプレッドシートID']
    ];
    set.getRange(1, 1, defaultSettings.length, 3).setValues(defaultSettings);
  }
  styleHeaderA(set, 3);
  set.setColumnWidth(1, 180); set.setColumnWidth(2, 400);

  // 2. 打刻データ
  let log = ss.getSheetByName('打刻データ');
  const logH = ['スタッフID','名前','種別','日付','時刻','タイムスタンプ','配完個数','売上','レンタル費','差引支給額','人件費単価','人件費','持ち出し','不在','ストアID','依頼'];
  if (!log) log = ss.insertSheet('打刻データ');
  log.getRange(1, 1, 1, logH.length).setValues([logH]);
  styleHeaderA(log, logH.length);

  // 3. スタッフ一覧
  let staff = ss.getSheetByName('スタッフ一覧');
  const staffH = ['スタッフID','名前','店舗名','役職','LINE userId','車両レンタル','ストアID'];
  if (!staff) staff = ss.insertSheet('スタッフ一覧');
  staff.getRange(1, 1, 1, staffH.length).setValues([staffH]);
  styleHeaderA(staff, staffH.length);

  // 4. 入荷記録
  let arrival = ss.getSheetByName('入荷記録');
  const arrH = ['日付','時刻','種別','個数','タイムスタンプ','店舗名','担当者'];
  if (!arrival) arrival = ss.insertSheet('入荷記録');
  arrival.getRange(1, 1, 1, arrH.length).setValues([arrH]);
  styleHeaderA(arrival, arrH.length);

  SpreadsheetApp.getUi().alert('✅ シートのセットアップ（ヘッダーの最新化）が完了しました！\n既存のデータはそのまま保持されています。');
}

/**
 * アプリA用：ヘッダースタイル適用
 */
function styleHeaderA(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount).setBackground('#1a73e8').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * 設定情報の取得ヘルパー
 */
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) config[data[i][0]] = data[i][1];
  }
  return config;
}

// ----------------------------------------------------
// 単価テーブル・計算ルール 
// ----------------------------------------------------
const CONFIG_TABLES = {
  // 売上単価テーブル（税込・1個あたり）
  PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 125, tax: 0.1 } ],
  // 人件費単価テーブル（スタッフ支払額・1個あたり）
  LABOR_PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 80 } ]
};

function getPricePerItem(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'));
  let entry = CONFIG_TABLES.PRICE_TABLE[0];
  CONFIG_TABLES.PRICE_TABLE.forEach(p => { if (d >= new Date(p.from.replace(/\//g, '-'))) entry = p; });
  return Math.round(entry.unitPrice * (1 + entry.tax) * 10) / 10;
}

function getLaborPricePerItem(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'));
  let entry = CONFIG_TABLES.LABOR_PRICE_TABLE[0];
  CONFIG_TABLES.LABOR_PRICE_TABLE.forEach(p => { if (d >= new Date(p.from.replace(/\//g, '-'))) entry = p; });
  return entry.unitPrice;
}

// ----------------------------------------------------
// Webアプリ 入口
// ----------------------------------------------------

function doGet(e) {
  const type = e.parameter.type;
  if (e.parameter.action === 'stamp') {
    processStamp(e.parameter);
    return HtmlService.createHtmlOutput(genResultHtml('打刻完了', '打刻が正常に完了しました！', true)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (e.parameter.action === 'get_shift') {
    return ContentService.createTextOutput(JSON.stringify(getShiftData(e.parameter.storeId))).setMimeType(ContentService.MimeType.JSON);
  }
  if (!type) return HtmlService.createHtmlOutput(genResultHtml('エラー', '不正なアクセスです。', false)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  const staffList = getStaffList();
  let deployUrl = '';
  try { deployUrl = ScriptApp.getService().getUrl(); } catch(e) {}
  return HtmlService.createHtmlOutput(genFormHtml(type, staffList, e.parameter.storeId, deployUrl)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.events) body.events.forEach(event => handleLineWebhook(event));
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    console.error('doPostエラー: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({status: 'error'})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------
// 打刻処理 & LINE応答
// ----------------------------------------------------

function processStamp(p) {
  console.log('processStamp受領: ' + JSON.stringify(p));
  const ss = SpreadsheetApp.getActiveSpreadsheet(), config = getSettings();
  const staff = getStaffInfo(p.staffId);
  if (!staff) { console.error('スタッフが見つかりません: ' + p.staffId); return; }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');
  const timeStr = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm:ss');
  const sheet = ss.getSheetByName('打刻データ');
  
  if (!sheet) { console.error('打刻データシートが見つかりません'); return; }

  const storeId = p.storeId || staff.storeId;
  const storeName = staff.storeName || '';
  const kind = p.type; 

  if (kind === 'work_in') {
    sheet.appendRow([staff.id, staff.name, '出勤', dateStr, timeStr, now, '', '', '', '', '', '', '', '', storeId]);
    sendNotificationToRoleByStore('管理者', '【出勤】🟢\n' + staff.name + ' さんが出勤しました\n店舗: ' + storeName + '\n⏰ ' + timeStr, storeId);
    if(staff.userId) {
      sendLine(config.LINE_ACCESS_TOKEN, '【打刻完了】🟢\n出勤の打刻が完了しました！\n⏰ ' + timeStr, null, null, staff.userId);
    }
  } else if (kind === 'car_out') {
    sheet.appendRow([staff.id, staff.name, '出庫', dateStr, timeStr, now, '', '', '', '', '', '', '', '', storeId]);
    sendNotificationToRoleByStore('管理者', '【出庫】🚗\n' + staff.name + ' さんが出庫しました\n店舗: ' + storeName + '\n⏰ ' + timeStr, storeId);
    if(staff.userId) {
      sendLine(config.LINE_ACCESS_TOKEN, '【打刻完了】🚗\n出庫の打刻が完了しました。\n本日も安全運転でいってらっしゃいませ！\n⏰ ' + timeStr, null, null, staff.userId);
    }
  } else if (kind === 'car_in') {
    const rentalMins = calcRentalMins(staff.id, dateStr);
    const rentalFee = (staff.rental === 'なし') ? 0 : Math.round(Number(config.RENTAL_FEE_H || 0) * rentalMins / 60);
    sheet.appendRow([staff.id, staff.name, '帰庫', dateStr, timeStr, now, 0, 0, rentalFee, -rentalFee, 0, 0, 0, 0, storeId]);
    console.log('帰庫記録を追記しました。ID:' + staff.id);
    
    // 管理者へ通知
    const rmMsg = (rentalMins > 0) ? `\n🚗 車両: ${Math.floor(rentalMins/60)}時間${rentalMins%60}分` : '';
    sendNotificationToRoleByStore('管理者', '【帰庫】🏠\n' + staff.name + ' さんが帰庫しました\n店舗: ' + storeName + '\n⏰ ' + timeStr + rmMsg, storeId);
    
    // ドライバー本人へ報告要請
    if (staff.userId) {
      sendLine(config.LINE_ACCESS_TOKEN, '【打刻完了・帰庫報告のお願い】📋\n帰庫の打刻が完了しました。お疲れ様でした！\n\n以下の形式で返信してください：\n\n持ち出し:80\n配完:75\n不在:5\n依頼:0\n\n数字を入力後、Amazon等のスクリーンショットを送ってください📸', null, null, staff.userId);
    }
  }
}

function handleLineWebhook(event) {
  const config = getSettings(), userId = event.source.userId;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staff = getStaffByUserId(userId);
  
  // --- 新規登録の対話状態の管理 ---
  const props = PropertiesService.getScriptProperties();
  const stateKey = 'REG_STATE_' + userId;
  const stateJson = props.getProperty(stateKey);

  // 友だち追加時に未登録なら案内を送る
  if (event.type === 'follow' && !staff) {
    sendLine(config.LINE_ACCESS_TOKEN, '友だち追加ありがとうございます！🎉\n\n【初期登録】\nお手数ですが、まずは「あなたのお名前（フルネーム）」を送信してください。\n\n例：山田 太郎', null, null, userId);
    props.setProperty(stateKey, JSON.stringify({ step: 1 }));
    return;
  }

  // --- 未登録スタッフの対話式登録フロー ---
  if (!staff && event.type === 'message' && event.message.type === 'text') {
    let text = event.message.text.trim();
    let state = stateJson ? JSON.parse(stateJson) : null;

    if (text === 'リセット' || text === '最初から' || text.startsWith('登録')) {
       sendLine(config.LINE_ACCESS_TOKEN, '登録を最初からやり直します。\n「あなたのお名前（フルネーム）」を送信してください。\n\n例：山田 太郎', null, event.replyToken, userId);
       props.setProperty(stateKey, JSON.stringify({ step: 1 }));
       return;
    }

    if (!state || !state.step) {
      sendLine(config.LINE_ACCESS_TOKEN, '【初期登録】\nシステムに未登録です。まずは「あなたのお名前（フルネーム）」を送信してください。\n\n例：山田 太郎', null, event.replyToken, userId);
      props.setProperty(stateKey, JSON.stringify({ step: 1 }));
      return;
    }

    if (state.step === 1) {
      state.name = text;
      state.step = 2;
      props.setProperty(stateKey, JSON.stringify(state));
      sendLine(config.LINE_ACCESS_TOKEN, '✅ お名前を「' + text + '」で受け付けました。\n\n次に、所属する「店舗名」を送信してください。\n例：つくばHUB', null, event.replyToken, userId);
      return;
    }

    if (state.step === 2) {
      state.store = text;
      state.step = 3;
      props.setProperty(stateKey, JSON.stringify(state));
      sendLine(config.LINE_ACCESS_TOKEN, '✅ 店舗名を「' + text + '」で受け付けました。\n\n次に、あなたの「役職」を選択し、数字を送信してください。\n\n1、ドライバー\n2、ドライバー＋管理者\n3、ドライバー＋管理者＋オーナー\n4、ドライバー＋オーナー', null, event.replyToken, userId);
      return;
    }

    if (state.step === 3) {
      let roleStr = '';
      if (text.includes('1')) roleStr = 'ドライバー';
      else if (text.includes('2')) roleStr = 'ドライバー, 管理者';
      else if (text.includes('3')) roleStr = 'ドライバー, 管理者, オーナー';
      else if (text.includes('4')) roleStr = 'ドライバー, オーナー';
      else {
         sendLine(config.LINE_ACCESS_TOKEN, '⚠️ エラー：1〜4のいずれかの数字を送信してください。', null, event.replyToken, userId);
         return;
      }
      state.role = roleStr;
      state.step = 4;
      props.setProperty(stateKey, JSON.stringify(state));
      sendLine(config.LINE_ACCESS_TOKEN, '✅ 役職を「' + roleStr + '」で受け付けました。\n\n最後に、車両のレンタルを利用しますか？\n\n1、あり（レンタル等）\n2、なし（自前車両等）', null, event.replyToken, userId);
      return;
    }

    if (state.step === 4) {
      let rentalStr = 'あり';
      if (text.includes('1') || text.includes('あり')) rentalStr = 'あり';
      else if (text.includes('2') || text.includes('なし')) rentalStr = 'なし';
      else {
         sendLine(config.LINE_ACCESS_TOKEN, '⚠️ エラー：1か2の数字を送信してください。', null, event.replyToken, userId);
         return;
      }

      // 登録処理の実行
      const newId = registerStaffAsAutomated(ss, userId, state.name, state.store, state.role, rentalStr);
      props.deleteProperty(stateKey);
      sendLine(config.LINE_ACCESS_TOKEN, '🎉 システムへの登録が完了しました！\n\n【登録内容】\nID：' + newId + '\n名前：' + state.name + '\n店舗：' + state.store + '\n役職：' + state.role + '\n車両：' + rentalStr + '\n\n以降はこのLINEにて、実績報告等の機能がご利用いただけます！', null, event.replyToken, userId);
      return;
    }
    return;
  }

  // --- 既存のスタッフのメッセージ処理 ---
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    
    if (text === '履歴') {
      replyPersonalRecord(userId, staff, event.replyToken); return;
    }

    if (text === '本日の実績' && staff) { handleTodayResult(ss, userId, staff, Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'), event.replyToken, config); return; }
    if (text === '今月の給与' && staff) { handleMonthlyResult(ss, userId, staff, new Date(), event.replyToken, config); return; }
    if (text === '管理者に電話' && staff) { handleCallManager(ss, userId, staff, event.replyToken, config); return; }
    
    // 実績報告の解析
    const completeMatch = text.match(/(?:配完|配達完了)[:：]?\s*(\d+)/);
    const absentMatch = text.match(/不在[:：]?\s*(\d+)/);
    const takeoutMatch = text.match(/持ち出し[:：]?\s*(\d+)/);
    const iraiMatch = text.match(/依頼[:：]?\s*(\d+)/);
    
    if ((completeMatch || takeoutMatch) && staff) {
      const c = completeMatch ? completeMatch[1] : 0;
      const t = takeoutMatch ? takeoutMatch[1] : 0;
      const a = absentMatch ? absentMatch[1] : 0;
      const i = iraiMatch ? iraiMatch[1] : 0;

      const res = updateReport(staff.name, c, t, a, i);
      if (res) {
        sendLine(config.LINE_ACCESS_TOKEN, `✅ 報告受領完了！\n給与見込: ¥${res.laborTotal.toLocaleString()}\n差引支給: ¥${res.netPayment.toLocaleString()}`, null, event.replyToken, userId);
        sendNotificationToRoleByStore('管理者', `📦 【報告】${staff.name}: 配完${c}/不在${a}/依頼${i}`, staff.storeId);
      } else {
        sendLine(config.LINE_ACCESS_TOKEN, `✅ 報告を記録しました！\n配完: ${c}個`, null, event.replyToken, userId);
      }
      return;
    }

    // 入荷・回収の解析
    const arrivalMatch = text.match(/入荷[:：]\s*(\d+)/);
    const collectionMatch = text.match(/回収[:：]\s*(\d+)/);
    if ((arrivalMatch || collectionMatch) && staff) {
      let arrivalSheet = ss.getSheetByName('入荷記録');
      if (!arrivalSheet) arrivalSheet = ss.insertSheet('入荷記録');
      let replyMsg = '✅ 記録しました！\n';
      const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
      const timeStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm:ss');
      
      if (arrivalMatch) {
         arrivalSheet.appendRow([today, timeStr, '入荷', parseInt(arrivalMatch[1], 10), new Date(), staff.storeName || '', staff.name]);
         replyMsg += `📦 入荷：${arrivalMatch[1]}個\n`;
      }
      if (collectionMatch) {
         arrivalSheet.appendRow([today, timeStr, '回収', parseInt(collectionMatch[1], 10), new Date(), staff.storeName || '', staff.name]);
         replyMsg += `🔄 回収：${collectionMatch[1]}個\n`;
      }
      sendLine(config.LINE_ACCESS_TOKEN, replyMsg, null, event.replyToken, userId);
      return;
    }
  }

  // 画像受信時（指示画像等）
  if (event.type === 'message' && event.message.type === 'image') {
    const staff = getStaffByUserId(userId);
    if (staff && staff.storeId) {
      const nowHour = new Date().getHours();
      // 役職情報の再取得（getStaffByUserIdではroleが含まれていないため）
      const rows = ss.getSheetByName('スタッフ一覧').getDataRange().getValues();
      let roleStr = '';
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][4]) === String(userId)) { roleStr = String(rows[i][3]); break; }
      }
      
      // 朝8時〜12時に管理者・オーナーから画像が届いた場合、指示として扱う
      if ((roleStr.includes('管理者') || roleStr.includes('オーナー')) && nowHour >= 8 && nowHour <= 12) {
        if (nowHour < 9) {
          storeMorningInstruction(ss, staff.storeId, event.message.id);
          sendLine(config.LINE_ACCESS_TOKEN, '✅ 承知いたしました！9:00にドライバーへ一斉送信します。', null, event.replyToken, userId);
        } else {
          forwardInstructionToShiftDrivers(ss, staff.storeId, event.message.id);
          sendLine(config.LINE_ACCESS_TOKEN, '✅ 本日出勤のドライバーへ指示を転送しました！', null, event.replyToken, userId);
        }
        return;
      }
      // それ以外の通常の画像受信（OCR処理）
      try {
        const ocrText = getImageTextFromLine(event.message.id, config.LINE_ACCESS_TOKEN);
        const takeoutCount = extractTakeoutCount(ocrText);
        const trackingMatches = ocrText.match(/DA[0-9A-Za-z]{8,}/g) || [];
        const uniqueTrackings = [...new Set(trackingMatches)];
        const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

        if (takeoutCount !== null) {
          const sheet = ss.getSheetByName('打刻データ');
          const logs = sheet.getDataRange().getValues();
          for (let i = logs.length - 1; i >= 1; i--) {
            if (logs[i][1] === staff.name && logs[i][2] === '出庫' && String(logs[i][3]).includes(today)) {
              sheet.getRange(i + 1, 13).setValue(takeoutCount);
              break;
            }
          }
          sendLine(config.LINE_ACCESS_TOKEN, `✅ 持ち出し個数 ${takeoutCount}個 を自動登録しました！`, null, event.replyToken, userId);
        }
        
        if (uniqueTrackings.length > 0) {
          let trackingSheet = ss.getSheetByName('不在追跡記録');
          if (!trackingSheet) {
            trackingSheet = ss.insertSheet('不在追跡記録');
            trackingSheet.appendRow(['タイムスタンプ', '日付', 'スタッフ', '店舗', '伝票番号']);
          }
          uniqueTrackings.forEach(tn => trackingSheet.appendRow([new Date(), today, staff.name, staff.storeName, tn]));
          // takeoutCountが処理された場合はreplyTokenが消費されているためpushで送信
          sendLine(config.LINE_ACCESS_TOKEN, `📦 不在・持戻り記録を${uniqueTrackings.length}件自動登録しました。`, null, takeoutCount !== null ? null : event.replyToken, userId);
        } else if (takeoutCount === null) {
          sendLine(config.LINE_ACCESS_TOKEN, '✅ 画像を受領しました！', null, event.replyToken, userId);
        }
      } catch (err) {
        console.error('OCR処理エラー:', err.message);
        sendLine(config.LINE_ACCESS_TOKEN, '✅ 画像を受領しました！', null, event.replyToken, userId);
      }
    }
  }
}

// ===================================================
// 外部シフト表 連携システム
// ===================================================

function getShiftData(reqStoreId) {
  const config = getSettings();
  const ssId = config.SHIFT_SS_ID;
  if (!ssId) return { status: 'error', message: 'SHIFT_SS_ID が設定されていません。' };
  
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheets()[0]; // 最初のシート
    const data = sheet.getDataRange().getValues();
    
    // データ構造の前提：
    // 行2：E列以降に「曜日」
    // 行3：E列以降に「日付」（1〜31）
    // 行5以降：A列＝店舗ID、B列＝スタッフID、D列＝名前、E列〜AG列＝シフト記号
    
    // 日付ヘッダーの取得 (E列=インデックス4から)
    const dates = [];
    if (data.length > 2) {
      for (let c = 4; c < data[2].length; c++) {
        const d = String(data[2][c]).trim();
        if (d) dates.push(d); else break;
      }
    }
    
    const shifts = [];
    for (let r = 4; r < data.length; r++) {
      const storeId = String(data[r][0]).trim();
      const staffId = String(data[r][1]).trim();
      const staffName = String(data[r][3]).trim();
      
      // reqStoreId がある場合はフィルタリング
      if (reqStoreId && storeId !== reqStoreId) continue;
      
      if (staffId || staffName) {
        const rowShifts = [];
        for (let c = 4; c < 4 + dates.length; c++) {
          rowShifts.push(String(data[r][c] || '').trim());
        }
        shifts.push({
          storeId: storeId,
          staffId: staffId,
          name: staffName,
          schedule: rowShifts
        });
      }
    }
    
    return { status: 'ok', dates: dates, shifts: shifts };
    
  } catch (err) {
    return { status: 'error', message: 'シフト表の取得に失敗しました: ' + err.message };
  }
}

/**
 * 外部のシフト表にA列(店舗ID)とB列(スタッフID)を自動挿入するサポート関数
 */
function formatShiftSheetAutomatically() {
  const config = getSettings();
  const ssId = config.SHIFT_SS_ID;
  if (!ssId) {
    SpreadsheetApp.getUi().alert('設定シートに SHIFT_SS_ID が登録されていません。');
    return;
  }
  
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheets()[0];
    
    // すでにA列が店舗IDになっていないか確認
    if (sheet.getRange('A1').getValue() !== '店舗ID') {
      sheet.insertColumnsBefore(1, 2);
      sheet.getRange('A1').setValue('店舗ID').setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
      sheet.getRange('B1').setValue('スタッフID').setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setColumnWidth(1, 100);
      sheet.setColumnWidth(2, 100);
      SpreadsheetApp.getUi().alert('✅ 外部シフト表に「店舗ID」と「スタッフID」の列を作成しました！\n実際のシフト表を開いて、IDを入力してください。');
    } else {
      SpreadsheetApp.getUi().alert('既に店舗IDの列が存在するようです。');
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラーが発生しました。\n(外部ファイルへのアクセス権限がない可能性があります)\n' + e.message);
  }
}

// ------ 追加ヘルパー関数群 ------
function handleTodayResult(ss, userId, staffInfo, todayStr, replyToken, config) {
  const sheet = ss.getSheetByName('打刻データ'), logs = sheet.getDataRange().getValues();
  let takeout=0, complete=0, absent=0, net=0, found=false;
  for (let i = logs.length-1; i >= 1; i--) {
    let d = (logs[i][3] instanceof Date) ? Utilities.formatDate(logs[i][3], 'Asia/Tokyo', 'yyyy/MM/dd') : String(logs[i][3]);
    if (logs[i][1] === staffInfo.name && d === todayStr && logs[i][2] === '帰庫') {
      complete = logs[i][6]; takeout = logs[i][12]; absent = logs[i][13]; net = logs[i][9]; found = true; break;
    }
  }
  let msg = `📊 【本日実績】${todayStr}\n📦 持ち出し: ${takeout}個\n` + (found ? `✅ 配完: ${complete}個(不在${absent})\n💰 差引支給: ¥${net.toLocaleString()}` : `※現在業務中です`);
  sendLine(config.LINE_ACCESS_TOKEN, msg, null, replyToken, userId);
}

function handleMonthlyResult(ss, userId, staffInfo, nowDate, replyToken, config) {
  const sheet = ss.getSheetByName('打刻データ'), logs = sheet.getDataRange().getValues();
  const prefix = Utilities.formatDate(nowDate, 'Asia/Tokyo', 'yyyy/MM/');
  let totalDel = 0, totalNet = 0;
  logs.forEach(r => {
    let d = (r[3] instanceof Date) ? Utilities.formatDate(r[3], 'Asia/Tokyo', 'yyyy/MM/dd') : String(r[3]);
    if (r[1] === staffInfo.name && r[2] === '帰庫' && d.startsWith(prefix)) { totalDel += Number(r[6])||0; totalNet += Number(r[9])||0; } 
  });
  sendLine(config.LINE_ACCESS_TOKEN, `📈 【月間給与予測】\n✅ 総配完: ${totalDel}個\n💰 見込給与: ¥${totalNet.toLocaleString()}`, null, replyToken, userId);
}

function replyPersonalRecord(userId, staffInfo, replyToken) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), config = getSettings();
  const sheet = ss.getSheetByName('打刻データ');
  if(!sheet) return;
  const logs = sheet.getDataRange().getValues();
  
  let recentLogs = [];
  for (let i = logs.length - 1; i >= 1 && recentLogs.length < 5; i--) {
    if (logs[i][1] === staffInfo.name) {
      let d = (logs[i][3] instanceof Date) ? Utilities.formatDate(logs[i][3], 'Asia/Tokyo', 'MM/dd') : String(logs[i][3]).substring(5,10);
      recentLogs.push(`${d} ${logs[i][2]} (${logs[i][4]})`);
    }
  }
  
  const msg = recentLogs.length > 0 
    ? `📋 【最近の打刻履歴】\n${recentLogs.join('\n')}`
    : `📋 【最近の打刻履歴】\n記録が見つかりません。`;
    
  sendLine(config.LINE_ACCESS_TOKEN, msg, null, replyToken, userId);
}

// ----------------------------------------------------
// 内部ユーティリティ
// ----------------------------------------------------

function getStaffInfo(id) {
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('スタッフ一覧').getDataRange().getValues();
  for(let i=1; i<rows.length; i++) if(String(rows[i][0]) === String(id)) return {id:rows[i][0], name:rows[i][1], storeName:rows[i][2], rental:rows[i][5], storeId:rows[i][6], userId:rows[i][4]};
  return null;
}

function getStaffByUserId(uId) {
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('スタッフ一覧').getDataRange().getValues();
  for(let i=1; i<rows.length; i++) if(String(rows[i][4]) === String(uId)) return {id:rows[i][0], name:rows[i][1], storeName:rows[i][2], storeId:rows[i][6]};
  return null;
}

function getStaffList() {
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('スタッフ一覧').getDataRange().getValues();
  return rows.slice(1).map(r => ({id:r[0], name:r[1], store:r[2]}));
}

function calcRentalMins(sId, date) {
  const logs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('打刻データ').getDataRange().getValues();
  let outTime = null;
  for(let i=logs.length-1; i>=1; i--) {
    if(String(logs[i][0])===String(sId) && logs[i][2]==='出庫' && String(logs[i][3])===date) { outTime = new Date(logs[i][5]); break; }
  }
  return outTime ? Math.floor((new Date() - outTime) / 60000) : 0;
}

function updateReport(name, complete, takeout, absent, irai = 0) {
  console.log('実績更新開始: ' + name + ' (配完:' + complete + ')');
  const ss = SpreadsheetApp.getActiveSpreadsheet(), config = getSettings();
  const sheet = ss.getSheetByName('打刻データ');
  if (!sheet) { console.error('エラー：「打刻データ」シートが見つかりません'); return; }
  
  const logs = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  
  for(let i=logs.length-1; i>=1; i--) {
    // 日付データの正規化（Dateオブジェクトか文字列か判定）
    const cellValue = logs[i][3];
    const logDate = (cellValue instanceof Date) ? Utilities.formatDate(cellValue, 'Asia/Tokyo', 'yyyy/MM/dd') : String(cellValue);
    const logName = String(logs[i][1]).trim();
    const logKind = String(logs[i][2]).trim();

    if(logName === String(name).trim() && logKind === '帰庫' && logDate === today) {
      const row = i + 1;
      console.log('対象行を発見: ' + row + '行目');
      
      const sales = Math.round((Number(complete) + Number(irai)) * getPricePerItem(logDate));
      const labor = Math.round((Number(complete) + Number(irai)) * getLaborPricePerItem(logDate));
      const rental = Number(logs[i][8]) || 0;
      
      sheet.getRange(row, 7).setValue(Number(complete));
      sheet.getRange(row, 8).setValue(sales);
      sheet.getRange(row, 11).setValue(getLaborPricePerItem(logDate));
      sheet.getRange(row, 12).setValue(labor);
      sheet.getRange(row, 13).setValue(Number(takeout));
      sheet.getRange(row, 14).setValue(Number(absent));
      sheet.getRange(row, 10).setValue(labor - rental);
      sheet.getRange(row, 16).setValue(Number(irai));
      
      console.log('保存完了: ' + name + 'さん ' + row + '行目');
      return { laborTotal: labor, netPayment: labor - rental };
    }
  }
  return null;
}

function sendLine(token, msg, buttons, replyToken, toUserId) {
  const url = 'https://api.line.me/v2/bot/message/' + (replyToken ? 'reply' : 'push');
  const payload = { messages: [{ type: 'text', text: msg }] };
  if (replyToken) payload.replyToken = replyToken; else if (toUserId) payload.to = toUserId; else return;
  UrlFetchApp.fetch(url, { method: 'post', headers: { Authorization: 'Bearer ' + token }, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
}

function sendLineNotify(token, msg) {
  const url = 'https://notify-api.line.me/api/notify';
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: { 'message': msg },
    muteHttpExceptions: true
  });
}

function genFormHtml(type, staff, storeId, deployUrl) {
  const TC = { work_in:{ label:'出勤', emoji:'🟢', color:'#43a047' }, car_out:{ label:'出庫', emoji:'🚗', color:'#1e88e5' }, car_in:{ label:'帰庫', emoji:'🏠', color:'#e53935' } }[type] || { label:'打刻', emoji:'📋', color:'#555' };
  const staffOptions = staff.map(s => `<option value="${s.id}">${s.store ? '['+s.store+'] ' : ''}${s.name}</option>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TC.label}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.card{background:#fff;border-radius:20px;padding:32px 24px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.12);text-align:center}.emoji{font-size:52px;margin-bottom:10px}h1{font-size:22px;color:#333;margin-bottom:20px}.field{text-align:left;margin-bottom:16px}label{display:block;font-size:13px;font-weight:bold;color:#555;margin-bottom:6px}select{width:100%;padding:14px;font-size:17px;border:2px solid #ddd;border-radius:10px;outline:none;background:#fff;color:#333}select:focus{border-color:${TC.color}}.btn{width:100%;padding:16px;font-size:18px;font-weight:bold;color:#fff;background:${TC.color};border:none;border-radius:12px;cursor:pointer;margin-top:8px}.btn:active{opacity:.8}.btn:disabled{background:#ccc}</style></head><body><div class="card"><div id="form-area"><div class="emoji">${TC.emoji}</div><h1>${TC.label}打刻</h1><div class="field"><label>スタッフを選択</label><select id="staffId"><option value="">-- 選択してください --</option>${staffOptions}</select></div><button class="btn" id="submitBtn" onclick="submitForm()">打刻する</button></div></div><script>function submitForm(){ const staffId=document.getElementById('staffId').value; if(!staffId){alert('選択してください');return;} const btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='送信中...'; const form=document.createElement('form'); form.method='GET'; form.action='${deployUrl}'; form.target='_top'; [['type','${type}'],['staffId',staffId],['action','stamp'],['storeId','${storeId||''}']].forEach(([n,v])=>{ const i=document.createElement('input'); i.type='hidden'; i.name=n; i.value=v; form.appendChild(i); }); document.body.appendChild(form); form.submit(); }</script></body></html>`;
}

function genResultHtml(title, message, isSuccess) {
  const color = isSuccess ? '#43a047' : '#e53935';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{background:#fff;border-radius:20px;padding:40px 20px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.1);text-align:center}.emoji{font-size:64px;margin-bottom:16px}h1{font-size:24px;color:#333;margin-bottom:16px}p{color:#666;line-height:1.6;margin-bottom:24px;white-space:pre-wrap}.btn{display:inline-block;padding:14px 28px;background:${color};color:#fff;text-decoration:none;border-radius:12px;font-weight:bold}</style></head><body><div class="card"><div class="emoji">${isSuccess?'✅':'⚠️'}</div><h1>${title}</h1><p>${message}</p><a href="#" class="btn" onclick="window.top.close();return false;">閉じる</a></div></body></html>`;
}

// ===================================================
// 御用聞き・定期通知機能 (Goyoukiki Section)
// ===================================================

/**
 * 朝の業務指示（画像等）を一時保存
 */
function storeMorningInstruction(ss, storeId, messageId) {
  let sheet = ss.getSheetByName('指示保留データ');
  if (!sheet) {
    sheet = ss.insertSheet('指示保留データ');
    sheet.appendRow(['タイムスタンプ', 'ストアID', 'メッセージID']);
  }
  sheet.appendRow([new Date(), storeId, messageId]);
}

/**
 * 指示をドライバーに転送
 */
function forwardInstructionToShiftDrivers(ss, storeId, messageId) {
  // 画像送信は現状制限があるため、テキストでの確認依頼を送る
  sendNotificationToRoleByStore('ドライバー', '【指示】管理者より本日の荷物に関する報告・指示が届いています（店舗ライン等で画像を確認してください）', storeId);
}

/**
 * 毎朝9時：保管された指示を一斉送信するバッチ処理
 */
function sendMorningInstructionsBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('指示保留データ');
  if (!sheet || sheet.getLastRow() < 2) return;
  
  const data = sheet.getDataRange().getValues();
  const latest = {};
  // 店舗ごとの最新の指示を採用する
  data.slice(1).forEach(r => latest[r[1]] = r[2]);
  
  for (const sId in latest) {
    forwardInstructionToShiftDrivers(ss, sId, latest[sId]);
  }
  
  // 送信完了後はデータをクリア用（ヘッダー以外削除）
  sheet.deleteRows(2, sheet.getLastRow() - 1);
}

// ===================================================
// 毎朝7時：外部シフト表の自動取得・キャッシュ
// ===================================================

/**
 * 毎朝7時に外部シフト表を取得してスクリプトプロパティにキャッシュする。
 * askMorningMessage() がこのキャッシュを読み取って送信判断に使用する。
 */
function fetchAndCacheShiftData() {
  try {
    const result = getShiftData(null); // 全店舗分取得
    if (result.status === 'ok') {
      PropertiesService.getScriptProperties().setProperty('CACHED_SHIFT_DATA', JSON.stringify(result));
      console.log('シフトデータをキャッシュしました。スタッフ数: ' + result.shifts.length);
    } else {
      console.error('シフト取得失敗: ' + result.message);
    }
  } catch (e) {
    console.error('fetchAndCacheShiftData エラー: ' + e.message);
  }
}

/**
 * キャッシュ済みシフトデータから当日のシフト記号を取得する。
 * @param {string} staffName スタッフ名
 * @returns {string} シフト記号（C / CM / M など）または空文字
 */
function getTodayShiftSymbol(staffName) {
  const cached = PropertiesService.getScriptProperties().getProperty('CACHED_SHIFT_DATA');
  if (!cached) return '';
  const data = JSON.parse(cached);
  const todayDay = new Date().getDate().toString(); // 当日の「日」部分
  const dateIdx = data.dates ? data.dates.indexOf(todayDay) : -1;
  if (dateIdx < 0) return '';
  const row = data.shifts.find(s => s.name === staffName);
  if (!row) return '';
  return String(row.schedule[dateIdx] || '').trim();
}

/**
 * 前日の不在票（打刻データ内の「不在」列）がある人を取得する。
 * @returns {Array<{name:string, absent:number}>} 前日不在があったスタッフ一覧
 */
function getYesterdayAbsentDrivers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('打刻データ');
  if (!sheet) return [];
  const logs = sheet.getDataRange().getValues();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy/MM/dd');
  const absentMap = {};
  for (let i = 1; i < logs.length; i++) {
    const rowDate = (logs[i][3] instanceof Date) ? Utilities.formatDate(logs[i][3], 'Asia/Tokyo', 'yyyy/MM/dd') : String(logs[i][3]);
    const rowKind = String(logs[i][2]).trim();
    const absentCount = Number(logs[i][13]) || 0;
    if (rowDate === yStr && rowKind === '帰庫' && absentCount > 0) {
      absentMap[logs[i][1]] = (absentMap[logs[i][1]] || 0) + absentCount;
    }
  }
  return Object.entries(absentMap).map(([name, absent]) => ({ name, absent }));
}

// ===================================================
// 朝の通知ロジック（シフト有無・不在票有無で分岐）
// ===================================================

/**
 * 毎朝8時に呼び出す朝の通知メイン関数。
 *
 * ① シフト表に当日の稼働記号（C / CM / M）がある
 *   → 管理者とドライバーに通常の業務開始通知を送信
 *
 * ② シフトが空欄
 *   → 前日の不在票を確認
 *   → 不在あり：管理者に「スクショ提出＋RTSドライバー一覧」を問い合わせ
 *   → 不在なし：お休みのため何も送信しない
 */
function askMorningMessage() {
  const config = getSettings();
  const cached = PropertiesService.getScriptProperties().getProperty('CACHED_SHIFT_DATA');
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  const todayDay = new Date().getDate().toString();

  // キャッシュがない場合はリアルタイム取得を試みる
  let shiftData = null;
  if (cached) {
    shiftData = JSON.parse(cached);
  } else {
    const result = getShiftData(null);
    if (result.status === 'ok') shiftData = result;
  }

  // 当日稼働スタッフ（C / CM / M のいずれかを含む）を抽出
  const WORK_SYMBOLS = ['C', 'CM', 'M'];
  const todayWorkers = []; // { name, storeId, symbol }
  if (shiftData && shiftData.dates) {
    const dateIdx = shiftData.dates.indexOf(todayDay);
    if (dateIdx >= 0) {
      shiftData.shifts.forEach(row => {
        const sym = String(row.schedule[dateIdx] || '').trim().toUpperCase();
        if (WORK_SYMBOLS.some(w => sym.includes(w))) {
          todayWorkers.push({ name: row.name, storeId: row.storeId, symbol: sym });
        }
      });
    }
  }

  if (todayWorkers.length > 0) {
    // ① 稼働あり → 通常通り管理者・ドライバーに通知
    const workerListStr = todayWorkers.map(w => `・${w.name}（${w.symbol}）`).join('\n');
    const managerMsg =
      `【📋 本日の業務開始】${todayStr}\n` +
      `本日の稼働スタッフ：\n${workerListStr}\n\n` +
      `午前指定や回収荷物があればスクリーンショットをお送りください📸`;
    sendNotificationToRole('管理者', managerMsg);

    const driverMsg =
      `【🌅 業務開始のご確認】${todayStr}\n` +
      `本日もよろしくお願いします！\n出勤・出庫の打刻をお忘れなく📱`;
    sendNotificationToRole('ドライバー', driverMsg);

  } else {
    // ② シフト空欄 → 前日不在票の確認
    const absentDrivers = getYesterdayAbsentDrivers();

    if (absentDrivers.length > 0) {
      // 不在あり → 管理者にスクショ提出＋RTSドライバー一覧を問い合わせ
      const absentList = absentDrivers.map(d => `・${d.name}（不在 ${d.absent}件）`).join('\n');
      const msg =
        `【⚠️ 前日不在票のご確認】${todayStr}\n` +
        `\n前日（${Utilities.formatDate(new Date(new Date().setDate(new Date().getDate()-1)), 'Asia/Tokyo', 'MM/dd')}）に不在票が発生しています。` +
        `\n\n下記ドライバーについて、\n①不在票のスクリーンショットをご提出ください。\n②本日RTS（不在回り）を担当するドライバーをお知らせください。\n\n【前日不在が発生したドライバー一覧】\n${absentList}`;
      sendNotificationToRole('管理者', msg);
      console.log('不在票あり：管理者へ問い合わせ送信。件数=' + absentDrivers.length);
    } else {
      // 不在なし → お休みのため何も送信しない
      console.log('本日シフトなし・前日不在なし：メッセージ送信なし。');
    }
  }
}

/**
 * 毎朝の入荷数確認（管理者に送信）※後方互換のため残す
 */
function askMorningCount() {
  const msg = '【午前の入荷数確認】📦\n午前指定や回収荷物があれば、スクリーンショットをお送りください📸';
  sendNotificationToRole('管理者', msg);
}

/**
 * 午後の追加入荷確認（ドライバーに送信）
 */
function askAfternoonCount() {
  const msg = '【午後の荷物確認】📦\n追加の入荷があれば個数を数字で教えてください！（なければ「0」）';
  sendNotificationToRole('ドライバー', msg);
}

/**
 * 夜の全体数確認（管理者に送信）
 */
function askEveningCount() {
  const msg = '【本日の計上数確認】🌙\n本日の荷物全体数を教えてください。\n数字だけ返信してください。例）210';
  sendNotificationToRole('管理者', msg);
}

/**
 * 月曜の振込日通知
 */
function notifyMondayTransfer() {
  sendNotificationToRole('オーナー', '【💰 振込日のご確認】\n本日は振込日です。各店舗の準備・確認をお願いいたします。');
}

/**
 * 水曜のシフト提出要請
 */
function askWednesdayShift() {
  const msg = '【📅 来週のシフト提出】\nお疲れ様です！来週のシフト希望を教えてください。';
  sendNotificationToRole('ドライバー', msg);
}

/**
 * 役割・店舗に基づいた一斉送信ヘルパー
 */
function sendNotificationToRoleByStore(targetRole, message, storeId) {
  const config = getSettings();
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('スタッフ一覧').getDataRange().getValues();
  let notifySent = false;
  
  rows.slice(1).forEach(r => {
    const role = String(r[3]); // 役職
    const userId = String(r[4]); // LINE ID
    const targetStoreIds = String(r[6]).split(',').map(s => s.trim());
    if (role.includes(targetRole) && userId) {
      if (!storeId || targetStoreIds.includes(String(storeId).trim())) {
        // 管理者かつNotifyトークンがあればそちらへ迂回（1回のみ）
        if (role.includes('管理者') && config.LINE_NOTIFY_TOKEN) {
          if (!notifySent) {
            sendLineNotify(config.LINE_NOTIFY_TOKEN, message);
            notifySent = true;
          }
        } else {
          sendLine(config.LINE_ACCESS_TOKEN, message, null, null, userId);
        }
      }
    }
  });
}

/**
 * 役割に基づいた一斉送信ヘルパー
 */
function sendNotificationToRole(targetRole, message) {
  const config = getSettings();
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('スタッフ一覧').getDataRange().getValues();
  let notifySent = false;

  rows.slice(1).forEach(r => {
    const role = String(r[3]); // 役職
    const userId = String(r[4]); // LINE ID
    if (role.includes(targetRole) && userId) {
      // 管理者かつNotifyトークンがあればそちらへ迂回（1回のみ）
      if (role.includes('管理者') && config.LINE_NOTIFY_TOKEN) {
        if (!notifySent) {
          sendLineNotify(config.LINE_NOTIFY_TOKEN, message);
          notifySent = true;
        }
      } else {
        sendLine(config.LINE_ACCESS_TOKEN, message, null, null, userId);
      }
    }
  });
}

/**
 * 御用聞きトリガーの一括設定
 */
function setGoyoukikiTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if ([
      'generateLastMonthReport',
      'fetchAndCacheShiftData',
      'askMorningMessage',
      'askMorningCount',
      'askAfternoonCount',
      'askEveningCount',
      'notifyMondayTransfer',
      'askWednesdayShift',
      'sendMorningInstructionsBatch',
      'archiveOldDataMonth'
    ].includes(fn)) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎月1日 深夜2時：会社用月次報告書の自動生成（前月分）
  ScriptApp.newTrigger('generateLastMonthReport').timeBased().onMonthDay(1).atHour(2).create();
  // 毎月10日 夜2時：過去データの自動アーカイブ（前月分退避）
  ScriptApp.newTrigger('archiveOldDataMonth').timeBased().onMonthDay(10).atHour(2).create();

  // ★ 毎日 7時：外部シフト表の自動取得・キャッシュ
  ScriptApp.newTrigger('fetchAndCacheShiftData').timeBased().everyDays(1).atHour(7).create();

  // ★ 毎日 8時：シフト有無・不在票有無で分岐する朝の通知
  ScriptApp.newTrigger('askMorningMessage').timeBased().everyDays(1).atHour(8).create();

  // 毎日 9時：午前の指示内容をドライバーへ配信
  ScriptApp.newTrigger('sendMorningInstructionsBatch').timeBased().everyDays(1).atHour(9).create();
  // 毎日 16時：午後の確認
  ScriptApp.newTrigger('askAfternoonCount').timeBased().everyDays(1).atHour(16).create();
  // 毎日 21時：夜の確認
  ScriptApp.newTrigger('askEveningCount').timeBased().everyDays(1).atHour(21).create();

  // 月曜 9時：振込通知
  ScriptApp.newTrigger('notifyMondayTransfer').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  // 水曜 9時：シフト確認
  ScriptApp.newTrigger('askWednesdayShift').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(9).create();

  SpreadsheetApp.getUi().alert('✅ 御用聞き（定期通知）のトリガーを全て設定しました。\n\n・毎日7時：シフト自動取得\n・毎日8時：朝の通知（シフト有無・不在票で分岐）\n・毎月1日：月次報告書の自動生成');
}

/**
 * アプリAのカスタムメニュー
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⏱ 打刻バックエンド')
    .addItem('🔧 セットアップ（ヘッダー更新）', 'setupA')
    .addItem('🪄 外部シフト表を自動フォーマット', 'formatShiftSheetAutomatically')
    .addSeparator()
    .addItem('📊 今月の月次報告書を会社用SSに出力', 'generateThisMonthReport')
    .addSeparator()
    .addItem('⏰ 定期通知トリガーを設定', 'setGoyoukikiTriggers')
    .addSeparator()
    .addItem('🧪 LINE送信テスト', 'testLineBackend')
    .addToUi();
}

function testLineBackend() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('テスト送信先のLINE IDを入力してください');
  if (res.getSelectedButton() === ui.Button.OK) {
    const config = getSettings();
    sendLine(config.LINE_ACCESS_TOKEN, '【テスト】アプリAからの通信テストです。', null, null, res.getResponseText());
  }
}

function registerStaffAsAutomated(ss, userId, name, store, roleStr, rentalStr) {
  let sheet = ss.getSheetByName('スタッフ一覧');
  if (!sheet) return 'ERROR';
  const rows = sheet.getDataRange().getValues();
  let newId = 'ID001';
  if (rows.length > 1) {
     const lastIdStr = String(rows[rows.length - 1][0]);
     const match = lastIdStr.match(/\d+/);
     if (match) newId = 'ID' + ('000' + (parseInt(match[0], 10) + 1)).slice(-3);
  }
  // ヘッダー: ['スタッフID','名前','店舗名','役職','LINE userId','車両レンタル','ストアID']
  sheet.appendRow([newId, name, store, roleStr, userId, rentalStr, '未設定']);
  return newId;
}

// ===================================================
// 追加実装（OCR・アーカイブ・管理者機能）
// ===================================================

function getImageTextFromLine(messageId, token) {
  const response = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const file = DriveApp.getRootFolder().createFile(response.getBlob().setName('temp.jpg'));
  const ocrFile = Drive.Files.insert({ title:'ocr', mimeType:MimeType.GOOGLE_DOCS }, file, { ocr:true, ocrLanguage:'ja' });
  const text = DocumentApp.openById(ocrFile.id).getBody().getText();
  file.setTrashed(true);
  try { DriveApp.getFileById(ocrFile.id).setTrashed(true); } catch(e){}
  return text;
}

function extractTakeoutCount(text) {
  const m = text.match(/(?:持ち出し|持出|配完)[:：]?\s*(\d+)/) || text.match(/配達または荷物を置いていくこと[\s\S]*?(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function handleCallManager(ss, userId, staffInfo, replyToken, config) {
  const staffRows = ss.getSheetByName('スタッフ一覧').getDataRange().getValues();
  let found = [];
  staffRows.slice(1).forEach(r => { 
    if (r[2] === staffInfo.storeName && (String(r[3]).includes('管理') || String(r[3]).includes('オーナー'))) {
      if (r[4]) found.push({ name: r[1], userId: r[4] }); 
    } 
  });
  if (found.length === 0) { 
    sendLine(config.LINE_ACCESS_TOKEN, '管理者の連絡先が見つかりません。', null, replyToken, userId); 
    return; 
  }
  let msg = `📞 【管理者に連絡】\n※直接LINEでメッセージを送るか電話してください\n` + found.map(m => `・${m.name}`).join('\n');
  sendLine(config.LINE_ACCESS_TOKEN, msg, null, replyToken, userId);
}

const ARCHIVE_SS_ID = '1RD0GFC1feZ-6kEXd2zQHmrbeVXpmALn5iQSxJwFURh8';

function archiveOldDataMonth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('打刻データ');
  if(!sheet) return;
  
  const now = new Date();
  
  let archiveSs;
  try {
    archiveSs = SpreadsheetApp.openById(ARCHIVE_SS_ID);
  } catch(e) {
    console.error('アーカイブ用ファイルを開けません: ' + e.message);
    return;
  }
  
  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0); 
  const limitDate = Utilities.formatDate(lastMonth, 'Asia/Tokyo', 'yyyy/MM/dd');
  
  const logs = sheet.getDataRange().getValues();
  if (logs.length < 2) return;
  
  const headers = logs[0];
  let archiveSheet = archiveSs.getSheetByName('打刻アーカイブ');
  if (!archiveSheet) {
    archiveSheet = archiveSs.insertSheet('打刻アーカイブ');
    archiveSheet.appendRow(headers);
  }
  
  const targetRows = [];
  const remainRows = [headers];
  
  for (let i = 1; i < logs.length; i++) {
    const rDateStr = (logs[i][3] instanceof Date) ? Utilities.formatDate(logs[i][3], 'Asia/Tokyo', 'yyyy/MM/dd') : String(logs[i][3]);
    if (rDateStr <= limitDate) {
      targetRows.push(logs[i]);
    } else {
      remainRows.push(logs[i]);
    }
  }
  
  if (targetRows.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, targetRows.length, headers.length).setValues(targetRows);
    sheet.clearContents();
    sheet.getRange(1, 1, remainRows.length, headers.length).setValues(remainRows);
  }
}

// ===================================================
// 会社用 月次報告書 自動生成
// ===================================================

/**
 * 毎月1日 深夜2時に自動実行：前月分の月次報告書を会社用SSに書き出す
 */
function generateLastMonthReport() {
  const now = new Date();
  // 前月の年・月を計算
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  generateMonthlyReport(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
}

/**
 * メニューから手動実行：今月分を今すぐ出力
 */
function generateThisMonthReport() {
  const now = new Date();
  generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
  SpreadsheetApp.getUi().alert('✅ 今月分の月次報告書を会社用スプレッドシートに出力しました！');
}

/**
 * 月次報告書のメイン処理
 * 指定した年・月の打刻データを集計し、会社用SSの月別シートに書き出す。
 *
 * 出力列：
 *   店舗名 | スタッフ名 | 稼働日数 | 総持ち出し | 総配完 | 総不在 | 総依頼
 *        | 総売上(円) | レンタル費(円) | 差引支給額(円) | 備考
 *
 * @param {number} year  対象年（例: 2026）
 * @param {number} month 対象月（例: 4）
 */
function generateMonthlyReport(year, month) {
  const config = getSettings();
  const corpSsId = config.CORP_REPORT_SS_ID;
  if (!corpSsId) {
    console.error('月次報告書の書き出し先（CORP_REPORT_SS_ID）が設定されていません。');
    try {
      SpreadsheetApp.getUi().alert('⚠️ 設定シートの「CORP_REPORT_SS_ID」に会社用スプレッドシートのIDを入力してください。');
    } catch(e) {}
    return;
  }

  // 対象月の文字列（例: 2026/04）
  const monthStr = year + '/' + String(month).padStart(2, '0');
  const sheetName = year + '年' + String(month).padStart(2, '0') + '月';

  // --- 打刻データの読み込み ---
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stampSheet = ss.getSheetByName('打刻データ');
  if (!stampSheet || stampSheet.getLastRow() < 2) {
    console.log('打刻データが存在しません。'); return;
  }
  const logs = stampSheet.getDataRange().getValues();

  // --- スタッフマスタの読み込み（店舗名・役職を補完）---
  const staffSheet = ss.getSheetByName('スタッフ一覧');
  const staffMap = {}; // name -> { storeName, role }
  if (staffSheet) {
    staffSheet.getDataRange().getValues().slice(1).forEach(r => {
      staffMap[String(r[1]).trim()] = { storeName: String(r[2]).trim(), role: String(r[3]).trim() };
    });
  }

  // --- 月別・スタッフ別に集計 ---
  // key: スタッフ名
  const summary = {};

  logs.slice(1).forEach(row => {
    const name    = String(row[1]).trim();
    const kind    = String(row[2]).trim();
    const rawDate = row[3];
    const dateStr = (rawDate instanceof Date)
      ? Utilities.formatDate(rawDate, 'Asia/Tokyo', 'yyyy/MM/dd')
      : String(rawDate);

    // 対象月かどうか判定
    if (!dateStr.startsWith(monthStr)) return;
    // 帰庫行のみ集計（実績が入るのは帰庫データ）
    if (kind !== '帰庫') return;

    if (!summary[name]) {
      const si = staffMap[name] || {};
      summary[name] = {
        storeName : si.storeName || '',
        days      : new Set(),
        takeout   : 0,
        complete  : 0,
        absent    : 0,
        irai      : 0,
        sales     : 0,
        rental    : 0,
        net       : 0
      };
    }
    summary[name].days.add(dateStr);
    summary[name].takeout  += Number(row[12]) || 0; // 持ち出し
    summary[name].complete += Number(row[6])  || 0; // 配完個数
    summary[name].absent   += Number(row[13]) || 0; // 不在
    summary[name].irai     += Number(row[15]) || 0; // 依頼
    summary[name].sales    += Number(row[7])  || 0; // 売上
    summary[name].rental   += Number(row[8])  || 0; // レンタル費
    summary[name].net      += Number(row[9])  || 0; // 差引支給額
  });

  if (Object.keys(summary).length === 0) {
    console.log('対象月のデータがありません: ' + monthStr);
    try { SpreadsheetApp.getUi().alert('⚠️ ' + sheetName + ' のデータが見つかりません。'); } catch(e) {}
    return;
  }

  // --- 会社用スプレッドシートへ書き出し ---
  let corpSs;
  try {
    corpSs = SpreadsheetApp.openById(corpSsId);
  } catch (e) {
    console.error('会社用SS を開けません: ' + e.message);
    try { SpreadsheetApp.getUi().alert('⚠️ 会社用スプレッドシートを開けませんでした。\nIDを確認してください。'); } catch(err) {}
    return;
  }

  // 既存シートがあれば上書き、なければ新規作成
  let reportSheet = corpSs.getSheetByName(sheetName);
  if (reportSheet) {
    reportSheet.clearContents();
  } else {
    reportSheet = corpSs.insertSheet(sheetName);
  }

  // ヘッダー行
  const headers = [
    '店舗名', 'スタッフ名', '稼働日数',
    '総持ち出し（個）', '総配完（個）', '総不在（件）', '総依頼（件）',
    '総売上（円）', 'レンタル費（円）', '差引支給額（円）', '備考'
  ];
  reportSheet.appendRow(headers);

  // データ行（店舗名→スタッフ名 の順でソート）
  const rows = Object.entries(summary)
    .sort(([na, a], [nb, b]) => {
      if (a.storeName < b.storeName) return -1;
      if (a.storeName > b.storeName) return 1;
      return na < nb ? -1 : 1;
    })
    .map(([name, d]) => [
      d.storeName,
      name,
      d.days.size,
      d.takeout,
      d.complete,
      d.absent,
      d.irai,
      d.sales,
      d.rental,
      d.net,
      ''
    ]);

  if (rows.length > 0) {
    reportSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 合計行の追加
  const totalRow = reportSheet.getLastRow() + 1;
  reportSheet.getRange(totalRow, 1).setValue('【合計】');
  // 数値列のSUM（C〜J列 = 3〜10列目）
  for (let c = 3; c <= 10; c++) {
    const colLetter = String.fromCharCode(64 + c);
    reportSheet.getRange(totalRow, c).setFormula(`=SUM(${colLetter}2:${colLetter}${totalRow - 1})`);
  }

  // スタイル適用
  reportSheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a73e8').setFontColor('white')
    .setFontWeight('bold').setHorizontalAlignment('center');
  reportSheet.getRange(totalRow, 1, 1, headers.length)
    .setBackground('#fce8b2').setFontWeight('bold');
  reportSheet.setFrozenRows(1);
  reportSheet.autoResizeColumns(1, headers.length);

  console.log('月次報告書を出力しました: ' + sheetName + '（' + rows.length + '名分）');
}
