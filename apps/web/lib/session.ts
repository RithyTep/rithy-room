const SESSION_KEY = 'rithy-room-session';

export interface SessionData {
  name: string;
}

export function saveSession(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, name);
  }
}

export function getSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}
