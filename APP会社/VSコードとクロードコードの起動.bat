@echo off
chcp 65001 > nul
echo ====================================================
echo 🚀 ブイエスコードとクロードコード、常駐ブリッジを起動します
echo ====================================================
cd /d "c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\APP会社"

:: 常駐ブリッジシステムを別ウィンドウで起動（自動ポーリング監視用）
start "ケーシーエス・ブリッジ常駐システム" cmd /k "node kcs-agency-bridge.mjs"

:: ブイエスコードを起動
start "" code .
exit
