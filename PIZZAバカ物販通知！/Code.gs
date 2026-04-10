// ===================================================
// ECサイト在庫監視＆LINE通知アプリ (Code.gs)
// ===================================================

/**
 * 初回セットアップ（シート作成）
 */
function setupApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 設定シート
  let setting = ss.getSheetByName('設定');
  if (!setting) {
    setting = ss.insertSheet('設定');
    setting.getRange('A1:B1').setValues([['項目', '値']]).setBackground('#333').setFontColor('#fff').setFontWeight('bold');
    setting.getRange('A2:B3').setValues([
      ['LINE_ACCESS_TOKEN', '2CuLtJ+gWpNtdhDoQ3RtOpb/ocLZnDnSLlQorajCfGI156pL38nWCrzmMtQx8NKzW2UJQ4RmLGkctGX+XxQdNL0CgaMI/e2NdWxg/3Wlaz+6F8YlIOWHA4vLb7qz+nQHmsXymXabTibhs6fh5c1uoQdB04t89/1O/w1cDnyilFU='],
      ['LINE_USER_ID', 'U147c84f2a939ddc9657661159ee116f5']
    ]);
    setting.setColumnWidth(1, 150);
    setting.setColumnWidth(2, 400);
  }

  // 2. 対象サイトシート（NEW）
  let siteSheet = ss.getSheetByName('対象サイト');
  if (!siteSheet) {
    siteSheet = ss.insertSheet('対象サイト');
    siteSheet.getRange('A1:C1').setValues([['サイト名', 'URL', 'システム(種類)']])
             .setBackground('#333').setFontColor('#fff').setFontWeight('bold');
    siteSheet.getRange('A2:C3').setValues([
      ['PIZZA OF DEATH', 'https://pizzaofdeath.shop13.makeshop.jp', 'MakeShop'],
      ['Hi-STANDARD', 'https://hi-standard-store.jp/', 'ColorMeShop']
    ]);
    
    // システムのプルダウンを作成
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['MakeShop', 'ColorMeShop'], true).build();
    siteSheet.getRange('C2:C100').setDataValidation(rule);
    
    siteSheet.setColumnWidth(1, 150);
    siteSheet.setColumnWidth(2, 350);
    siteSheet.setColumnWidth(3, 150);
  }

  // 3. 監視データシート
  let dataSheet = ss.getSheetByName('監視データ');
  if (!dataSheet) {
    dataSheet = ss.insertSheet('監視データ');
    dataSheet.getRange('A1:F1').setValues([['サイト名', '商品ID', '商品名', 'URL', '在庫状況', '最終確認日時']])
             .setBackground('#333').setFontColor('#fff').setFontWeight('bold');
  }

  SpreadsheetApp.getUi().alert('✅ セットアップが完了しました。\n「設定」を入力し、「対象サイト」シートから自由にURLを追加・編集できます。');
}

/**
 * カスタムメニューの追加
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🛍️ 監視システム')
    .addItem('1. セットアップ実行', 'setupApp')
    .addSeparator()
    .addItem('2. 監視を手動実行', 'runMonitor')
    .addItem('3. 定期監視トリガーを設定（30分毎）', 'setMonitorTrigger')
    .addSeparator()
    .addItem('4. 【テスト】8秒間隔で連続監視実行', 'testMonitorLoop')
    .addSeparator()
    .addItem('🧪 LINEテスト送信', 'testLine')
    .addToUi();
}

/**
 * 監視の定期実行トリガー設定
 */
function setMonitorTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let t of triggers) {
    if (t.getHandlerFunction() === 'runMonitor') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('runMonitor').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('✅ 5分ごとの定期監視をセットしました。');
}

/**
 * 設定の取得
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

// ===================================================
// 監視メインロジック
// ===================================================

/**
 * 監視の実行（トリガーからも呼ばれる）
 */
