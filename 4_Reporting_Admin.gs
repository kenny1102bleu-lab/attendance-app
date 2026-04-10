// ===================================================
// 4_Reporting_Admin.gs (報告書・管理)
// ============= 役割 =================================
// ・稼動報告書PDFの月次一括生成
// ・シフト表の同期と自動更新
// ・カスタムメニュー定義
// ・自動トリガーの設定
// ===================================================

/**
 * カスタムメニューの定義
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⏱ 勤怠管理')
    .addItem('🔧 初期セットアップ',               'setupSpreadsheet')
    .addItem('🔄 スタッフとシフト表を同期',       'syncShiftSheet')
    .addSeparator()
    .addItem('📊 集計シートを今すぐ更新',           'updateAllSheets')
    .addItem('📈 「全体のまとめ」を更新',           'updateOverallSummarySheet')
    .addItem('⏰ 自動集計トリガーを設定',           'setDailyTrigger')
    .addSeparator()
    .addItem('📦 午前の荷物状況を聞く (管理者へ)',   'askMorningCount')
    .addItem('📦 午後の追加入荷を聞く (ドライバーへ)', 'askAfternoonCount')
    .addItem('🌙 夜の全体数確認を聞く (管理者へ)',   'askEveningCount')
    .addItem('🔍 数量確認シートを更新',             'updateCheckSheet')
    .addItem('⏰ 荷物確認トリガーを設定',           'setArrivalTrigger')
    .addSeparator()
    .addItem('💰 振込確認を送る (月曜用)',           'notifyMondayTransfer')
    .addItem('📅 シフト提出要請を送る (水曜用)',       'askWednesdayShift')
    .addItem('⏰ 週間通知トリガーを一括設定',           'setWeeklyTriggers')
    .addSeparator()
    .addItem('📄 稼動報告書PDFを今すぐ生成',        'generateAllPDFs')
    .addItem('⏰ PDF自動生成トリガーを設定',        'setPdfTrigger')
    .addSeparator()
    .addItem('🔗 QRコードURLを生成',               'generateQRUrls')
    .addItem('📋 QRコードURLを確認・コピー',        'showQRUrlList')
    .addSeparator()
    .addItem('❓ ヘルプ / 使い方',                 'showHelp')
    .addSeparator()
    .addItem('🧪 LINE送信テスト (トークン確認用)',  'testLineToken')
    .addToUi();
}

/**
 * 初期セットアップ（シート作成・書式設定）
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // スタッフ一覧シート
  let s = ss.getSheetByName(CONFIG.SHEET_STAFF) || ss.insertSheet(CONFIG.SHEET_STAFF);
  if (s.getLastRow() === 0) { s.appendRow(['スタッフID', '名前', '店舗名', '役職', 'LINE userId', '車両レンタル', 'ストアID']); styleHeader(s, 7, '#1a73e8'); }
  // 打刻データシート
  let d = ss.getSheetByName(CONFIG.SHEET_TIMELOG) || ss.insertSheet(CONFIG.SHEET_TIMELOG);
  if (d.getLastRow() === 0) { d.appendRow(['スタッフID','名前','種別','日付','時刻','タイムスタンプ','配完個数','売上','レンタル費','差引支給額','人件費単価','人件費','持ち出し','不在','ストアID','依頼']); styleHeader(d, 16, '#1a73e8'); }
  SpreadsheetApp.getUi().alert('✅ 初期セットアップ完了しました。');
}

/**
 * 稼動報告書PDF生成ロジック
 */
