import { useState } from 'react';

// Settings View
// ============================================
function SettingsView({ apiKeys, setApiKeys, gasUrls, setGasUrls, cloudPush, cloudPull, isCloudSyncing, onBack, showToast, driveFolderId, setDriveFolderId }) {
  const [anthropicInput, setAnthropicInput] = useState(apiKeys?.anthropic || '');
  const [geminiInput, setGeminiInput] = useState(apiKeys?.gemini || '');
  const [youtubeInput, setYoutubeInput] = useState(apiKeys?.youtube || '');
  const [gasInput1, setGasInput1] = useState(gasUrls[0] || '');
  const [gasInput2, setGasInput2] = useState(gasUrls[1] || '');
  const [gasInput3, setGasInput3] = useState(gasUrls[2] || '');
  const [driveIdInput, setDriveIdInput] = useState(driveFolderId || '');
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);

  const saveSettings = () => {
    setApiKeys({ anthropic: anthropicInput.trim(), gemini: geminiInput.trim(), youtube: youtubeInput.trim() });
    setGasUrls([gasInput1.trim(), gasInput2.trim(), gasInput3.trim()]);
    setDriveFolderId(driveIdInput.trim());
    showToast('設定を保存しました', 'success');
  };

  const resetAll = () => {
    if (window.confirm('全データをリセットしますか？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">⚙️ 設定</h1>
      </div>

      <div className="settings-body">
        {/* Anthropic API Key */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">🤖 Anthropic APIキー (Claude)</div>
          <p className="settings-card-desc">Claude Sonnet を使うスタッフに適用されます。</p>
          <div className="api-key-row">
            <input
              className="input-field"
              type={showAnthropic ? 'text' : 'password'}
              placeholder="sk-ant-api03-..."
              value={anthropicInput}
              onChange={e => setAnthropicInput(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAnthropic(v => !v)}>{showAnthropic ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {/* Google Gemini API Key */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">🌌 Google APIキー (Gemini)</div>
          <p className="settings-card-desc">Gemini 2.0 Flash を使うスタッフに適用されます。</p>
          <div className="api-key-row">
            <input
              className="input-field"
              type={showGemini ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={geminiInput}
              onChange={e => setGeminiInput(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGemini(v => !v)}>{showGemini ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {/* YouTube Data API Key */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">▶️ YouTube Data APIキー</div>
          <p className="settings-card-desc">公開済み動画の再生数・いいね数をリアルタイム取得します。Google Cloud Console で発行したAPIキーを入力してください。</p>
          <div className="api-key-row">
            <input
              className="input-field"
              type={showYoutube ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={youtubeInput}
              onChange={e => setYoutubeInput(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowYoutube(v => !v)}>{showYoutube ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {/* GAS URL */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">📊 スプレッドシート連携 (GAS)</div>
          <p className="settings-card-desc">最大3つのシートへ同時にデータを記録できます。</p>
          <div className="api-key-row" style={{flexDirection: 'column', gap: '8px'}}>
            <div style={{fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4}}>1. 本部・KCS管理用（チャット・X連携など）</div>
            <input
              className="input-field"
              type="text"
              placeholder="https://script.google.com/..."
              value={gasInput1}
              onChange={e => setGasInput1(e.target.value)}
            />
            <div style={{fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 4}}>2. 勤怠管理システム用（打刻・シフトなど）</div>
            <input
              className="input-field"
              type="text"
              placeholder="https://script.google.com/..."
              value={gasInput2}
              onChange={e => setGasInput2(e.target.value)}
            />
            <div style={{fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 4}}>3. 予備</div>
            <input
              className="input-field"
              type="text"
              placeholder="https://script.google.com/..."
              value={gasInput3}
              onChange={e => setGasInput3(e.target.value)}
            />
          </div>
        </div>

        <div className="glass-card settings-card">
          <div className="settings-card-title">📁 Googleドライブ連携</div>
          <p className="settings-card-desc">素材が保存されている「親フォルダID」を入力します。</p>
          <div className="form-group" style={{marginTop:12}}>
            <input
              className="input-field"
              placeholder="フォルダID (例: 1abc...)"
              value={driveIdInput}
              onChange={e => setDriveIdInput(e.target.value)}
            />
            <p style={{fontSize:10, color:'var(--text-secondary)', marginTop:4}}>※未入力の場合はマイドライブ全体を検索します</p>
          </div>
        </div>

        <div style={{ padding: '0 4px', marginBottom: 16 }}>
          <button className="btn btn-primary w-full" onClick={saveSettings}>設定を保存する</button>
        </div>

        {/* Cloud Sync */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">☁️ クラウド同期 (スマホ・PC連携)</div>
          <p className="settings-card-desc">スプレッドシートを使用して他の端末とデータを同期します。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <button className="btn btn-ghost w-full" onClick={() => cloudPush()} disabled={isCloudSyncing || !gasUrls[0]}>
              {isCloudSyncing ? '同期中...' : 'クラウドへ保存'}
            </button>
            <button className="btn btn-ghost w-full" onClick={() => cloudPull()} disabled={isCloudSyncing || !gasUrls[0]}>
              {isCloudSyncing ? '同期中...' : 'クラウドから復元'}
            </button>
          </div>
          {!gasUrls[0] && <p style={{ fontSize: 10, color: 'var(--accent-danger)', marginTop: 8 }}>※GAS URL 1を設定すると利用可能になります</p>}
        </div>

        {/* Staff & Roles Management */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">👥 スタッフ・役職管理</div>
          <p className="settings-card-desc">専門スタッフの増員や、AIの役割・性格をカスタマイズできます。</p>
          <button className="btn btn-ghost w-full" style={{ marginTop: 8, borderColor: 'var(--border-accent)' }} onClick={() => window.dispatchEvent(new CustomEvent('change-view', {detail: 'staff_mgmt'}))}>
            スタッフ・役職を編集する
          </button>
        </div>

        {/* Danger Zone */}
        <div className="glass-card settings-card danger-zone">
          <div className="settings-card-title" style={{ color: 'var(--accent-danger)' }}>⚠️ データ管理</div>
          <button className="btn btn-ghost w-full" style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }} onClick={resetAll}>
            全データをリセット
          </button>
        </div>

        <div className="settings-footer">
          <div>KCS合同会社</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Powered by Claude AI</div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
