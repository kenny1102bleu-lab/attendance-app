// ===================================================
// 1_Communication.gs (連絡・打刻)
// ============= 役割 =================================
// ・LINE Webhook受信と応答
// ・QRコード打刻フォームの表示と処理
// ・各役割（ドライバー・管理者）への通知・御用聞き
// ===================================================

/**
 * Webアプリ GET（フォーム表示・バージョン確認・打刻実行）
 */
function doGet(e) {
  try {
    const type = e.parameter.type;
    const action = e.parameter.action;
    
    if (action === 'version') {
      return ContentService.createTextOutput('V94_RESTRUCTURED');
    }
    
    const deployUrl = getDeployUrl_();
    
    if (action === 'stamp' && type) {
      processStamp(e.parameter);
      return HtmlService.createHtmlOutput(resultHtml('打刻完了', '打刻が完了しました！', true)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
    if (!type) return HtmlService.createHtmlOutput(resultHtml('エラー', 'QRコードが不正です。', false)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return HtmlService.createHtmlOutput(buildFormHtml(type, getStaffList(e.parameter.storeId), e.parameter.storeId, deployUrl)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput(resultHtml('エラーが発生しました', '詳細: ' + err.message + '\n\n' + err.stack, false)).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

/**
 * Webアプリ POST（LINE Webhook受信）
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.events && body.events.length > 0) {
      body.events.forEach(event => {
        try {
          handleLineWebhook(event);
        } catch(eventErr) {
          console.log('イベント処理エラー: ' + eventErr.message);
        }
      });
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 打刻処理（フォームからのデータ保存）
 */
function processStamp(params) {
  const stampType    = params.type;
  const staffId      = params.staffId;
  const storeId      = params.storeId || '';
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  
  const staffInfo = getStaffInfo(ss, staffId);
  if (!staffInfo) return;
  const staffName = staffInfo.name;
  const userId    = staffInfo.userId;

  const now     = new Date();
  const dateStr = fmt(now, 'yyyy/MM/dd');
  const timeStr = fmt(now, 'HH:mm:ss');
  const sheet   = ss.getSheetByName(CONFIG.SHEET_TIMELOG);
  
  const finalStoreId = storeId || staffInfo.storeId;
  const finalStoreName = staffInfo.store;

  if (stampType === 'work_in') {
    sheet.appendRow([staffId, staffName, '出勤', dateStr, timeStr, now, '', '', '', '', '', '', '', '', finalStoreId]);
  }

  if (stampType === 'car_out') {
    sheet.appendRow([staffId, staffName, '出庫', dateStr, timeStr, now, '', '', '', '', '', '', '', '', finalStoreId]);
  }

  let carOutTime = null;
  if (stampType === 'car_in') {
    const logs = sheet.getDataRange().getValues();
    for (let i = logs.length - 1; i >= 1; i--) {
      if (String(logs[i][0]) === String(staffId) && logs[i][2] === '出庫' && safeDateStr(logs[i][3]) === dateStr) {
        carOutTime = new Date(logs[i][5]); break;
      }
    }
    const rentalMinutes = carOutTime ? Math.floor((now - carOutTime) / 60000) : 0;
    const rentalCost = (staffInfo.rental === 'なし') ? 0 : calcRentalCost(rentalMinutes);
    sheet.appendRow([staffId, staffName, '帰庫', dateStr, timeStr, now, 0, 0, rentalCost, -rentalCost, 0, 0, 0, 0, finalStoreId]);
  }

  // LINE通知
  try {
    if (stampType === 'work_in') {
      sendLineToRole('【出勤】🟢\n' + staffName + ' さんが出勤しました\n店舗: ' + finalStoreName + '\n⏰ ' + timeStr, '管理者', finalStoreId);
    }
    if (stampType === 'car_out') {
      sendLineToRole('【出庫】🚗\n' + staffName + ' さんが出庫しました\n店舗: ' + finalStoreName + '\n⏰ ' + timeStr, '管理者', finalStoreId);
    }
    if (stampType === 'car_in') {
      const rm = carOutTime ? Math.floor((now - carOutTime) / 60000) : 0;
      sendLineToRole('【帰庫】🏠\n' + staffName + ' さんが帰庫しました\n店舗: ' + finalStoreName + '\n⏰ ' + timeStr + '\n🚗 車両: ' + Math.floor(rm/60) + '時間' + (rm%60) + '分', '管理者', finalStoreId);
      if (userId) {
        sendLine('【帰庫報告のお願い】📋\nお疲れ様でした！以下の形式で返信してください：\n\n持ち出し:80\n配完:75\n不在:5\n依頼:0\n\n数字を入力後、Amazon等のスクリーンショットを送ってください📸', userId);
      }
    }
  } catch (lineErr) {
    console.error('⚠️ LINE通知送信失敗: ' + lineErr.message);
  }
}

/**
 * LINE Webhook イベント処理（詳細ロジック）
 */
function handleLineWebhook(event) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userId = event.source.userId;
  
  // ログ記録
  ss.getSheetByName(CONFIG.SHEET_TIMELOG)
    .appendRow([new Date(), event.type || '不明', userId, event.message ? (event.message.type + ':' + (event.message.text || event.message.id || '')) : 'no message']);

  const staffRows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  let staffInfo = null;
  for (let i = 1; i < staffRows.length; i++) {
    if (String(staffRows[i][4]) === String(userId)) {
      staffInfo = { id: staffRows[i][0], name: staffRows[i][1], store: staffRows[i][2], role: staffRows[i][3], userId: staffRows[i][4], rental: staffRows[i][5] || 'あり', storeId: staffRows[i][6] };
      break;
    }
  }

  const props = PropertiesService.getScriptProperties();
  const stateKey = 'REG_STATE_' + userId;
  const stateJson = props.getProperty(stateKey);

  // 友だち追加（初期登録開始）
  if (event.type === 'follow') {
    if (!staffInfo) {
      sendLine('友だち追加ありがとうございます！🎉\n\n【初期登録】\nシステムに登録します。\nまずは「あなたのお名前（フルネーム）」を送信してください。\n\n例：山田 太郎', userId, null, event.replyToken);
      props.setProperty(stateKey, JSON.stringify({ step: 1 }));
    }
    return;
  }

  if (event.type !== 'message') return;

  // 未登録時の会話フロー
  if (!staffInfo && event.message.type === 'text') {
    let registText = event.message.text.trim().replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    let state = stateJson ? JSON.parse(stateJson) : { step: 1 };

    if (registText === 'リセット' || registText === '最初から' || registText.startsWith('登録')) {
       sendLine('登録を最初からやり直します。\n「あなたのお名前（フルネーム）」を送信してください。', userId, null, event.replyToken);
       props.setProperty(stateKey, JSON.stringify({ step: 1 }));
       return;
    }

    if (state.step === 1) {
      state.name = registText; state.step = 2; props.setProperty(stateKey, JSON.stringify(state));
      sendLine('✅ お名前を「' + registText + '」で受け付けました。\n\n次に、所属する「ご自身の店舗」をご選択ください。', userId, ['1、要HUB', '2、神立HUB', '3、谷田部HUB', '4、梅園HUB'], event.replyToken);
      return;
    }
    if (state.step === 2) {
      let storeName = '', storeId = '';
      if (registText.includes('1') || registText.includes('要')) { storeName = '要HUB'; storeId = 'K001HUB'; }
      else if (registText.includes('2') || registText.includes('神立')) { storeName = '神立HUB'; storeId = 'K002HUB'; }
      else if (registText.includes('3') || registText.includes('谷田部')) { storeName = '谷田部HUB'; storeId = 'K003HUB'; }
      else if (registText.includes('4') || registText.includes('梅園')) { storeName = '梅園HUB'; storeId = 'K004HUB'; }
      else { sendLine('⚠️ エラー：選択肢を選んでください。', userId, ['1、要HUB', '2、神立HUB', '3、谷田部HUB', '4、梅園HUB'], event.replyToken); return; }
      state.store = storeName; state.storeId = storeId; state.step = 3; props.setProperty(stateKey, JSON.stringify(state));
      sendLine('✅ ストアを「' + storeName + '」で受け付けました。\n\n次に、あなたの「役職」を選択してください。', userId, ['1、ドライバー', '2、ドライバー＋管理者', '3、ドライバー＋管理者＋オーナー', '4、ドライバー＋オーナー'], event.replyToken);
      return;
    }
    if (state.step === 3) {
      let roleStr = '';
      if (registText.includes('1')) { roleStr = 'ドライバー'; }
      else if (registText.includes('2')) { roleStr = 'ドライバー, 管理者'; }
      else if (registText.includes('3')) { roleStr = 'ドライバー, 管理者, オーナー'; }
      else if (registText.includes('4')) { roleStr = 'ドライバー, オーナー'; }
      else { sendLine('⚠️ エラー：選択肢を選んでください。', userId, ['1、ドライバー', '2、ドライバー＋管理者', '3、ドライバー＋管理者＋オーナー', '4、ドライバー＋オーナー'], event.replyToken); return; }
      state.role = roleStr; state.step = 4; props.setProperty(stateKey, JSON.stringify(state));
      sendLine('✅ 役職を「' + roleStr + '」で受け付けました。\n\n最後に、車両のレンタルを利用しますか？', userId, ['1、あり（レンタル等）', '2、なし（自前車両等）'], event.replyToken);
      return;
    }
    if (state.step === 4) {
      let rentalStr = 'あり';
      if (registText.includes('1') || registText.includes('あり')) { rentalStr = 'あり'; }
      else if (registText.includes('2') || registText.includes('なし')) { rentalStr = 'なし'; }
      else { sendLine('⚠️ エラー：選択肢を選んでください。', userId, ['1、あり（レンタル等）', '2、なし（自前車両等）'], event.replyToken); return; }
      registerStaff(ss, userId, state.name, state.store, state.role, rentalStr, state.storeId);
      props.deleteProperty(stateKey);
      sendLine('🎉 登録完了！名前：' + state.name + '\n店舗：' + state.store + '\n以降、実績確認等が可能です。', userId, null, event.replyToken);
      return;
    }
  }

  // 画像受信（OCR処理）
  if (event.message.type === 'image') {
    handleImageMessage(event, staffInfo, ss);
    return;
  }

  // テキストメッセージ解析
  if (event.message.type === 'text') {
    handleTextMessage(event, staffInfo, ss);
  }
}

/**
 * 画像メッセージの個別処理（OCR）
 */
function handleImageMessage(event, staffInfo, ss) {
  const userId = event.source.userId;
  const nowHour = new Date().getHours();
  if (staffInfo && (staffInfo.role.includes('管理') || staffInfo.role.includes('オーナー')) && nowHour >= 8 && nowHour <= 12) {
    const sId = staffInfo.storeId || '';
    if (nowHour < 9) {
      storeMorningInstruction(ss, sId, event.message.id);
      sendLine('✅ 承知いたしました！9:00にドライバーへ一斉送信します。', userId, null, event.replyToken);
    } else {
      forwardInstructionToShiftDrivers(ss, sId, event.message.id);
      sendLine('✅ 本日出勤のドライバーへ指示を転送しました！', userId, null, event.replyToken);
    }
    return;
  }

  try {
    const ocrText = getImageTextFromLine(event.message.id);
    const takeoutCount = extractTakeoutCount(ocrText);
    const trackingMatches = ocrText.match(/DA[0-9A-Za-z]{8,}/g) || [];
    const uniqueTrackings = [...new Set(trackingMatches)];
    
    if (!staffInfo) return;
    const today = fmt(new Date(), 'yyyy/MM/dd');

    if (takeoutCount !== null) {
      const sheet = ss.getSheetByName(CONFIG.SHEET_TIMELOG);
      const logs = sheet.getDataRange().getValues();
      for (let i = logs.length - 1; i >= 1; i--) {
        if (logs[i][1] === staffInfo.name && logs[i][2] === '出庫' && safeDateStr(logs[i][3]) === today) {
          sheet.getRange(i + 1, 13).setValue(takeoutCount);
          break;
        }
      }
      sendLineToRole('📦 ' + staffInfo.name + ' さん：持ち出し ' + takeoutCount + '個', '管理者', staffInfo.storeId);
    }
    
    if (uniqueTrackings.length > 0) {
      let trackingSheet = ss.getSheetByName(CONFIG.SHEET_TRACKING) || ss.insertSheet(CONFIG.SHEET_TRACKING);
      uniqueTrackings.forEach(tn => trackingSheet.appendRow([new Date(), today, staffInfo.name, staffInfo.store, tn]));
      sendLine(`📦 不在・持戻り記録を${uniqueTrackings.length}件登録しました。`, userId, null, event.replyToken);
    }
  } catch(err) { console.error('OCRエラー: ' + err.message); }
}

/**
 * テキストメッセージの個別処理
 */
function handleTextMessage(event, staffInfo, ss) {
  const userId = event.source.userId;
  let msgText = event.message.text.trim().replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const today = fmt(new Date(), 'yyyy/MM/dd');

  if (msgText === '本日の実績') { handleTodayResult(ss, userId, staffInfo, today, event.replyToken); return; }
  if (msgText === '今月の給与') { handleMonthlyResult(ss, userId, staffInfo, new Date(), event.replyToken); return; }
  if (msgText === '管理者に電話') { handleCallManager(ss, userId, staffInfo, event.replyToken); return; }

  // 報告解析（持ち出し、配完、不在、依頼）
  const takeoutMatch = msgText.match(/持ち出し\s*[:：]?\s*(\d+)/);
  const completeMatch = msgText.match(/(?:配完|配達完了)\s*[:：]?\s*(\d+)/);
  const absentMatch = msgText.match(/不在\s*[:：]?\s*(\d+)/);
  const iraiMatch = msgText.match(/依頼\s*[:：]?\s*(\d+)/);

  if (takeoutMatch || completeMatch) {
    recordBusinessReport(ss, staffInfo, takeoutMatch, completeMatch, absentMatch, iraiMatch, today, userId, event.replyToken);
    return;
  }

  const arrivalMatch = msgText.match(/入荷\s*[:：]\s*(\d+)/);
  const collectionMatch = msgText.match(/回収\s*[:：]\s*(\d+)/);
  if (arrivalMatch || collectionMatch) {
    recordArrivalCollection(ss, staffInfo, arrivalMatch, collectionMatch, today, userId, event.replyToken);
  }
}

/**
 * スタッフ登録処理
 */
function registerStaff(ss, userId, name, store, role, rental, storeId) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_STAFF);
  const rows = sheet.getDataRange().getValues();
  const nextId = 'S' + Utilities.formatString('%04d', rows.length);
  sheet.appendRow([nextId, name, store, role, userId, rental, storeId]);
}

/**
 * 業務報告の記録
 */
function recordBusinessReport(ss, staffInfo, takeoutMatch, completeMatch, absentMatch, iraiMatch, today, userId, replyToken) {
  if (!staffInfo) return;
  const takeoutCount = takeoutMatch ? parseInt(takeoutMatch[1], 10) : 0;
  const completeCount = completeMatch ? parseInt(completeMatch[1], 10) : 0;
  const absentCount = absentMatch ? parseInt(absentMatch[1], 10) : 0;
  const iraiCount = iraiMatch ? parseInt(iraiMatch[1], 10) : 0;
  
  const sheet = ss.getSheetByName(CONFIG.SHEET_TIMELOG);
  const logs = sheet.getDataRange().getValues();
  let targetRow = -1, rentalCost = 0;
  for (let i = logs.length-1; i >= 1; i--) {
    if (logs[i][1] === staffInfo.name && logs[i][2] === '帰庫' && safeDateStr(logs[i][3]) === today) {
      targetRow = i + 1; rentalCost = Number(logs[i][8]) || 0; break;
    }
  }
  if (targetRow !== -1) {
    const laborTotal = Math.round((completeCount + iraiCount) * getLaborPricePerItem(today));
    const netPayment = laborTotal - rentalCost;
    sheet.getRange(targetRow, 7).setValue(completeCount);
    sheet.getRange(targetRow, 8).setValue(Math.round((completeCount + iraiCount) * getPricePerItem(today)));
    sheet.getRange(targetRow, 10).setValue(netPayment);
    sheet.getRange(targetRow, 11).setValue(getLaborPricePerItem(today));
    sheet.getRange(targetRow, 12).setValue(laborTotal);
    sheet.getRange(targetRow, 13).setValue(takeoutCount);
    sheet.getRange(targetRow, 14).setValue(absentCount);
    sheet.getRange(targetRow, 16).setValue(iraiCount);
    sendLine(`✅ 報告受領: ¥${laborTotal.toLocaleString()}\n差引支給: ¥${netPayment.toLocaleString()}`, userId, null, replyToken);
    sendLineToRole(`📦 【報告】${staffInfo.name}: 配完${completeCount}/不在${absentCount}`, '管理者', staffInfo.storeId);
  }
}

/**
 * 入荷・回収の記録
 */
function recordArrivalCollection(ss, staffInfo, arrivalMatch, collectionMatch, today, userId, replyToken) {
  let arrivalSheet = ss.getSheetByName(CONFIG.SHEET_ARRIVAL) || ss.insertSheet(CONFIG.SHEET_ARRIVAL);
  let replyMsg = '✅ 記録しました！\n';
  const timeStr = fmt(new Date(), 'HH:mm:ss');
  if (arrivalMatch) {
     const count = parseInt(arrivalMatch[1], 10);
     arrivalSheet.appendRow([today, timeStr, '入荷', count, new Date(), staffInfo ? staffInfo.store : '', staffInfo ? staffInfo.name : '']);
     writeToDeliveryReportRealtime('arrival', count);
     replyMsg += `📦 入荷：${count}個\n`;
  }
  if (collectionMatch) {
     const count = parseInt(collectionMatch[1], 10);
     arrivalSheet.appendRow([today, timeStr, '回収', count, new Date(), staffInfo ? staffInfo.store : '', staffInfo ? staffInfo.name : '']);
     writeToDeliveryReportRealtime('collection', count);
     replyMsg += `🔄 回収：${count}個\n`;
  }
  sendLine(replyMsg, userId, null, replyToken);
}

// ===================================================
// その他の連絡処理・ヘルパー
// ===================================================

function handleTodayResult(ss, userId, staffInfo, todayStr, replyToken) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_TIMELOG), logs = sheet.getDataRange().getValues();
  let takeout=0, complete=0, net=0, found=false;
  for (let i = logs.length-1; i >= 1; i--) {
    if (logs[i][1] === staffInfo.name && safeDateStr(logs[i][3]) === todayStr && logs[i][2] === '帰庫') {
      complete = logs[i][6]; takeout = logs[i][12]; net = logs[i][9]; found = true; break;
    }
  }
  let msg = `📊 【本日実績】${todayStr}\n📦 出庫: ${takeout}個\n` + (found ? `✅ 配完: ${complete}個\n💰 差引支給: ¥${net.toLocaleString()}` : `※業務中です`);
  sendLine(msg, userId, null, replyToken);
}

function handleMonthlyResult(ss, userId, staffInfo, nowDate, replyToken) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_TIMELOG), logs = sheet.getDataRange().getValues();
  const prefix = fmt(nowDate, 'yyyy/MM/');
  let totalDel = 0, totalNet = 0;
  logs.forEach(r => { if (r[1] === staffInfo.name && r[2] === '帰庫' && safeDateStr(r[3]).startsWith(prefix)) { totalDel += Number(r[6])||0; totalNet += Number(r[9])||0; } });
  sendLine(`📈 【月間給与予測】\n✅ 総配完: ${totalDel}個\n💰 見込給与: ¥${totalNet.toLocaleString()}`, userId, null, replyToken);
}

