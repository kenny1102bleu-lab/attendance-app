import { useState } from 'react';
import { ROLES, ROADMAP_TEMPLATES, loadData, saveData } from '../store.js';

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

export default RoadmapView;
