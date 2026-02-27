import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui';
import { liveDraftService } from '../../lib/liveDraftService';
import type { LiveDraftMessage } from '../../types/liveDraft';

interface LiveDraftChatProps {
  sessionId: string;
  messages: LiveDraftMessage[];
  isCaptain: boolean;
  currentUserDisplayName: string | null;
  onClose: () => void;
  headerHeight?: number;
}

export default function LiveDraftChat({
  sessionId,
  messages,
  isCaptain,
  currentUserDisplayName,
  onClose,
  headerHeight,
}: LiveDraftChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-lol-dark border-l border-lol-surface ml-2">
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
            <span className="text-[10px] text-gray-500">
              {isCaptain ? `${messages.length} messages` : 'View only'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-gray-400 hover:text-white transition-colors rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            {isCaptain ? 'No messages yet. Start the conversation!' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = currentUserDisplayName && message.display_name === currentUserDisplayName;

            return (
              <div
                key={message.id}
                className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {message.profile?.avatar_url ? (
                    <img
                      src={message.profile.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-lol-surface flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Message content */}
                <div className={`flex flex-col max-w-[80%] ${isOwnMessage ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs font-medium ${isOwnMessage ? 'text-lol-gold' : 'text-gray-400'}`}>
                      {message.display_name}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  <div
                    className={`
                      px-2.5 py-1.5 rounded-lg text-sm break-words
                      ${isOwnMessage
                        ? 'bg-lol-gold/20 text-white'
                        : 'bg-lol-surface text-gray-200'
                      }
                    `}
                  >
                    {message.content}
                  </div>
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

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-lol-surface shrink-0">
        {isCaptain ? (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-lol-surface border border-lol-border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-lol-gold focus:border-lol-gold"
              disabled={sending}
              maxLength={500}
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-1">
            Only captains can send messages
          </div>
        )}
      </form>
    </div>
  );
}
