import { useState, useEffect } from 'react';
import { sendToAI, loadData, DEFAULT_GAS_URL } from '../store.js';

const STATUS = {
  draft:    { label: '下書き',   color: '#95a5a6', icon: '📝' },
  scheduled:{ label: '予約済み', color: '#f39c12', icon: '📅' },
  posted:   { label: '投稿済み', color: '#2ecc71', icon: '✅' },
};
const PLATFORMS = ['Amazon', '楽天'];
const CATEGORIES = ['ガジェット', '生活便利グッズ', '今週のベストバイまとめ', '充電器', 'イヤホン', 'モバイルバッテリー', 'キーボード', 'マウス', 'スマホアクセ', 'PC周辺機器', 'スマートホーム', 'その他'];
const CHAR_LIMIT = 230;

export default function AffiliateView({ apiKeys, staff, onBack, gasUrl: propGasUrl, showToast }) {
  const gasUrl = propGasUrl || loadData('nexus_gas_url') || DEFAULT_GAS_URL;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [metricsModal, setMetricsModal] = useState(null);
  const [draft, setDraft] = useState({ productName:'', category:'', priceRange:'', affiliateLink:'', postText:'', status:'draft', platform:'Amazon' });
  const [metrics, setMetrics] = useState({ likes:0, retweets:0, impressions:0, clicks:0, hasSale:'なし', sendDiscordReport:false });
  const [filter, setFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [postingId, setPostingId] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dayCategory, setDayCategory] = useState('');
  const [discordSending, setDiscordSending] = useState(null);

  const getStatusKey = (s) => s === '下書き' ? 'draft' : s === '予約済み' ? 'scheduled' : s === '投稿済み' ? 'posted' : 'draft';

  const filtered = posts.filter(p => {
    const sk = getStatusKey(p['ステータス'] || '');
    const pf = p['プラットフォーム'] || 'Amazon';
    if (filter !== 'all' && sk !== filter) return false;
    if (platformFilter !== 'all' && pf !== platformFilter) return false;
    return true;
  });

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      if (gasUrl) {
        const res = await fetch(`${gasUrl}?action=getAffiliatePosts`);
        const data = await res.json();
        if (data.posts) setPosts(data.posts);
        if (data.dayCategory) setDayCategory(data.dayCategory);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openNew = () => {
    setDraft({ productName:'', category:'', priceRange:'', affiliateLink:'', postText:'', status:'draft', platform:'Amazon' });
    setAiInput(''); setModal('new');
  };
  const openEdit = (post) => {
    setDraft({
      postId: post['投稿ID'], productName: post['商品名']||'', category: post['カテゴリ']||'',
      priceRange: post['価格帯']||'', affiliateLink: post['リンク']||'', postText: post['投稿本文']||'',
      status: getStatusKey(post['ステータス']||''), platform: post['プラットフォーム']||'Amazon',
    });
    setAiInput(''); setModal('edit');
  };

  const savePost = async () => {
    if (!draft.postText.trim()) { showToast?.('投稿本文を入力してください','warning'); return; }
    const statusMap = { draft:'下書き', scheduled:'予約済み', posted:'投稿済み' };
    try {
      await fetch(gasUrl, { method:'POST', body: JSON.stringify({ action:'save_affiliate_post', ...draft, status: statusMap[draft.status]||draft.status }) });
      showToast?.('保存しました','success'); setModal(null); fetchPosts();
    } catch (e) { showToast?.('保存失敗: '+e.message,'error'); }
  };

  const postNow = async (post) => {
    const postId = post['投稿ID'];
    if (!window.confirm('この内容で今すぐXに投稿しますか？')) return;
    setPostingId(postId);
    try { await fetch(gasUrl, { method:'POST', body: JSON.stringify({ action:'post_affiliate', postId }) }); showToast?.('投稿リクエスト送信','success'); fetchPosts(); } catch(e) { showToast?.('投稿失敗','error'); }
    setPostingId(null);
  };

  const sendToDiscord = async (post) => {
    const postId = post['投稿ID'];
    setDiscordSending(postId);
    try {
      await fetch(gasUrl, { method:'POST', body: JSON.stringify({
        action:'post_affiliate_discord', platform: post['プラットフォーム']||'Amazon',
        productName: post['商品名'], priceRange: post['価格帯'], affiliateLink: post['リンク'],
        features: post['カテゴリ'], category: post['カテゴリ'], target: ''
      })});
      showToast?.('Discordに送信しました','success');
    } catch(e) { showToast?.('Discord送信失敗','error'); }
    setDiscordSending(null);
  };

  const openMetrics = (post) => {
    setMetrics({ postId: post['投稿ID'], likes: Number(post['いいね数'])||0, retweets: Number(post['RT数'])||0,
      impressions: Number(post['インプレッション'])||0, clicks: Number(post['クリック数'])||0, hasSale: post['売上有無']||'なし', sendDiscordReport: false });
    setMetricsModal(post);
  };
  const saveMetrics = async () => {
    try { await fetch(gasUrl, { method:'POST', body: JSON.stringify({ action:'update_affiliate_metrics', ...metrics }) });
      showToast?.('反応データ更新','success'); setMetricsModal(null); fetchPosts(); } catch(e) { showToast?.('更新失敗','error'); }
  };

  const generateWithAI = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const m = staff?.find(s => s.roleId === 'marketer') || staff?.[0];
      const result = await sendToAI({ staffId: m?.id||'aff', messages:[{ role:'user',
        content: `あなたはガジェットアフィリエイトのX投稿ライターです。\n商品: ${aiInput}\nプラットフォーム: ${draft.platform}\n\n【フォーマット】フック1行→特徴3つ(✅)→一言コメント→↓商品はこちら→ハッシュタグ\n【条件】230字以内・自然なトーン・絵文字1〜3個\n投稿文のみ返してください。` }], apiKeys });
      if (result?.text) setDraft(p => ({ ...p, postText: result.text }));
    } catch(e) { showToast?.('AI生成失敗','error'); }
    setAiLoading(false);
  };

  const fetchWeeklyReport = async () => {
    setReportLoading(true);
    try { const res = await fetch(`${gasUrl}?action=getAffiliateWeeklyReport`); setWeeklyReport(await res.json()); } catch(e) { showToast?.('レポート取得失敗','error'); }
    setReportLoading(false);
  };

  const charCount = draft.postText.length;
  const charOk = charCount > 0 && charCount <= CHAR_LIMIT;
  const dow = ['日','月','火','水','木','金','土'][new Date().getDay()];

  return (
    <div className="stack-dashboard animate-fadein">
      <header className="dash-header">
        <div className="dash-header-top">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:22 }}>📱</span>
            <span style={{ fontWeight:700, fontSize:16 }}>アフィリエイト管理 v2</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchWeeklyReport} disabled={reportLoading} style={{ fontSize:11 }}>{reportLoading ? '...' : '📊 週次'}</button>
            <button className="btn btn-primary btn-sm" onClick={openNew}>＋ 新規</button>
          </div>
        </div>
      </header>

      {/* 今日のカテゴリバー */}
      <div style={{ padding:'8px 16px 0', display:'flex', gap:8, alignItems:'center', fontSize:12 }}>
        <span style={{ background:'linear-gradient(135deg,#e67e22,#f39c12)', color:'#fff', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>
          {dow}曜日 → {dayCategory || '読み込み中...'}
        </span>
        <span style={{ color:'var(--text-muted)', fontSize:11 }}>12時:Amazon / 18時:楽天</span>
      </div>

      {/* 週次レポート */}
      {weeklyReport && !weeklyReport.error && (
        <div style={{ padding:'12px 16px 4px' }}>
          <div className="glass-card" style={{ padding:14, background:'linear-gradient(135deg,rgba(39,174,96,0.1),rgba(46,204,113,0.05))', border:'1px solid rgba(39,174,96,0.2)' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>📊 週次レポート（{weeklyReport.period}）</div>
            <div style={{ display:'flex', justifyContent:'space-around', textAlign:'center', marginBottom:8 }}>
              {[['投稿',weeklyReport.posts,''],['imp',(weeklyReport.totalImpressions||0).toLocaleString(),'#3498db'],['クリック',(weeklyReport.totalClicks||0).toLocaleString(),'#e67e22'],['売上',weeklyReport.sales,'#2ecc71']].map(([l,v,c])=>(
                <div key={l}><div style={{ fontSize:20, fontWeight:800, color:c||'inherit' }}>{v}</div><div style={{ fontSize:10, color:'var(--text-muted)' }}>{l}</div></div>
              ))}
            </div>
            <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text-secondary)' }}>
              <span>📦 Amazon: {weeklyReport.amazon?.posts||0}投稿</span>
              <span>🛍 楽天: {weeklyReport.rakuten?.posts||0}投稿</span>
            </div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div style={{ display:'flex', gap:6, padding:'10px 16px 0', overflowX:'auto', flexWrap:'wrap' }}>
        {[['all','すべて'],['draft','下書き'],['scheduled','予約済み'],['posted','投稿済み']].map(([v,l])=>(
          <button key={v} className={`btn btn-sm ${filter===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:11 }} onClick={()=>setFilter(v)}>{l}</button>
        ))}
        <span style={{ width:1, background:'var(--border-color)', margin:'0 2px' }}/>
        {[['all','全て'],['Amazon','Amazon'],['楽天','楽天']].map(([v,l])=>(
          <button key={v} className={`btn btn-sm ${platformFilter===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:11 }} onClick={()=>setPlatformFilter(v)}>{l}</button>
        ))}
      </div>

      {/* 投稿リスト */}
      <div style={{ padding:'8px 16px 80px' }}>
        {loading ? <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>読み込み中...</div>
        : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📱</div>
            <div style={{ fontSize:14 }}>投稿がありません</div>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={openNew}>最初の投稿を作る</button>
          </div>
        ) : filtered.map((post, idx) => {
          const sk = getStatusKey(post['ステータス']||'');
          const s = STATUS[sk]||STATUS.draft;
          const pid = post['投稿ID']||'';
          const pf = post['プラットフォーム']||'Amazon';
          const isPosting = postingId === pid;
          const isSendingDiscord = discordSending === pid;
          return (
            <div key={pid||idx} className="glass-card" style={{ marginBottom:10, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, color:s.color, background:s.color+'22', padding:'2px 8px', borderRadius:20 }}>{s.icon} {s.label}</span>
                <span style={{ fontSize:10, fontWeight:700, color: pf==='楽天'?'#bf0000':'#ff9900', background: pf==='楽天'?'#bf000015':'#ff990015', padding:'2px 8px', borderRadius:20 }}>
                  {pf==='楽天'?'🛍':'📦'} {pf}
                </span>
                {post['商品名'] && <span style={{ fontSize:12, fontWeight:600 }}>{post['商品名']}</span>}
                <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-muted)' }}>{(post['投稿本文']||'').length}字</span>
              </div>
              <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:8, maxHeight:100, overflow:'hidden' }}>{post['投稿本文']||''}</div>
              {sk === 'posted' && (
                <div style={{ display:'flex', gap:10, marginBottom:8, fontSize:11, color:'var(--text-secondary)' }}>
                  <span>❤️{post['いいね数']||0}</span><span>🔁{post['RT数']||0}</span>
                  <span>👁{(Number(post['インプレッション'])||0).toLocaleString()}</span><span>🔗{post['クリック数']||0}</span>
                  <span style={{ color:post['売上有無']==='あり'?'#2ecc71':'var(--text-muted)' }}>💰{post['売上有無']||'なし'}</span>
                </div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={()=>openEdit(post)} disabled={isPosting}>編集</button>
                {sk !== 'posted' && <button className="btn btn-primary btn-sm" style={{ fontSize:11 }} onClick={()=>postNow(post)} disabled={isPosting}>{isPosting?'送信中...':'🚀 投稿'}</button>}
                <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#7289da' }} onClick={()=>sendToDiscord(post)} disabled={isSendingDiscord}>{isSendingDiscord?'送信中...':'📣 Discord'}</button>
                {sk === 'posted' && <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#3498db' }} onClick={()=>openMetrics(post)}>📊 反応</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 新規/編集モーダル */}
      {modal !== null && (
        <div className="modal-overlay" style={{ zIndex:1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth:520, width:'95vw', maxHeight:'90vh', overflow:'auto' }}>
            <div className="modal-header"><h3>📱 {modal==='new'?'新規投稿':'編集'}</h3></div>
            <div className="modal-body">
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {PLATFORMS.map(p => (
                  <button key={p} className={`btn btn-sm ${draft.platform===p?'btn-primary':'btn-ghost'}`}
                    style={{ flex:1, fontSize:13 }} onClick={()=>setDraft(d=>({...d,platform:p}))}>
                    {p==='楽天'?'🛍':'📦'} {p}
                  </button>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>商品名</div>
                  <input className="input" placeholder="例: Anker 充電器" value={draft.productName} onChange={e=>setDraft(p=>({...p,productName:e.target.value}))} style={{ fontSize:13 }}/></div>
                <div><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>カテゴリ</div>
                  <select className="input" value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))} style={{ fontSize:13 }}>
                    <option value="">自動（曜日ローテ）</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>価格帯</div>
                  <input className="input" placeholder="¥3,000〜" value={draft.priceRange} onChange={e=>setDraft(p=>({...p,priceRange:e.target.value}))} style={{ fontSize:13 }}/></div>
                <div><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>ステータス</div>
                  <select className="input" value={draft.status} onChange={e=>setDraft(p=>({...p,status:e.target.value}))} style={{ fontSize:13 }}>
                    <option value="draft">下書き</option><option value="scheduled">予約済み</option>
                  </select></div>
              </div>
              <div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>アフィリエイトリンク</div>
                <input className="input" placeholder={draft.platform==='楽天'?'https://hb.afl.rakuten.co.jp/...':'https://amzn.to/...'} value={draft.affiliateLink} onChange={e=>setDraft(p=>({...p,affiliateLink:e.target.value}))} style={{ fontSize:13, width:'100%' }}/></div>
              <div style={{ marginBottom:12, padding:12, background:'var(--bg-secondary)', borderRadius:10 }}>
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>🤖 AI投稿文生成</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="input" placeholder="商品名や特徴..." value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&generateWithAI()} style={{ flex:1, fontSize:13 }}/>
                  <button className="btn btn-primary btn-sm" onClick={generateWithAI} disabled={aiLoading||!aiInput.trim()} style={{ fontSize:12 }}>{aiLoading?'生成中...':'✨生成'}</button>
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'var(--text-secondary)' }}>投稿本文</span>
                  <span style={{ fontSize:11, color: charOk?'#2ecc71':charCount>CHAR_LIMIT?'var(--accent-error)':'#f39c12' }}>{charCount}/{CHAR_LIMIT}字 {charOk?'✅':''}</span>
                </div>
                <textarea className="input" rows={7} placeholder="投稿内容..." value={draft.postText} onChange={e=>setDraft(p=>({...p,postText:e.target.value}))} style={{ width:'100%', resize:'vertical', fontSize:13, lineHeight:1.6 }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <button className="btn btn-ghost" onClick={()=>setModal(null)}>キャンセル</button>
                <button className="btn btn-primary" onClick={savePost} disabled={!draft.postText.trim()}>💾 保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 反応データモーダル */}
      {metricsModal !== null && (
        <div className="modal-overlay" style={{ zIndex:1000 }}>
          <div className="modal-content animate-slideup" style={{ maxWidth:400, width:'95vw' }}>
            <div className="modal-header"><h3>📊 反応データ</h3></div>
            <div className="modal-body">
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:12 }}>商品: {metricsModal['商品名']||'不明'} ({metricsModal['プラットフォーム']||'Amazon'})</div>
              {[['likes','❤️ いいね'],['retweets','🔁 RT'],['impressions','👁 インプレッション'],['clicks','🔗 クリック']].map(([k,l])=>(
                <div key={k} style={{ marginBottom:10 }}><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>{l}</div>
                  <input type="number" className="input" value={metrics[k]} onChange={e=>setMetrics(p=>({...p,[k]:Number(e.target.value)}))} style={{ fontSize:13, width:'100%' }}/></div>
              ))}
              <div style={{ marginBottom:12 }}><div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:4 }}>💰 売上</div>
                <select className="input" value={metrics.hasSale} onChange={e=>setMetrics(p=>({...p,hasSale:e.target.value}))} style={{ fontSize:13, width:'100%' }}>
                  <option value="なし">なし</option><option value="あり">あり</option></select></div>
              <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, fontSize:12, color:'var(--text-secondary)' }}>
                <input type="checkbox" checked={metrics.sendDiscordReport} onChange={e=>setMetrics(p=>({...p,sendDiscordReport:e.target.checked}))}/>
                📣 Discordにも反応レポートを送信する
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <button className="btn btn-ghost" onClick={()=>setMetricsModal(null)}>キャンセル</button>
                <button className="btn btn-primary" onClick={saveMetrics}>💾 保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
