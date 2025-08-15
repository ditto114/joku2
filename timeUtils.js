// Shared time formatting utilities
// t: { hour: number, minute: number } | undefined
export function formatHHMM(t) {
  if (!t || typeof t.hour === 'undefined' || typeof t.minute === 'undefined') return '--:--';
  const h = String(t.hour).padStart(2, '0');
  const m = String(t.minute).padStart(2, '0');
  return `${h}:${m}`;
}