function handleCallManager(ss, userId, staffInfo, replyToken) {
  const staffRows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  let found = [];
  staffRows.slice(1).forEach(r => { if (r[2] === staffInfo.store && (r[3].includes('管理') || r[3].includes('オーナー')) && r[5]) found.push({ name: r[1], url: r[5] }); });
  if (found.length === 0) { sendLine('管理者の連絡先が登録されていません。', userId, null, replyToken); return; }
  let msg = `📞 【管理者に連絡】\n` + found.map(m => `・${m.name}: ${m.url}`).join('\n');
  sendLine(msg, userId, null, replyToken);
}

function sendLine(message, userId, buttons = null, replyToken = null) {
  if (!userId && !replyToken) return;
  const payload = { messages: [{ type: 'text', text: message }] };
  if (buttons) payload.messages.push({ type:'template', altText:'メニュー', template:{ type:'buttons', text:'選択してください', actions: buttons.map(b => ({ type:'message', label:b, text:b })) } });
  let url = 'https://api.line.me/v2/bot/message/' + (replyToken ? 'reply' : 'push');
  if (replyToken) payload.replyToken = replyToken; else payload.to = userId;
  UrlFetchApp.fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN }, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
}

function sendLineToRole(message, roleSearch, storeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  rows.slice(1).forEach(r => { if (String(r[3]).includes(roleSearch) && r[4]) {
    const staffStoreIds = String(r[6]).split(',').map(s => s.trim());
    if (!storeId || staffStoreIds.includes(String(storeId).trim())) sendLine(message, r[4]);
  } });
}

