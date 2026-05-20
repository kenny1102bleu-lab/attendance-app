// GAS_KCS合同会社_Backend.gs の doPost に新しいアクションハンドラを追加するスクリプト
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'GAS_KCS合同会社_Backend.gs';
let content = readFileSync(filePath, 'utf-8');

// 挿入ポイント：X 返信承認待ちキュー取得ブロックの直後
const searchStr = `    if (body.action === 'get_pending_replies') {\r\n      return jsonResponse(getPendingReplies());\r\n    }\r\n\r\n    return jsonResponse({ status: 'ok' });`;

// 見つからなければ \n のみで試す
const searchStrLF = `    if (body.action === 'get_pending_replies') {\n      return jsonResponse(getPendingReplies());\n    }\n\n    return jsonResponse({ status: 'ok' });`;

const newCode = `    if (body.action === 'get_pending_replies') {
      return jsonResponse(getPendingReplies());
    }

    // ── 【自己修復】パッチ承認実行（ディスコードの承認コマンド経由） ──
    if (body.action === 'approve_patch') {
      const patchId = body.patchId || body.patch_id || '';
      if (!patchId) return jsonResponse({ ok: false, error: 'patchId が指定されていません。' });
      const result = executeApprovedPatch(patchId);
      const cfgPatch = getKCSSettings();
      const wbPatch = (() => { try { return JSON.parse(cfgPatch.DISCORD_WEBHOOK_URLS || '{}'); } catch(ep) { return {}; } })();
      const urlPatch = cfgPatch.ERROR_LOG_WEBHOOK_URL || cfgPatch.KCS_HQ_WEBHOOK_URL || wbPatch['KCS本部'] || Object.values(wbPatch)[0];
      if (urlPatch) {
        UrlFetchApp.fetch(urlPatch, {
          method: 'POST', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            content: result.ok
              ? '✅ **自動修復パッチ適用完了！** パッチID: \`' + patchId + '\`\\n' + result.message
              : '❌ **パッチ適用に失敗しました。** パッチID: \`' + patchId + '\`\\n' + result.message,
            username: 'KCSシステムキーパー'
          })
        });
      }
      return jsonResponse(result);
    }

    // ── 【システムメール監視】手動スキャン実行（n8n/Make.com からも呼び出し可能） ──
    if (body.action === 'check_system_emails') {
      checkSystemEmails();
      return jsonResponse({ ok: true, message: 'システムメールのスキャンを実行しました。' });
    }

    // ── 【アフィリエイト遅延リプライ】メイク（Make.com）からの遅延リプライ投稿 ──
    if (body.action === 'post_affiliate_reply') {
      const tweetId = body.tweetId || body.tweet_id || '';
      const replyText = body.replyText || body.reply_text || '';
      const accountReply = body.account || 'sunakun';
      if (!tweetId || !replyText) {
        return jsonResponse({ ok: false, error: 'tweetId と replyText は必須です。' });
      }
      const replyResult = replyToX(tweetId, replyText, accountReply);
      logSnsPost(accountReply, 'X-リプライ', replyText, replyResult.ok ? '投稿済み' : 'エラー');
      return jsonResponse({ ok: replyResult.ok, result: replyResult });
    }

    return jsonResponse({ status: 'ok' });`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, newCode);
  writeFileSync(filePath, content, 'utf-8');
  console.log('✅ doPost への新アクション追加が完了しました（CRLF版）。');
} else if (content.includes(searchStrLF)) {
  const newCodeLF = newCode.replace(/\r\n/g, '\n');
  content = content.replace(searchStrLF, newCodeLF);
  writeFileSync(filePath, content, 'utf-8');
  console.log('✅ doPost への新アクション追加が完了しました（LF版）。');
} else {
  console.error('❌ ターゲット文字列が見つかりませんでした。');
  console.log('--- 576行付近の内容確認 ---');
  const lines = content.split('\n');
  for (let i = 573; i < 582 && i < lines.length; i++) {
    console.log(`L${i+1}: ${JSON.stringify(lines[i])}`);
  }
}