function runMonitor() {
  console.log('監視を開始します...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('監視データ');
  const siteSheet = ss.getSheetByName('対象サイト');
  
  if (!dataSheet || !siteSheet) {
    console.error('必要なシートがありません。セットアップメニューを実行してください。');
    return;
  }

  // 1. 各サイトから最新の商品情報を取得
  const siteData = siteSheet.getDataRange().getValues();
  let currentItems = [];
  
  for (let i = 1; i < siteData.length; i++) {
    const siteName = siteData[i][0];
    const baseUrl = siteData[i][1];
    const platform = siteData[i][2];
    
    if (!siteName || !baseUrl) continue;
    
    console.log(`[取得開始] ${siteName}`);
    if (platform === 'MakeShop') {
      currentItems = currentItems.concat(fetchMakeShop(siteName, baseUrl));
    } else if (platform === 'ColorMeShop') {
      currentItems = currentItems.concat(fetchColorMeShop(siteName, baseUrl));
    } else {
      console.log(`未対応のシステム: ${platform}`);
    }
  }

  console.log(`取得完了: 合計 ${currentItems.length} 件`);

  // 2. 過去のデータを読み込み
  const previousData = dataSheet.getDataRange().getValues();
  // idをキーにして過去のステータスをマップにする
  const prevMap = {};
  for (let i = 1; i < previousData.length; i++) {
    const row = previousData[i];
    const uid = String(row[0]) + '_' + String(row[1]); // サイト名_商品ID
    prevMap[uid] = {
      status: row[4], // 在庫状況 (true: あり, false: なし)
      name: row[2]
    };
  }

  // 3. 変化をチェックして通知
  const now = new Date();
  
  for (let item of currentItems) {
    const uid = item.site + '_' + item.id;
    const prev = prevMap[uid];

    if (!prev) {
      // 過去データにない（完全な新着）
      notifyUsers(item.url, item.name, item.site, item.url, 'new');
    } else {
      // 過去データに存在（在庫状況の比較）
      const wasInStock = prev.status === true || prev.status === 'true' || prev.status === 'あり';
      const isInStock = item.inStock;

      if (!wasInStock && isInStock) {
        // 在庫なし -> 在庫あり（再入荷）
        notifyUsers(item.url, item.name, item.site, item.url, 'restock');
      }
    }
  }

  // 4. 最新データでシートを上書き
  if (previousData.length > 1) {
    dataSheet.getRange(2, 1, previousData.length - 1, 6).clearContent();
  }
  
  if (currentItems.length > 0) {
    const newRows = currentItems.map(item => [
      item.site,
      item.id,
      item.name,
      item.url,
      item.inStock ? 'あり' : 'なし',
      now
    ]);
    dataSheet.getRange(2, 1, newRows.length, 6).setValues(newRows);
  }

  // 5. ログ出力（通知はnotifyUsersで各商品検出時に即時送信済み）
  console.log('監視処理が完了しました。');
}

/**
 * 8秒間隔での連続監視（テスト用）
 */
function testMonitorLoop() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert('テスト監視開始', '8秒間隔で監視処理を繰り返します。\n※Google Apps Scriptの実行時間制限（6分）を回避するため、最大で約4.5分ループした後に自動終了します。\n\nテストを開始してもよろしいですか？', ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;

  console.log('8秒ごとの連続テスト監視を開始します。');
  const startTime = Date.now();
  let count = 0;
  
  // 4.5分 (270,000ミリ秒) を超えたら終了する
  while (Date.now() - startTime < 270000) {
    count++;
    console.log(`テスト監視 ${count}回目 実行中...`);
    runMonitor();
    Utilities.sleep(8000); // 8秒待機
  }
  
  console.log('テスト監視を自動終了しました。');
  ui.alert('テスト完了', '指定時間が経過したため、8秒間隔でのテストループを終了しました。', ui.ButtonSet.OK);
}

// ===================================================
// スクレイピング処理
// ===================================================

/**
 * MakeShop系のストアを取得
 */
function fetchMakeShop(siteName, baseUrl) {
  const items = [];
  // 末尾のスラッシュを削除
  let normalizedUrl = baseUrl.replace(/\/$/, "");
  
  try {
    const response = UrlFetchApp.fetch(normalizedUrl, { muteHttpExceptions: true }).getContentText('EUC-JP');
    const blockRegex = /<a href="(\/shopdetail\/[0-9]+.*?)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seenIds = new Set();
    
    while ((match = blockRegex.exec(response)) !== null) {
      const link = match[1];
      const innerHtml = match[2];
      
      const idMatch = link.match(/\/shopdetail\/([0-9]+)/);
      if (!idMatch) continue;
      const itemId = idMatch[1];
      
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
      
      let itemName = "不明な商品";
      const altMatch = innerHtml.match(/alt="([^"]+)"/);
      if (altMatch && altMatch[1]) itemName = altMatch[1].trim();
      
      const isSoldOut = innerHtml.includes('0円') || innerHtml.includes('SOLD OUT') || innerHtml.includes('売り切れ');
      
      items.push({
        site: siteName,
        id: itemId,
        name: itemName,
        url: normalizedUrl + link,
        inStock: !isSoldOut
      });
    }
  } catch (e) {
    console.error(siteName + 'の取得エラー: ' + e.message);
  }
  
  return items;
}

