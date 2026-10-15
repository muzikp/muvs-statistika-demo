const PREFIX = 'muvs-statistika:preferences:';

export function loadPreferences<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) && typeof fallback === 'object'
      ? { ...(fallback as object), ...(value as object) } as T
      : value as T;
  } catch { return fallback; }
}

export function savePreferences<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value)); } catch { /* private mode or quota */ }
}
