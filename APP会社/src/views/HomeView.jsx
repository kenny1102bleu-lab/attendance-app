import { useState } from 'react';
import { triggerMorningBriefing, loadData } from '../store.js';
import kcsLogo from '../assets/kcs_logo.jpg';
import AIToolchainMap from '../components/OperationMap/AIToolchainMap.jsx';

// ============================================
// Home View — SaaS Stack ダッシュボード（統合版）
// ============================================
function HomeView({ staff, projects, apiKeys, currentUser, onOpenChat, onOpenProjects, onOpenRoadmap, onOpenSettings, onBriefing, onOpenDiscussion, onOpenX, onOpenYouTube, onLogout, chatHistory, monitoredApps = [], setMonitoredApps, onOpenAttendance, onOpenSales, onOpenAffiliate, onOpenPipeline, onOpenHAL, onOpenPrompts, showToast, gasUrls }) {
  const [briefingLoading, setBriefingLoading] = useState(false);
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const hasKey = apiKeys?.anthropic || apiKeys?.gemini;

  const handleBriefing = async () => {
    const url = gasUrls?.[0] || (loadData('gasUrls') || [])[0] || '';
    if (!url) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    setBriefingLoading(true);
    try {
      await triggerMorningBriefing(url);
      showToast?.('🌅 ブリーフィングをDiscordに送信しました', 'success');
    } catch (e) {
      showToast?.('送信エラー: ' + e.message, 'error');
    } finally {
      setBriefingLoading(false);
    }
  };

  // 全タスク数などの集計用
  const activeProjects = projects.filter(p => p.status !== '完了');
  let totalTasks = 0; let totalDone = 0;
  activeProjects.forEach(p => {
    const tasks = p.tasks || [];
    totalTasks += tasks.length;
    totalDone += tasks.filter(t => t.done).length;
  });
  const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const totalAll = totalTasks;

  // 今日のメッセージ数
  let recentActivity = 0;
  const now = Date.now();
  Object.values(chatHistory).forEach(history => {
    if (history && history.length > 0) {
      history.forEach(msg => {
        if (now - new Date(msg.timestamp).getTime() < 24 * 60 * 60 * 1000) recentActivity++;
      });
    }
  });

  return (
    <div className="home-view animate-fadein" style={{ display: 'flex', flexDirection: 'column' }}>
      <header className="dash-header">
        <div className="dash-header-top">
          <div className="dash-brand">
            <img src={kcsLogo} className="company-logo" alt="KCS Logo" />
            <div>
              <div className="company-label">KCS合同会社</div>
              <div className="company-date">{today}</div>
            </div>
          </div>
          <div className="dash-header-actions">
            {currentUser && (
              <div className="dash-user-badge">
                <span>{currentUser.role === 'admin' ? '👑' : '👤'} {currentUser.name}</span>
                <span className="dash-project-code">{currentUser.projectCode}</span>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onOpenHAL} title="HAL / すなくん 投稿管理">🎭</button>
            <button className="btn btn-ghost btn-sm" onClick={onOpenPrompts} title="プロンプト集（Claude.ai用）">📋</button>
            <button className="btn btn-ghost btn-sm" onClick={handleBriefing} disabled={briefingLoading} title="朝ブリーフィング送信">
              {briefingLoading ? '⏳' : '🌅'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onOpenSettings} title="設定">⚙️</button>
          </div>
        </div>

        {/* AIエンジン ステータスバー */}
        <div className={`dash-engine-bar ${hasKey ? 'active' : 'inactive'}`}>
          <span className="status-dot" />
          <span className="dash-engine-text">
            {hasKey ? 'AIエンジン稼働中 — Gemini & Claude 接続済み' : 'APIキー未設定 — 設定からAPIキーを入力してください'}
          </span>
          {!hasKey && (
            <button className="btn btn-ghost btn-sm dash-engine-cta" onClick={onOpenSettings}>
              設定する →
            </button>
          )}
        </div>
      </header>

      {/* ── AI Toolchain Map ── */}
      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 600 }}>
        <AIToolchainMap onOpenPipeline={onOpenPipeline} />
      </div>

      {/* ログアウト */}
      {currentUser && (
        <div style={{ padding: '8px 16px 20px', textAlign: 'center', background: 'var(--bg-primary)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
            onClick={() => { if (window.confirm('ログアウトしますか？')) onLogout(); }}
          >
            ログアウト
          </button>
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}

export default HomeView;
