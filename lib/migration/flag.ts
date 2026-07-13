const MIGRATION_FLAG_KEY = "stash:anon-migrated-at";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns true if this device already completed (or declined) anon import. */
export function hasCompletedAnonMigration(): boolean {
  const storage = getLocalStorage();
  if (!storage || typeof storage.getItem !== "function") return true;
  try {
    return Boolean(storage.getItem(MIGRATION_FLAG_KEY));
  } catch {
    return true;
  }
}

/** Marks migration as handled so the prompt does not show again on this device. */
export function markAnonMigrationHandled(): void {
  const storage = getLocalStorage();
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(MIGRATION_FLAG_KEY, new Date().toISOString());
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

export function clearAnonMigrationFlag(): void {
  const storage = getLocalStorage();
  if (!storage || typeof storage.removeItem !== "function") return;
  try {
    storage.removeItem(MIGRATION_FLAG_KEY);
  } catch {
    // Ignore.
  }
}

export { MIGRATION_FLAG_KEY };
