import { Workout } from '@/types';

// ── Type configuration (colors, emoji per workout type) ──────────────────
export const TYPE_CONFIG: Record<string, { emoji: string; color: string; border: string; bg: string }> = {
  run: { emoji: '🏃', color: 'text-red-500', border: 'border-l-red-500', bg: 'bg-red-500/8' },
  bike: { emoji: '🚴', color: 'text-amber-500', border: 'border-l-amber-500', bg: 'bg-amber-500/8' },
  swim: { emoji: '🏊', color: 'text-cyan-500', border: 'border-l-cyan-500', bg: 'bg-cyan-500/8' },
  strength: { emoji: '💪', color: 'text-purple-500', border: 'border-l-purple-500', bg: 'bg-purple-500/8' },
  other: { emoji: '📋', color: 'text-gray-400', border: 'border-l-gray-400', bg: 'bg-gray-500/8' },
};

// ── Stat extraction ──────────────────────────────────────────────────────
export function getTypeData(w: Workout): Record<string, string> {
  const d: Record<string, string> = {};

  if (w.type === 'run' && w.run) {
    d.primary = w.run.distance ? `${w.run.distance} ${w.run.distanceUnit || 'km'}` : '--';
    d.primaryLabel = 'DISTANCE';
    d.time = w.run.time ? formatDur(w.run.time) : (w.duration ? formatDur(w.duration) : '0:00');
    d.hr = w.run.avgHeartRate ? `${w.run.avgHeartRate}` : '--';
    d.hrLabel = 'AVG HR';
    d.stat4 = w.run.elevationGain ? `${w.run.elevationGain}m` : (w.run.pace ? `${w.run.pace}` : '--');
    d.stat4Label = w.run.elevationGain ? 'ELEV' : 'PACE';
  } else if (w.type === 'bike' && w.bike) {
    d.primary = w.bike.distance ? `${w.bike.distance} ${w.bike.distanceUnit || 'km'}` : '--';
    d.primaryLabel = 'DISTANCE';
    d.time = w.bike.time ? formatDur(w.bike.time) : (w.duration ? formatDur(w.duration) : '0:00');
    d.hr = w.bike.avgHeartRate ? `${w.bike.avgHeartRate}` : '--';
    d.hrLabel = 'AVG HR';
    d.stat4 = w.bike.elevationGain ? `${w.bike.elevationGain}m` : '--';
    d.stat4Label = 'ELEV';
  } else if (w.type === 'swim' && w.swim) {
    d.primary = w.swim.distance ? `${w.swim.distance} ${w.swim.distanceUnit || 'm'}` : '--';
    d.primaryLabel = 'DISTANCE';
    d.time = w.swim.time ? formatDur(w.swim.time) : (w.duration ? formatDur(w.duration) : '0:00');
    d.hr = '--';
    d.hrLabel = 'AVG HR';
    d.stat4 = '--';
    d.stat4Label = 'PACE';
  } else if (w.type === 'strength' && w.strength) {
    const exCount = w.strength.exercises?.length || 0;
    const totalSets = w.strength.exercises?.reduce((sum, ex) => sum + (ex.sets || 0), 0) || 0;
    d.primary = totalSets > 0 ? `${totalSets} Sets` : (exCount > 0 ? `${exCount} Ex` : '--');
    d.primaryLabel = totalSets > 0 ? 'TOTAL SETS' : 'EXERCISES';
    d.time = w.duration ? formatDur(w.duration) : '0:00';
    d.hr = '--';
    d.hrLabel = 'AVG HR';
    d.stat4 = '--';
    d.stat4Label = 'CALORIES';
  } else {
    d.primary = '--';
    d.primaryLabel = 'DISTANCE';
    d.time = w.duration ? formatDur(w.duration) : '0:00';
    d.hr = '--';
    d.hrLabel = 'AVG HR';
    d.stat4 = '--';
    d.stat4Label = '';
  }
  d.timeLabel = 'TIME';
  return d;
}

// ── Duration formatters ──────────────────────────────────────────────────
export function formatDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}min`;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function formatDurLong(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Readable type labels ─────────────────────────────────────────────────
export const TYPE_LABELS: Record<string, string> = {
  run: 'Running',
  bike: 'Cycling',
  swim: 'Swimming',
  strength: 'Strength Training',
  other: 'Other',
};
