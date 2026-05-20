// ============================================
// FormattedMessage — マークダウン風整形
// ============================================
function FormattedMessage({ text }) {
  if (!text) return null;
  if (typeof text !== 'string') return <span>{JSON.stringify(text)}</span>;

  // **太字** をspanに変換
  const renderInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  const lines = text.split('\n');
  let inCodeBlock = false;
  const codeLines = [];

  const elements = [];
  let emptyCount = 0;

  lines.forEach((line, i) => {
    // コードブロック
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines.length = 0;
      } else {
        inCodeBlock = false;
        elements.push(
          <pre key={i} className="msg-code">{codeLines.join('\n')}</pre>
        );
      }
      return;
    }
    if (inCodeBlock) { codeLines.push(line); return; }

    // 空行: 連続2行以上は1行に圧縮
    if (line.trim() === '') {
      emptyCount++;
      if (emptyCount === 1) elements.push(<div key={i} className="msg-spacer" />);
      return;
    }
    emptyCount = 0;

    if (line.startsWith('# '))  { elements.push(<h2 key={i} className="msg-h1">{renderInline(line.slice(2))}</h2>); return; }
    if (line.startsWith('## ')) { elements.push(<h3 key={i} className="msg-h2">{renderInline(line.slice(3))}</h3>); return; }
    if (line.startsWith('### ') || line.startsWith('■ ')) {
      elements.push(<div key={i} className="msg-section">{renderInline(line.replace(/^(### |■ )/, ''))}</div>); return;
    }
    if (line.startsWith('---') || line.startsWith('===')) {
      elements.push(<hr key={i} className="msg-hr" />); return;
    }
    if (line.match(/^(\d+\.) /)) {
      elements.push(<div key={i} className="msg-list-item msg-ol">{renderInline(line)}</div>); return;
    }
    if (line.match(/^[-•*] /)) {
      elements.push(<div key={i} className="msg-list-item msg-ul">{'• '}{renderInline(line.slice(2))}</div>); return;
    }
    elements.push(<p key={i} className="msg-p">{renderInline(line)}</p>);
  });

  return <div className="formatted-msg">{elements}</div>;
}

export default FormattedMessage;
