"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/lib/api";
import { AUTH_CHANGE_EVENT, forgetSharedSignIn } from "@/lib/auth-sync";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  /**
   * Sign-up, step one: sends the form; the server emails a 6-digit code and
   * creates nothing yet. `retryAfter` is how many seconds until a new code
   * may be asked for.
   */
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
  }) => Promise<{ email: string; retryAfter: number }>;
  /** Sign-up, step two: the emailed code creates the account and signs in. */
  verifyRegistration: (email: string, code: string) => Promise<User>;
  /** Ask for a fresh sign-up code; resolves to the seconds until the next one. */
  resendRegistration: (email: string) => Promise<{ message: string; retryAfter: number }>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  /** Sign in from a token obtained elsewhere — the Google handoff. */
  signIn: (u: User, token: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /*
   * Restores the session from localStorage on mount.
   *
   * The set-state-in-effect rule is suppressed here rather than worked around,
   * because every alternative is worse for this particular case:
   *
   *  - A lazy useState initialiser cannot read localStorage during SSR, so the
   *    server would render signed-out and the client signed-in, and `ready`
   *    would differ between the two renders — a hydration mismatch on every
   *    page for every returning customer.
   *  - useSyncExternalStore fixes the mismatch for a value, but `ready` here is
   *    not a stored value: it means "the /auth/me round trip has finished",
   *    which only an effect can know.
   *
   * Both server and client start with ready=false and identical markup, and
   * consumers wait on `ready` before reading `user`, so the extra render this
   * costs happens once on mount and is invisible.
   */
  useEffect(() => {
    const stored = localStorage.getItem("lalwani_token");
    const storedUser = localStorage.getItem("lalwani_user");
    if (stored && storedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(stored);
      try {
        setUserState(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("lalwani_user");
      }
      // refresh profile in background
      clientApi<{ user: User }>("/auth/me", { token: stored })
        .then((res) => {
          setUserState(res.user);
          localStorage.setItem("lalwani_user", JSON.stringify(res.user));
        })
        .catch((err) => {
          // Only a rejected session signs out. A network blip or a server error
          // keeps the saved session, so nobody is logged out by a flaky line.
          if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) return;
          localStorage.removeItem("lalwani_token");
          localStorage.removeItem("lalwani_user");
          setToken(null);
          setUserState(null);
        })
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const persist = useCallback((u: User, t: string) => {
    localStorage.setItem("lalwani_token", t);
    localStorage.setItem("lalwani_user", JSON.stringify(u));
    setToken(t);
    setUserState(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await clientApi<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
        token: null,
      });
      persist(res.user, res.token);
      // merge guest cart into user cart
      clientApi("/cart/merge", { method: "POST", token: res.token }).catch(() => {});
      return res.user;
    },
    [persist]
  );

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      password_confirmation: string;
    }) => {
      const res = await clientApi<{ email: string; retry_after?: number }>("/auth/register", {
        method: "POST",
        body: data,
        token: null,
      });
      // Nothing to store yet: the account only exists once the code is entered.
      return { email: res.email, retryAfter: res.retry_after ?? 60 };
    },
    []
  );

  const verifyRegistration = useCallback(
    async (email: string, code: string) => {
      const res = await clientApi<{ user: User; token: string }>("/auth/register/verify", {
        method: "POST",
        body: { email, code },
        token: null,
      });
      persist(res.user, res.token);
      // merge guest cart into the new account's cart
      clientApi("/cart/merge", { method: "POST", token: res.token }).catch(() => {});
      return res.user;
    },
    [persist]
  );

  const resendRegistration = useCallback(async (email: string) => {
    const res = await clientApi<{ message: string; retry_after?: number }>("/auth/register/resend", {
      method: "POST",
      body: { email },
      token: null,
    });
    return { message: res.message, retryAfter: res.retry_after ?? 60 };
  }, []);

  /*
   * Signing out in the admin panel revokes a token the shop may share (see the
   * login page), so the shop session ends the moment its token disappears from
   * storage — on this tab or another one.
   */
  useEffect(() => {
    const sync = () => {
      if (!localStorage.getItem("lalwani_token")) {
        setToken(null);
        setUserState(null);
      }
    };
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const logout = useCallback(async () => {
    const signedOut = localStorage.getItem("lalwani_token");
    try {
      await clientApi("/auth/logout", { method: "POST" });
    } catch {
      /* token may already be invalid */
    }
    localStorage.removeItem("lalwani_token");
    localStorage.removeItem("lalwani_user");
    setToken(null);
    setUserState(null);
    // An admin who signed in here gave the panel this same token, just revoked.
    forgetSharedSignIn(signedOut, { token: "lalwani_admin_token", user: "lalwani_admin_user" });
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) localStorage.setItem("lalwani_user", JSON.stringify(u));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, ready, login, register, verifyRegistration, resendRegistration, logout, setUser, signIn: persist }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