/**
 * 御用聞き・配信バッチ
 */
function askMorningCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sendNotificationToManagers(ss, '【午前の荷物状況確認】📦\n午前指定・回収荷物があれば、画面のスクリーンショットをお送りください📸');
}
function askAfternoonCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), rows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  const msg = '【午後の荷物確認】📦\n追加の入荷があれば個数を数字で教えてください！（なければ「0」）';
  rows.slice(1).forEach(r => { if (r[3].includes('ドライバー') && r[4]) sendLine(msg, r[4]); });
}
function askEveningCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sendNotificationToManagers(ss, '【本日の荷物全体数確認】📦\n本日の荷物全体数を教えてください。\n数字だけ返信してください。例）150');
}
function notifyMondayTransfer() { sendNotificationToManagers(SpreadsheetApp.getActiveSpreadsheet(), '【💰 振込日のご確認】\n本日は振込日です。準備・確認をお願いいたします。'); }
function askWednesdayShift() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), rows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  rows.slice(1).forEach(r => { if (r[3].includes('ドライバー') && r[4]) sendLine('【📅 シフト提出】\n' + r[1] + ' さん、来週のシフト希望を教えてください！', r[4]); });
}

function sendNotificationToManagers(ss, msg) {
  const rows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  rows.slice(1).forEach(r => { if ((r[3].includes('管理者') || r[3].includes('オーナー')) && r[4]) sendLine(msg, r[4]); });
}

