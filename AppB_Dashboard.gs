// ===================================================
// アプリB：管理ダッシュボード (2_AppB_Dashboard.gs)
// ============= 役割 =================================
// ・アプリA（打刻DB）から数字を抽出し、日報・週報を自動更新
// ・スタッフ情報の同期とシフト表の管理
// ・QRコードURLの生成（管理用）
// ===================================================

/**
 * 接続設定：アプリAのスプレッドシートIDを入力してください
 * ブラウザのアドレスバーの「spreadsheets/d/◯◯◯/edit」の◯◯◯の部分です。
 */
const MAIN_DB_ID = 'ここにアプリAのIDを入力してください';

/**
 * アプリAの「ウェブアプリURL」（デプロイURL）をここに固定で入力してください
 */
const APP_A_WEB_URL = 'ここにアプリAのウェブアプリURLを入力してください';

/**
 * 外部連携：シフト表スプレッドシートID
 */
const SHIFT_SS_ID = '18IrG3sZXSgsCWJCa9mhmgWUNZT3RXdnV';

/**
 * 初期セットアップ（アプリB用：レポート用シートの一括作成）
 */
function setupB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 日報シート
  let daily = ss.getSheetByName('日報シート') || ss.insertSheet('日報シート');
  daily.clear();
  const dH = ['名前', '店舗ID', '種別', '時間', '配完個数', '不在', '依頼', '売上'];
  daily.getRange(1, 1, 1, dH.length).setValues([dH]).setBackground('#2e7d32').setFontColor('white').setFontWeight('bold');
  
  // 2. 週報・月報（集計）
  let summary = ss.getSheetByName('集計シート') || ss.insertSheet('集計シート');
  summary.clear();
  const sH = ['名前', '店舗名', '出勤日数', '累計個数', '累計売上', '人件費', 'レンタル', '差引支給額'];
  summary.getRange(1, 1, 1, sH.length).setValues([sH]).setBackground('#1565c0').setFontColor('white').setFontWeight('bold');

  // 3. 数量照合
  let check = ss.getSheetByName('数量確認') || ss.insertSheet('数量確認');
  check.clear();
  const cH = ['日付', '入荷数', '実績合計', '差異', '状態'];
  check.getRange(1, 1, 1, cH.length).setValues([cH]).setBackground('#e65100').setFontColor('white').setFontWeight('bold');

  // 4. シフト表（雛形）
  let shift = ss.getSheetByName('シフト表') || ss.insertSheet('シフト表');
  shift.clear();
  shift.appendRow(['店舗', '店舗ID', 'スタッフID', '名前', '1', '2', '3', '4', '5', '...']);
  shift.getRange(1, 1, 1, 10).setBackground('#1a73e8').setFontColor('white');

  // 5. QRコード一覧
  let qr = ss.getSheetByName('QRコード一覧') || ss.insertSheet('QRコード一覧');
  qr.clear();
  qr.appendRow(['店舗', '種別', 'URL', 'QR画像URL']);
  qr.getRange(1, 1, 1, 4).setBackground('#555').setFontColor('white');

  SpreadsheetApp.getUi().alert('✅ アプリB（ダッシュボード）のセットアップが完了しました。\n「MAIN_DB_ID」をスクリプト内に設定してから「最新データに更新」を実行してください。');
}

/**
 * データの同期と集計
 */
