import { useState, useEffect, useRef } from 'react';

/**
 * AttendanceView — 勤怠管理ビュー
 * スタッフ・店舗・出勤状況をGAS API経由で管理
 */
export default function AttendanceView({ onBack, showToast, gasUrl }) {
  const [activeTab, setActiveTab] = useState('today'); // today | staff | store | monthly | qr | shift
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);
  
  // データ状態 (常に配列を保証)
  const [attendance, setAttendance] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [storeList, setStoreList] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [qrLinks, setQrLinks] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null); // 編集中スタッフ
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // API 呼び出し
  const fetchData = async (action, params = {}) => {
    if (!gasUrl) {
      showToast('勤怠管理用GAS URLが設定されていません', 'warning');
      return null;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ action, ...params }).toString();
      const res = await fetch(`${gasUrl}?${query}`);
      const result = await res.json();
      
      if (!isMounted.current) return null;

      if (result.status === 'ok') {
        return result.data || result;
      } else {
        showToast(`APIエラー: ${result.message}`, 'error');
        return null;
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) showToast('勤怠データの取得に失敗しました', 'error');
      return null;
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // 初回ロードとタブ切り替え時のロード
  const loadActiveTabData = async () => {
    if (activeTab === 'today') {
      const data = await fetchData('getTodayAttendance');
      if (Array.isArray(data)) setAttendance(data);
    }
    if (activeTab === 'staff') {
      const data = await fetchData('getStaffList');
      if (Array.isArray(data)) setStaffList(data);
    }
    if (activeTab === 'store') {
      const data = await fetchData('getStoreList');
      if (Array.isArray(data)) setStoreList(data);
    }
    if (activeTab === 'qr') {
      const data = await fetchData('getQRLinks');
      if (Array.isArray(data)) setQrLinks(data);
    }
    if (activeTab === 'monthly') {
      const [year, month] = yearMonth.split('/');
      const data = await fetchData('getMonthlySummary', { year, month });
      if (Array.isArray(data)) setMonthlySummary(data);
    }
  };

  useEffect(() => {
    loadActiveTabData();
  }, [activeTab, yearMonth, gasUrl]);

  // マスター同期
  const handleSyncMaster = async (type) => {
    const label = type === 'staff' ? 'スタッフ一覧' : '店舗一覧';
    if (!confirm(`外部マスターSSから「${label}」を同期しますか？\n現在のデータは上書きされます。`)) return;
    const res = await fetchData('syncMaster', { type });
    if (res) {
      showToast(res.message || '同期が完了しました', 'success');
      loadActiveTabData(); // 最新データに更新
    }
  };

  // シフト同期
  const handleSyncShift = async () => {
    if (!confirm('外部シフト表から当月のデータを同期しますか？')) return;
    const res = await fetchData('syncShift');
    if (res) {
      showToast(res.message || '同期が完了しました', 'success');
    }
  };

  // PDF出力
  const handleGeneratePDF = async () => {
    const [year, month] = yearMonth.split('/');
    if (!confirm(`${year}年${month}月のPDFレポートを一括生成しますか？\n(Googleドライブに保存されます)`)) return;
    const res = await fetchData('generatePDF', { year, month });
    if (res) {
      showToast(res.message || 'PDF生成が完了しました', 'success');
      if (res.folderUrl) window.open(res.folderUrl, '_blank');
    }
  };

  return (
    <div className="view-container animate-fadein" style={{ padding: '20px', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginRight: '16px' }}>← 戻る</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>⏱ 勤怠管理システム</h2>
        {loading && <div className="typing-dots" style={{ marginLeft: '16px' }}><span></span><span></span><span></span></div>}
      </div>

      {/* タブナビゲーション */}
      <div className="glass-card" style={{ display: 'flex', padding: '4px', marginBottom: '24px', borderRadius: '12px', overflowX: 'auto' }}>
        {[
          { id: 'today', label: '今日', icon: '🕒' },
          { id: 'staff', label: 'スタッフ', icon: '👥' },
          { id: 'store', label: '店舗', icon: '🏪' },
          { id: 'shift', label: 'シフト', icon: '📅' },
          { id: 'monthly', label: '集計', icon: '📊' },
          { id: 'qr', label: 'QR', icon: '🔗' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '0 0 auto',
              padding: '10px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* コンテンツエリア */}
      <div className="tab-content" style={{ minHeight: '400px' }}>
        
        {/* 今日の状況 */}
        {activeTab === 'today' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">リアルタイム稼働状況</span>
              <button className="btn btn-ghost btn-sm" onClick={() => loadActiveTabData()}>🔄 更新</button>
            </div>
            <div className="stack-grid">
              {Array.isArray(attendance) && attendance.length > 0 ? attendance.map(item => (
                <div key={item.staffId} className="glass-card" style={{ padding: '16px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.name}</span>
                    <span className={`badge ${item.lastKind === '出勤' ? 'badge-success' : item.lastKind === '出庫' ? 'badge-info' : 'badge-warning'}`} 
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-accent)' }}>
                      {item.lastKind}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div>最終打刻: {item.lastTime}</div>
                    <div>店舗ID: {item.storeId}</div>
                    {item.lastKind === '帰庫' && (
                      <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                        <div>配完: {item.complete}個</div>
                        <div style={{ color: 'var(--accent-success)', fontWeight: 700 }}>給料: ¥{Number(item.net || 0).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              )) : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>本日の打刻データはありません</div>}
            </div>
          </div>
        )}

        {/* スタッフ管理 */}
        {activeTab === 'staff' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">スタッフ一覧 ({staffList.length}名)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleSyncMaster('staff')}>🔄 マスター同期</button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const name = prompt('名前を入力してください');
                  if (name) fetchData('addStaff', { name, role: 'ドライバー', rental: 'なし' }).then(() => loadActiveTabData());
                }}>＋ 追加</button>
              </div>
            </div>
            <div className="glass-card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '500px' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left' }}>名前</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>店舗</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>役職</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>店舗ID</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(staffList) && staffList.map(s => (
                    <tr key={s.staffId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>{s.name}</td>
                      <td style={{ padding: '12px' }}>{s.storeName || <span style={{ color: 'var(--accent-danger)', fontSize: '11px' }}>未設定</span>}</td>
                      <td style={{ padding: '12px' }}>{s.role || <span style={{ color: 'var(--accent-danger)', fontSize: '11px' }}>未設定</span>}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>{s.storeId || <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingStaff({ ...s })}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            if (confirm(`${s.name} を削除しますか？`)) fetchData('deleteStaff', { staffId: s.staffId }).then(() => loadActiveTabData());
                          }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* スタッフ編集モーダル */}
        {editingStaff && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
               onClick={e => { if (e.target === e.currentTarget) setEditingStaff(null); }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 700 }}>✏️ スタッフ編集</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingStaff(null)}>✕</button>
              </div>
              {[
                { key: 'name', label: '名前' },
                { key: 'storeName', label: '店舗名' },
                { key: 'storeId', label: '店舗ID' },
                { key: 'role', label: '役職' },
                { key: 'lineUserId', label: 'LINE ユーザーID' },
                { key: 'rental', label: '車両レンタル' },
              ].map(({ key, label }) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
                  <input
                    className="input-field"
                    value={editingStaff[key] || ''}
                    onChange={e => setEditingStaff(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ padding: '10px' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingStaff(null)}>キャンセル</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
                  const res = await fetchData('updateStaff', editingStaff);
                  if (res) {
                    showToast('更新しました', 'success');
                    setEditingStaff(null);
                    loadActiveTabData();
                  }
                }}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* シフト管理 */}
        {activeTab === 'shift' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">シフト同期設定</span>
            </div>
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📅</div>
              <h3 style={{ marginBottom: '8px' }}>外部シフト表との同期</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Googleスプレッドシート上のシフト表から、当月の稼働データを取得し、<br />
                名前ベースでスタッフIDと紐付けてシステムに同期します。
              </p>
              <button className="btn btn-primary" onClick={handleSyncShift}>
                🔄 今すぐ同期を実行
              </button>
            </div>
          </div>
        )}

        {/* QRコード管理 */}
        {activeTab === 'qr' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">店舗用打刻URL・QRコード</span>
            </div>
            <div className="stack-grid">
              {Array.isArray(qrLinks) && qrLinks.map((qr, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{qr.storeName}</div>
                  <div className={`badge ${qr.label === '出勤' ? 'badge-success' : qr.label === '出庫' ? 'badge-info' : 'badge-warning'}`} 
                        style={{ marginBottom: '12px' }}>
                    {qr.label}
                  </div>
                  <img src={qr.qrUrl} alt="QR" style={{ width: '120px', height: '120px', background: '#fff', padding: '8px', borderRadius: '8px', marginBottom: '12px' }} />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => {
                      navigator.clipboard.writeText(qr.url);
                      showToast('URLをコピーしました', 'success');
                    }}>コピー</button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '11px' }} onClick={() => window.open(qr.qrUrl, '_blank')}>拡大</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 店舗管理 */}
        {activeTab === 'store' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">店舗一覧</span>
              <button className="btn btn-ghost btn-sm" onClick={() => handleSyncMaster('store')}>🔄 マスター同期</button>
            </div>
            <div className="stack-grid">
              {Array.isArray(storeList) && storeList.map(store => (
                <div key={store.storeId} className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>🏪 {store.storeName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {store.storeId}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 月次集計 */}
        {activeTab === 'monthly' && (
          <div className="animate-fadein">
            <div className="dash-section-hd" style={{ marginBottom: '16px' }}>
              <span className="stack-section-label">月次パフォーマンス</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={yearMonth} 
                  onChange={(e) => setYearMonth(e.target.value)}
                  placeholder="2024/04"
                  className="input-field"
                  style={{ width: '100px', padding: '10px' }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleGeneratePDF}>📄 PDF出力</button>
              </div>
            </div>
            <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', background: 'var(--accent-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>総配完数</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {Array.isArray(monthlySummary) ? monthlySummary.reduce((a, b) => a + (Number(b.totalComplete) || 0), 0) : 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>総人件費</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-success)' }}>
                    ¥{Array.isArray(monthlySummary) ? monthlySummary.reduce((a, b) => a + (Number(b.totalNet) || 0), 0).toLocaleString() : 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>稼働スタッフ</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{Array.isArray(monthlySummary) ? monthlySummary.length : 0}</div>
                </div>
              </div>
            </div>
            <div className="glass-card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '400px' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left' }}>スタッフ名</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>稼働日数</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>総配完</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>支給額</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(monthlySummary) && monthlySummary.map(row => (
                    <tr key={row.name} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>{row.name}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{row.workDays}日</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{row.totalComplete}個</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>¥{Number(row.totalNet || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      <div style={{ height: '80px' }} />
    </div>
  );
}
