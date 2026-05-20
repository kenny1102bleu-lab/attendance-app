// ============================================
// agent-base.js — 全エージェント共通の基底クラス
// ============================================
import { getPendingTasks, startTask, completeTask, failTask, addLog, upsertAgentStatus, getUnreadMessages } from './message-bus.js';

// ============================================
// Gemini / Claude AI 呼び出し
// ============================================
async function callGemini(apiKey, systemPrompt, userMessage) {
  const { default: fetch } = await import('node-fetch');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(apiKey, systemPrompt, userMessage) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

// ============================================
// AgentBase クラス
// ============================================
export class AgentBase {
  /**
   * @param {object} config
   * @param {string} config.agentId       - スタッフID (例: 'kenji')
   * @param {string} config.agentName     - スタッフ名 (例: 'ケンジ')
   * @param {string} config.dept          - 部門ID (例: 'engineering')
   * @param {string} config.deptName      - 部門名 (例: '開発部')
   * @param {string} config.emoji         - 絵文字
   * @param {string} config.color         - テーマカラー
   * @param {string} config.systemPrompt  - AIシステムプロンプト
   * @param {string} config.provider      - 'gemini' | 'claude'
   * @param {number} config.loopInterval  - タスクチェック間隔(ms) デフォルト10秒
   * @param {object} config.apiKeys       - { gemini, anthropic }
   * @param {function} config.onEvent     - イベント発生時のコールバック (for WebSocket broadcast)
   */
  constructor(config) {
    this.agentId = config.agentId;
    this.agentName = config.agentName;
    this.dept = config.dept;
    this.deptName = config.deptName;
    this.emoji = config.emoji || '🤖';
    this.color = config.color || '#6c5ce7';
    this.systemPrompt = config.systemPrompt;
    this.provider = config.provider || 'gemini';
    this.loopInterval = config.loopInterval || 10000;
    this.apiKeys = config.apiKeys || {};
    this.onEvent = config.onEvent || (() => {});
    this._running = false;
    this._timer = null;
  }

  // ============================================
  // ライフサイクル
  // ============================================

  /** エージェント起動 */
  start() {
    this._running = true;
    upsertAgentStatus({
      agentId: this.agentId,
      dept: this.dept,
      agentName: this.agentName,
      status: 'idle'
    });
    this._log('system', `${this.emoji} ${this.agentName}（${this.deptName}）が起動しました`);
    this._scheduleLoop();
  }

  /** エージェント停止 */
  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._log('system', `${this.agentName} が停止しました`);
  }

  // ============================================
  // メインループ
  // ============================================
  _scheduleLoop() {
    if (!this._running) return;
    this._timer = setTimeout(async () => {
      try {
        await this._loop();
      } catch (e) {
        console.error(`[${this.agentName}] ループエラー:`, e.message);
      }
      this._scheduleLoop();
    }, this.loopInterval);
  }

  async _loop() {
    // 1. 部門間メッセージを確認
    const messages = getUnreadMessages(this.dept);
    for (const msg of messages) {
      await this._handleInterDeptMessage(msg);
    }

    // 2. タスクキューを確認
    const tasks = getPendingTasks(this.dept, 1); // 一度に1タスク処理
    if (tasks.length === 0) return;

    const task = tasks[0];
    await this._processTask(task);
  }

  // ============================================
  // タスク処理
  // ============================================
  async _processTask(task) {
    startTask(task.id);
    upsertAgentStatus({
      agentId: this.agentId,
      dept: this.dept,
      agentName: this.agentName,
      status: 'processing',
      currentTask: task.title
    });
    this._log('task_start', `📋 「${task.title}」を開始`, task.id);

    try {
      const params = JSON.parse(task.params || '{}');
      const result = await this.handleTask(task, params);
      completeTask(task.id, result);
      upsertAgentStatus({ agentId: this.agentId, dept: this.dept, agentName: this.agentName, status: 'idle' });
      this._log('task_done', `✅ 「${task.title}」完了`, task.id, { result: result?.slice(0, 200) });
    } catch (e) {
      failTask(task.id, e.message);
      upsertAgentStatus({ agentId: this.agentId, dept: this.dept, agentName: this.agentName, status: 'error' });
      this._log('task_fail', `❌ 「${task.title}」失敗: ${e.message}`, task.id);
    }
  }

  /**
   * サブクラスでオーバーライド — 実際の処理ロジック
   * @param {object} task - タスクオブジェクト
   * @param {object} params - パースされたJSON params
   * @returns {Promise<string>} 結果テキスト
   */
  async handleTask(task, params) {
    // デフォルト: AIに指示を投げて回答を返す
    return await this.askAI(task.instruction);
  }

  /** 部門間メッセージのデフォルト処理 */
  async _handleInterDeptMessage(msg) {
    this._log('message', `📨 ${msg.from_dept}から: ${msg.subject}`);
  }

  // ============================================
  // AI呼び出しヘルパー
  // ============================================

  /** AIに質問して回答を返す */
  async askAI(userMessage, extraContext = '') {
    const hasKey = this.provider === 'gemini'
      ? !!this.apiKeys.gemini
      : !!this.apiKeys.anthropic;

    if (!hasKey) {
      throw new Error(`APIキーが未設定です（provider: ${this.provider}）`);
    }

    const fullPrompt = extraContext
      ? `${extraContext}\n\n---\n\n${userMessage}`
      : userMessage;

    if (this.provider === 'gemini') {
      return await callGemini(this.apiKeys.gemini, this.systemPrompt, fullPrompt);
    } else {
      return await callClaude(this.apiKeys.anthropic, this.systemPrompt, fullPrompt);
    }
  }

  // ============================================
  // ログ・イベント
  // ============================================
  _log(eventType, message, taskId = null, metadata = {}) {
    addLog({
      dept: this.dept,
      agentId: this.agentId,
      agentName: this.agentName,
      eventType,
      message,
      taskId,
      metadata
    });
    // WebSocketリアルタイム通知
    this.onEvent({
      type: 'agent_event',
      dept: this.dept,
      agentId: this.agentId,
      agentName: this.agentName,
      emoji: this.emoji,
      color: this.color,
      eventType,
      message,
      taskId,
      metadata,
      timestamp: new Date().toISOString()
    });
    console.log(`[${this.agentName}] ${message}`);
  }
}
