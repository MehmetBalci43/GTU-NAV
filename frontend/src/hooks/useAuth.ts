import { useState, useCallback } from 'react';
import { UserSession } from '../types/campus';
import { api } from '../services/apiClient';

const STORAGE_KEY = 'gtu_nav_auth_session_v1';
export const DEFAULT_DEMO_ADMIN_KEY = 'gtunav_admin_secret_2026';

const DEFAULT_STUDENT: UserSession = {
  email: 'ogrenci.demo@gtu.edu.tr',
  full_name: 'Ayşe Yılmaz (CSE 3. Sınıf)',
  role: 'student',
  token: 'demo-student-token',
};

const DEFAULT_ADMIN: UserSession = {
  email: 'admin.liveops@gtu.edu.tr',
  full_name: 'Dr. Emre Kaya (Yapı İşleri & Kampüs LiveOps)',
  role: 'admin',
  token: 'demo-admin-token',
  admin_key: DEFAULT_DEMO_ADMIN_KEY,
};

export function useAuth() {
  const [user, setUser] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserSession;
        if (parsed.role === 'admin' && !parsed.admin_key) {
          return DEFAULT_STUDENT;
        }
        return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_STUDENT;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistUser = useCallback((nextUser: UserSession) => {
    setUser(nextUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } catch {
      // ignore
    }
  }, []);

  const switchRoleQuick = useCallback(
    async (role: 'student' | 'admin', adminKey?: string): Promise<boolean> => {
      setError(null);
      if (role === 'student') {
        persistUser(DEFAULT_STUDENT);
        try {
          const res = await api.login(DEFAULT_STUDENT.email, 'student');
          persistUser(res);
        } catch {
          // fallback to local student session
        }
        return true;
      }

      const keyToUse = (adminKey || '').trim();
      setIsLoading(true);
      try {
        const res = await api.login(DEFAULT_ADMIN.email, 'admin', keyToUse);
        persistUser({
          ...res,
          admin_key: res.admin_key || keyToUse,
        });
        return true;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Geçersiz yönetici anahtarı (X-Admin-Key)';
        setError(msg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [persistUser]
  );

  const loginWithGtuEmail = useCallback(
    async (email: string, role?: 'student' | 'admin', adminKey?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.login(email, role, adminKey);
        persistUser(res);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Giriş yapılamadı';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [persistUser]
  );

  return {
    user,
    isAdmin: user.role === 'admin' && Boolean(user.admin_key),
    isLoading,
    error,
    clearAuthError: () => setError(null),
    switchRoleQuick,
    loginWithGtuEmail,
  };
}
