'use client';

import { cn } from '@/lib/utils';

// ── Constants ──
export const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '⚡',
};

export const TYPE_COLORS: Record<string, string> = {
  swim: '#3b82f6', run: '#22c55e', walk: '#10b981', bike: '#f97316', strength: '#a855f7', other: '#6b7280',
};

export const SPORT_LABELS: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', walk: 'Walking', strength: 'Strength',
};

export const FEATURED_SPORTS = new Set(['run', 'bike', 'swim', 'strength']);

// ── Helpers ──
export function formatDistance(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}

export function formatHours(h: number): string {
  if (h >= 100) return `${Math.round(h)}h`;
  return `${h.toFixed(1)}h`;
}

export function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString();
  return String(Math.round(n));
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── StatCard ──
export function StatCard({ value, label, icon }: {
  value: string; label: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center space-y-0.5">
      <div className="flex justify-center text-muted-foreground">{icon}</div>
      <p className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── PieChart ──
export function PieChart({ data, size }: {
  data: { type: string; percentage: number; color: string; count: number }[];
  size: number;
}) {
  const radius = size / 2;
  const innerRadius = radius * 0.55;
  const center = radius;

  let cumulativePercent = 0;
  const slices = data.map(d => {
    const startAngle = cumulativePercent * 3.6 * (Math.PI / 180);
    cumulativePercent += d.percentage;
    const endAngle = cumulativePercent * 3.6 * (Math.PI / 180);

    const x1 = center + radius * Math.sin(startAngle);
    const y1 = center - radius * Math.cos(startAngle);
    const x2 = center + radius * Math.sin(endAngle);
    const y2 = center - radius * Math.cos(endAngle);

    const ix1 = center + innerRadius * Math.sin(startAngle);
    const iy1 = center - innerRadius * Math.cos(startAngle);
    const ix2 = center + innerRadius * Math.sin(endAngle);
    const iy2 = center - innerRadius * Math.cos(endAngle);

    const largeArc = d.percentage > 50 ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');

    return { ...d, path };
  });

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity={0.85} />
      ))}
      <text x={center} y={center - 6} textAnchor="middle" className="fill-foreground text-xl font-bold" fontSize="22">
        {total}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        workouts
      </text>
    </svg>
  );
}
