import { useState, useEffect } from 'react';
import { loadData, DEFAULT_GAS_URL } from '../store.js';

const STREAM_META = {
  affiliate: { color: '#ff9900', bg: 'rgba(255,153,0,0.08)', border: 'rgba(255,153,0,0.25)' },
  note:      { color: '#41c9b4', bg: 'rgba(65,201,180,0.08)', border: 'rgba(65,201,180,0.25)' },
  tieup:     { color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.25)' },
  youtube:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
};

const STATUS_LABELS = {
  active:       { label: '稼働中',   color: '#2ecc71' },
  setup_needed: { label: '要設定',   color: '#f39c12' },
  not_started:  { label: '未開始',   color: '#95a5a6' },
  pending:      { label: '準備中',   color: '#3498db' },
};

const CATEGORY_LABELS = {
  sns:       { label: 'SNS/X',           icon: '🐦' },
  affiliate: { label: 'アフィリエイト',   icon: '📦' },
  funnel:    { label: 'ファネル/DM',      icon: '📬' },
  tieup:     { label: 'タイアップ',       icon: '👗' },
  youtube:   { label: 'YouTube',         icon: '🎬' },
  system:    { label: 'システム',         icon: '⚙️' },
};

export default function MonetizationView({ apiKeys, gasUrl: propGasUrl, showToast, onBack }) {
  const gasUrl = propGasUrl || loadData('nexus_gas_url') || DEFAULT_GAS_URL;

  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [noteModal, setNoteModal]   = useState(false);
  const [reportData, setReportData] = useState(null);
  const [noteForm, setNoteForm]     = useState({ topic: '', account: 'hal', priceYen: 300, keyword: '' });
  const [noteResult, setNoteResult] = useState(null);
  const [articles, setArticles]     = useState([]);
  const [articleModal, setArticleModal] = useState(null);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => { fetchStatus(); fetchArticles(); }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${gasUrl}?action=getMonetizationStatus`);
      const data = await res.json();
      if (data.ok) setStatus(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchArticles = async () => {
    try {
      const res  = await fetch(`${gasUrl}?action=getNoteArticles`);
      const data = await res.json();
      if (data.ok && data.articles) setArticles(data.articles);
    } catch (e) { /* silent */ }
  };

  const runAction = async (action, body = {}, label = '') => {
    setActionLoading(action);
    try {
      const res  = await fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action, ...body }) });
      const data = await res.json();
      if (data.ok) {
        showToast?.('✅ ' + (label || action) + ' 完了', 'success');
        fetchStatus();
        fetchArticles();
      } else {
        showToast?.('❌ ' + (data.error || '実行失敗'), 'error');
      }
      return data;
    } catch (e) {
      showToast?.('通信エラー: ' + e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const generateReport = async () => {
    const data = await runAction('generate_revenue_report', {}, '収益レポート生成');
    if (data?.ok) setReportData(data.report);
  };

  const generateNoteArticle = async () => {
    if (!noteForm.topic.trim()) { showToast?.('テーマを入力してください', 'warning'); return; }
    setActionLoading('note_gen');
    try {
      const res  = await fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'generate_note_article', ...noteForm }) });
      const data = await res.json();
      if (data.ok) {
        setNoteResult(data);
        showToast?.('📝 note記事を生成しました！', 'success');
        fetchArticles();
        setNoteModal(false);
        setArticleModal(data);
      } else {
        showToast?.('❌ 生成失敗: ' + (data.error || ''), 'error');
      }
    } catch (e) { showToast?.('通信エラー', 'error'); }
    setActionLoading(null);
  };

  const updateArticleStatus = async (articleId, newStatus) => {
    await runAction('save_note_article', { articleId, status: newStatus }, '記事ステータス更新');
  };

  const setupAllTriggers = async () => {
    await runAction('setup_revenue_report_trigger', {}, '収益レポートトリガー設定');
  };

  // ────── render helpers ──────

  const readyPct   = status?.readyPct   ?? 0;
  const doneCount  = status?.doneCount  ?? 0;
  const totalCheck = status?.totalChecks ?? 10;
  const streams    = status?.streams    ?? [];
  const checklist  = status?.checklist  ?? [];
  const triggers   = status?.triggerStatus ?? {};

  const totalEstRevenue = (streams.find(s => s.id === 'note')?.estimatedRevenue || 0);

  return (
    <div className="stack-dashboard animate-fadein">
      {/* ヘッダー */}
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>収益化ダッシュボード</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchStatus} style={{ fontSize: 11 }}>🔄 更新</button>
        </div>
      </header>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px 0', borderBottom: '1px solid var(--border-color)' }}>
        {[['dashboard', '📊 概要'], ['checklist', '✅ チェックリスト'], ['note', '📝 note記事'], ['actions', '🚀 アクション']].map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>💰</div>
          <div>収益化ステータスを取得中...</div>
        </div>
      ) : (

        <div style={{ padding: '12px 16px 100px' }}>

          {/* ─── 概要タブ ─── */}
          {tab === 'dashboard' && (
            <>
              {/* セットアップ進捗 */}
              <div className="glass-card" style={{ padding: 14, marginBottom: 12, background: 'linear-gradient(135deg,rgba(108,92,231,0.1),rgba(108,92,231,0.03))', border: '1px solid rgba(108,92,231,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🚦 セットアップ進捗</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: readyPct >= 80 ? '#2ecc71' : readyPct >= 50 ? '#f39c12' : '#e74c3c' }}>{readyPct}%</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: readyPct + '%', height: '100%', background: readyPct >= 80 ? '#2ecc71' : readyPct >= 50 ? '#f39c12' : '#e74c3c', transition: 'width 0.5s', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doneCount}/{totalCheck} 項目完了</div>
              </div>

              {/* 収益ストリームカード */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💹 収益ストリーム</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {streams.map(s => {
                  const meta = STREAM_META[s.id] || STREAM_META.affiliate;
                  const stLabel = STATUS_LABELS[s.status] || STATUS_LABELS.not_started;
                  return (
                    <div key={s.id} className="glass-card" style={{ padding: '12px 14px', background: meta.bg, border: '1px solid ' + meta.border }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{s.icon} {s.name}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: stLabel.color, background: stLabel.color + '22', padding: '2px 8px', borderRadius: 99 }}>{stLabel.label}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>目標: ¥{(s.monthlyTarget || 0).toLocaleString()}/月</span>
                        </div>
                      </div>

                      {s.id === 'affiliate' && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          <span>投稿: {s.postedCount}件</span>
                          <span style={{ margin: '0 8px' }}>|</span>
                          <span>売上: {s.salesCount}件</span>
                          <span style={{ margin: '0 8px' }}>|</span>
                          <span>Imp: {(s.impressions || 0).toLocaleString()}</span>
                          <span style={{ margin: '0 8px' }}>|</span>
                          <span>CTR: {s.ctr}%</span>
                          <div style={{ marginTop: 4 }}>{(s.triggers || []).map((t, i) => <span key={i} style={{ marginRight: 8 }}>{t}</span>)}</div>
                        </div>
                      )}
                      {s.id === 'note' && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          公開済み: {s.publishedArticles}件 | 下書き: {s.draftArticles}件 | 推定収益: ¥{(s.estimatedRevenue || 0).toLocaleString()}
                        </div>
                      )}
                      {s.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.note}</div>}
                    </div>
                  );
                })}
              </div>

              {/* トリガー稼働状況 */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⚙️ トリガー稼働状況</div>
              <div className="glass-card" style={{ padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['affiliateAmazon', 'Amazon自動投稿(12時)'],
                    ['affiliateRakuten', '楽天自動投稿(18時)'],
                    ['autoReply', '自動返信(30分毎)'],
                    ['engagement', 'エンゲージメント(5分毎)'],
                    ['morningBriefing', '朝礼ブリーフィング'],
                    ['revenueReport', '収益レポート(21時)'],
                  ].map(([key, label]) => (
                    <div key={key} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{triggers[key] ? '✅' : '❌'}</span>
                      <span style={{ color: triggers[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 週次レポート */}
              {reportData && (
                <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 12, background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📊 最新収益レポート ({reportData.date})</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div>📦 アフィリエイト 7日間投稿: <b>{reportData.affiliate?.weekPosts}件</b> | 売上: <b>{reportData.affiliate?.weekSales}件</b> | CTR: <b>{reportData.affiliate?.weekCTR}</b></div>
                    <div>📝 note公開: <b>{reportData.note?.published}件</b> | 推定収益: <b>¥{(reportData.note?.estimatedRevenue || 0).toLocaleString()}</b></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── チェックリストタブ ─── */}
          {tab === 'checklist' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✅ セットアップチェックリスト</div>
              {Object.entries(
                checklist.reduce((acc, item) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {})
              ).map(([cat, items]) => {
                const catMeta = CATEGORY_LABELS[cat] || { label: cat, icon: '•' };
                return (
                  <div key={cat} className="glass-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>{catMeta.icon} {catMeta.label}</div>
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: 14 }}>{item.done ? '✅' : '⬜'}</span>
                        <span style={{ fontSize: 13, color: item.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{item.label}</span>
                        {!item.done && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#f39c12', fontWeight: 700 }}>要対応</span>}
                      </div>
                    ))}
                  </div>
                );
              })}

              <div className="glass-card" style={{ padding: '12px 14px', background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📋 設定方法</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div>1️⃣ GASスプレッドシートの「設定」シートを開く</div>
                  <div>2️⃣ 各項目の「値」列に入力する</div>
                  <div>3️⃣ GASを新バージョンでデプロイ</div>
                  <div>4️⃣ このページを更新して確認</div>
                </div>
              </div>
            </>
          )}

          {/* ─── note記事タブ ─── */}
          {tab === 'note' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>📝 note記事管理</div>
                <button className="btn btn-primary btn-sm" onClick={() => setNoteModal(true)} style={{ fontSize: 12 }}>✨ 記事生成</button>
              </div>

              {articles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>まだnote記事がありません</div>
                  <button className="btn btn-primary" onClick={() => setNoteModal(true)}>最初の記事を生成する</button>
                </div>
              ) : (
                articles.map((a, i) => (
                  <div key={i} className="glass-card" style={{ padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{a['タイトル'] || a['テーマ']}</div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700, marginLeft: 8,
                        color: a['ステータス'] === '公開済み' ? '#2ecc71' : '#f39c12',
                        background: a['ステータス'] === '公開済み' ? 'rgba(46,204,113,0.15)' : 'rgba(243,156,18,0.15)' }}>
                        {a['ステータス'] || '下書き'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {a['アカウント'] === 'hal' ? '🌸 HAL' : '📱 すなくん'} | ¥{Number(a['価格(円)'] || 300).toLocaleString()} | {String(a['作成日']).slice(0, 10)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setArticleModal(a)}>👁 内容確認</button>
                      {a['ステータス'] !== '公開済み' && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                          onClick={() => updateArticleStatus(a['記事ID'], '公開済み')}>
                          ✅ 公開済みにする
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ─── アクションタブ ─── */}
          {tab === 'actions' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🚀 収益化アクション</div>

              {/* アフィリエイト */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: 12, background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📦 アフィリエイト（すなくん）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ActionButton label="🚀 Amazon投稿を今すぐ実行" loading={actionLoading === 'test_sunakun_post'} onClick={() => runAction('test_sunakun_post', {}, 'すなくんAmazon投稿')} color="#ff9900" />
                  <ActionButton label="🎁 リードマグネット誘導ツイート（すなくん）" loading={actionLoading === 'post_lead_magnet_tease_sunakun'} onClick={() => runAction('post_lead_magnet_tease', { account: 'sunakun' }, 'すなくんリードマグネット')} color="#ff9900" />
                  <ActionButton label="⚙️ Amazon/楽天トリガーを一括セットアップ" loading={actionLoading === 'setup_all_triggers'} onClick={() => runAction('setup_all_triggers', {}, 'トリガー設定')} color="#ff9900" />
                </div>
              </div>

              {/* HAL */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: 12, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🌸 HAL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ActionButton label="🎁 リードマグネット誘導ツイート（HAL）" loading={actionLoading === 'post_lead_magnet_tease_hal'} onClick={() => runAction('post_lead_magnet_tease', { account: 'hal' }, 'HALリードマグネット')} color="#a78bfa" />
                  <ActionButton label="📝 HAL note記事を今すぐ生成" loading={false} onClick={() => { setNoteForm(f => ({ ...f, account: 'hal' })); setNoteModal(true); }} color="#a78bfa" />
                </div>
              </div>

              {/* note / 収益レポート */}
              <div className="glass-card" style={{ padding: '14px', marginBottom: 12, background: 'rgba(65,201,180,0.06)', border: '1px solid rgba(65,201,180,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 レポート / システム</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ActionButton label="📊 収益レポートを今すぐ生成 & Discord送信" loading={actionLoading === 'generate_revenue_report'} onClick={generateReport} color="#41c9b4" />
                  <ActionButton label="⚙️ 収益レポートトリガー設定（毎日21時）" loading={actionLoading === 'setup_revenue_report_trigger'} onClick={setupAllTriggers} color="#41c9b4" />
                  <ActionButton label="🔄 全トリガー一括セットアップ" loading={actionLoading === 'setup_all_triggers_gas'} onClick={() => runAction('setup_all_triggers', {}, '全トリガー設定')} color="#41c9b4" />
                </div>
              </div>

              {/* 収益化ロードマップ */}
              <div className="glass-card" style={{ padding: '14px', background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🗺️ 早期収益化ロードマップ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { phase: '今週', items: ['X APIキーをGAS設定シートに入力', '「すなくん」Amazon自動投稿テスト', 'HAL X投稿テスト'], done: false },
                    { phase: '今月', items: ['リードマグネットPDF作成 + URL設定', '楽天アフィリエイトAPI連携テスト', 'HAL note記事 2本公開（¥300〜）'], done: false },
                    { phase: '来月', items: ['MIMOMIタイアップURL設定', 'LINE公式アカウント連携'], done: false },
                  ].map(({ phase, items, done }) => (
                    <div key={phase}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>📅 {phase}</div>
                      {items.map((item, i) => (
                        <div key={i} style={{ fontSize: 12, padding: '3px 0 3px 12px', color: 'var(--text-secondary)' }}>
                          {done ? '✅ ' : '⬜ '}{item}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── note記事生成モーダル ─── */}
      {noteModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 480, width: '95vw' }}>
            <div className="modal-header"><h3>📝 note記事生成</h3></div>
            <div className="modal-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>アカウント</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['hal', '🌸 HAL（モデル・美容・日常）'], ['sunakun', '📱 すなくん（ガジェット・テック）']].map(([val, label]) => (
                    <button key={val} className={`btn btn-sm ${noteForm.account === val ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setNoteForm(f => ({ ...f, account: val }))}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>記事テーマ <span style={{ color: '#e74c3c' }}>*</span></div>
                <input className="input" placeholder="例: 春コーデの作り方 / おすすめ充電器5選" value={noteForm.topic} onChange={e => setNoteForm(f => ({ ...f, topic: e.target.value }))} style={{ fontSize: 13, width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>販売価格（円）</div>
                  <select className="input" value={noteForm.priceYen} onChange={e => setNoteForm(f => ({ ...f, priceYen: Number(e.target.value) }))} style={{ fontSize: 13 }}>
                    {[0, 100, 200, 300, 500, 800, 1000, 1500, 2000].map(p => <option key={p} value={p}>{p === 0 ? '無料' : `¥${p}`}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>SEOキーワード（任意）</div>
                  <input className="input" placeholder="例: コーデ 春 2024" value={noteForm.keyword} onChange={e => setNoteForm(f => ({ ...f, keyword: e.target.value }))} style={{ fontSize: 13 }} />
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'rgba(108,92,231,0.08)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: 'var(--text-secondary)' }}>
                💡 Claude Sonnet で1500字以上のフル記事を生成します。生成後スプレッドシートに保存され、GitHubにもバックアップされます。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setNoteModal(false)}>キャンセル</button>
                <button className="btn btn-primary" onClick={generateNoteArticle} disabled={actionLoading === 'note_gen' || !noteForm.topic.trim()}>
                  {actionLoading === 'note_gen' ? '⏳ 生成中...' : '✨ 記事生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 記事内容確認モーダル ─── */}
      {articleModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 600, width: '95vw', maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h3>📝 {articleModal['タイトル'] || articleModal.title || articleModal['テーマ']}</h3>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                {articleModal['アカウント'] === 'hal' || articleModal.account === 'hal' ? '🌸 HAL' : '📱 すなくん'} | ¥{Number(articleModal['価格(円)'] || articleModal.priceYen || 300).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', padding: 14, borderRadius: 10, maxHeight: 500, overflow: 'auto' }}>
                {articleModal['本文'] || articleModal.article || '（本文なし）'}
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setArticleModal(null)}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, loading, onClick, color = '#6c5ce7' }) {
  return (
    <button
      className="btn btn-ghost"
      style={{ width: '100%', textAlign: 'left', fontSize: 13, padding: '10px 14px', borderLeft: '3px solid ' + color, borderRadius: 8, background: color + '0d', justifyContent: 'flex-start', gap: 8 }}
      disabled={loading}
      onClick={onClick}
    >
      {loading ? <span style={{ fontSize: 13 }}>⏳ 処理中...</span> : label}
    </button>
  );
}
