import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ROLES, sendToAI, loadData } from '../store.js';
import FormattedMessage from '../components/FormattedMessage.jsx';

// ============================================
// Project Creation Wizard
// ============================================
const WIZARD_STEPS = [
  { id: 'idea',        label: 'アイデア',     icon: '💡' },
  { id: 'feasibility', label: '実現可能性',   icon: '🔍' },
  { id: 'tools',       label: '必要ツール',   icon: '🛠️' },
  { id: 'basics',      label: '基本情報',     icon: '📝' },
  { id: 'target',      label: 'ターゲット',   icon: '🎯' },
  { id: 'doc',         label: '指示書生成',   icon: '📋' },
];

function ProjectCreationWizard({ onComplete, onCancel, apiKeys, staff, allRoles, showToast, gasUrl, setStaff, setCustomRoles }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [idea, setIdea] = useState('');
  const [feasibility, setFeasibility] = useState('');
  const [tools, setTools] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [goals, setGoals] = useState('');
  const [targetAges, setTargetAges] = useState([]);
  const [targetGenders, setTargetGenders] = useState([]);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [discordSent, setDiscordSent] = useState(false);
  const [notionSaved, setNotionSaved] = useState(false);
  const [gasStatus, setGasStatus] = useState(null);
  const [discordResult, setDiscordResult] = useState(null); // { status, error, timestamp }
  const [notionResult, setNotionResult]   = useState(null);

  const memory = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('kcs_project_memory') || '[]'); }
    catch { return []; }
  }, []);

  const callAI = async (prompt) => {
    const s = staff?.[0];
    const r = allRoles ? Object.values(allRoles)[0] : null;
    if (!s) return 'スタッフが設定されていません。設定画面でAPIキーを登録してください。';
    if (!r) return 'ロール情報が取得できませんでした。';
    try {
      const result = await sendToAI(apiKeys, s, r, prompt, [], null, true);
      const text = typeof result === 'string' ? result : (result?.text ?? '');
      console.log('[Wizard] AI response length:', text.length, 'preview:', text.slice(0, 80));
      return text || '（AIからの回答が空でした。APIキーを確認してください）';
    } catch (e) {
      console.error('[Wizard] callAI error:', e);
      return `AI呼び出しエラー: ${e.message}`;
    }
  };

  const nextStep = async () => {
    if (stepIdx === 0) {
      if (!idea.trim()) return;
      setLoading(true); setStepIdx(1);
      try {
        const r = await callAI(
          `KCS合同会社の新規プロジェクトとして以下を評価してください。\nアイデア:「${idea}」\n\n必ず以下の形式で回答してください:\n## 実現可能性スコア: XX/100\n## 総合判定: 推奨 / 要検討 / 困難\n## 強み・チャンス\n- （具体的に）\n## リスク・課題\n- （具体的に）\n## まとめ\n（2〜3文で結論）`
        );
        setFeasibility(r);
      } catch (e) {
        setFeasibility(`エラーが発生しました: ${e.message}`);
      } finally {
        setLoading(false);
      }

    } else if (stepIdx === 1) {
      setLoading(true); setStepIdx(2);
      const memHint = memory.length > 0
        ? `\n\n【過去プロジェクト参考】\n${memory.slice(-3).map(m => `- ${m.name}: ${m.tools}`).join('\n')}`
        : '';
      try {
        const r = await callAI(
          `以下のプロジェクトに必要なツール・リソースを箇条書き（最大10個）で提案してください。各項目に理由を1行で。\nプロジェクト:「${idea}」${memHint}`
        );
        setTools(r);
      } catch (e) {
        setTools(`エラー: ${e.message}`);
      } finally {
        setLoading(false);
      }

    } else if (stepIdx === 2) {
      setStepIdx(3);

    } else if (stepIdx === 3) {
      if (!name.trim()) return;
      setStepIdx(4);

    } else if (stepIdx === 4) {
      if (!targetAges.length || !targetGenders.length) return;
      const ageLabel = targetAges.join('・');
      const genderLabel = targetGenders.join('・');
      setLoading(true); setStepIdx(5);
      try {
        const r = await callAI(
          `以下の情報からスタッフ向け指示書を生成してください。\n\nアイデア: ${idea}\nプロジェクト名: ${name}\n期間: ${duration || '未定'}\n目標: ${goals}\nターゲット: ${ageLabel}・${genderLabel}\n使用ツール: ${tools}\n\n以下のMarkdown形式で:\n# プロジェクト指示書：${name}\n作成日: ${new Date().toLocaleDateString('ja-JP')}\n\n## プロジェクト概要\n## 目的・目標（KPI）\n## ターゲット\n## 使用ツール・技術スタック\n## フェーズとマイルストーン\n| フェーズ | 内容 | 期間 |\n|---|---|---|\n## 担当役割（KCS AIスタッフ）\n## 制約・注意事項`
        );
        setInstruction(r);
        const updated = [...memory, {
          name, tools: tools.slice(0, 150),
          target: `${ageLabel}・${genderLabel}`,
          goals: goals.slice(0, 100),
          date: new Date().toLocaleDateString('ja-JP')
        }].slice(-10);
        localStorage.setItem('kcs_project_memory', JSON.stringify(updated));
      } catch (e) {
        setInstruction(`エラー: ${e.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // GAS GET（レスポンスが読める）- 接続テスト用
  const getFromGAS = async (params) => {
    if (!gasUrl) throw new Error('GAS URLが設定されていません');
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${gasUrl}?${qs}`);
    return res.json();
  };

  // GAS POST は CORS の制約で no-cors → opaque response（読めない）→ 楽観的成功扱い
  const postToGAS = async (body) => {
    if (!gasUrl) throw new Error('GAS URLが設定されていません');
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
  };

  // GAS 接続テスト（GET health → 結果をパネルに表示）
  const testGASConnection = async () => {
    if (!gasUrl) { setGasStatus('no-url'); return; }
    setGasStatus('checking');
    try {
      const data = await getFromGAS({ action: 'health' });
      setGasStatus(data?.status === 'ok' ? 'ok' : 'error');
    } catch {
      setGasStatus('error');
    }
  };

  // 送信後にポーリングして GAS の最新結果を取得（鮮度チェック付き）
  const checkSendStatus = async (sentAt) => {
    // 最大3回リトライ（2s + 3s + 5s インターバル）
    const delays = [2000, 3000, 5000];
    for (const delay of delays) {
      await new Promise(r => setTimeout(r, delay));
      try {
        const result = await getFromGAS({ action: 'get_send_status' });
        // GAS がまだ古いステータスを返している場合はリトライ
        const discordTs = result?.discord?.timestamp ? new Date(result.discord.timestamp).getTime() : 0;
        const notionTs = result?.notion?.timestamp ? new Date(result.notion.timestamp).getTime() : 0;
        if (discordTs >= sentAt || notionTs >= sentAt) return result;
      } catch { /* continue */ }
    }
    return null;
  };

  const checkChannelStatus = async (sentAt) => {
    const delays = [2000, 3000, 5000];
    for (const delay of delays) {
      await new Promise(r => setTimeout(r, delay));
      try {
        const result = await getFromGAS({ action: 'get_channel_status' });
        const ts = result?.channel?.timestamp ? new Date(result.channel.timestamp).getTime() : 0;
        if (ts >= sentAt) return result.channel;
      } catch { /* continue */ }
    }
    return null;
  };

  const generateProjectStaff = async () => {
    const prompt = `以下のプロジェクト専任AIスタッフを1名考えてください。
プロジェクト名: ${name}
目標: ${goals}
ツール: ${tools}
ターゲット: ${targetAges.join('・')}・${targetGenders.join('・')}

必ずJSON形式のみで返答してください（前後の説明・コードブロック不要）:
{"name":"日本語の名前（カタカナ）","emoji":"絵文字1文字","title":"役職名","skills":["スキル1","スキル2","スキル3"],"systemPrompt":"このスタッフのキャラクター・使命（80文字以内）","aiMode":"BALANCED"}`;
    const raw = await callAI(prompt);
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  };

  const sendToDiscord = async () => {
    if (!gasUrl) { showToast('GAS URLが設定されていません', 'error'); return false; }
    try {
      const sentAt = Date.now();
      await postToGAS({ action: 'send_discord_instruction', projectName: name || idea.slice(0, 30), instruction, channelName: 'KCS本部' });
      // POST 送信後、GAS の実際の結果を GET で取得
      const status = await checkSendStatus(sentAt);
      const d = status?.discord;
      if (d?.status === 'ok') {
        setDiscordSent(true);
        setDiscordResult({ status: 'ok', timestamp: d.timestamp });
        showToast('🎮 Discord #KCS本部 に送信しました！', 'success');
        return true;
      } else if (d?.status === 'error') {
        setDiscordResult({ status: 'error', error: d.error, timestamp: d.timestamp });
        showToast(`Discord エラー: ${d.error}`, 'error');
        return false;
      } else {
        setDiscordSent(true);
        setDiscordResult({ status: 'unknown' });
        showToast('🎮 Discord送信リクエストを送りました（GASログで確認）', 'success');
        return true;
      }
    } catch (e) {
      showToast('Discord送信エラー: ' + e.message, 'error');
      return false;
    }
  };

  const saveToNotion = async () => {
    if (!gasUrl) { await navigator.clipboard.writeText(instruction); showToast('GAS URL未設定 → クリップボードにコピー', 'info'); return false; }
    try {
      const sentAt = Date.now();
      await postToGAS({ action: 'create_notion_page', projectName: name || idea.slice(0, 30), instruction });
      const status = await checkSendStatus(sentAt);
      const n = status?.notion;
      if (n?.status === 'ok') {
        setNotionSaved(true);
        setNotionResult({ status: 'ok', timestamp: n.timestamp, pageUrl: n.pageUrl });
        showToast('📔 Notionにページを保存しました！', 'success');
        if (n.pageUrl) window.open(n.pageUrl, '_blank');
        return true;
      } else if (n?.status === 'error') {
        setNotionResult({ status: 'error', error: n.error, timestamp: n.timestamp });
        showToast(`Notion エラー: ${n.error}`, 'error');
        await navigator.clipboard.writeText(instruction);
        return false;
      } else {
        setNotionSaved(true);
        setNotionResult({ status: 'unknown' });
        showToast('📔 Notion保存リクエストを送りました（GASログで確認）', 'success');
        return true;
      }
    } catch (e) {
      await navigator.clipboard.writeText(instruction);
      showToast('Notion送信エラー: ' + e.message, 'info');
      return false;
    }
  };

  const complete = async () => {
    setLoading(true);
    if (!discordSent) await sendToDiscord();
    if (!notionSaved) await saveToNotion();

    // Discord チャンネルを自動作成
    let channelId = '';
    if (gasUrl) {
      try {
        const sentAt = Date.now();
        await postToGAS({ action: 'create_discord_channel', projectName: name || idea.slice(0, 30) });
        const ch = await checkChannelStatus(sentAt);
        if (ch?.status === 'ok') {
          channelId = ch.channelId;
          showToast(`💬 #${ch.channelName} を Discord に作成しました！`, 'success');
        }
      } catch (e) {
        console.warn('Discord channel creation failed:', e.message);
      }
    }

    // プロジェクト専任スタッフを AI 生成
    if (setStaff && setCustomRoles) {
      try {
        const generated = await generateProjectStaff();
        if (generated) {
          const roleId = 'role_' + Date.now();
          const role = {
            id: roleId,
            title: generated.title || 'プロジェクト担当',
            aiMode: generated.aiMode || 'BALANCED',
            temperature: 0.7,
            skills: generated.skills || [],
            systemPrompt: generated.systemPrompt || '',
            dept: 'custom',
          };
          const staffMember = {
            id: 'staff_' + Date.now(),
            name: generated.name || 'エージェント',
            emoji: generated.emoji || '🤖',
            avatarUrl: '',
            roleId,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
          };
          setCustomRoles(prev => ({ ...prev, [roleId]: role }));
          setStaff(prev => [...prev, staffMember]);
          showToast(`🤖 ${staffMember.name}（${role.title}）をチームに追加しました！`, 'success');
        }
      } catch (e) {
        console.warn('Staff generation failed:', e.message);
      }
    }

    setLoading(false);
    onComplete({ name: name || idea.slice(0, 30), desc: goals, tools, targetAge: targetAges.join('・'), targetGender: targetGenders.join('・'), instruction, channelId });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content wizard-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>✨ 新規プロジェクト</h3>
            <div className="wizard-steps-bar">
              {WIZARD_STEPS.map((s, i) => (
                <span key={s.id} className={`wizard-step-dot ${i === stepIdx ? 'active' : i < stepIdx ? 'done' : ''}`}>
                  {i < stepIdx ? '✓' : s.icon}
                </span>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body wizard-body">

          {/* Step 0: アイデア入力 */}
          {stepIdx === 0 && (
            <div>
              <h4 className="wizard-step-title">💡 どんなプロジェクトを始めますか？</h4>
              <p className="wizard-step-desc">アイデアを自由に入力してください。AIが実現可能性を診断します。</p>
              {memory.length > 0 && (
                <div className="wizard-memory">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📚 過去の参考:</span>
                  {memory.slice(-3).map((m, i) => (
                    <button key={i} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                      onClick={() => setIdea(`${m.name}（${m.target}向け）`)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              <textarea className="input-field" rows={5}
                placeholder="例: 20代向けのYouTube Shorts動画シリーズを立ち上げて毎週3本配信する"
                value={idea} onChange={e => setIdea(e.target.value)} autoFocus />
              <button className="btn btn-primary wizard-next-btn" onClick={nextStep} disabled={!idea.trim()}>
                🔍 実現可能性を診断 →
              </button>
            </div>
          )}

          {/* Step 1: 実現可能性 */}
          {stepIdx === 1 && (
            <div>
              <h4 className="wizard-step-title">🔍 実現可能性チェック</h4>
              {loading ? <WizardLoading text="AIが分析中..." /> : (
                <>
                  <FeasibilityDisplay text={feasibility} />
                  <button className="btn btn-primary wizard-next-btn" onClick={nextStep}>🛠️ 必要ツールを確認 →</button>
                </>
              )}
            </div>
          )}

          {/* Step 2: 必要ツール */}
          {stepIdx === 2 && (
            <div>
              <h4 className="wizard-step-title">🛠️ 必要ツール・リソース</h4>
              {loading ? <WizardLoading text="ツールを分析中..." /> : (
                <>
                  <p className="wizard-step-desc">AIの提案を編集できます:</p>
                  <textarea className="input-field" rows={8} value={tools} onChange={e => setTools(e.target.value)} />
                  <button className="btn btn-primary wizard-next-btn" onClick={nextStep}>📝 基本情報を入力 →</button>
                </>
              )}
            </div>
          )}

          {/* Step 3: 基本情報 */}
          {stepIdx === 3 && (
            <div>
              <h4 className="wizard-step-title">📝 プロジェクト基本情報</h4>
              <div className="form-group">
                <label>プロジェクト名 *</label>
                <input className="input-field" placeholder="例: YouTube Shorts 週3本配信プロジェクト"
                  value={name} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>期間</label>
                <input className="input-field" placeholder="例: 2026年5月〜7月（3ヶ月）"
                  value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className="form-group">
                <label>目標・KPI</label>
                <textarea className="input-field" rows={3} placeholder="例: チャンネル登録者1000人達成、月間10万再生"
                  value={goals} onChange={e => setGoals(e.target.value)} />
              </div>
              <button className="btn btn-primary wizard-next-btn" onClick={nextStep} disabled={!name.trim()}>
                🎯 ターゲットを設定 →
              </button>
            </div>
          )}

          {/* Step 4: ターゲット（Matrix風） */}
          {stepIdx === 4 && (
            <div className="matrix-target-panel">
              <div className="matrix-header">
                <span className="matrix-title">&gt; TARGET_SEGMENT.EXE</span>
                <span className="matrix-cursor">█</span>
              </div>

              <div className="matrix-section">
                <div className="matrix-label">&gt; AGE_GROUP :: <span className="matrix-selected-label">[{targetAges.length ? targetAges.join(', ') : 'NULL'}]</span></div>
                <div className="matrix-grid matrix-grid-3">
                  {['10代', '20代', '30代', '40代', '50代以上', '全年代'].map(a => {
                    const isAll = a === '全年代';
                    const active = targetAges.includes(a);
                    return (
                      <button key={a} className={`matrix-chip${active ? ' matrix-chip-on' : ''}`}
                        onClick={() => {
                          if (isAll) {
                            setTargetAges(active ? [] : ['全年代']);
                          } else {
                            setTargetAges(prev => {
                              const without = prev.filter(x => x !== '全年代');
                              return without.includes(a) ? without.filter(x => x !== a) : [...without, a];
                            });
                          }
                        }}>
                        <span className="matrix-chip-prompt">&gt;</span>
                        <span className="matrix-chip-text">{a}</span>
                        {active && <span className="matrix-chip-cursor">_</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="matrix-section">
                <div className="matrix-label">&gt; GENDER :: <span className="matrix-selected-label">[{targetGenders.length ? targetGenders.join(', ') : 'NULL'}]</span></div>
                <div className="matrix-grid matrix-grid-3">
                  {['男性', '女性', '全体'].map(g => {
                    const isAll = g === '全体';
                    const active = targetGenders.includes(g);
                    return (
                      <button key={g} className={`matrix-chip${active ? ' matrix-chip-on' : ''}`}
                        onClick={() => {
                          if (isAll) {
                            setTargetGenders(active ? [] : ['全体']);
                          } else {
                            setTargetGenders(prev => {
                              const without = prev.filter(x => x !== '全体');
                              return without.includes(g) ? without.filter(x => x !== g) : [...without, g];
                            });
                          }
                        }}>
                        <span className="matrix-chip-prompt">&gt;</span>
                        <span className="matrix-chip-text">{g}</span>
                        {active && <span className="matrix-chip-cursor">_</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="btn btn-primary wizard-next-btn matrix-next-btn"
                onClick={nextStep} disabled={!targetAges.length || !targetGenders.length}>
                <span className="matrix-btn-text">&gt; GENERATE_INSTRUCTION.EXE →</span>
              </button>
            </div>
          )}

          {/* Step 5: 指示書生成・保存 */}
          {stepIdx === 5 && (
            <div>
              <h4 className="wizard-step-title">📋 プロジェクト指示書</h4>

              {/* GAS 接続診断パネル */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 'bold' }}>🔗 GAS接続</span>
                  {gasStatus === 'ok' && <span style={{ color: '#00b894' }}>✅ 正常</span>}
                  {gasStatus === 'error' && <span style={{ color: '#d63031' }}>❌ 接続失敗 — GAS URL・デプロイを確認</span>}
                  {gasStatus === 'no-url' && <span style={{ color: '#e17055' }}>⚠️ GAS URL未設定</span>}
                  {gasStatus === 'checking' && <span style={{ color: 'var(--text-muted)' }}>確認中...</span>}
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={testGASConnection}>
                    接続テスト
                  </button>
                </div>
                <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {gasUrl ? gasUrl : <span style={{ color: '#e17055' }}>⚠️ 未設定（設定画面でGAS URL 1本目を入力）</span>}
                </div>
              </div>

              {loading ? <WizardLoading text="指示書を生成中..." /> : (
                <>
                  <textarea className="input-field" rows={8} value={instruction}
                    onChange={e => setInstruction(e.target.value)} style={{ fontSize: 12 }} />
                  <div className="wizard-save-row">
                    <button className={`btn btn-sm ${discordSent ? 'btn-success' : 'btn-ghost'}`}
                      onClick={sendToDiscord} disabled={!gasUrl || loading}>
                      {discordSent ? '✅ Discord送信済み' : '🎮 Discord送信'}
                    </button>
                    <button className={`btn btn-sm ${notionSaved ? 'btn-success' : 'btn-ghost'}`}
                      onClick={saveToNotion} disabled={!gasUrl || loading}>
                      {notionSaved ? '✅ Notion保存済み' : '📔 Notion保存'}
                    </button>
                  </div>
                  {/* 送信結果パネル */}
                  {(discordResult || notionResult) && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: 12 }}>
                      {discordResult && (
                        <div style={{ marginBottom: notionResult ? 4 : 0 }}>
                          {discordResult.status === 'ok' && <span style={{ color: '#00b894' }}>✅ Discord送信成功（{discordResult.timestamp ? new Date(discordResult.timestamp).toLocaleTimeString('ja-JP') : ''}）</span>}
                          {discordResult.status === 'error' && <span style={{ color: '#d63031' }}>❌ Discord送信失敗：{discordResult.error}</span>}
                          {discordResult.status === 'unknown' && <span style={{ color: '#fdcb6e' }}>⚠️ Discord送信済み（GASログで確認）</span>}
                        </div>
                      )}
                      {notionResult && (
                        <div>
                          {notionResult.status === 'ok' && <span style={{ color: '#00b894' }}>✅ Notion保存成功（{notionResult.timestamp ? new Date(notionResult.timestamp).toLocaleTimeString('ja-JP') : ''}）{notionResult.pageUrl && <a href={notionResult.pageUrl} target="_blank" rel="noreferrer" style={{ color: '#6c5ce7', marginLeft: 8 }}>ページを開く</a>}</span>}
                          {notionResult.status === 'error' && <span style={{ color: '#d63031' }}>❌ Notion保存失敗：{notionResult.error}</span>}
                          {notionResult.status === 'unknown' && <span style={{ color: '#fdcb6e' }}>⚠️ Notion保存済み（GASログで確認）</span>}
                        </div>
                      )}
                    </div>
                  )}
                  <button className="btn btn-primary wizard-next-btn" onClick={complete}>
                    ✅ プロジェクトを作成する
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeasibilityDisplay({ text }) {
  const displayText = text || '（診断結果を取得中...）';
  // スコアを抽出（例: "85/100" or "85%" or "スコア: 85"）
  const scoreMatch = displayText.match(/(\d{1,3})\s*[\/／]\s*100|(\d{1,3})\s*%|スコア[：:]\s*(\d{1,3})/);
  const rawScore = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]) : null;
  const score = rawScore !== null ? Math.min(rawScore, 100) : null;
  const color = score === null ? '#6c5ce7' : score >= 70 ? '#00b894' : score >= 40 ? '#fdcb6e' : '#d63031';

  return (
    <div>
      <div className="feasibility-score-card" style={{ borderColor: color }}>
        <div className="feasibility-score-label">実現可能性</div>
        <div className="feasibility-score-value" style={{ color }}>{score !== null ? `${score}%` : '—'}</div>
        <div className="feasibility-score-bar">
          <div className="feasibility-score-fill" style={{ width: `${score ?? 0}%`, background: color }} />
        </div>
      </div>
      <div className="ai-result-box" style={{ marginTop: 12 }}>
        <FormattedMessage content={displayText} />
      </div>
    </div>
  );
}

function WizardLoading({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div className="loading-spinner" />
      <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>{text}</p>
    </div>
  );
}

// ============================================
// Projects View — プロジェクト管理
// ============================================
function ProjectsView({ projects, setProjects, staff, allRoles, apiKeys, gasUrls, chatHistory, setChatHistory, activeProject, setActiveProject, onBack, showToast, setPendingAction, cloudPush, driveFolderId, setPendingReports, setStaff, setCustomRoles }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGasUrl1, setNewGasUrl1] = useState('');
  const [newGasUrl2, setNewGasUrl2] = useState('');
  const [newGasUrl3, setNewGasUrl3] = useState('');
  const [newDiscordChannelId, setNewDiscordChannelId] = useState('');

  const createProject = (wizardData) => {
    const p = {
      id: 'proj_' + Date.now(),
      name: wizardData?.name?.trim() || newName.trim(),
      desc: wizardData?.desc?.trim() || newDesc.trim(),
      gasUrls: [newGasUrl1.trim(), newGasUrl2.trim(), newGasUrl3.trim()].filter(Boolean),
      discordChannelId: wizardData?.channelId || newDiscordChannelId.trim(),
      icon: '📁',
      status: '進行中',
      createdAt: Date.now(),
      tasks: [],
      tools: wizardData?.tools || '',
      targetAge: wizardData?.targetAge || '',
      targetGender: wizardData?.targetGender || '',
      instruction: wizardData?.instruction || '',
    };
    setProjects(prev => [...prev, p]);
    setNewName(''); setNewDesc(''); setNewGasUrl1(''); setNewGasUrl2(''); setNewGasUrl3(''); setNewDiscordChannelId('');
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
        gasUrls={gasUrls}
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
        <ProjectCreationWizard
          onComplete={createProject}
          onCancel={() => setShowCreate(false)}
          apiKeys={apiKeys}
          staff={staff}
          allRoles={allRoles}
          showToast={showToast}
          gasUrl={gasUrls?.[0] || (loadData('gasUrls') || [])[0] || ''}
          setStaff={setStaff}
          setCustomRoles={setCustomRoles}
        />
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
                {p.discordChannelId && <div className="project-card-gas" style={{ color: '#5865F2' }}>🎮 Discord連携済み</div>}
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
function ProjectDetailView({ project, setProject, staff, allRoles, apiKeys, chatHistory, setChatHistory, onBack, showToast, setPendingAction, cloudPush, driveFolderId, setPendingReports, gasUrls }) {
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
  const [discordChannels, setDiscordChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const kcsGasUrl = gasUrls?.[0] || (loadData('gasUrls') || [])[0] || '';

  const fetchDiscordChannels = async () => {
    if (!kcsGasUrl) { showToast('GAS URLが設定されていません', 'error'); return; }
    setLoadingChannels(true);
    try {
      const qs = new URLSearchParams({ action: 'get_discord_channels' }).toString();
      const res = await fetch(`${kcsGasUrl}?${qs}`);
      const data = await res.json();
      if (data.status === 'ok' && data.channels?.length) {
        setDiscordChannels(data.channels);
      } else {
        showToast(data.error || 'チャンネル取得失敗', 'error');
      }
    } catch (e) {
      showToast('取得エラー: ' + e.message, 'error');
    } finally {
      setLoadingChannels(false);
    }
  };

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
            headers: { 'Content-Type': 'text/plain' },
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
        {(project.desc || gasLinks.length > 0 || project.discordChannelId !== undefined) && (
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
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>🎮 Discord Ch:</span>
                {project.discordChannelId
                  ? <span style={{ fontSize: 12, color: '#5865F2', fontFamily: 'monospace', flex: 1 }}>
                      #{discordChannels.find(c => c.id === project.discordChannelId)?.name || project.discordChannelId}
                      <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>✅ 連携済み</span>
                    </span>
                  : <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>未連携</span>
                }
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap', color: '#5865F2' }}
                  onClick={fetchDiscordChannels}
                  disabled={loadingChannels}
                >
                  {loadingChannels ? '⏳' : '🔄 チャンネル取得'}
                </button>
              </div>
              {discordChannels.length > 0 && (
                <select
                  className="input-field"
                  style={{ fontSize: 12, padding: '6px 10px', width: '100%' }}
                  value={project.discordChannelId || ''}
                  onChange={e => {
                    const ch = discordChannels.find(c => c.id === e.target.value);
                    setProject({ ...project, discordChannelId: e.target.value });
                    if (ch) showToast(`🎮 #${ch.name} に連携しました`, 'success');
                  }}
                >
                  <option value="">-- チャンネルを選択 --</option>
                  {discordChannels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.category ? `[${ch.category}] ` : ''}#{ch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
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
  const [displayMsgs, setDisplayMsgs] = useState(() => {
    const v = chatHistory[meetingKey];
    return Array.isArray(v) ? v : [];
  });
  const msgsRef = useRef(displayMsgs);
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

export { ProjectDetailView, ProjectMeetingOverlay };
export default ProjectsView;
