// ===================================================
// 2_Calculations.gs (計算ロジック)
// ============= 役割 =================================
// ・給与、売上、レンタル費の計算ルール
// ・単価テーブルの管理
// ・集計用データ処理（レポーター共通）
// ・共通ユーティリティ（日付、書式設定、データ取得）
// ===================================================

// ========== ★ 設定（ここだけ変更してください） ==========
const CONFIG = {
  SHEET_STAFF:   'スタッフ一覧',
  SHEET_TIMELOG: '打刻データ',
  SHEET_DAILY:   '日報シート',
  SHEET_SUMMARY: '集計シート',
  SHEET_QR:      'QRコード一覧',
  SHEET_ARRIVAL:    '入荷記録',
  SHEET_CHECK:      '数量確認',
  SHEET_TRACKING:   '不在追跡記録',
  SHEET_OVERALL_SUMMARY: '全体のまとめ',
  SHEET_SHIFT:      'シフト表',
  SHIFT_SHEET_PREFIX: 'シフト表_',
  SHIFT_PREPARE_DAY: 20,
  SHEET_TEMP_INSTRUCTIONS: '一時指示データ',

  LINE_CHANNEL_ACCESS_TOKEN: 'vJdoksjwPyc3Hf4Rh/0m/ItO3ZQu1i5EN/CPkSlZQPfgoiFQMww7nOmPgE6bj3k7RK9DT6W6YshheHDEsB7rMIObAtosh4Tm4wMBlIUu7vyV4clnhKuzwHVf89BN1n1G15yQ8QieP9Ec72wbc5tLaJQdB04t89/1O/w1cDnyilFU=',
  LINE_GROUP_ID:              '', // ★ 未定義エラー防止用

  COMPANY_NAME:         'KCS合同会社',
  PDF_FOLDER_NAME:      '稼動報告書',

  RENTAL_RATE_PER_HOUR: 120, // ★ レンタル費（円/1h）
  AUTO_UPDATE_HOUR:      20,
  ARRIVAL_ASK_HOURS:  [9, 16],
  INCENTIVE_RATE:     0.04,

  ARCHIVE_SS_ID: '1RD0GFC1feZ-6kEXd2zQHmrbeVXpmALn5iQSxJwFURh8',
  ARCHIVE_DAY:   10,

  DELIVERY_REPORT_SS_ID: '1sXnBUNOSost57wb7qf183hw6RnYccDUJpp5YV0C4D3g',
  
  // ★ 売上単価テーブル（税込・1個あたり）
  PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 125, tax: 0.1 } ],
  // ★ 人件費単価テーブル（スタッフ支払額・1個あたり）
  LABOR_PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 80 } ],
};
// ======================================================

/**
 * 給与・売上計算
 */
function getPricePerItem(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'));
  let entry = CONFIG.PRICE_TABLE[0];
  CONFIG.PRICE_TABLE.forEach(p => { if (d >= new Date(p.from.replace(/\//g, '-'))) entry = p; });
  return Math.round(entry.unitPrice * (1 + entry.tax) * 10) / 10;
}

function getLaborPricePerItem(dateStr) {
  const d = new Date(dateStr.replace(/\//g, '-'));
  let entry = CONFIG.LABOR_PRICE_TABLE[0];
  CONFIG.LABOR_PRICE_TABLE.forEach(p => { if (d >= new Date(p.from.replace(/\//g, '-'))) entry = p; });
  return entry.unitPrice;
}

function calcRentalCost(rentalMinutes) {
  return Math.round(CONFIG.RENTAL_RATE_PER_HOUR * rentalMinutes / 60);
}

/**
 * スタッフごとの集計基盤
 */
function aggregateByStaff(logs, dateFilter) {
  const data = {};
  logs.forEach(r => {
    const d = new Date(r[5]);
    if (dateFilter(d)) {
      const id = r[0];
      if (!data[id]) data[id] = { name: r[1], days: 0, items: 0, gross: 0, labor: 0, rental: 0, net: 0, dates: new Set() };
      data[id].dates.add(safeDateStr(r[3]));
      if (r[2] === '帰庫') {
        data[id].items += (Number(r[6]) || 0) + (Number(r[15]) || 0);
        data[id].gross += Number(r[7]) || 0;
        data[id].labor += Number(r[11]) || 0;
        data[id].rental += Number(r[8]) || 0;
        data[id].net    += Number(r[9]) || 0;
      }
    }
  });
  Object.keys(data).forEach(id => data[id].days = data[id].dates.size);
  return data;
}

function calcTotals(data) {
  return Object.values(data).reduce((acc, d) => {
    acc.days += d.days; acc.items += d.items; acc.gross += d.gross; acc.labor += d.labor; acc.rental += d.rental; acc.net += d.net;
    return acc;
  }, { days: 0, items: 0, gross: 0, labor: 0, rental: 0, net: 0 });
}

/**
 * 共有ユーティリティ
 */
function safeDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy/MM/dd');
  return String(val);
}

function fmt(date, pattern) { return Utilities.formatDate(date, 'Asia/Tokyo', pattern); }

function colLetter(col) {
  let temp, letter = '';
  while (col > 0) { temp = (col - 1) % 26; letter = String.fromCharCode(65 + temp) + letter; col = (col - temp - 1) / 26; }
  return letter;
}

function styleHeader(sheet, colCount, color, row = 1) {
  sheet.getRange(row, 1, 1, colCount).setFontWeight('bold').setBackground(color).setFontColor('white').setHorizontalAlignment('center').setBorder(true, true, true, true, true, true);
}

/**
 * マスタ情報取得
 */
function getStaffInfo(ss, staffId) {
  const rows = ss.getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(staffId)) {
      return { id: rows[i][0], name: rows[i][1], store: rows[i][2], role: rows[i][3], userId: rows[i][4], rental: rows[i][5], storeId: rows[i][6] };
    }
  }
  return null;
}

function getStaffList(storeId) {
  const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_STAFF).getDataRange().getValues();
  const staff = [];
  for (let i = 1; i < rows.length; i++) {
    const sId = String(rows[i][0]);
    const sStoreId = String(rows[i][6]);
    const staffStoreIds = sStoreId.split(',').map(s => s.trim());
    if (!storeId || staffStoreIds.includes(String(storeId).trim())) {
      if (sId && rows[i][1]) staff.push({ id: sId, name: rows[i][1], store: rows[i][2], storeId: sStoreId });
    }
  }
  return staff;
}
