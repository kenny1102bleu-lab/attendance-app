"""
ファイル自動振り分けプログラム
================================
Cドライブのファイルをファイル種類に応じて
D（写真）、E（動画）、F（その他）ドライブへ自動的に振り分けるプログラムです。

機能:
- ボタンで一括振り分け
- リアルタイム監視で新規ファイルを自動移動
- システムフォルダを保護
"""

import os
import sys
import shutil
import time
import threading
import logging
from pathlib import Path
from datetime import datetime

import tkinter as tk
from tkinter import ttk, messagebox, filedialog

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ==============================================================================
# 設定
# ==============================================================================

# --- ドライブの割り当て ---
DRIVE_IMAGES = "D:\\"   # 写真の移動先
DRIVE_VIDEOS = "E:\\"   # 動画の移動先
DRIVE_OTHERS = "F:\\"   # その他の移動先

# --- 移動先フォルダ名 ---
DEST_FOLDER_IMAGES = "写真"
DEST_FOLDER_VIDEOS = "動画"
DEST_FOLDER_OTHERS = "その他"
DEST_FOLDER_UNCATEGORIZED = "未分類"

# --- 拡張子マッピング ---
IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif",
    ".webp", ".svg", ".ico", ".heic", ".heif", ".raw", ".cr2",
    ".nef", ".arw", ".dng", ".psd", ".ai",
}

VIDEO_EXTENSIONS = {
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm",
    ".m4v", ".mpg", ".mpeg", ".3gp", ".ts", ".vob", ".ogv",
    ".mts", ".m2ts",
}

# --- 保護するシステムフォルダ（Cドライブ内） ---
PROTECTED_FOLDERS = {
    "Windows",
    "Program Files",
    "Program Files (x86)",
    "ProgramData",
    "Recovery",
    "System Volume Information",
    "$Recycle.Bin",
    "$WinREAgent",
    "Boot",
    "EFI",
    "PerfLogs",
    "MSOCache",
    # ユーザーフォルダ内のシステム領域
    "AppData",
    ".vscode",
    ".git",
    ".gemini",
    "node_modules",
    "__pycache__",
    ".cache",
    ".config",
    ".local",
    ".npm",
    ".nuget",
}

# --- 保護するファイルパターン ---
PROTECTED_FILE_PATTERNS = {
    "ntuser.dat", "ntuser.ini", "ntuser.pol",
    "desktop.ini", "thumbs.db", "iconcache.db",
    ".sys", ".dll", ".exe", ".msi", ".bat", ".cmd",
    ".ps1", ".psm1", ".psd1", ".reg",
}

# --- デフォルトの監視対象フォルダ ---
DEFAULT_WATCH_FOLDERS = [
    os.path.expanduser("~\\Downloads"),
    os.path.expanduser("~\\Desktop"),
    os.path.expanduser("~\\Documents"),
    os.path.expanduser("~\\Pictures"),
    os.path.expanduser("~\\Videos"),
    os.path.expanduser("~\\Music"),
]

# ==============================================================================
# ログ設定
# ==============================================================================

log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_dir / "organizer.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)


# ==============================================================================
# ファイル分類・移動ロジック
# ==============================================================================

def classify_file(filepath: str) -> str:
    """ファイルの拡張子からカテゴリを判定する。"""
    ext = Path(filepath).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return "images"
    elif ext in VIDEO_EXTENSIONS:
        return "videos"
    else:
        return "others"


def get_destination(filepath: str) -> str | None:
    """ファイルの移動先パスを返す。None の場合は移動しない。"""
    category = classify_file(filepath)

    if category == "images":
        dest_dir = os.path.join(DRIVE_IMAGES, DEST_FOLDER_IMAGES)
    elif category == "videos":
        dest_dir = os.path.join(DRIVE_VIDEOS, DEST_FOLDER_VIDEOS)
    else:
        dest_dir = os.path.join(DRIVE_OTHERS, DEST_FOLDER_OTHERS)

    return dest_dir


def is_protected(filepath: str) -> bool:
    """ファイルがシステム保護対象かどうかを判定する。"""
    path = Path(filepath)

    # パスにシステムフォルダが含まれるか確認
    parts = path.parts
    for part in parts:
        if part in PROTECTED_FOLDERS:
            return True

    # ファイル名が保護対象パターンに一致するか確認
    filename = path.name.lower()
    for pattern in PROTECTED_FILE_PATTERNS:
        if filename == pattern or filename.endswith(pattern):
            return True

    # 隠しファイル・システムファイルのチェック
    if filename.startswith(".") or filename.startswith("~$"):
        return True

    return False