function getImageTextFromLine(messageId) {
  const response = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', { headers: { Authorization: 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN }, muteHttpExceptions: true });
  const file = DriveApp.getRootFolder().createFile(response.getBlob().setName('temp.jpg'));
  const ocrFile = Drive.Files.insert({ title:'ocr', mimeType:MimeType.GOOGLE_DOCS }, file, { ocr:true, ocrLanguage:'ja' });
  const text = DocumentApp.openById(ocrFile.id).getBody().getText();
  file.setTrashed(true); DriveApp.getFileById(ocrFile.id).setTrashed(true);
  return text;
}
function extractTakeoutCount(text) { const m = text.match(/配達または荷物を置いていくこと[\s\S]*?(\d+)/); return m ? parseInt(m[1], 10) : null; }
function storeMorningInstruction(ss, storeId, messageId) { (ss.getSheetByName(CONFIG.SHEET_TEMP_INSTRUCTIONS) || ss.insertSheet(CONFIG.SHEET_TEMP_INSTRUCTIONS)).appendRow([new Date(), storeId, messageId]); }
function forwardInstructionToShiftDrivers(ss, storeId, messageId) {
  // 実装簡略化：ロールで転送
  sendLineToRole('【指示】管理者より指示が届いています（画像参照）', 'ドライバー', storeId);
}
function sendMorningInstructionsBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(CONFIG.SHEET_TEMP_INSTRUCTIONS);
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getDataRange().getValues();
  const latest = {}; data.slice(1).forEach(r => latest[r[1]] = r[2]);
  for (const sId in latest) { forwardInstructionToShiftDrivers(ss, sId, latest[sId]); }
  sheet.deleteRows(2, sheet.getLastRow() - 1);
}

