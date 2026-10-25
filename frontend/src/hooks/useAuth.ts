import { useState, useCallback } from 'react';
import { UserSession } from '../types/campus';
import { api } from '../services/apiClient';

const STORAGE_KEY = 'gtu_nav_auth_session_v1';

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
};

export function useAuth() {
  const [user, setUser] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as UserSession;
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
    async (role: 'student' | 'admin') => {
      setError(null);
      const target = role === 'admin' ? DEFAULT_ADMIN : DEFAULT_STUDENT;
      persistUser(target);
      try {
        const res = await api.login(target.email, target.role);
        persistUser(res);
      } catch {
        // Fallback to local demo session if backend is still starting
      }
    },
    [persistUser]
  );

  const loginWithGtuEmail = useCallback(
    async (email: string, role?: 'student' | 'admin') => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.login(email, role);
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
    isAdmin: user.role === 'admin',
    isLoading,
    error,
    switchRoleQuick,
    loginWithGtuEmail,
  };
}
