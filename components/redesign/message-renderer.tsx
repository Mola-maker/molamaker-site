'use client';

import { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toMarkdown } from '@/lib/chat/use-astrbot-chat';
import type { ChatMessage } from '@/lib/chat/use-astrbot-chat';

function MdImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) {
    return (
      <a className="ab-md__img-fail" href={src} target="_blank" rel="noopener noreferrer">
        🖼️ {alt?.trim() || 'image unavailable — tap to open'}
      </a>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ab-msg__img" src={src} alt={alt ?? ''} loading="lazy" onError={() => setFailed(true)} />
  );
}

const MD_COMPONENTS: Components = {
  img: ({ src, alt }) => (
    <MdImage
      src={typeof src === 'string' ? src : undefined}
      alt={typeof alt === 'string' ? alt : undefined}
    />
  ),
};

const TOOL_ICON: Record<string, string> = {
  running: '⟳',
  done:    '✓',
  error:   '⚠',
};

function ToolCard({ msg }: { msg: ChatMessage }) {
  const status = msg.toolStatus ?? 'running';
  return (
    <div className={`ab-tool-card ab-tool-card--${status}`}>
      <span className="ab-tool-card__icon">{TOOL_ICON[status]}</span>
      <span className="ab-tool-card__name">{msg.toolName ?? 'tool'}</span>
      {msg.toolSummary && (
        <span className="ab-tool-card__summary">{msg.toolSummary}</span>
      )}
    </div>
  );
}

interface Props {
  msg: ChatMessage;
}

export function MessageRenderer({ msg }: Props) {
  if (msg.kind === 'tool') {
    return <ToolCard msg={msg} />;
  }

  if (msg.role === 'user') {
    return (
      <>
        {msg.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ab-msg__img" src={msg.image} alt="" />
        )}
        {msg.text && <span className="ab-msg__usertext">{msg.text}</span>}
      </>
    );
  }

  return (
    <div className="ab-md">
      {msg.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ab-msg__img" src={msg.image} alt="" />
      )}
      {msg.text && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {toMarkdown(msg.text)}
        </ReactMarkdown>
      )}
    </div>
  );
}
