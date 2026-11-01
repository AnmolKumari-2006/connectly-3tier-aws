import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/client";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Returns the user, or { twoFactorRequired, challenge } when the account
  // has two factor authentication on (the Login page then asks for the code).
  const login = async ({ identifier, password }) => {
    const data = await authApi.login({ identifier, password });
    if (data.twoFactorRequired) return data;
    setUser(data.user);
    return data.user;
  };

  const verifyTwoFactor = async ({ challenge, code }) => {
    const data = await authApi.verifyTwoFactor({ challenge, code });
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await authApi.register(payload);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    showToast("You've been logged out.", "info");
  };

  const updateUser = (patch) => setUser((u) => (u ? { ...u, ...patch } : u));

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTwoFactor, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
