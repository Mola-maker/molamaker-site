'use client';

import type { CSSProperties, RefObject } from 'react';
import type { ChatMessage, ChatAttachment } from '@/lib/chat/use-astrbot-chat';
import type { AnimationType } from '@/lib/chat/trigger-words';
import { MessageRenderer } from './message-renderer';
import { TriggerAnimationOverlay } from './trigger-animation-overlay';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  attachment: ChatAttachment | null;
  uploading: boolean;
  configured: boolean | null;
  avatarContent: React.ReactNode;
  name: string;
  extraClass?: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  style?: CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  onReset: () => void;
  onClose: () => void;
  onAttachClick: () => void;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAttachment: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  activeAnimation: AnimationType | null;
  onDismissAnimation: () => void;
}

export function ChatPanel({
  messages, loading, input, attachment, uploading, configured,
  avatarContent, name, extraClass, bodyRef, fileRef,
  style, onMouseDown, onReset, onClose, onAttachClick,
  onPickFile, onClearAttachment, onInputChange, onKeyDown, onSend,
  activeAnimation, onDismissAnimation,
}: ChatPanelProps) {
  return (
    <div className={`ab-panel${extraClass ? ` ${extraClass}` : ''}`} style={style}>
      <div className="ab-panel__header" onMouseDown={onMouseDown}>
        <div className="ab-panel__avatar">{avatarContent}</div>
        <div className="ab-panel__title">
          <span className="ab-panel__name">{name}</span>
          <span className="ab-panel__status">
            <span className="ab-status-dot" />
            {configured ? 'online' : 'connecting…'}
          </span>
        </div>
        <button className="ab-panel__reset" onClick={onReset} onMouseDown={(e) => e.stopPropagation()} aria-label="Reset chat" title="Reset chat">↺</button>
        <button className="ab-panel__close" onClick={onClose} onMouseDown={(e) => e.stopPropagation()} aria-label="Close">×</button>
      </div>

      <div className="ab-panel__body" ref={bodyRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ab-msg ab-msg--${msg.role}`}
            {...(msg.mood ? { 'data-mood': msg.mood } : {})}
          >
            {msg.role === 'bot' && msg.kind !== 'tool' && (
              <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            )}
            <div className="ab-msg__bubble">
              <MessageRenderer msg={msg} />
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'bot' && (
          <div className="ab-msg ab-msg--bot">
            <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            <div className="ab-msg__bubble ab-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <div className="ab-panel__footer">
        {attachment && (
          <div className="ab-attach">
            {attachment.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ab-attach__thumb" src={attachment.previewUrl} alt="" />
            ) : (
              <span className="ab-attach__file" aria-hidden="true">📄</span>
            )}
            <span className="ab-attach__name">{attachment.file.name}</span>
            <button className="ab-attach__remove" onClick={onClearAttachment} onMouseDown={(e) => e.stopPropagation()} aria-label="Remove attachment">×</button>
          </div>
        )}
        <div className="ab-panel__input-row">
          <button className="ab-panel__attach" onClick={onAttachClick} disabled={loading || uploading} aria-label="Attach" title="Attach a photo or file">📎</button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,text/plain" hidden onChange={onPickFile} />
          <textarea
            className="ab-panel__input"
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder="Ask anything… (Enter to send)"
            rows={1}
            disabled={loading}
          />
          <button className="ab-panel__send" onClick={onSend} disabled={loading || uploading || (!input.trim() && !attachment)} aria-label="Send">
            {uploading ? '…' : '↑'}
          </button>
        </div>
      </div>

      <TriggerAnimationOverlay animation={activeAnimation} onDismiss={onDismissAnimation} />
    </div>
  );
}
