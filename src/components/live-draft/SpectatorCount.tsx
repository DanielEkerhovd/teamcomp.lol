import { useState } from 'react';
import { Modal } from '../ui';
import type { LiveDraftParticipant } from '../../types/liveDraft';
import { getParticipantDisplayName } from '../../types/liveDraft';

function formatRole(role: string) {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface SpectatorCountProps {
  participants: LiveDraftParticipant[];
}

export default function SpectatorCount({ participants }: SpectatorCountProps) {
  const [showModal, setShowModal] = useState(false);

  const spectators = participants.filter(p => p.participant_type === 'spectator');
  const count = spectators.length;

  const loggedInSpectators = spectators.filter(p => p.user_id);
  const anonymousCount = spectators.filter(p => !p.user_id).length;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-lol-surface transition-colors text-sm"
        title={`${count} spectator${count !== 1 ? 's' : ''}`}
      >
        {/* Eye icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="tabular-nums font-medium">{count}</span>
      </button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Spectators" size="sm">
        <div className="space-y-3">
          <div className="text-sm text-gray-400">
            {count} spectator{count !== 1 ? 's' : ''} watching
          </div>

          {count === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              No spectators yet
            </div>
          ) : (
            <div className="space-y-2">
              {/* Logged-in spectators */}
              {loggedInSpectators.map(spectator => (
                <div
                  key={spectator.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-lol-border bg-lol-card"
                >
                  <div className="relative shrink-0">
                    {spectator.profile?.avatar_url ? (
                      <img
                        src={spectator.profile.avatar_url}
                        alt=""
                        className="w-9 h-9 rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-lol-surface flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    {spectator.is_connected && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-lol-card" title="Online" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {getParticipantDisplayName(spectator)}
                    </div>
                    {spectator.profile?.role && (
                      <div className="text-xs text-lol-gold truncate">
                        {formatRole(spectator.profile.role)}
                        {spectator.profile.role_team?.name && ` of ${spectator.profile.role_team.name}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Anonymous spectators summary */}
              {anonymousCount > 0 && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-lol-border/50 bg-lol-card/50">
                  <div className="w-9 h-9 rounded-full bg-lol-surface flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">
                    {anonymousCount} anonymous viewer{anonymousCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
