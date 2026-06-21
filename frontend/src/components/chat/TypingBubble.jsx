import React from 'react';

const TypingBubble = ({ align = 'left', text = '' }) => (
  <div className={`typing-row ${align === 'right' ? 'typing-row-right' : 'typing-row-left'}`}>
    <div className="typing-stack">
      {text && <span className="typing-text">{text}</span>}
      <div className="typing-bubble" aria-label={text || 'Đang nhập'}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  </div>
);

export default TypingBubble;
