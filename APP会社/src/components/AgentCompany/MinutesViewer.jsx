import { useState, useEffect } from 'react';

export default function MinutesViewer() {
  const [minutes, setMinutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinute, setSelectedMinute] = useState(null);

  useEffect(() => {
    fetchMinutes();
  }, []);

  const fetchMinutes = async () => {
    try {
      const res = await fetch('http://localhost:3737/api/minutes');
      const data = await res.json();
      setMinutes(data || []);
    } catch (e) {
      console.error('Fetch minutes failed:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchMinutes();
      return;
    }
    try {
      const res = await fetch(`http://localhost:3737/api/minutes/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setMinutes(data || []);
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  return (
    <div className="ac-minutes-viewer">
      <div className="ac-search-bar">
        <input 
          placeholder="議事録を検索..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>検索</button>
      </div>

      <div className="ac-minutes-layout">
        <div className="ac-minutes-list">
          {minutes.map(m => (
            <div 
              key={m.id} 
              className={`ac-minute-item ${selectedMinute?.id === m.id ? 'active' : ''}`}
              onClick={() => setSelectedMinute(m)}
            >
              <div className="ac-minute-proj">{m.project_name}</div>
              <div className="ac-minute-date">{new Date(m.created_at).toLocaleDateString()}</div>
              <div className="ac-minute-snip">{m.summary?.slice(0, 40)}...</div>
            </div>
          ))}
          {minutes.length === 0 && <div className="ac-empty">議事録が見つかりません</div>}
        </div>

        <div className="ac-minute-detail">
          {selectedMinute ? (
            <div className="ac-detail-content">
              <h3>{selectedMinute.project_name} 議事録</h3>
              <div className="ac-detail-meta">開催日: {new Date(selectedMinute.created_at).toLocaleString()} | 発言数: {selectedMinute.msg_count}</div>
              <div className="ac-detail-summary">
                <strong>✨ AI要約:</strong>
                <p>{selectedMinute.summary}</p>
              </div>
              <div className="ac-detail-history">
                {selectedMinute.history?.map((h, i) => (
                  <div key={i} className={`ac-hist-bubble ${h.role}`}>
                    <small>{h.role === 'user' ? '社長' : h.staffName}</small>
                    <p>{h.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ac-detail-placeholder">左のリストから議事録を選択してください</div>
          )}
        </div>
      </div>
    </div>
  );
}
