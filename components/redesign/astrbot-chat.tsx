'use client';

import { createPortal } from 'react-dom';
import { assetUrl } from '@/lib/asset-url';
import { useAstrbotChat, INITIAL_MESSAGE } from '@/lib/chat/use-astrbot-chat';
import { ChatPanel } from './chat-panel';

export function AstrbotChat() {
  const chat = useAstrbotChat();

  if (chat.configured === false) return null;

  return (
    <>
      <div
        className="ab-widget"
        style={{ transform: `translate(${chat.pos.x}px, ${chat.pos.y}px)` }}
        ref={chat.bubbleRef}
      >
        {!chat.open && (
          <button
            className="ab-bubble"
            onClick={() => chat.setOpen(true)}
            onMouseDown={chat.onMouseDown}
            aria-label="Open AstrBot chat"
            title="Chat with AstrBot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl('/redesign/miku-dance.gif')} alt="Miku" className="ab-bubble__gif" />
            <span className="ab-bubble__badge" aria-hidden="true">✦</span>
          </button>
        )}
      </div>

      {chat.open && typeof document !== 'undefined' && createPortal(
        <ChatPanel
          messages={chat.messages}
          loading={chat.loading}
          input={chat.input}
          attachment={chat.attachment}
          uploading={chat.uploading}
          configured={chat.configured}
          avatarContent={
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl('/redesign/miku-dance.gif')} alt="" />
          }
          name="AstrBot × Miku"
          bodyRef={chat.bodyRef}
          fileRef={chat.fileRef}
          style={chat.panelStyle('bottom-right')}
          onMouseDown={chat.onMouseDown}
          onReset={() => { chat.setMessages([INITIAL_MESSAGE]); chat.setInput(''); }}
          onClose={() => chat.setOpen(false)}
          onAttachClick={() => chat.fileRef.current?.click()}
          onPickFile={chat.onPickFile}
          onClearAttachment={chat.clearAttachment}
          onInputChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={chat.onKeyDown}
          onSend={chat.send}
          activeAnimation={chat.activeAnimation}
          onDismissAnimation={chat.dismissAnimation}
        />,
        document.body,
      )}
    </>
  );
}
