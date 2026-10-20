import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { effects, queryKeys, useAccountId, useMutationWithEffects } from './query-keys';
import { failOn } from './trees';

export type ProfileValues = { fullName: string; birthDate: string; phone: string };

const MIN_PHONE_DIGITS = 8;

export const today = () => new Date().toLocaleDateString('sv-SE');

/** Lỗi của hồ sơ, hoặc null nếu hợp lệ. Database kiểm lại; đây để báo lỗi ngay trên form. */
export const profileError = ({ fullName, birthDate, phone }: ProfileValues): string | null => {
  if (fullName.trim() === '') return 'Hãy nhập họ và tên.';
  if (birthDate === '' || birthDate < '1900-01-01' || birthDate > today()) return 'Ngày sinh không hợp lệ.';
  if (!/^[0-9+(). -]{8,20}$/.test(phone.trim()) || phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) return 'Số điện thoại không hợp lệ.';
  return null;
};

/** Hồ sơ của chính mình (null: tài khoản đăng ký trước khi có hồ sơ bắt buộc). */
export const useMyProfile = (enabled = true) => {
  const accountId = useAccountId();
  return useQuery({
    queryKey: queryKeys.profile(accountId),
    enabled,
    queryFn: async (): Promise<ProfileValues> => {
      const { data, error } = await supabase.from('account_approvals').select('full_name, birth_date, phone').maybeSingle();
      failOn(error);
      return { fullName: data?.full_name ?? '', birthDate: data?.birth_date ?? '', phone: data?.phone ?? '' };
    },
  });
};

export const useUpdateMyProfile = () => {
  const accountId = useAccountId();
  return useMutationWithEffects(async (values: ProfileValues) => {
    const { error } = await supabase.rpc('update_my_profile', { new_name: values.fullName, new_birth: values.birthDate, new_phone: values.phone });
    failOn(error);
  }, () => effects.profile(accountId));
};
