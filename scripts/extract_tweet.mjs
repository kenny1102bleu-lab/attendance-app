/**
 * GAS レスポンスからツイートテキストを抽出する
 * 使用法: echo "$GAS_RESPONSE" | node scripts/extract_tweet.mjs
 *
 * 対応フォーマット:
 * - generateSunakkunPost: {ok, post:{post, hashtags}, postId}
 * - generateHALPost:      {ok, patterns:{pattern1, hashtags}, postId}
 * - 二重JSONエンコード対応
 */

let data = '';
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(data);

    // あらゆるJSONネスト・二重エンコードに対応してテキストを抽出
    function deepExtract(val) {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        // オブジェクトの場合は post または pattern1 フィールドを探す
        if (val.post) return deepExtract(val.post);
        if (val.pattern1) return deepExtract(val.pattern1);
        return '';
      }
      const s = String(val).trim();
      if (!s) return '';
      // JSON文字列の場合は再パースを試みる
      if (s.startsWith('{') || s.startsWith('[')) {
        try {
          const inner = JSON.parse(s);
          if (inner.post) return deepExtract(inner.post);
          if (inner.pattern1) return deepExtract(inner.pattern1);
        } catch (e) {
          // パース失敗 → 正規表現で "post": "value" を抽出（末尾の閉じ括弧がない不完全JSONにも対応）
          // パターン1: 通常の完全なJSON文字列
          const m1 = s.match(/"post"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (m1) return m1[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
          // パターン2: 不完全JSON（末尾の " や } がない）→ "post": "以降すべてを取得
          const m2 = s.match(/"post"\s*:\s*"([\s\S]+)/);
          if (m2) {
            let text = m2[1];
            // 末尾の不要な文字（`"` やスペース）をトリム
            text = text.replace(/["\s]+$/, '');
            return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
          }
        }
      }
      return s;
    }

    let text = '';
    let hashtags = [];

    if (j.post && j.post.post !== undefined) {
      // generateSunakkunPost 形式: {ok, post:{post, hashtags, link}, postId}
      text = deepExtract(j.post.post);
      hashtags = Array.isArray(j.post.hashtags) ? j.post.hashtags : [];
    } else if (j.patterns && j.patterns.pattern1) {
      // generateHALPost 形式: {ok, patterns:{pattern1,...,hashtags}, postId}
      text = deepExtract(j.patterns.pattern1);
      hashtags = Array.isArray(j.patterns.hashtags) ? j.patterns.hashtags : [];
    }

    // ハッシュタグを結合
    if (hashtags.length > 0 && text) {
      text += '\n\n' + hashtags.join(' ');
    }

    process.stdout.write(text || '');
  } catch (e) {
    process.stdout.write('');
  }
});
