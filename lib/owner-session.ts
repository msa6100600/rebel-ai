import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const OWNER_SESSION_KEY = "rebel-ai-owner-session";

async function setStorage(value: string) {
  if (Platform.OS === "web") {
    window.sessionStorage.setItem(OWNER_SESSION_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(OWNER_SESSION_KEY, value);
}

async function getStorage() {
  if (Platform.OS === "web") return window.sessionStorage.getItem(OWNER_SESSION_KEY);
  return SecureStore.getItemAsync(OWNER_SESSION_KEY);
}

async function clearStorage() {
  if (Platform.OS === "web") {
    window.sessionStorage.removeItem(OWNER_SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(OWNER_SESSION_KEY);
}

export async function startOwnerSession() {
  await setStorage("active");
}

export async function endOwnerSession() {
  await clearStorage();
}

export function useOwnerSession() {
  const [loading, setLoading] = useState(true);
  const [isOwnerSession, setIsOwnerSession] = useState(false);

  useEffect(() => {
    getStorage().then((value) => setIsOwnerSession(value === "active")).catch(() => setIsOwnerSession(false)).finally(() => setLoading(false));
  }, []);

  return { loading, isOwnerSession, setIsOwnerSession };
}
