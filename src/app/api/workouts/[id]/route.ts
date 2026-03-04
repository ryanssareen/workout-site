export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/workouts/[id]?ownerUsername=xxx
 * Fetch a single workout by ID
 * Requires ownerUsername query param to construct subcollection path:
 *   users/{ownerUsername}/workouts/{id}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ownerUsername = searchParams.get('ownerUsername');

    // In production, fetch from Firestore here:
    //   adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(id)
    // For this app, we use client-side Firestore queries
    return NextResponse.json({
      message: 'Use client-side Firestore queries',
      id,
      ownerUsername,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workout' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workouts/[id]?ownerUsername=xxx
 * Update a workout
 * Requires ownerUsername query param to construct subcollection path:
 *   users/{ownerUsername}/workouts/{id}
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ownerUsername = searchParams.get('ownerUsername');
    const body = await request.json();

    // In production, update in Firestore here:
    //   adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(id)
    // For this app, we use client-side Firestore operations
    return NextResponse.json({
      message: 'Use client-side Firestore operations',
      id,
      ownerUsername,
      success: true
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update workout' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workouts/[id]?ownerUsername=xxx
 * Delete a workout
 * Requires ownerUsername query param to construct subcollection path:
 *   users/{ownerUsername}/workouts/{id}
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ownerUsername = searchParams.get('ownerUsername');

    // In production, delete from Firestore here:
    //   adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(id)
    // For this app, we use client-side Firestore operations
    return NextResponse.json({
      message: 'Use client-side Firestore operations',
      id,
      ownerUsername,
      success: true
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete workout' },
      { status: 500 }
    );
  }
}