function updateDashboard() {
  if (!MAIN_DB_ID || MAIN_DB_ID.includes('入力')) {
    SpreadsheetApp.getUi().alert('⚠️ MAIN_DB_ID が設定されていません。コードの21行目を編集してください。'); return;
  }
  const mainSs = SpreadsheetApp.openById(MAIN_DB_ID);
  const now = new Date(), today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');
  
  // 1. 本日の日報（アプリAから抽出）
  const logs = mainSs.getSheetByName('打刻データ').getDataRange().getValues();
  const todayLogs = logs.filter(r => String(r[3]) === today).map(r => [r[1], r[14]||'', r[2], r[4], r[6]||0, r[13]||0, r[15]||0, r[7]||0]);
  const dailySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('日報シート');
  dailySheet.getRange(2, 1, Math.max(dailySheet.getLastRow(), 1), 8).clearContent();
  if (todayLogs.length > 0) dailySheet.getRange(2, 1, todayLogs.length, 8).setValues(todayLogs);

  // 2. 数量の照合
  const arrivals = mainSs.getSheetByName('入荷記録').getDataRange().getValues();
  const arrMap = {}; arrivals.slice(1).forEach(r => { if(r[0] && r[2]==='入荷') arrMap[String(r[0])] = (arrMap[String(r[0])]||0) + Number(r[3]||0); });
  const resMap = {}; logs.slice(1).forEach(r => { if(r[2]==='帰庫'){ const d=String(r[3]); if(!resMap[d])resMap[d]=0; resMap[d]+=(Number(r[6])||0)+(Number(r[13])||0); } });
  const checkSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('数量確認');
  const dates = Array.from(new Set([...Object.keys(arrMap), ...Object.keys(resMap)])).sort();
  const checkData = dates.map(d => { const a=arrMap[d]||0, r=resMap[d]||0, diff=a-r; return [d, a, r, diff, diff===0?'✅ 一致':'❌ 不一致']; });
  checkSheet.getRange(2,1,Math.max(checkSheet.getLastRow(),1),5).clearContent();
  if (checkData.length > 0) checkSheet.getRange(2,1,checkData.length,5).setValues(checkData);

  // 3. 累計集計
  const summaryMap = {};
  logs.slice(1).forEach(r => { if(r[2]==='帰庫'){ const id=String(r[0]); if(!summaryMap[id]) summaryMap[id]={n:r[1], sName:'', c:0, i:0, s:0, l:0, r:0, net:0}; 
    summaryMap[id].c++; summaryMap[id].i += Number(r[6]||0); summaryMap[id].s += Number(r[7]||0);
    summaryMap[id].l += Number(r[11]||0); summaryMap[id].r += Number(r[8]||0); summaryMap[id].net += Number(r[9]||0);
  }});
  const sTable = Object.values(summaryMap).map(d => [d.n, '', d.c, d.i, d.s, d.l, d.r, d.net]);
  const sSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('集計シート');
  sSheet.getRange(2, 1, Math.max(sSheet.getLastRow(), 1), 8).clearContent();
  if (sTable.length > 0) sSheet.getRange(2, 1, sTable.length, 8).setValues(sTable);

  SpreadsheetApp.getUi().alert('✅ ダッシュボードの数字をアプリAから最新の状態に更新しました。');
}

/**
 * アプリAのスタッフ情報をシフト表に同期
 */
function syncStaffToShift() {
  if (!MAIN_DB_ID) return;
  const mainSs = SpreadsheetApp.openById(MAIN_DB_ID);
  const staff = mainSs.getSheetByName('スタッフ一覧').getDataRange().getValues().slice(1);
  const shiftSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('シフト表');
  
  const currentIds = shiftSheet.getDataRange().getValues().slice(1).map(r => String(r[0]));
  staff.forEach(s => {
    if (!currentIds.includes(String(s[0]))) {
      shiftSheet.appendRow([s[0], s[1], s[2]]);
    }
  });
  SpreadsheetApp.getUi().alert('✅ アプリAのスタッフリストをシフト表に同期しました。');
}

/**
 * 外部シフト表から名前で合体（完全同期）させる
 */
