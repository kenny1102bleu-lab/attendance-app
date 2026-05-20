import { useState, useEffect, useRef } from 'react';

export default function MeetingRoom({ apiKeys, currentUser, showToast }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState(['jun', 'sakura']);
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const STAFF_LIST = [
    { id: 'jun', name: 'ジュン', emoji: '💼' },
    { id: 'sakura', name: 'サクラ', emoji: '📋' },
    { id: 'haruki', name: 'ハルキ', emoji: '📌' },
    { id: 'akari', name: 'アカリ', emoji: '💡' },
    { id: 'kenji', name: 'ケンジ', emoji: '⚙️' },
    { id: 'ryou', name: 'リョウ', emoji: '📈' },
    { id: 'yuki', name: 'ユキ', emoji: '🎬' },
    { id: 'takumi', name: 'タクミ', emoji: '💰' },
    { id: 'reo', name: 'レオ', emoji: '🎬' },
    { id: 'mio', name: 'ミオ', emoji: '🎨' },
    { id: 'saito', name: 'サイトウ', emoji: '🔍' },
    { id: 'kana', name: 'カナ', emoji: '🤝' },
    { id: 'sou', name: 'ソウ', emoji: '🎵' },
  ];

  const toggleStaff = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 4));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments(prev => [...prev, { name: file.name, type: file.type, size: file.size, base64: ev.target.result.split(',')[1], preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date(), attachments: [...attachments] };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsTyping(true);

    try {
      const res = await fetch('http://localhost:3737/api/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: selectedStaffIds,
          userMessage: input,
          attachments: userMsg.attachments,
          history: history.slice(-10)
        })
      });
      const data = await res.json();
      if (data.responses) {
        data.responses.forEach((r, i) => {
          setTimeout(() => {
            setHistory(prev => [...prev, { role: 'assistant', staffName: r.staffName, emoji: r.emoji, content: r.text, timestamp: new Date() }]);
            if (i === data.responses.length - 1) setIsTyping(false);
          }, i * 800);
        });
      }
    } catch (e) {
      showToast('会議室サーバーに接続できません', 'error');
      setIsTyping(false);
    }
  };

  const saveMinutes = async () => {
    try {
      const res = await fetch('http://localhost:3737/api/minutes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'general',
          projectName: '全体定例会',
          history: history
        })
      });
      if (res.ok) showToast('議事録を保存しました', 'success');
    } catch (e) {
      showToast('保存に失敗しました', 'error');
    }
  };

  return (
    <div className="ac-meeting-container">
      <div className="ac-meeting-staff-picker">
        {STAFF_LIST.map(s => (
          <button 
            key={s.id} 
            className={`ac-staff-chip ${selectedStaffIds.includes(s.id) ? 'active' : ''}`}
            onClick={() => toggleStaff(s.id)}
          >{s.emoji} {s.name}</button>
        ))}
      </div>

      <div className="ac-history-area" ref={scrollRef}>
        {history.length === 0 && (
          <div className="ac-empty-msg">👋 パートナーを選択して会議を開始しましょう。動画や画像も解析可能です。</div>
        )}
        {history.map((m, idx) => (
          <div key={idx} className={`ac-bubble-row ${m.role}`}>
            <div className={`ac-bubble ${m.role}`}>
              {m.role === 'assistant' && <div className="ac-bubble-meta">{m.emoji} {m.staffName}</div>}
              <div className="ac-bubble-content">
                {m.content}
                {m.attachments?.map((att, i) => (
                  <div key={i} className="ac-bubble-attachment">
                    {att.type.startsWith('image/') ? <img src={att.preview} alt="attach" /> : <div className="ac-file-icon">🎥 Video File</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="ac-typing">AIが思考中...</div>}
      </div>

      <div className="ac-input-area">
        <div className="ac-attachment-bar">
          {attachments.map((att, i) => (
            <div key={i} className="ac-att-preview">
              {att.type.startsWith('image/') ? <img src={att.preview} alt="p" /> : '🎥'}
              <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
        </div>
        <div className="ac-input-row">
          <input 
            type="file" 
            hidden 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple
            accept="image/*,video/*"
          />
          <button className="ac-btn-icon" onClick={() => fileInputRef.current.click()}>📎</button>
          <input 
            className="ac-meeting-input" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="メッセージを入力..."
          />
          <button className="ac-btn-send" onClick={sendMessage}>送信</button>
        </div>
        <div className="ac-action-row">
          <button className="ac-btn-ghost" onClick={() => setHistory([])}>リセット</button>
          <button className="ac-btn-primary" onClick={saveMinutes}>議事録を保存</button>
        </div>
      </div>
    </div>
  );
}
