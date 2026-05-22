export const TOKEN_STORAGE_KEY = 'ugf_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function clearAuthSession(): void {
  setStoredToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ugf:unauthorized'));
  }
}
