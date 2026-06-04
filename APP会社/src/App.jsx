import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ROLES, DEFAULT_STAFF, DEFAULT_GAS_URL,
  sendToAI, loadData, saveData
} from './store.js';
import './App.css';
import AgentCompany from './components/AgentCompany/AgentCompany';
import HomeView from './views/HomeView.jsx';
import ChatView from './views/ChatView.jsx';
import ProjectsView from './views/ProjectsView.jsx';
import RoadmapView from './views/RoadmapView.jsx';
import SettingsView from './views/SettingsView.jsx';
import StaffManagementView from './views/StaffManagementView.jsx';
import DiscussionView from './views/DiscussionView.jsx';
import XView from './views/XView.jsx';
import YouTubeView from './views/YouTubeView.jsx';
import AttendanceView from './views/AttendanceView.jsx';
import SalesView from './views/SalesView.jsx';
import AffiliateView from './views/AffiliateView.jsx';
import PipelineView from './views/PipelineView.jsx';
import HALView from './views/HALView.jsx';
import PromptsView from './views/PromptsView.jsx';
import MonetizationView from './views/MonetizationView.jsx';

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

const CURRENT_USER = { name: 'KCS', projectCode: 'KCS', role: 'admin' };

// ============================================
// App Root
// ============================================
export default function App() {
  const currentUser = CURRENT_USER;

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || params.get('view');
    if (tab === 'live' || tab === 'hal') return 'hal';
    return 'home';
  });
  const [apiKeys, setApiKeys] = useState(() => {
    // 1. localStorage
    const saved = loadData('apiKeys');
    if (saved?.anthropic || saved?.gemini) return saved;
    // 2. sessionStorage（ページリロード時のフォールバック）
    try {
      const ss = sessionStorage.getItem('kcs_api_keys_session');
      if (ss) { const parsed = JSON.parse(ss); if (parsed?.anthropic || parsed?.gemini) return parsed; }
    } catch (e) { void e; }
    // 3. 旧データから移行
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
    if (saved && Array.isArray(saved) && saved[0]) return saved;
    const legacy = loadData('gasUrl');
    // bridge.config.json の DEFAULT_GAS_URL を自動フォールバック
    return [legacy || DEFAULT_GAS_URL, '', ''];
  });
  const [driveFolderId, setDriveFolderId] = useState(() => loadData('driveFolderId') || '1c1qhkU6D6S27PHUKOv5vgivNXTXVEEPI');
  const [roundtableProjectId, setRoundtableProjectId] = useState(() => loadProjectData('roundtableProjectId') || '');
  const [pendingReports, setPendingReports] = useState(() => loadProjectData('pendingReports') || []);
  const [activeStaff, setActiveStaff] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [toast, setToast] = useState(null);
  const [briefingMode, setBriefingMode] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type, args, staff, onConfirm, onCancel }
  const [pipelineTeam, setPipelineTeam] = useState(null);

  // ============================================
  // 外部アプリ監視
  // ============================================
  const DEFAULT_MONITORED_APPS = [
    {
      id: 'kcs-dashboard',
      name: 'KCS ダッシュボード',
      url: 'https://nexus-co-66f9b.web.app',
      icon: '🧰',
      color: '#3498db',
      gasUrl: DEFAULT_GAS_URL,
      status: 'checking',
      lastChecked: null,
      newCount: 0,
      stockSummary: null,
      lastError: null,
    },
    {
      id: 'pizza-hi-sta',
      name: 'Pizza 通知アプリ',
      url: 'https://pizza-hi-sta.web.app',
      icon: '🍕',
      color: '#e74c3c',
      gasUrl: 'https://script.google.com/macros/s/AKfycbwlUczPBlz7x_CfNPdpvM-pizrcXnk3250d62J5vFdA6d3lpF1IdEJUlm3RqyZK2NUx/exec',
      status: 'checking',
      lastChecked: null,
      newCount: 0,         // 在庫あり件数
      stockSummary: null,  // { inStock: N, outOfStock: N, unknown: N }
      lastError: null,
    },
  ];
  const [monitoredApps, setMonitoredApps] = useState(() => {
    const saved = loadData('monitoredApps') || [];
    // デフォルトに新アプリが追加された場合、保存済みリストにマージ
    const merged = [...saved];
    for (const def of DEFAULT_MONITORED_APPS) {
      if (!merged.find(a => a.id === def.id)) merged.push(def);
      // gasUrlが空ならデフォルト値で補完
      const idx = merged.findIndex(a => a.id === def.id);
      if (idx >= 0 && !merged[idx].gasUrl && def.gasUrl) {
        merged[idx] = { ...merged[idx], gasUrl: def.gasUrl };
      }
    }
    return merged.length > 0 ? merged : DEFAULT_MONITORED_APPS;
  });

  // 死活監視 + 新着カウント
  const monitoredAppsRef = useRef(monitoredApps);
  const pushNotifyRef = useRef(null);
  useEffect(() => { monitoredAppsRef.current = monitoredApps; }, [monitoredApps]);

  useEffect(() => {
    const checkAll = async () => {
      const current = monitoredAppsRef.current;
      const updated = await Promise.all(current.map(async (app) => {
        // ── 死活チェック（2連続失敗でdown判定） ──
        let status = 'up';
        let lastError = null;
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          await fetch(app.url, { mode: 'no-cors', signal: ctrl.signal });
          clearTimeout(tid);
          status = 'up';
        } catch (err) {
          status = err.name === 'AbortError' ? 'timeout' : 'down';
          lastError = err.name === 'AbortError' ? 'タイムアウト（8秒）' : err.message;
        }

        // 連続失敗カウント（1回の失敗ではdownにしない）
        const failCount = status !== 'up' ? (app.failCount || 0) + 1 : 0;
        const resolvedStatus = status === 'up' ? 'up' : failCount >= 2 ? status : app.status || 'up';

        // ステータス変化通知
        const notify = pushNotifyRef.current;
        if (notify) {
          if (app.status === 'up' && resolvedStatus !== 'up' && failCount >= 2) {
            notify(`🔴 ${app.name} がダウンしました`, lastError || 'アクセス不能');
          } else if (app.status !== 'up' && resolvedStatus === 'up' && app.status) {
            notify(`🟢 ${app.name} が復旧しました`, '正常に応答しています');
          }
        }

        // ── GAS 在庫カウント（gasUrl が設定されている場合のみ） ──
        let newCount = app.newCount;
        let stockSummary = app.stockSummary ?? null;
        if (app.gasUrl) {
          try {
            const res = await fetch(`${app.gasUrl}?action=getProducts`);
            const data = await res.json();
            if (Array.isArray(data)) {
              const inStock = data.filter(p => p.stock === 'inStock').length;
              const outOfStock = data.filter(p => p.stock === 'outOfStock').length;
              const unknown = data.filter(p => p.stock === 'unknown').length;
              // 在庫が増えた場合は通知
              if (notify && inStock > (app.newCount || 0) && app.newCount !== undefined) {
                notify(`📦 ${app.name} 在庫更新`, `在庫あり: ${inStock}件`);
              }
              newCount = inStock;
              stockSummary = { inStock, outOfStock, unknown };
            }
          } catch { /* silent */ }
        }

        return { ...app, status: resolvedStatus, failCount, lastChecked: new Date().toISOString(), lastError, newCount, stockSummary };
      }));

      setMonitoredApps(updated);
      saveData('monitoredApps', updated);
    };

    checkAll(); // 初回即実行
    const iv = setInterval(checkAll, 600000); // 10分ごと
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { saveData('monitoredApps', monitoredApps); }, [monitoredApps]);

  const logout = () => {
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

  // ============================================
  // 設定の自動復元（GAS → localStorage）
  // キーが空 かつ GAS URL がある場合に復元を試みる
  // gasUrls が後から読み込まれる場合もカバーするため gasUrls[0] を依存に含める
  // ============================================
  useEffect(() => {
    if (apiKeys.anthropic || apiKeys.gemini) return; // すでにキーあり
    const mainUrl = gasUrls[0];
    if (!mainUrl) return;
    (async () => {
      try {
        const res = await fetch(`${mainUrl}?action=get_app_data&key=kcs_api_settings`);
        const data = await res.json();
        if (data.status === 'ok' && data.content) {
          const saved = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
          if (saved?.anthropic || saved?.gemini) {
            const restored = { anthropic: saved.anthropic || '', gemini: saved.gemini || '', youtube: saved.youtube || '' };
            setApiKeys(restored);
            // sessionStorage にも即書き込み（次回リロード時のフォールバック）
            try { sessionStorage.setItem('kcs_api_keys_session', JSON.stringify(restored)); } catch (e) { void e; }
            if (saved.gasUrls?.length) setGasUrls(saved.gasUrls);
            if (saved.driveFolderId) setDriveFolderId(saved.driveFolderId);
            console.log('[AutoRestore] 設定をGASから復元しました');
          }
        }
      } catch (e) {
        console.log('[AutoRestore] GAS未接続のためスキップ:', e.message);
      }
    })();
  }, [gasUrls[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  // ローカル保存（3重保存）— localStorage + sessionStorage + GASバックアップ
  useEffect(() => {
    // 1. localStorage（即時・永続）
    saveData('apiKeys', apiKeys);
    // 2. sessionStorage（タブセッション保持）
    try { sessionStorage.setItem('kcs_api_keys_session', JSON.stringify(apiKeys)); } catch (e) { void e; }
    // 3. GASにバックアップ（キーが設定されているとき）
    if ((apiKeys.anthropic || apiKeys.gemini) && gasUrls[0]) {
      fetch(gasUrls[0], {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'save_app_data',
          key: 'kcs_api_settings',
          content: { anthropic: apiKeys.anthropic, gemini: apiKeys.gemini, youtube: apiKeys.youtube || '', gasUrls, driveFolderId }
        })
      }).catch(() => {});
    }
  }, [apiKeys]); // eslint-disable-line react-hooks/exhaustive-deps
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

  useEffect(() => { pushNotifyRef.current = pushNotify; }, [pushNotify]);

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
          if (task.status !== '完了') continue;
          if (!task.resultUrl) continue;
          if (processed.has(task.taskId)) continue;
          if (processingRef.current.has(task.taskId)) continue;

          let params = {};
          try { params = JSON.parse(task.params || '{}'); } catch { /* ignore */ }
          let projectId = params.projectId;
          let projectName = params.projectName || '';

          if (!projectId) {
            const projNameFromStaff = task.staffName.replace(' (Proj)', '').trim();
            const matched = projectsRef.current.find(p => p.name === projNameFromStaff || task.staffName.includes(p.name));
            if (matched) { projectId = matched.id; projectName = matched.name; }
          }
          if (!projectName) projectName = projectsRef.current.find(p => p.id === projectId)?.name || 'プロジェクト';
          if (!projectId) continue;

          processingRef.current.add(task.taskId);
          try {
            const staffName = task.staffName.replace(' (Proj)', '').trim();
            const staffMember = staffRef.current.find(s => s.name === staffName) || staffRef.current[0];
            const allRolesNow = { ...ROLES, ...customRolesRef.current };
            const role = allRolesNow[staffMember?.roleId] || Object.values(allRolesNow)[0];

            showToast(`${staffMember?.name || staffName} が結果を確認中...`, 'info');

            const prompt =
              `あなたは「${projectName}」プロジェクトの担当として、依頼した実務タスクが完了しました。\n` +
              `タスク種別: ${task.taskType}\n` +
              `指示内容: ${task.instruction || ''}\n\n` +
              `【完了した結果】\n${task.resultUrl}\n\n` +
              `この結果をプロジェクト担当者に分かりやすく報告してください。` +
              `重要なポイントをまとめ、次のアクション提案があれば添えてください。`;

            const aiResponse = await sendToAI(apiKeysRef.current, staffMember, role, prompt, [], null, true);

            const chatKey = `proj_chat_${projectId}`;
            const newMsg = {
              id: Date.now(),
              role: 'assistant',
              content: aiResponse?.text ?? String(aiResponse ?? ''),
              timestamp: new Date().toISOString(),
              staffId: staffMember?.id || 'system',
              staffName: staffMember?.name || staffName,
            };

            const lsKey = 'chatHistory';
            const existing = loadData(lsKey) || {};
            existing[chatKey] = [...(existing[chatKey] || []), newMsg];
            saveData(lsKey, existing);

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

    const interval = setInterval(poll, 600000); // 10分ごと
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
            onOpenX={() => setView('x')}
            onOpenYouTube={() => setView('youtube')}
            onLogout={logout}
            chatHistory={chatHistory}
            monitoredApps={monitoredApps}
            setMonitoredApps={setMonitoredApps}
            onOpenAttendance={() => setView('attendance')}
            onOpenSales={() => setView('sales')}
            onOpenAffiliate={() => setView('affiliate')}
            onOpenPipeline={(team) => { setPipelineTeam(team); setView('pipeline'); }}
            onOpenHAL={() => setView('hal')}
            onOpenPrompts={() => setView('prompts')}
            onOpenMonetization={() => setView('monetization')}
            showToast={showToast}
            gasUrls={gasUrls}
          />
        )}
        {view === 'sales' && (
          <SalesView
            gasUrl={gasUrls[0]}
            onBack={() => setView('home')}
          />
        )}
        {view === 'attendance' && (
          <AttendanceView
            gasUrl={gasUrls[1] || gasUrls[0]}
            onBack={() => setView('home')}
            showToast={showToast}
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
            setStaff={setStaff}
            setCustomRoles={setCustomRoles}
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
        {view === 'x' && (
          <XView 
            apiKeys={apiKeys} 
            staff={staff} 
            onBack={() => setView('home')} 
            gasUrl={gasUrls[0]} 
            showToast={showToast}
          />
        )}
        {view === 'youtube' && (
          <YouTubeView apiKeys={apiKeys} staff={staff} onBack={() => setView('home')} showToast={showToast} />
        )}
        {view === 'agent_co' && (
          <AgentCompany
            apiKeys={apiKeys}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
        {view === 'affiliate' && (
          <AffiliateView
            apiKeys={apiKeys}
            staff={staff}
            onBack={() => setView('home')}
            gasUrl={gasUrls[0]}
            showToast={showToast}
          />
        )}
        {view === 'pipeline' && pipelineTeam && (
          <PipelineView
            team={pipelineTeam}
            onBack={() => setView('home')}
            showToast={showToast}
            gasUrls={gasUrls}
          />
        )}
        {view === 'hal' && (
          <HALView
            onBack={() => setView('home')}
            showToast={showToast}
            gasUrls={gasUrls}
          />
        )}
        {view === 'monetization' && (
          <MonetizationView
            apiKeys={apiKeys}
            gasUrl={gasUrls[0]}
            showToast={showToast}
            onBack={() => setView('home')}
          />
        )}
        {view === 'prompts' && (
          <PromptsView
            onBack={() => setView('home')}
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

          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">設定</span>
          </button>
        </nav>
      )}
    </div>
  );
}
