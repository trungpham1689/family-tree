import { useMutation, useQuery } from '@tanstack/react-query';
import { authErrorMessage } from '../auth/auth-error-message';
import { supabase } from '../lib/supabase';
import { effects, queryKeys, useAccountId, useMutationWithEffects } from './query-keys';
import { failOn } from './trees';

export type AdminAccount = {
  accountId: string;
  email: string;
  approved: boolean;
  isSuperadmin: boolean;
  /** Siêu quản trị gốc: không thu hồi, không gỡ quyền được. */
  isRoot: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  treeCount: number;
  isBanned: boolean;
};

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

export const useAdminAccounts = () =>
  useQuery({
    queryKey: queryKeys.adminAccounts,
    queryFn: async (): Promise<AdminAccount[]> => {
      const { data, error } = await supabase.rpc('admin_list_accounts');
      failOn(error);
      return data.map((row) => ({
        accountId: row.account_id,
        email: row.email ?? '(không có email)',
        approved: row.approved,
        isSuperadmin: row.is_superadmin,
        isRoot: row.is_root,
        createdAt: row.created_at,
        lastSignInAt: row.last_sign_in_at,
        treeCount: row.tree_count,
        isBanned: row.is_banned,
      }));
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
