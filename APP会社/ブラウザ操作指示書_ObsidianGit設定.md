# Obsidian Git 設定指示書
## GitHub KCS-Vault ↔ Obsidian 自動同期

作成日: 2026-05-13  
所要時間: 約30分

---

## 完成後のイメージ

```
/knowledge コマンド（Discord）
        ↓ GAS が処理・GitHub に保存
GitHub KCS-Vault リポジトリ
        ↓ 5〜10分おきに自動 Pull
Obsidian（PC/スマホ）← ここに届く
        Knowledge/スクショ/スクショ_20260513.md
        Knowledge/メモ/memo_20260513.md
        Daily/2026-05-13_日次レポート.md
        Projects/HAL/投稿ログ/...
```

---

## 事前確認

### PC に Git がインストールされているか確認

PowerShell または コマンドプロンプトを開いて：
```
git --version
```

- `git version 2.x.x` と出れば ✅ → STEP 1 へ
- `'git' は認識されていません` と出たら → 先に Git をインストール

**Git のインストール（必要な場合のみ）**
1. 以下を開く: `https://git-scm.com/download/win`
2. 「Click here to download」でインストーラーをダウンロード
3. インストーラーを実行（全部デフォルトのままで OK）
4. 完了後、PowerShell を**再起動**して `git --version` で確認

---

## STEP 1：GitHub KCS-Vault リポジトリを作成

> すでに作成済みの場合は STEP 2 へ

1. `https://github.com` にログイン

2. 右上「**+**」→「**New repository**」

3. 以下のように設定：

   | 設定項目 | 値 |
   |---|---|
   | Repository name | `KCS-Vault` |
   | Description | KCS合同会社 ナレッジベース |
   | Visibility | **Private** |
   | Add a README file | ✅ チェックを入れる |

4. 「**Create repository**」をクリック

5. 作成後、以下のフォルダを手動で作成（空の README.md をコミット）：
   - `Knowledge/` フォルダ → 中に空ファイルを1つ作って Commit

   > GitHub の「Add file」→「Create new file」→ ファイル名に `Knowledge/.gitkeep` と入力 → Commit

   同様に以下も作成：
   - `Daily/.gitkeep`
   - `Projects/HAL/投稿ログ/.gitkeep`
   - `Projects/HAL/実績ログ/.gitkeep`
   - `Projects/Affiliate/投稿ログ/.gitkeep`

---

## STEP 2：GitHub Personal Access Token を作成

Obsidian が GitHub に書き込むための認証キー。

1. `https://github.com/settings/tokens` を開く

2. 「**Generate new token**」→「**Generate new token (classic)**」

3. 設定：

   | 設定項目 | 値 |
   |---|---|
   | Note | Obsidian KCS-Vault |
   | Expiration | **No expiration**（期限なし） |
   | Scope | **repo** にチェック（上から4つ目） |

4. 「**Generate token**」をクリック

5. 表示されたトークン（`ghp_xxxx...`）を**今すぐコピーしてメモ帳に貼り付け**  
   ⚠️ このページを閉じると二度と表示されない

> **同時に GAS 設定シートにも追加**  
> GAS スプレッドシート → 設定シート → `GITHUB_TOKEN` 行に貼り付け

---

## STEP 3：Obsidian をインストール（未インストールの場合）

1. `https://obsidian.md` を開く
2. 「Download for Windows」でインストーラーをダウンロード
3. インストール → 起動

---

## STEP 4：KCS-Vault を Obsidian の Vault としてセットアップ

**方法：GitHub からクローンして Vault にする**

### 4-1. クローン先フォルダを作成

エクスプローラーで保存場所を決める（例）：
```
C:\Users\kenny\ObsidianVaults\KCS-Vault
```

### 4-2. PowerShell でクローン

PowerShell を開いて以下を実行（`ユーザー名` と `TOKEN` を置き換える）：

```powershell
cd C:\Users\kenny\ObsidianVaults
git clone https://TOKEN@github.com/ユーザー名/KCS-Vault.git
```

> 例：`git clone https://ghp_abc123@github.com/kenny1102/KCS-Vault.git`

### 4-3. Obsidian で Vault として開く

1. Obsidian を起動
2. 「**Open folder as vault**」をクリック
3. 先ほどクローンしたフォルダ（`C:\Users\kenny\ObsidianVaults\KCS-Vault`）を選択
4. 「**信頼する**」を選択

---

## STEP 5：Obsidian Git プラグインをインストール

1. Obsidian 左下の歯車アイコン「**設定**」を開く

2. 左メニュー「**コミュニティプラグイン**」をクリック

