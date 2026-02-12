export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    // Get all Strava workouts
    const workoutsSnapshot = await adminDb
      .collection('workouts')
      .where('source', '==', 'strava')
      .get();

    const withRoute: string[] = [];
    const withoutRoute: string[] = [];
    const noGPS: string[] = [];

    workoutsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = data.name || 'Unnamed';
      
      if (data.routeData?.polyline) {
        withRoute.push(name);
      } else if (data.routeData?.noGPS) {
        noGPS.push(name);
      } else {
        withoutRoute.push(name);
      }
    });

    return NextResponse.json({
      total: workoutsSnapshot.size,
      withRouteData: withRoute.length,
      withoutRouteData: withoutRoute.length,
      noGPSData: noGPS.length,
      workoutsWithMaps: withRoute.slice(0, 20),
      workoutsMissing: withoutRoute.slice(0, 20),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
