import { useState, useRef, useEffect } from 'react';
import { liveDraftService, CHAT_MESSAGE_CAP } from '../../lib/liveDraftService';
import type { LiveDraftMessage } from '../../types/liveDraft';

interface LiveDraftChatProps {
  sessionId: string;
  messages: LiveDraftMessage[];
  /** Map of display_name → avatar_url for resolving chat avatars */
  avatarMap: Record<string, string>;
  isCaptain: boolean;
  currentUserDisplayName: string | null;
  onClose: () => void;
  headerHeight?: number;
  isSessionCompleted?: boolean;
}

export default function LiveDraftChat({
  sessionId,
  messages,
  avatarMap,
  isCaptain,
  currentUserDisplayName,
  onClose,
  headerHeight,
  isSessionCompleted,
}: LiveDraftChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const capReached = messages.length >= CHAT_MESSAGE_CAP;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (isCaptain) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isCaptain]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isCaptain || sending) return;

    setSending(true);
    setError(null);

    try {
      await liveDraftService.sendMessage(sessionId, newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-lol-dark border-l border-lol-surface">
      {/* Header - dynamically matches DraftHeader height */}
      <div
        className="px-3 border-b border-lol-border bg-lol-card flex flex-col items-center justify-center shrink-0"
        style={headerHeight ? { height: headerHeight } : undefined}
      >
        <div className="flex items-center gap-2 w-full">
          <svg className="w-5 h-5 text-lol-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <div className="flex flex-col">
            <span className="font-bold text-white text-sm leading-tight">Captain Chat</span>
            <span className={`text-[10px] ${capReached ? 'text-red-400' : 'text-gray-500'}`}>
              {isCaptain ? `${messages.length}/${CHAT_MESSAGE_CAP} messages` : 'View only'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto mr-1 p-1.5 text-gray-400 hover:text-white bg-lol-surface/60 hover:bg-lol-surface border border-lol-border/50 hover:border-lol-border-light rounded-md transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8 wrap-anywhere">
            {isCaptain ? 'No messages yet. Start the conversation!' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = currentUserDisplayName && message.display_name === currentUserDisplayName;

            const avatarUrl = message.profile?.avatar_url
              ?? avatarMap[message.display_name]
              ?? null;

            const avatar = avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-7 h-7 min-w-7 min-h-7 rounded-full shrink-0 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-lol-surface border border-lol-border flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            );

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isOwnMessage ? 'items-end self-end' : 'items-start self-start'}`}
              >
                {/* Avatar + Name */}
                <div className={`flex items-center gap-1.5 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  {avatar}
                  <span className={`text-[10px] font-medium ${isOwnMessage ? 'text-lol-gold' : 'text-gray-300'}`}>
                    {message.display_name}
                  </span>
                </div>

                {/* Chat bubble */}
                <div
                  className={`
                    px-2.5 py-1.5 rounded-lg text-sm wrap-anywhere w-fit
                    ${isOwnMessage
                      ? 'bg-lol-gold/20 text-white'
                      : 'bg-lol-surface text-gray-200'
                    }
                  `}
                >
                  {message.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 text-red-400 text-xs text-center bg-red-500/10 rounded">
          {error}
        </div>
      )}

      {/* Input - hidden when session is completed */}
      {!isSessionCompleted && (
        <form onSubmit={handleSendMessage} className="border-t border-lol-border/50 shrink-0">
          {capReached ? (
            <div className="text-center text-red-400 text-xs py-2">
              Message limit reached ({CHAT_MESSAGE_CAP} per draft)
            </div>
          ) : isCaptain ? (
            <div className="flex items-center gap-1.5 bg-lol-surface/80 border-lol-border/60 focus-within:border-lol-gold/50 transition-colors pl-4 pr-1.5 py-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none min-w-0"
                disabled={sending}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30 bg-lol-gold text-lol-dark hover:bg-lol-gold-light"
              >
                {sending ? (
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-1">
              Only captains can send messages
            </div>
          )}
        </form>
      )}
    </div>
  );
}
