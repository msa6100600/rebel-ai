import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type RebelAccountSession = {
  token: string;
  account: { id: number; username: string; displayName: string; role: "user" | "owner" };
};

type RebelSessionContextValue = {
  session: RebelAccountSession | null;
  loading: boolean;
  startSession: (session: RebelAccountSession) => Promise<void>;
  endSession: () => Promise<void>;
};

const SESSION_KEY = "rebel-ai-account-session-v1";
const RebelSessionContext = createContext<RebelSessionContextValue | null>(null);

async function readSession() {
  const raw = Platform.OS === "web" ? window.localStorage.getItem(SESSION_KEY) : await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RebelAccountSession;
  } catch {
    return null;
  }
}

async function writeSession(session: RebelAccountSession | null) {
  if (Platform.OS === "web") {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getRebelSessionToken() {
  const session = await readSession();
  return session?.token ?? null;
}

export function RebelSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RebelAccountSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readSession().then(setSession).catch(() => setSession(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo<RebelSessionContextValue>(() => ({
    session,
    loading,
    startSession: async (next) => { await writeSession(next); setSession(next); },
    endSession: async () => { await writeSession(null); setSession(null); },
  }), [loading, session]);

  return <RebelSessionContext.Provider value={value}>{children}</RebelSessionContext.Provider>;
}

export function useRebelSession() {
  const context = useContext(RebelSessionContext);
  if (!context) throw new Error("useRebelSession must be used inside RebelSessionProvider");
  return context;
}