function generateAllPDFs(targetYear, targetMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), now = new Date(), year = targetYear || now.getFullYear(), month = targetMonth || now.getMonth() + 1;
  const folder = (DriveApp.getFoldersByName(CONFIG.PDF_FOLDER_NAME).hasNext() ? DriveApp.getFoldersByName(CONFIG.PDF_FOLDER_NAME).next() : DriveApp.createFolder(CONFIG.PDF_FOLDER_NAME)).createFolder(`${year}年${month}月稼動報告書`);
  const logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues(), carInLogs = logs.filter((r,i) => i>0 && r[2]==='帰庫');
  const staffList = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({ id: String(r[0]), name: r[1] }));
  let count = 0; staffList.forEach(staff => {
    const sLogs = carInLogs.filter(r => String(r[0])===staff.id && new Date(r[5]).getFullYear()===year && new Date(r[5]).getMonth()+1===month);
    if (sLogs.length === 0) return;
    const dMap = {}; sLogs.forEach(r => { const ds = safeDateStr(r[3]); if(!dMap[ds]) dMap[ds]={i:0, g:0, r:0, n:0, l:0}; dMap[ds].i+=Number(r[6]||0); dMap[ds].g+=Number(r[7]||0); dMap[ds].r+=Number(r[8]||0); dMap[ds].n+=Number(r[9]||0); dMap[ds].l+=Number(r[11]||0); });
    const workDays = new Set(logs.filter((r,i)=>i>0 && String(r[0])===staff.id && r[2]==='出勤' && new Date(r[5]).getFullYear()===year && new Date(r[5]).getMonth()+1===month).map(r=>safeDateStr(r[3])));
    const dRows = Object.entries(dMap).sort((a,b)=>a[0].localeCompare(b[0]));
    const payDate = getPaymentDate(year, month), pdStr = fmt(payDate, 'yyyy年MM月dd日（E）');
    const html = buildReportHtml({ companyName:CONFIG.COMPANY_NAME, staffName:staff.name, label:`${year}年${month}月`, workDays:workDays.size, totalItems:dRows.reduce((a,[,v])=>a+v.i,0), totalGross:dRows.reduce((a,[,v])=>a+v.g,0), totalRental:dRows.reduce((a,[,v])=>a+v.r,0), totalNet:dRows.reduce((a,[,v])=>a+v.n,0), totalLabor:dRows.reduce((a,[,v])=>a+v.l,0), dailyRows:dRows, payDateStr:pdStr });
    folder.createFile(convertHtmlToPdf(html, `${staff.name}_${year}年${month}月_稼動報告書`)); count++;
  });
  SpreadsheetApp.getUi().alert(`✅ ${year}年${month}月分 ${count}件のPDFを生成しました。`);
}

function buildReportHtml(d) {
  const yen = n => '¥' + Math.round(n).toLocaleString();
  const rows = d.dailyRows.map(([dt, v]) => `<tr><td>${dt}</td><td class="num">${v.i}</td><td class="num">${yen(v.g)}</td><td class="num">${yen(v.r)}</td><td class="num ${v.n<0?'minus':''}">${yen(v.n)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:20px;font-size:10pt}.header{display:flex;justify-content:space-between;border-bottom:2px solid #1a73e8;padding-bottom:10px;margin-bottom:20px}.title{font-size:18pt;font-weight:bold;color:#1a73e8}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1a73e8;color:white;padding:8px}td{padding:8px;border-bottom:1px solid #ddd}.num{text-align:right}.summary{margin-top:20px;background:#f8f9fa;padding:15px;border-radius:10px}.total-row{font-size:12pt;font-weight:bold;color:#1a73e8}</style></head><body><div class="header"><div><div style="font-size:9pt;color:#666">${d.companyName}</div><div class="title">稼動報告書</div></div><div>対象月：${d.label}</div></div><div style="margin-bottom:15px">氏名：<b>${d.staffName} 様</b><br>出勤日数：${d.workDays} 日 ／ 配完総数：${d.totalItems} 個<br>お支払予定日：<span style="color:#e65100;font-weight:bold">${d.payDateStr}</span></div><table><thead><tr><th>日付</th><th>配完</th><th>売上</th><th>レンタル</th><th>差引支給</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><table style="width:100%"><tr><td>売上合計</td><td class="num">${yen(d.totalGross)}</td></tr><tr><td>人件費（支払額）</td><td class="num" style="color:#1565c0">− ${yen(d.totalLabor)}</td></tr><tr><td>車両レンタル費</td><td class="num" style="color:#e53935">− ${yen(d.totalRental)}</td></tr><tr class="total-row"><td>差引支給額合計</td><td class="num">${yen(d.totalNet)}</td></tr></table></div></body></html>`;
}

function convertHtmlToPdf(html, name) { const blob = Utilities.newBlob(html, 'text/html', name+'.html'); const f = DriveApp.createFile(blob); const pdf = f.getAs('application/pdf').setName(name+'.pdf'); f.setTrashed(true); return pdf; }
function getPaymentDate(y, m) { let d = new Date(y, m-1, 15); const h = getJapaneseHolidays(y, m); while (d.getDay()===0 || d.getDay()===6 || h.has(fmt(d, 'yyyy/MM/dd'))) d.setDate(d.getDate()+1); return d; }
function getJapaneseHolidays(y, m) { const h = new Set(); try { CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com').getEvents(new Date(y,m-1,1), new Date(y,m,31)).forEach(e => h.add(fmt(e.getStartTime(), 'yyyy/MM/dd'))); } catch(e){} return h; }
function generateLastMonthPDFs() { const n = new Date(); let y = n.getFullYear(), m = n.getMonth(); if (m===0) { m=12; y--; } generateAllPDFs(y, m); }

/**
 * シフト表同期
 */
function syncShiftSheet(isSilent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), staff = ss.getSheetByName(CONFIG.SHEET_STAFF), shift = getShiftSheetByDate(new Date());
  if (!staff || !shift) return;
  const sRows = staff.getDataRange().getValues(), smap = {}; sRows.slice(1).forEach(r => { if(r[0]) smap[r[0]] = { name:r[1], store:r[2] }; });
  const shiftIds = shift.getDataRange().getValues().slice(3).map(r => String(r[0]));
  Object.keys(smap).forEach(id => { if(!shiftIds.includes(id)) shift.appendRow([id, smap[id].name, smap[id].store]); });
  if (isSilent !== true) SpreadsheetApp.getUi().alert('✅ 同期完了しました。');
}

function getShiftSheetByDate(date) {
  const ym = fmt(date, 'yyyyMM'), name = (CONFIG.SHIFT_SHEET_PREFIX || 'シフト表_') + ym;
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) || createMonthlyShiftSheet(date.getFullYear(), date.getMonth() + 1);
}

function createMonthlyShiftSheet(y, m) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), name = (CONFIG.SHIFT_SHEET_PREFIX || 'シフト表_') + y + String(m).padStart(2, '0');
  if (ss.getSheetByName(name)) return ss.getSheetByName(name);
  const sft = ss.insertSheet(name); const days = new Date(y, m, 0).getDate();
  const r2 = ['スタッフID', '名前', '店舗'], r3 = ['', '', '']; for (let d=1; d<=days; d++) { r2.push(d); r3.push(fmt(new Date(y, m-1, d), 'E')); }
  sft.getRange(2, 1, 1, r2.length).setValues([r2]); sft.getRange(3, 1, 1, r3.length).setValues([r3]); styleHeader(sft, r2.length, '#1a73e8', 2); styleHeader(sft, r3.length, '#1a73e8', 3);
  sft.setFrozenRows(3); sft.setFrozenColumns(3); syncShiftSheet(true); return sft;
}

