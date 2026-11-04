import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, getToken, setToken, removeToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  demoUsers: User[];
  login: (phone: string, password?: string, otp?: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  switchDemoUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);

  // Demo foydalanuvchilar ro'yxatini yuklash (login/register sahifasida ko'rsatish uchun)
  const loadDemoUsers = async () => {
    try {
      const list = await api.auth.getDemoUsers();
      setDemoUsers(list);
      return list;
    } catch (e) {
      console.error('Demo users load failed:', e);
      return [];
    }
  };

  const refreshUser = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch (e) {
      console.error('Failed to get current user:', e);
      removeToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Demo foydalanuvchilar ro'yxatini yuklaymiz (faqat ko'rsatish uchun, avtomatik kirish YO'Q)
      await loadDemoUsers();

      const existingToken = getToken();
      if (existingToken) {
        // Faqat saqlangan token bo'lsa kiramiz
        await refreshUser();
      } else {
        // Token yo'q = Mehmon (Guest) holati, hech qanday avtomatik kirish yo'q
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (phone: string, password?: string, otp?: string) => {
    const res = await api.auth.login(phone, password, otp);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    await loadDemoUsers();
  };

  const register = async (data: any) => {
    const res = await api.auth.register(data);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    await loadDemoUsers();
  };

  const logout = () => {
    removeToken();
    setTokenState(null);
    setUser(null);
  };

  const switchDemoUser = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.auth.demoLogin(userId);
      setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
    } catch (err) {
      console.error('Failed to switch demo user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        demoUsers,
        login,
        register,
        logout,
        switchDemoUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