def safe_move(src: str, dest_dir: str) -> tuple[bool, str]:
    """
    ファイルを安全に移動する。
    重複がある場合はリネームして移動。
    戻り値: (成功フラグ, メッセージ)
    """
    try:
        os.makedirs(dest_dir, exist_ok=True)

        src_path = Path(src)
        dest_path = Path(dest_dir) / src_path.name

        # 重複チェック → リネーム
        if dest_path.exists():
            stem = src_path.stem
            suffix = src_path.suffix
            counter = 1
            while dest_path.exists():
                dest_path = Path(dest_dir) / f"{stem}({counter}){suffix}"
                counter += 1

        shutil.move(str(src_path), str(dest_path))
        msg = f"✅ 移動完了: {src_path.name} → {dest_path}"
        logger.info(msg)
        return True, msg

    except PermissionError:
        msg = f"⚠️ アクセス拒否（使用中の可能性）: {Path(src).name}"
        logger.warning(msg)
        return False, msg
    except Exception as e:
        msg = f"❌ エラー: {Path(src).name} - {e}"
        logger.error(msg)
        return False, msg


def is_file_ready(filepath: str, wait_seconds: float = 1.0) -> bool:
    """ファイルの書き込みが完了しているか確認する。"""
    try:
        initial_size = os.path.getsize(filepath)
        time.sleep(wait_seconds)
        current_size = os.path.getsize(filepath)
        return initial_size == current_size and initial_size > 0
    except (OSError, FileNotFoundError):
        return False


def scan_and_organize(folders: list[str], log_callback=None) -> dict:
    """
    指定フォルダ内のファイルをスキャンし、一括で振り分ける。
    戻り値: カウンター辞書
    """
    stats = {"moved": 0, "skipped": 0, "errors": 0, "total": 0}

    for folder in folders:
        if not os.path.isdir(folder):
            msg = f"⚠️ フォルダが見つかりません: {folder}"
            if log_callback:
                log_callback(msg)
            continue

        for root, dirs, files in os.walk(folder):
            # 保護フォルダのサブディレクトリをスキップ
            dirs[:] = [d for d in dirs if d not in PROTECTED_FOLDERS and not d.startswith(".")]

            for filename in files:
                filepath = os.path.join(root, filename)
                stats["total"] += 1

                # 保護ファイルはスキップ
                if is_protected(filepath):
                    stats["skipped"] += 1
                    continue

                # 移動先の決定
                dest_dir = get_destination(filepath)
                if dest_dir is None:
                    stats["skipped"] += 1
                    continue

                # 移動実行
                success, msg = safe_move(filepath, dest_dir)
                if success:
                    stats["moved"] += 1
                else:
                    stats["errors"] += 1

                if log_callback:
                    log_callback(msg)

    return stats


# ==============================================================================
# リアルタイム監視 (Watchdog)
# ==============================================================================

class FileOrganizerHandler(FileSystemEventHandler):
    """新規ファイルの作成を検知して自動振り分けを行うハンドラ。"""

    def __init__(self, log_callback=None):
        super().__init__()
        self.log_callback = log_callback
        self._processing = set()

    def on_created(self, event):
        if event.is_directory:
            return
        # 少し遅延を入れてからスレッドで処理
        threading.Timer(2.0, self._process_file, args=[event.src_path]).start()

    def on_moved(self, event):
        """ファイルの移動（リネーム）も検知。"""
        if event.is_directory:
            return
        threading.Timer(2.0, self._process_file, args=[event.dest_path]).start()

    def _process_file(self, filepath):
        """ファイルを処理する（遅延実行）。"""
        # 重複処理を防止
        if filepath in self._processing:
            return
        self._processing.add(filepath)

        try:
            if not os.path.exists(filepath):
                return

            if is_protected(filepath):
                return

            # ファイルの書き込み完了を待つ
            if not is_file_ready(filepath, wait_seconds=2.0):
                msg = f"⏳ 書き込み中のためスキップ: {Path(filepath).name}"
                if self.log_callback:
                    self.log_callback(msg)
                return

            dest_dir = get_destination(filepath)
            if dest_dir:
                success, msg = safe_move(filepath, dest_dir)
                if self.log_callback:
                    self.log_callback(msg)
        finally:
            self._processing.discard(filepath)


