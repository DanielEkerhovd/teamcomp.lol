import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore, useTierLimits } from "../stores/useAuthStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useMyTeamStore } from "../stores/useMyTeamStore";
import { Region, REGIONS } from "../types";
import type { ProfileRole } from "../types/database";
import LoginModal from "../components/auth/LoginModal";
import ConfirmationModal from "../components/ui/ConfirmationModal";
import DefaultAvatar from "../components/ui/DefaultAvatar";
import ChampionAvatarModal from "../components/profile/ChampionAvatarModal";
import { createCheckoutSession, createPortalSession, STRIPE_PRICES, isStripeConfigured } from "../lib/stripeService";
import { supabase } from "../lib/supabase";
import type { DbSubscription } from "../types/database";

// Role options for the role selector
const ROLE_OPTIONS: {
  value: ProfileRole;
  label: string;
  requiresTier?: string;
}[] = [
  { value: "team_owner", label: "Team Owner" },
  { value: "head_coach", label: "Head Coach" },
  { value: "coach", label: "Coach" },
  { value: "analyst", label: "Analyst" },
  { value: "player", label: "Player" },
  { value: "manager", label: "Manager" },
  { value: "scout", label: "Scout" },
  { value: "content_creator", label: "Content Creator" },
  { value: "caster", label: "Caster" },
  { value: "journalist", label: "Journalist" },
  { value: "streamer", label: "Streamer" },
  { value: "groupie", label: "Groupie" },
  { value: "developer", label: "Developer", requiresTier: "developer" },
];

