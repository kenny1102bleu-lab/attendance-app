import { useState, useEffect } from 'react';

const SystemArchitectureMap = () => {
  const [nodes, setNodes] = useState([
    { id: 'dashboard', label: 'KCS Dashboard\n(React Frontend)', x: 400, y: 250, type: 'core', status: 'Active', icon: '💻' },
    { id: 'gas_backend', label: 'KCS Backend\n(Google Apps Script)', x: 400, y: 100, type: 'backend', status: 'Syncing...', icon: '⚙️' },
    { id: 'make', label: 'Make.com\n(Automation Hub)', x: 700, y: 100, type: 'api', status: 'Listening', icon: '🔗' },
    { id: 'notion', label: 'Notion API\n(Database/Tasks)', x: 700, y: 250, type: 'database', status: 'Connected', icon: '📝' },
    { id: 'discord', label: 'Discord API\n(Notifications/Commands)', x: 700, y: 400, type: 'api', status: 'Connected', icon: '💬' },
    { id: 'ai', label: 'AI Engines\n(Gemini / Claude)', x: 100, y: 250, type: 'ai', status: 'Ready', icon: '🧠' },
    { id: 'pizza', label: 'Pizza App\n(External Monitor)', x: 100, y: 100, type: 'external', status: 'Scraping...', icon: '🍕' },
    { id: 'file_org', label: 'File Organizer\n(Local Python)', x: 100, y: 400, type: 'external', status: 'Sleeping', icon: '📁' },
  ]);

  const edges = [
    { source: 'dashboard', target: 'gas_backend', label: 'API Calls' },
    { source: 'dashboard', target: 'ai', label: 'Prompts/Context' },
    { source: 'gas_backend', target: 'make', label: 'Webhooks' },
    { source: 'make', target: 'notion', label: 'Save Records' },
    { source: 'make', target: 'discord', label: 'Send Alerts' },
    { source: 'pizza', target: 'gas_backend', label: 'Stock Alerts' },
    { source: 'file_org', target: 'dashboard', label: 'Logs/Updates' },
  ];

  // ランダムにステータスを更新して「生きている」感を出す
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prevNodes => prevNodes.map(node => {
        if (Math.random() > 0.7) {
          const statuses = ['Active', 'Processing...', 'Syncing...', 'Connected', 'Idle', 'Waiting...'];
          return { ...node, status: statuses[Math.floor(Math.random() * statuses.length)] };
        }
        return node;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // SVGの線を描画するための計算
  const renderLine = (edge, index) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    // ノードの中央座標
    const x1 = sourceNode.x;
    const y1 = sourceNode.y;
    const x2 = targetNode.x;
    const y2 = targetNode.y;

    // 中間点（ラベル用）
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
      <g key={index}>
        <line 
          x1={x1} y1={y1} x2={x2} y2={y2} 
          stroke="var(--border-accent)" 
          strokeWidth="2" 
          strokeDasharray="4 4"
          className="edge-line"
        />
        <circle cx={x2} cy={y2} r="4" fill="var(--border-accent)" />
        {/* エッジラベル */}
        <text 
          x={midX} y={midY - 10} 
          fill="var(--text-muted)" 
          fontSize="10" 
          textAnchor="middle"
          className="edge-label"
        >
          {edge.label}
        </text>
      </g>
    );
  };

  return (
    <div className="system-arch-map" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        {edges.map((edge, index) => renderLine(edge, index))}
      </svg>

      {nodes.map(node => (
        <div 
          key={node.id}
          className={`arch-node type-${node.type}`}
          style={{
            position: 'absolute',
            left: `${node.x}px`,
            top: `${node.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '140px',
            padding: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: `2px solid ${getColorForType(node.type)}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 2,
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{node.icon}</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>
            {node.label}
          </div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '9px', 
            color: node.status === 'Active' || node.status === 'Connected' || node.status === 'Ready' ? '#2ecc71' : 'var(--text-muted)',
            backgroundColor: 'var(--bg-primary)',
            padding: '2px 6px',
            borderRadius: '12px',
            border: '1px solid currentColor'
          }}>
            {node.status}
          </div>
        </div>
      ))}
      
      <style>{`
        .arch-node:hover {
          transform: translate(-50%, -50%) scale(1.05) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
          z-index: 10 !important;
        }
        .edge-line {
          animation: dash 20s linear infinite;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  );
};

// 種類に応じたボーダーカラー
function getColorForType(type) {
  const colors = {
    core: '#3498db',    // Blue
    backend: '#e67e22', // Orange
    database: '#9b59b6',// Purple
    api: '#f1c40f',     // Yellow
    ai: '#e74c3c',      // Red
    external: '#2ecc71' // Green
  };
  return colors[type] || '#ccc';
}

export default SystemArchitectureMap;
