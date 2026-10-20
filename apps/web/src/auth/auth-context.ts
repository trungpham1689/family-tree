import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

export type AuthContextValue = {
  state: AuthState;
  signOut: () => Promise<void>;
  /** Đang đăng xuất: nút đăng xuất phải khoá để không gọi nhiều lần. */
  signingOut: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong <AuthProvider>.');
  return value;
};
