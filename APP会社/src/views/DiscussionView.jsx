import { useState, useEffect, useRef, useCallback } from 'react';
import { sendToAI } from '../store.js';
import FormattedMessage from '../components/FormattedMessage.jsx';

// ============================================
// Discussion View — ラウンドテーブルディスカッション
// ============================================
function DiscussionView({ staff, allRoles, apiKeys, projects, setProjects, roundtableProjectId, setRoundtableProjectId, pendingReports, setPendingReports, onBack, showToast, pushNotify }) {
  const [phase, setPhase] = useState('setup'); // setup | running | paused | done
  const [topic, setTopic] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [maxRounds, setMaxRounds] = useState(3);
  const [currentRound, setCurrentRound] = useState(0);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingName, setLoadingName] = useState('');
  const [decision, setDecision] = useState('');
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const pendingDecisionRef = useRef('');
  const allMsgsRef = useRef([]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const selectedStaff = staff.filter(s => selectedIds.includes(s.id));

  const toggleStaff = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const buildPrompt = (member, round, interject) => {
    const role = allRoles[member.roleId];
    let p = `あなたは「${member.name}」（${role?.title || ''}）として、チームのラウンドテーブルに参加しています。\n\n`;
    p += `【テーマ】${topic}\n\n`;
    if (allMsgsRef.current.length > 0) {
      p += `【これまでの発言】\n`;
      allMsgsRef.current.forEach(m => {
        p += `▶ ${m.staffName}（R${m.round}）: ${m.content}\n\n`;
      });
    }
    if (interject) p += `【ユーザーからの追加指示】${interject}\n\n`;
    p += `あなたの専門性・役割を活かし、前の発言を踏まえた意見を200字以内で述べてください。`;
    if (round === maxRounds) p += `（最終ラウンド：結論・まとめに向けた発言をしてください）`;
    return p;
  };

  const runRound = async (round, interject = '') => {
    setPhase('running');
    setIsLoading(true);
    // 専務（executive）は最後に発言してまとめ役に
    const orderedStaff = [...selectedStaff].sort((a, b) =>
      a.roleId === 'executive' ? 1 : b.roleId === 'executive' ? -1 : 0
    );
    for (let di = 0; di < orderedStaff.length; di++) {
      const s = orderedStaff[di];
      const role = allRoles[s.roleId];
      if (!role) continue;
      if (di > 0) await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
      setLoadingName(s.name);
      try {
        const res = await sendToAI(apiKeys, s, role, buildPrompt(s, round, interject), []);
        const msg = { staffId: s.id, staffName: s.name, staffEmoji: s.emoji, avatar: s.avatar || s.avatarUrl, color: s.color, content: res.text || '（発言なし）', round, ts: Date.now() };
        allMsgsRef.current = [...allMsgsRef.current, msg];
        setMessages([...allMsgsRef.current]);
      } catch { showToast(`${s.name}の発言取得に失敗`, 'error'); }
    }
    setIsLoading(false);
    setLoadingName('');
    if (round >= maxRounds) {
      setPhase('done');
      pushNotify('💬 ディスカッション完了', `「${topic}」の議論が終了しました。最終決定をお願いします。`);
    } else {
      setPhase('paused');
      // ラウンド途中は通知なし（画面が既に更新されているため）
    }
  };

  const start = () => {
    if (!topic.trim()) return showToast('テーマを入力してください', 'error');
    if (selectedStaff.length < 2) return showToast('2名以上のスタッフを選択してください', 'error');
    if (!apiKeys?.anthropic && !apiKeys?.gemini) return showToast('APIキーを設定してください', 'error');
    allMsgsRef.current = [];
    setMessages([]);
    setCurrentRound(1);
    runRound(1);
  };

  const nextRound = () => {
    const next = currentRound + 1;
    setCurrentRound(next);
    runRound(next, userInput);
    setUserInput('');
  };

  const doFinalize = useCallback((projectId) => {
    const dec = pendingDecisionRef.current;
    if (projectId) {
      setProjects(prev => {
        const proj = prev.find(p => p.id === projectId);
        if (!proj) return prev;
        const task = { id: proj.tasks ? proj.tasks.length + 1 : 1, text: `[役員会議決定] ${dec}`, done: false };
        showToast(`「${proj.name}」にタスクを追加しました`, 'success');
        return prev.map(p => p.id === projectId ? { ...p, tasks: [...(p.tasks || []), task] } : p);
      });
    }
    pushNotify('✅ 最終決定', `「${topic}」→ ${dec.slice(0, 60)}`);
    setPhase('setup'); setTopic(''); setMessages([]); allMsgsRef.current = [];
    setCurrentRound(0); setDecision(''); setSelectedIds([]);
    pendingDecisionRef.current = '';
  }, [setProjects, showToast, pushNotify, topic]);

  const finalize = () => {
    if (!decision.trim()) return showToast('最終決定を入力してください', 'error');
    pendingDecisionRef.current = decision;
    if (!roundtableProjectId) {
      setShowProjectSelector(true);
    } else {
      doFinalize(roundtableProjectId);
    }
  };

  const reset = () => {
    setPhase('setup'); setMessages([]); allMsgsRef.current = [];
    setCurrentRound(0); setDecision('');
  };

  return (
    <div className="chat-view animate-fadein">
      {/* プロジェクト選択モーダル */}
      {showProjectSelector && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3>📁 保存先プロジェクトを選択</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                決定事項をタスクとして追加するプロジェクトを選んでください（次回から自動で使用されます）
              </p>
              {projects.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>プロジェクトがありません。先にプロジェクトを作成してください。</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projects.map(p => (
                    <button key={p.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start', gap: 10 }}
                      onClick={() => {
                        setRoundtableProjectId(p.id);
                        setShowProjectSelector(false);
                        doFinalize(p.id);
                      }}>
                      <span style={{ fontSize: 20 }}>{p.icon}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-ghost w-full" style={{ marginTop: 16 }}
                onClick={() => { setShowProjectSelector(false); doFinalize(''); }}>
                スキップ（タスク追加なし）
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <div className="chat-info">
          <div className="chat-name">🗣️ ラウンドテーブル</div>
          <div className="chat-role">
            {phase === 'setup' ? 'セットアップ'
              : phase === 'running' ? `R${currentRound} — ${loadingName} が考えています...`
              : phase === 'paused' ? `R${currentRound}/${maxRounds} 完了 — 待機中`
              : '全ラウンド完了 — 最終決定待ち'}
          </div>
        </div>
        {phase !== 'setup' && <button className="btn btn-ghost btn-sm" onClick={reset}>リセット</button>}
      </div>

      {phase === 'setup' && (
        <div className="chat-messages" style={{ padding: 16, overflowY: 'auto' }}>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>💡 ディスカッションテーマ</div>
            <textarea className="input-field" style={{ height: 72, resize: 'vertical' }}
              placeholder="例: 新商品のブランド名を決めたい / SNS戦略について議論したい"
              value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>👥 参加スタッフ（2名以上）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {staff.map(s => (
                <button key={s.id} className={`btn btn-sm ${selectedIds.includes(s.id) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleStaff(s.id)}>
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>🔄 ラウンド数</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 5].map(n => (
                <button key={n} className={`btn btn-sm ${maxRounds === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMaxRounds(n)}>
                  {n}R
                </button>
              ))}
            </div>
          </div>
          {/* リンクプロジェクト & 持ち込みレポート */}
          <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📁 決定タスクの保存先プロジェクト</span>
              {pendingReports.length > 0 && (
                <span style={{ background: 'var(--accent-primary)', color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
                  📄 レポート待ち {pendingReports.length}件
                </span>
              )}
            </div>
            {roundtableProjectId && projects.find(p => p.id === roundtableProjectId) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 14 }}>
                  {projects.find(p => p.id === roundtableProjectId)?.icon} {projects.find(p => p.id === roundtableProjectId)?.name}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setRoundtableProjectId('')}>変更</button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                最終決定時にプロジェクトを選択します（初回のみ）
              </div>
            )}
            {pendingReports.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>持ち込みレポート：</div>
                {pendingReports.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{r.projectIcon} {r.projectName}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setTopic(`【レポート審議】${r.projectName}`);
                      setPendingReports(prev => prev.filter(x => x.id !== r.id));
                    }}>議題に加える</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary w-full" style={{ height: 48 }} onClick={start}>
            🗣️ ディスカッション開始
          </button>
        </div>
      )}

      {phase !== 'setup' && (
        <>
          <div className="chat-messages">
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <span style={{ background: 'var(--accent-primary)', color: 'white', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                💡 {topic}
              </span>
            </div>
            {Array.from({ length: currentRound }, (_, i) => i + 1).map(round => (
              <div key={round}>
                <div style={{ textAlign: 'center', margin: '16px 0 8px', color: 'var(--text-secondary)', fontSize: 12 }}>── ラウンド {round} ──</div>
                {messages.filter(m => m.round === round).map((msg, idx) => (
                  <div key={idx} className="chat-message assistant-msg">
                    <div className="msg-avatar">
                      {msg.avatar ? <img src={msg.avatar} alt="" className="staff-avatar-img" /> : msg.staffEmoji}
                    </div>
                    <div className="msg-content-wrapper">
                      <div className="msg-name" style={{ color: msg.color }}>{msg.staffName}</div>
                      <div className="msg-bubble"><FormattedMessage text={msg.content} /></div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant-msg">
                <div className="msg-avatar">💭</div>
                <div className="msg-content-wrapper">
                  <div className="msg-name" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{loadingName} が考えています...</div>
                  <div className="msg-bubble loading-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            {phase === 'paused' && (
              <>
                <textarea className="input-field" style={{ flex: 1, height: 56, resize: 'none', marginBottom: 8 }}
                  placeholder="追加指示・コメント（任意）— 次のラウンドへ引き継がれます"
                  value={userInput} onChange={e => setUserInput(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPhase('done'); }}>
                    議論を終了
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={nextRound} disabled={isLoading}>
                    ▶ R{currentRound + 1}へ
                  </button>
                </div>
              </>
            )}
            {phase === 'done' && (
              <div style={{ width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>✅ 最終決定を入力</div>
                <textarea className="input-field" style={{ height: 64, marginBottom: 8 }}
                  placeholder="ディスカッションの結論・決定事項..."
                  value={decision} onChange={e => setDecision(e.target.value)} />
                <button className="btn btn-primary w-full" onClick={finalize}>決定を記録して完了</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DiscussionView;
