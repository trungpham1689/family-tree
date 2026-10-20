import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { authErrorMessage } from '../auth/auth-error-message';
import { supabase } from '../lib/supabase';
import { effects, queryKeys, useAccountId, useMutationWithEffects } from './query-keys';
import { failOn } from './trees';

export type AdminInviter = { accountId: string; email: string; fullName: string | null };

export type AdminAccount = {
  accountId: string;
  email: string;
  /** Họ tên, ngày sinh (YYYY-MM-DD), số điện thoại: null với tài khoản đăng ký trước khi có hồ sơ bắt buộc. */
  fullName: string | null;
  birthDate: string | null;
  phone: string | null;
  approved: boolean;
  isSuperadmin: boolean;
  /** Siêu quản trị gốc: không thu hồi, không gỡ quyền được. */
  isRoot: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  treeCount: number;
  isBanned: boolean;
  /** Những người đã mời tài khoản này vào gia phả (rỗng: tự đăng ký). */
  invitedBy: AdminInviter[];
};

export type AdminStatusFilter = 'all' | 'pending' | 'approved';

export const ADMIN_PAGE_SIZE = 20;

/** Tài khoản đang đăng nhập có phải siêu quản trị không (chỉ để ẩn/hiện giao diện; database kiểm quyền thật ở mỗi hàm admin_*). */
export const useIsSuperadmin = (enabled = true) => {
  const accountId = useAccountId();
  return useQuery({
    queryKey: queryKeys.superadmin(accountId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('account_approvals').select('approved, is_superadmin').maybeSingle();
      failOn(error);
      return data?.approved === true && data.is_superadmin;
    },
  });
};

type RawInviter = { account_id: string; email: string | null; full_name: string | null };

const toInviters = (value: unknown): AdminInviter[] =>
  (Array.isArray(value) ? (value as RawInviter[]) : []).map((who) => ({
    accountId: who.account_id,
    email: who.email ?? '(không có email)',
    fullName: who.full_name,
  }));

/** Một trang tài khoản (lọc và tìm kiếm ở database) cùng tổng số khớp để chia trang. */
export const useAdminAccounts = (params: { status: AdminStatusFilter; search: string; page: number }) =>
  useQuery({
    queryKey: [...queryKeys.adminAccounts, 'list', params] as const,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ accounts: AdminAccount[]; total: number }> => {
      const { data, error } = await supabase.rpc('admin_list_accounts', {
        status_filter: params.status,
        search: params.search,
        page_size: ADMIN_PAGE_SIZE,
        page_offset: params.page * ADMIN_PAGE_SIZE,
      });
      failOn(error);
      return {
        total: data[0]?.total_count ?? 0,
        accounts: data.map((row) => ({
          accountId: row.account_id,
          email: row.email ?? '(không có email)',
          fullName: row.full_name,
          birthDate: row.birth_date,
          phone: row.phone,
          approved: row.approved,
          isSuperadmin: row.is_superadmin,
          isRoot: row.is_root,
          createdAt: row.created_at,
          lastSignInAt: row.last_sign_in_at,
          treeCount: row.tree_count,
          isBanned: row.is_banned,
          invitedBy: toInviters(row.invited_by),
        })),
      };
    },
  });

/** Số tài khoản cho các tab (không phụ thuộc trang đang xem) và tài khoản đang đăng nhập có phải siêu quản trị gốc không. */
export const useAdminCounts = () =>
  useQuery({
    queryKey: [...queryKeys.adminAccounts, 'counts'] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_account_counts');
      failOn(error);
      const row = data[0];
      return { total: row?.total_count ?? 0, pending: row?.pending_count ?? 0, iAmRoot: row?.i_am_root ?? false };
    },
  });

export const useSetApproval = () =>
  useMutationWithEffects(async ({ accountId, approved }: { accountId: string; approved: boolean }) => {
    const { error } = await supabase.rpc('admin_set_approval', { target_account: accountId, new_approved: approved });
    failOn(error);
  }, effects.admin);

export const useSetSuperadmin = () =>
  useMutationWithEffects(async ({ accountId, superadmin }: { accountId: string; superadmin: boolean }) => {
    const { error } = await supabase.rpc('admin_set_superadmin', { target_account: accountId, make_superadmin: superadmin });
    failOn(error);
  }, effects.admin);

export const useSetBanned = () =>
  useMutationWithEffects(async ({ accountId, banned }: { accountId: string; banned: boolean }) => {
    const { error } = await supabase.rpc('admin_set_banned', { target_account: accountId, new_banned: banned });
    failOn(error);
  }, effects.admin);

export const useDeleteAccount = () =>
  useMutationWithEffects(async ({ accountId }: { accountId: string }) => {
    const { error } = await supabase.rpc('admin_delete_account', { target_account: accountId });
    failOn(error);
  }, effects.admin);

/** Gửi email đặt lại mật khẩu cho tài khoản khác: dùng đúng email "Quên mật khẩu" của Supabase Auth, người đó tự đặt mật khẩu mới. */
export const useSendPasswordReset = () =>
  useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/dat-lai-mat-khau` });
      if (error) throw new Error(authErrorMessage(error));
    },
  });
