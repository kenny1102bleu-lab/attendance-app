import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { sendToAI } from '../store.js';
import FormattedMessage from '../components/FormattedMessage.jsx';

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

export default ChatView;
