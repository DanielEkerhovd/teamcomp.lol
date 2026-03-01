import { supabase } from './supabase';

export interface ModerationResult {
  flagged: boolean;
  categories?: string[];
}

export interface ModerationResultWithViolation extends ModerationResult {
  violationCount?: number;
  violationThreshold?: number;
  autoBanned?: boolean;
}

export type ModerationContext =
  | 'team_name'
  | 'enemy_team_name'
  | 'display_name'
  | 'chat_message'
  | 'live_draft_chat'
  | 'live_draft_session';

/**
 * Check text content for inappropriate material via the moderation edge function.
 * Accepts a single string or array of strings for batch checking.
 * Fails open (returns { flagged: false }) if the service is unavailable.
 */
export async function checkModeration(text: string | string[]): Promise<ModerationResult> {
  if (!supabase) {
    return { flagged: false };
  }

  const inputs = Array.isArray(text) ? text : [text];
  const nonEmpty = inputs.filter(t => t.trim().length > 0);

  if (nonEmpty.length === 0) {
    return { flagged: false };
  }

  try {
    const { data, error } = await supabase.functions.invoke('moderate-text', {
      body: { input: nonEmpty.length === 1 ? nonEmpty[0] : nonEmpty },
    });

    if (error) {
      console.error('Moderation check failed:', error, 'Response data:', data);
      return { flagged: false };
    }

    return {
      flagged: data?.flagged ?? false,
      categories: data?.categories,
    };
  } catch (err) {
    console.error('Moderation check error:', err);
    return { flagged: false };
  }
}

/**
 * Check moderation AND record a violation if flagged.
 * Use this for all authenticated user inputs that need profanity tracking.
 * Returns violation count and warning info so the UI can show progressive messages.
 */
export async function checkModerationAndRecord(
  text: string | string[],
  context: ModerationContext
): Promise<ModerationResultWithViolation> {
  const result = await checkModeration(text);

  if (!result.flagged || !supabase) {
    return result;
  }

  try {
    const inputText = Array.isArray(text) ? text.join('; ') : text;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc('record_moderation_violation', {
      p_context: context,
      p_content: inputText.substring(0, 500),
      p_categories: result.categories || [],
    });

    if (data) {
      return {
        ...result,
        violationCount: data.violation_count,
        violationThreshold: data.threshold,
        autoBanned: data.banned,
      };
    }
  } catch (err) {
    console.error('Failed to record moderation violation:', err);
  }

  return result;
}

/**
 * Generate a progressive warning message based on violation count.
 * Shows escalating warnings as the user approaches the ban threshold.
 */
export function getViolationWarning(result: ModerationResultWithViolation): string {
  const { violationCount, violationThreshold } = result;

  if (!violationCount || !violationThreshold) {
    return MODERATION_ERROR_MESSAGE;
  }

  if (violationCount > violationThreshold) {
    return 'Your account has been temporarily suspended due to repeated violations.';
  }

  const remaining = violationThreshold - violationCount;

  if (remaining <= 1) {
    return `Final warning! One more violation will suspend your account for 24 hours.`;
  }

  if (remaining <= 2) {
    return `Warning: ${remaining} more violations within the hour will result in a 24-hour account suspension.`;
  }

  if (violationCount >= 2) {
    return 'Repeated inappropriate content may result in a temporary account suspension.';
  }

  return MODERATION_ERROR_MESSAGE;
}

/** Standard user-facing error message when content is flagged */
export const MODERATION_ERROR_MESSAGE =
  'This text contains inappropriate content. Please revise it.';
