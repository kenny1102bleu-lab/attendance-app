// ===================================================
// 3_Visualization.gs (見える化・シート更新)
// ============= 役割 =================================
// ・日次、週次、月次、全体まとめシートの更新
// ・配達報告書への自動集計・書き込み
// ・店舗別・スタッフ別セクションの作成
// ===================================================

/**
 * 全集計シートの更新統括
 */
function updateAllSheets() {
  updateDailySheet();
  updateSummarySheet();
  updateCheckSheet();
  updateDeliveryReport();
  updateOverallSummarySheet();
}

/**
 * 日報シートの更新（本日分・店舗ID順）
 */
function updateDailySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues(), staffRows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  const staffStoreMap = {}; staffRows.forEach(r => staffStoreMap[r[0]] = r[2] || '');
  let sheet = ss.getSheetByName(CONFIG.SHEET_DAILY) || ss.insertSheet(CONFIG.SHEET_DAILY);
  sheet.clear();
  const today = safeDateStr(new Date());
  let dailyLogs = logs.filter((r, i) => i > 0 && safeDateStr(r[3]) === today).sort((a,b) => String(a[14]||'').localeCompare(String(b[14]||'')));
  const headers = ['名前', '店舗ID', '店舗名', '区分', '時間', '配完個数', '不在個数', '依頼個数', '持ち出し'];
  const data = [headers];
  dailyLogs.forEach(r => data.push([r[1], r[14]||'', staffStoreMap[r[0]]||'', r[2], r[4], r[6]||0, r[13]||0, r[15]||0, r[12]||0]));
  if (data.length > 1) { sheet.getRange(1, 1, data.length, headers.length).setValues(data); styleHeader(sheet, headers.length, '#2e7d32'); }
}

/**
 * 月次実績集計シート（スタッフ別、店舗別小計付き）
 */
function updateSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues();
  let sheet = ss.getSheetByName(CONFIG.SHEET_SUMMARY) || ss.insertSheet(CONFIG.SHEET_SUMMARY);
  sheet.clear();
  const now = new Date();
  let ty = now.getFullYear(), tm = now.getMonth();
  if (now.getDate() <= (CONFIG.ARCHIVE_DAY || 10)) { tm -= 1; if (tm < 0) { tm = 11; ty -= 1; } }
  const start = new Date(ty, tm, 1), end = new Date(ty, tm + 1, 0, 23, 59, 59);
  const mData = aggregateByStaff(logs.filter((r, i) => i > 0 && r[0]), d => d >= start && d <= end);
  const staffRows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues(), smap = {};
  staffRows.slice(1).forEach(r => smap[r[0]] = { store: r[2], role: r[3], storeId: r[6] });
  const groups = {};
  Object.entries(mData).forEach(([id, d]) => {
    const s = smap[id] || { store: '不明', role: '', storeId: '?' };
    if (!groups[s.storeId]) groups[s.storeId] = { name: s.store, staff: [], totals: { gross: 0, items: 0, labor: 0, rental: 0, net: 0 } };
    d.role = s.role; d.storeId = s.storeId; groups[s.storeId].staff.push(d);
    groups[s.storeId].totals.gross += d.gross; groups[s.storeId].totals.items += d.items; groups[s.storeId].totals.labor += d.labor; groups[s.storeId].totals.rental += d.rental; groups[s.storeId].totals.net += d.net;
  });
  const headers = ['名前', '店舗ID', '役職', '出勤日数', '配完個数', '売上', '人件費', 'レンタル費', '差引支給額'];
  let cur = 1;
  sheet.getRange(cur, 1).setValue(`📈 月次レポート（${ty}年${tm + 1}月）`).setFontWeight('bold').setFontSize(14);
  cur += 2;
  Object.values(groups).forEach(g => {
    sheet.getRange(cur, 1).setValue(`📍 店舗: ${g.name} (${g.staff[0].storeId})`).setBold(true); cur++;
    const rows = g.staff.map(d => [d.name, d.storeId, d.role, d.days, d.items, d.gross, d.labor, d.rental, d.net]);
    sheet.getRange(cur, 1, 1, headers.length).setValues([headers]); styleHeader(sheet, headers.length, '#1a73e8', cur); cur++;
    sheet.getRange(cur, 1, rows.length, headers.length).setValues(rows); sheet.getRange(cur, 6, rows.length, 4).setNumberFormat('¥#,##0'); cur += rows.length;
    sheet.getRange(cur, 1, 1, headers.length).setValues([['小計', '', '', '', g.totals.items, g.totals.gross, g.totals.labor, g.totals.rental, g.totals.net]]).setFontWeight('bold').setBackground('#f1f3f4'); cur += 2;
  });
}

