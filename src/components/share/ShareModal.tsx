import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { shareService, DraftShare } from '../../lib/shareService';
import { useMyTeamStore } from '../../stores/useMyTeamStore';
import { useDraftStore } from '../../stores/useDraftStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftSessionId: string;
  draftName: string;
}

export default function ShareModal({ isOpen, onClose, draftSessionId, draftName }: ShareModalProps) {
  const [shares, setShares] = useState<DraftShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Get store functions to trigger sync
  const { teams: myTeams, selectedTeamId, updateTeam } = useMyTeamStore();
  const { sessions, updateSession } = useDraftStore();
  const myTeam = myTeams.find((t) => t.id === selectedTeamId) || myTeams[0];
  const currentSession = sessions.find((s) => s.id === draftSessionId);

  // Force sync team data when modal opens
  useEffect(() => {
    if (isOpen && myTeam && currentSession) {
      setSyncing(true);
      // Trigger team sync by updating with same data (forces the sync middleware)
      updateTeam({ notes: myTeam.notes ?? '' });
      // Ensure draft session has myTeamId set and trigger sync
      if (!currentSession.myTeamId || currentSession.myTeamId !== myTeam.id) {
        updateSession(draftSessionId, { myTeamId: myTeam.id });
      } else {
        // Force sync by updating with same notes
        updateSession(draftSessionId, { notes: currentSession.notes ?? '' });
      }
      // Wait for debounced sync to complete
      setTimeout(() => setSyncing(false), 1500);
    }
  }, [isOpen]);

  // Load existing shares when modal opens
  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, draftSessionId]);

  const loadShares = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await shareService.getSharesForDraft(draftSessionId);
      setShares(result);
    } catch (err) {
      setError('Failed to load share links');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setCreating(true);
    setError(null);
    try {
      const newShare = await shareService.createShare(draftSessionId);
      if (newShare) {
        setShares([newShare, ...shares]);
        // Auto-copy the new share link
        handleCopy(newShare.token);
      }
    } catch (err) {
      setError('Failed to create share link');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string) => {
    const success = await shareService.copyShareUrl(token);
    if (success) {
      setCopiedId(token);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await shareService.revokeShare(shareId);
      setShares(shares.map(s => s.id === shareId ? { ...s, isActive: false } : s));
    } catch (err) {
      setError('Failed to revoke share link');
      console.error(err);
    }
  };

  const handleReactivate = async (shareId: string) => {
    try {
      await shareService.reactivateShare(shareId);
      setShares(shares.map(s => s.id === shareId ? { ...s, isActive: true } : s));
    } catch (err) {
      setError('Failed to reactivate share link');
      console.error(err);
    }
  };

  const handleDelete = async (shareId: string) => {
    try {
      await shareService.deleteShare(shareId);
      setShares(shares.filter(s => s.id !== shareId));
    } catch (err) {
      setError('Failed to delete share link');
      console.error(err);
    }
  };

  const activeShares = shares.filter(s => s.isActive);
  const inactiveShares = shares.filter(s => !s.isActive);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Draft" size="md">
      <div className="space-y-4">
        {/* Header info */}
        <p className="text-gray-400 text-sm">
          Share <span className="text-white font-medium">{draftName}</span> with your teammates.
          Anyone with the link can view this draft without signing in.
        </p>

        {/* Syncing indicator */}
        {syncing && (
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Syncing team data to cloud...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Create new share button */}
        <button
          onClick={handleCreateShare}
          disabled={creating || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-lol-gold/10 hover:bg-lol-gold/20 border border-lol-gold/30 text-lol-gold rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {creating ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Create Share Link
            </>
          )}
        </button>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Active shares */}
        {!loading && activeShares.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Active Links</h3>
            {activeShares.map(share => (
              <ShareLinkItem
                key={share.id}
                share={share}
                copiedId={copiedId}
                onCopy={handleCopy}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}

        {/* Inactive shares */}
        {!loading && inactiveShares.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">Revoked Links</h3>
            {inactiveShares.map(share => (
              <RevokedShareItem
                key={share.id}
                share={share}
                onReactivate={handleReactivate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && shares.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <p>No share links yet</p>
            <p className="text-sm mt-1">Create one to share this draft with your team</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ShareLinkItemProps {
  share: DraftShare;
  copiedId: string | null;
  onCopy: (token: string) => void;
  onRevoke: (id: string) => void;
}

function ShareLinkItem({ share, copiedId, onCopy, onRevoke }: ShareLinkItemProps) {
  const shareUrl = shareService.getShareUrl(share.token);
  const isCopied = copiedId === share.token;

  return (
    <div className="flex items-center gap-2 p-3 bg-lol-surface rounded-lg border border-lol-border">
      <div className="flex-1 min-w-0">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-lol-gold hover:text-lol-gold-light truncate transition-colors"
        >
          {shareUrl}
        </a>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{share.viewCount} views</span>
          <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <button
        onClick={() => onCopy(share.token)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isCopied
            ? 'bg-green-500/20 text-green-400'
            : 'bg-lol-gold/10 hover:bg-lol-gold/20 text-lol-gold'
        }`}
      >
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
      <button
        onClick={() => onRevoke(share.id)}
        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        title="Revoke link"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>
    </div>
  );
}

interface RevokedShareItemProps {
  share: DraftShare;
  onReactivate: (id: string) => void;
  onDelete: (id: string) => void;
}

function RevokedShareItem({ share, onReactivate, onDelete }: RevokedShareItemProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-lol-surface/50 rounded-lg border border-lol-border/50 opacity-60">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-500 truncate">
          ...{share.token.slice(-12)}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {share.viewCount} views total
        </div>
      </div>
      <button
        onClick={() => onReactivate(share.id)}
        className="px-2 py-1 text-xs bg-lol-surface hover:bg-lol-border text-gray-400 rounded transition-colors"
      >
        Reactivate
      </button>
      <button
        onClick={() => onDelete(share.id)}
        className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        title="Delete permanently"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
