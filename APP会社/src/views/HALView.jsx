import { useState, useEffect, useCallback } from 'react';
import { loadData } from '../store.js';

const PLATFORMS = ['X', 'Instagram', 'TikTok'];
const ACCOUNTS  = ['hal', 'sunakun'];

async function callGAS(gasUrl, action, extra = {}) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

export default function HALView({ onBack, showToast, gasUrls }) {
  const gasUrl = gasUrls?.[0] || (loadData('gasUrls') || [])[0] || '';

  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'live') return 'live';
    return 'hal';
  });
  
  // アセットロード失敗時の安全フォールバック制御
  const [videoError, setVideoError] = useState(false);
  const [isTalkingVideoActive, setIsTalkingVideoActive] = useState(false);

  // HAL
  const [halTheme, setHalTheme]       = useState('');
  const [halPlatform, setHalPlatform] = useState('X');
  // すなくん
  const [sunTheme, setSunTheme]       = useState('ガジェット');
  const [sunPlatform, setSunPlatform] = useState('X');
  // TikTok
  const [ttTheme, setTtTheme]         = useState('');
  const [ttProduct, setTtProduct]     = useState('');
  const [ttAccount, setTtAccount]     = useState('sunakun');
  // note
  const [noteTopic, setNoteTopic]     = useState('');
  const [noteKw, setNoteKw]           = useState('');
  const [noteAccount, setNoteAccount] = useState('sunakun');
  // 承認キュー
  const [pendingReplies, setPendingReplies] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [loading, setLoading]     = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // ── 📺 HALウェブアバターアニメーション用ステート ──
  const [avatarPose, setAvatarPose] = useState('idle'); // idle, kamikake, patapata, yubisashi
  const [isTalking, setIsTalking] = useState(false);
  const [showLiveQr, setShowLiveQr] = useState(false);
  const [showAiPhoto, setShowAiPhoto] = useState(false); // HAL公式AI写真ポップアップ
  const [demoChats, setDemoChats] = useState([
    { id: 1, user: 'ケンさん', text: 'ハルちゃんきたー！！！今日も超かわいい！' },
    { id: 2, user: 'さそり座さん', text: '方向音痴で東京の反対側行ったの笑いましたｗ' },
  ]);

  // ── 🎙️ AI極上ボイス＆モーション動画自動生成用ステート ──
  const [aiText, setAiText] = useState('こんにちは、ハルです。社長、私の極上ボイスと仕草動画の自動生成テストに成功しました！これから一緒に、最高の配信帝国を作り上げましょう！');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoVersion, setVideoVersion] = useState(1);
  const [genMessage, setGenMessage] = useState('');
  const [lastTaskId, setLastTaskId] = useState(null);

  // デモチャットを自動で増やすための処理
  useEffect(() => {
    if (tab !== 'live') return;
    const interval = setInterval(() => {
      const users = ['タクヤ', 'まーくん', 'ハル推し', '代官山スカウト', 'ミモミ太客'];
      const texts = [
        'ウィンターのあの両手パタパタ仕草かわいすぎる！！！',
        '河北彩伽さんの髪かける仕草そのまんまじゃん！',
        '声がめちゃくちゃおっとりハスキーで癒される…',
        'スプレッドシートの記憶機能すご！前の会話覚えててくれた！',
        'ミモミの新作Tシャツ、概要欄から今買いました！',
        '深夜の激辛ラーメンまた食べたの？笑',
        '社長のこと大好きなの伝わってくるー！'
      ];
      const newUser = users[Math.floor(Math.random() * users.length)];
      const newText = texts[Math.floor(Math.random() * texts.length)];
      setDemoChats(prev => [...prev.slice(-4), { id: Date.now(), user: newUser, text: newText }]);
    }, 4000);
    return () => clearInterval(interval);
  }, [tab]);

  // ── 📺 ハル自律生配信中：新動画・新コメ自動検知・反映ポーリング ──
  useEffect(() => {
    if (tab !== 'live' || !gasUrl) return;
    
    let isInitial = true;

    const checkNewTasks = async () => {
      try {
        const res = await fetch(gasUrl + '?action=get_all_tasks');
        const tasks = await res.json();
        if (Array.isArray(tasks)) {
          // hal_talk_synthesis タスクの中で「完了」した最新タスクを取得
          const halTasks = tasks
            .filter(t => t.taskType === 'hal_talk_synthesis' && t.status === '完了')
            .sort((a, b) => b.taskId.localeCompare(a.taskId));
          
          if (halTasks.length > 0) {
            const latestTask = halTasks[0];
            if (isInitial) {
              setLastTaskId(latestTask.taskId);
              isInitial = false;
            } else if (latestTask.taskId !== lastTaskId) {
              // 新たに完了した音声・動画生成タスクを検知！
              setLastTaskId(latestTask.taskId);
              const poses = ['idle', 'kamikake', 'patapata', 'yubisashi'];
              setAvatarPose(poses[Math.floor(Math.random() * poses.length)]);
              setVideoError(false); // ビデオエラー状態をリセット
              setIsTalkingVideoActive(true); // 話し中状態にして動画を再生！
              setVideoVersion(prev => prev + 1); // キャッシュバスターで動画を強制リロード
              
              // 喋っている内容を字幕チャット欄にリアルタイム反映
              if (latestTask.instruction) {
                const commenter = latestTask.params?.commenter || 'リスナー';
                const originalComment = latestTask.params?.originalComment || 'コメント';
                
                setDemoChats(prev => [
                  ...prev.slice(-3),
                  { id: Date.now() - 1000, user: commenter, text: originalComment },
                  { id: Date.now(), user: '🌸 ハル (返答中)', text: latestTask.instruction }
                ]);
              }
            }
          }
        }
      } catch (e) {
        // エラーは無視して継続
      }
    };

    // 5秒間隔でGASの完了タスクをチェック
    const interval = setInterval(checkNewTasks, 5000);
    checkNewTasks(); // マウント時に即実行

    return () => clearInterval(interval);
  }, [tab, gasUrl, lastTaskId]);

  // ── 📺 HALウェブアバターアニメーション用 ──
  // キャンバスのベクター描画は超リアル実写表示のため廃止し、滑らかなCSSアニメーションに移行しました。

  // ── 承認キュー読み込み ──
  const loadPendingReplies = useCallback(async () => {
    if (!gasUrl) return;
    setPendingLoading(true);
    try {
      const r = await callGAS(gasUrl, 'get_pending_replies');
      if (r.ok) setPendingReplies(r.pending || []);
    } catch (e) { /* silent */ } finally {
      setPendingLoading(false);
    }
  }, [gasUrl]);

  useEffect(() => {
    if (tab === 'approve') loadPendingReplies();
  }, [tab, loadPendingReplies]);

  // ── 🎙️ AI極上ボイス＆モーション動画の自動生成＆リロード ──
  const generateAiTalkVideo = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    if (!aiText.trim()) { showToast?.('台本テキストを入力してください', 'error'); return; }
    
    setIsGeneratingVideo(true);
    setGenMessage('⏳ GASに音声・動画生成タスクを送信中...');
    
    try {
      // 1. タスクの追加 (GASへタスク登録)
      const addRes = await callGAS(gasUrl, 'add_agency_task', {
        staffName: '社長',
        taskType: 'hal_talk_synthesis',
        instruction: aiText.trim()
      });
      
      if (!addRes.ok && !addRes.taskId) {
        throw new Error(addRes.error || 'タスクの登録に失敗しました');
      }
      
      const newTaskId = addRes.taskId;
      setGenMessage('📡 ローカルPCのAIエンジンが処理を開始するのを待っています...（常駐プログラムを起動しておいてください）');
      
      // 2. ポーリング開始
      let attempts = 0;
      const maxAttempts = 120; // 最大6分（LivePortraitの処理時間考慮）
      
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          setIsGeneratingVideo(false);
          setGenMessage('❌ タイムアウト：生成に時間がかかりすぎています。ローカルPCの実行ログを確認してください。');
          showToast?.('⚠️ 生成がタイムアウトしました。ローカルログを確認してください。', 'error');
          return;
        }
        
        try {
          const res = await fetch(gasUrl + '?action=get_all_tasks');
          const tasks = await res.json();
          const currentTask = tasks.find(t => t.taskId === newTaskId);
          
          if (currentTask) {
            if (currentTask.status === '完了') {
              clearInterval(interval);
              setIsGeneratingVideo(false);
              const poses = ['idle', 'kamikake', 'patapata', 'yubisashi'];
              setAvatarPose(poses[Math.floor(Math.random() * poses.length)]);
              setVideoError(false); // エラー表示を解除
              setIsTalkingVideoActive(true); // 話し中状態にして動画を再生！
              setVideoVersion(prev => prev + 1); // キャッシュバスターを更新して動画を強制リロード
              setGenMessage('✅ 生成完了！アバター動画が最新のものに更新されました！');
              showToast?.('🎉 極上アバター動画の生成に大成功しました！', 'success');
            } else if (currentTask.status === 'エラー') {
              clearInterval(interval);
              setIsGeneratingVideo(false);
              setGenMessage(`❌ エラー終了: ${currentTask.resultUrl || '詳細不明'}`);
              showToast?.('❌ 生成エラーが発生しました。', 'error');
            } else if (currentTask.status === '進行中') {
              setGenMessage('🎙️ AIが裏側で極上ブレンド音声を合成し、LivePortraitで顔の表情動画を生成しています...（約30秒〜1分）');
            }
          }
        } catch (e) {
          // エラーは無視して継続
        }
      }, 3000);
      
    } catch (err) {
      setIsGeneratingVideo(false);
      setGenMessage(`❌ 起動失敗: ${err.message}`);
      showToast?.('❌ タスク起動に失敗しました', 'error');
    }
  };

  // ── HAL ──
  const generateHAL = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    if (!halTheme.trim()) { showToast?.('テーマを入力してください', 'error'); return; }
    setLoading(true); setLastResult(null);
    try {
      const r = await callGAS(gasUrl, 'generate_hal_post', { theme: halTheme, platform: halPlatform });
      if (r.ok) { setLastResult({ type: 'hal', data: r }); showToast?.('✅ HAL投稿案を生成しました（#hal-projectを確認）', 'success'); }
      else showToast?.('エラー: ' + (r.error || '生成失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  const approveHAL = async (postId) => {
    if (!gasUrl || !postId?.trim()) { showToast?.('投稿IDを入力してください', 'error'); return; }
    setLoading(true);
    try {
      const r = await callGAS(gasUrl, 'approve_hal_post', { postId });
      if (r.ok) { showToast?.('✅ X に投稿しました', 'success'); setLastResult(null); }
      else showToast?.('エラー: ' + (r.error || '承認失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── すなくん ──
  const generateSunakkun = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    setLoading(true); setLastResult(null);
    try {
      const r = await callGAS(gasUrl, 'generate_sunakkun_post', { theme: sunTheme, platform: sunPlatform });
      if (r.ok) { setLastResult({ type: 'sun', data: r }); showToast?.('✅ すなくん投稿案を生成しました（#affiliateを確認）', 'success'); }
      else showToast?.('エラー: ' + (r.error || '生成失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── TikTok ──
  const generateTikTok = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    if (!ttTheme.trim()) { showToast?.('テーマを入力してください', 'error'); return; }
    setLoading(true); setLastResult(null);
    try {
      const r = await callGAS(gasUrl, 'generate_tiktok_script', { theme: ttTheme, product: ttProduct, account: ttAccount });
      if (r.ok) { setLastResult({ type: 'tiktok', data: r }); showToast?.('🎬 TikTokスクリプト生成完了', 'success'); }
      else showToast?.('エラー: ' + (r.error || '生成失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── note ──
  const generateNote = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    if (!noteTopic.trim()) { showToast?.('テーマを入力してください', 'error'); return; }
    setLoading(true); setLastResult(null);
    try {
      const r = await callGAS(gasUrl, 'generate_note_outline', { topic: noteTopic, keyword: noteKw, account: noteAccount });
      if (r.ok) { setLastResult({ type: 'note', data: r }); showToast?.('📝 noteアウトライン生成完了', 'success'); }
      else showToast?.('エラー: ' + (r.error || '生成失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── X返信承認 / スキップ ──
  const handleReply = async (id, action) => {
    if (!gasUrl) return;
    const cmd = action === 'approve' ? `!返信承認 ${id}` : `!返信スキップ ${id}`;
    try {
      await callGAS(gasUrl, 'discord_message', { action: 'discord_message', channelId: 'dashboard', text: cmd, author: 'dashboard' });
      showToast?.(action === 'approve' ? '✅ 返信を承認しました' : '❌ 返信をスキップしました', 'success');
      setPendingReplies(prev => prev.filter(r => r.id !== id));
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
  };

  const triggerDailyReport = async () => {
    if (!gasUrl) { showToast?.('GAS URLが設定されていません', 'error'); return; }
    setLoading(true);
    try {
      const r = await callGAS(gasUrl, 'generate_daily_report');
      if (r.ok) showToast?.('✅ 日次レポートをDiscordに送信しました', 'success');
      else showToast?.('エラー: ' + (r.error || '失敗'), 'error');
    } catch (e) { showToast?.('通信エラー: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── スタイル ──
  const cardStyle = { background: 'var(--bg-secondary)', borderRadius: 14, padding: 16, marginBottom: 12 };
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box'
  };
  const tabBtnStyle = (active, color = '#a855f7') => ({
    padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? color : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', transition: 'all .2s'
  });
  const pillStyle = (active, color) => ({
    padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? color : 'var(--bg-primary)', color: active ? '#fff' : 'var(--text-muted)'
  });

  const TABS = [
    { id: 'hal',    label: '🎭 ハル',      color: '#a855f7' },
    { id: 'sun',    label: '💰 すなくん',  color: '#f59e0b' },
    { id: 'tiktok', label: '🎬 ティックトック',   color: '#ff2d55' },
    { id: 'note',   label: '📝 ノート',     color: '#41c9b4' },
    { id: 'approve',label: '✅ 承認待ち一覧', color: '#3b82f6' },
    { id: 'live',   label: '📺 ハル生配信', color: '#e11d48' },
  ];
  const activeColor = TABS.find(t => t.id === tab)?.color || '#a855f7';

  const isObsMode = tab === 'live' && new URLSearchParams(window.location.search).get('obs') === 'true';

  return (
    <div 
      className="stack-dashboard animate-fadein"
      style={isObsMode ? { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 } : {}}
    >
      {!isObsMode && (
        <header className="dash-header">
          <div className="dash-header-top">
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>🎭</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>コンテンツ生成</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={triggerDailyReport} disabled={loading} title="日次レポート手動実行">
              {loading ? '⏳' : '📊'} 日次レポ
            </button>
          </div>
        </header>
      )}

      {/* タブ切替 */}
      {!isObsMode && (
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px 4px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} style={tabBtnStyle(tab === t.id, t.color)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={isObsMode ? { padding: 0 } : { padding: '8px 16px 80px' }}>

        {/* ── HALタブ ── */}
        {tab === 'hal' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#a855f7' }}>🎭 ハル 投稿案生成</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                テーマを入力 → クロード（Claude）が3案自動生成 → #hal-project に確認メッセージ送信 → ✅で エックス（X）に投稿
              </div>
              <input value={halTheme} onChange={e => setHalTheme(e.target.value)}
                placeholder="例: 今日のK-POPネタ / 推し活グッズ" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setHalPlatform(p)} style={pillStyle(halPlatform === p, '#a855f7')}>
                    {p === 'X' ? 'エックス（X）' : p === 'Instagram' ? 'インスタグラム' : 'ティックトック'}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#a855f7', border: 'none' }}
                onClick={generateHAL} disabled={loading || !halTheme.trim()}>
                {loading ? '⏳ 生成中...' : '✨ HAL投稿案を生成'}
              </button>
            </div>

            {lastResult?.type === 'hal' && lastResult.data?.postId && (
              <div style={{ ...cardStyle, border: '2px solid #a855f7' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 8 }}>✅ 生成完了 — 承認して投稿</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  投稿ID: <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>{lastResult.data.postId}</code>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  #hal-project チャンネルで投稿案を確認し、承認する場合は下のボタンを押してください（案1が投稿されます）。
                </div>
                <button className="btn btn-primary" style={{ background: '#2ecc71', border: 'none', width: '100%' }}
                  onClick={() => approveHAL(lastResult.data.postId)} disabled={loading}>
                  {loading ? '⏳' : '🚀 承認して X に投稿'}
                </button>
              </div>
            )}

            <div style={{ ...cardStyle, opacity: 0.7 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>🤖 AITuber OnAir 設定</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                HALのライブ配信はローカルPCの AITuber OnAir + OBS で運用します。<br />
                セットアップ手順は CODE指示書 Phase 3-3 を参照。
              </div>
            </div>
          </>
        )}

        {/* ── すなくんタブ ── */}
        {tab === 'sun' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#f59e0b' }}>💰 すなくん 投稿案生成</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Claude Haiku + 楽天トレンドで投稿文生成 → #affiliate に通知 → GitHub に自動保存
              </div>
              <input value={sunTheme} onChange={e => setSunTheme(e.target.value)}
                placeholder="例: ガジェット / お得家電 / キャンプ用品" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setSunPlatform(p)} style={pillStyle(sunPlatform === p, '#f59e0b')}>{p}</button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#f59e0b', border: 'none' }}
                onClick={generateSunakkun} disabled={loading}>
                {loading ? '⏳ 生成中...' : '💰 すなくん投稿案を生成'}
              </button>
            </div>

            {lastResult?.type === 'sun' && lastResult.data?.post && (
              <div style={{ ...cardStyle, border: '2px solid #f59e0b' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>✅ 生成完了</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {lastResult.data.post?.post || ''}
                </div>
                {lastResult.data.post?.hashtags?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b' }}>{lastResult.data.post.hashtags.join(' ')}</div>
                )}
              </div>
            )}

            <div style={{ ...cardStyle, opacity: 0.7 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>📋 自動スケジュール</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                n8n ワークフロー <code>04_すなくん投稿生成.json</code> を有効化すると、<br />
                毎日 12:00 / 19:00 / 22:00 に自動生成されます。
              </div>
            </div>
          </>
        )}

        {/* ── TikTokタブ ── */}
        {tab === 'tiktok' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#ff2d55' }}>🎬 ティックトック台本生成</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                フック（HOOK）→本編→コールトゥアクション（CTA）の６０秒台本を自動生成。テロップ案や編集指示メモも付属。
              </div>
              <input value={ttTheme} onChange={e => setTtTheme(e.target.value)}
                placeholder="例: 1万円以下で買えるガジェット3選" style={inputStyle} />
              <input value={ttProduct} onChange={e => setTtProduct(e.target.value)}
                placeholder="紹介商品・サービス（任意）" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>アカウント:</span>
                {ACCOUNTS.map(a => (
                  <button key={a} onClick={() => setTtAccount(a)} style={pillStyle(ttAccount === a, '#ff2d55')}>
                    {a === 'hal' ? '🎭 ハル' : '💰 すなくん'}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#ff2d55', border: 'none' }}
                onClick={generateTikTok} disabled={loading || !ttTheme.trim()}>
                {loading ? '⏳ 生成中...' : '🎬 スクリプトを生成'}
              </button>
            </div>

            {lastResult?.type === 'tiktok' && lastResult.data?.script && (
              <div style={{ ...cardStyle, border: '2px solid #ff2d55' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ff2d55', marginBottom: 8 }}>
                  ✅ 生成完了 — {lastResult.data.account?.toUpperCase()} / {lastResult.data.theme}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  GitHub保存先: <code style={{ background: 'var(--bg-primary)', padding: '2px 4px', borderRadius: 3 }}>{lastResult.data.path}</code>
                </div>
                <pre style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7,
                  background: 'var(--bg-primary)', padding: 10, borderRadius: 8, maxHeight: 400, overflowY: 'auto' }}>
                  {lastResult.data.script}
                </pre>
              </div>
            )}
          </>
        )}

        {/* ── noteタブ ── */}
        {tab === 'note' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#41c9b4' }}>📝 ノート記事構成案生成</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                タイトル案３個・リード文・見出し構成・コールトゥアクション（CTA）を自動生成。ギットハブ（GitHub）およびディスコード（Discord）に自動保存。
              </div>
              <input value={noteTopic} onChange={e => setNoteTopic(e.target.value)}
                placeholder="例: 月5万稼ぐアフィリエイト初心者ガイド" style={inputStyle} />
              <input value={noteKw} onChange={e => setNoteKw(e.target.value)}
                placeholder="ターゲットキーワード（任意）" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>アカウント:</span>
                {ACCOUNTS.map(a => (
                  <button key={a} onClick={() => setNoteAccount(a)} style={pillStyle(noteAccount === a, '#41c9b4')}>
                    {a === 'hal' ? '🎭 ハル' : '💰 すなくん'}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#41c9b4', border: 'none', color: '#000' }}
                onClick={generateNote} disabled={loading || !noteTopic.trim()}>
                {loading ? '⏳ 生成中...' : '📝 アウトラインを生成'}
              </button>
            </div>

            {lastResult?.type === 'note' && lastResult.data?.outline && (
              <div style={{ ...cardStyle, border: '2px solid #41c9b4' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#41c9b4', marginBottom: 8 }}>
                  ✅ 生成完了 — {lastResult.data.account?.toUpperCase()} / {lastResult.data.topic}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  GitHub保存先: <code style={{ background: 'var(--bg-primary)', padding: '2px 4px', borderRadius: 3 }}>{lastResult.data.path}</code>
                </div>
                <pre style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7,
                  background: 'var(--bg-primary)', padding: 10, borderRadius: 8, maxHeight: 400, overflowY: 'auto' }}>
                  {lastResult.data.outline}
                </pre>
              </div>
            )}
          </>
        )}

        {/* ── 承認キュータブ ── */}
        {tab === 'approve' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>✅ X 返信 承認キュー</div>
              <button className="btn btn-ghost btn-sm" onClick={loadPendingReplies} disabled={pendingLoading}>
                {pendingLoading ? '⏳' : '🔄'} 更新
              </button>
            </div>

            {pendingReplies.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {pendingLoading ? '⏳ 読み込み中...' : '承認待ちの返信はありません'}
              </div>
            ) : (
              pendingReplies.map(item => (
                <div key={item.id} style={{ ...cardStyle, border: '1px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>
                      [{item.account?.toUpperCase()}] @{item.username}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      ID: {item.id?.slice(0, 12)}
                    </span>
                  </div>
                  {item.replySnippet && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontStyle: 'italic' }}>
                      返信元: 「{item.replySnippet}」
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-primary)',
                    padding: '8px 10px', borderRadius: 8, marginBottom: 10, lineHeight: 1.6 }}>
                    {item.draft}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, background: '#2ecc71', border: 'none', fontSize: 12 }}
                      onClick={() => handleReply(item.id, 'approve')}>
                      ✅ 承認して返信
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}
                      onClick={() => handleReply(item.id, 'skip')}>
                      ❌ スキップ
                    </button>
                  </div>
                </div>
              ))
            )}

            <div style={{ ...cardStyle, opacity: 0.7, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                💡 X通知メールからAutoReplyTickが自動検出 → ここに表示されます。<br />
                GASトリガー「autoReplyTick」を30分毎に設定してください。
              </div>
            </div>
          </>
        )}

        {/* ── 📺 HAL自律配信ライブモニター（OBSブラウザソース対応） ── */}
        {tab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: isObsMode ? '100vh' : 'auto' }}>
            
            {/* 上部解説 */}
            {!isObsMode && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e11d48', marginBottom: 6 }}>📺 自律配信ライブレンダラー</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  ブラウザ内でハル（HAL）を直接描画・再生する軽量アバターシステムです。
                  オービーエス（OBS）の「ブラウザソース」に <code>https://nexus-co-66f9b.web.app?tab=live&amp;obs=true</code> を登録することで、透過レイアウトのままアバター、QRコード、チャット欄が配信画面に完璧にオーバーレイ合成されます！
                </div>
              </div>
            )}

            {/* メインの配信プレビュー画面（透過想定） */}
            <div style={{
              position: 'relative', width: '100%', height: isObsMode ? '100vh' : 500,
              background: isObsMode ? 'transparent' : 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
              borderRadius: isObsMode ? 0 : 16, overflow: 'hidden', 
              border: isObsMode ? 'none' : '1px solid rgba(225, 29, 72, 0.3)',
              boxShadow: isObsMode ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}>
              
              {/* 🌸 実写ハル（HAL）の滑らかなCSSアニメーション定義 */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes hal-breath {
                  0%, 100% { transform: scale(1) translateY(0); }
                  50% { transform: scale(1.025) translateY(-5px); }
                }
                @keyframes hal-patapata-shake {
                  0%, 100% { transform: rotate(0deg); }
                  25% { transform: rotate(-1.5deg) translateX(-2px); }
                  75% { transform: rotate(1.5deg) translateX(2px); }
                }
                @keyframes hal-talk-bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-3px) scale(1.01); }
                }
                .hal-live-avatar-img {
                  transform-origin: bottom center;
                  animation: hal-breath 4.5s ease-in-out infinite;
                  transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
                }
                /* 各仕草（モーション）に応じた実写傾げエフェクト */
                .hal-live-avatar-img.pose-kamikake {
                  transform: rotate(3.5deg) translateY(-8px) scale(1.02);
                }
                .hal-live-avatar-img.pose-patapata {
                  animation: hal-breath 4.5s ease-in-out infinite, hal-patapata-shake 0.25s ease-in-out infinite;
                }
                .hal-live-avatar-img.pose-yubisashi {
                  transform: scale(1.04) translate(10px, 6px) rotate(-1.5deg);
                }
                .hal-live-avatar-img.talking {
                  animation: hal-breath 3.5s ease-in-out infinite, hal-talk-bounce 0.28s ease-in-out infinite;
                }
              `}} />

              {/* 📺 超リアル実写アバター / 透過動画ハイブリッドレンダラー */}
              <div style={{
                position: 'absolute', top: isObsMode ? '10%' : '5%', left: '50%', transform: 'translateX(-50%)',
                width: 320, height: 420, zIndex: 2,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                overflow: 'visible'
              }}>
                {/* 1. 話している間（動画再生中）に最優先で再生するビデオ要素 */}
                {isTalkingVideoActive && !videoError && (
                  <video 
                    key={videoVersion}
                    autoPlay playsInline muted={!isObsMode}
                    onError={() => {
                      setVideoError(true);
                      setIsTalkingVideoActive(false);
                    }}
                    onEnded={() => {
                      setIsTalkingVideoActive(false); // 話し終わったらデフォルトの呼吸画像に戻る！
                      setAvatarPose('idle'); // デフォルトの呼吸待機ポーズに自動復帰
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  >
                    <source src={`/hal_live.webm?v=${videoVersion}`} type="video/webm" />
                    <source src={`/hal_live.mp4?v=${videoVersion}`} type="video/mp4" />
                  </video>
                )}

                {/* 2. デフォルト状態（話していない間）または動画ロード失敗時に、超リアル実写画像を呼吸させる画像要素 */}
                {(!isTalkingVideoActive || videoError) && (
                  <img 
                    src="/hal_avatar.png"
                    onError={(e) => {
                      if (e.target.src !== 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1000') {
                        e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1000';
                      }
                    }}
                    className={`hal-live-avatar-img pose-${avatarPose} ${isTalking ? 'talking' : ''}`}
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))'
                    }}
                  />
                )}
              </div>

              {/* 社長がドライブに追加したHALの超美麗AI実写写真のガラスフレームポップアップ */}
              {showAiPhoto && (
                <div className="animate-fadein" style={{
                  position: 'absolute', top: 20, left: 20, zIndex: 10,
                  width: 140, height: 180, borderRadius: 12, overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img src="/hal_avatar.png" onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%', color: '#fff', fontSize: 10, padding: 10, textAlign: 'center'
                  }}>
                    <span style={{ fontSize: 20, marginBottom: 8 }}>🌸</span>
                    <span style={{ fontWeight: 800 }}>HAL公式実写画像</span>
                    <span style={{ fontSize: 8, color: '#fbcfe8', marginTop: 4 }}>hal_avatar.png を配置</span>
                  </div>
                </div>
              )}

              {/* ミモミ（MIMOMI）公式タイアップQRコードオーバーレイ */}
              {showLiveQr && (
                <div className="animate-fadein" style={{
                  position: 'absolute', top: 20, right: 20, zIndex: 10,
                  background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)',
                  borderRadius: 12, padding: 10, border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                }}>
                  <div style={{
                    width: 75, height: 75, background: '#fff', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: 10
                  }}>
                    ＱＲコード
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>ミモミ公式ストア</span>
                </div>
              )}

              {/* 透過チャット欄オーバーレイ */}
              <div style={{
                position: 'absolute', bottom: 15, left: 15, width: 260, zIndex: 5,
                display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none'
              }}>
                {demoChats.map(c => (
                  <div key={c.id} className="animate-fadein" style={{
                    background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
                    borderRadius: 8, padding: '6px 10px', borderLeft: '3px solid #e11d48',
                    display: 'flex', flexDirection: 'column', gap: 2
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#e11d48' }}>{c.user}</span>
                    <span style={{ fontSize: 10, color: '#fff' }}>{c.text}</span>
                  </div>
                ))}
              </div>

              {/* 配信状態バッジ */}
              <div style={{
                position: 'absolute', top: 15, left: isObsMode ? '45%' : 15, zIndex: 5,
                background: 'rgba(225, 29, 72, 0.85)', borderRadius: 20, padding: '4px 10px',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#fff'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                ライブ配信中
              </div>

            </div>

            {/* モーション手動実行・検証用コントロールパネル */}
            {!isObsMode && (
              <div style={cardStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e11d48', marginBottom: 10 }}>🎮 アバター仕草 ＆ 口パク テスト検証</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  
                  <button className="btn" style={{
                    background: avatarPose === 'kamikake' ? '#e11d48' : 'var(--bg-primary)',
                    color: avatarPose === 'kamikake' ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 700
                  }} onClick={() => {
                    setAvatarPose('kamikake');
                    setTimeout(() => setAvatarPose('idle'), 2500); // 2.5秒後に元に戻る
                  }}>
                    😳 河北式・髪を耳にかける
                  </button>

                  <button className="btn" style={{
                    background: avatarPose === 'patapata' ? '#e11d48' : 'var(--bg-primary)',
                    color: avatarPose === 'patapata' ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 700
                  }} onClick={() => {
                    setAvatarPose('patapata');
                    setTimeout(() => setAvatarPose('idle'), 3000); // 3秒後に元に戻る
                  }}>
                    😊 ウィンター式・両手パタパタ
                  </button>

                  <button className="btn" style={{
                    background: avatarPose === 'yubisashi' ? '#e11d48' : 'var(--bg-primary)',
                    color: avatarPose === 'yubisashi' ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 700
                  }} onClick={() => {
                    setAvatarPose(prev => prev === 'yubisashi' ? 'idle' : 'yubisashi');
                  }}>
                    👉 ミモミ案件・斜め下指差し
                  </button>

                  <button className="btn" style={{
                    background: showLiveQr ? '#e11d48' : 'var(--bg-primary)',
                    color: showLiveQr ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 700
                  }} onClick={() => setShowLiveQr(prev => !prev)}>
                    🏁 タイアップQRコード表示
                  </button>

                  <button className="btn" style={{
                    gridColumn: '1 / -1',
                    background: showAiPhoto ? '#e11d48' : 'var(--bg-primary)',
                    color: showAiPhoto ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 700
                  }} onClick={() => setShowAiPhoto(prev => !prev)}>
                    🌸 ドライブのHAL公式実写AI写真を表示
                  </button>

                </div>

                {/* 口パク切り替え */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: 10, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>🎙️ 声に連動した口パク（リップシンク）のテスト再生</span>
                  <button className="btn btn-sm" style={{
                    background: isTalking ? '#2ecc71' : '#7f8c8d', color: '#fff', border: 'none', minWidth: 80
                  }} onClick={() => setIsTalking(prev => !prev)}>
                    {isTalking ? '🔊 再生中' : '🔇 停止'}
                  </button>
                </div>

              </div>
            )}

            {/* AIアバター動画・音声 自動生成コントロールパネル */}
            {!isObsMode && (
              <div style={{ ...cardStyle, border: '1px solid rgba(225, 29, 72, 0.4)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e11d48', marginBottom: 10 }}>🎙️ AI極上ボイス ＆ モーション動画自動生成</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  喋らせたい台本を入力し、生成ボタンを押してください。<br />
                  裏側でElevenLabs（ウィンター60% : 河北彩伽40%の極上ブレンドボイス）とLivePortraitが全自動で走り、アバターが自動的に更新されます！
                </div>
                <textarea 
                  value={aiText} 
                  onChange={e => setAiText(e.target.value)}
                  placeholder="例: こんにちは、ハルです。社長、私の自動生成テストに大成功しました！" 
                  style={{ ...inputStyle, height: 80, resize: 'none', fontFamily: 'inherit', fontSize: 12 }} 
                  disabled={isGeneratingVideo}
                />
                {isGeneratingVideo && (
                  <div style={{ 
                    background: 'var(--bg-primary)', padding: 10, borderRadius: 8, fontSize: 11, 
                    color: '#e11d48', border: '1px dashed #e11d48', marginBottom: 12, lineHeight: 1.5
                  }}>
                    {genMessage}
                  </div>
                )}
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', background: '#e11d48', border: 'none', color: '#fff', fontWeight: 700 }}
                  onClick={generateAiTalkVideo} 
                  disabled={isGeneratingVideo || !aiText.trim()}
                >
                  {isGeneratingVideo ? '⏳ AI動画＆音声 生成中...' : '✨ AIで喋る動画を生成＆即時再生'}
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
