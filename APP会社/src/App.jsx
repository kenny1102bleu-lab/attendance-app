import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ROLES, DEFAULT_STAFF, ROADMAP_TEMPLATES,
  sendToAI, loadData, saveData
} from './store.js';
import kcsLogo from './assets/kcs_logo.jpg';
import './App.css';

// ============================================
// App Root
// ============================================
export default function App() {
  const [view, setView] = useState('home');           // home | chat | projects | roadmap | settings | staff_mgmt
  const [apiKey, setApiKey] = useState(() => loadData('apiKey') || '');
  const [staff, setStaff] = useState(() => {
    const saved = loadData('staff');
    if (!saved) return DEFAULT_STAFF;
    // 既存データにavatar情報をマージ（DEFAULT_STAFFの画像を反映）
    return saved.map(s => {
      const defaultMatch = DEFAULT_STAFF.find(d => d.id === s.id);
      if (defaultMatch && !s.avatar) return { ...s, avatar: defaultMatch.avatar };
      return s;
    });
  });
  const [customRoles, setCustomRoles] = useState(() => loadData('roles') || {});
  const [projects, setProjects] = useState(() => loadData('projects') || []);
  const [chatHistory, setChatHistory] = useState(() => loadData('chatHistory') || {});
  const [gasUrl, setGasUrl] = useState(() => loadData('gasUrl') || '');
  const [activeStaff, setActiveStaff] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [toast, setToast] = useState(null);
  const [briefingMode, setBriefingMode] = useState(false);

  // 統合された役職データ
  const allRoles = { ...ROLES, ...customRoles };

  // API Key保存
  useEffect(() => { saveData('apiKey', apiKey); }, [apiKey]);
  useEffect(() => { saveData('staff', staff); }, [staff]);
  useEffect(() => { saveData('roles', customRoles); }, [customRoles]);
  useEffect(() => { saveData('projects', projects); }, [projects]);
  useEffect(() => { saveData('chatHistory', chatHistory); }, [chatHistory]);
  useEffect(() => { saveData('gasUrl', gasUrl); }, [gasUrl]);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openChat = (s) => { setActiveStaff(s); setView('chat'); };

  // View切り替え用カスタムイベント（ネストしたコンポーネント用）
  useEffect(() => {
    const handleViewChange = (e) => setView(e.detail);
    window.addEventListener('change-view', handleViewChange);
    return () => window.removeEventListener('change-view', handleViewChange);
  }, []);

  return (
    <div className="app-root">
      {/* Background orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Views */}
      <div className="view-container">
        {view === 'home' && (
          <HomeView
            staff={staff}
            projects={projects}
            apiKey={apiKey}
            onOpenChat={openChat}
            onOpenProjects={() => setView('projects')}
            onOpenRoadmap={() => setView('roadmap')}
            onOpenSettings={() => setView('settings')}
            onBriefing={() => { setBriefingMode(true); setView('chat'); setActiveStaff(null); }}
            showToast={showToast}
            chatHistory={chatHistory}
          />
        )}
        {view === 'chat' && (
          <ChatView
            staff={activeStaff}
            allStaff={staff}
            allRoles={allRoles}
            briefingMode={briefingMode}
            apiKey={apiKey}
            gasUrl={gasUrl}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            onBack={() => { setView('home'); setBriefingMode(false); setActiveStaff(null); }}
            showToast={showToast}
          />
        )}
        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            setProjects={setProjects}
            staff={staff}
            allRoles={allRoles}
            apiKey={apiKey}
            gasUrl={gasUrl}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            activeProject={activeProject}
            setActiveProject={setActiveProject}
            onBack={() => setView('home')}
            showToast={showToast}
          />
        )}
        {view === 'roadmap' && (
          <RoadmapView
            staff={staff}
            onOpenChat={openChat}
            onBack={() => setView('home')}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            apiKey={apiKey}
            setApiKey={setApiKey}
            gasUrl={gasUrl}
            setGasUrl={setGasUrl}
            staff={staff}
            setStaff={setStaff}
            customRoles={customRoles}
            setCustomRoles={setCustomRoles}
            onBack={() => setView('home')}
            showToast={showToast}
          />
        )}
        {view === 'staff_mgmt' && (
          <StaffManagementView
            staff={staff}
            setStaff={setStaff}
            customRoles={customRoles}
            setCustomRoles={setCustomRoles}
            allRoles={allRoles}
            onBack={() => setView('settings')}
            showToast={showToast}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {view === 'home' && (
        <nav className="bottom-nav">
          <button className="nav-item active" onClick={() => setView('home')}>
            <span className="nav-icon">🏢</span>
            <span className="nav-label">本社</span>
          </button>
          <button className="nav-item" onClick={() => setView('projects')}>
            <span className="nav-icon">📁</span>
            <span className="nav-label">プロジェクト</span>
          </button>
          <button className="nav-item" onClick={() => setView('roadmap')}>
            <span className="nav-icon">🗺️</span>
            <span className="nav-label">ロードマップ</span>
          </button>
          <button className="nav-item" onClick={() => setView('settings')}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">設定</span>
          </button>
        </nav>
      )}
    </div>
  );
}

