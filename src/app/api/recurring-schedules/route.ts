import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const coachId = decodedToken.uid;

    const schedules = await adminDb
      .collection('recurringSchedules')
      .where('coachId', '==', coachId)
      .orderBy('nextSendDate', 'asc')
      .get();

    const data = schedules.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching recurring schedules:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const coachId = decodedToken.uid;

    const body = await request.json();

    // Validate coach owns the student
    const studentDoc = await adminDb.collection('users').doc(body.studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.coachId !== coachId) {
      return NextResponse.json(
        { error: 'Invalid student' },
        { status: 403 }
      );
    }

    const now = new Date();
    const nextSendDate = new Date(now.getTime() + body.intervalDays * 24 * 60 * 60 * 1000);

    const scheduleData: any = {
      coachId,
      studentId: body.studentId,
      intervalDays: body.intervalDays,
      workoutTemplate: body.workoutTemplate,
      endCondition: {
        type: body.endCondition.type,
        ...(body.endCondition.type === 'date' && {
          endDate: new Date(body.endCondition.endDate)
        }),
        ...(body.endCondition.type === 'count' && {
          remainingCount: body.endCondition.totalCount,
          totalCount: body.endCondition.totalCount
        })
      },
      nextSendDate,
      status: 'active',
      sentWorkoutIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('recurringSchedules').add(scheduleData);

    return NextResponse.json({ id: docRef.id, ...scheduleData });
  } catch (error: any) {
    console.error('Error creating recurring schedule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create schedule' },
      { status: 500 }
    );
  }
}
