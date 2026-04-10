// ===================================================
// アプリC：会社月次報告書 (3_AppC_Reporting.gs)
// ============= 役割 =================================
// ・月次の締め処理と会社提出用の最終報告書生成
// ・ドライバーごとの稼動報告書PDFを一括生成
// ・個別の収支分析（会社への請求額・人件費の対比）
// ===================================================

/**
 * 接続設定：アプリAのスプレッドシートIDを入力してください
 */
const MAIN_DB_ID = 'ここにアプリAのIDを入力してください';

/**
 * 初期セットアップ（アプリC用：月次シートとメニューの作成）
 */
function setupC() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 月次報告まとめシート
  let monthly = ss.getSheetByName('会社提出用月報') || ss.insertSheet('会社提出用月報');
  monthly.clear();
  const mH = ['対象月', 'スタッフ名', '稼動日数', '総個数', '総売上（税込）', '人件費（支払）', 'レンタル費', '差引支給額', '粗利', '利益率'];
  monthly.getRange(1, 1, 1, mH.length).setValues([mH]).setBackground('#b71c1c').setFontColor('white').setFontWeight('bold');
  
  // 2. フォームやボタンの配置（説明用）
  monthly.getRange(3, 1).setValue('【使い方】').setFontWeight('bold');
  monthly.getRange(4, 1).setValue('1. メニューから「稼動報告書PDFを一括生成」を実行');
  monthly.getRange(5, 1).setValue('2. 自動でGoogleドライブにPDFが書き出されます');
  monthly.getRange(6, 1).setValue('3. 同時にこのシートに「会社提出用の数字」が転記されます');

  SpreadsheetApp.getUi().alert('✅ 【アプリC：会社月次報告書】のセットアップが完了しました。');
}

/**
 * 稼動報告書PDFの一括生成 & 月報まとめ更新
 */
function generateMonthlyPDFs() {
  if (!MAIN_DB_ID || MAIN_DB_ID.includes('入力')) {
    SpreadsheetApp.getUi().alert('⚠️ MAIN_DB_ID が設定されていません。'); return;
  }
  
  const mainSs = SpreadsheetApp.openById(MAIN_DB_ID);
  const now = new Date();
  
  // 先月分のデータを対象にする
  let year = now.getFullYear(), month = now.getMonth(); 
  if (month === 0) { month = 12; year--; }
  const label = year + '年' + month + '月';
  
  // 保存先フォルダの用意
  const folder = getFolder('稼動報告書').createFolder(label + '分');
  
  const logs = mainSs.getSheetByName('打刻データ').getDataRange().getValues();
  const staff = mainSs.getSheetByName('スタッフ一覧').getDataRange().getValues().slice(1);
  const carInLogs = logs.filter(r => r[2] === '帰庫');
  
  const monthlySummary = [];
  let count = 0;
  
  staff.forEach(s => {
    const sId = String(s[0]), name = s[1];
    const sLogs = carInLogs.filter(r => {
      const d = new Date(r[5]);
      return String(r[0]) === sId && d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    
    if(sLogs.length === 0) return;
    
    // 集計
    const items = sLogs.reduce((a,b)=>a+(Number(b[6])||0), 0);
    const sales = sLogs.reduce((a,b)=>a+(Number(b[7])||0), 0);
    const labor = sLogs.reduce((a,b)=>a+(Number(b[11])||0), 0);
    const rent  = sLogs.reduce((a,b)=>a+(Number(b[8])||0), 0);
    const net   = labor - rent;
    const profit = sales - labor;
    const profitRate = sales > 0 ? (profit / sales) : 0;
    
    // 月報まとめ用データ
    monthlySummary.push([label, name, '-', items, sales, labor, rent, net, profit, profitRate]);
    
    // PDF生成
    const html = buildHtml(name, label, sLogs, items, sales, labor, rent, net);
    const pdf = convertToPdf(html, name + '_' + label + '_稼動報告書');
    folder.createFile(pdf);
    count++;
  });
  
  // 月報まとめシートへの転記
  const mSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('会社提出用月報');
  if (monthlySummary.length > 0) {
    mSheet.getRange(2, 1, mSheet.getLastRow(), 10).clearContent();
    mSheet.getRange(2, 1, monthlySummary.length, 10).setValues(monthlySummary);
    mSheet.getRange(2, 5, monthlySummary.length, 5).setNumberFormat('¥#,##0');
    mSheet.getRange(2, 10, monthlySummary.length, 1).setNumberFormat('0.0%');
  }
  
  SpreadsheetApp.getUi().alert('✅ ' + count + '名分のPDF生成と、' + label + ' の最終集計が完了しました。');
}

/**
 * 稼動報告書用のHTMLテンプレート
 */
function buildHtml(name, label, logs, items, sales, labor, rent, net) {
  const rows = logs.map(r => `<tr><td>${r[3]}</td><td class="n">${r[6]}</td><td class="n">¥${Number(r[7]).toLocaleString()}</td><td class="n">¥${Number(r[8]).toLocaleString()}</td><td class="n">¥${Number(r[9]).toLocaleString()}</td></tr>`).join('');
  
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:20px;font-size:10pt}h2{color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:15px}th{background:#f0f0f0;padding:8px;border:1px solid #ccc}td{padding:8px;border:1px solid #ccc}.n{text-align:right}.sum{background:#e8f0fe;font-weight:bold}</style></head><body><h2>稼動報告書 (${label})</h2><h3>${name} 様</h3><table><thead><tr><th>日付</th><th>配完個数</th><th>売上(税込)</th><th>レンタル</th><th>差引支給</th></tr></thead><tbody>${rows}<tr class="sum"><td>合計</td><td class="n">${items}</td><td class="n">¥${sales.toLocaleString()}</td><td class="n">¥${rent.toLocaleString()}</td><td class="n">¥${net.toLocaleString()}</td></tr></tbody></table><div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:10px;"><p>💰 <b>差引支給額合計：¥${net.toLocaleString()}</b></p><p style="font-size:9pt; color:#666;">※今月もお疲れ様でした！</p></div></body></html>`;
}

function convertToPdf(html, name) {
  const blob = Utilities.newBlob(html, 'text/html', name + '.html');
  const temp = DriveApp.createFile(blob);
  const pdf = temp.getAs('application/pdf').setName(name + '.pdf');
  temp.setTrashed(true);
  return pdf;
}

function getFolder(name) {
  const iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

/**
 * カスタムメニューの追加
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📄 会社報告・PDF')
    .addItem('🔧 初期セットアップ', 'setupC')
    .addItem('📄 稼動報告書PDFを一括生成(先月分)', 'generateMonthlyPDFs')
    .addToUi();
}