// ============================================
// Home View — スタッフ一覧・会社ロビー
// ============================================
function HomeView({ staff, projects, apiKey, onOpenChat, onOpenProjects, onOpenRoadmap, onOpenSettings, onBriefing, showToast, chatHistory }) {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="home-view animate-fadein">
      {/* Header */}
      <header className="home-header">
        <div className="header-top">
          <div className="header-brand">
            <img src={kcsLogo} className="company-logo" alt="KCS Logo" />
            <div>
              <div className="company-label">KCS合同会社</div>
              <div className="company-date">{today}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>⚙️ 設定</button>
        </div>

        {/* API Status */}
        <div className={`api-status ${apiKey ? 'active' : 'inactive'}`}>
          <span className="status-dot" />
          {apiKey ? '🤖 AI エンジン稼働中' : '⚠️ APIキー未設定（設定からAPIキーを入力してください）'}
        </div>
      </header>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-btn" onClick={onBriefing}>
          <span className="quick-icon">📣</span>
          <span>全体ブリーフィング</span>
        </button>
        <button className="quick-btn" onClick={onOpenProjects}>
          <span className="quick-icon">📁</span>
          <span>プロジェクト室</span>
        </button>
        <button className="quick-btn" onClick={onOpenRoadmap}>
          <span className="quick-icon">🗺️</span>
          <span>ロードマップ</span>
        </button>
      </div>

      {/* Staff List */}
      <section className="section">
        <h2 className="section-title">👥 スタッフ</h2>
        <div className="staff-grid">
          {staff.map(s => {
            const role = ROLES[s.roleId];
            const hist = chatHistory[s.id] || [];
            const lastMsg = hist.length > 0 ? hist[hist.length - 1] : null;
            return (
              <button key={s.id} className="staff-card glass-card" onClick={() => onOpenChat(s)} style={{ '--staff-color': s.color }}>
                <div className="staff-avatar" style={{ background: `linear-gradient(135deg, ${s.color}44, ${s.color}22)`, borderColor: s.color }}>
                  {(s.avatar || s.avatarUrl) ? <img src={s.avatar || s.avatarUrl} alt={s.name} className="staff-avatar-img" /> : <span className="staff-emoji">{s.emoji}</span>}
                  <span className="staff-status-dot" />
                </div>
                <div className="staff-info">
                  <div className="staff-name">{s.name}</div>
                  <div className="staff-role">{role?.title}</div>
                  {lastMsg && (
                    <div className="staff-preview">{lastMsg.content.slice(0, 30)}…</div>
                  )}
                </div>
                <div className="staff-arrow">›</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Projects Summary */}
      {projects.length > 0 && (
        <section className="section">
          <h2 className="section-title">📁 進行中のプロジェクト</h2>
          <div className="project-mini-list">
            {projects.slice(0, 3).map(p => (
              <div key={p.id} className="project-mini glass-card" onClick={onOpenProjects}>
                <span>{p.icon || '📁'}</span>
                <span className="project-mini-name">{p.name}</span>
                <span className="project-mini-status">{p.status || '進行中'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}

// ============================================
// Chat View — スタッフ個別チャット & ブリーフィング
// ============================================
function ChatView({ staff, allStaff, allRoles, briefingMode, apiKey, gasUrl, chatHistory, setChatHistory, onBack, showToast }) {
  const chatKey = briefingMode ? '__briefing__' : (staff?.id || '__none__');
  const messages = chatHistory[chatKey] || [];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(briefingMode ? allStaff.map(s => s.id) : []);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const role = staff ? allRoles[staff.roleId] : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = useCallback((key, msg) => {
    setChatHistory(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), msg]
    }));
  }, [setChatHistory]);

  const logToGas = async (staffName, staffRole, userMsg, aiReply) => {
    if (!gasUrl) return;
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_chat',
          staffName,
          staffRole,
          message: userMsg,
          response: aiReply
        })
      });
    } catch (e) { console.warn('Logging error:', e); }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    setIsLoading(true);

    addMessage(chatKey, { role: 'user', content: text, ts: Date.now() });

    try {
      if (briefingMode) {
        const targets = allStaff.filter(s => selectedStaff.includes(s.id));
        for (const s of targets) {
          const r = allRoles[s.roleId];
          if (!r) continue;
          const reply = await sendToAI(apiKey, s, r, text, []);
          addMessage(chatKey, { role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: s.emoji, staffAvatar: s.avatar || s.avatarUrl, color: s.color, content: reply, ts: Date.now() });
          logToGas(s.name, r.title, text, reply);
        }
      } else {
        const reply = await sendToAI(apiKey, staff, role, text, messages.slice(-10));
        addMessage(chatKey, { role: 'assistant', staffId: staff.id, staffName: staff.name, staffEmoji: staff.emoji, staffAvatar: staff.avatar || staff.avatarUrl, color: staff.color, content: reply, ts: Date.now() });
        logToGas(staff.name, role.title, text, reply);
      }
    } catch (e) {
      showToast('送信エラー: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setChatHistory(prev => ({ ...prev, [chatKey]: [] }));
  };

  return (
    <div className="chat-view">
      {/* Chat Header */}
      <div className="chat-header glass-card">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        {briefingMode ? (
          <div className="chat-header-info">
            <div className="chat-name">📣 全体ブリーフィング</div>
            <div className="chat-sub">{allStaff.length}名のスタッフへ一斉発信</div>
          </div>
        ) : (
          <div className="chat-header-info">
            <div className="staff-mini-avatar" style={{ background: `linear-gradient(135deg, ${staff?.color}44, ${staff?.color}22)`, borderColor: staff?.color }}>
              {(staff?.avatar || staff?.avatarUrl) ? <img src={staff?.avatar || staff?.avatarUrl} alt="" className="staff-avatar-img" /> : staff?.emoji}
            </div>
            <div>
              <div className="chat-name">{staff?.name}</div>
              <div className="chat-sub">{role?.title} · {role?.skills?.slice(0, 2).join(' / ')}</div>
            </div>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={clearChat} title="クリア">🗑️</button>
      </div>

      {/* Briefing Staff Selector */}
      {briefingMode && (
        <div className="briefing-selector">
          <div className="briefing-label">参加スタッフを選択:</div>
          <div className="briefing-staff-chips">
            {allStaff.map(s => (
              <button
                key={s.id}
                className={`staff-chip ${selectedStaff.includes(s.id) ? 'selected' : ''}`}
                style={{ '--chip-color': s.color }}
                onClick={() => setSelectedStaff(prev =>
                  prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                )}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            {briefingMode ? (
              <div>
                <div className="chat-empty-icon">📣</div>
                <p>全スタッフに指示・相談を送信しましょう。<br />それぞれの専門分野から回答が届きます。</p>
              </div>
            ) : (
              <div>
                <div className="chat-empty-icon">{staff?.emoji}</div>
                <p>{staff?.name}との会話を始めましょう。<br />専門スキル: {role?.skills?.join(' · ')}</p>
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
            {msg.role === 'assistant' && (
              <div className="bubble-avatar" style={{ background: `linear-gradient(135deg, ${msg.color}44, ${msg.color}22)`, borderColor: msg.color }}>
                {msg.staffAvatar ? <img src={msg.staffAvatar} alt="" className="staff-avatar-img" /> : msg.staffEmoji}
              </div>
            )}
            <div className="bubble-body">
              {msg.role === 'assistant' && briefingMode && (
                <div className="bubble-from" style={{ color: msg.color }}>{msg.staffName}</div>
              )}
              <div className={`bubble-content ${msg.role === 'user' ? 'content-user' : 'content-ai'}`}>
                <FormattedMessage text={msg.content} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-bubble bubble-ai">
            <div className="bubble-avatar" style={{ background: 'var(--bg-glass)', borderColor: 'var(--border-accent)' }}>
              {briefingMode ? '🤖' : ((staff?.avatar || staff?.avatarUrl) ? <img src={staff?.avatar || staff?.avatarUrl} alt="" className="staff-avatar-img" /> : staff?.emoji)}
            </div>
            <div className="bubble-body">
              <div className="bubble-content content-ai">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
                <span className="typing-label">思考中...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area glass-card">
        <textarea
          ref={inputRef}
          className="chat-textarea"
          placeholder={briefingMode ? '全スタッフに指示・相談を入力...' : `${staff?.name}に相談...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
          rows={1}
          disabled={isLoading || (briefingMode && selectedStaff.length === 0)}
        />
        <button
          className="btn btn-primary send-btn"
          onClick={sendMessage}
          disabled={isLoading || !input.trim() || (briefingMode && selectedStaff.length === 0)}
        >
          {isLoading ? '⏳' : '送信'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Projects View — プロジェクト管理
// ============================================
function ProjectsView({ projects, setProjects, staff, apiKey, chatHistory, setChatHistory, activeProject, setActiveProject, onBack, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGasUrl, setNewGasUrl] = useState('');

  const createProject = () => {
    if (!newName.trim()) return;
    const p = {
      id: 'proj_' + Date.now(),
      name: newName.trim(),
      desc: newDesc.trim(),
      gasUrl: newGasUrl.trim(),
      icon: '📁',
      status: '進行中',
      createdAt: Date.now(),
      tasks: [],
    };
    setProjects(prev => [...prev, p]);
    setNewName(''); setNewDesc(''); setNewGasUrl('');
    setShowCreate(false);
    showToast('プロジェクトを作成しました！', 'success');
  };

  const deleteProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    showToast('削除しました', 'info');
  };

  if (activeProject) {
    return (
      <ProjectDetailView
        project={activeProject}
        setProject={(updated) => {
          setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
          setActiveProject(updated);
        }}
        staff={staff}
        apiKey={apiKey}
        chatHistory={chatHistory}
        setChatHistory={setChatHistory}
        onBack={() => setActiveProject(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">📁 プロジェクト室</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>＋ 新規</button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新規プロジェクト</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>プロジェクト名 *</label>
                <input className="input-field" placeholder="例: YouTube Shorts戦略" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>概要・メモ</label>
                <textarea className="input-field" rows={3} placeholder="プロジェクトの目的や概要" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              <div className="form-group">
                <label>GAS / スプレッドシートURL（任意）</label>
                <input className="input-field" placeholder="https://..." value={newGasUrl} onChange={e => setNewGasUrl(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={createProject}>作成する</button>
            </div>
          </div>
        </div>
      )}

      <div className="project-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48 }}>📁</div>
            <p>まだプロジェクトがありません。<br />「＋ 新規」から作成しましょう！</p>
          </div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="project-card glass-card" onClick={() => setActiveProject(p)}>
              <div className="project-card-icon">{p.icon}</div>
              <div className="project-card-body">
                <div className="project-card-name">{p.name}</div>
                {p.desc && <div className="project-card-desc">{p.desc}</div>}
                {p.gasUrl && <div className="project-card-gas">🔗 GAS連携あり</div>}
              </div>
              <div className="project-card-actions">
                <span className="badge" style={{ background: 'var(--accent-primary)22', color: 'var(--accent-secondary)' }}>{p.status}</span>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); deleteProject(p.id); }}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// プロジェクト詳細 & コンサルテーション
function ProjectDetailView({ project, setProject, staff, apiKey, chatHistory, setChatHistory, onBack, showToast }) {
  const chatKey = 'proj_chat_' + project.id;
  const messages = chatHistory[chatKey] || [];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id || '');
  const [newTask, setNewTask] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = useCallback((msg) => {
    setChatHistory(prev => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), msg] }));
  }, [chatKey, setChatHistory]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const s = staff.find(x => x.id === selectedStaffId);
    const role = s ? ROLES[s.roleId] : null;
    if (!s || !role) return;

    const context = `【プロジェクト情報】\n名前: ${project.name}\n概要: ${project.desc || 'なし'}\nGAS URL: ${project.gasUrl || 'なし'}\n\n上記のプロジェクトについて相談があります：`;
    const fullMsg = context + '\n\n' + input.trim();
    const text = input.trim();
    setInput('');
    setIsLoading(true);

    addMessage({ role: 'user', content: text, ts: Date.now() });

    try {
      const reply = await sendToAI(apiKey, s, role, fullMsg, messages.slice(-6));
      addMessage({ role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: s.emoji, color: s.color, content: reply, ts: Date.now() });
    } catch (e) {
      showToast('エラー: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const task = { id: Date.now(), text: newTask.trim(), done: false };
    setProject({ ...project, tasks: [...(project.tasks || []), task] });
    setNewTask('');
  };

  const toggleTask = (id) => {
    const tasks = project.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setProject({ ...project, tasks });
  };

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">{project.icon} {project.name}</h1>
      </div>

      <div className="project-detail-body">
        {/* Info */}
        {(project.desc || project.gasUrl) && (
          <div className="glass-card detail-info-card">
            {project.desc && <p className="detail-desc">{project.desc}</p>}
            {project.gasUrl && (
              <a className="gas-link" href={project.gasUrl} target="_blank" rel="noopener noreferrer">
                🔗 GAS/スプレッドシートを開く
              </a>
            )}
          </div>
        )}

        {/* Tasks */}
        <div className="glass-card task-card">
          <div className="task-header">📋 タスク</div>
          <div className="task-input-row">
            <input className="input-field" placeholder="タスクを追加..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
            <button className="btn btn-primary btn-sm" onClick={addTask}>追加</button>
          </div>
          <div className="task-list">
            {(project.tasks || []).map(t => (
              <div key={t.id} className={`task-item ${t.done ? 'task-done' : ''}`} onClick={() => toggleTask(t.id)}>
                <span className="task-check">{t.done ? '✅' : '⬜'}</span>
                <span className="task-text">{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consultation */}
        <div className="consultation-section">
          <div className="consultation-header">💼 スタッフに相談</div>
          <div className="staff-selector-row">
            {staff.map(s => (
              <button
                key={s.id}
                className={`staff-chip ${selectedStaffId === s.id ? 'selected' : ''}`}
                style={{ '--chip-color': s.color }}
                onClick={() => setSelectedStaffId(s.id)}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>

          <div className="project-chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty" style={{ minHeight: 80 }}>
                <p>プロジェクトについてスタッフに相談しましょう</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                {msg.role === 'assistant' && (
                  <div className="bubble-avatar" style={{ background: `${msg.color}22`, borderColor: msg.color }}>{msg.staffEmoji}</div>
                )}
                <div className="bubble-body">
                  {msg.role === 'assistant' && <div className="bubble-from" style={{ color: msg.color }}>{msg.staffName}</div>}
                  <div className={`bubble-content ${msg.role === 'user' ? 'content-user' : 'content-ai'}`}>
                    <FormattedMessage text={msg.content} />
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-bubble bubble-ai">
                <div className="bubble-content content-ai">
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area glass-card">
            <textarea
              className="chat-textarea"
              placeholder="プロジェクトについて相談..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              rows={1}
              disabled={isLoading}
            />
            <button className="btn btn-primary send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? '⏳' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Roadmap View — ロードマップ
// ============================================
function RoadmapView({ staff, onOpenChat, onBack }) {
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [progress, setProgress] = useState(() => loadData('roadmap_progress') || {});

  const toggleStep = (templateId, stepId) => {
    const key = `${templateId}_${stepId}`;
    const updated = { ...progress, [key]: !progress[key] };
    setProgress(updated);
    saveData('roadmap_progress', updated);
  };

  if (activeTemplate) {
    const tmpl = ROADMAP_TEMPLATES[activeTemplate];
    return (
      <div className="page-view animate-fadein">
        <div className="page-header">
          <button className="btn btn-ghost btn-icon" onClick={() => setActiveTemplate(null)}>‹</button>
          <h1 className="page-title">{tmpl.icon} {tmpl.name}</h1>
        </div>
        <div className="roadmap-steps">
          {tmpl.steps.map((step, i) => {
            const key = `${activeTemplate}_${step.id}`;
            const done = progress[key];
            const assignedStaff = staff.find(s => ROLES[s.roleId]?.id === step.assignRole);
            return (
              <div key={step.id} className={`roadmap-step glass-card ${done ? 'step-done' : ''}`}>
                <div className="step-num">{done ? '✅' : i + 1}</div>
                <div className="step-body">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                  {assignedStaff && (
                    <div className="step-assign">
                      <span>担当:</span>
                      <button className="staff-chip selected" style={{ '--chip-color': assignedStaff.color }} onClick={() => onOpenChat(assignedStaff)}>
                        {assignedStaff.emoji} {assignedStaff.name}に相談
                      </button>
                    </div>
                  )}
                </div>
                <button className="step-check" onClick={() => toggleStep(activeTemplate, step.id)}>
                  {done ? '↩️' : '完了'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">🗺️ 戦略ロードマップ</h1>
      </div>
      <div className="roadmap-grid">
        {Object.values(ROADMAP_TEMPLATES).map(tmpl => {
          const doneCount = tmpl.steps.filter(s => progress[`${tmpl.id}_${s.id}`]).length;
          const pct = Math.round((doneCount / tmpl.steps.length) * 100);
          return (
            <button key={tmpl.id} className="roadmap-card glass-card" onClick={() => setActiveTemplate(tmpl.id)}>
              <div className="roadmap-card-icon">{tmpl.icon}</div>
              <div className="roadmap-card-name">{tmpl.name}</div>
              <div className="roadmap-progress-bar">
                <div className="roadmap-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="roadmap-progress-label">{doneCount}/{tmpl.steps.length} ステップ完了</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Settings View
// ============================================
function SettingsView({ apiKey, setApiKey, gasUrl, setGasUrl, staff, setStaff, customRoles, setCustomRoles, onBack, showToast, onOpenStaffMgmt }) {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [gasInput, setGasInput] = useState(gasUrl);
  const [showKey, setShowKey] = useState(false);

  const saveSettings = () => {
    setApiKey(keyInput.trim());
    setGasUrl(gasInput.trim());
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
        {/* API Key */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">🤖 Anthropic APIキー</div>
          <p className="settings-card-desc">Claude APIキーを設定するとAIが実際に回答します。</p>
          <div className="api-key-row">
            <input
              className="input-field"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-api03-..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(v => !v)}>{showKey ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {/* GAS URL */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">📊 スプレッドシート連携 (GAS)</div>
          <p className="settings-card-desc">GASのデプロイURLを設定するとチャットログが保存されます。</p>
          <div className="api-key-row">
            <input
              className="input-field"
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={gasInput}
              onChange={e => setGasInput(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: '0 4px' }}>
          <button className="btn btn-primary w-full" onClick={saveSettings}>設定を保存する</button>
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

// ============================================
// Staff Management View — スタッフ・役職の増員
// ============================================
function StaffManagementView({ staff, setStaff, customRoles, setCustomRoles, allRoles, onBack, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', emoji: '', avatarUrl: '', roleId: 'executive' });
  const [isNewRole, setIsNewRole] = useState(false);
  const [newRole, setNewRole] = useState({ id: '', title: '', aiMode: 'BALANCED', temperature: 0.7, skills: '', systemPrompt: '' });

  const addStaff = () => {
    if (!newStaff.name.trim()) return;
    
    let finalRoleId = newStaff.roleId;
    if (isNewRole) {
      if (!newRole.title.trim()) return;
      const roleId = 'role_' + Date.now();
      const roleData = {
        ...newRole,
        id: roleId,
        skills: newRole.skills.split(',').map(s => s.trim()).filter(Boolean),
        dept: 'custom'
      };
      setCustomRoles(prev => ({ ...prev, [roleId]: roleData }));
      finalRoleId = roleId;
    }

    const s = {
      ...newStaff,
      id: 'staff_' + Date.now(),
      roleId: finalRoleId,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
    };
    
    setStaff(prev => [...prev, s]);
    showToast(`${s.name}をチームに追加しました`, 'success');
    setShowAdd(false);
    setNewStaff({ name: '', emoji: '', avatarUrl: '', roleId: 'executive' });
    setIsNewRole(false);
  };

  const removeStaff = (id) => {
    if (staff.length <= 1) return;
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">👥 スタッフ管理</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>＋ 追加</button>
      </div>

      <div className="settings-body">
        <div className="staff-grid">
          {staff.map(s => {
            const r = allRoles[s.roleId];
            const isDefault = DEFAULT_STAFF.some(ds => ds.id === s.id);
            return (
              <div key={s.id} className="glass-card staff-card" style={{ '--staff-color': s.color }}>
                <div className="staff-avatar" style={{ borderColor: s.color }}>
                  {s.avatarUrl ? <img src={s.avatarUrl} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} /> : <span className="staff-emoji">{s.emoji}</span>}
                </div>
                <div className="staff-info">
                  <div className="staff-name">{s.name} {isDefault && <span style={{fontSize:10, opacity:0.6}}>(初期)</span>}</div>
                  <div className="staff-role">{r?.title || '未設定'}</div>
                </div>
                {!isDefault && (
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-danger)'}} onClick={() => removeStaff(s.id)}>削除</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>新しいスタッフを追加</h3>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>お名前</label>
                <input className="input-field" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} placeholder="例: ケンジ" />
              </div>
              <div className="form-group">
                <label>アバター（絵文字 または 画像URL）</label>
                <div style={{display:'flex', gap:8}}>
                  <input className="input-field" style={{width:60}} value={newStaff.emoji} onChange={e => setNewStaff({...newStaff, emoji: e.target.value})} placeholder="🤖" />
                  <input className="input-field" value={newStaff.avatarUrl} onChange={e => setNewStaff({...newStaff, avatarUrl: e.target.value})} placeholder="https://..." />
                </div>
              </div>
              
              <div className="form-group">
                <label>役職設定</label>
                <div style={{display:'flex', gap:10, marginBottom:8}}>
                  <label style={{display:'flex', alignItems:'center', gap:4, fontSize:13}}>
                    <input type="radio" checked={!isNewRole} onChange={() => setIsNewRole(false)} /> 既存から選択
                  </label>
                  <label style={{display:'flex', alignItems:'center', gap:4, fontSize:13}}>
                    <input type="radio" checked={isNewRole} onChange={() => setIsNewRole(true)} /> 新規作成
                  </label>
                </div>
                
                {!isNewRole ? (
                  <select className="input-field" value={newStaff.roleId} onChange={e => setNewStaff({...newStaff, roleId: e.target.value})}>
                    {Object.values(allRoles).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                ) : (
                  <div style={{display:'flex', flexDirection:'column', gap:8, padding:12, background:'var(--bg-glass-strong)', borderRadius:8}}>
                    <input className="input-field" placeholder="役職名 (例: AIマーケター)" value={newRole.title} onChange={e => setNewRole({...newRole, title: e.target.value})} />
                    <div style={{display:'flex', gap:8}}>
                      <select className="input-field" style={{flex:1}} value={newRole.aiMode} onChange={e => setNewRole({...newRole, aiMode: e.target.value})}>
                        <option value="ADVISOR">ADVISOR (アドバイザー)</option>
                        <option value="CREATIVE">CREATIVE (クリエイティブ)</option>
                        <option value="PRECISE">PRECISE (実務・厳密)</option>
                        <option value="BALANCED">BALANCED (バランス)</option>
                      </select>
                      <input type="number" className="input-field" style={{width:70}} min="0" max="1" step="0.1" value={newRole.temperature} onChange={e => setNewRole({...newRole, temperature: parseFloat(e.target.value)})} />
                    </div>
                    <input className="input-field" placeholder="スキル (カンマ区切り)" value={newRole.skills} onChange={e => setNewRole({...newRole, skills: e.target.value})} />
                    <textarea className="input-field" style={{height:80}} placeholder="システムプロンプト (AIへの人格・指示)" value={newRole.systemPrompt} onChange={e => setNewRole({...newRole, systemPrompt: e.target.value})} />
                  </div>
                )}
              </div>

              <button className="btn btn-primary w-full" style={{marginTop:12}} onClick={addStaff}>スタッフを追加する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// FormattedMessage — マークダウン風整形
// ============================================
function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="formatted-msg">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="msg-h2">{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} className="msg-h1">{line.slice(2)}</h2>;
        if (line.startsWith('■ ') || line.startsWith('### ')) return <div key={i} className="msg-section">{line.replace(/^(■ |### )/, '')}</div>;
        if (line.match(/^(\d+\.|[-•*]) /)) return <div key={i} className="msg-list-item">{line}</div>;
        if (line.startsWith('```')) return <div key={i} className="msg-code-delim" />;
        if (line === '') return <div key={i} style={{ height: 6 }} />;
        return <p key={i} className="msg-p">{line}</p>;
      })}
    </div>
  );
}
