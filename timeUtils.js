// Shared time formatting utilities
// t: { hour: number, minute: number } | undefined
export function formatHHMM(t) {
  if (!t || typeof t.hour === 'undefined' || typeof t.minute === 'undefined') return '--:--';
  const h = String(t.hour).padStart(2, '0');
  const m = String(t.minute).padStart(2, '0');
  return `${h}:${m}`;
}

// 오늘 날짜를 KST(Asia/Seoul) 기준 MM/DD 포맷으로 반환 -> 예: "10/01"
export function formatTodayMMDDKST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const mm = parts.find(p => p.type === 'month')?.value ?? '01';
  const dd = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${mm}/${dd}`;
}