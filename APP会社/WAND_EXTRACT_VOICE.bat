@echo off
chcp 65001 > nul
title 🎙️ HAL VOICE EXTRACTOR - ONE-CLICK AUTO RUN 🎙️

echo ==================================================================
echo 🎙️ HAL 音声自動抽出（ウィンター × 河北彩伽） — 一撃スタート 🚀
echo ==================================================================
echo.
echo 社長、Downloadsフォルダにある２本の動画から、
echo イレブンラボ（ElevenLabs）用の神ボイス素材（MP3）を自動切り出しします...
echo.
node extract_voice.js
echo.
echo ==================================================================
echo 🎉 音声抽出がすべて完了しました！
echo 生成された「winter_voice.mp3」と「ayaka_voice.mp3」は、
echo 同じフォルダ内の「public」フォルダに保存されています！
echo ==================================================================
echo.
pause