function syncExternalShift() {
  if (!SHIFT_SS_ID || !MAIN_DB_ID) {
    SpreadsheetApp.getUi().alert('SHIFT_SS_ID または MAIN_DB_ID が設定されていません。');
    return;
  }
  
  // 1. こっちのデータベースから「名前とIDの辞書」を作る
  const mainSs = SpreadsheetApp.openById(MAIN_DB_ID);
  const staffData = mainSs.getSheetByName('スタッフ一覧').getDataRange().getValues();
  const staffDict = {};
  for (let i = 1; i < staffData.length; i++) {
    const sId = String(staffData[i][0]).trim();
    // 半角・全角スペースを取り除いて揺らぎをなくす
    const sName = String(staffData[i][1]).trim().replace(/\s+/g, ''); 
    const sStoreId = String(staffData[i][6]).trim();
    if (sName) {
      staffDict[sName] = { id: sId, storeId: sStoreId };
    }
  }

  // 2. むこうのシフト表を開く
  const shiftSs = SpreadsheetApp.openById(SHIFT_SS_ID);
  
  // スマホなどから実行した月（例: 202604）を自動計算してそのシートを探す
  const yyyyMM = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMM');
  let extSheet = shiftSs.getSheetByName(yyyyMM);
  
  // もしそのシート名が存在しなければ、念のため「202604」を探す
  if (!extSheet) {
    extSheet = shiftSs.getSheetByName('202604');
    if (!extSheet) {
      SpreadsheetApp.getUi().alert(`⚠️ シフト表の中に当月（${yyyyMM}）のシートが見つかりません。`);
      return;
    }
  }

  const extData = extSheet.getDataRange().getValues();
  
  const myShiftSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('シフト表');
  myShiftSheet.clear();
  
  // 3. ヘッダーを生成 (元のC列以降をシフト配列とする)
  const headerRows = [];
  if (extData.length >= 3) {
    headerRows.push(['', '', '', ''].concat(extData[0].slice(2))); 
    headerRows.push(['店舗', '店舗ID', 'スタッフID', '名前'].concat(extData[1].slice(2))); 
    headerRows.push(['', '', '', ''].concat(extData[2].slice(2))); 
  }
  myShiftSheet.getRange(1, 1, headerRows.length, headerRows[0].length).setValues(headerRows);
  myShiftSheet.getRange(1, 1, 3, 4).setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
  
  // 4. データ行の処理（名前をキーにしてガッチャンコ）
  const outputRows = [];
  // 4行目(インデックス3)以降にスタッフデータがあると想定
  for (let i = 3; i < extData.length; i++) {
    const rawName = String(extData[i][1] || '').trim(); // B列が名前
    const cleanName = rawName.replace(/\s+/g, '');
    
    if (cleanName) {
      const match = staffDict[cleanName];
      
      // 未登録の人物（スタッフ一覧にいない人）はここで除外（省く）
      if (!match) continue;
      
      const storeId = match.storeId;
      const staffId = match.id;
      
      const row = ['', storeId, staffId, rawName].concat(extData[i].slice(2));
      outputRows.push(row);
    }
  }
  
  if (outputRows.length > 0) {
    // 1. ダッシュボード（AppB自身）への表示
    myShiftSheet.getRange(4, 1, outputRows.length, outputRows[0].length).setValues(outputRows);
    
    myShiftSheet.getFilter() && myShiftSheet.getFilter().remove();
    myShiftSheet.getRange(2, 1, myShiftSheet.getLastRow() - 1, myShiftSheet.getLastColumn()).createFilter();
    
    // 2. メインシステム（AppA）への逆流・同期
    try {
      let aShiftDb = mainSs.getSheetByName('シフトDB');
      if (!aShiftDb) aShiftDb = mainSs.insertSheet('シフトDB');
      aShiftDb.clear();
      
      // AppAにも同じヘッダーとデータを書き込む
      aShiftDb.getRange(1, 1, headerRows.length, headerRows[0].length).setValues(headerRows);
      aShiftDb.getRange(1, 1, 3, 4).setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
      aShiftDb.getRange(4, 1, outputRows.length, outputRows[0].length).setValues(outputRows);
    } catch (e) {
      SpreadsheetApp.getUi().alert('⚠️ ダッシュボードには同期されましたが、アプリAへの逆同期でエラーが発生しました: ' + e.message);
      return;
    }
  }
  
  SpreadsheetApp.getUi().alert('✅ 外部シフト表から名前で照合し、「未登録」を除外した上で完璧に結合しました！\n（さらに、メインシステムの「シフトDB」にも逆送・同期されました）');
}

/**
 * QRコードURLの自動生成
 */
function generateQRUrls() {
  let url = APP_A_WEB_URL;
  if (!url || url.includes('入力')) {
    const res = SpreadsheetApp.getUi().prompt('アプリAの「ウェブアプリURL」を入力してください\n例：https://script.google.com/macros/s/.../exec');
    if (res.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return;
    url = res.getResponseText().trim();
  }
  
  const mainSs = SpreadsheetApp.openById(MAIN_DB_ID);
  const staff = mainSs.getSheetByName('スタッフ一覧').getDataRange().getValues().slice(1);
  const stores = {}; staff.forEach(r => { if(r[6]) stores[r[6]] = r[2]; });
  
  const qrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QRコード一覧');
  qrSheet.clear(); qrSheet.appendRow(['店舗', '種別', 'URL', 'QR画像URL']);
  qrSheet.getRange(1, 1, 1, 4).setBackground('#555').setFontColor('white').setFontWeight('bold');
  
  Object.entries(stores).forEach(([sid, sn]) => {
    ['work_in', 'car_out', 'car_in'].forEach(type => {
      const label = {work_in:'出勤', car_out:'出庫', car_in:'帰庫'}[type];
      const target = `${url}?type=${type}&storeId=${sid}`;
      const img = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(target)}`;
      qrSheet.appendRow([`${sn} (${sid})`, label, target, img]);
    });
  });
  SpreadsheetApp.getUi().alert('✅ 各店舗用の打刻URLとQRリンクを生成しました。');
}

/**
 * カスタムメニュー
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⏱ 管理・集計')
    .addItem('🔧 初期セットアップ', 'setupB')
    .addItem('🔄 スタッフをシフト表に同期', 'syncStaffToShift')
    .addItem('📥 外部シフト表から一括同期', 'syncExternalShift')
    .addSeparator()
    .addItem('📊 最新データに一括更新', 'updateDashboard')
    .addSeparator()
    .addItem('🔗 QRコードURLを生成', 'generateQRUrls')
    .addToUi();
}
