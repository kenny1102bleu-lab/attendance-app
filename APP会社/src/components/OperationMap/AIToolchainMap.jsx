import React from 'react';
import { DEFAULT_STAFF } from '../../store.js';

const AIToolchainMap = ({ onOpenPipeline }) => {
  // Discordのハッシュタグ（チャンネル）ごとにスタッフをグループ化
  const channels = {};
  DEFAULT_STAFF.forEach(staff => {
    const channelName = staff.discordChannel || '#未割り当て';
    if (!channels[channelName]) {
      channels[channelName] = [];
    }
    channels[channelName].push(staff);
  });

  return (
    <div className="matrix-map-container" style={{
      width: '100%',
      minHeight: '600px',
      backgroundColor: '#050505',
      backgroundImage: 'radial-gradient(circle at 50% 50%, #0a150a 0%, #050505 100%)',
      padding: '20px',
      boxSizing: 'border-box',
      overflow: 'auto',
      fontFamily: 'monospace'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#00ff41', textShadow: '0 0 10px #00ff41', margin: 0, letterSpacing: '2px' }}>
          SYS.ORG.AI_TOOLCHAIN_MAP
        </h2>
        <div style={{ color: '#008f11', fontSize: '12px', marginTop: '5px' }}>STATUS: ONLINE | ENGINES: SYNCHRONIZED</div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ========================================
            HEADQUARTERS (kcs本部)
            ======================================== */}
        {channels['#kcs本部'] && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              borderBottom: '2px solid #00ff41',
              paddingBottom: '8px',
              marginBottom: '20px',
              textShadow: '0 0 10px rgba(0, 255, 65, 0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>🏢</span> KCS HEADQUARTERS
            </div>

            <div style={{
              border: '2px solid rgba(0, 255, 65, 0.6)',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 255, 65, 0.05)',
              padding: '20px',
              boxShadow: '0 0 20px rgba(0, 255, 65, 0.1), inset 0 0 20px rgba(0, 255, 65, 0.05)'
            }}>
              <div style={{ 
                color: '#00ff41', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                borderBottom: '1px dashed rgba(0, 255, 65, 0.5)', 
                paddingBottom: '8px',
                marginBottom: '20px',
                textShadow: '0 0 5px rgba(0, 255, 65, 0.5)'
              }}>
                [#kcs本部]
              </div>

              {/* kcs本部のスタッフはグリッドで横に並べる */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                {channels['#kcs本部'].map(staff => renderStaffNode(staff))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================
            CREATIVE TEAM (クリエイティブチーム)
            ======================================== */}
        {channels['#クリエイティブチーム'] && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              borderBottom: '2px solid #e67e22',
              paddingBottom: '8px',
              marginBottom: '20px',
              textShadow: '0 0 10px rgba(230, 126, 34, 0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>🎨</span> CREATIVE TEAM (Editor Hub)
            </div>

            <div style={{
              border: '1px solid rgba(230, 126, 34, 0.4)',
              borderRadius: '4px',
              backgroundColor: 'rgba(230, 126, 34, 0.03)',
              padding: '20px',
              boxShadow: 'inset 0 0 20px rgba(230, 126, 34, 0.05)'
            }}>
              <div style={{ 
                color: '#e67e22', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                borderBottom: '1px dashed rgba(230, 126, 34, 0.5)', 
                paddingBottom: '8px',
                marginBottom: '20px',
                textShadow: '0 0 5px rgba(230, 126, 34, 0.5)'
              }}>
                [#クリエイティブチーム]
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                {channels['#クリエイティブチーム'].map(staff => renderStaffNode(staff))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================
            ACTIVE PROJECTS (その他のチャンネル)
            ======================================== */}
        <div>
          <div style={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: 'bold',
            borderBottom: '2px solid #3498db',
            paddingBottom: '8px',
            marginBottom: '20px',
            textShadow: '0 0 10px rgba(52, 152, 219, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>🚀</span> ACTIVE PROJECTS (Project Managers)
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {Object.entries(channels)
              .filter(([channelName]) => channelName !== '#kcs本部' && channelName !== '#クリエイティブチーム')
              .map(([channelName, staffList]) => (
              <div
                key={channelName}
                onClick={() => onOpenPipeline?.({ id: channelName, name: channelName.replace('#', ''), icon: '🚀', color: '#3498db', desc: staffList.map(s => s.name).join('・') + ' 担当' })}
                style={{
                  border: '1px solid rgba(52, 152, 219, 0.4)',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(52, 152, 219, 0.03)',
                  padding: '16px',
                  boxShadow: 'inset 0 0 20px rgba(52, 152, 219, 0.05)',
                  cursor: onOpenPipeline ? 'pointer' : 'default',
                  transition: 'border-color 0.2s, background-color 0.2s',
                }}
                onMouseEnter={e => { if (onOpenPipeline) { e.currentTarget.style.borderColor = 'rgba(52,152,219,0.9)'; e.currentTarget.style.backgroundColor = 'rgba(52,152,219,0.08)'; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(52,152,219,0.4)'; e.currentTarget.style.backgroundColor = 'rgba(52,152,219,0.03)'; }}
              >
                <div style={{
                  color: '#3498db',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  borderBottom: '1px dashed rgba(52, 152, 219, 0.3)',
                  paddingBottom: '8px',
                  marginBottom: '16px',
                  textShadow: '0 0 5px rgba(52, 152, 219, 0.5)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>[PROJECT: {channelName}]</span>
                  {onOpenPipeline && <span style={{ fontSize: 11, opacity: 0.6 }}>OPEN →</span>}
                </div>

                {staffList.map(staff => renderStaffNode(staff))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

// スタッフ1人分のノードを描画する共通関数
function renderStaffNode(staff) {
  // マトリックス風のアニメーションをインラインで定義（またはApp.cssに追加）
  const glitchAnimStyle = {
    animation: `float 3s ease-in-out infinite, glitch 5s infinite`,
  };

  return (
    <div key={staff.id} style={{ marginBottom: '20px' }}>
      {/* CSS定義 */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        @keyframes glitch {
          0%, 96%, 100% { opacity: 1; transform: translateX(0); }
          97% { opacity: 0.8; transform: translateX(-2px); }
          98% { opacity: 0.9; transform: translateX(2px); }
          99% { opacity: 1; transform: translateX(-1px); }
        }
        @keyframes data-flow {
          0% { color: #008f11; text-shadow: none; }
          50% { color: #00ff41; text-shadow: 0 0 8px #00ff41; }
          100% { color: #008f11; text-shadow: none; }
        }
        .matrix-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #00ff41;
          box-shadow: 0 0 8px #00ff41;
          /* ドット絵・ホログラム風のCSSフィルター */
          filter: sepia(100%) hue-rotate(80deg) saturate(400%) contrast(150%) brightness(0.8);
          image-rendering: pixelated;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <img 
          src={staff.avatar} 
          alt={staff.name} 
          className="matrix-avatar"
          style={glitchAnimStyle}
        />
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{staff.name}</div>
          <div style={{ 
            color: '#050505', 
            backgroundColor: '#00ff41', 
            fontSize: '10px', 
            padding: '2px 6px', 
            borderRadius: '2px',
            display: 'inline-block',
            marginTop: '2px',
            fontWeight: 'bold'
          }}>
            {staff.department || '所属不明'}
          </div>
        </div>
      </div>

      {/* ツールチェーン */}
      {staff.toolchain && staff.toolchain.length > 0 && (
        <div style={{ paddingLeft: '20px', borderLeft: '1px solid rgba(0, 255, 65, 0.2)', marginLeft: '16px' }}>
          {staff.toolchain.map((link, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '12px', 
              marginBottom: '6px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <div style={{ width: '15px', color: '#008f11' }}>├─</div>
              <div style={{ width: '80px', color: '#ccc' }}>{link.task}</div>
              <div style={{ animation: 'data-flow 2s infinite', animationDelay: `${idx * 0.5}s` }}>→</div>
              <div style={{ 
                backgroundColor: 'rgba(0, 255, 65, 0.1)', 
                border: '1px solid rgba(0, 255, 65, 0.3)',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#00ff41',
                animation: 'data-flow 4s infinite',
                animationDelay: `${idx * 1.2}s`
              }}>
                <span>{link.icon}</span>
                <span>{link.tool}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AIToolchainMap;
