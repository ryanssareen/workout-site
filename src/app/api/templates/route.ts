export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

// GET: List all templates for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const templatesSnapshot = await adminDb
      .collection('workoutTemplates')
      .where('createdBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, description, duration, createdBy, timeframe, frequency, workoutId } = body;

    if (!name || !type || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const templateData = {
      name,
      type,
      description: description || '',
      duration: duration || null,
      timeframe: timeframe || null,
      frequency: frequency || null,
      createdBy,
      workoutId: workoutId || null, // Track which workout created this template
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await adminDb.collection('workoutTemplates').add(templateData);

    // If workoutId is provided, update the workout to track the templateId
    if (workoutId && createdBy) {
      await adminDb.collection('users').doc(createdBy).collection('workouts').doc(workoutId).update({
        templateId: docRef.id,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ id: docRef.id, ...templateData }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');

    if (!templateId || !userId) {
      return NextResponse.json(
        { error: 'Template ID and User ID required' },
        { status: 400 }
      );
    }

    // Get the template to verify ownership
    const templateDoc = await adminDb.collection('workoutTemplates').doc(templateId).get();

    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const templateData = templateDoc.data();
    if (templateData?.createdBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If template has a workoutId, remove the templateId from that workout
    if (templateData?.workoutId && templateData?.createdBy) {
      await adminDb.collection('users').doc(templateData.createdBy).collection('workouts').doc(templateData.workoutId).update({
        templateId: null,
        updatedAt: new Date(),
      });
    }

    // Delete the template
    await adminDb.collection('workoutTemplates').doc(templateId).delete();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