3. 「**コミュニティプラグインを有効化**」→「**OK**」

4. 「**閲覧**」ボタンをクリック

5. 検索バーに `Obsidian Git` と入力

6. 「**Obsidian Git**」（作者: Vinzent03）を選択 →「**インストール**」→「**有効化**」

---

## STEP 6：Obsidian Git の設定

1. 設定 → 左メニュー最下部「**Obsidian Git**」を選択

2. 以下のように設定：

   ### Backup（自動 Push）
   | 設定 | 値 |
   |---|---|
   | Vault backup interval (minutes) | `0`（手動のみ・自動Pushは不要） |
   | Auto pull interval (minutes) | `10`（10分おきに自動Pull） |
   | Pull updates on startup | **ON** |
   | Push on backup | OFF |

   ### Commit Message
   | 設定 | 値 |
   |---|---|
   | Commit message | `vault backup: {{date}}` |
   | Date format | `YYYY-MM-DD HH:mm` |

   ### GitHub Authentication（認証）
   | 設定 | 値 |
   |---|---|
   | Username | GitHub のユーザー名 |
   | Password / Token | STEP 2 で作成したトークン（`ghp_xxx`） |

3. 設定画面を閉じる

---

## STEP 7：動作確認

### テスト1：手動 Pull が動くか確認

1. Obsidian 左リボン（左端のアイコン列）に「Source control（時計マーク）」が追加されている
2. そのアイコンをクリック → 右パネルが開く
3. 「**Pull**」ボタンをクリック
4. エラーなく完了すれば ✅

### テスト2：Discord → Obsidian の全体フロー確認

1. Discord で以下を実行：
   ```
   /knowledge memo:これはObsidian連携テストです
   ```

2. 約1分後に Discord に「📚 ナレッジメモを保存しました」と届く

3. Obsidian で「Pull」を実行

4. 左のファイルツリーに `Knowledge/メモ/memo_YYYYMMDD_HHMMSS.md` が現れれば ✅

5. そのファイルを開くとメモ内容が確認できる

---

## スマホでも見たい場合（iSH / Obsidian for iOS/Android）

Obsidian のモバイルアプリでも Obsidian Git は動きます。

1. スマホに Obsidian をインストール
2. 「Open folder as vault」は使えないため、**iCloud / Google Drive 経由**で同期するか  
   モバイル版 Obsidian Git で直接クローンする

> モバイル版の設定は PC 版と同じ手順（Obsidian Git プラグイン → 同じトークンで認証）

---

## 完成後のフォルダ構成（Obsidian 内）

```
KCS-Vault/（Obsidian Vault のルート）
├── Knowledge/
│   ├── スクショ/       ← /knowledge image: で自動追加
│   └── メモ/           ← /knowledge memo: で自動追加
├── Daily/              ← 毎晩20時の日次レポートが自動追加
├── Projects/
│   ├── HAL/
│   │   ├── 投稿ログ/   ← /hal コマンドで自動追加
│   │   └── 実績ログ/   ← /approve コマンドで自動追加
│   └── Affiliate/
│       └── 投稿ログ/   ← /sunakkun コマンドで自動追加
└── .obsidian/          ← Obsidian の設定（自動生成）
```

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|---|---|---|
| `git: command not found` | Git 未インストール | 事前確認の Git インストールを実施 |
| `Authentication failed` | Token が間違い | STEP 2 でトークンを再発行して再設定 |
| Pull しても新しいファイルが来ない | GAS の `GITHUB_TOKEN` が未設定 | GAS 設定シートに Token を追加して `setupKCS()` 再実行 |
| `remote: Repository not found` | リポジトリ名 or ユーザー名が違う | クローン URL を再確認 |
| Obsidian Git アイコンが出ない | プラグインが有効化されていない | 設定 → コミュニティプラグイン → Obsidian Git → 有効化 |

---

## チェックリスト

- [ ] Git インストール確認（`git --version`）
- [ ] GitHub KCS-Vault リポジトリ作成
- [ ] フォルダ構成（Knowledge/ Daily/ Projects/）を GitHub 上に作成
- [ ] Personal Access Token 作成（`ghp_xxx`）& メモ帳に保存
- [ ] GAS 設定シートの `GITHUB_TOKEN` に貼り付け
- [ ] PowerShell でクローン完了
- [ ] Obsidian で Vault として開く
- [ ] Obsidian Git プラグインをインストール・有効化
- [ ] Auto pull 10分に設定
- [ ] Pull テスト成功
- [ ] `/knowledge memo:テスト` → Obsidian に届くことを確認

---

*作成: 2026-05-13*
