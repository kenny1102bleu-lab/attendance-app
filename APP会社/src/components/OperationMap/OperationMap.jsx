import { useState, useEffect, useRef } from 'react';
import { PROJECT_TEAMS, DEFAULT_STAFF } from '../../store.js';
import matrixBg from '../../assets/matrix_office_bg.png';

// チャットデブ風のステータステキストをランダムに生成する関数
const getRandomStatus = (teamId) => {
  const statuses = {
    youtube: ['動画の台本を作成中...', 'サムネの構図を議論中', '編集中...✂️', 'Youtube APIに接続中'],
    mimomi_ec: ['在庫データを同期中📦', '新商品の説明文を生成中', '売上レポート作成中📊', '競合リサーチ中...'],
    affiliate: ['Amazonランキング取得中', '楽天APIから商品検索中', 'Xへの投稿文を推敲中...', 'アフィリエイトリンク生成🔗'],
    sns: ['トレンドキーワード分析中📈', 'ハッシュタグを最適化中', '予約投稿をセット完了', 'エンゲージメント確認中'],
    notify_app: ['Pizzaの在庫をスクレイピング中🍕', '通知サーバー稼働中🟢', 'Webhook送信エラーなし', 'システムリソース正常']
  };
  const list = statuses[teamId] || ['作業中...'];
  return list[Math.floor(Math.random() * list.length)];
};

export default function OperationMap({ onOpenAffiliate, onOpenX, onOpenAttendance, onOpenYouTube }) {
  // Container dimensions for boundary checking
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // 1. 動的に部屋（Room）を生成
  // 5つのチームを円形またはグリッド状に配置
  const rooms = PROJECT_TEAMS.map((team, index) => {
    // 簡易的なハードコード位置、ウィンドウサイズに合わせて後で動的にする手もあるが今回はパーセント指定
    const positions = [
      { top: '10%', left: '10%', width: 140, height: 100 },
      { top: '10%', left: '70%', width: 140, height: 100 },
      { top: '60%', left: '10%', width: 140, height: 100 },
      { top: '60%', left: '70%', width: 140, height: 100 },
      { top: '35%', left: '40%', width: 160, height: 120 } // 中央
    ];
    const pos = positions[index % positions.length];
    
    // クリック時のアクションをマッピング
    let onClick = undefined;
    if (team.id === 'affiliate') onClick = onOpenAffiliate;
    if (team.id === 'sns') onClick = onOpenX;
    if (team.id === 'youtube') onClick = onOpenYouTube;
    if (team.id === 'notify_app') onClick = onOpenAttendance;

    return { ...team, ...pos, onClick };
  });

  // 2. キャラクター（Agent）の状態管理
  // 各スタッフをいずれかの部屋にランダムに割り当てて初期位置を決定
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }

    // 初期化：スタッフを各部屋に分散配置
    const initialAgents = DEFAULT_STAFF.map(staff => {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const topPct = parseFloat(room.top);
      const leftPct = parseFloat(room.left);
      return {
        ...staff,
        room: room.id,
        x: leftPct + Math.random() * 10,
        y: topPct + Math.random() * 10,
        facingRight: true, // 向いている方向
        status: '',
        showBubble: false
      };
    });
    setAgents(initialAgents);
  }, []); // 初回のみ

  // 3. 移動と会話のロジックループ
  useEffect(() => {
    if (agents.length === 0) return;

    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => {
        // 30%の確率で行動を起こす
        if (Math.random() > 0.3) return { ...agent, showBubble: false };

        // 部屋を移動するか、同じ部屋の中で動くか
        const isMovingRoom = Math.random() < 0.2; // 20%の確率で別の部屋へ
        let targetRoomId = agent.room;
        if (isMovingRoom) {
          const newRoom = rooms[Math.floor(Math.random() * rooms.length)];
          targetRoomId = newRoom.id;
        }

        const targetRoom = rooms.find(r => r.id === targetRoomId);
        if (!targetRoom) return agent;

        // ターゲット部屋の中のランダムな位置(%)
        const targetX = parseFloat(targetRoom.left) + 2 + Math.random() * 10;
        const targetY = parseFloat(targetRoom.top) + 2 + Math.random() * 10;

        // 向いている方向を決定（右へ移動ならtrue、左へ移動ならfalse）
        const facingRight = targetX >= agent.x;

        // 吹き出しを出すか
        const isTalking = Math.random() < 0.5;
        const newStatus = isTalking ? getRandomStatus(targetRoomId) : agent.status;

        return {
          ...agent,
          room: targetRoomId,
          x: targetX,
          y: targetY,
          facingRight,
          status: newStatus,
          showBubble: isTalking
        };
      }));
    }, 4000); // 4秒ごとに誰かが動く

    return () => clearInterval(interval);
  }, [agents.length]); // agentsが初期化されたら開始

  return (
    <div className="op-map-container" ref={containerRef} style={{ backgroundImage: `url(${matrixBg})` }}>
      
      {/* 部屋の描画 */}
      {rooms.map(room => (
        <div 
          key={room.id} 
          className="op-room"
          style={{
            top: room.top,
            left: room.left,
            width: room.width,
            height: room.height,
            borderColor: room.color
          }}
          onClick={room.onClick}
        >
          <div className="op-room-title" style={{ color: room.color }}>
            {room.icon} {room.name}
          </div>
        </div>
      ))}

      {/* キャラクター（エージェント）の描画 */}
      {agents.map(agent => (
        <div 
          key={agent.id}
          className="op-agent"
          style={{
            transform: `translate(calc(${agent.x}vw - 16px), calc(${agent.y}vh - 16px))`,
            // 注：vh/vwだと親コンテナのサイズと合わないため、コンテナに対する%で配置する場合は left/top をトランジションするか、ピクセル換算する。
            // より簡単でレスポンシブな方法は left, top を % で指定し、marginで調整する方法。
            left: `${agent.x}%`,
            top: `${agent.y}%`,
            transform: 'translate(-50%, -50%)' // 中央揃え
          }}
        >
          {/* 吹き出し */}
          <div className="op-bubble" style={{ opacity: agent.showBubble ? 1 : 0 }}>
            {agent.status}
          </div>
          
          <img 
            src={agent.avatar} 
            alt={agent.name} 
            className="op-agent-img"
            style={{ 
              transform: agent.facingRight ? 'scaleX(-1)' : 'scaleX(1)' 
            }} 
          />
          <div style={{ fontSize: 9, fontWeight: 800, color: '#00ff41', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: 2, textShadow: '0 0 4px rgba(0,255,65,0.8)' }}>
            {agent.name}
          </div>
        </div>
      ))}

    </div>
  );
}
