import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ROLES, DEFAULT_STAFF, ROADMAP_TEMPLATES,
  sendToAI, loadData, saveData
} from './store.js';
import kcsLogo from './assets/kcs_logo.jpg';
import './App.css';

// ============================================
// セッション管理ヘルパー（プロジェクトコード別データ分離）
// ============================================
function getSession() {
  try { return JSON.parse(sessionStorage.getItem('kcs_session') || 'null'); } catch { return null; }
}
// プロジェクト別データを読み込み（旧データから自動マイグレーション）
function loadProjectData(key) {
  const s = getSession();
  if (!s) return loadData(key);
  const newKey = `${s.projectCode}_${key}`;
  const newData = loadData(newKey);
  if (newData !== null && newData !== undefined) return newData;
  // 旧キーにフォールバック → 見つかればプロジェクト別キーに移行保存
  const legacy = loadData(key);
  if (legacy !== null && legacy !== undefined) {
    saveData(newKey, legacy);
  }
  return legacy;
}

// ============================================
// App Root
// ============================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(getSession); // { name, projectCode } | null

  const [view, setView] = useState('home');           // home | chat | projects | roadmap | settings | staff_mgmt
  const [apiKeys, setApiKeys] = useState(() => {
    const saved = loadData('apiKeys');
    if (saved) return saved;
    // 旧データから移行
    const oldKey = loadData('apiKey') || '';
    return { anthropic: oldKey, gemini: '' };
  });
  const [staff, setStaff] = useState(() => {
    const saved = loadProjectData('staff');
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const savedIds = saved.map(s => s.id);
      const missing = DEFAULT_STAFF.filter(d => !savedIds.includes(d.id));
      const merged = saved.map(s => {
        const defaultMatch = DEFAULT_STAFF.find(d => d.id === s.id);
        if (defaultMatch && !s.avatar) return { ...s, avatar: defaultMatch.avatar };
        return s;
      });
      return [...merged, ...missing];
    }
    return DEFAULT_STAFF;
  });
  const [customRoles, setCustomRoles] = useState(() => loadProjectData('roles') || {});
  const [projects, setProjects] = useState(() => loadProjectData('projects') || []);
  const [chatHistory, setChatHistory] = useState(() => loadProjectData('chatHistory') || {});

  const [gasUrls, setGasUrls] = useState(() => {
    const saved = loadData('gasUrls');
    if (saved && Array.isArray(saved)) return saved;
    const legacy = loadData('gasUrl');
    return [legacy || '', '', ''];
  });
  const [driveFolderId, setDriveFolderId] = useState(() => loadData('driveFolderId') || '');
  const [roundtableProjectId, setRoundtableProjectId] = useState(() => loadProjectData('roundtableProjectId') || '');
  const [pendingReports, setPendingReports] = useState(() => loadProjectData('pendingReports') || []);
  const [activeStaff, setActiveStaff] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [toast, setToast] = useState(null);
  const [briefingMode, setBriefingMode] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type, args, staff, onConfirm, onCancel }

  // ログイン・ログアウト
  const login = ({ name, projectCode, role }) => {
    const user = { name, projectCode, role };
    sessionStorage.setItem('kcs_session', JSON.stringify(user));
    setCurrentUser(user);
    // プロジェクト別データをロード（旧キーへの自動フォールバック付き）
    const load = (key) => loadData(`${projectCode}_${key}`) ?? loadData(key);
    const savedStaff = load('staff');
    if (savedStaff && Array.isArray(savedStaff) && savedStaff.length > 0) {
      const savedIds = savedStaff.map(s => s.id);
      const missing = DEFAULT_STAFF.filter(d => !savedIds.includes(d.id));
      const merged = savedStaff.map(s => {
        const dm = DEFAULT_STAFF.find(d => d.id === s.id);
        return dm && !s.avatar ? { ...s, avatar: dm.avatar } : s;
      });
      setStaff([...merged, ...missing]);
      // 旧データなら新キーへ移行保存
      if (!loadData(`${projectCode}_staff`)) saveData(`${projectCode}_staff`, savedStaff);
    } else {
      setStaff(DEFAULT_STAFF);
    }
    const migrateLoad = (key) => {
      const val = load(key);
      if (val !== null && val !== undefined && !loadData(`${projectCode}_${key}`)) {
        saveData(`${projectCode}_${key}`, val);
      }
      return val;
    };
    setCustomRoles(migrateLoad('roles') || {});
    setProjects(migrateLoad('projects') || []);
    setChatHistory(migrateLoad('chatHistory') || {});
    setRoundtableProjectId(migrateLoad('roundtableProjectId') || '');
    setPendingReports(migrateLoad('pendingReports') || []);
    setView('home');
  };

  const logout = () => {
    sessionStorage.removeItem('kcs_session');
    setCurrentUser(null);
    setStaff(DEFAULT_STAFF);
    setCustomRoles({});
    setProjects([]);
    setChatHistory({});
    setRoundtableProjectId('');
    setPendingReports([]);
    setView('home');
  };

  // クラウド同期：スプレッドシートへ保存
  const cloudPush = async (customData = null) => {
    const mainUrl = gasUrls[0];
    if (!mainUrl) return;
    setIsCloudSyncing(true);
    try {
      let dataToSave = customData || { apiKeys, staff, customRoles, projects, chatHistory };

      // 画像(base64)をチャット履歴から除去し、各会話を最新50件に制限
      // （Googleスプレッドシートのセル上限50,000文字対策）
      if (dataToSave.chatHistory) {
        const stripped = {};
        Object.entries(dataToSave.chatHistory).forEach(([key, msgs]) => {
          stripped[key] = (msgs || []).slice(-50).map(m => { const { image, ...rest } = m; void image; return rest; });
        });
        dataToSave = { ...dataToSave, chatHistory: stripped };
      }

      await fetch(mainUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'save_app_data',
          key: currentUser ? `kcs_sync_${currentUser.projectCode}` : 'kcs_master_sync',
          content: dataToSave
        })
      });
      showToast('クラウドに同期しました', 'success');
    } catch (e) {
      console.error(e);
      showToast('クラウド同期に失敗しました', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // クラウド同期：スプレッドシートから読み込み
  const cloudPull = async () => {
    const mainUrl = gasUrls[0];
    if (!mainUrl) return;
    setIsCloudSyncing(true);
    try {
      const gasKey = currentUser ? `kcs_sync_${currentUser.projectCode}` : 'kcs_master_sync';
      const res = await fetch(`${mainUrl}${mainUrl.includes('?') ? '&' : '?'}action=get_app_data&key=${gasKey}`);
      const data = await res.json();
      if (data.status === 'ok' && data.content) {
        const cloud = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        if (cloud.apiKeys) setApiKeys(cloud.apiKeys);
        if (cloud.staff) {
          // クラウドから取得したスタッフにデフォルトスタッフをマージ（消えないようにする）
          const savedIds = cloud.staff.map(s => s.id);
          const missing = DEFAULT_STAFF.filter(d => !savedIds.includes(d.id));
          const merged = cloud.staff.map(s => {
            const defaultMatch = DEFAULT_STAFF.find(d => d.id === s.id);
            if (defaultMatch && !s.avatar) return { ...s, avatar: defaultMatch.avatar };
            return s;
          });
          setStaff([...merged, ...missing]);
        }

        if (cloud.customRoles) setCustomRoles(cloud.customRoles);
        if (cloud.projects) setProjects(cloud.projects);
        // クラウドのchatHistoryはマージ（ローカルの新しいメッセージを消さない）
        if (cloud.chatHistory) {
          setChatHistory(prev => {
            const merged = {};
            // クラウドデータを配列のみ受け入れ
            Object.entries(cloud.chatHistory).forEach(([key, val]) => {
              merged[key] = Array.isArray(val) ? val : [];
            });
            // ローカルの方が多い場合はローカルを優先
            Object.entries(prev).forEach(([key, msgs]) => {
              const localMsgs = Array.isArray(msgs) ? msgs : [];
              const cloudMsgs = merged[key] || [];
              merged[key] = localMsgs.length > cloudMsgs.length ? localMsgs : cloudMsgs;
            });
            return merged;
          });
        }
        showToast('クラウドから最新データを読み込みました', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('同期データの取得に失敗しました', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 初回起動時に自動同期（URLがある場合・マウント時1回のみ）
  const didInitSync = useRef(false);
  useEffect(() => {
    if (!didInitSync.current && gasUrls[0]) {
      didInitSync.current = true;
      cloudPull();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 統合された役職データ
  const allRoles = { ...ROLES, ...customRoles };

  // ローカル保存（即時）— プロジェクト別キー
  useEffect(() => { saveData('apiKeys', apiKeys); }, [apiKeys]);           // APIキーはグローバル
  useEffect(() => { saveData('gasUrls', gasUrls); }, [gasUrls]);           // GAS URLはグローバル
  useEffect(() => { saveData('driveFolderId', driveFolderId); }, [driveFolderId]); // ドライブIDはグローバル
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_staff` : 'staff';
    saveData(key, staff);
  }, [staff, currentUser]);
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_roles` : 'roles';
    saveData(key, customRoles);
  }, [customRoles, currentUser]);
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_projects` : 'projects';
    saveData(key, projects);
  }, [projects, currentUser]);
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_chatHistory` : 'chatHistory';
    saveData(key, chatHistory);
  }, [chatHistory, currentUser]);
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_roundtableProjectId` : 'roundtableProjectId';
    saveData(key, roundtableProjectId);
  }, [roundtableProjectId, currentUser]);
  useEffect(() => {
    const key = currentUser ? `${currentUser.projectCode}_pendingReports` : 'pendingReports';
    saveData(key, pendingReports);
  }, [pendingReports, currentUser]);

  // cloudPushの最新版を常にrefで保持（auto-syncのdeps問題を回避）
  const cloudPushRef = useRef(cloudPush);
  useEffect(() => { cloudPushRef.current = cloudPush; });

  // GAS自動同期（データ変更後3秒でプッシュ）
  const autoSyncTimer = useRef(null);
  useEffect(() => {
    if (!gasUrls[0]) return;
    clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = setTimeout(() => {
      cloudPushRef.current();
    }, 3000);
    return () => clearTimeout(autoSyncTimer.current);
  }, [projects, staff, chatHistory, gasUrls]);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Service Worker 登録（モバイル通知サポート用）
  const swRegistration = useRef(null);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => { swRegistration.current = reg; })
        .catch(err => console.warn('SW登録失敗:', err));
    }
  }, []);

  // プッシュ通知（SW経由でモバイル対応）
  const pushNotify = useCallback(async (title, body) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;
    if (swRegistration.current) {
      // Service Worker経由 → Androidバックグラウンド・iOS PWAで動作
      swRegistration.current.showNotification(title, { body, icon: '/kcs_logo.jpg' });
    } else {
      // フォールバック（PC・SW未登録時）
      new Notification(title, { body, icon: '/kcs_logo.jpg' });
    }
  }, []);

  // 承認モーダル（モーダルが画面に出るのでプッシュ通知は不要）
  const notifyAction = useCallback((action) => {
    setPendingAction(action);
  }, []);

  // タスク完了ポーリング（15秒ごとにGASを確認）
  const registerTask = useCallback(() => {}, []); // 後方互換用
  // stale closure対策：常に最新値をrefで参照
  const staffRef = useRef(staff);
  useEffect(() => { staffRef.current = staff; }, [staff]);
  const apiKeysRef = useRef(apiKeys);
  useEffect(() => { apiKeysRef.current = apiKeys; }, [apiKeys]);
  const customRolesRef = useRef(customRoles);
  useEffect(() => { customRolesRef.current = customRoles; }, [customRoles]);
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  const processingRef = useRef(new Set()); // 処理中のtaskId（二重実行防止）
  const notifiedRef = useRef(new Set());  // 通知済みtaskId（セッション内重複通知防止）

  useEffect(() => {
    if (!gasUrls[0]) return;

    // 処理済みtaskIdをlocalStorageで永続管理
    const getProcessed = () => {
      try { return new Set(JSON.parse(localStorage.getItem('kcs_processed_tasks') || '[]')); }
      catch { return new Set(); }
    };
    const markProcessed = (taskId) => {
      const s = getProcessed();
      s.add(taskId);
      // 古いIDが溜まらないよう最新200件のみ保持
      const arr = [...s].slice(-200);
      localStorage.setItem('kcs_processed_tasks', JSON.stringify(arr));
    };

    const poll = async () => {
      try {
        const res = await fetch(`${gasUrls[0]}?action=get_all_tasks`);
        const tasks = await res.json();
        if (!Array.isArray(tasks)) return;

        const processed = getProcessed();

        for (const task of tasks) {
          console.log('[KCS Poll] task:', task.taskId, task.status, 'resultUrl:', !!task.resultUrl, 'params:', task.params);
          // 完了済み・未処理・二重実行でない タスクだけ処理
          if (task.status !== '完了') { console.log('[KCS Poll] skip: not 完了'); continue; }
          if (!task.resultUrl) { console.log('[KCS Poll] skip: no resultUrl'); continue; }
          if (processed.has(task.taskId)) { console.log('[KCS Poll] skip: already processed'); continue; }
          if (processingRef.current.has(task.taskId)) { console.log('[KCS Poll] skip: processing'); continue; }

          let params = {};
          try { params = JSON.parse(task.params || '{}'); } catch { /* ignore */ }
          let projectId = params.projectId;
          let projectName = params.projectName || '';

          // paramsにprojectIdがない場合、staffNameの "(Proj)" 前の部分でプロジェクトを名前検索
          if (!projectId) {
            const projNameFromStaff = task.staffName.replace(' (Proj)', '').trim();
            const matched = projectsRef.current.find(p => p.name === projNameFromStaff || task.staffName.includes(p.name));
            if (matched) {
              projectId = matched.id;
              projectName = matched.name;
              console.log('[KCS Poll] projectId from name match:', projectId);
            }
          }
          if (!projectName) projectName = projectsRef.current.find(p => p.id === projectId)?.name || 'プロジェクト';

          console.log('[KCS Poll] projectId:', projectId, 'projectName:', projectName);
          if (!projectId) { console.log('[KCS Poll] skip: no projectId'); continue; }

          processingRef.current.add(task.taskId);
          try {
            // 担当スタッフを探す
            const staffName = task.staffName.replace(' (Proj)', '').trim();
            const staffMember = staffRef.current.find(s => s.name === staffName) || staffRef.current[0];
            const allRolesNow = { ...ROLES, ...customRolesRef.current };
            const role = allRolesNow[staffMember?.roleId] || Object.values(allRolesNow)[0];
            console.log('[KCS Poll] staffMember:', staffMember?.name, 'chatKey:', `proj_chat_${projectId}`);

            showToast(`${staffMember?.name || staffName} が結果を確認中...`, 'info');

            const prompt =
              `あなたは「${projectName}」プロジェクトの担当として、依頼した実務タスクが完了しました。\n` +
              `タスク種別: ${task.taskType}\n` +
              `指示内容: ${task.instruction || ''}\n\n` +
              `【完了した結果】\n${task.resultUrl}\n\n` +
              `この結果をプロジェクト担当者に分かりやすく報告してください。` +
              `重要なポイントをまとめ、次のアクション提案があれば添えてください。`;

            const aiResponse = await sendToAI(apiKeysRef.current, staffMember, role, prompt, [], null, true);
            console.log('[KCS Poll] aiResponse length:', aiResponse?.length);

            const chatKey = `proj_chat_${projectId}`;
            const newMsg = {
              id: Date.now(),
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString(),
              staffId: staffMember?.id || 'system',
              staffName: staffMember?.name || staffName,
            };

            // localStorageに直接書く（Reactの状態更新タイミングに依存しない）
            const lsKey = 'chatHistory';
            const existing = loadData(lsKey) || {};
            existing[chatKey] = [...(existing[chatKey] || []), newMsg];
            saveData(lsKey, existing);
            console.log('[KCS Poll] saved to localStorage key:', chatKey);

            // Reactの状態も更新（画面に即時反映）
            setChatHistory(prev => ({
              ...prev,
              [chatKey]: [...(prev[chatKey] || []), newMsg]
            }));

            markProcessed(task.taskId);
            showToast(`${staffMember?.name || staffName} がプロジェクトに報告を追加しました`, 'success');
            if (!notifiedRef.current.has(task.taskId)) {
              notifiedRef.current.add(task.taskId);
              pushNotify(`📝 ${staffMember?.name || staffName} が報告を書きました`, `「${projectName}」を確認してください`);
            }
          } catch (e) {
            console.error('[KCS Poll] AI報告生成エラー:', e);
          } finally {
            processingRef.current.delete(task.taskId);
          }
        }
      } catch { /* silent */ }
    };

    const interval = setInterval(poll, 15000);
    poll(); // 初回は即時実行
    return () => clearInterval(interval);
  }, [gasUrls, pushNotify, showToast]);

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

      {/* Pending Action Confirmation Modal */}
      {pendingAction && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>🤖 AIからの操作提案</h3>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{pendingAction.staff?.emoji || '🤖'}</div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{pendingAction.staff?.name} が以下の操作を提案しています：</p>
              <div className="glass-card" style={{ padding: 12, background: 'var(--bg-primary)', marginBottom: 20 }}>
                {pendingAction.type === 'add_project_task' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>タスク追加</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{pendingAction.args.text}</div>
                  </div>
                )}
                {pendingAction.type === 'update_project_status' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ステータス変更</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-secondary)' }}>
                      → {pendingAction.args.status}
                    </div>
                  </div>
                )}
                {pendingAction.type === 'reserve_sns_post' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>SNS投稿予約 ({pendingAction.args.platform})</div>
                    <div style={{ fontSize: 14, marginTop: 4, textAlign: 'left', whiteSpace: 'pre-wrap' }}>{pendingAction.args.content}</div>
                  </div>
                )}
                {pendingAction.type === 'request_agency_task' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>実務実行依頼 [{pendingAction.args.taskType}]</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--accent-primary)' }}>
                      {pendingAction.args.instruction.length > 50 ? pendingAction.args.instruction.slice(0, 50) + '...' : pendingAction.args.instruction}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => { pendingAction.onCancel?.(); setPendingAction(null); }}>キャンセル</button>
                <button className="btn btn-primary" onClick={() => { pendingAction.onConfirm(); setPendingAction(null); }}>実行する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Views */}
      <div className="view-container">
        {view === 'home' && (
          <HomeView
            staff={staff}
            projects={projects}
            apiKeys={apiKeys}
            currentUser={currentUser}
            onOpenChat={openChat}
            onOpenProjects={() => setView('projects')}
            onOpenRoadmap={() => setView('roadmap')}
            onOpenSettings={() => setView('settings')}
            onBriefing={() => { setBriefingMode(true); setView('chat'); }}
            onOpenDiscussion={() => setView('discussion')}
            onLogout={logout}
            chatHistory={chatHistory}
          />
        )}
        {view === 'chat' && (
          <ChatView
            staff={activeStaff}
            allStaff={staff}
            allRoles={allRoles}
            briefingMode={briefingMode}
            apiKeys={apiKeys}
            gasUrls={gasUrls}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            onBack={() => { setView('home'); setBriefingMode(false); setActiveStaff(null); }}
            showToast={showToast}
            setPendingAction={notifyAction}
            cloudPush={cloudPush}
            driveFolderId={driveFolderId}
            registerTask={registerTask}
          />
        )}
        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            setProjects={setProjects}
            staff={staff}
            allRoles={allRoles}
            apiKeys={apiKeys}
            gasUrls={gasUrls}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            activeProject={activeProject}
            setActiveProject={setActiveProject}
            onBack={() => setView('home')}
            showToast={showToast}
            setPendingAction={notifyAction}
            cloudPush={cloudPush}
            driveFolderId={driveFolderId}
            registerTask={registerTask}
            setPendingReports={setPendingReports}
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
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            gasUrls={gasUrls}
            setGasUrls={setGasUrls}
            staff={staff}
            setStaff={setStaff}
            customRoles={customRoles}
            setCustomRoles={setCustomRoles}
            cloudPush={cloudPush}
            cloudPull={cloudPull}
            isCloudSyncing={isCloudSyncing}
            onBack={() => setView('home')}
            showToast={showToast}
            driveFolderId={driveFolderId}
            setDriveFolderId={setDriveFolderId}
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
        {view === 'discussion' && (
          <DiscussionView
            staff={staff}
            allRoles={allRoles}
            apiKeys={apiKeys}
            projects={projects}
            setProjects={setProjects}
            roundtableProjectId={roundtableProjectId}
            setRoundtableProjectId={setRoundtableProjectId}
            pendingReports={pendingReports}
            setPendingReports={setPendingReports}
            onBack={() => setView('home')}
            showToast={showToast}
            pushNotify={pushNotify}
            setPendingAction={notifyAction}
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
// Login View — 管理者 / ユーザー入室
// ============================================
function LoginView({ onLogin, showToast }) {
  const [role, setRole] = useState('user');   // 'admin' | 'user'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 旧データ（プロジェクトコードなし）の検出
  const legacyProjects = loadData('projects');
  const hasLegacy = Array.isArray(legacyProjects) && legacyProjects.length > 0;

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
    setCode(c);
  };

  const handleJoin = () => {
    if (!name.trim()) return showToast('お名前を入力してください', 'error');
    const trimCode = code.trim().toUpperCase();
    if (!trimCode || trimCode.length < 4) return showToast('コードは4文字以上にしてください', 'error');

    if (role === 'admin') {
      if (!adminPass.trim()) return showToast('管理者パスワードを入力してください', 'error');
      // 既存プロジェクトなら登録済みパスワードと照合
      const savedPass = loadData(`${trimCode}_adminPass`);
      if (savedPass) {
        if (savedPass !== adminPass.trim()) return showToast('管理者パスワードが違います', 'error');
      } else {
        // 初回作成 → パスワードを保存
        saveData(`${trimCode}_adminPass`, adminPass.trim());
        showToast('管理者パスワードを設定しました', 'success');
      }
      onLogin({ name: name.trim(), projectCode: trimCode, role: 'admin' });
    } else {
      // ユーザーはパスワード不要
      onLogin({ name: name.trim(), projectCode: trimCode, role: 'user' });
    }
  };

  const isAdmin = role === 'admin';

  return (
    <div className="chat-view animate-fadein" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        {/* ロゴ */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={kcsLogo} alt="KCS" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 12 }} />
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>KCS合同会社</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>AIスタッフダッシュボード</div>
        </div>

        {/* 旧データ復元バナー */}
        {hasLegacy && (
          <div className="glass-card" style={{ padding: 14, marginBottom: 16, border: '1px solid var(--accent-secondary)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📦 以前のデータが見つかりました</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {legacyProjects.length}件のプロジェクトが保存されています。<br />
              プロジェクトコードを入力してログインすると自動的に引き継がれます。
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: 6 }}>
              💡 管理者として入室 → 🎲 で新しいコードを生成 → 参加する
            </div>
          </div>
        )}

        {/* 役割切り替え */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button className={`btn ${isAdmin ? 'btn-primary' : 'btn-ghost'}`}
            style={{ height: 52, flexDirection: 'column', gap: 2 }}
            onClick={() => setRole('admin')}>
            <span style={{ fontSize: 20 }}>👑</span>
            <span style={{ fontSize: 12 }}>管理者</span>
          </button>
          <button className={`btn ${!isAdmin ? 'btn-primary' : 'btn-ghost'}`}
            style={{ height: 52, flexDirection: 'column', gap: 2 }}
            onClick={() => setRole('user')}>
            <span style={{ fontSize: 20 }}>👤</span>
            <span style={{ fontSize: 12 }}>ユーザー</span>
          </button>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14, color: isAdmin ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
            {isAdmin ? '👑 管理者ログイン' : '👤 ユーザーとして参加'}
          </div>

          {/* 名前 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>お名前</label>
            <input className="input-field" placeholder="例: 山田 太郎"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* プロジェクトコード */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>プロジェクトコード</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" placeholder="例: ABC12345"
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                style={{ flex: 1, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }} />
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" onClick={generateCode} title="新規コードを生成">🎲</button>
              )}
            </div>
          </div>

          {/* 管理者パスワード（管理者のみ） */}
          {isAdmin && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                管理者パスワード
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-secondary)' }}>
                  ※初回作成時は任意のパスワードを設定してください
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input-field" type={showPass ? 'text' : 'password'}
                  placeholder="パスワードを入力"
                  value={adminPass} onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPass(v => !v)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {!isAdmin && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              ※ 管理者からプロジェクトコードをもらってください
            </p>
          )}

          <button className="btn btn-primary w-full" style={{ height: 46, fontSize: 15 }} onClick={handleJoin}>
            {isAdmin ? '管理者として入室 →' : '参加する →'}
          </button>
        </div>

        {isAdmin && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 10 }}>
            管理者：設定・スタッフ管理・API設定が可能 ／ ユーザー：チャット・プロジェクト・議論のみ
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Home View — SaaS Stack ダッシュボード
// ============================================
function HomeView({ staff, projects, apiKeys, currentUser, onOpenChat, onOpenProjects, onOpenRoadmap, onOpenSettings, onBriefing, onOpenDiscussion, onLogout, chatHistory }) {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const hasKey = apiKeys?.anthropic || apiKeys?.gemini;

  const activeProjects = projects.filter(p => p.status !== '完了' && p.status !== '中止');
  const totalTasks = projects.reduce((acc, p) => acc + (p.tasks?.filter(t => !t.done)?.length || 0), 0);
  const recentActivity = Object.values(chatHistory).reduce((count, msgs) => {
    return count + (msgs || []).filter(m =>
      m.role === 'assistant' && new Date(m.timestamp) > new Date(Date.now() - 86400000)
    ).length;
  }, 0);

  return (
    <div className="home-view animate-fadein">

      {/* ── ヘッダー ── */}
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

      {/* ── KPI ステータス行 ── */}
      <div className="dash-kpi-row">
        <button className="dash-kpi-card" onClick={onOpenProjects}>
          <div className="dash-kpi-value">{activeProjects.length}</div>
          <div className="dash-kpi-label">📁 プロジェクト</div>
        </button>
        <button className="dash-kpi-card" onClick={onOpenProjects}>
          <div className="dash-kpi-value">{totalTasks}</div>
          <div className="dash-kpi-label">✅ 未完了タスク</div>
        </button>
        <button className="dash-kpi-card">
          <div className="dash-kpi-value">{recentActivity}</div>
          <div className="dash-kpi-label">💬 今日のAI返信</div>
        </button>
        <button className="dash-kpi-card">
          <div className="dash-kpi-value">{staff.length}</div>
          <div className="dash-kpi-label">👥 スタッフ</div>
        </button>
      </div>

      {/* ── アクションカード ── */}
      <section className="dash-section">
        <div className="dash-section-hd">
          <span className="dash-section-eyebrow">⚡ 今すぐアクション</span>
        </div>
        <div className="dash-action-grid">
          <button className="dash-action-card dash-action-primary" onClick={onBriefing}>
            <span className="dash-action-icon">📣</span>
            <span className="dash-action-title">全体ブリーフィング</span>
            <span className="dash-action-sub">全スタッフに一斉指示</span>
          </button>
          <button className="dash-action-card" onClick={onOpenDiscussion}>
            <span className="dash-action-icon">🗣️</span>
            <span className="dash-action-title">ラウンドテーブル</span>
            <span className="dash-action-sub">チームで議論・決定</span>
          </button>
          <button className="dash-action-card" onClick={onOpenProjects}>
            <span className="dash-action-icon">📁</span>
            <span className="dash-action-title">プロジェクト室</span>
            <span className="dash-action-sub">{activeProjects.length > 0 ? `${activeProjects.length}件進行中` : '新規作成'}</span>
          </button>
          <button className="dash-action-card" onClick={onOpenRoadmap}>
            <span className="dash-action-icon">🗺️</span>
            <span className="dash-action-title">ロードマップ</span>
            <span className="dash-action-sub">次の目標を確認</span>
          </button>
        </div>
      </section>

      {/* ── AIスタッフ 横スクロール ── */}
      <section className="dash-section">
        <div className="dash-section-hd">
          <span className="dash-section-eyebrow">👥 AIスタッフ</span>
          <span className="dash-section-count">{staff.length}名</span>
        </div>
        <div className="dash-staff-strip">
          {staff.map(s => {
            const role = ROLES[s.roleId];
            const hist = chatHistory[s.id] || [];
            const lastMsg = hist.filter(m => m.role === 'assistant').slice(-1)[0];
            return (
              <button
                key={s.id}
                className="dash-staff-tile"
                onClick={() => onOpenChat(s)}
                style={{ '--staff-color': s.color }}
              >
                <div className="dash-staff-avatar" style={{ background: `linear-gradient(135deg, ${s.color}44, ${s.color}22)`, borderColor: s.color }}>
                  {(s.avatar || s.avatarUrl)
                    ? <img src={s.avatar || s.avatarUrl} alt={s.name} className="staff-avatar-img" />
                    : <span style={{ fontSize: 20 }}>{s.emoji}</span>}
                  <span className="staff-status-dot" />
                </div>
                <div className="dash-staff-name">{s.name}</div>
                <div className="dash-staff-role">{role?.title || ''}</div>
                {lastMsg && (
                  <div className="dash-staff-preview">{lastMsg.content.slice(0, 18)}…</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 進行中プロジェクト ── */}
      {activeProjects.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-hd">
            <span className="dash-section-eyebrow">📁 進行中プロジェクト</span>
            <button className="dash-see-all" onClick={onOpenProjects}>すべて見る →</button>
          </div>
          <div className="dash-project-list">
            {activeProjects.slice(0, 3).map(p => {
              const tasks = p.tasks || [];
              const done = tasks.filter(t => t.done).length;
              const total = tasks.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button key={p.id} className="dash-project-card glass-card" onClick={onOpenProjects}>
                  <div className="dash-project-icon">{p.icon || '📁'}</div>
                  <div className="dash-project-body">
                    <div className="dash-project-name">{p.name}</div>
                    <div className="dash-project-meta">
                      <span className="dash-project-status">{p.status || '進行中'}</span>
                      {total > 0 && <span className="dash-project-tasks">{done}/{total} タスク完了</span>}
                    </div>
                    {total > 0 && (
                      <div className="dash-progress-bar">
                        <div className="dash-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ログアウト */}
      {currentUser && (
        <div style={{ padding: '4px 16px 16px', textAlign: 'center' }}>
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

// ============================================
// Chat View — スタッフ個別チャット & ブリーフィング
// ============================================
function ChatView({ staff, allStaff, allRoles, briefingMode, apiKeys, gasUrls, chatHistory, setChatHistory, onBack, showToast, setPendingAction, driveFolderId, registerTask }) {
  const chatKey = briefingMode ? '__briefing__' : (staff?.id || '__none__');
  const messages = useMemo(() => chatHistory[chatKey] || [], [chatHistory, chatKey]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');   // 動画から抽出したフレーム(base64)
  const [videoFileName, setVideoFileName] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(briefingMode ? allStaff.map(s => s.id) : []);
  const [briefingCurrentStaff, setBriefingCurrentStaff] = useState(null); // ブリーフィング中に発言中のスタッフ
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const role = staff ? allRoles[staff.roleId] : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = useCallback((key, msg) => {
    setChatHistory(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), msg]
    }));
  }, [setChatHistory]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return showToast('画像は5MB以下にしてください', 'error');
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return showToast('動画は100MB以下にしてください', 'error');
    setVideoFileName(file.name);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.currentTime = 0.5;
    const capture = () => {
      const canvas = document.createElement('canvas');
      const w = Math.min(video.videoWidth || 640, 640);
      const h = Math.round((video.videoHeight || 360) * (w / (video.videoWidth || 640)));
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      setVideoPreview(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(url);
    };
    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener('loadeddata', () => { if (video.readyState >= 2) capture(); }, { once: true });
  };

  const removeVideo = () => {
    setVideoPreview('');
    setVideoFileName('');
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const syncGasData = async () => {
    const mainUrl = gasUrls && gasUrls[0];
    if (!mainUrl) return showToast('設定画面でGAS URL 1を設定してください', 'error');
    setIsSyncing(true);
    try {
      const targetUrl = mainUrl + (mainUrl.includes('?') ? '&' : '?') + 'action=fetch_data&sheetName=プロジェクト';
      const res = await fetch(targetUrl, { method: 'GET' });
      const data = await res.json();
      if (data.status === 'ok') {
        setInput(prev => prev + (prev ? '\n\n' : '') + data.dataText);
        showToast('最新データを読み込みました', 'success');
      } else {
        showToast('同期エラー: ' + data.message, 'error');
      }
    } catch {
      showToast('通信エラー', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const logToGas = async (staffName, staffRole, userMsg, aiReply) => {
    const validUrls = (gasUrls || []).filter(u => u && u.trim() !== '');
    if (validUrls.length === 0) return;
    
    validUrls.forEach(url => {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'log_chat',
          staffName,
          staffRole,
          message: userMsg,
          response: aiReply
        })
      }).catch(e => console.warn('Logging error:', e));
    });
  };

  const executeTool = async (staffMember, toolCall) => {
    const { name, args } = toolCall;
    if (name === 'reserve_sns_post') {
      const mainUrl = (gasUrls || [])[0];
      if (mainUrl) {
        try {
          await fetch(mainUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'reserve_sns_post',
              platform: args.platform,
              content: args.content,
              staffName: staffMember.name
            })
          });
          showToast('SNS投稿を予約しました', 'success');
          return `実行完了: ${args.platform} への投稿予約を記録しました。`;
        } catch(e) { console.error(e); }
      }
    }
    
    if (name === 'list_drive_materials') {
      const mainUrl = (gasUrls || [])[0];
      if (mainUrl) {
        try {
          const res = await fetch(mainUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'list_drive_files',
              parentFolderId: driveFolderId,
              category: args.category,
              keyword: args.keyword
            })
          });
          const data = await res.json();
          if (data.status === 'ok') {
            const listText = data.files.map(f => `- ${f.name} (ID: ${f.id})`).join('\n');
            return `【ドライブ検索結果: ${data.folderName}】\n${listText || 'ファイルが見つかりませんでした。'}`;
          }
          return `エラー: ${data.message}`;
        } catch(e) { console.error(e); }
      }
    }

    if (name === 'request_agency_task') {
      const mainUrl = (gasUrls || [])[0];
      if (mainUrl) {
        try {
          // クライアントサイドでtaskId生成（no-corsでGASレスポンスが読めないため）
          const taskId = 'task_' + Date.now();
          await fetch(mainUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'add_agency_task',
              taskId,
              staffName: staffMember.name,
              taskType: args.taskType,
              instruction: args.instruction,
              params: args.params
            })
          });
          showToast('実務タスクを登録しました', 'success');
          registerTask?.(taskId, args.taskType);
          return `実行完了: エージェンシー・ブリッジにタスク「${args.taskType}」を登録しました。ID: ${taskId}`;
        } catch(e) { console.error(e); }
      }
    }
    return 'この画面では実行できないツール、またはエラーが発生しました。';
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imagePreview && !videoPreview) || isLoading) return;
    const text = input.trim();
    // 動画優先：フレームを画像として AI に渡す
    const currentImage = videoPreview || imagePreview;
    const currentVideoName = videoFileName;
    let displayMessage = text;
    if (videoPreview) displayMessage = `[動画「${currentVideoName}」]\n` + text;
    else if (imagePreview) displayMessage = '[画像添付]\n' + text;

    setInput('');
    removeImage();
    removeVideo();
    setIsLoading(true);

    addMessage(chatKey, { role: 'user', content: displayMessage, image: currentImage, isVideo: !!videoPreview, ts: Date.now() });

    try {
      if (briefingMode) {
        const targets = allStaff.filter(s => selectedStaff.includes(s.id));
        // 専務→最後、秘書→最後から2番目、他は先に発言
        const facilRank = r => r === 'executive' ? 2 : r === 'secretary' ? 1 : 0;
        const ordered = [...targets].sort((a, b) => facilRank(a.roleId) - facilRank(b.roleId));
        const facilitator = ordered[ordered.length - 1];
        const roundHistory = []; // 前の発言を蓄積

        for (let idx = 0; idx < ordered.length; idx++) {
          const s = ordered[idx];
          const r = allRoles[s.roleId];
          if (!r) continue;

          // 自然な間隔（1〜1.5秒）を挟む
          if (idx > 0) await new Promise(res => setTimeout(res, 1000 + Math.random() * 500));

          setBriefingCurrentStaff(s);

          // 前の発言を文脈として追加
          let prompt = text;
          if (roundHistory.length > 0) {
            prompt += '\n\n【同僚の意見】\n' + roundHistory.map(m => `▶ ${m.name}: ${m.text}`).join('\n');
          }
          // ファシリテーターは全員の意見をまとめてアクション提案
          const isFacil = s.id === facilitator.id;
          if (isFacil && roundHistory.length > 0) {
            prompt += '\n\n以上を踏まえ、全員の意見を簡潔に整理し、社長への最終報告と次のアクション提案をしてください。';
          }

          const res = await sendToAI(apiKeys, s, r, prompt, [], currentImage);
          if (res.text) {
            addMessage(chatKey, { role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: s.emoji, staffAvatar: s.avatar || s.avatarUrl, color: s.color, content: res.text, ts: Date.now() });
            roundHistory.push({ name: s.name, text: res.text });
          }
          if (res.toolCalls && res.toolCalls.length > 0) {
            for (const tc of res.toolCalls) {
              setPendingAction({
                type: tc.name, args: tc.args, staff: s,
                onConfirm: async () => {
                  const result = await executeTool(s, tc);
                  addMessage(chatKey, { role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: '✅', color: s.color, content: `[システム] ${result}`, ts: Date.now() });
                }
              });
            }
          }
          logToGas(s.name, r.title, text, res.text || '[ツール実行]');
        }
        setBriefingCurrentStaff(null);
      } else {
        const res = await sendToAI(apiKeys, staff, role, text, messages.slice(-10), currentImage);
        if (res.text) {
          addMessage(chatKey, { role: 'assistant', staffId: staff.id, staffName: staff.name, staffEmoji: staff.emoji, staffAvatar: staff.avatar || staff.avatarUrl, color: staff.color, content: res.text, ts: Date.now() });
        }
        if (res.toolCalls && res.toolCalls.length > 0) {
          for (const tc of res.toolCalls) {
            setPendingAction({
              type: tc.name, args: tc.args, staff: staff,
              onConfirm: async () => {
                const result = await executeTool(staff, tc);
                addMessage(chatKey, { role: 'assistant', staffId: staff.id, staffName: staff.name, staffEmoji: '✅', color: staff.color, content: `[システム] ${result}`, ts: Date.now() });
              }
            });
          }
        }
        logToGas(staff.name, role.title, text, res.text || '[ツール実行]');
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
        <div style={{display:'flex', gap:4}}>
          <button className="btn btn-ghost btn-sm" disabled={isSyncing} onClick={syncGasData} title="データを同期">{isSyncing ? '⏳' : '📥'}</button>
          <button className="btn btn-ghost btn-sm" onClick={clearChat} title="クリア">🗑️</button>
        </div>
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
                {msg.image && (
                  <div style={{marginBottom: 8}}>
                    <img src={msg.image} style={{maxWidth: '100%', borderRadius: 8}} alt="" />
                  </div>
                )}
                <FormattedMessage text={msg.content} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (() => {
          const thinkingStaff = briefingCurrentStaff || staff;
          return (
            <div className="chat-bubble bubble-ai">
              <div className="bubble-avatar" style={{ background: `linear-gradient(135deg, ${thinkingStaff?.color || 'var(--accent-primary)'}44, ${thinkingStaff?.color || 'var(--accent-primary)'}22)`, borderColor: thinkingStaff?.color || 'var(--border-accent)' }}>
                {(thinkingStaff?.avatar || thinkingStaff?.avatarUrl)
                  ? <img src={thinkingStaff.avatar || thinkingStaff.avatarUrl} alt="" className="staff-avatar-img" />
                  : thinkingStaff?.emoji || '🤖'}
              </div>
              <div className="bubble-body">
                {briefingCurrentStaff && <div className="bubble-from" style={{ color: briefingCurrentStaff.color }}>{briefingCurrentStaff.name}</div>}
                <div className="bubble-content content-ai">
                  <div className="typing-dots"><span /><span /><span /></div>
                  <span className="typing-label">{briefingCurrentStaff ? `${briefingCurrentStaff.name} が考えています...` : '思考中...'}</span>
                </div>
              </div>
            </div>
          );
        })()}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area glass-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {/* 画像プレビュー */}
        {imagePreview && !videoPreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8, width: 'fit-content' }}>
            <img src={imagePreview} style={{ height: 60, borderRadius: 4 }} alt="Preview" />
            <button className="btn btn-icon" style={{ position: 'absolute', top: -5, right: -5, background: 'var(--accent-danger)', color: 'white', width: 20, height: 20, fontSize: 10 }} onClick={removeImage}>✕</button>
          </div>
        )}
        {/* 動画プレビュー（抽出フレーム） */}
        {videoPreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8, width: 'fit-content' }}>
            <img src={videoPreview} style={{ height: 60, borderRadius: 4, border: '2px solid #6c5ce7' }} alt="VideoFrame" />
            <span style={{ position: 'absolute', top: 2, left: 2, background: '#6c5ce7', color: 'white', fontSize: 9, padding: '1px 4px', borderRadius: 3 }}>🎬</span>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{videoFileName}</div>
            <button className="btn btn-icon" style={{ position: 'absolute', top: -5, right: -5, background: 'var(--accent-danger)', color: 'white', width: 20, height: 20, fontSize: 10 }} onClick={removeVideo}>✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageChange} />
          <input type="file" accept="video/*" style={{ display: 'none' }} ref={videoInputRef} onChange={handleVideoChange} />
          <button className="btn btn-ghost btn-icon" style={{ flexShrink: 0 }} onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="画像を添付">🖼️</button>
          <button className="btn btn-ghost btn-icon" style={{ flexShrink: 0 }} onClick={() => videoInputRef.current?.click()} disabled={isLoading} title="動画を添付">🎬</button>
          <textarea
            ref={inputRef}
            className="chat-textarea"
            placeholder={briefingMode ? '全スタッフに指示・相談など...' : `${staff?.name}に相談...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            rows={1}
            disabled={isLoading || (briefingMode && selectedStaff.length === 0)}
          />
          <button
            className="btn btn-primary send-btn"
            style={{ flexShrink: 0 }}
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !imagePreview && !videoPreview) || (briefingMode && selectedStaff.length === 0)}
          >
            {isLoading ? '⏳' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Projects View — プロジェクト管理
// ============================================
function ProjectsView({ projects, setProjects, staff, allRoles, apiKeys, chatHistory, setChatHistory, activeProject, setActiveProject, onBack, showToast, setPendingAction, cloudPush, driveFolderId, setPendingReports }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGasUrl1, setNewGasUrl1] = useState('');
  const [newGasUrl2, setNewGasUrl2] = useState('');
  const [newGasUrl3, setNewGasUrl3] = useState('');

  const createProject = () => {
    if (!newName.trim()) return;
    const p = {
      id: 'proj_' + Date.now(),
      name: newName.trim(),
      desc: newDesc.trim(),
      gasUrls: [newGasUrl1.trim(), newGasUrl2.trim(), newGasUrl3.trim()].filter(Boolean),
      icon: '📁',
      status: '進行中',
      createdAt: Date.now(),
      tasks: [],
    };
    setProjects(prev => [...prev, p]);
    setNewName(''); setNewDesc(''); setNewGasUrl1(''); setNewGasUrl2(''); setNewGasUrl3('');
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
        allRoles={allRoles}
        apiKeys={apiKeys}
        chatHistory={chatHistory}
        setChatHistory={setChatHistory}
        onBack={() => setActiveProject(null)}
        showToast={showToast}
        setPendingAction={setPendingAction}
        cloudPush={cloudPush}
        driveFolderId={driveFolderId}
        setPendingReports={setPendingReports}
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
                <label>関連URL・スプレッドシート（任意: 最大3つ）</label>
                <input className="input-field" placeholder="1. https://..." value={newGasUrl1} onChange={e => setNewGasUrl1(e.target.value)} style={{ marginBottom: 4 }} />
                <input className="input-field" placeholder="2. https://..." value={newGasUrl2} onChange={e => setNewGasUrl2(e.target.value)} style={{ marginBottom: 4 }} />
                <input className="input-field" placeholder="3. https://..." value={newGasUrl3} onChange={e => setNewGasUrl3(e.target.value)} />
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
                {(p.gasUrl || (p.gasUrls && p.gasUrls.length > 0)) && <div className="project-card-gas">🔗 関連リンクあり</div>}
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
function ProjectDetailView({ project, setProject, staff, allRoles, apiKeys, chatHistory, setChatHistory, onBack, showToast, setPendingAction, cloudPush, driveFolderId, setPendingReports }) {
  const chatKey = 'proj_chat_' + project.id;
  const messages = useMemo(() => {
    const val = chatHistory[chatKey];
    return Array.isArray(val) ? val : [];
  }, [chatHistory, chatKey]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState([staff[0]?.id || '']);
  const [newTask, setNewTask] = useState('');
  const [reportDraft, setReportDraft] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [showMeeting, setShowMeeting] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = useCallback((msg) => {
    setChatHistory(prev => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), msg] }));
  }, [chatKey, setChatHistory]);

  const gasLinks = project.gasUrls?.length > 0 ? project.gasUrls : (project.gasUrl ? [project.gasUrl] : []);

  const executeTool = async (staffMember, toolCall) => {
    const { name, args } = toolCall;
    
    if (name === 'add_project_task') {
      const task = { id: Date.now(), text: args.text, done: false };
      const updated = { ...project, tasks: [...(project.tasks || []), task] };
      setProject(updated);
      showToast('タスクを追加しました', 'success');
      return `実行完了: タスク「${args.text}」を追加しました。`;
    }
    
    if (name === 'update_project_status') {
      setProject({ ...project, status: args.status });
      return `実行完了: プロジェクトのステータスを「${args.status}」に変更しました。`;
    }

    if (name === 'list_drive_materials') {
      const mainUrl = (loadData('gasUrls') || [])[0];
      if (mainUrl) {
        try {
          const res = await fetch(mainUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'list_drive_files',
              parentFolderId: driveFolderId,
              category: args.category,
              keyword: args.keyword
            })
          });
          const data = await res.json();
          if (data.status === 'ok') {
            const listText = data.files.map(f => `- ${f.name} (ID: ${f.id})`).join('\n');
            return `【ドライブ検索結果: ${data.folderName}】\n${listText || 'ファイルが見つかりませんでした。'}`;
          }
          return `エラー: ${data.message}`;
        } catch(e) { console.error(e); }
      }
    }

    if (name === 'request_agency_task') {
      const mainUrl = (loadData('gasUrls') || [])[0];
      if (mainUrl) {
        try {
          const taskId = 'task_' + Date.now();
          await fetch(mainUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'add_agency_task',
              taskId,
              staffName: project.name + ' (Proj)',
              taskType: args.taskType,
              instruction: args.instruction,
              params: { ...(args.params || {}), projectId: project.id, projectName: project.name }
            })
          });
          showToast('実務タスクを登録しました', 'success');
          return `実行完了: エージェンシー・ブリッジにタスク「${args.taskType}」を登録しました。ID: ${taskId}`;
        } catch(e) { console.error(e); }
      }
    }
    
    if (name === 'reserve_sns_post') {
      const mainUrl = loadData('gasUrls')?.[0]; // Appコンポーネントの外からアクセスする場合
      if (mainUrl) {
        try {
          await fetch(mainUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'reserve_sns_post',
              platform: args.platform,
              content: args.content,
              staffName: staffMember.name
            })
          });
          showToast('SNS投稿を予約しました', 'success');
        } catch(e) { console.error(e); }
      }
      return `実行完了: ${args.platform} への投稿予約を記録しました。`;
    }
    return '不明なツールです。';
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imagePreview && !videoPreview) || isLoading || selectedStaffIds.length === 0) return;

    const targets = staff.filter(s => selectedStaffIds.includes(s.id));
    if (targets.length === 0) return;

    const currentImage = videoPreview || imagePreview;
    const textInput = input.trim();
    let displayContent = textInput;
    if (videoPreview) displayContent = `[動画「${videoFileName}」]\n` + textInput;
    else if (imagePreview) displayContent = '[画像添付]\n' + textInput;

    const gasContext = gasLinks.length > 0 ? gasLinks.join('\n') : 'なし';
    const taskContext = (project.tasks || []).map(t => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n') || 'なし';
    const context = `【プロジェクト情報】\n名前: ${project.name}\n概要: ${project.desc || 'なし'}\n現在のステータス: ${project.status}\n関連URL:\n${gasContext}\n\n【現在のタスクリスト】\n${taskContext}\n\n上記を踏まえて相談に応じたり、必要に応じてツール（タスク追加、ステータス変更、SNS投稿予約）を使って実際の業務をサポートしてください。`;

    const fullMsg = context + '\n\n' + textInput;
    setInput('');
    clearMedia();
    setIsLoading(true);

    addMessage({ role: 'user', content: displayContent, image: currentImage, isVideo: !!videoPreview, ts: Date.now() });

    try {
      for (const s of targets) {
        const role = ROLES[s.roleId];
        if (!role) continue;
        const res = await sendToAI(apiKeys, s, role, fullMsg, messages.slice(-6), currentImage);
        
        // テキスト回答があれば表示
        if (res.text) {
          addMessage({ role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: s.emoji, color: s.color, content: res.text, ts: Date.now() });
        }
        
        // ツール呼び出しがあれば確認フローへ
        if (res.toolCalls && res.toolCalls.length > 0) {
          for (const tc of res.toolCalls) {
            setPendingAction({
              type: tc.name,
              args: tc.args,
              staff: s,
              onConfirm: async () => {
                const result = await executeTool(s, tc);
                // 実行結果をAIにフィードバック（オプション：次回の会話に反映される）
                addMessage({ role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: '✅', color: s.color, content: `[システム] ${result}`, ts: Date.now() });
                // 更新をクラウドへ
                setTimeout(() => cloudPush(), 1000);
              },
              onCancel: () => {
                addMessage({ role: 'assistant', staffId: s.id, staffName: s.name, staffEmoji: '⚠️', color: s.color, content: `[システム] ${tc.name} の実行がユーザーによりキャンセルされました。`, ts: Date.now() });
              }
            });
          }
        }
      }
    } catch (e) {
      showToast('エラー: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast('画像は5MB以下にしてください', 'error');
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return showToast('動画は100MB以下にしてください', 'error');
    setVideoFileName(file.name);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url; video.muted = true; video.currentTime = 0.5;
    const capture = () => {
      const canvas = document.createElement('canvas');
      const w = Math.min(video.videoWidth || 640, 640);
      const h = Math.round((video.videoHeight || 360) * (w / (video.videoWidth || 640)));
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      setVideoPreview(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(url);
    };
    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener('loadeddata', () => { if (video.readyState >= 2) capture(); }, { once: true });
  };

  const clearMedia = () => {
    setImagePreview(''); setVideoPreview(''); setVideoFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
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

  const generateReport = async () => {
    const akari = staff.find(s => s.id === 'akari');
    if (!akari) return showToast('アカリが見つかりません', 'error');
    if (!apiKeys?.anthropic && !apiKeys?.gemini) return showToast('APIキーを設定してください', 'error');
    setReportLoading(true);
    setReportDraft('');
    const taskList = (project.tasks || []).map(t => `- [${t.done ? '完了' : '未完了'}] ${t.text}`).join('\n') || 'タスクなし';
    const prompt = `あなたは「アカリ」（プロデューサー）として、以下のプロジェクトの完了報告書を作成してください。\n\n【プロジェクト名】${project.name}\n【概要】${project.desc || 'なし'}\n【ステータス】${project.status}\n\n【タスク一覧】\n${taskList}\n\n報告書には「成果サマリー」「完了タスク」「残課題」「次のアクション提案」を含め、役員会議（ラウンドテーブル）に持ち込めるよう簡潔にまとめてください。`;
    try {
      const role = ROLES[akari.roleId];
      const res = await sendToAI(apiKeys, akari, role, prompt, []);
      setReportDraft(res.text || '');
    } catch (e) {
      showToast('レポート生成に失敗: ' + e.message, 'error');
    } finally {
      setReportLoading(false);
    }
  };

  const submitToTable = () => {
    if (!reportDraft.trim()) return;
    setPendingReports(prev => [...prev, {
      id: Date.now(),
      projectId: project.id,
      projectName: project.name,
      projectIcon: project.icon,
      report: reportDraft,
      ts: Date.now()
    }]);
    showToast('ラウンドテーブルに持ち込みました', 'success');
    setReportDraft('');
  };

  return (
    <div className="page-view animate-fadein">
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={onBack}>‹</button>
        <h1 className="page-title">{project.icon} {project.name}</h1>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setShowMeeting(true)}>
          🗣️ ミーティング
        </button>
      </div>
      {showMeeting && (
        <ProjectMeetingOverlay
          project={project}
          staff={staff}
          allRoles={allRoles}
          apiKeys={apiKeys}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          setPendingAction={setPendingAction}
          showToast={showToast}
          executeTool={executeTool}
          onClose={() => setShowMeeting(false)}
        />
      )}

      <div className="project-detail-body">
        {/* Info */}
        {(project.desc || gasLinks.length > 0) && (
          <div className="glass-card detail-info-card">
            {project.desc && <p className="detail-desc">{project.desc}</p>}
            {gasLinks.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {gasLinks.map((url, i) => (
                  <a key={i} className="gas-link" href={url} target="_blank" rel="noopener noreferrer">
                    🔗 関連リンク {i + 1}
                  </a>
                ))}
              </div>
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
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
            <button className="btn btn-ghost btn-sm w-full" onClick={generateReport} disabled={reportLoading}>
              {reportLoading ? '⏳ アカリが報告書を作成中...' : '💡 完了報告書を作成（アカリ）'}
            </button>
            {reportDraft && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>📄 完了報告書（アカリ作成）</div>
                <div className="glass-card" style={{ padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
                  <FormattedMessage text={reportDraft} />
                </div>
                <button className="btn btn-primary btn-sm w-full" style={{ marginTop: 8 }} onClick={submitToTable}>
                  🗣️ ラウンドテーブルに持ち込む
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Consultation */}
        <div className="consultation-section">
          <div className="consultation-header">💼 スタッフに相談</div>
          <div className="staff-selector-row">
            {staff.map(s => (
              <button
                key={s.id}
                className={`staff-chip ${selectedStaffIds.includes(s.id) ? 'selected' : ''}`}
                style={{ '--chip-color': s.color }}
                onClick={() => setSelectedStaffIds(prev => 
                  prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                )}
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
                  {msg.image && (
                    <div style={{ marginBottom: 4 }}>
                      <img src={msg.image} alt={msg.isVideo ? '動画フレーム' : '添付画像'}
                        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block',
                          border: msg.isVideo ? '2px solid #6c5ce7' : '1px solid var(--border-color)' }} />
                      {msg.isVideo && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>🎬 動画フレーム</div>}
                    </div>
                  )}
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
            {(imagePreview || videoPreview) && (
              <div style={{ padding: '4px 0 8px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={videoPreview || imagePreview} alt="preview"
                    style={{ height: 64, borderRadius: 6, display: 'block',
                      border: videoPreview ? '2px solid #6c5ce7' : '1px solid var(--border-color)' }} />
                  {videoPreview && <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 10, color: '#fff', background: '#6c5ce7', borderRadius: 3, padding: '0 3px' }}>🎬</div>}
                  <button onClick={clearMedia}
                    style={{ position: 'absolute', top: -6, right: -6, background: '#ff4757', color: '#fff',
                      border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button className="btn btn-ghost btn-icon" style={{ fontSize: 18, padding: '0 4px', flexShrink: 0 }}
                onClick={() => fileInputRef.current?.click()} title="画像を添付">🖼️</button>
              <button className="btn btn-ghost btn-icon" style={{ fontSize: 18, padding: '0 4px', flexShrink: 0 }}
                onClick={() => videoInputRef.current?.click()} title="動画を添付">🎬</button>
              <textarea
                className="chat-textarea"
                placeholder="プロジェクトについて相談..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                rows={1}
                disabled={isLoading}
              />
              <button className="btn btn-primary send-btn" onClick={sendMessage}
                disabled={isLoading || (!input.trim() && !imagePreview && !videoPreview)}>
                {isLoading ? '⏳' : '送信'}
              </button>
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageChange} />
            <input type="file" accept="video/*" style={{ display: 'none' }} ref={videoInputRef} onChange={handleVideoChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Project Meeting Overlay — 自律ミーティング
// ============================================
function ProjectMeetingOverlay({ project, staff, allRoles, apiKeys, chatHistory, setChatHistory, setPendingAction, showToast, executeTool, onClose }) {
  const meetingKey = 'proj_meeting_' + project.id;
  const msgsRef = useRef(() => {
    const v = chatHistory[meetingKey];
    return Array.isArray(v) ? v : [];
  });
  // Initialize msgsRef once
  if (!Array.isArray(msgsRef.current)) msgsRef.current = (() => {
    const v = chatHistory[meetingKey];
    return Array.isArray(v) ? v : [];
  })();

  const [displayMsgs, setDisplayMsgs] = useState(() => {
    const v = chatHistory[meetingKey];
    return Array.isArray(v) ? v : [];
  });
  const [running, setRunning] = useState(false);
  const [pausedForUser, setPausedForUser] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => staff.map(s => s.id));
  const runningRef = useRef(false);
  const turnIndexRef = useRef(0);
  const sessionTurnsRef = useRef(0);
  const bottomRef = useRef(null);
  const runTurnRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [displayMsgs]);
  useEffect(() => { return () => { runningRef.current = false; }; }, []);

  const toggleStaff = (id) => {
    if (running) return; // 進行中は変更不可
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(x => x !== id) : prev // 最低1人
        : [...prev, id]
    );
  };

  // 選択スタッフのみ、general → secretary → executive 順
  const meetingStaff = useMemo(() => {
    const rank = r => r === 'executive' ? 2 : r === 'secretary' ? 1 : 0;
    return staff
      .filter(s => selectedIds.includes(s.id))
      .sort((a, b) => rank(a.roleId) - rank(b.roleId));
  }, [staff, selectedIds]);

  const addMsg = (msg) => {
    const next = [...msgsRef.current, msg];
    msgsRef.current = next;
    setDisplayMsgs([...next]);
    setChatHistory(prev => ({ ...prev, [meetingKey]: next }));
  };

  const buildPrompt = (speaker, role, msgs) => {
    const recent = msgs.slice(-10).map(m =>
      m.role === 'user' ? `社長: ${m.content}`
      : m.role === 'system' ? ''
      : `${m.staffName}: ${m.content}`
    ).filter(Boolean).join('\n');

    const taskContext = (project.tasks || []).filter(t => !t.done).map(t => `- ${t.text}`).join('\n') || 'なし';

    const roleExtra = role.id === 'executive'
      ? '\n【専務として】方向性・意思決定が必要な場面では「@社長:（質問内容）」で始まる一文で判断を仰いでください。各スタッフへ具体的な役割指示も行ってください。'
      : role.id === 'secretary'
      ? '\n【秘書として】スケジュール・タスク管理について専門的に発言してください。手作業タスクが必要な場合は「@社長:タスク確認:（内容）」で確認してください。'
      : `\n【${role.title}として】あなたの専門領域（${(role.skills || []).join('・') || role.title}）の視点から具体的な意見・提案をしてください。`;

    return `あなたは「${project.name}」プロジェクトのミーティングに参加している${speaker.name}（${role.title}）です。

【プロジェクト概要】${project.desc || 'なし'}
【未完了タスク】\n${taskContext}

【直近の発言】
${recent || '（ミーティング開始）'}

他のスタッフの発言を踏まえ、プロジェクト推進に役立つ発言をしてください。必要なら@名前で呼びかけてください。外部リサーチ・制作が必要ならrequest_agency_taskを使ってください。3〜4文以内で簡潔に。${roleExtra}`;
  };

  // Define runTurn as a regular function stored in ref (always latest closure)
  const runTurn = async () => {
    if (!runningRef.current) return;

    const idx = turnIndexRef.current % meetingStaff.length;
    const speaker = meetingStaff[idx];
    const role = allRoles[speaker?.roleId];
    if (!speaker || !role) {
      turnIndexRef.current++;
      setTimeout(() => runTurnRef.current?.(), 300);
      return;
    }

    setCurrentSpeaker(speaker);

    try {
      const prompt = buildPrompt(speaker, role, msgsRef.current);
      const res = await sendToAI(apiKeys, speaker, role, prompt, msgsRef.current.slice(-6), null, false);
      if (!runningRef.current) return;

      // Tool call → approval modal, then STOP (wait for agent result, don't auto-resume)
      if (res.toolCalls && res.toolCalls.length > 0) {
        if (res.text) {
          addMsg({ role: 'assistant', staffId: speaker.id, staffName: speaker.name, staffEmoji: speaker.emoji, color: speaker.color, content: res.text, ts: Date.now() });
        }
        runningRef.current = false;
        setRunning(false);
        setCurrentSpeaker(null);
        const tc = res.toolCalls[0];
        const isAgencyTask = tc.name === 'request_agency_task';
        setPendingAction({
          type: tc.name, args: tc.args, staff: speaker,
          onConfirm: async () => {
            try {
              const result = await executeTool(speaker, tc);
              addMsg({ role: 'assistant', staffId: speaker.id, staffName: speaker.name, staffEmoji: '✅', color: speaker.color, content: `[実行完了] ${result}`, ts: Date.now() });
            } catch {}
            if (isAgencyTask) {
              // エージェント依頼後はミーティングを止める（結果待ち）
              addMsg({ role: 'system', content: 'エージェントへの依頼を登録しました。結果が届いたら「▶ 再開」を押してください。', ts: Date.now() });
              // 停止のまま何もしない
            } else {
              turnIndexRef.current++;
              sessionTurnsRef.current++;
              runningRef.current = true;
              setRunning(true);
              setTimeout(() => runTurnRef.current?.(), 1500);
            }
          },
          onCancel: () => {
            addMsg({ role: 'system', content: 'タスク登録がキャンセルされました。', ts: Date.now() });
            // キャンセルでも再開しない（ユーザーが手動で再開）
          }
        });
        return;
      }

      if (res.text) {
        addMsg({ role: 'assistant', staffId: speaker.id, staffName: speaker.name, staffEmoji: speaker.emoji, color: speaker.color, content: res.text, ts: Date.now() });
        // Executive asking user → pause
        if (res.text.includes('@社長')) {
          runningRef.current = false;
          setRunning(false);
          setPausedForUser(true);
          setCurrentSpeaker(null);
          return;
        }
      }
    } catch (e) {
      console.error('[Meeting] turn error:', e);
      showToast('ミーティングエラー: ' + e.message, 'error');
    }

    turnIndexRef.current++;
    sessionTurnsRef.current++;
    setCurrentSpeaker(null);

    // 全員1周したら自動停止（同じ話を繰り返させない）
    if (sessionTurnsRef.current >= meetingStaff.length) {
      runningRef.current = false;
      setRunning(false);
      addMsg({ role: 'system', content: '全員が発言しました。続きは「▶ 再開」を押してください。', ts: Date.now() });
      return;
    }

    if (runningRef.current) {
      setTimeout(() => runTurnRef.current?.(), 2500);
    }
  };
  // Update ref after render (never during render)
  useEffect(() => { runTurnRef.current = runTurn; });

  const startMeeting = () => {
    if (msgsRef.current.length === 0) {
      addMsg({ role: 'system', content: `ミーティング開始 ${new Date().toLocaleTimeString('ja-JP')}`, ts: Date.now() });
    }
    sessionTurnsRef.current = 0;
    runningRef.current = true;
    setRunning(true);
    setPausedForUser(false);
    setTimeout(() => runTurnRef.current?.(), 500);
  };

  const pauseMeeting = () => {
    runningRef.current = false;
    setRunning(false);
    setCurrentSpeaker(null);
  };

  const resumeMeeting = () => {
    sessionTurnsRef.current = 0; // 再開したら1周カウントをリセット
    runningRef.current = true;
    setRunning(true);
    setPausedForUser(false);
    turnIndexRef.current++;
    setTimeout(() => runTurnRef.current?.(), 500);
  };

  const stopMeeting = () => {
    runningRef.current = false;
    setRunning(false);
    setCurrentSpeaker(null);
    setPausedForUser(false);
    addMsg({ role: 'system', content: `ミーティング終了 ${new Date().toLocaleTimeString('ja-JP')}`, ts: Date.now() });
  };

  const sendUserMsg = () => {
    const txt = userInput.trim();
    if (!txt) return;
    addMsg({ role: 'user', content: txt, ts: Date.now() });
    setUserInput('');
    if (pausedForUser || !running) {
      setPausedForUser(false);
      runningRef.current = true;
      setRunning(true);
      turnIndexRef.current++;
      setTimeout(() => runTurnRef.current?.(), 800);
    }
  };

  return (
    <div className="meeting-overlay">
      {/* Header */}
      <div className="meeting-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🗣️</span>
          <div style={{ minWidth: 0 }}>
            <div className="meeting-title">{project.name} ミーティング</div>
            <div className="meeting-subtitle">
              {running
                ? currentSpeaker ? `${currentSpeaker.emoji} ${currentSpeaker.name} が発言中...` : '進行中'
                : pausedForUser ? '⏸ 社長の回答待ち'
                : '停止中'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {!running && !pausedForUser && (
            <button className="btn btn-primary btn-sm" onClick={startMeeting}>
              {displayMsgs.length === 0 ? '▶ 開始' : '▶ 再開'}
            </button>
          )}
          {running && (
            <button className="btn btn-ghost btn-sm" onClick={pauseMeeting}>⏸</button>
          )}
          {!running && displayMsgs.length > 0 && !pausedForUser && (
            <button className="btn btn-ghost btn-sm" onClick={stopMeeting}>⏹ 終了</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { pauseMeeting(); onClose(); }}>✕ 閉じる</button>
        </div>
      </div>

      {/* Staff selector */}
      <div className="meeting-staff-row">
        {staff.map(s => {
          const selected = selectedIds.includes(s.id);
          const isSpeaking = currentSpeaker?.id === s.id;
          return (
            <button key={s.id}
              className={`meeting-staff-chip${selected ? ' selected' : ' unselected'}${isSpeaking ? ' speaking' : ''}`}
              style={{ '--chip-color': s.color }}
              onClick={() => toggleStaff(s.id)}
              title={running ? '進行中は変更できません' : (selected ? 'クリックで除外' : 'クリックで参加')}>
              <span>{s.emoji}</span>
              <span>{s.name}</span>
              {isSpeaking && <span className="speaking-dots"><span /><span /><span /></span>}
            </button>
          );
        })}
        {!running && <span className="meeting-staff-hint">タップで参加／除外</span>}
      </div>

      {/* Messages */}
      <div className="meeting-messages">
        {displayMsgs.map((msg, i) => {
          if (msg.role === 'system') {
            return <div key={i} className="meeting-system-msg">{msg.content}</div>;
          }
          if (msg.role === 'user') {
            return (
              <div key={i} className="meeting-bubble meeting-bubble-user">
                <div className="meeting-bubble-name" style={{ color: 'var(--accent-primary)' }}>社長</div>
                <div className="meeting-bubble-text"><FormattedMessage text={msg.content} /></div>
              </div>
            );
          }
          const isQuestion = msg.content?.includes('@社長');
          return (
            <div key={i} className={`meeting-bubble${isQuestion ? ' meeting-bubble-question' : ''}`}
              style={{ borderLeftColor: msg.color }}>
              <div className="meeting-bubble-name" style={{ color: msg.color }}>{msg.staffEmoji} {msg.staffName}</div>
              <div className="meeting-bubble-text"><FormattedMessage text={msg.content} /></div>
            </div>
          );
        })}
        {running && currentSpeaker && (
          <div className="meeting-bubble" style={{ borderLeftColor: currentSpeaker.color, opacity: 0.6 }}>
            <div className="meeting-bubble-name" style={{ color: currentSpeaker.color }}>{currentSpeaker.emoji} {currentSpeaker.name}</div>
            <div><div className="typing-dots"><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="meeting-input-area">
        {pausedForUser && (
          <div className="meeting-question-hint">
            専務から質問があります。回答するとミーティングを再開します。
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            className="chat-textarea"
            placeholder={pausedForUser ? '社長として回答してください...' : '@ハルキ 追加調査をお願い / コメントを入力（Enter送信）'}
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMsg(); } }}
            rows={1}
          />
          <button className="btn btn-primary send-btn" onClick={sendUserMsg} disabled={!userInput.trim()}>
            {pausedForUser ? '回答' : '送信'}
          </button>
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

// Settings View
// ============================================
function SettingsView({ apiKeys, setApiKeys, gasUrls, setGasUrls, cloudPush, cloudPull, isCloudSyncing, onBack, showToast, driveFolderId, setDriveFolderId }) {
  const [anthropicInput, setAnthropicInput] = useState(apiKeys?.anthropic || '');
  const [geminiInput, setGeminiInput] = useState(apiKeys?.gemini || '');
  const [gasInput1, setGasInput1] = useState(gasUrls[0] || '');
  const [gasInput2, setGasInput2] = useState(gasUrls[1] || '');
  const [gasInput3, setGasInput3] = useState(gasUrls[2] || '');
  const [driveIdInput, setDriveIdInput] = useState(driveFolderId || '');
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  const saveSettings = () => {
    setApiKeys({ anthropic: anthropicInput.trim(), gemini: geminiInput.trim() });
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

        {/* GAS URL */}
        <div className="glass-card settings-card">
          <div className="settings-card-title">📊 スプレッドシート連携 (GAS)</div>
          <p className="settings-card-desc">最大3つのシートへ同時にデータを記録できます。</p>
          <div className="api-key-row" style={{flexDirection: 'column', gap: '8px'}}>
            <input
              className="input-field"
              type="text"
              placeholder="URL 1: https://script.google.com/..."
              value={gasInput1}
              onChange={e => setGasInput1(e.target.value)}
            />
            <input
              className="input-field"
              type="text"
              placeholder="URL 2: https://script.google.com/..."
              value={gasInput2}
              onChange={e => setGasInput2(e.target.value)}
            />
            <input
              className="input-field"
              type="text"
              placeholder="URL 3: https://script.google.com/..."
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

// ============================================
// Staff Management View — スタッフ・役職の増員
// ============================================
function StaffManagementView({ staff, setStaff, setCustomRoles, allRoles, onBack, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', emoji: '', avatarUrl: '', roleId: 'executive' });
  const [isNewRole, setIsNewRole] = useState(false);
  const [newRole, setNewRole] = useState({ id: '', title: '', aiMode: 'BALANCED', temperature: 0.7, skills: '', systemPrompt: '' });

  const syncDefaults = () => {
    const currentIds = staff.map(s => s.id);
    const missing = DEFAULT_STAFF.filter(d => !currentIds.includes(d.id));
    if (missing.length === 0) {
      showToast('すべての標準スタッフは既に追加されています', 'info');
      return;
    }
    setStaff(prev => [...prev, ...missing]);
    showToast(`${missing.length}名の標準スタッフを追加しました`, 'success');
  };

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={syncDefaults}>🔄 標準同期</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>＋ 追加</button>
        </div>

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

// ============================================
// FormattedMessage — マークダウン風整形
// ============================================
function FormattedMessage({ text }) {
  if (!text) return null;
  if (typeof text !== 'string') return <span>{JSON.stringify(text)}</span>;

  // **太字** をspanに変換
  const renderInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  const lines = text.split('\n');
  let inCodeBlock = false;
  const codeLines = [];

  const elements = [];
  let emptyCount = 0;

  lines.forEach((line, i) => {
    // コードブロック
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines.length = 0;
      } else {
        inCodeBlock = false;
        elements.push(
          <pre key={i} className="msg-code">{codeLines.join('\n')}</pre>
        );
      }
      return;
    }
    if (inCodeBlock) { codeLines.push(line); return; }

    // 空行: 連続2行以上は1行に圧縮
    if (line.trim() === '') {
      emptyCount++;
      if (emptyCount === 1) elements.push(<div key={i} className="msg-spacer" />);
      return;
    }
    emptyCount = 0;

    if (line.startsWith('# '))  { elements.push(<h2 key={i} className="msg-h1">{renderInline(line.slice(2))}</h2>); return; }
    if (line.startsWith('## ')) { elements.push(<h3 key={i} className="msg-h2">{renderInline(line.slice(3))}</h3>); return; }
    if (line.startsWith('### ') || line.startsWith('■ ')) {
      elements.push(<div key={i} className="msg-section">{renderInline(line.replace(/^(### |■ )/, ''))}</div>); return;
    }
    if (line.startsWith('---') || line.startsWith('===')) {
      elements.push(<hr key={i} className="msg-hr" />); return;
    }
    if (line.match(/^(\d+\.) /)) {
      elements.push(<div key={i} className="msg-list-item msg-ol">{renderInline(line)}</div>); return;
    }
    if (line.match(/^[-•*] /)) {
      elements.push(<div key={i} className="msg-list-item msg-ul">{'• '}{renderInline(line.slice(2))}</div>); return;
    }
    elements.push(<p key={i} className="msg-p">{renderInline(line)}</p>);
  });

  return <div className="formatted-msg">{elements}</div>;
}