/**
 * ColorMeShop系のストアを取得
 */
function fetchColorMeShop(siteName, baseUrl) {
  const items = [];
  // 末尾のスラッシュを確実に付与（相対パス補完用）
  const basePrefix = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  
  try {
    const response = UrlFetchApp.fetch(baseUrl, { muteHttpExceptions: true }).getContentText('UTF-8');
    const blockRegex = /<a href="([^"]*\?pid=([0-9]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seenIds = new Set();
    
    while ((match = blockRegex.exec(response)) !== null) {
      const link = match[1];
      const itemId = match[2];
      const innerHtml = match[3];
      
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);
      
      let itemName = "不明な商品";
      const altMatch = innerHtml.match(/alt="([^"]+)"/);
      if (altMatch && altMatch[1]) itemName = altMatch[1].trim();
      
      const isSoldOut = innerHtml.includes('SOLD OUT') || innerHtml.includes('売り切れ');
      const fullUrl = link.startsWith('http') ? link : (basePrefix + (link.startsWith('/') ? link.substring(1) : link));

      items.push({
        site: siteName,
        id: itemId,
        name: itemName,
        url: fullUrl,
        inStock: !isSoldOut
      });
    }
  } catch (e) {
    console.error(siteName + 'の取得エラー: ' + e.message);
  }
  
  return items;
}

// ===================================================
// LINE送信処理
// ===================================================

function sendLineMessage(text) {
  const config = getSettings();
  const token = config['LINE_ACCESS_TOKEN'];
  const toUser = config['LINE_USER_ID'];
  
  if (!token || !toUser) {
    console.error('LINEのトークンまたは通知先IDが設定されていません。');
    return;
  }
  
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: toUser,
    messages: [{ type: 'text', text: text }]
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function testLine() {
  sendLineMessage('🟢 [テスト] ECストア監視システムからのテスト通知です。');
  SpreadsheetApp.getUi().alert('テストメッセージを送信しました。LINEをご確認ください。');
}

// ===================================================
// saveAndNotify（個別商品の保存＆通知）
// ===================================================

function saveAndNotify(siteName, url, name, stock) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('監視データ');
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const allData = dataSheet.getDataRange().getValues();
  let existingRow = -1;
  let prevStock = '';

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][1] === url) {
      existingRow = i + 1;
      prevStock = allData[i][3];
      break;
    }
  }

  if (existingRow === -1) {
    dataSheet.appendRow([siteName, url, name, stock, now]);
    Logger.log('初回登録: ' + name);
    if (stock === 'inStock') {
      notifyUsers(url, name, siteName, url, 'new');
      Logger.log('🆕 新着通知: ' + name);
    }
  } else {
    if (prevStock === 'outOfStock' && stock === 'inStock') {
      notifyUsers(url, name, siteName, url, 'restock');
      Logger.log('🔄 在庫復活通知: ' + name);
    }
    dataSheet.getRange(existingRow, 3, 1, 3).setValues([[name, stock, now]]);
  }
}

