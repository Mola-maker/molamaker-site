'use client';

import { useState } from 'react';

const MAX_VISIBLE = 4000;

interface MessageBubbleProps {
  role: 'user' | 'bot';
  text: string;
  ts: string;
}

export default function MessageBubble({ role, text, ts }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > MAX_VISIBLE && !expanded;

  return (
    <div className={`chat-msg chat-msg-${role}`}>
      <div className="chat-bubble">
        {truncated ? text.slice(0, MAX_VISIBLE) + '…' : text}
        {text.length > MAX_VISIBLE && (
          <button className="chat-show-more" onClick={() => setExpanded(!expanded)}>
            {expanded ? '收起' : 'Show more'}
          </button>
        )}
      </div>
      <time className="chat-ts" dateTime={ts}>
        {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  );
}
