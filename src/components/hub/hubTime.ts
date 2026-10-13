/** Messages and lists show "14:05" today, "Mon" this week, then "12 Oct". */
export function formatHubTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
