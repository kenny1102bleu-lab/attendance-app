# /new-card [機能名] — 新しいカード＋ビューを追加

引数で機能名を受け取り、以下を自動で実施してください：

1. `src/views/[機能名]View.jsx` を作成（XView.jsx をテンプレートとして使用）
2. `src/views/HomeView.jsx` の「⚡ 今すぐアクション」セクションに stack-card を1枚追加
3. `src/App.jsx` に import と view ルート（`{view === '[機能名]' && <[機能名]View ... />}`）を追加
4. `npm run build` でエラーがないか確認
5. CLAUDE.md の「実装済み」リストに追記

テンプレート参考: `src/views/XView.jsx`
