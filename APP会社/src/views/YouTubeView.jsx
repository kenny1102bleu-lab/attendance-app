import { useState, useEffect } from 'react';
import { sendToAI, loadData, saveData, DEFAULT_GAS_URL } from '../store.js';

const STORAGE_KEY = 'youtube_videos';

const STATUS = {
  idea:      { label: 'アイデア',  color: '#95a5a6', icon: '💡' },
  scripting: { label: '台本作成中', color: '#9b59b6', icon: '✍️' },
  filming:   { label: '撮影中',    color: '#e67e22', icon: '🎬' },
  editing:   { label: '編集中',    color: '#f39c12', icon: '✂️' },
  scheduled: { label: '公開予約',  color: '#3498db', icon: '📅' },
  published: { label: '公開済み',  color: '#2ecc71', icon: '✅' },
};

const STATUS_ORDER = ['idea', 'scripting', 'filming', 'editing', 'scheduled', 'published'];

function loadVideos() { return loadData(STORAGE_KEY) || []; }
function saveVideos(v) { saveData(STORAGE_KEY, v); }

async function fetchYouTubeStats(videoIds, apiKey) {
  if (!apiKey || !videoIds.length) return {};
  const ids = videoIds.join(',');
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items) return {};
    return data.items.reduce((acc, item) => {
      acc[item.id] = {
        views:    Number(item.statistics?.viewCount  || 0),
        likes:    Number(item.statistics?.likeCount  || 0),
        comments: Number(item.statistics?.commentCount || 0),
        thumbnail: item.snippet?.thumbnails?.medium?.url || '',
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export default function YouTubeView({ apiKeys, staff, onBack, showToast }) {
  const [videos, setVideos] = useState(loadVideos);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ title: '', description: '', script: '', tags: '', status: 'idea', publishAt: '', youtubeVideoId: '' });
  const [tab, setTab] = useState('list'); // 'list' | 'kanban'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState('title'); // 'title' | 'description' | 'script'
  const [aiPrompt, setAiPrompt] = useState('');
  const [filter, setFilter] = useState('all');
  const [ytStats, setYtStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [channelStats, setChannelStats] = useState(null);

  const filtered = filter === 'all' ? videos : videos.filter(v => v.status === filter);

  useEffect(() => {
    // チャンネル統計をマウント時に取得
    syncYouTubeStats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncYouTubeStats = async (isMount = false) => {
    const ytKey = apiKeys?.youtube;
    if (!ytKey && !isMount) {
      showToast?.('YouTube APIキーが設定されていません（設定 ⚙️ から登録）', 'warning');
      return;
    }
    
    setStatsLoading(true);

    // チャンネル全体の統計をGASから取得
    try {
      const gasUrl = loadData('nexus_gas_url') || DEFAULT_GAS_URL;
      if (gasUrl) {
        const res = await fetch(`${gasUrl}?action=getYouTubeChannelStats`);
        const data = await res.json();
        if (data && !data.error && data.subscribers !== undefined) {
          setChannelStats(data);
        } else if (!isMount && data.error) {
          showToast?.(`チャンネル統計エラー: ${data.error}`, 'error');
        }
      }
    } catch (e) {
      console.error('Channel stats fetch error:', e);
    }

    // 個別動画の統計を取得
    const publishedIds = videos.filter(v => v.youtubeVideoId).map(v => v.youtubeVideoId);
    if (!publishedIds.length && !isMount) {
      showToast?.('YouTubeビデオIDが設定された動画がありません', 'warning');
      setStatsLoading(false);
      return;
    }
    if (publishedIds.length && ytKey) {
      const stats = await fetchYouTubeStats(publishedIds, ytKey);
      setYtStats(stats);
      if (!isMount) showToast?.(`${Object.keys(stats).length}件の動画統計を取得しました`, 'success');
    }
    setStatsLoading(false);
  };

  const openNew = () => {
    setDraft({ title: '', description: '', script: '', tags: '', status: 'idea', publishAt: '', youtubeVideoId: '' });
    setAiPrompt('');
    setAiMode('title');
    setModal('new');
  };

  const openEdit = (video) => {
    setDraft({ youtubeVideoId: '', ...video });
    setAiPrompt('');
    setAiMode('title');
    setModal(video);
  };

  const saveVideo = () => {
    if (!draft.title.trim()) return;
    let updated;
    if (modal === 'new') {
      updated = [{ id: Date.now().toString(), ...draft, createdAt: new Date().toISOString() }, ...videos];
    } else {
      updated = videos.map(v => v.id === modal.id ? { ...v, ...draft } : v);
    }
    setVideos(updated);
    saveVideos(updated);
    setModal(null);
  };

  const deleteVideo = (id) => {
    if (!window.confirm('この動画を削除しますか？')) return;
    const updated = videos.filter(v => v.id !== id);
    setVideos(updated);
    saveVideos(updated);
  };

  const advanceStatus = (id) => {
    const video = videos.find(v => v.id === id);
    const idx = STATUS_ORDER.indexOf(video.status);
    if (idx >= STATUS_ORDER.length - 1) return;
    const updated = videos.map(v => v.id === id ? { ...v, status: STATUS_ORDER[idx + 1] } : v);
    setVideos(updated);
    saveVideos(updated);
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const creator = staff?.find(s => s.roleId === 'marketer' || s.roleId === 'director') || staff?.[0];
      const prompts = {
        title: `YouTube動画のタイトルを5案考えてください。クリック率が高く、SEOに強いタイトルにしてください。\nテーマ: ${aiPrompt}\n\n番号付きリストで返してください。`,
        description: `YouTube動画の説明文を作成してください。SEOキーワードを含め、400文字程度で。\nテーマ・タイトル: ${aiPrompt}\n\n説明文のみ返してください。`,
        script: `YouTube動画の台本（構成）を作成してください。\nテーマ: ${aiPrompt}\n\n以下の形式で返してください：\n【オープニング】\n【本題】\n【まとめ・CTA】`,
      };
      const result = await sendToAI({
        staffId: creator?.id || 'yt_ai',
        messages: [{ role: 'user', content: prompts[aiMode] }],
        apiKeys,
      });
      const text = result?.text || '';
      if (aiMode === 'title') setDraft(p => ({ ...p, title: text.split('\n')[0].replace(/^[0-9]+[.．、]\s*/, '') }));
      if (aiMode === 'description') setDraft(p => ({ ...p, description: text }));
      if (aiMode === 'script') setDraft(p => ({ ...p, script: text }));
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  // ── サマリー ──
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = videos.filter(v => v.status === s).length;
    return acc;
  }, {});

  return (
    <div className="stack-dashboard animate-fadein">

      {/* ヘッダー */}
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>▶️</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>YouTube 管理</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => syncYouTubeStats(false)} disabled={statsLoading} style={{ fontSize: 11 }}>
              {statsLoading ? '取得中...' : '📊 統計更新'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openNew}>＋ 新規動画</button>
          </div>
        </div>
      </header>

      {/* チャンネル統計パネル */}
      {channelStats && (
        <div style={{ padding: '16px 16px 8px' }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,0,0,0.1) 0%, rgba(200,0,0,0.05) 100%)', border: '1px solid rgba(255,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>👥 登録者数</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ff4757' }}>{channelStats.subscribers.toLocaleString()}</div>
            </div>
            <div style={{ width: 1, height: 40, background: 'rgba(255,0,0,0.1)' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>👁 総再生数</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{channelStats.views.toLocaleString()}</div>
            </div>
            <div style={{ width: 1, height: 40, background: 'rgba(255,0,0,0.1)' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>🎬 動画数</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{channelStats.videos.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* パイプライン サマリー */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 4px', overflowX: 'auto' }}>
        {STATUS_ORDER.map(s => (
          <div key={s} style={{ textAlign: 'center', minWidth: 64, flex: '0 0 64px' }}>
            <div style={{ fontSize: 18 }}>{STATUS[s].icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: STATUS[s].color }}>{counts[s]}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{STATUS[s].label}</div>
          </div>
        ))}
      </div>

      {/* タブ切替 + フィルター */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 4px', alignItems: 'center' }}>
        <button className={`btn btn-sm ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('list')} style={{ fontSize: 12 }}>リスト</button>
        <button className={`btn btn-sm ${tab === 'kanban' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('kanban')} style={{ fontSize: 12 }}>かんばん</button>
        {tab === 'list' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 8, overflowX: 'auto' }}>
            {[['all', 'すべて'], ...STATUS_ORDER.map(s => [s, STATUS[s].icon])].map(([val, label]) => (
              <button key={val} className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => setFilter(val)}>
                {label} {val === 'all' ? videos.length : counts[val]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* リストビュー */}
      {tab === 'list' && (
        <div style={{ padding: '8px 16px 80px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>▶️</div>
              <div style={{ fontSize: 14 }}>動画がありません</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}>最初の動画を登録</button>
            </div>
          ) : (
            filtered.map(video => {
              const s = STATUS[video.status];
              const isLast = STATUS_ORDER.indexOf(video.status) >= STATUS_ORDER.length - 1;
              return (
                <div key={video.id} className="glass-card" style={{ marginBottom: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.color + '22', padding: '2px 8px', borderRadius: 20 }}>
                      {s.icon} {s.label}
                    </span>
                    {video.publishAt && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        📅 {new Date(video.publishAt).toLocaleDateString('ja-JP')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{video.title}</div>
                  {video.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {video.description}
                    </div>
                  )}
                  {video.tags && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {video.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <span key={t} style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 10, marginRight: 4 }}>#{t}</span>
                      ))}
                    </div>
                  )}
                  {video.youtubeVideoId && ytStats[video.youtubeVideoId] && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, padding: '6px 10px', background: 'rgba(255,0,0,0.06)', borderRadius: 8 }}>
                      <span>👁 {ytStats[video.youtubeVideoId].views.toLocaleString()}</span>
                      <span>👍 {ytStats[video.youtubeVideoId].likes.toLocaleString()}</span>
                      <span>💬 {ytStats[video.youtubeVideoId].comments.toLocaleString()}</span>
                      <a href={`https://youtu.be/${video.youtubeVideoId}`} target="_blank" rel="noreferrer"
                        style={{ marginLeft: 'auto', color: '#ff0000', fontSize: 11 }}>YouTube ↗</a>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(video)}>編集</button>
                    {!isLast && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: STATUS[STATUS_ORDER[STATUS_ORDER.indexOf(video.status) + 1]].color }}
                        onClick={() => advanceStatus(video.id)}>
                        → {STATUS[STATUS_ORDER[STATUS_ORDER.indexOf(video.status) + 1]].label}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent-error)', marginLeft: 'auto' }}
                      onClick={() => deleteVideo(video.id)}>削除</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* かんばんビュー */}
      {tab === 'kanban' && (
        <div style={{ display: 'flex', gap: 10, padding: '8px 16px 80px', overflowX: 'auto', alignItems: 'flex-start' }}>
          {STATUS_ORDER.filter(s => s !== 'published').map(s => (
            <div key={s} style={{ minWidth: 160, flex: '0 0 160px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: STATUS[s].color, marginBottom: 8, padding: '4px 8px', background: STATUS[s].color + '22', borderRadius: 8, textAlign: 'center' }}>
                {STATUS[s].icon} {STATUS[s].label} {counts[s]}
              </div>
              {videos.filter(v => v.status === s).map(video => (
                <div key={video.id} className="glass-card" style={{ padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}
                  onClick={() => openEdit(video)}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{video.title}</div>
                  {video.publishAt && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>📅 {new Date(video.publishAt).toLocaleDateString('ja-JP')}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* モーダル */}
      {modal !== null && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 520, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>▶️ {modal === 'new' ? '新規動画登録' : '動画を編集'}</h3>
            </div>
            <div className="modal-body">

              {/* AI生成 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>🤖 AIで生成</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  {[['title','タイトル'], ['description','説明文'], ['script','台本']].map(([val, label]) => (
                    <button key={val} className={`btn btn-sm ${aiMode === val ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: 11 }} onClick={() => setAiMode(val)}>{label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder={`${aiMode === 'title' ? 'タイトルのテーマ' : aiMode === 'description' ? 'タイトルや内容' : '動画のテーマ'}を入力...`}
                    value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateWithAI()} style={{ flex: 1, fontSize: 13 }} />
                  <button className="btn btn-primary btn-sm" onClick={generateWithAI} disabled={aiLoading || !aiPrompt.trim()} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {aiLoading ? '生成中...' : '生成'}
                  </button>
                </div>
              </div>

              {/* タイトル */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>タイトル *</div>
                <input className="input" placeholder="動画タイトル" value={draft.title}
                  onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={{ width: '100%', fontSize: 14 }} />
              </div>

              {/* 説明文 */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>説明文</div>
                <textarea className="input" rows={3} placeholder="動画の説明..." value={draft.description}
                  onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
                  style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
              </div>

              {/* 台本 */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>台本・構成メモ</div>
                <textarea className="input" rows={4} placeholder="台本や構成メモ..." value={draft.script}
                  onChange={e => setDraft(p => ({ ...p, script: e.target.value }))}
                  style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
              </div>

              {/* タグ */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>タグ（カンマ区切り）</div>
                <input className="input" placeholder="例: vlog, 日常, KCS" value={draft.tags}
                  onChange={e => setDraft(p => ({ ...p, tags: e.target.value }))} style={{ width: '100%', fontSize: 13 }} />
              </div>

              {/* YouTube動画ID */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>YouTube 動画ID <span style={{ color: 'var(--text-muted)' }}>（公開後に入力 → 統計取得可能）</span></div>
                <input className="input" placeholder="例: dQw4w9WgXcQ（URLの ?v= 以降）" value={draft.youtubeVideoId || ''}
                  onChange={e => setDraft(p => ({ ...p, youtubeVideoId: e.target.value.trim() }))} style={{ width: '100%', fontSize: 13 }} />
              </div>

              {/* ステータス・公開日 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>ステータス</div>
                  <select className="input" value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', fontSize: 13 }}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS[s].icon} {STATUS[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>公開日時</div>
                  <input type="datetime-local" className="input" value={draft.publishAt}
                    onChange={e => setDraft(p => ({ ...p, publishAt: e.target.value }))} style={{ width: '100%', fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>キャンセル</button>
                <button className="btn btn-primary" onClick={saveVideo} disabled={!draft.title.trim()}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