// Combined avatar + username row component
function AvatarUsernameRow({
  avatarUrl,
  displayName,
  isUploading,
  error,
  onAvatarClick,
  onRemoveAvatar,
  onSaveUsername,
  fileInputRef,
  onFileChange,
  avatarCooldownUntil,
}: {
  avatarUrl?: string | null;
  displayName: string;
  isUploading: boolean;
  error: string | null;
  onAvatarClick: () => void;
  onRemoveAvatar?: () => void;
  onSaveUsername: (value: string) => Promise<{ error: string | null }>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  avatarCooldownUntil?: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setLocalError("Username cannot be empty");
      return;
    }
    if (trimmed.length < 3) {
      setLocalError("Username must be at least 3 characters");
      return;
    }
    if (trimmed.length > 30) {
      setLocalError("Username must be 30 characters or less");
      return;
    }
    setIsSaving(true);
    setLocalError(null);
    setShowSuccess(false);
    const result = await onSaveUsername(trimmed);
    if (result.error) {
      setLocalError(result.error);
    } else {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsEditing(false);
      }, 1500);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditValue(displayName);
    setLocalError(null);
    setShowSuccess(false);
    setIsEditing(false);
  };

  const avatarSize = "size-20";

  const isAvatarCooldown = avatarCooldownUntil && new Date(avatarCooldownUntil) > new Date();
  const cooldownDateStr = avatarCooldownUntil
    ? new Date(avatarCooldownUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const displayError = localError || error;

  return (
    <div className="group">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-lol-surface/50 transition-colors -mx-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
        {/* Avatar */}
        <div className="relative shrink-0">
          <button
            onClick={isAvatarCooldown ? undefined : onAvatarClick}
            disabled={isUploading || !!isAvatarCooldown}
            className={`relative group/avatar ${isAvatarCooldown ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {avatarUrl ? (
              <div className={`${avatarSize} rounded-xl overflow-hidden`}>
                <img
                  src={avatarUrl}
                  alt={displayName || "User"}
                  className="w-full h-full object-cover scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <DefaultAvatar size={avatarSize} className="rounded-xl" />
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
              {isUploading ? (
                <svg
                  className="w-5 h-5 text-white animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
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
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        {/* User */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500 uppercase tracking-wide mb-0.5">
            User
          </div>
          {isEditing ? (
            <div className="space-y-2">
              {/* Input with inline buttons */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={editValue}
                    maxLength={30}
                    onChange={(e) => {
                      setEditValue(e.target.value);
                      setLocalError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isSaving && !showSuccess)
                        handleSave();
                      if (e.key === "Escape" && !isSaving) handleCancel();
                    }}
                    disabled={isSaving || showSuccess}
                    className={`w-full pl-3 pr-3 py-1.5 bg-lol-dark/80 border-2 rounded-lg text-white text-base focus:outline-none transition-all ${
                      displayError
                        ? "border-red-500/70 bg-red-500/5"
                        : showSuccess
                          ? "border-green-500/70 bg-green-500/5"
                          : "border-lol-gold/50 focus:border-lol-gold"
                    } disabled:opacity-70`}
                    placeholder="Enter your name"
                    autoFocus
                  />
                </div>

                {/* Inline action buttons */}
                {showSuccess ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="p-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark rounded-lg transition-colors disabled:opacity-70"
                      title="Save"
                    >
                      {isSaving ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="p-2 bg-lol-surface hover:bg-lol-border text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Error message */}
              {displayError && (
                <div className="flex items-center gap-2 px-1 text-red-400 text-sm">
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{displayError}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="text-white font-medium truncate text-xl">
                {displayName || (
                  <span className="text-gray-500 italic">Not set</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                This is how others will see you
              </div>
            </>
          )}
        </div>
        {/* Edit button */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm font-medium bg-lol-surface hover:bg-lol-border rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit username
          </button>
        )}
      </div>
      {/* Avatar upload error (shown outside of username editing) */}
      {!isEditing && error && (
        <div className="flex items-center gap-2 mx-0 mt-1 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {/* Avatar moderation cooldown warning */}
      {isAvatarCooldown && (
        <div className="flex items-center gap-2 mx-0 mt-1 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>
            Your avatar was removed by a moderator. You can set a new avatar after{' '}
            <span className="font-medium text-red-300">{cooldownDateStr}</span>.
          </span>
        </div>
      )}
    </div>
  );
}

// Select row component for dropdown settings
function SelectRow({
  label,
  value,
  options,
  onChange,
  description,
  icon,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  description?: string;
  icon: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-lol-surface/50 transition-colors -mx-4">
      <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full pl-3 pr-10 py-2 bg-lol-dark border rounded-lg text-white text-left cursor-pointer transition-all duration-200 ${
              isOpen
                ? "border-lol-gold/50 ring-2 ring-lol-gold/20"
                : "border-lol-border hover:border-gray-500"
            }`}
          >
            {selectedOption?.label || value}
          </button>
          <svg
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>

          {isOpen && (
            <div className="absolute z-50 mt-2 w-full bg-lol-card border border-lol-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="max-h-64 overflow-y-auto py-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left transition-colors ${
                      opt.value === value
                        ? "bg-lol-gold/10 text-lol-gold"
                        : "text-gray-300 hover:bg-lol-surface hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt.label}</span>
                      {opt.value === value && (
                        <svg
                          className="w-4 h-4 text-lol-gold"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {description && (
          <div className="text-xs text-gray-500 mt-1">{description}</div>
        )}
      </div>
    </div>
  );
}

// Toggle row component for boolean settings
function ToggleRow({
  label,
  value,
  onChange,
  description,
  icon,
  isLoading,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-lol-surface/50 transition-colors -mx-4">
      <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </div>
        <div className="text-white font-medium">
          {value ? "Enabled" : "Disabled"}
        </div>
        {description && (
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={isLoading}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lol-gold/50 focus:ring-offset-2 focus:ring-offset-lol-dark disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? "bg-lol-gold" : "bg-lol-surface"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// Info row component for read-only display
function InfoRow({
  label,
  value,
  icon,
  badge,
  infoTooltip,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  badge?: { text: string; color: string };
  infoTooltip?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl -mx-4">
      <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">{value}</span>
          {badge && (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </div>
      {infoTooltip && (
        <div className="relative group/info shrink-0">
          <svg
            className="w-5 h-5 text-gray-500 hover:text-gray-400 cursor-help transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="absolute right-0 bottom-full mb-2 px-3 py-2 bg-lol-card border border-lol-border rounded-lg shadow-xl text-sm text-gray-300 whitespace-nowrap opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 z-50">
            {infoTooltip}
            <div className="absolute right-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-lol-border" />
          </div>
        </div>
      )}
    </div>
  );
}

// Role selector row component
function RoleRow({
  currentRole,
  currentTeamId,
  teams,
  userTier,
  onSave,
}: {
  currentRole: ProfileRole | null;
  currentTeamId: string | null;
  teams: { id: string; name: string }[];
  userTier: string;
  onSave: (
    role: ProfileRole | null,
    teamId: string | null,
  ) => Promise<{ error: string | null }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ProfileRole | null>(
    currentRole,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    currentTeamId,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Filter role options based on user tier
  const availableRoles = ROLE_OPTIONS.filter(
    (opt) => !opt.requiresTier || opt.requiresTier === userTier,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRoleDropdownOpen(false);
      }
      if (
        teamDropdownRef.current &&
        !teamDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTeamDropdownOpen(false);
      }
    };

    if (isRoleDropdownOpen || isTeamDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRoleDropdownOpen, isTeamDropdownOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setShowSuccess(false);

    const result = await onSave(selectedRole, selectedTeamId);

    if (result.error) {
      setError(result.error);
    } else {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsEditing(false);
      }, 1500);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setSelectedRole(currentRole);
    setSelectedTeamId(currentTeamId);
    setError(null);
    setShowSuccess(false);
    setIsEditing(false);
  };

  const getRoleLabel = (role: ProfileRole | null) => {
    if (!role) return null;
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name || null;
  };

  const getDisplayValue = () => {
    if (!currentRole) return "Not set";

    const roleLabel = getRoleLabel(currentRole);
    const teamName = getTeamName(currentTeamId);

    if (teamName) {
      return `${roleLabel} for ${teamName}`;
    }
    return roleLabel || "Not set";
  };

  const selectedRoleOption = ROLE_OPTIONS.find((r) => r.value === selectedRole);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="group">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-lol-surface/50 transition-colors -mx-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
            Role
          </div>

          {isEditing ? (
            <div className="space-y-3">
              {/* Role dropdown */}
              <div className="relative" ref={roleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className={`w-full pl-3 pr-10 py-2 bg-lol-dark border rounded-lg text-white text-left cursor-pointer transition-all duration-200 ${
                    isRoleDropdownOpen
                      ? "border-lol-gold/50 ring-2 ring-lol-gold/20"
                      : "border-lol-border hover:border-gray-500"
                  }`}
                >
                  {selectedRoleOption?.label || "Select a role..."}
                </button>
                <svg
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    isRoleDropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>

                {isRoleDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-lol-card border border-lol-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="max-h-64 overflow-y-auto py-1">
                      {availableRoles.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedRole(opt.value);
                            setIsRoleDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left transition-colors ${
                            opt.value === selectedRole
                              ? "bg-lol-gold/10 text-lol-gold"
                              : "text-gray-300 hover:bg-lol-surface hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{opt.label}</span>
                            {opt.value === selectedRole && (
                              <svg
                                className="w-4 h-4 text-lol-gold"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Team dropdown - show when role is selected */}
              {selectedRole && teams.length > 0 && (
                <div className="relative" ref={teamDropdownRef}>
                  <div className="text-xs text-gray-500 mb-1">
                    Associated Team (optional)
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
                    className={`w-full pl-3 pr-10 py-2 bg-lol-dark border rounded-lg text-white text-left cursor-pointer transition-all duration-200 ${
                      isTeamDropdownOpen
                        ? "border-lol-gold/50 ring-2 ring-lol-gold/20"
                        : "border-lol-border hover:border-gray-500"
                    }`}
                  >
                    {selectedTeam?.name || "No team selected"}
                  </button>
                  <svg
                    className={`pointer-events-none absolute right-3 bottom-2.5 w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      isTeamDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>

                  {isTeamDropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-lol-card border border-lol-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="max-h-64 overflow-y-auto py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeamId(null);
                            setIsTeamDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left transition-colors ${
                            !selectedTeamId
                              ? "bg-lol-gold/10 text-lol-gold"
                              : "text-gray-300 hover:bg-lol-surface hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="italic">No team</span>
                            {!selectedTeamId && (
                              <svg
                                className="w-4 h-4 text-lol-gold"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                        {teams.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => {
                              setSelectedTeamId(team.id);
                              setIsTeamDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left transition-colors ${
                              team.id === selectedTeamId
                                ? "bg-lol-gold/10 text-lol-gold"
                                : "text-gray-300 hover:bg-lol-surface hover:text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{team.name}</span>
                              {team.id === selectedTeamId && (
                                <svg
                                  className="w-4 h-4 text-lol-gold"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {showSuccess ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-lol-gold hover:bg-lol-gold-light text-lol-dark font-medium rounded-lg transition-colors disabled:opacity-70 text-sm"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-lol-surface hover:bg-lol-border text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 px-1 text-red-400 text-sm">
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="text-white font-medium">{getDisplayValue()}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Your role in the esports scene
              </div>
            </>
          )}
        </div>

        {/* Edit button */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm font-medium bg-lol-surface hover:bg-lol-border rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit role
          </button>
        )}
      </div>
    </div>
  );
}

// Editable email row for email/password users
function EmailRow({
  currentEmail,
  onSave,
}: {
  currentEmail: string;
  onSave: (newEmail: string) => Promise<{ error: string | null }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setError("Please enter an email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await onSave(trimmed);
    if (result.error) {
      setError(result.error);
    } else {
      setShowSuccess(true);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditValue("");
    setError(null);
    setShowSuccess(false);
    setIsEditing(false);
  };

  const emailIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="group">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-lol-surface/50 transition-colors -mx-4">
        <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0">
          {emailIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
            Email
          </div>

          {isEditing ? (
            showSuccess ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-400 text-sm font-medium">Confirmation emails sent</span>
                </div>
                <div className="text-xs text-gray-400 px-1">
                  Please confirm the change on both your current email ({currentEmail}) and your new email ({editValue.trim()}). The change will take effect after both are confirmed.
                </div>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-lol-surface hover:bg-lol-border rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSaving) handleSave();
                        if (e.key === "Escape" && !isSaving) handleCancel();
                      }}
                      disabled={isSaving}
                      className={`w-full pl-3 pr-3 py-1.5 bg-lol-dark/80 border-2 rounded-lg text-white text-base focus:outline-none transition-all ${
                        error
                          ? "border-red-500/70 bg-red-500/5"
                          : "border-lol-gold/50 focus:border-lol-gold"
                      } disabled:opacity-70`}
                      placeholder="Enter new email address"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="p-2 bg-lol-gold hover:bg-lol-gold-light text-lol-dark rounded-lg transition-colors disabled:opacity-70"
                      title="Save"
                    >
                      {isSaving ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="p-2 bg-lol-surface hover:bg-lol-border text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 px-1">
                  You will need to confirm the change on both your current and new email address.
                </div>
                {error && (
                  <div className="flex items-center gap-2 px-1 text-red-400 text-sm">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )
          ) : (
            <>
              <div className="text-white font-medium truncate">
                {currentEmail}
              </div>
            </>
          )}
        </div>

        {/* Change email button */}
        {!isEditing && (
          <button
            onClick={() => {
              setEditValue("");
              setError(null);
              setShowSuccess(false);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm font-medium bg-lol-surface hover:bg-lol-border rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Change email
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isLoading,
    signOut,
    updateDisplayName,
    updateAvatar,
    removeAvatar,
    setChampionAvatar,
    updateRole,
    updateEmail,
    updatePrivacy,
    deleteAccount,
  } = useAuthStore();
  const { isFreeTier } = useTierLimits();
  const { defaultRegion, setDefaultRegion } = useSettingsStore();
  const { teams } = useMyTeamStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Stripe checkout state
  const [checkingOutPlan, setCheckingOutPlan] = useState<"pro" | "supporter" | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [donationSuccess, setDonationSuccess] = useState<string | null>(null);
  const [isDonating, setIsDonating] = useState(false);
  const [donationAmount, setDonationAmount] = useState("");
  const [activeSubscription, setActiveSubscription] = useState<DbSubscription | null>(null);
  const { refreshProfile } = useAuthStore();

  const location = useLocation();
  const isAuthenticated = !!user;

  // Handle checkout return URLs
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutParam = params.get("checkout");
    const donationParam = params.get("donation");

    if (checkoutParam === "success") {
      setPlanSuccess("Your subscription is being activated. It may take a moment to reflect.");
      refreshProfile();
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    } else if (checkoutParam === "cancelled") {
      setPlanError("Checkout was cancelled.");
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    } else if (donationParam === "success") {
      setDonationSuccess("Thank you for your donation!");
      const url = new URL(window.location.href);
      url.searchParams.delete("donation");
      window.history.replaceState({}, "", url.toString());
    }
  }, [location.search, refreshProfile]);

  // Fetch active subscription for display
  useEffect(() => {
    if (!isStripeConfigured || !supabase || !user) return;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActiveSubscription(data);
      });
  }, [user, profile?.tier]);

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
      }
    }
  }, [location.hash]);

  const handleCheckout = async (plan: "pro" | "supporter") => {
    setCheckingOutPlan(plan);
    setPlanError(null);
    setPlanSuccess(null);
    const result = await createCheckoutSession({
      mode: "subscription",
      priceId: STRIPE_PRICES[plan],
    });
    if (result.error) {
      setPlanError(result.error);
      setCheckingOutPlan(null);
    }
  };

  const handleDonate = async () => {
    if (!donationAmount || Number(donationAmount) < 1) {
      setDonationError("Minimum donation is €1.00");
      return;
    }
    setIsDonating(true);
    setDonationError(null);
    setDonationSuccess(null);
    const result = await createCheckoutSession({
      mode: "donation",
      amount: Math.round(Number(donationAmount) * 100),
    });
    if (result.error) {
      setDonationError(result.error);
      setIsDonating(false);
    }
  };

  const handleManageSubscription = async () => {
    setPlanError(null);
    const result = await createPortalSession();
    if (result.error) {
      setPlanError(result.error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteAccount();
    if (result.error) {
      setDeleteError(
        `${result.error}. If this issue persists, please contact support@teamcomp.lol`,
      );
      setIsDeleting(false);
    } else {
      setShowDeleteConfirm(false);
      navigate("/");
    }
  };

  const handleAvatarClick = () => {
    setAvatarError(null);
    setShowAvatarModal(true);
  };

  const handleUploadAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleChampionSelect = async (url: string) => {
    setShowAvatarModal(false);
    setIsUploadingAvatar(true);
    setAvatarError(null);
    try {
      const result = await setChampionAvatar(url);
      if (result.error) {
        setAvatarError(result.error);
      }
    } catch {
      setAvatarError("Something went wrong setting your avatar. Please try again.");
    }
    setIsUploadingAvatar(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      const result = await updateAvatar(file);
      if (result.error) {
        setAvatarError(result.error);
      }
    } catch {
      setAvatarError("Something went wrong uploading your avatar. Please try again.");
    }

    setIsUploadingAvatar(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    setAvatarError(null);

    const result = await removeAvatar();

    if (result.error) {
      setAvatarError(result.error);
    }

    setIsUploadingAvatar(false);
  };

  // Guest view
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="bg-lol-card border border-lol-border rounded-2xl p-8 text-center mb-6">
          <div className="mx-auto mb-4">
            <DefaultAvatar size="w-24 h-24" className="rounded-2xl" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Guest User</h2>
          <p className="text-gray-400 mb-6">
            Sign in to access your profile and sync your data across devices.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-lol-gold to-lol-gold-light text-lol-dark font-semibold rounded-xl hover:shadow-lg hover:shadow-lol-gold/25 transition-all duration-200"
          >
            Sign In
          </button>
        </div>

        {/* App Settings - available for guests too */}
        <div className="bg-lol-card border border-lol-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-white">Preferences</h3>
          </div>

          <SelectRow
            label="Default Region"
            value={defaultRegion}
            options={REGIONS.map((r) => ({
              value: r.value,
              label: `${r.value.toUpperCase()} - ${r.label}`,
            }))}
            onChange={(v) => setDefaultRegion(v as Region)}
            description="Used when creating new players and teams"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </div>
    );
  }

  // Authenticated view
  const tierBadge =
    profile?.tier === "paid"
      ? "Pro"
      : profile?.tier === "beta"
        ? "Beta"
        : profile?.tier === "supporter"
          ? "Supporter"
          : profile?.tier === "admin"
            ? "Admin"
            : profile?.tier === "developer"
              ? "Developer"
              : "Free";
  const tierBadgeColor =
    profile?.tier === "paid"
      ? "bg-lol-gold/20 text-lol-gold"
      : profile?.tier === "beta"
        ? "bg-blue-500/20 text-blue-400"
        : profile?.tier === "supporter"
          ? "bg-purple-500/20 text-purple-400"
          : profile?.tier === "admin"
            ? "bg-red-500/20 text-red-400"
            : profile?.tier === "developer"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-gray-500/20 text-gray-400";
  const planCardBorder =
    profile?.tier === "paid"
      ? "border-lol-gold/20"
      : profile?.tier === "beta"
        ? "border-blue-500/20"
        : profile?.tier === "supporter"
          ? "border-purple-500/20"
          : profile?.tier === "admin"
            ? "border-red-500/20"
            : profile?.tier === "developer"
              ? "border-emerald-500/20"
              : "border-lol-border";
  const planCardBg =
    profile?.tier === "paid"
      ? "bg-lol-gold/5"
      : profile?.tier === "beta"
        ? "bg-blue-500/5"
        : profile?.tier === "supporter"
          ? "bg-purple-500/5"
          : profile?.tier === "admin"
            ? "bg-red-500/5"
            : profile?.tier === "developer"
              ? "bg-emerald-500/5"
              : "bg-lol-surface/50";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      {/* Profile Settings */}
      <div className="bg-lol-card border border-lol-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Profile</h3>
        </div>

        <div className="divide-y divide-lol-border/50">
          {/* Avatar + Username Row */}
          <AvatarUsernameRow
            avatarUrl={profile?.avatarUrl}
            displayName={profile?.displayName || ""}
            isUploading={isUploadingAvatar}
            error={avatarError}
            onAvatarClick={handleAvatarClick}
            onRemoveAvatar={profile?.avatarUrl ? handleRemoveAvatar : undefined}
            onSaveUsername={updateDisplayName}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            avatarCooldownUntil={profile?.avatarModeratedUntil}
          />

          {/* Role Row */}
          <RoleRow
            currentRole={profile?.role || null}
            currentTeamId={profile?.roleTeamId || null}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            userTier={profile?.tier || "free"}
            onSave={updateRole}
          />

          {/* Email: editable for email/password users, read-only for OAuth */}
          {user.identities?.some((i) => i.provider === "email") ? (
            <EmailRow
              currentEmail={user.email || ""}
              onSave={updateEmail}
            />
          ) : (
            <InfoRow
              label="Email"
              value={user.email || "No email"}
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              }
              infoTooltip="Contact support@teamcomp.lol or Discord to change your email"
            />
          )}
        </div>
      </div>

      {/* App Settings */}
      <div className="bg-lol-card border border-lol-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Preferences</h3>
        </div>

        <SelectRow
          label="Default Region"
          value={defaultRegion}
          options={REGIONS.map((r) => ({
            value: r.value,
            label: `${r.value.toUpperCase()} - ${r.label}`,
          }))}
          onChange={(v) => setDefaultRegion(v as Region)}
          description="Used when creating new players and teams"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Privacy Settings */}
      <div className="bg-lol-card border border-lol-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Privacy</h3>
        </div>

        <ToggleRow
          label="Private Account"
          value={profile?.isPrivate ?? false}
          onChange={async (value) => {
            await updatePrivacy(value);
          }}
          description="When enabled, other users cannot send you friend requests. You can still send requests to others."
          icon={
            <svg
              className={`w-5 h-5 ${profile?.isPrivate ? "text-yellow-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          }
        />
      </div>

      {/* Plan */}
      <div
        id="plan"
        className="bg-lol-card border border-lol-border rounded-2xl p-6 mb-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Plan</h3>
        </div>

        {/* Plan checkout feedback */}
        {planSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {planSuccess}
          </div>
        )}
        {planError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {planError}
          </div>
        )}

        {/* Current Plan Display */}
        <div className={`p-5 rounded-xl ${planCardBg} border ${planCardBorder} mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm uppercase tracking-wide">
              Current Plan
            </span>
            <span
              className={`px-4 py-1.5 text-base font-bold rounded-full ${tierBadgeColor}`}
            >
              {tierBadge}
            </span>
          </div>
          <ul className="space-y-2 text-sm text-gray-300">
            {profile?.tier === "free" && (
              <>
                <li className="flex items-center gap-2 font-medium">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Manage 1 team</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Add up to 10 enemy teams</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Create up to 20 planned drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Regular user features</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Be a part of the teamcomp.lol community</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Cloud sync</span>
                </li>
              </>
            )}
            {(profile?.tier === "paid" ||
              profile?.tier === "beta" ||
              profile?.tier === "supporter" ||
              profile?.tier === "admin") && (
              <>
                {profile?.tier === "beta" && (
                  <li className="flex items-center gap-2 font-medium">
                    <svg
                      className="w-4 h-4 text-blue-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    <span>Beta tester discord role</span>
                  </li>
                )}
                <li className="flex items-center gap-2 font-medium">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{profile?.tier === "admin" ? "Unlimited teams" : `Manage up to ${profile?.maxTeams ?? 3} teams`}</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{profile?.tier === "admin" ? "Unlimited enemy teams" : `Add up to ${profile?.maxEnemyTeams ?? 30} enemy teams`}</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{profile?.tier === "admin" ? "Unlimited drafts" : `Create up to ${profile?.maxDrafts ?? 300} planned drafts`}</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>More profile customization</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Cloud sync</span>
                </li>
              </>
            )}
            {(profile?.tier === "supporter" || profile?.tier === "admin") && (
              <>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-purple-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span>Supporting development</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Early access to new features</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Supporter badge</span>
                </li>
              </>
            )}
            {profile?.tier === "developer" && (
              <>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-emerald-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  <span>You built this thing</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-emerald-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Unlimited everything (obviously)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-emerald-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Access to features before they exist</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-emerald-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Free tier (you're paying in tears)</span>
                </li>
              </>
            )}
          </ul>

          {/* Manage Subscription (for active subscribers) */}
          {activeSubscription && (profile?.tier === "paid" || profile?.tier === "supporter") && (
            <div className="mt-4 pt-4 border-t border-lol-border/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {activeSubscription.cancel_at_period_end
                    ? `Cancels on ${new Date(activeSubscription.current_period_end!).toLocaleDateString()}`
                    : `Renews on ${new Date(activeSubscription.current_period_end!).toLocaleDateString()}`
                  }
                </div>
                <button
                  onClick={handleManageSubscription}
                  className="text-sm text-lol-gold hover:text-lol-gold-light transition-colors font-medium"
                >
                  Manage Subscription
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        {(profile?.tier === "free" || profile?.tier === "beta" || profile?.tier === "paid") && (
          <div className={`relative ${!isStripeConfigured ? "rounded-xl border border-red-500/40 p-4 pt-8" : ""}`}>
            {!isStripeConfigured && (
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-lol-card text-red-400 text-xs font-semibold border border-red-500/40">
                Not available in beta
              </div>
            )}
            <div className="text-gray-400 text-sm uppercase tracking-wide mb-4">
              Upgrade Options
            </div>
            <div className={`grid grid-cols-2 gap-4 ${!isStripeConfigured ? "opacity-60 pointer-events-none" : ""}`}>
              {/* Pro Tier - hidden for beta users who already have similar limits */}
              {profile?.tier === "free" && (
                <div className="p-5 rounded-xl border border-lol-border bg-lol-surface/30 hover:border-lol-gold/30 transition-colors flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lol-gold font-semibold text-sm px-2.5 py-0.5 rounded-full bg-lol-gold/20">
                      Pro
                    </h4>
                    <span className="text-lol-gold font-medium">€3/month</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300 flex-1">
                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white">
                        Everything in Free, plus:
                      </span>
                    </li>

                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white font-medium">
                        Up to 300 drafts
                      </span>
                    </li>

                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white">Manage up to 3 teams</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white">
                        Add up to 30 enemy teams
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-white">
                        More profile customization
                      </span>
                    </li>
                  </ul>
                  <button
                    onClick={() => handleCheckout("pro")}
                    disabled={checkingOutPlan !== null}
                    className="w-full py-2 mt-10 bg-lol-gold text-lol-dark font-medium rounded-lg hover:bg-lol-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {checkingOutPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
                  </button>
                </div>
              )}

              {/* Supporter Tier */}
              <div
                className={`p-5 rounded-xl border relative overflow-hidden border-purple-500/30 bg-lol-surface/30 hover:border-purple-500/50 transition-colors flex flex-col ${profile?.tier === "free" ? "" : "col-span-2"}`}
              >
                <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-bl-lg">
                  Support us
                </div>
                <div className="flex items-center justify-between mb-3 mt-2">
                  <h4 className="text-purple-400 font-semibold text-sm px-2.5 py-0.5 rounded-full bg-purple-500/20">
                    Supporter
                  </h4>
                  <span className="text-purple-400 font-medium">€10/month</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-300 flex-1">
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-green-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      {profile?.tier === "free"
                        ? "Everything in Pro"
                        : "Everything in your current plan, plus:"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-purple-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <span className="text-white font-medium">
                      Support development
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-green-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Early access to new features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-green-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>A really cool badge on Discord!</span>
                  </li>
                </ul>
                <button
                  onClick={() => handleCheckout("supporter")}
                  disabled={checkingOutPlan !== null}
                  className="w-full py-2 mt-10 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {checkingOutPlan === "supporter" ? "Redirecting..." : "Become a Supporter"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enterprise Contact */}
        {profile?.tier !== "developer" && (
          <div className="mt-6 pt-6 border-t border-lol-border/50">
            <p className="text-gray-400 text-sm text-center">
              Need a bigger plan for your team or organisation? Talk to us at{" "}
              <a
                href="mailto:contact@teamcomp.lol"
                className="text-lol-gold hover:text-lol-gold-light transition-colors"
              >
                contact@teamcomp.lol
              </a>
            </p>
          </div>
        )}

      </div>

      {/* Support / Donate */}
      <div className="bg-lol-card border border-lol-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-amber-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M2 21V19H20V21H2ZM20 8V5H18V8H20ZM20 3C20.5523 3 21 3.44772 21 4V9C21 9.55228 20.5523 10 20 10H18V11C18 13.7614 15.7614 16 13 16H9C6.23858 16 4 13.7614 4 11V4C4 3.44772 4.44772 3 5 3H20ZM16 5H6V11C6 12.6569 7.34315 14 9 14H13C14.6569 14 16 12.6569 16 11V5Z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">Support the development!</h3>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          If you like teamcomp.lol, consider making a one-time donation to support its development!
        </p>

        {donationSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {donationSuccess}
          </div>
        )}
        {donationError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {donationError}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {[3, 5, 10, 25].map((amt) => (
            <button
              key={amt}
              onClick={() => setDonationAmount(String(amt))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                Number(donationAmount) === amt
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-lol-surface text-gray-400 border border-lol-border hover:border-amber-500/30 hover:text-amber-400"
              }`}
            >
              €{amt}
            </button>
          ))}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Custom"
              value={donationAmount}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d*$/.test(v)) setDonationAmount(v);
              }}
              className="w-24 pl-7 pr-3 py-2 rounded-lg text-sm bg-lol-surface border border-lol-border text-white focus:border-amber-500/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        <button
          onClick={handleDonate}
          disabled={isDonating || !donationAmount || Number(donationAmount) < 1}
          className="w-full py-2.5 bg-amber-500/20 text-amber-300 font-medium rounded-lg border border-amber-500/40 hover:bg-amber-500/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isDonating ? "Redirecting..." : donationAmount ? `Donate €${donationAmount}` : "Donate"}
        </button>
      </div>

      {/* Account Actions */}
      <div className="bg-lol-card border border-lol-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Account</h3>
        </div>

        <button
          onClick={handleSignOut}
          disabled={isLoading || isDeleting}
          className="flex items-center gap-3 w-full p-4 rounded-xl text-left hover:bg-lol-surface transition-colors group -mx-4"
        >
          <div className="w-10 h-10 rounded-xl bg-lol-surface flex items-center justify-center text-gray-400 shrink-0 group-hover:bg-lol-border transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-medium group-hover:text-gray-300 transition-colors">
              {isLoading ? "Signing out..." : "Sign Out"}
            </div>
            <div className="text-xs text-gray-500">
              Sign out of your account
            </div>
          </div>
        </button>

        <div className="border-t border-lol-border/50 my-2 -mx-4" />

        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isLoading || isDeleting}
          className="flex items-center gap-3 w-full p-4 rounded-xl text-left hover:bg-red-500/10 transition-colors group -mx-4"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0 group-hover:bg-red-500/20 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <div className="text-red-400 font-medium group-hover:text-red-300 transition-colors">
              {isDeleting ? "Deleting..." : "Delete Account"}
            </div>
            <div className="text-xs text-gray-500">
              Permanently delete your account and all data
            </div>
          </div>
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone. All your teams, drafts, and data will be permanently deleted."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        error={deleteError}
      />

      {/* Champion Avatar Picker */}
      <ChampionAvatarModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onSelect={handleChampionSelect}
        onUploadClick={!isFreeTier ? handleUploadAvatar : undefined}
        isLoading={isUploadingAvatar}
      />
    </div>
  );
}
