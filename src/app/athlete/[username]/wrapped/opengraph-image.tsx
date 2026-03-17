import { ImageResponse } from 'next/og';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const alt = '2025 Wrapped — The Daily Athlete';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let displayName = username;
  let totalWorkouts = 0;
  let totalDistanceKm = 0;
  let totalHours = 0;
  let typeCounts: Record<string, number> = {};

  try {
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(username).get();
    if (userDoc.exists) {
      const userData = userDoc.data()!;
      if (userData.profilePublic === false) {
        // Private profile — generic image
        return new ImageResponse(
          (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)',
                color: 'white',
                fontSize: 48,
                fontWeight: 700,
              }}
            >
              🏋️ 2025 Wrapped — The Daily Athlete
            </div>
          ),
          { ...size },
        );
      }
      displayName = userData.displayName || username;

      // Compute basic stats
      const workoutsSnap = await db.collection('users').doc(username).collection('workouts').get();
      const year = 2025;
      for (const doc of workoutsSnap.docs) {
        const d = doc.data();
        const date = d.date?.toDate?.();
        if (!date || date.getFullYear() !== year) continue;

        totalWorkouts++;
        const type = d.type || 'other';
        typeCounts[type] = (typeCounts[type] || 0) + 1;

        // Distance
        const distM = d.actualStats?.distance || d.stravaData?.distance || d.run?.distance || d.bike?.distance || d.swim?.distance || 0;
        if (distM > 0) {
          const unit = d.run?.distanceUnit || d.bike?.distanceUnit || d.swim?.distanceUnit || 'km';
          totalDistanceKm += unit === 'mi' ? distM * 1.60934 : distM;
        }

        // Duration
        const durSec = d.actualStats?.duration || d.stravaData?.time || 0;
        const durMin = d.duration || d.run?.time || d.bike?.time || d.swim?.time || d.strength?.totalTime || d.other?.duration || 0;
        if (durSec > 0) totalHours += durSec / 3600;
        else if (durMin > 0) totalHours += durMin / 60;
      }
    }
  } catch (e) {
    console.error('OG image error:', e);
  }

  totalDistanceKm = Math.round(totalDistanceKm);
  totalHours = Math.round(totalHours);
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const emoji: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋' };
  const topEmoji = emoji[topType] || '🏋️';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0508 40%, #0a0a0a 100%)',
          color: 'white',
          padding: '60px 70px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top row — branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              color: 'white',
            }}
          >
            CT
          </div>
          <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' as const }}>
            2025 Wrapped
          </span>
        </div>

        {/* Name + emoji */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px', marginTop: '16px' }}>
          <span style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.1 }}>
            {displayName}
          </span>
          <span style={{ fontSize: '48px' }}>{topEmoji}</span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '60px', marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '72px', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
              {totalWorkouts}
            </span>
            <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
              Workouts
            </span>
          </div>
          {totalDistanceKm > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '72px', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                {totalDistanceKm.toLocaleString()}
              </span>
              <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                Kilometers
              </span>
            </div>
          )}
          {totalHours > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '72px', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                {totalHours}
              </span>
              <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                Hours
              </span>
            </div>
          )}
        </div>

        {/* Bottom branding */}
        <div style={{ display: 'flex', marginTop: '40px' }}>
          <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
            thedailyathlete.in
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