/**
 * 全拠点俯瞰シート（横日計）
 */
function updateOverallSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(CONFIG.SHEET_OVERALL_SUMMARY || '全体のまとめ') || ss.insertSheet(CONFIG.SHEET_OVERALL_SUMMARY || '全体のまとめ', 0);
  sheet.clear();
  const now = new Date(), year = now.getFullYear(), month = now.getMonth() + 1, days = new Date(year, month, 0).getDate();
  const staffRows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues(), sMap = {}, ids = new Set();
  staffRows.slice(1).forEach(r => { if (r[0]) { sMap[r[6]] = r[2]; ids.add(r[6]); } });
  const sortedIds = Array.from(ids).sort(), logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues();
  const data = {}; sortedIds.forEach(id => { data[id] = {}; for (let d=1; d<=days; d++) data[id][d] = 0; });
  logs.forEach((r, i) => { if (i > 0 && r[2] === '帰庫') { const d = new Date(r[5]); if (d.getFullYear() === year && d.getMonth()+1 === month) { const day = d.getDate(); if (data[r[14]]) data[r[14]][day] += (Number(r[6])||0) + (Number(r[13])||0); } } });
  sheet.getRange(1, 1).setValue(`📊 全拠点稼働状況（${year}年${month}月）`).setBold(true).setFontSize(16);
  const daysH = [''], datesH = ['']; for (let d=1; d<=days; d++) { daysH.push(fmt(new Date(year, month-1, d), 'E')); datesH.push(d); }
  sheet.getRange(3, 1, 1, daysH.length).setValues([daysH]); sheet.getRange(4, 1, 1, datesH.length).setValues([datesH]); styleHeader(sheet, daysH.length, '#1a73e8', 3); styleHeader(sheet, datesH.length, '#1a73e8', 4);
  const out = []; const totals = Array(days).fill(0);
  sortedIds.forEach(id => { const row = [`${sMap[id]} (${id})`]; for (let d=1; d<=days; d++) { const v = data[id][d] || 0; row.push(v === 0 ? '' : v); totals[d-1] += v; } out.push(row); });
  if (out.length > 0) { sheet.getRange(8, 1, out.length, days+1).setValues(out); sheet.getRange(7, 1, 1, days+1).setValues([['拠点合計', ...totals.map(v => v===0 ? '' : v)]]).setBold(true).setBackground('#fff176'); }
}

/**
 * 数量確認シート（入荷 vs 実績）
 */
function updateCheckSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues();
  let sheet = ss.getSheetByName(CONFIG.SHEET_CHECK) || ss.insertSheet(CONFIG.SHEET_CHECK);
  sheet.clear();
  const headers = ['日付', '入荷個数', '配完合計', '不在合計', '配完+不在', '差異', '状態'];
  sheet.appendRow(headers); styleHeader(sheet, headers.length, '#1a73e8');
  const arrMap = {}; const arrRes = ss.getSheetByName(CONFIG.SHEET_ARRIVAL); if (arrRes) arrRes.getDataRange().getValues().slice(1).forEach(r => { if (r[0] && r[2]==='入荷') arrMap[safeDateStr(r[0])] = (arrMap[safeDateStr(r[0])]||0) + Number(r[3]||0); });
  const dayMap = {}; logs.slice(1).forEach(r => { if (r[2]==='帰庫') { const ds = safeDateStr(r[3]); if (!dayMap[ds]) dayMap[ds] = { d: 0, a: 0 }; dayMap[ds].d += Number(r[6]||0); dayMap[ds].a += Number(r[13]||0); } });
  const all = Array.from(new Set([...Object.keys(arrMap), ...Object.keys(dayMap)])).sort();
  all.forEach((ds, idx) => {
    const a = arrMap[ds] ?? '-', d = dayMap[ds]?.d ?? 0, b = dayMap[ds]?.a ?? 0, t = d+b;
    const diff = a==='-' ? '-' : a-t, st = diff===0 ? '✅ 一致' : (a==='-' ? '⚠️ 入力待ち' : '❌ 不一致');
    sheet.appendRow([ds, a, d, b, t, diff, st]); if (st === '❌ 不一致') sheet.getRange(idx+2, 1, 1, 7).setBackground('#fce4ec');
  });
}