// ===================================================
// Web API（doGet）
// ===================================================

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getProducts') {
    return ContentService
      .createTextOutput(JSON.stringify(getProductsForWeb()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'checkStock') {
    const url = e.parameter.url;
    // まず監視データシートにキャッシュがあればそれを返す（urlfetchクォータ節約）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dataSheet = ss.getSheetByName('監視データ');
      const allData = dataSheet.getDataRange().getValues();
      for (let i = 1; i < allData.length; i++) {
        if (allData[i][1] === url) {
          return ContentService
            .createTextOutput(JSON.stringify({
              stock: allData[i][3],
              name: allData[i][2],
              checkedAt: allData[i][4],
              cached: true
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    } catch (err) {}
    // キャッシュにない場合のみ実際にfetch
    const result = checkStockForUrl(url);
    // 結果を監視データシートに保存しておく（次回以降キャッシュヒット）
    try {
      if (result.stock !== 'unknown') {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const dataSheet = ss.getSheetByName('監視データ');
        const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        dataSheet.appendRow(['ユーザー追加', url, result.name || url, result.stock, now]);
      }
    } catch (err) {}
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('PIZZA!Hi-STA 在庫通知')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 単一URLの在庫状況をチェック（ユーザー追加商品用）
 */
function checkStockForUrl(url) {
  if (!url) return { stock: 'unknown', name: '', error: 'no url' };
  try {
    let html, encoding = 'UTF-8';
    if (url.indexOf('makeshop.jp') !== -1) {
      encoding = 'EUC-JP';
    }
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    html = response.getContentText(encoding);

    // 商品名を取得（<title>タグまたは<h1>）
    let name = '';
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) name = titleMatch[1].replace(/[\s\S]*?[|｜>].*$/, '').trim() || titleMatch[1].trim();
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();
      if (h1Text) name = h1Text;
    }

    // 在庫判定
    let isSoldOut = false;
    if (url.indexOf('makeshop.jp') !== -1) {
      // PIZZA OF DEATH (MakeShop): 基本は「0円」表示＝在庫切れ、金額表示＝在庫復活
      // 商品詳細ページの価格部分をチェック
      const priceMatch = html.match(/(?:価格|販売価格|通常価格|本体価格)[\s\S]{0,200}?([0-9,]+)\s*円/);
      if (priceMatch) {
        const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        isSoldOut = (price === 0);
      } else if (html.indexOf('0円') !== -1 && html.match(/[1-9][0-9,]*\s*円/) === null) {
        // 価格ラベルが見つからないが0円しかない場合
        isSoldOut = true;
      }
      // 念のためSOLD OUT文言もチェック
      if (html.indexOf('SOLD OUT') !== -1 || html.indexOf('売り切れ') !== -1) {
        isSoldOut = true;
      }
    } else {
      // ColorMeShop等: SOLD OUT文言で判定
      isSoldOut =
        html.indexOf('SOLD OUT') !== -1 ||
        html.indexOf('soldout') !== -1 ||
        html.indexOf('売り切れ') !== -1 ||
        html.indexOf('在庫切れ') !== -1 ||
        html.indexOf('販売終了') !== -1 ||
        /<[^>]*class="[^"]*sold[_-]?out[^"]*"/i.test(html);
    }

    return {
      stock: isSoldOut ? 'outOfStock' : 'inStock',
      name: name,
      checkedAt: new Date().toISOString()
    };
  } catch (err) {
    return { stock: 'unknown', name: '', error: String(err) };
  }
}

function getProductsForWeb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const siteSheet = ss.getSheetByName('対象サイト');
  const siteData = siteSheet.getDataRange().getValues();
  const dataSheet = ss.getSheetByName('監視データ');
  const stockData = dataSheet.getDataRange().getValues();

  const stockMap = {};
  for (let i = 1; i < stockData.length; i++) {
    const url = stockData[i][1];
    stockMap[url] = {
      name:  stockData[i][2],
      stock: stockData[i][3],
      lastChecked: stockData[i][4]
    };
  }

  const products = [];
  for (let i = 1; i < siteData.length; i++) {
    const siteName = siteData[i][0];
    const url      = siteData[i][1];
    const memo     = siteData[i][2];
    if (!url) continue;
    const stockInfo = stockMap[url] || {};
    products.push({
      id:    url,
      name:  stockInfo.name || memo || url,
      shop:  siteName,
      url:   url,
      stock: stockInfo.stock || 'unknown',
      lastChecked: stockInfo.lastChecked || ''
    });
  }
  return products;
}
