import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './AgentCompany.css';

const SOCKET_URL = 'http://localhost:3737';

export default function AgentCompany({ apiKeys, currentUser, showToast }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [socket, setSocket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Socket.io Connection
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      fetchInitialData();
    });
    s.on('disconnect', () => setIsConnected(false));
    
    s.on('kcs_event', (event) => {
      if (event.type === 'log') {
        setLogs(prev => [event.log, ...prev].slice(0, 200));
      } else if (event.type === 'agent_status') {
        setAgents(prev => {
          const idx = prev.findIndex(a => a.agent_id === event.status.agent_id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.status;
            return next;
          }
          return [...prev, event.status];
        });
      }
    });

    return () => s.disconnect();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [rStatus, rLogs, rTasks] = await Promise.all([
        fetch(`${SOCKET_URL}/api/status`),
        fetch(`${SOCKET_URL}/api/logs`),
        fetch(`${SOCKET_URL}/api/tasks`)
      ]);
      const [dStatus, dLogs, dTasks] = await Promise.all([
        rStatus.json(), rLogs.json(), rTasks.json()
      ]);
      setAgents(dStatus.agents || []);
      setLogs((dLogs || []).reverse());
      setTasks(dTasks || []);
    } catch (e) {
      console.error('Initial data fetch failed:', e);
    }
  };

  return (
    <div className="agent-co-root animate-fadein">
      <header className="agent-co-header">
        <div className="ac-header-nav">
          <button 
            className={`ac-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >📊 稼働状況</button>
          <button 
            className={`ac-nav-btn ${activeTab === 'meeting' ? 'active' : ''}`}
            onClick={() => setActiveTab('meeting')}
          >🏛 会議室</button>
          <button 
            className={`ac-nav-btn ${activeTab === 'minutes' ? 'active' : ''}`}
            onClick={() => setActiveTab('minutes')}
          >📁 議事録</button>
        </div>
        <div className={`ac-status-badge ${isConnected ? 'on' : 'off'}`}>
          <span className="ac-status-dot"></span>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </header>

      <main className="agent-co-main">
        {activeTab === 'dashboard' && (
          <DashboardView agents={agents} logs={logs} tasks={tasks} />
        )}
        {activeTab === 'meeting' && (
          <MeetingRoom apiKeys={apiKeys} currentUser={currentUser} showToast={showToast} />
        )}
        {activeTab === 'minutes' && (
          <MinutesViewer />
        )}
      </main>
    </div>
  );
}

function DashboardView({ agents, logs, tasks }) {
  return (
    <div className="ac-dashboard animate-slideup">
      <section className="ac-section">
        <h3 className="ac-section-title">🏢 各部門の稼働状況</h3>
        <div className="ac-agent-grid">
          {agents.map(agent => (
            <div key={agent.agent_id} className={`ac-agent-card ${agent.status}`}>
              <div className="ac-agent-header">
                <span className="ac-agent-icon">{agent.emoji || '🤖'}</span>
                <div className={`ac-agent-status ${agent.status}`}></div>
              </div>
              <div className="ac-agent-name">{agent.agent_name}</div>
              <div className="ac-agent-dept">{agent.dept}</div>
              <div className="ac-agent-task-preview">
                {agent.status === 'processing' ? `⚙️ ${agent.current_task || '処理中...'}` : '待機中'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="ac-bottom-layout">
        <section className="ac-section ac-log-section">
          <h3 className="ac-section-title">📝 リアルタイム更新</h3>
          <div className="ac-log-list">
            {logs.map(log => (
              <div key={log.id} className="ac-log-item">
                <span className="ac-log-time">{new Date(log.created_at).toLocaleTimeString()}</span>
                <span className="ac-log-agent">[{log.agent_name || log.dept}]</span>
                <span className="ac-log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MeetingRoomView({ apiKeys, currentUser, showToast }) {
  // 会議室のロジック（Vision対応）をここに実装
  return (
    <div className="ac-meeting-room animate-slideup">
      {/* 会議室コンポーネント */}
      <div className="ac-placeholder">会議室機能（Vision対応）を構築中...</div>
    </div>
  );
}

function MinutesView() {
  return (
    <div className="ac-minutes animate-slideup">
      <div className="ac-placeholder">議事録検索システムを構築中...</div>
    </div>
  );
}
