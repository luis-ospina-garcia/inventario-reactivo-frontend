/** El backend guarda las fechas en UTC como LocalDateTime (sin zona): se interpretan como UTC. */
export function parseUtc(value: string): Date {
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1');
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`);
}

export function timeAgo(value: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - parseUtc(value).getTime()) / 1000));
  if (seconds < 10) return 'ahora mismo';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export function formatDateTime(value: string): string {
  return parseUtc(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
