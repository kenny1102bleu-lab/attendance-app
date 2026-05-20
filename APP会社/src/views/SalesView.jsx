import { useState, useEffect } from 'react';

const PIZZA_GAS_URL = 'https://script.google.com/macros/s/AKfycbwlUczPBlz7x_CfNPdpvM-pizrcXnk3250d62J5vFdA6d3lpF1IdEJUlm3RqyZK2NUx/exec';

function SalesView({ gasUrl, onBack }) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PIZZA_GAS_URL}?action=getProducts`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.products || []);
      setProducts(list);
      const inStock = list.filter(p => p.stock === 'inStock' || p.inStock === true).length;
      const outOfStock = list.filter(p => p.stock === 'outOfStock' || p.inStock === false).length;
      setSummary({ inStock, outOfStock, total: list.length });
      setLastUpdated(new Date());
    } catch (e) {
      setError('データ取得に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stockRate = summary ? Math.round((summary.inStock / Math.max(summary.total, 1)) * 100) : 0;

  return (
    <div className="view-root animate-fadein">
      <div className="view-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← 戻る</button>
        <h2 className="view-title">💰 売上・在庫管理</h2>
        <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={loading}>
          {loading ? '更新中…' : '🔄 更新'}
        </button>
      </div>

      {lastUpdated && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
        </div>
      )}

      {error && (
        <div style={{ margin: '12px 16px', padding: '10px 14px', background: '#e74c3c22', borderRadius: 8, color: '#e74c3c', fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {loading && !summary && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          データを取得中…
        </div>
      )}

      {summary && (
        <>
          {/* KPIカード */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 16px 16px' }}>
            <div className="stack-card" style={{ '--stack-color': '#27ae60', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#27ae60' }}>{summary.inStock}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>在庫あり</div>
            </div>
            <div className="stack-card" style={{ '--stack-color': '#e74c3c', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#e74c3c' }}>{summary.outOfStock}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>在庫なし</div>
            </div>
            <div className="stack-card" style={{ '--stack-color': '#3498db', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#3498db' }}>{summary.total}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>総商品数</div>
            </div>
          </div>

          {/* 在庫率バー */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
              <span>在庫率</span>
              <span style={{ color: stockRate >= 70 ? '#27ae60' : stockRate >= 40 ? '#f39c12' : '#e74c3c', fontWeight: 700 }}>
                {stockRate}%
              </span>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stockRate}%`,
                background: stockRate >= 70 ? '#27ae60' : stockRate >= 40 ? '#f39c12' : '#e74c3c',
                borderRadius: 6,
                transition: 'width 0.6s ease'
              }} />
            </div>
          </div>

          {/* 簡易バーチャート */}
          {summary.total > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                📊 在庫状況グラフ
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {[
                  { label: '在庫あり', value: summary.inStock, color: '#27ae60' },
                  { label: '在庫なし', value: summary.outOfStock, color: '#e74c3c' },
                ].map(bar => {
                  const pct = Math.round((bar.value / summary.total) * 100);
                  const h = Math.max(4, Math.round((bar.value / summary.total) * 72));
                  return (
                    <div key={bar.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: bar.color }}>{pct}%</div>
                      <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: h, background: bar.color, borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{bar.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{bar.value}件</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 商品一覧 */}
          {products.length > 0 && (
            <div style={{ padding: '0 16px 80px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                🍕 商品一覧 ({products.length}件)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {products.map((p, i) => {
                  const isInStock = p.stock === 'inStock' || p.inStock === true;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8,
                      borderLeft: `3px solid ${isInStock ? '#27ae60' : '#e74c3c'}`
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name || p.productName || `商品 ${i + 1}`}</div>
                        {p.price && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>¥{p.price}</div>}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                        background: isInStock ? '#27ae6022' : '#e74c3c22',
                        color: isInStock ? '#27ae60' : '#e74c3c'
                      }}>
                        {isInStock ? '在庫あり' : '在庫なし'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SalesView;
