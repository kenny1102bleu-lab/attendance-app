import { useState } from 'react';
import { loadData, saveData } from '../store.js';
import kcsLogo from '../assets/kcs_logo.jpg';

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

export default LoginView;
