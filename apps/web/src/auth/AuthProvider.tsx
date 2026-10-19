import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearOfflineCache } from '../lib/offline-cache';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';

const toState = (session: Session | null): AuthState =>
  session ? { status: 'signed-in', session } : { status: 'signed-out' };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(toState(data.session));
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Đăng xuất: bỏ dữ liệu đã tải (cả trong bộ nhớ đệm offline) để người dùng sau không thấy.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        void clearOfflineCache();
      }
      setState(toState(session));
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
