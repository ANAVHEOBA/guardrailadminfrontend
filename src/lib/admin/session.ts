import type { AdminAuthResponse } from "./types";

export const ADMIN_SESSION_STORAGE_KEY = "guardrail_admin_auth_session";
export const ADMIN_SESSION_CHANGE_EVENT = "guardrail:admin-auth-session-change";

export interface StoredAdminSession {
  token: string;
  user: {
    user_id: string;
    username?: string;
    wallet_address: string;
  };
}

function emitAdminSessionChange(session: StoredAdminSession | null) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<StoredAdminSession | null>(ADMIN_SESSION_CHANGE_EVENT, {
      detail: session,
    }),
  );
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStoredAdminSession(): StoredAdminSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as Partial<StoredAdminSession>;

    if (
      typeof parsedSession.token !== "string" ||
      typeof parsedSession.user !== "object" ||
      parsedSession.user === null
    ) {
      return null;
    }

    return {
      token: parsedSession.token,
      user: parsedSession.user as StoredAdminSession["user"],
    };
  } catch {
    return null;
  }
}

export function writeStoredAdminSession(
  session: AdminAuthResponse | StoredAdminSession,
): StoredAdminSession | null {
  const normalizedSession: StoredAdminSession = {
    token: session.token,
    user: session.user,
  };

  if (!canUseStorage()) {
    emitAdminSessionChange(normalizedSession);
    return null;
  }

  try {
    window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
    emitAdminSessionChange(normalizedSession);
    return normalizedSession;
  } catch {
    emitAdminSessionChange(normalizedSession);
    return null;
  }
}

export function clearStoredAdminSession() {
  if (!canUseStorage()) {
    emitAdminSessionChange(null);
    return;
  }

  try {
    window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures on unsupported browsers.
  }

  emitAdminSessionChange(null);
}

export function readAdminToken(): string | null {
  const session = readStoredAdminSession();
  return session?.token ?? null;
}

export function clearAdminToken() {
  clearStoredAdminSession();
}
