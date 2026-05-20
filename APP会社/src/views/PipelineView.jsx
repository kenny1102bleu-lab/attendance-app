import { useState, useEffect } from 'react';
import { PROJECT_TEAMS, AI_EDITORS, PIPELINES, loadData, saveData, saveToObsidian } from '../store.js';

export default function PipelineView({ team, onBack, showToast, gasUrls }) {
  const [selectedEditor, setSelectedEditor] = useState(() => loadData(`editor_${team?.id}`) || 'claude_pro');
  const [pipelineStates, setPipelineStates] = useState(() => loadData(`pipeline_${team?.id}`) || {});
  const [editorLog, setEditorLog] = useState(() => loadData(`editor_log_${team?.id}`) || []);
  const [savingObsidian, setSavingObsidian] = useState(false);

  useEffect(() => { saveData(`editor_${team?.id}`, selectedEditor); }, [selectedEditor, team?.id]);
  useEffect(() => { saveData(`pipeline_${team?.id}`, pipelineStates); }, [pipelineStates, team?.id]);
  useEffect(() => { saveData(`editor_log_${team?.id}`, editorLog); }, [editorLog, team?.id]);

  const kcsGasUrl = gasUrls?.[0] || (loadData('gasUrls') || [])[0] || '';
  const currentEditor = AI_EDITORS.find(e => e.id === selectedEditor) || AI_EDITORS[0];

  const changeEditor = (editorId) => {
    setSelectedEditor(editorId);
    const entry = { editor: editorId, timestamp: new Date().toISOString(), team: team?.id };
    setEditorLog(prev => [...prev.slice(-49), entry]);
    showToast?.(`エディターを ${AI_EDITORS.find(e=>e.id===editorId)?.name} に変更しました`, 'success');
  };

  const toggleStep = (pipelineId, stepIdx) => {
    setPipelineStates(prev => {
      const key = `${pipelineId}_${stepIdx}`;
      const current = prev[key] || 'pending';
      const next = current === 'pending' ? 'active' : current === 'active' ? 'done' : 'pending';
      return { ...prev, [key]: next };
    });
  };

  const getStepStatus = (pipelineId, stepIdx) => pipelineStates[`${pipelineId}_${stepIdx}`] || 'pending';

  const handleSaveObsidian = async () => {
    if (!kcsGasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    setSavingObsidian(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const editorName = currentEditor.name;
      const pipelineLines = PIPELINES.map(pipe => {
        const steps = pipe.steps.map((step, i) => {
          const s = pipelineStates[`${pipe.id}_${i}`] || 'pending';
          return `  - ${s === 'done' ? '✅' : s === 'active' ? '🔄' : '⬜'} ${step}`;
        }).join('\n');
        return `### ${pipe.icon} ${pipe.name}\n${steps}`;
      }).join('\n\n');
      const logLines = editorLog.slice(-10).map(l =>
        `- ${l.timestamp?.slice(0, 16).replace('T', ' ')} → ${AI_EDITORS.find(e => e.id === l.editor)?.name || l.editor}`
      ).join('\n');

      const content = `---\ndate: ${date}\ntags: [pipeline, kcs, ${team.id}]\n---\n\n# ${team.icon} ${team.name}\n\n## 使用エディター\n${editorName}\n\n## 制作パイプライン\n\n${pipelineLines}\n\n## エディター変更ログ\n${logLines || 'なし'}\n`;

      const result = await saveToObsidian(kcsGasUrl, `${team.name}_パイプライン`, content, 'プロジェクト');
      if (result.status === 'ok') {
        showToast?.(`📓 Obsidianに保存しました（${result.action === 'updated' ? '更新' : '新規作成'}）`, 'success');
      } else {
        showToast?.(result.error || 'Obsidian保存エラー', 'error');
      }
    } catch (e) {
      showToast?.('保存エラー: ' + e.message, 'error');
    } finally {
      setSavingObsidian(false);
    }
  };

  if (!team) return null;

  return (
    <div className="stack-dashboard animate-fadein">
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:22 }}>{team.icon}</span>
            <span style={{ fontWeight:700, fontSize:16 }}>{team.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSaveObsidian} disabled={savingObsidian} title="Obsidianに保存">
            {savingObsidian ? '⏳' : '📓'} Obsidian保存
          </button>
        </div>
      </header>

      {/* エディター選択 */}
      <div style={{ padding:'12px 16px 4px' }}>
        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8 }}>🤖 使用エディター</div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
          {AI_EDITORS.map(ed => (
            <button key={ed.id}
              className={`glass-card ${selectedEditor===ed.id?'card-active':''}`}
              style={{ minWidth:130, padding:'10px 14px', cursor:'pointer', border: selectedEditor===ed.id?`2px solid ${team.color}`:'2px solid transparent', transition:'all .2s' }}
              onClick={() => changeEditor(ed.id)}>
              <div style={{ fontSize:20, marginBottom:4 }}>{ed.icon}</div>
              <div style={{ fontSize:12, fontWeight:700 }}>{ed.name}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{ed.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* プロジェクト概要 */}
      <div style={{ padding:'8px 16px' }}>
        <div className="glass-card" style={{ padding:14, background:`linear-gradient(135deg, ${team.color}15, ${team.color}05)`, border:`1px solid ${team.color}30` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{team.name}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{team.desc}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>エディター</div>
              <div style={{ fontSize:18 }}>{currentEditor.icon}</div>
              <div style={{ fontSize:10, fontWeight:600 }}>{currentEditor.name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 制作パイプライン */}
      <div style={{ padding:'8px 16px 80px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'var(--text-primary)' }}>🔄 制作パイプライン</div>
        {PIPELINES.map(pipe => {
          const doneCount = pipe.steps.filter((_,i) => getStepStatus(pipe.id,i)==='done').length;
          const pct = Math.round((doneCount/pipe.steps.length)*100);
          return (
            <div key={pipe.id} className="glass-card" style={{ marginBottom:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>{pipe.icon}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{pipe.name}</span>
                </div>
                <span style={{ fontSize:11, color: pct===100?'#2ecc71':'var(--text-muted)', fontWeight:600 }}>{pct}%</span>
              </div>
              {/* プログレスバー */}
              <div style={{ height:4, background:'var(--bg-secondary)', borderRadius:4, marginBottom:10, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg, ${pipe.color}, ${pipe.color}aa)`, borderRadius:4, transition:'width .3s' }}/>
              </div>
              {/* ステップ */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {pipe.steps.map((step, i) => {
                  const status = getStepStatus(pipe.id, i);
                  const colors = { pending:{ bg:'var(--bg-secondary)', text:'var(--text-muted)', border:'transparent' },
                    active:{ bg:`${pipe.color}20`, text:pipe.color, border:pipe.color },
                    done:{ bg:'#2ecc7120', text:'#2ecc71', border:'#2ecc71' }};
                  const c = colors[status];
                  return (
                    <button key={i} onClick={()=>toggleStep(pipe.id,i)}
                      style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                        background:c.bg, color:c.text, border:`1.5px solid ${c.border}`,
                        cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', gap:4 }}>
                      {status==='done'?'✅':status==='active'?'🔄':'⬜'} {step}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* エディター使用ログ */}
        {editorLog.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--text-secondary)' }}>📝 エディター変更ログ（直近5件）</div>
            {editorLog.slice(-5).reverse().map((log, i) => {
              const ed = AI_EDITORS.find(e=>e.id===log.editor);
              return (
                <div key={i} style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, display:'flex', gap:8 }}>
                  <span>{new Date(log.timestamp).toLocaleString('ja-JP',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                  <span>{ed?.icon} {ed?.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
