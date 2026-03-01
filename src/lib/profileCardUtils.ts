import type { CSSProperties } from 'react';

export interface ProfileCardColors {
  bg: string | null;
  gradient: string | null;
  gradientAngle: number | null;
}

/**
 * Returns inline style object for rendering a profile card background.
 * - If gradient + bg + angle are set: renders a CSS linear-gradient
 * - If only bg is set: renders a solid background color
 * - Otherwise: returns empty object (use default card styling)
 */
export function getProfileCardStyle(colors: ProfileCardColors): CSSProperties {
  const { bg, gradient, gradientAngle } = colors;
  if (gradient && bg && gradientAngle !== null) {
    return { background: `linear-gradient(${gradientAngle}deg, ${bg}, ${gradient})` };
  }
  if (bg) {
    return { backgroundColor: bg };
  }
  return {};
}

/**
 * Returns true if the user has any custom card colors set.
 */
export function hasCustomCardColors(colors: ProfileCardColors): boolean {
  return !!colors.bg;
}

/**
 * Preset color palette for profile card backgrounds.
 * All colors are dark/saturated enough for white text contrast
 * and blend with the LoL dark theme.
 */
export const PRESET_CARD_COLORS = [
  // Blues
  { hex: '#1E3A5F', name: 'Deep Ocean' },
  { hex: '#1E40AF', name: 'Royal Blue' },
  { hex: '#0E7490', name: 'Cyan Tide' },
  { hex: '#164E63', name: 'Frozen Seas' },
  // Purples
  { hex: '#581C87', name: 'Void Purple' },
  { hex: '#6B21A8', name: 'Arcane' },
  { hex: '#4C1D95', name: 'Dark Star' },
  // Reds / Warm
  { hex: '#7F1D1D', name: 'Blood Moon' },
  { hex: '#9F1239', name: 'Crimson Edge' },
  { hex: '#92400E', name: 'Forge Ember' },
  { hex: '#78350F', name: 'Ancient Gold' },
  // Greens
  { hex: '#14532D', name: 'Shadow Isles' },
  { hex: '#065F46', name: 'Emerald Depths' },
  { hex: '#134E4A', name: 'Serpent Crest' },
  // Neutrals
  { hex: '#1E293B', name: 'Hextech Steel' },
  { hex: '#292524', name: 'Obsidian' },
] as const;

/**
 * Preset gradient angles with labels.
 */
export const GRADIENT_ANGLES = [
  { angle: 0, label: 'Up' },
  { angle: 45, label: 'Up-Right' },
  { angle: 90, label: 'Right' },
  { angle: 135, label: 'Down-Right' },
  { angle: 180, label: 'Down' },
  { angle: 225, label: 'Down-Left' },
  { angle: 270, label: 'Left' },
  { angle: 315, label: 'Up-Left' },
] as const;
