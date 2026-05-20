# /obsidian-save [タイトル] — メモをObsidian KCS Vaultに保存

引数でファイルタイトルを受け取り、以下を実施してください：

1. 保存先: `D:\kenny\Documents\KCS\[カテゴリ]\[タイトル].md`
   - カテゴリは内容に応じて自動判断: `プロジェクト`, `AIチャット`, `ミーティング`, `アイデア`, `タスク`
2. Markdownフォーマットで以下を含める：
   ```
   ---
   date: YYYY-MM-DD
   tags: [関連タグ]
   ---
   # タイトル
   
   （内容）
   ```
3. 保存完了後に `obsidian://open?vault=KCS&file=[ファイルパス]` 形式のURLを表示

引数なしの場合は会話内容のサマリーをタイトル自動生成して保存する。

Vault場所: `D:\kenny\Documents\KCS`
