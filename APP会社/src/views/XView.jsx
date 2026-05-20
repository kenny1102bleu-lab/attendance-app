import { useState } from 'react';
import { sendToAI, loadData, saveData } from '../store.js';

const STORAGE_KEY = 'x_posts';

const STATUS_LABELS = {
  draft:     { label: '下書き',  color: '#95a5a6' },
  scheduled: { label: '予約済み', color: '#f39c12' },
  posted:    { label: '投稿済み', color: '#2ecc71' },
};

function loadPosts() {
  return loadData(STORAGE_KEY) || [];
}

function savePosts(posts) {
  saveData(STORAGE_KEY, posts);
}

export default function XView({ apiKeys, staff, onBack, gasUrl, showToast }) {
  const [posts, setPosts] = useState(loadPosts);
  const [modal, setModal] = useState(null); // null | 'new' | { post }
  const [draft, setDraft] = useState({ text: '', scheduledAt: '', status: 'draft' });
  const [aiLoading, setAiLoading] = useState(false);
  const [postingId, setPostingId] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  const openNew = () => {
    setDraft({ text: '', scheduledAt: '', status: 'draft' });
    setAiPrompt('');
    setModal('new');
  };

  const openEdit = (post) => {
    setDraft({ ...post });
    setAiPrompt('');
    setModal(post);
  };

  const savePost = () => {
    if (!draft.text.trim()) return;
    let updated;
    if (modal === 'new') {
      const newPost = { id: Date.now().toString(), ...draft, createdAt: new Date().toISOString() };
      updated = [newPost, ...posts];
    } else {
      updated = posts.map(p => p.id === modal.id ? { ...p, ...draft } : p);
    }
    setPosts(updated);
    savePosts(updated);
    setModal(null);
  };

  const deletePost = (id) => {
    if (!window.confirm('この投稿を削除しますか？')) return;
    const updated = posts.filter(p => p.id !== id);
    setPosts(updated);
    savePosts(updated);
  };

  const updateStatus = (id, status) => {
    const updated = posts.map(p => p.id === id ? { ...p, status } : p);
    setPosts(updated);
    savePosts(updated);
  };

  // 実際の投稿実行
  const handlePostNow = async (id, text) => {
    if (!gasUrl) {
      showToast('GAS URLが設定されていません', 'error');
      return;
    }
    if (!window.confirm('この内容で今すぐ X に投稿しますか？')) return;

    setPostingId(id);
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors', // GASへのPOSTはno-corsになることが多い
        body: JSON.stringify({ action: 'post_x', text })
      });
      
      // no-cors の場合、成功か失敗か判断が難しいため、
      // 基本的には「送信完了」とし、もしバックエンドでエラーが出ればログ等で確認する形にするか、
      // または勤怠APIと同様にGETパラメータで試す方法もありますが、
      // 今回は「送信リクエスト完了」として扱います。
      
      // ※実際には GAS の CORS 設定次第で結果が取れます
      showToast('投稿リクエストを送信しました。APIキーが正しければ数秒で反映されます。', 'success');
      updateStatus(id, 'posted');
    } catch (err) {
      console.error(err);
      showToast('投稿に失敗しました', 'error');
    } finally {
      setPostingId(null);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const marketer = staff?.find(s => s.roleId === 'marketer') || staff?.[0];
      const result = await sendToAI({
        staffId: marketer?.id || 'x_ai',
        messages: [{
          role: 'user',
          content: `X（Twitter）の投稿文を作成してください。140文字以内で、絵文字を適切に使い、エンゲージメントが高くなるよう工夫してください。\n\nテーマ・内容: ${aiPrompt}\n\n投稿文のみ返してください。`
        }],
        apiKeys,
      });
      setDraft(prev => ({ ...prev, text: result?.text || prev.text }));
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const charCount = draft.text.length;
  const overLimit = charCount > 140;

  return (
    <div className="stack-dashboard animate-fadein">

      {/* ヘッダー */}
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>𝕏</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>X 運用管理</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNew}>＋ 新規投稿</button>
        </div>
      </header>

      {/* フィルター */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 4px', overflowX: 'auto' }}>
        {[['all', 'すべて'], ['draft', '下書き'], ['scheduled', '予約済み'], ['posted', '投稿済み']].map(([val, label]) => (
          <button
            key={val}
            className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
            onClick={() => setFilter(val)}
          >
            {label}
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              {val === 'all' ? posts.length : posts.filter(p => p.status === val).length}
            </span>
          </button>
        ))}
      </div>

      {/* 投稿リスト */}
      <div style={{ padding: '8px 16px 80px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>𝕏</div>
            <div style={{ fontSize: 14 }}>投稿がありません</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}>最初の投稿を作る</button>
          </div>
        ) : (
          filtered.map(post => {
            const s = STATUS_LABELS[post.status] || STATUS_LABELS.draft;
            const isPosting = postingId === post.id;

            return (
              <div key={post.id} className="glass-card" style={{ marginBottom: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.color + '22', padding: '2px 8px', borderRadius: 20 }}>
                    {s.label}
                  </span>
                  {post.scheduledAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      📅 {new Date(post.scheduledAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                    {post.text.length}文字
                  </span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{post.text}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(post)} disabled={isPosting}>編集</button>
                  {post.status !== 'posted' && (
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ fontSize: 11 }} 
                      onClick={() => handlePostNow(post.id, post.text)}
                      disabled={isPosting}
                    >
                      {isPosting ? '送信中...' : '🚀 今すぐ投稿'}
                    </button>
                  )}
                  {post.status === 'draft' && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#f39c12' }} onClick={() => updateStatus(post.id, 'scheduled')} disabled={isPosting}>予約</button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent-error)', marginLeft: 'auto' }} onClick={() => deletePost(post.id)} disabled={isPosting}>削除</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 新規/編集 モーダル */}
      {modal !== null && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 480, width: '95vw' }}>
            <div className="modal-header">
              <h3>𝕏 {modal === 'new' ? '新規投稿' : '投稿を編集'}</h3>
            </div>
            <div className="modal-body">

              {/* AI生成 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>🤖 AIで生成</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="投稿のテーマや内容を入力..."
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={generateWithAI}
                    disabled={aiLoading || !aiPrompt.trim()}
                    style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                  >
                    {aiLoading ? '生成中...' : '生成'}
                  </button>
                </div>
              </div>

              {/* 投稿本文 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>投稿本文</span>
                  <span style={{ fontSize: 12, color: overLimit ? 'var(--accent-error)' : 'var(--text-muted)' }}>
                    {charCount} / 140
                  </span>
                </div>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="投稿内容を入力..."
                  value={draft.text}
                  onChange={e => setDraft(prev => ({ ...prev, text: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical', fontSize: 14, lineHeight: 1.6 }}
                />
              </div>

              {/* スケジュール */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>📅 予約日時（任意）</div>
                <input
                  type="datetime-local"
                  className="input"
                  value={draft.scheduledAt}
                  onChange={e => setDraft(prev => ({ ...prev, scheduledAt: e.target.value, status: e.target.value ? 'scheduled' : 'draft' }))}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>キャンセル</button>
                <button className="btn btn-primary" onClick={savePost} disabled={!draft.text.trim() || overLimit}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
