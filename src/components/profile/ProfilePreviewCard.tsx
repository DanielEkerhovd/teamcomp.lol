import { type CSSProperties } from 'react';
import type { UserTier, ProfileRole } from '../../types/database';
import DefaultAvatar from '../ui/DefaultAvatar';
import { getProfileCardStyle, hasCustomCardColors, type ProfileCardColors } from '../../lib/profileCardUtils';

const ROLE_LABELS: Record<ProfileRole, string> = {
  team_owner: 'Team Owner',
  head_coach: 'Head Coach',
  coach: 'Coach',
  analyst: 'Analyst',
  player: 'Player',
  manager: 'Manager',
  scout: 'Scout',
  content_creator: 'Content Creator',
  caster: 'Caster',
  journalist: 'Journalist',
  streamer: 'Streamer',
  groupie: 'Groupie',
  developer: 'Developer',
};

function getTierBadge(tier: UserTier): { label: string; className: string } {
  switch (tier) {
    case 'paid':
      return { label: 'Pro', className: 'bg-lol-gold/20 text-lol-gold' };
    case 'beta':
      return { label: 'Beta', className: 'bg-blue-500/20 text-blue-400' };
    case 'supporter':
      return { label: 'Supporter', className: 'bg-purple-500/20 text-purple-400' };
    case 'admin':
      return { label: 'Admin', className: 'bg-red-500/20 text-red-400' };
    case 'developer':
      return { label: 'Developer', className: 'bg-emerald-500/20 text-emerald-400' };
    default:
      return { label: 'Free', className: 'bg-gray-500/20 text-gray-400' };
  }
}

interface ProfilePreviewCardProps {
  avatarUrl: string | null;
  displayName: string;
  tier: UserTier;
  role: ProfileRole | null;
  roleTeamName: string | null;
  cardColors: ProfileCardColors;
  isUploading: boolean;
  onAvatarClick: () => void;
  onRemoveAvatar?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  avatarCooldownUntil?: string | null;
  avatarError?: string | null;
  acceptGif?: boolean;
}

export default function ProfilePreviewCard({
  avatarUrl,
  displayName,
  tier,
  role,
  roleTeamName,
  cardColors,
  isUploading,
  onAvatarClick,
  onRemoveAvatar,
  fileInputRef,
  onFileChange,
  avatarCooldownUntil,
  avatarError,
  acceptGif,
}: ProfilePreviewCardProps) {
  const hasCustom = hasCustomCardColors(cardColors);
  const customStyle: CSSProperties = hasCustom ? getProfileCardStyle(cardColors) : {};
  const badge = getTierBadge(tier);

  const isAvatarCooldown = avatarCooldownUntil && new Date(avatarCooldownUntil) > new Date();
  const cooldownDateStr = avatarCooldownUntil
    ? new Date(avatarCooldownUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const roleDisplay = role ? ROLE_LABELS[role] || null : null;
  const roleText = roleDisplay && roleTeamName
    ? `${roleDisplay} for ${roleTeamName}`
    : roleDisplay;

  return (
    <div className="mb-4">
      <div
        className={`relative rounded-xl border p-5 transition-all duration-300 ${
          hasCustom
            ? 'border-white/10'
            : 'bg-lol-surface/50 border-lol-border/50'
        }`}
        style={customStyle}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptGif ? "image/*" : "image/png,image/jpeg,image/webp"}
          onChange={onFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0 group">
            <button
              onClick={isAvatarCooldown ? undefined : onAvatarClick}
              disabled={isUploading || !!isAvatarCooldown}
              className={`relative group/avatar ${isAvatarCooldown ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {avatarUrl ? (
                <div className="size-20 rounded-xl overflow-hidden ring-2 ring-white/10">
                  <img
                    src={avatarUrl}
                    alt={displayName || "User"}
                    className="w-full h-full object-cover scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <DefaultAvatar size="size-20" className="rounded-xl ring-2 ring-white/10" />
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                {isUploading ? (
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            </button>
            {/* Remove avatar button */}
            {onRemoveAvatar && !isUploading && (
              <button
                onClick={onRemoveAvatar}
                className="absolute -bottom-1 -right-1 p-1 bg-lol-card border border-lol-border rounded-md text-gray-400 hover:text-red-400 hover:border-red-400/50 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove avatar"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] mb-0.5 tracking-wide ${hasCustom ? 'text-white/40' : 'text-gray-500'}`}>This is how others see you</p>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white truncate">
                {displayName || 'Unnamed User'}
              </h2>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            {roleText && (
              <p className={`text-sm truncate ${hasCustom ? 'text-white/70' : 'text-gray-400'}`}>{roleText}</p>
            )}
          </div>
        </div>

        {/* Avatar error or cooldown message */}
        {(avatarError || isAvatarCooldown) && (
          <div className="mt-3">
            {avatarError && (
              <p className="text-xs text-red-400">{avatarError}</p>
            )}
            {isAvatarCooldown && cooldownDateStr && !avatarError && (
              <p className="text-xs text-amber-400">
                Avatar changes restricted until {cooldownDateStr}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
