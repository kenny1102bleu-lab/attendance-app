/*
// ===================================================
// 勤怠管理アプリ 完全最終版
// 出勤 / 出庫 / 帰庫 + 個数歩合 + 車両レンタル費
// 日次 / 週次・月次+収支レポート 自動集計
// LINE通知：出勤・帰庫のみ
// ===================================================

// ========== ★ 設定（ここだけ変更してください） ==========
const CONFIG = {
  SHEET_STAFF:   'スタッフ一覧',
  SHEET_TIMELOG: '打刻データ',
  SHEET_DAILY:   '日次集計',
  SHEET_SUMMARY: '週次・月次集計',
  SHEET_QR:      'QRコード一覧',
  SHEET_ARRIVAL:    '入荷記録',
  SHEET_CHECK:      '数量確認',
  SHEET_TRACKING:   '不在追跡記録', // ★ 追加

  LINE_CHANNEL_ACCESS_TOKEN: 'rbE8q9ps+rtcBba5NT3PVpskKB4I4NkboyGW8KK4WtbZyWEyzIpT9LBKfVxkQAWyK9DT6W6YshheHDEsB7rMIObAtosh4Tm4wMBlIUu7vyVzEL+1IsZE4ka84IRK6anq2C6HWC/T4t8WExSQTv6IWwdB04t89/1O/w1cDnyilFU=',

  COMPANY_NAME:         '株式会社〇〇',
  PDF_FOLDER_NAME:      '稼動報告書',

  RENTAL_RATE_PER_HOUR: 120,
  AUTO_UPDATE_HOUR:      23,
  ARRIVAL_ASK_HOURS:  [9, 20],   // ★ 9:00(回収要請), 20:00(荷物要請)
  INCENTIVE_RATE:     0.04,      // ★ 管理者・ストアオーナーのインセンティブ(4%)

  DELIVERY_REPORT_SS_ID: '1sXnBUNOSost57wb7qf183hw6RnYccDUJpp5YV0C4D3g',
  PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 125, tax: 0.1 } ],
  LABOR_PRICE_TABLE: [ { from: '2000/01/01', unitPrice: 80 } ],
};

... (省略) ...
[略: 1600行以上のコードをコメントアウト]
*/
