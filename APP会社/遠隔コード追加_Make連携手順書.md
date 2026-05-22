# 遠隔コード追加 メイク（Make.com）連携手順書

作成日: 2026-05-22
対象: KCS合同会社 ディスコード → ローカルPC 遠隔コード追加機能

---

## 全体の仕組み

```
スマホ Discord（#code-inbox チャンネルにコードを投稿）
  ↓ Watch Messages（Make.com）
Make.com Scenario 1（既存のシナリオを拡張）
  ↓ HTTP POST
GAS doPost → handleRemoteCodeInbox()
  ↓ 実務タスク管理シートに save_code を登録
  ↓ Discord に「📥 受信完了」の確認メッセージを返信
ローカルブリッジ（kcs-agency-bridge.mjs）
  ↓ ポーリングで save_code タスクを検知
  ↓ code_inbox/ フォルダにファイルとして保存
ローカルPC（code_inbox/ フォルダにコードが到着！）
```

**GAS側・ブリッジ側のコードは実装済みです。**
Make.comの既存シナリオの設定を1箇所だけ変更するだけで完成します。

---

## 事前準備（5分）

### 1. ディスコードにチャンネルを作成

1. ディスコードアプリ（PC版またはスマホ版）を開く
2. KCS合同会社のサーバーで「＋」→「テキストチャンネル」→ チャンネル名: `code-inbox`
3. 作成したチャンネルを右クリック →「チャンネルIDをコピー」

### 2. チャンネルIDをスプレッドシートに設定

1. KCS合同会社のデータベーススプレッドシートを開く
2. 「設定」シートの一番下を確認
3. `CODE_INBOX_CHANNEL_ID` の行が無ければ新しい行に追加:

| 項目 | 値 | 説明 |
|---|---|---|
| `CODE_INBOX_CHANNEL_ID` | （コピーした数字を貼り付け） | 遠隔コード追加用ディスコードチャンネルID |

> **ヒント**: setupKCS() を GAS エディタで実行すれば、この行は自動追加されます。

---

## Make.com の設定変更

### 既存の「Scenario 1」を拡張する方法

既存の「KCS Discord → GAS 中継」シナリオは、KCS本部チャンネルを監視しています。
**#code-inbox チャンネルも同じシナリオで監視する方法**を説明します。

#### 方法A: 既存のWatch Messagesモジュールにチャンネルを追加（推奨）

1. Make.com → Scenarios → `KCS Discord → GAS 中継` を開く
2. 「Discord - Watch Messages」モジュールをクリック
3. **Channel** の設定を確認
4. もし「Select channels」のような複数選択が可能であれば、`#code-inbox` のチャンネルIDを追加
5. 「Save」

> **注意**: Make.comのDiscordモジュールが1チャンネルしか監視できない場合は、以下の「方法B」を使用してください。

#### 方法B: Router（ルーター）を追加して2チャンネルを1シナリオで処理

1. Make.com → Scenarios → `KCS Discord → GAS 中継` を開く
2. 「Discord - Watch Messages」モジュールの Channel を **空（全チャンネル）** に変更
   - または、DiscordのBot設定で特定チャンネルのみにBotの読み取り権限を付与
3. フィルターの条件に、チャンネルIDによる分岐は不要（GAS側で自動判定するため）
4. 既存のHTTP POSTモジュールがそのまま動作

**つまり、既存シナリオの Watch Messages の Channel 設定を「全チャンネル監視」または「code-inbox を追加」するだけで完了します。**

> GAS側の `handleDiscordMessageFromMake()` が `channelId` を見て `CODE_INBOX_CHANNEL_ID` と一致するかを自動判定するため、Make.com側に特別なロジックは不要です。

---

## 使い方

### スマホからコードを送信する方法

ディスコードの `#code-inbox` チャンネルに、以下のような形式でメッセージを送信するだけです。

#### 例1: ファイル名を指定して送信

```
// filename: hello_world.js
console.log("こんにちは！遠隔コード追加テスト");

function greet(name) {
  return `ようこそ、${name}さん！`;
}
```

→ ローカルPCの `code_inbox/hello_world.js` に保存されます。

#### 例2: ファイル名を省略して送信

```
これは新しい機能のアイデアメモです。
ログイン画面にソーシャルログイン（Google/Apple）を追加したい。
デザインは既存のログインフォームの下にボタンを2つ並べる形で。
```

→ ローカルPCの `code_inbox/code_20260522_143500.txt` のような日付付きファイルに保存されます。

#### 例3: パイソン（Python）スクリプトを送信

```
# filename: data_analysis.py
import pandas as pd

df = pd.read_csv("sales_data.csv")
print(df.describe())
```

→ ローカルPCの `code_inbox/data_analysis.py` に保存されます。

---

## 動作確認チェックリスト

- [ ] ディスコードに `#code-inbox` チャンネルを作成
- [ ] チャンネルIDをスプレッドシートの設定シートに入力
- [ ] GASの最新版をデプロイ済み
- [ ] Make.comのシナリオで `#code-inbox` チャンネルも監視対象に設定
- [ ] テスト送信: `#code-inbox` に「// filename: test.js」付きのコードを送信
- [ ] ディスコードに「📥 遠隔コードを受信しました！」の返信が来ることを確認
- [ ] ローカルPCの `code_inbox/test.js` にファイルが生成されていることを確認

---

## よくあるエラーと対処

### ディスコードに返信が来ない

→ Make.comのシナリオがONになっているか確認
→ Make.comの実行履歴（History）でエラーが出ていないか確認

### 返信は来るがローカルにファイルが保存されない

→ ローカルブリッジ（`kcs-agency-bridge.mjs`）が起動しているか確認
```bash
node kcs-agency-bridge.mjs
```
→ ブリッジの出力に「📥 遠隔コード保存を開始します...」が表示されるか確認

### ファイル名が文字化けする

→ ファイル名に日本語や特殊文字を使わず、半角英数字とアンダースコアのみを使用してください