class WatcherManager:
    """複数のフォルダを監視する Observer を管理するクラス。"""

    def __init__(self, log_callback=None):
        self.observer = None
        self.log_callback = log_callback
        self.is_running = False

    def start(self, folders: list[str]):
        """監視を開始する。"""
        if self.is_running:
            return

        self.observer = Observer()
        handler = FileOrganizerHandler(log_callback=self.log_callback)

        active_count = 0
        for folder in folders:
            if os.path.isdir(folder):
                self.observer.schedule(handler, folder, recursive=True)
                active_count += 1
                msg = f"👁️ 監視開始: {folder}"
                logger.info(msg)
                if self.log_callback:
                    self.log_callback(msg)

        if active_count > 0:
            self.observer.start()
            self.is_running = True
        else:
            msg = "⚠️ 有効な監視対象フォルダがありません。"
            if self.log_callback:
                self.log_callback(msg)

    def stop(self):
        """監視を停止する。"""
        if self.observer and self.is_running:
            self.observer.stop()
            self.observer.join(timeout=5)
            self.is_running = False
            msg = "🛑 監視を停止しました。"
            logger.info(msg)
            if self.log_callback:
                self.log_callback(msg)


# ==============================================================================
# GUI（操作画面）
# ==============================================================================

class FileOrganizerApp:
    """ファイル自動振り分けプログラムのGUIアプリケーション。"""

    # --- カラーテーマ ---
    BG_DARK = "#1a1a2e"
    BG_CARD = "#16213e"
    BG_INPUT = "#0f3460"
    ACCENT = "#e94560"
    ACCENT_HOVER = "#ff6b81"
    TEXT_PRIMARY = "#eaeaea"
    TEXT_SECONDARY = "#a0a0b0"
    SUCCESS = "#2ecc71"
    WARNING = "#f39c12"
    DANGER = "#e74c3c"
    BORDER = "#2a2a4a"

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ファイル自動振り分けツール")
        self.root.geometry("900x700")
        self.root.minsize(800, 600)
        self.root.configure(bg=self.BG_DARK)

        # アイコン設定（エラーになっても続行）
        try:
            self.root.iconbitmap(default="")
        except Exception:
            pass

        # 監視マネージャ
        self.watcher = WatcherManager(log_callback=self._log_message_threadsafe)

        # 監視対象フォルダリスト
        self.watch_folders = list(DEFAULT_WATCH_FOLDERS)

        # フォント設定
        self.font_title = ("Yu Gothic UI", 18, "bold")
        self.font_heading = ("Yu Gothic UI", 12, "bold")
        self.font_normal = ("Yu Gothic UI", 10)
        self.font_small = ("Yu Gothic UI", 9)
        self.font_log = ("Consolas", 9)

        self._build_ui()
        self._update_folder_listbox()
        self._update_drive_status()

    def _build_ui(self):
        """UIを構築する。"""
        # --- タイトルバー ---
        title_frame = tk.Frame(self.root, bg=self.BG_DARK, pady=15)
        title_frame.pack(fill=tk.X)

        tk.Label(
            title_frame,
            text="📁 ファイル自動振り分けツール",
            font=self.font_title,
            bg=self.BG_DARK,
            fg=self.TEXT_PRIMARY,
        ).pack()

        tk.Label(
            title_frame,
            text="Cドライブのファイルを写真(D:)・動画(E:)・その他(F:)に自動仕分け",
            font=self.font_small,
            bg=self.BG_DARK,
            fg=self.TEXT_SECONDARY,
        ).pack(pady=(2, 0))

        # --- メインコンテンツ ---
        main_frame = tk.Frame(self.root, bg=self.BG_DARK)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 10))

        # 左パネル（設定）と右パネル（ログ）
        left_panel = tk.Frame(main_frame, bg=self.BG_DARK)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 10))

        right_panel = tk.Frame(main_frame, bg=self.BG_DARK)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # ====== 左パネル ======

        # --- ドライブ情報カード ---
        drive_card = self._create_card(left_panel, "💾 ドライブ割り当て")
        drive_card.pack(fill=tk.X, pady=(0, 10))

        drive_info_frame = tk.Frame(drive_card, bg=self.BG_CARD)
        drive_info_frame.pack(fill=tk.X, padx=10, pady=(0, 8))

        drives = [
            ("D:", "写真", self.ACCENT),
            ("E:", "動画", self.SUCCESS),
            ("F:", "その他", self.WARNING),
        ]
        for drive, label, color in drives:
            row = tk.Frame(drive_info_frame, bg=self.BG_CARD)
            row.pack(fill=tk.X, pady=2)
            tk.Label(
                row, text=f"● {drive}", font=self.font_normal,
                bg=self.BG_CARD, fg=color, width=6, anchor="w"
            ).pack(side=tk.LEFT)
            tk.Label(
                row, text=f"→ {label}", font=self.font_normal,
                bg=self.BG_CARD, fg=self.TEXT_PRIMARY
            ).pack(side=tk.LEFT)

        self.drive_status_label = tk.Label(
            drive_card, text="", font=self.font_small,
            bg=self.BG_CARD, fg=self.TEXT_SECONDARY
        )
        self.drive_status_label.pack(padx=10, pady=(0, 8))

        # --- 監視対象フォルダカード ---
        folder_card = self._create_card(left_panel, "📂 監視対象フォルダ")
        folder_card.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        # リストボックス
        listbox_frame = tk.Frame(folder_card, bg=self.BG_CARD)
        listbox_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 5))

        self.folder_listbox = tk.Listbox(
            listbox_frame,
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            selectbackground=self.ACCENT,
            selectforeground="white",
            font=self.font_small,
            bd=0,
            highlightthickness=1,
            highlightcolor=self.ACCENT,
            highlightbackground=self.BORDER,
            relief=tk.FLAT,
        )
        self.folder_listbox.pack(fill=tk.BOTH, expand=True)

        # フォルダ追加・削除ボタン
        btn_row = tk.Frame(folder_card, bg=self.BG_CARD)
        btn_row.pack(fill=tk.X, padx=10, pady=(0, 8))

        self._create_small_button(btn_row, "＋ 追加", self._add_folder).pack(side=tk.LEFT, padx=(0, 5))
        self._create_small_button(btn_row, "ー 削除", self._remove_folder).pack(side=tk.LEFT)

        # ====== 右パネル ======

        # --- アクションカード ---
        action_card = self._create_card(right_panel, "⚡ アクション")
        action_card.pack(fill=tk.X, pady=(0, 10))

        action_btn_frame = tk.Frame(action_card, bg=self.BG_CARD)
        action_btn_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        # 一括整理ボタン
        self.btn_organize = self._create_action_button(
            action_btn_frame,
            "🚀 一括整理を実行",
            self._on_organize_click,
            self.ACCENT,
            self.ACCENT_HOVER,
        )
        self.btn_organize.pack(fill=tk.X, pady=(0, 8))

        # 監視開始/停止ボタン
        self.monitoring_active = False
        self.btn_monitor = self._create_action_button(
            action_btn_frame,
            "👁️ リアルタイム監視を開始",
            self._on_monitor_toggle,
            "#2980b9",
            "#3498db",
        )
        self.btn_monitor.pack(fill=tk.X)

        # ステータスバー
        self.status_label = tk.Label(
            action_card,
            text="● 待機中",
            font=self.font_small,
            bg=self.BG_CARD,
            fg=self.TEXT_SECONDARY,
            anchor="w",
        )
        self.status_label.pack(fill=tk.X, padx=10, pady=(0, 8))

        # --- ログカード ---
        log_card = self._create_card(right_panel, "📋 ログ")
        log_card.pack(fill=tk.BOTH, expand=True)

        log_frame = tk.Frame(log_card, bg=self.BG_CARD)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 8))

        self.log_text = tk.Text(
            log_frame,
            bg="#0d1117",
            fg="#c9d1d9",
            font=self.font_log,
            bd=0,
            highlightthickness=1,
            highlightcolor=self.BORDER,
            highlightbackground=self.BORDER,
            relief=tk.FLAT,
            wrap=tk.WORD,
            state=tk.DISABLED,
            cursor="arrow",
        )
        scrollbar = tk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # ログクリアボタン
        clear_frame = tk.Frame(log_card, bg=self.BG_CARD)
        clear_frame.pack(fill=tk.X, padx=10, pady=(0, 8))
        self._create_small_button(clear_frame, "🗑️ ログをクリア", self._clear_log).pack(side=tk.RIGHT)

        # --- ステータスバー（最下部）---
        bottom_bar = tk.Frame(self.root, bg=self.BORDER, height=30)
        bottom_bar.pack(fill=tk.X, side=tk.BOTTOM)
        bottom_bar.pack_propagate(False)

        self.bottom_status = tk.Label(
            bottom_bar,
            text=f"ファイル自動振り分けツール v1.0  |  {datetime.now().strftime('%Y/%m/%d')}",
            font=self.font_small,
            bg=self.BORDER,
            fg=self.TEXT_SECONDARY,
        )
        self.bottom_status.pack(side=tk.LEFT, padx=10)

        # 初期ログ
        self._log_message("ファイル自動振り分けツールが起動しました。")
        self._log_message(f"移動先: D:\\{DEST_FOLDER_IMAGES}（写真）, E:\\{DEST_FOLDER_VIDEOS}（動画）, F:\\{DEST_FOLDER_OTHERS}（その他）")
        self._log_message(f"監視対象: {len(self.watch_folders)} フォルダ")
        self._log_message("─" * 50)

    def _create_card(self, parent, title: str) -> tk.Frame:
        """カード風のフレームを作成する。"""
        card = tk.Frame(parent, bg=self.BG_CARD, bd=0, highlightthickness=1,
                        highlightbackground=self.BORDER)
        # タイトル
        title_label = tk.Label(
            card, text=title, font=self.font_heading,
            bg=self.BG_CARD, fg=self.TEXT_PRIMARY, anchor="w"
        )
        title_label.pack(fill=tk.X, padx=10, pady=(10, 5))

        # 区切り線
        sep = tk.Frame(card, bg=self.BORDER, height=1)
        sep.pack(fill=tk.X, padx=10, pady=(0, 8))

        return card

    def _create_action_button(self, parent, text, command, bg_color, hover_color) -> tk.Label:
        """アクションボタンを作成する（Label で再現）。"""
        btn = tk.Label(
            parent,
            text=text,
            font=self.font_heading,
            bg=bg_color,
            fg="white",
            cursor="hand2",
            pady=12,
            anchor="center",
        )
        btn.bind("<Button-1>", lambda e: command())
        btn.bind("<Enter>", lambda e: btn.configure(bg=hover_color))
        btn.bind("<Leave>", lambda e: btn.configure(bg=bg_color))
        btn._bg_color = bg_color
        btn._hover_color = hover_color
        return btn

    def _create_small_button(self, parent, text, command) -> tk.Label:
        """小型ボタンを作成する。"""
        btn = tk.Label(
            parent,
            text=text,
            font=self.font_small,
            bg=self.BG_INPUT,
            fg=self.TEXT_PRIMARY,
            cursor="hand2",
            padx=10,
            pady=4,
        )
        btn.bind("<Button-1>", lambda e: command())
        btn.bind("<Enter>", lambda e: btn.configure(bg=self.ACCENT))
        btn.bind("<Leave>", lambda e: btn.configure(bg=self.BG_INPUT))
        return btn

    # --- フォルダ操作 ---

    def _update_folder_listbox(self):
        """フォルダリストボックスを更新する。"""
        self.folder_listbox.delete(0, tk.END)
        for folder in self.watch_folders:
            exists = "✅" if os.path.isdir(folder) else "❌"
            self.folder_listbox.insert(tk.END, f"  {exists}  {folder}")

    def _add_folder(self):
        """フォルダを追加する。"""
        folder = filedialog.askdirectory(title="監視対象フォルダを選択してください")
        if folder:
            folder = os.path.normpath(folder)
            if folder not in self.watch_folders:
                self.watch_folders.append(folder)
                self._update_folder_listbox()
                self._log_message(f"📂 フォルダ追加: {folder}")
            else:
                messagebox.showinfo("情報", "このフォルダは既に追加されています。")

    def _remove_folder(self):
        """選択されたフォルダを削除する。"""
        selection = self.folder_listbox.curselection()
        if not selection:
            messagebox.showinfo("情報", "削除するフォルダを選択してください。")
            return
        idx = selection[0]
        removed = self.watch_folders.pop(idx)
        self._update_folder_listbox()
        self._log_message(f"📂 フォルダ削除: {removed}")

    # --- ドライブ状態 ---

    def _update_drive_status(self):
        """ドライブの存在確認を更新する。"""
        statuses = []
        for drive, name in [("D:\\", "写真"), ("E:\\", "動画"), ("F:\\", "その他")]:
            if os.path.isdir(drive):
                try:
                    total, used, free = shutil.disk_usage(drive)
                    free_gb = free / (1024 ** 3)
                    statuses.append(f"{drive[0]}: {free_gb:.1f}GB空き")
                except Exception:
                    statuses.append(f"{drive[0]}: 接続済み")
            else:
                statuses.append(f"{drive[0]}: ❌ 未接続")

        self.drive_status_label.configure(text="  |  ".join(statuses))

    # --- 一括整理 ---

    def _on_organize_click(self):
        """一括整理ボタンのクリックハンドラ。"""
        # ドライブの存在確認
        missing_drives = []
        for drive, name in [("D:\\", "写真(D:)"), ("E:\\", "動画(E:)"), ("F:\\", "その他(F:)")]:
            if not os.path.isdir(drive):
                missing_drives.append(name)

        if missing_drives:
            messagebox.showerror(
                "エラー",
                f"以下のドライブが接続されていません:\n{', '.join(missing_drives)}\n\nドライブを接続してからお試しください。"
            )
            return

        if not self.watch_folders:
            messagebox.showwarning("警告", "監視対象フォルダが設定されていません。")
            return

        result = messagebox.askyesno(
            "確認",
            f"{len(self.watch_folders)} 個のフォルダを対象に一括整理を実行します。\n\n"
            "※ システムファイルは自動で除外されます。\n\n"
            "実行しますか？"
        )
        if not result:
            return

        self._log_message("─" * 50)
        self._log_message("🚀 一括整理を開始します...")
        self.status_label.configure(text="● 整理中...", fg=self.WARNING)
        self.root.update()

        # バックグラウンドスレッドで実行
        thread = threading.Thread(target=self._run_organize, daemon=True)
        thread.start()

    def _run_organize(self):
        """一括整理を実行する（バックグラウンドスレッド）。"""
        stats = scan_and_organize(self.watch_folders, log_callback=self._log_message_threadsafe)

        # 結果をGUIに反映
        self.root.after(0, self._on_organize_complete, stats)

    def _on_organize_complete(self, stats):
        """一括整理完了後の処理。"""
        self._log_message("─" * 50)
        self._log_message(
            f"📊 整理結果: 合計 {stats['total']} ファイル | "
            f"移動 {stats['moved']} | スキップ {stats['skipped']} | "
            f"エラー {stats['errors']}"
        )
        self._log_message("─" * 50)
        self.status_label.configure(text="● 完了", fg=self.SUCCESS)
        self._update_drive_status()

        messagebox.showinfo(
            "完了",
            f"一括整理が完了しました！\n\n"
            f"📦 合計: {stats['total']} ファイル\n"
            f"✅ 移動: {stats['moved']} ファイル\n"
            f"⏩ スキップ: {stats['skipped']} ファイル\n"
            f"❌ エラー: {stats['errors']} ファイル"
        )

    # --- リアルタイム監視 ---

    def _on_monitor_toggle(self):
        """監視の開始/停止を切り替える。"""
        if not self.monitoring_active:
            # ドライブの存在確認
            missing_drives = []
            for drive, name in [("D:\\", "D:"), ("E:\\", "E:"), ("F:\\", "F:")]:
                if not os.path.isdir(drive):
                    missing_drives.append(name)

            if missing_drives:
                messagebox.showerror(
                    "エラー",
                    f"以下のドライブが接続されていません:\n{', '.join(missing_drives)}"
                )
                return

            self._log_message("─" * 50)
            self.watcher.start(self.watch_folders)
            self.monitoring_active = True
            self.btn_monitor.configure(
                text="🛑 リアルタイム監視を停止",
                bg=self.DANGER,
            )
            self.btn_monitor._bg_color = self.DANGER
            self.btn_monitor._hover_color = "#c0392b"
            self.status_label.configure(text="● リアルタイム監視中", fg=self.SUCCESS)
        else:
            self.watcher.stop()
            self.monitoring_active = False
            self.btn_monitor.configure(
                text="👁️ リアルタイム監視を開始",
                bg="#2980b9",
            )
            self.btn_monitor._bg_color = "#2980b9"
            self.btn_monitor._hover_color = "#3498db"
            self.status_label.configure(text="● 待機中", fg=self.TEXT_SECONDARY)

    # --- ログ ---

    def _log_message(self, message: str):
        """ログにメッセージを追加する（メインスレッドから呼ぶ）。"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _log_message_threadsafe(self, message: str):
        """ログにメッセージを追加する（別スレッドから呼ぶ）。"""
        self.root.after(0, self._log_message, message)

    def _clear_log(self):
        """ログをクリアする。"""
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)
        self._log_message("ログをクリアしました。")

    # --- メインループ ---

    def run(self):
        """アプリケーションを実行する。"""
        # ウィンドウクローズ時の処理
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _on_close(self):
        """アプリケーション終了時の処理。"""
        if self.monitoring_active:
            self.watcher.stop()
        self.root.destroy()


# ==============================================================================
# メイン
# ==============================================================================

if __name__ == "__main__":
    app = FileOrganizerApp()
    app.run()