function getExecUrl_() {
  const savedUrl = PropertiesService.getScriptProperties().getProperty('DEPLOY_URL');
  if (savedUrl && savedUrl.includes('/exec')) return savedUrl;
  try { const serviceUrl = ScriptApp.getService().getUrl(); if (serviceUrl) return serviceUrl.replace('/dev', '/exec'); } catch (e) {}
  return null;
}
function getDeployUrl_() { return getExecUrl_() || ScriptApp.getService().getUrl(); }

function buildFormHtml(type, staff, storeId, deployUrl) {
  const TC = { work_in:{ label:'出勤', emoji:'🟢', color:'#43a047' }, car_out:{ label:'出庫', emoji:'🚗', color:'#1e88e5' }, car_in:{ label:'帰庫', emoji:'🏠', color:'#e53935' } }[type] || { label:'打刻', emoji:'📋', color:'#555' };
  const staffOptions = staff.map(s => `<option value="${s.id}">${s.store ? '['+s.store+'] ' : ''}${s.name}</option>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TC.label}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.card{background:#fff;border-radius:20px;padding:32px 24px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.12);text-align:center}.emoji{font-size:52px;margin-bottom:10px}h1{font-size:22px;color:#333;margin-bottom:20px}.field{text-align:left;margin-bottom:16px}label{display:block;font-size:13px;font-weight:bold;color:#555;margin-bottom:6px}select{width:100%;padding:14px;font-size:17px;border:2px solid #ddd;border-radius:10px;outline:none;background:#fff;color:#333}select:focus{border-color:${TC.color}}.btn{width:100%;padding:16px;font-size:18px;font-weight:bold;color:#fff;background:${TC.color};border:none;border-radius:12px;cursor:pointer;margin-top:8px}.btn:active{opacity:.8}.btn:disabled{background:#ccc}</style></head><body><div class="card"><div id="form-area"><div class="emoji">${TC.emoji}</div><h1>${TC.label}打刻</h1><div class="field"><label>スタッフを選択</label><select id="staffId"><option value="">-- 選択してください --</option>${staffOptions}</select></div><button class="btn" id="submitBtn" onclick="submitForm()">打刻する</button></div></div><script>function submitForm(){ const staffId=document.getElementById('staffId').value; if(!staffId){alert('選択してください');return;} const btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='送信中...'; const form=document.createElement('form'); form.method='GET'; form.action='${deployUrl}'; form.target='_top'; [['type','${type}'],['staffId',staffId],['action','stamp'],['storeId','${storeId||''}']].forEach(([n,v])=>{ const i=document.createElement('input'); i.type='hidden'; i.name=n; i.value=v; form.appendChild(i); }); document.body.appendChild(form); form.submit(); }</script></body></html>`;
}

function resultHtml(title, message, isSuccess) {
  const color = isSuccess ? '#43a047' : '#e53935';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{background:#fff;border-radius:20px;padding:40px 20px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.1);text-align:center}.emoji{font-size:64px;margin-bottom:16px}h1{font-size:24px;color:#333;margin-bottom:16px}p{color:#666;line-height:1.6;margin-bottom:24px;white-space:pre-wrap}.btn{display:inline-block;padding:14px 28px;background:${color};color:#fff;text-decoration:none;border-radius:12px;font-weight:bold}</style></head><body><div class="card"><div class="emoji">${isSuccess?'✅':'⚠️'}</div><h1>${title}</h1><p>${message}</p><a href="#" class="btn" onclick="window.top.close();return false;">閉じる</a></div></body></html>`;
}

function testLineToken() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('LINE IDを入力してください');
  if (res.getSelectedButton() === ui.Button.OK) sendLine('テスト送信です', res.getResponseText());
}
