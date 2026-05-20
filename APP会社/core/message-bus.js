// ============================================
// message-bus.js — JSONファイルベースのメッセージバス
// SQLite不要・Visual Studio不要・純粋Node.js
// ============================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_FILE = join(DATA_DIR, 'kcs-db.json');

mkdirSync(DATA_DIR, { recursive: true });

// ============================================
// DB 読み書きヘルパー
// ============================================
let _dbCache = null;

function readDB() {
  if (_dbCache) return _dbCache;
  if (!existsSync(DB_FILE)) {
    _dbCache = { tasks: [], logs: [], agents: {}, messages: [], _taskSeq: 0, _logSeq: 0, _msgSeq: 0 };
    writeDB(_dbCache);
    return _dbCache;
  }
  try {
    _dbCache = JSON.parse(readFileSync(DB_FILE, 'utf-8'));
    return _dbCache;
  } catch {
    _dbCache = { tasks: [], logs: [], agents: {}, messages: [], _taskSeq: 0, _logSeq: 0, _msgSeq: 0 };
    return _dbCache;
  }
}

function writeDB(data) {
  _dbCache = data;
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDB() {
  // 毎回ファイルから読み直す（マルチプロセス対応）
  try {
    _dbCache = JSON.parse(readFileSync(DB_FILE, 'utf-8'));
  } catch {
    _dbCache = readDB();
  }
  return _dbCache;
}

// ============================================
// タスク操作
// ============================================

export function addTask({ dept, agentId, type = 'user_request', title, instruction, params = {}, priority = 5, createdBy = 'user' }) {
  const db = getDB();
  const id = ++db._taskSeq;
  db.tasks.push({
    id, dept, agent_id: agentId || null, type, title, instruction,
    params: JSON.stringify(params), status: 'pending', priority,
    result: null, error: null, created_by: createdBy,
    created_at: new Date().toISOString(), started_at: null, done_at: null
  });
  // タスクは最新500件のみ保持
  if (db.tasks.length > 500) db.tasks = db.tasks.slice(-500);
  writeDB(db);
  return id;
}

export function getPendingTasks(dept, limit = 5) {
  const db = getDB();
  return db.tasks
    .filter(t => t.dept === dept && t.status === 'pending')
    .sort((a, b) => a.priority - b.priority || a.id - b.id)
    .slice(0, limit);
}

export function startTask(taskId) {
  const db = getDB();
  const t = db.tasks.find(t => t.id === taskId);
  if (t) { t.status = 'processing'; t.started_at = new Date().toISOString(); }
  writeDB(db);
}

export function completeTask(taskId, result) {
  const db = getDB();
  const t = db.tasks.find(t => t.id === taskId);
  if (t) { t.status = 'done'; t.result = result; t.done_at = new Date().toISOString(); }
  writeDB(db);
}

export function failTask(taskId, error) {
  const db = getDB();
  const t = db.tasks.find(t => t.id === taskId);
  if (t) { t.status = 'failed'; t.error = error; t.done_at = new Date().toISOString(); }
  writeDB(db);
}

export function getAllTasks(limit = 50) {
  const db = getDB();
  return [...db.tasks].reverse().slice(0, limit);
}

// ============================================
// 活動ログ操作
// ============================================

export function addLog({ dept, agentId, agentName, eventType, message, taskId = null, metadata = {} }) {
  const db = getDB();
  const id = ++db._logSeq;
  db.logs.push({
    id, dept, agent_id: agentId, agent_name: agentName,
    event_type: eventType, message, task_id: taskId,
    metadata: JSON.stringify(metadata),
    created_at: new Date().toISOString()
  });
  // ログは最新1000件のみ保持
  if (db.logs.length > 1000) db.logs = db.logs.slice(-1000);
  writeDB(db);
}

export function getRecentLogs(limit = 100) {
  const db = getDB();
  return db.logs.slice(-limit);
}

// ============================================
// エージェント状態操作
// ============================================

export function upsertAgentStatus({ agentId, dept, agentName, status = 'idle', currentTask = null }) {
  const db = getDB();
  const existing = db.agents[agentId];
  db.agents[agentId] = {
    agent_id: agentId, dept, agent_name: agentName,
    status, current_task: currentTask,
    last_active: new Date().toISOString(),
    task_count: (existing?.task_count || 0) + (status === 'processing' ? 1 : 0),
    updated_at: new Date().toISOString()
  };
  writeDB(db);
}

export function getAllAgentStatuses() {
  const db = getDB();
  return Object.values(db.agents).sort((a, b) => a.dept.localeCompare(b.dept));
}

// ============================================
// 部門間メッセージ操作
// ============================================

export function sendInterDeptMessage({ fromDept, toDept, fromAgent, subject, body }) {
  const db = getDB();
  const id = ++db._msgSeq;
  db.messages.push({
    id, from_dept: fromDept, to_dept: toDept,
    from_agent: fromAgent, subject, body,
    is_read: false, created_at: new Date().toISOString()
  });
  if (db.messages.length > 200) db.messages = db.messages.slice(-200);
  writeDB(db);
}

export function getUnreadMessages(toDept) {
  const db = getDB();
  const unread = db.messages.filter(m => m.to_dept === toDept && !m.is_read);
  unread.forEach(m => { m.is_read = true; });
  if (unread.length > 0) writeDB(db);
  return unread;
}

// ============================================
// 議事録操作 (meetings)
// ============================================

/** 会議セッションを保存（議事録として永続化）*/
export function saveMeetingSession({ projectId, projectName, participants, history, summary }) {
  const db = getDB();
  if (!db.meetings) db.meetings = [];
  if (!db._meetingSeq) db._meetingSeq = 0;

  const id = ++db._meetingSeq;
  // historyの画像データはサムネイル用に参照のみ保持（base64は除いてサイズ節約）
  const safeHistory = (history || []).map(m => ({
    ...m,
    // 画像はURLまたはtype情報のみ保持（base64は除去してJSONサイズを抑える）
    image: m.image ? { type: m.image.type, size: m.image.size, name: m.image.name } : undefined
  }));

  db.meetings.push({
    id,
    project_id: projectId,
    project_name: projectName,
    participants: participants || [],
    history: safeHistory,
    summary: summary || '',
    msg_count: (history || []).length,
    created_at: new Date().toISOString()
  });

  // 議事録は最新200件保持
  if (db.meetings.length > 200) db.meetings = db.meetings.slice(-200);
  writeDB(db);
  return id;
}

/** プロジェクト別の議事録一覧を取得 */
export function getMeetingsByProject(projectId, limit = 20) {
  const db = getDB();
  if (!db.meetings) return [];
  return db.meetings
    .filter(m => m.project_id === projectId)
    .slice(-limit)
    .reverse();
}

/** 全議事録から全文検索 */
export function searchMeetings(query, projectId = null) {
  const db = getDB();
  if (!db.meetings) return [];
  const q = query.toLowerCase();
  return db.meetings
    .filter(m => {
      if (projectId && m.project_id !== projectId) return false;
      // プロジェクト名、サマリー、会話内容を検索
      const text = [
        m.project_name || '',
        m.summary || '',
        ...(m.history || []).map(h => h.content || '')
      ].join(' ').toLowerCase();
      return text.includes(q);
    })
    .slice(-50)
    .reverse();
}

/** 最新の議事録を全プロジェクト分取得 */
export function getRecentMeetings(limit = 30) {
  const db = getDB();
  if (!db.meetings) return [];
  return [...db.meetings].reverse().slice(0, limit);
}

export default {
  addTask, getPendingTasks, startTask, completeTask, failTask, getAllTasks,
  addLog, getRecentLogs,
  upsertAgentStatus, getAllAgentStatuses,
  sendInterDeptMessage, getUnreadMessages,
  saveMeetingSession, getMeetingsByProject, searchMeetings, getRecentMeetings
};