function autoManageShiftSheets() {
  const now = new Date(), day = now.getDate();
  if (day === (CONFIG.SHIFT_PREPARE_DAY || 20)) { let y = now.getFullYear(), m = now.getMonth()+2; if(m>12){m=1;y++;} createMonthlyShiftSheet(y,m); }
}

/**
 * QRコード・ヘルプ
 */
function generateQRUrls() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), staff = ss.getSheetByName(CONFIG.SHEET_STAFF);
  const res = SpreadsheetApp.getUi().prompt('デプロイ後の「ウェブアプリのURL」を入力してください');
  if (res.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return;
  let url = res.getResponseText().trim().replace('/dev', '/exec');
  PropertiesService.getScriptProperties().setProperty('DEPLOY_URL', url);
  const sRows = staff.getDataRange().getValues(), stores = {}; sRows.slice(1).forEach(r => { if(r[6]) stores[r[6]] = r[2]; });
  let q = ss.getSheetByName(CONFIG.SHEET_QR) || ss.insertSheet(CONFIG.SHEET_QR); q.clear(); q.appendRow(['店舗 (ID)', '種別', 'URL', 'QR (D列URLを開く)']);
  Object.entries(stores).forEach(([sid, sn]) => { [{t:'work_in',l:'🟢出勤'},{t:'car_out',l:'🚗出庫'},{t:'car_in',l:'🏠帰庫'}].forEach(m => {
    const turl = `${url}?type=${m.t}&storeId=${sid}`;
    q.appendRow([`${sn} (${sid})`, m.l, turl, 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+encodeURIComponent(turl)]);
  }); });
  styleHeader(q, 4, '#1a73e8'); SpreadsheetApp.getUi().alert('✅ QRコードURLを生成しました。');
}
function showQRUrlList() { SpreadsheetApp.getUi().alert('QRコード一覧シートを確認してください。'); }
function showHelp() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<h2>使い方ヘルプ</h2>1.初期セットアップ<br>2.スタッフ登録<br>3.QR生成<br>4.LINE連携').setWidth(400).setHeight(300), 'ヘルプ'); }

/**
 * トリガー設定
 */
function setDailyTrigger() { setTrigger('updateAllSheets', CONFIG.AUTO_UPDATE_HOUR); }
function setArrivalTrigger() { setTrigger('askMorningCount', CONFIG.ARRIVAL_ASK_HOURS[0]); setTrigger('askAfternoonCount', CONFIG.ARRIVAL_ASK_HOURS[1]); }
function setPdfTrigger() { ScriptApp.newTrigger('generateLastMonthPDFs').timeBased().onMonthDay(10).atHour(15).create(); SpreadsheetApp.getUi().alert('✅ 10日 15時に設定しました'); }
function setWeeklyTriggers() { ScriptApp.newTrigger('notifyMondayTransfer').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create(); ScriptApp.newTrigger('askWednesdayShift').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(9).create(); SpreadsheetApp.getUi().alert('✅ 月曜と水曜に設定しました'); }
function setTrigger(fn, h) { ScriptApp.getProjectTriggers().forEach(t => { if(t.getHandlerFunction()===fn) ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger(fn).timeBased().everyDays(1).atHour(h).create(); }
