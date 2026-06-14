import { useState, useCallback } from 'react';

const KEY = 'sushi_token';

export function getToken() {
  return localStorage.getItem(KEY);
}

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(KEY));

  const login = useCallback((t) => {
    localStorage.setItem(KEY, t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setToken(null);
  }, []);

  return { token, login, logout, isAuthenticated: !!token };
}
