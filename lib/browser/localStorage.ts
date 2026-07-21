/** Returns window.localStorage when available; null in SSR / privacy modes. */
export function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