/**
 * 配達報告書（外部シート）の更新・書き込み
 */
function updateDeliveryReport() {
  try {
    const reportSs = SpreadsheetApp.openById(CONFIG.DELIVERY_REPORT_SS_ID);
    const now = new Date(), sn = fmt(now, 'yyyyMM'), sheet = reportSs.getSheetByName(sn);
    if (!sheet) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet(), logs = ss.getSheetByName(CONFIG.SHEET_TIMELOG).getDataRange().getValues(), arrs = ss.getSheetByName(CONFIG.SHEET_ARRIVAL)?.getDataRange().getValues();
    const day = now.getDate(), col = day + 1;
    // 持ち出し、配完などの日計を集計して書き込み（簡易版）
    const totalD = logs.slice(1).reduce((s, r) => (safeDateStr(r[3])===safeDateStr(now) && r[2]==='帰庫') ? s + Number(r[6]||0) : s, 0);
    sheet.getRange(6, col).setValue(totalD); // 不在行などへの書き込みロジックは writeToDeliveryReportRealtime で即時実行
  } catch(e) { console.error('報告書更新エラー: ' + e.message); }
}

function writeToDeliveryReportRealtime(kind, value, staffName) {
  try {
    const reportSs = SpreadsheetApp.openById(CONFIG.DELIVERY_REPORT_SS_ID);
    const now = new Date(), sn = fmt(now, 'yyyyMM'), sheet = reportSs.getSheetByName(sn);
    if (!sheet) return;
    const col = now.getDate() + 1;
    if (kind === 'arrival') { const cur = sheet.getRange(5, col).getValue() || 0; sheet.getRange(5, col).setValue(Number(cur) + value); }
    if (kind === 'collection') { const cur = sheet.getRange(20, col).getValue() || 0; sheet.getRange(20, col).setValue(Number(cur) + value); }
    if (kind === 'staff_takeout' && staffName) {
      const sRows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
      let row = 9; for (let i=1; i<sRows.length; i++) { if (sRows[i][1] === staffName) { const cur = sheet.getRange(row, col).getValue() || 0; sheet.getRange(row, col).setValue(Number(cur) + value); break; } row++; }
    }
  } catch(e) {}
}

function copyReportSheetToThisApp() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.DELIVERY_REPORT_SS_ID);
    const sn = fmt(new Date(), 'yyyyMM'), ts = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName(sn).copyTo(ts).setName(sn);
    SpreadsheetApp.getUi().alert('✅ 配達報告書をコピーしました。');
  } catch(e) {}
}

/**
 * 集計表示用ヘルパー
 */
function writeAggRows(sheet, data, startRow) {
  let r = startRow; const entries = Object.values(data);
  if (entries.length === 0) { sheet.getRange(r, 1).setValue('データなし'); return r + 1; }
  entries.forEach(d => {
    sheet.getRange(r, 1, 1, 7).setValues([[d.name, d.days, d.items, d.gross, d.labor, d.rental, d.net]]);
    sheet.getRange(r, 4, 1, 4).setNumberFormat('¥#,##0'); r++;
  });
  return r;
}
function writeTotalRow(sheet, data, row, bgColor) {
  const t = calcTotals(data);
  sheet.getRange(row, 1, 1, 7).setValues([['合計', t.days, t.items, t.gross, t.labor, t.rental, t.net]]).setBold(true).setBackground(bgColor);
  sheet.getRange(row, 4, 1, 4).setNumberFormat('¥#,##0'); return row + 1;
}
