import { useState } from 'react';
import { DEFAULT_STAFF } from '../store.js';

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
                  <div className="staff-discord-id">
                    <span>🎮</span>
                    <input
                      placeholder="@1号"
                      value={s.discordId || ''}
                      onChange={e => {
                        setStaff(prev => prev.map(st => st.id === s.id ? { ...st, discordId: e.target.value } : st));
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    {s.discordId && <span className="staff-discord-tag">{s.discordId}</span>}
                  </div>
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

export default StaffManagementView;
