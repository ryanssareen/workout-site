import { ImageResponse } from 'next/og';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const alt = 'Workout on The Daily Athlete';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '⚡',
};

const TYPE_COLOR: Record<string, string> = {
  run: '#ef4444', bike: '#f97316', swim: '#3b82f6', walk: '#22c55e', strength: '#a855f7', other: '#6b7280',
};

export default async function OGImage({ params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;

  let name = 'Workout';
  let type = 'other';
  let distance: string | null = null;
  let duration: number | null = null;
  let completed = false;
  let dateStr = '';

  try {
    const db = getAdminDb();
    const doc = await db.collection('users').doc(username).collection('workouts').doc(id).get();
    if (doc.exists) {
      const d = doc.data()!;
      name = d.name || 'Workout';
      type = d.type || 'other';
      completed = d.completed || false;
      duration = d.duration || (d.actualStats?.duration ? Math.round(d.actualStats.duration / 60) : null);
      const dist = d.actualStats?.distance || d.stravaData?.distance;
      if (dist) distance = (dist / 1000).toFixed(1);
      const date = d.date?.toDate?.();
      if (date) dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    // Use defaults
  }

  const emoji = TYPE_EMOJI[type] || '⚡';
  const color = TYPE_COLOR[type] || '#6b7280';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #1a0a0a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top — branding + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              🏋️
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px', fontWeight: 600 }}>
              The Daily Athlete
            </span>
          </div>
          {dateStr && (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px' }}>{dateStr}</span>
          )}
        </div>

        {/* Center — workout info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '56px' }}>{emoji}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '48px',
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                {name.length > 30 ? name.slice(0, 30) + '…' : name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color,
                    textTransform: 'capitalize',
                  }}
                >
                  {type}
                </span>
                {completed && (
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#22c55e',
                      background: 'rgba(34,197,94,0.15)',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Completed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          {(distance || duration) && (
            <div style={{ display: 'flex', gap: '40px', marginTop: '8px' }}>
              {distance && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Distance
                  </span>
                  <span style={{ color: '#fff', fontSize: '36px', fontWeight: 800 }}>
                    {distance} <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>km</span>
                  </span>
                </div>
              )}
              {duration && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Duration
                  </span>
                  <span style={{ color: '#fff', fontSize: '36px', fontWeight: 800 }}>
                    {duration} <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>min</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom — username */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '20px',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px' }}>@{username}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>thedailyathlete.in</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
