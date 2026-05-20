# /discord-send [メッセージ] — Discord KCS サーバーに通知を送る

引数のメッセージをDiscordに送信してください：

```bash
echo '{"content":"[メッセージ内容]"}' | curl -s -X POST "$DISCORD_WEBHOOK" -H "Content-Type: application/json" -d @-
```

メッセージなしで呼ばれた場合は、直近の作業サマリーを自動生成して送信する。

例：
- `/discord-send デプロイ完了 🚀` → Discordに通知
- `/discord-send` → 今の作業内容をまとめて送信

Webhook URL は環境変数 `DISCORD_WEBHOOK` に設定済み。
