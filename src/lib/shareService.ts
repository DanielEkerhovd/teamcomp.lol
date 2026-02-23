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

    // Use type assertion since draft_shares is a new table
    const { data, error } = await (supabase
      .from('draft_shares' as 'profiles') // Type hack for new table
      .insert({
        draft_session_id: draftSessionId,
        created_by: user.user.id,
        expires_at: expiresAt?.toISOString() || null,
      } as never)
      .select()
      .single() as unknown as Promise<{ data: DbDraftShare | null; error: Error | null }>);

    if (error) throw error;
    return data ? mapDraftShare(data) : null;
  },

  /**
   * Get all shares for a draft session
   */
  async getSharesForDraft(draftSessionId: string): Promise<DraftShare[]> {
    if (!supabase) return [];

    const { data, error } = await (supabase
      .from('draft_shares' as 'profiles')
      .select('*')
      .eq('draft_session_id' as 'id', draftSessionId)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: DbDraftShare[] | null; error: Error | null }>);

    if (error) throw error;
    return (data || []).map(mapDraftShare);
  },

  /**
   * Revoke (deactivate) a share link
   */
  async revokeShare(shareId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await (supabase
      .from('draft_shares' as 'profiles')
      .update({ is_active: false } as never)
      .eq('id', shareId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (error) throw error;
  },

  /**
   * Reactivate a share link
   */
  async reactivateShare(shareId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await (supabase
      .from('draft_shares' as 'profiles')
      .update({ is_active: true } as never)
      .eq('id', shareId) as unknown as Promise<{ data: unknown; error: Error | null }>);

    if (error) throw error;
  },

  /**
   * Delete a share link permanently
   */
  async deleteShare(shareId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await (supabase
      .from('draft_shares' as 'profiles')
      .delete()
      .eq('id', shareId) as unknown as Promise<{ data: unknown; error: Error | null }>);

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
