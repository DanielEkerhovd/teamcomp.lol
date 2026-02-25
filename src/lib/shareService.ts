import { supabase } from './supabase';
import type { DbDraftShare, SharedDraftData } from '../types/database';

export interface DraftShare {
  id: string;
  draftSessionId: string;
  token: string;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function mapDraftShare(row: DbDraftShare): DraftShare {
  return {
    id: row.id,
    draftSessionId: row.draft_session_id,
    token: row.token,
    isActive: row.is_active,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export const shareService = {
  /**
   * Create a share link for a draft session
   */
  async createShare(draftSessionId: string, expiresAt?: Date): Promise<DraftShare | null> {
    if (!supabase) return null;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Must be authenticated to create share');

    // Only include expires_at if explicitly provided, otherwise use DB default (30 days)
    const insertData: Record<string, unknown> = {
      draft_session_id: draftSessionId,
      created_by: user.user.id,
    };
    if (expiresAt) {
      insertData.expires_at = expiresAt.toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('draft_shares')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data ? mapDraftShare(data as DbDraftShare) : null;
  },

  /**
   * Get all shares for a draft session
   */
  async getSharesForDraft(draftSessionId: string): Promise<DraftShare[]> {
    if (!supabase) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('draft_shares')
      .select('*')
      .eq('draft_session_id', draftSessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: DbDraftShare) => mapDraftShare(row));
  },

  /**
   * Revoke (deactivate) a share link
   */
  async revokeShare(shareId: string): Promise<void> {
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('draft_shares')
      .update({ is_active: false })
      .eq('id', shareId);

    if (error) throw error;
  },

  /**
   * Reactivate a share link
   */
  async reactivateShare(shareId: string): Promise<void> {
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('draft_shares')
      .update({ is_active: true })
      .eq('id', shareId);

    if (error) throw error;
  },

  /**
   * Delete a share link permanently
   */
  async deleteShare(shareId: string): Promise<void> {
    if (!supabase) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('draft_shares')
      .delete()
      .eq('id', shareId);

    if (error) throw error;
  },

  /**
   * Get shared draft data by token (public, no auth required)
   * This uses the RPC function that bypasses RLS
   */
  async getSharedDraft(token: string): Promise<SharedDraftData | null> {
    if (!supabase) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_shared_draft', {
      share_token: token,
    });

    if (error) throw error;
    return data as SharedDraftData | null;
  },

  /**
   * Generate the full share URL for a token
   */
  getShareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
  },

  /**
   * Copy share URL to clipboard
   */
  async copyShareUrl(token: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.getShareUrl(token));
      return true;
    } catch {
      return false;
    }
  },
};
