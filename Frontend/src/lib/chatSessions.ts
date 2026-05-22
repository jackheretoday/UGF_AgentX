import type { ChatSession } from '../types';

export type SessionGroup = {
  label: string;
  sessions: ChatSession[];
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function daysAgo(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

export function truncateSessionTitle(title: string, max = 35): string {
  const trimmed = title.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
}

export function groupSessionsByDate(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(daysAgo(now, 1));
  const weekAgo = daysAgo(now, 7);
  const monthAgo = daysAgo(now, 30);

  const buckets: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    'This month': [],
  };
  const olderByMonth = new Map<string, ChatSession[]>();

  for (const session of sessions) {
    const updated = new Date(session.updated_at || session.created_at);

    if (isSameDay(updated, today)) {
      buckets.Today.push(session);
    } else if (isSameDay(updated, yesterday)) {
      buckets.Yesterday.push(session);
    } else if (updated >= weekAgo) {
      buckets['This week'].push(session);
    } else if (updated >= monthAgo) {
      buckets['This month'].push(session);
    } else {
      const monthLabel = updated.toLocaleDateString(undefined, {
        month: 'long',
        year: updated.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
      const list = olderByMonth.get(monthLabel) ?? [];
      list.push(session);
      olderByMonth.set(monthLabel, list);
    }
  }

  const groups: SessionGroup[] = [];
  for (const label of ['Today', 'Yesterday', 'This week', 'This month']) {
    if (buckets[label].length > 0) {
      groups.push({ label, sessions: buckets[label] });
    }
  }

  for (const [label, list] of olderByMonth.entries()) {
    if (list.length > 0) {
      groups.push({ label, sessions: list });
    }
  }

  return groups;
}
