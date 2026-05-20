# 🤖 Claude Code専用指示書 — ローカルブリッジ（kcs-agency-bridge.mjs）拡張タスク

このドキュメントは、Claude Code（またはVSCode上のClaude）が、KCS合同会社のローカルPC常駐ブリッジスクリプトである `kcs-agency-bridge.mjs` を拡張し、**「Sharpによる画像カルーセルの自動合成」**および**「FFmpegによるショート動画の自動合成（STEP 3）」**を完璧に実装・検証するための専用開発指示書です。

---

## 🎯 開発の目的 ＆ ゴール

Xの2026年最新アルゴリズムは、文字だけの投稿を「AIスロップ（ゴミ）」として低評価し、動画（30-90秒）や画像カルーセル（3-5枚）を添付した投稿を圧倒的に優遇します。
本タスクでは、AIが生成したテキスト情報から、**ローカルPCのパワーを用いて自動的にグラフィカルな画像や紹介動画を生成するエンジン**を `kcs-agency-bridge.mjs` 内に構築します。

---

## 📂 1. 開発環境のセットアップ（インストールコマンド）

まずはターミナルから以下のパッケージをインストールし、画像・動画処理の基盤を整えてください。

```bash
# プロジェクトのルート（c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\APP会社）で実行
npm install sharp fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

> [!NOTE]
> **Windows環境におけるFFmpegの取り扱い:**  
> Windows上での動作を保証するため、グローバルなFFmpegのパスを設定するのではなく、`@ffmpeg-installer/ffmpeg` を用いて、Node.js実行時に自動でバイナリパスを読み込む実装にしてください。

---

## ⚙️ 2. 実装対象ファイルと構造

*   **対象ファイル**: [kcs-agency-bridge.mjs](file:///c:/Users/kenny/.gemini/antigravity/scratch/attendance_app/APP%E4%BC%9A%E7%A4%BE/kcs-agency-bridge.mjs)
*   **追加モジュールインポート**:
    ```javascript
    import sharp from 'sharp';
    import ffmpeg from 'fluent-ffmpeg';
    import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
    
    // Windows対応のバイナリパス登録
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ```

---

## 🛠️ 3. 具体的な実装仕様 ＆ ガイドライン

### 🖼️ ① Sharpによる「図解カルーセル（スライド画像）」の自動生成
*   **タスクタイプ名**: `'image_synthesis'`
*   **入力形式 (JSON)**:
    ```json
    {
      "theme": "ガジェット紹介",
      "slides": [
        { "title": "フックタイトル", "body": "読者の興味を引く課題提起..." },
        { "title": "商品の価値・メリット", "body": "ここが凄い！3つのポイント..." },
        { "title": "具体的な機能", "body": "スペックや実際の使用感..." },
        { "title": "行動喚起 (CTA)", "body": "詳細はリプ欄から無料プレゼント配信中！" }
      ]
    }
    ```
*   **描画仕様 (Sharp)**:
    *   **サイズ**: 1080x1080px (1:1 スクエアサイズ)
    *   **背景デザイン**: 単調な白や赤はNG。Obsidianナレッジの『Rich Aesthetics』に従い、**洗練されたダークグレー（#121212）からディープネイビー（#0A1128）への滑らかなグラデーション**をSVGで作成してSharpに読み込ませる。
    *   **フォント**: Windows標準の `Yu Gothic` または `Meiryo` を使用。
    *   **レイアウト**: タイトルは32px（ゴールドかネオンブルーの文字色強調）、本文は20px（清潔感のあるホワイト）でバランスよく中央揃え。フッターに「KCS AI Agent System」の透かしロゴを入れる。
    *   **出力**: `temp_media/image_slide_01.png`〜`04.png` として保存。

### 🎬 ② FFmpegによる「ショート動画（解説スライド動画）」の自動合成
*   **タスクタイプ名**: `'video_synthesis'`
*   **処理仕様**:
    *   上記で生成したカルーセル画像（PNG）を入力ソースとする。
    *   各スライドを約7秒間表示し、スライド間にフェードイン・フェードアウトのトランジション（動画効果）を挟み込む。
    *   バックグラウンドに流す著作権フリーのBGM（プロジェクトフォルダ内に配置可能な短いMP3）をループで合成する（音声データがある場合はそれをオーバーレイする）。
    *   **動画仕様**: 解像度1080x1080px（または9:16縦長）、フレームレート30fps、H.264/AACコーデックのWEB安全再生対応MP4。
    *   **出力**: `temp_media/final_short_video.mp4` として保存。

---

## 💾 4. Googleドライブへの自動アップロード ＆ GAS連携

1.  画像または動画が完成したら、既存のブリッジ関数 `upload_to_drive` (またはそれに準ずるGoogle APIsトークン処理) を利用して、ファイルを特定の共有フォルダー（社長のGoogleドライブ）へアップロードする。
2.  アップロードが成功したら、GASへ `callback_media_url`（タスク完了報告）のリクエストを送り、生成した画像・動画の「Drive公開URL」をGAS側の投稿キューに書き込む。

---

## 🧪 5. Claudeによるローカル単体テストの実行

コードを書き換えたら、GASのポーリングを待たずに、**ローカル環境で直接合成ロジックが動くか検証用のスクリプトを実行**してください。

1.  テスト用のJSONファイル `test_media_task.json` を作成する。
2.  `node kcs-agency-bridge.mjs --test-media` のようなテスト用引数を追加し、画像と動画が `temp_media/` フォルダの中に正しく出力され、文字化けやレイアウト崩れがないかをPC上で確認してください。

---

## ⚠️ Claude用・絶対厳守ルール
- **GASのコードは編集しない**: GASバックエンドのロジック（データベースやリプライ処理）はGeminiが担当します。Claudeは100%ローカルPCのブリッジスクリプトに集中してください。
- **エラー処理の徹底**: FFmpegやSharpは、Windowsの環境変数やパスの書き方によって実行時エラーが起きやすいモジュールです。エラー発生時は必ず `try-catch` で捕捉し、エラー原因を `console.error` に美しく整形して出力してください。

*作成日: 2026-05-17 — KCS合同会社 AIアーキテクト（Antigravity）*
