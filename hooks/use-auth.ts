"use client";

import { useState, useEffect, useCallback } from "react";
import { type User } from "@/lib/types";
import { apiGetMe, apiLogin, apiRegister, apiDeleteAccount, apiUpdateProfile, apiChangePassword } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetMe().then((u) => { setUser(u); setLoading(false); });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await apiRegister(email, password);
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("da_token");
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const ok = await apiDeleteAccount();
    if (ok) setUser(null);
    return ok;
  }, []);

  const updateName = useCallback(async (name: string) => {
    const updated = await apiUpdateProfile(name);
    setUser((prev) => prev ? { ...prev, name: updated.name } : prev);
    return updated;
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await apiChangePassword(oldPassword, newPassword);
  }, []);

  return { user, loading, login, register, logout, deleteAccount, updateName, changePassword, isAuth: !!user };
}
