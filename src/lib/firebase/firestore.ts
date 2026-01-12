import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getDbInstance } from './config';
import { Workout, WorkoutFormData, WorkoutComment, WorkoutRating, PersonalRecord, PRCategory } from '@/types';

export async function createWorkout(data: WorkoutFormData, createdBy: string): Promise<string> {
  try {
    const workoutData: any = {
      name: data.name,
      type: data.type,
      date: Timestamp.fromDate(data.date),
      createdBy,
      assignedTo: data.assignedTo,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add legacy fields for backward compatibility
    if (data.description) workoutData.description = data.description;
    if (data.duration) workoutData.duration = data.duration;

    // Add tags if provided
    if (data.tags && data.tags.length > 0) workoutData.tags = data.tags;

    // Add type-specific data
    if (data.swim) workoutData.swim = data.swim;
    if (data.bike) workoutData.bike = data.bike;
    if (data.run) workoutData.run = data.run;
    if (data.strength) workoutData.strength = data.strength;
    if (data.other) workoutData.other = data.other;

    const docRef = await addDoc(collection(getDbInstance(), 'workouts'), workoutData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create workout');
  }
}

export async function getWorkout(id: string): Promise<Workout | null> {
  try {
    const docRef = doc(getDbInstance(), 'workouts', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Workout;
    }
    return null;
  } catch (error) {
    console.error('Error fetching workout:', error);
    return null;
  }
}

export async function getUserWorkouts(userId: string, role: 'coach' | 'student'): Promise<Workout[]> {
  try {
    const workoutsRef = collection(getDbInstance(), 'workouts');
    
    if (role === 'student') {
      // Students see workouts assigned to them
      const q = query(workoutsRef, where('assignedTo', '==', userId), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Workout[];
    } else {
      // Coaches see:
      // 1. Workouts they created (createdBy = coachId)
      // 2. Workouts assigned to their students (including Strava imports)
      
      // Get coach's students
      const students = await getCoachStudents(userId);
      const studentIds = students.map(s => s.uid);
      
      // Query 1: Workouts created by coach
      const coachWorkoutsQuery = query(
        workoutsRef, 
        where('createdBy', '==', userId), 
        orderBy('date', 'desc')
      );
      const coachWorkouts = await getDocs(coachWorkoutsQuery);
      
      // Query 2: Workouts assigned to students (Strava imports)
      // We need to fetch these separately since Firestore doesn't support OR queries well
      const studentWorkouts: Workout[] = [];
      
      if (studentIds.length > 0) {
        // Firestore 'in' supports max 10 items, so batch if needed
        const batches = [];
        for (let i = 0; i < studentIds.length; i += 10) {
          const batch = studentIds.slice(i, i + 10);
          batches.push(batch);
        }
        
        for (const batch of batches) {
          const studentQuery = query(
            workoutsRef,
            where('assignedTo', 'in', batch),
            where('source', '==', 'strava')
          );
          const studentDocs = await getDocs(studentQuery);
          studentWorkouts.push(...studentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Workout));
        }
      }
      
      // Combine and deduplicate
      const allWorkouts = [
        ...coachWorkouts.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Workout),
        ...studentWorkouts
      ];
      
      // Remove duplicates by ID
      const uniqueWorkouts = Array.from(
        new Map(allWorkouts.map(w => [w.id, w])).values()
      );
      
      // Sort by date descending
      uniqueWorkouts.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : (a.date as any);
        const dateB = b.date?.toDate ? b.date.toDate() : (b.date as any);
        const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
        const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
        return timeB - timeA;
      });
      
      return uniqueWorkouts;
    }
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return [];
  }
}

export async function updateWorkout(id: string, data: Partial<WorkoutFormData>): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'workouts', id);
    const updateData: any = { ...data, updatedAt: serverTimestamp() };
    if (data.date) { updateData.date = Timestamp.fromDate(data.date); }
    await updateDoc(docRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout');
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getDbInstance(), 'workouts', id));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete workout');
  }
}

export async function toggleWorkoutCompletion(id: string, completed: boolean): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'workouts', id);
    await updateDoc(docRef, { completed, updatedAt: serverTimestamp() });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout status');
  }
}

// Enhanced completion with notes and rating
export async function completeWorkout(
  id: string,
  completed: boolean,
  notes?: string
): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'workouts', id);
    
    // Get workout to check if completion is late
    const workoutSnap = await getDoc(docRef);
    if (!workoutSnap.exists()) {
      throw new Error('Workout not found');
    }
    
    const updateData: Record<string, any> = {
      completed,
      updatedAt: serverTimestamp(),
    };

    if (completed) {
      const now = new Date();
      const workoutDate = workoutSnap.data().date.toDate();
      
      // Set workout date to end of day for fair comparison
      workoutDate.setHours(23, 59, 59, 999);
      
      // Check if completing after due date
      const isLate = now > workoutDate;
      
      console.log('🔍 Late completion check:', {
        now: now.toISOString(),
        workoutDate: workoutDate.toISOString(),
        isLate,
        workoutName: workoutSnap.data().name
      });
      
      updateData.completedAt = serverTimestamp();
      updateData.completedBy = 'manual';
      updateData.completedLate = isLate;
      
      if (notes) {
        updateData.completionNotes = notes;
      }
    } else {
      // Clear completion fields when un-completing
      updateData.completedAt = null;
      updateData.completedBy = null;
      updateData.completionNotes = null;
      updateData.completedLate = null;
    }

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout status');
  }
}

// Workout Comments Functions
export async function addWorkoutComment(
  workoutId: string,
  userId: string,
  userRole: 'coach' | 'student',
  userName: string,
  text: string,
  rating?: WorkoutRating,
  parentCommentId?: string
): Promise<string> {
  try {
    const commentsRef = collection(getDbInstance(), 'workouts', workoutId, 'comments');
    const commentData: Omit<WorkoutComment, 'id'> = {
      workoutId,
      userId,
      userRole,
      userName,
      text,
      createdAt: Timestamp.now(),
      ...(rating && { rating }),
      ...(parentCommentId && { parentCommentId, isCoachReply: userRole === 'coach' }),
    };

    const docRef = await addDoc(commentsRef, commentData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add comment');
  }
}

export async function getWorkoutComments(workoutId: string): Promise<WorkoutComment[]> {
  try {
    const commentsRef = collection(getDbInstance(), 'workouts', workoutId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WorkoutComment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

export async function deleteWorkoutComment(workoutId: string, commentId: string): Promise<void> {
  try {
    const commentRef = doc(getDbInstance(), 'workouts', workoutId, 'comments', commentId);
    await deleteDoc(commentRef);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete comment');
  }
}

export async function getCoachStudents(coachId: string): Promise<any[]> {
  try {
    // Get coach's user document to check email
    const coachDoc = await getDoc(doc(getDbInstance(), 'users', coachId));
    const coachEmail = coachDoc.exists() ? coachDoc.data()?.email : null;

    console.log('👑 getCoachStudents - Admin check:', { coachId, coachEmail });

    const usersRef = collection(getDbInstance(), 'users');
    let q;

    // Special case: rsareen@gmail.com gets ALL students
    if (coachEmail === 'rsareen@gmail.com') {
      console.log('👑 ADMIN MODE: Fetching ALL students');
      q = query(usersRef, where('role', '==', 'student'));
    } else {
      // Regular coaches only see students assigned to them
      console.log('👤 Regular mode: Fetching assigned students only');
      q = query(usersRef, where('coachId', '==', coachId), where('role', '==', 'student'));
    }

    const querySnapshot = await getDocs(q);
    const students = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    console.log('📊 Found students:', students.length);
    return students;
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    return [];
  }
}

export interface StudentWithStats {
  uid: string;
  displayName: string;
  email: string;
  assignedWorkouts: number;
  completedWorkouts: number;
  completionRate: number;
  isActive: boolean;
}

export interface CoachStats {
  totalStudents: number;
  activeStudents: number;
  totalWorkouts: number;
  completedWorkouts: number;
  pendingWorkouts: number;
  overallCompletionRate: number;
  workoutsByType: {
    swim: { total: number; completed: number };
    run: { total: number; completed: number };
    bike: { total: number; completed: number };
    strength: { total: number; completed: number };
  };
  studentsWithStats: StudentWithStats[];
}

export async function getCoachDashboardStats(coachId: string): Promise<CoachStats> {
  try {
    // Get students
    const students = await getCoachStudents(coachId);

    // Get all workouts created by this coach
    const workouts = await getUserWorkouts(coachId, 'coach');

    // Calculate workout stats
    const completedWorkouts = workouts.filter(w => w.completed).length;
    const pendingWorkouts = workouts.length - completedWorkouts;

    // Calculate by type
    const workoutsByType = {
      swim: { total: 0, completed: 0 },
      run: { total: 0, completed: 0 },
      bike: { total: 0, completed: 0 },
      strength: { total: 0, completed: 0 },
    };

    workouts.forEach(w => {
      const type = w.type as keyof typeof workoutsByType;
      if (workoutsByType[type]) {
        workoutsByType[type].total++;
        if (w.completed) {
          workoutsByType[type].completed++;
        }
      }
    });

    // Calculate per-student stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const studentsWithStats: StudentWithStats[] = students.map(student => {
      const studentWorkouts = workouts.filter(w => w.assignedTo === student.uid);
      const studentCompleted = studentWorkouts.filter(w => w.completed);

      // Check if student completed any workout in last 7 days
      const isActive = studentCompleted.some(w => {
        const workoutDate = w.updatedAt?.toDate?.() || w.date.toDate();
        return workoutDate >= sevenDaysAgo;
      });

      return {
        uid: student.uid,
        displayName: student.displayName || 'Unknown',
        email: student.email || '',
        assignedWorkouts: studentWorkouts.length,
        completedWorkouts: studentCompleted.length,
        completionRate: studentWorkouts.length > 0
          ? Math.round((studentCompleted.length / studentWorkouts.length) * 100)
          : 0,
        isActive,
      };
    });

    const activeStudents = studentsWithStats.filter(s => s.isActive).length;

    return {
      totalStudents: students.length,
      activeStudents,
      totalWorkouts: workouts.length,
      completedWorkouts,
      pendingWorkouts,
      overallCompletionRate: workouts.length > 0
        ? Math.round((completedWorkouts / workouts.length) * 100)
        : 0,
      workoutsByType,
      studentsWithStats,
    };
  } catch (error) {
    console.error('Error fetching coach stats:', error);
    return {
      totalStudents: 0,
      activeStudents: 0,
      totalWorkouts: 0,
      completedWorkouts: 0,
      pendingWorkouts: 0,
      overallCompletionRate: 0,
      workoutsByType: {
        swim: { total: 0, completed: 0 },
        run: { total: 0, completed: 0 },
        bike: { total: 0, completed: 0 },
        strength: { total: 0, completed: 0 },
      },
      studentsWithStats: [],
    };
  }
}

// Get coach info by ID
export async function getCoachInfo(coachId: string): Promise<{ uid: string; displayName: string; email: string } | null> {
  try {
    const coachDoc = await getDoc(doc(getDbInstance(), 'users', coachId));
    if (coachDoc.exists()) {
      const data = coachDoc.data();
      return {
        uid: coachDoc.id,
        displayName: data.displayName || 'Unknown',
        email: data.email || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching coach info:', error);
    return null;
  }
}

// Connect student to coach
export async function connectToCoach(studentId: string, coachId: string): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', studentId);
    await updateDoc(userRef, {
      coachId,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to connect to coach');
  }
}

// Disconnect student from coach
export async function disconnectFromCoach(studentId: string): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', studentId);
    await updateDoc(userRef, {
      coachId: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to disconnect from coach');
  }
}

// Update user's Strava connection
export async function updateUserStravaConnection(
  userId: string,
  stravaData: {
    stravaId: string;
    stravaAccessToken: string;
    stravaRefreshToken: string;
    stravaTokenExpiresAt: number;
  }
): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', userId);
    await updateDoc(userRef, {
      ...stravaData,
      stravaConnectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update Strava connection');
  }
}

// Disconnect Strava
export async function disconnectStrava(userId: string): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', userId);
    await updateDoc(userRef, {
      stravaId: null,
      stravaAccessToken: null,
      stravaRefreshToken: null,
      stravaTokenExpiresAt: null,
      stravaConnectedAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to disconnect Strava');
  }
}

// Personal Records Functions
export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  try {
    const recordsRef = collection(getDbInstance(), 'personalRecords');
    const q = query(recordsRef, where('userId', '==', userId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PersonalRecord[];
  } catch (error) {
    console.error('Error fetching personal records:', error);
    return [];
  }
}

export async function addPersonalRecord(
  userId: string,
  data: {
    category: PRCategory;
    name: string;
    value: number;
    unit: string;
    date: Date;
    workoutId?: string;
    stravaActivityId?: string;
    notes?: string;
  }
): Promise<string> {
  try {
    // Check if there's an existing record of the same type
    const recordsRef = collection(getDbInstance(), 'personalRecords');
    const q = query(
      recordsRef,
      where('userId', '==', userId),
      where('name', '==', data.name)
    );
    const existing = await getDocs(q);

    let previousValue: number | undefined;
    if (!existing.empty) {
      const oldRecord = existing.docs[0].data();
      previousValue = oldRecord.value;
      // Delete old record (we only keep the best)
      await deleteDoc(existing.docs[0].ref);
    }

    const recordData: any = {
      userId,
      category: data.category,
      name: data.name,
      value: data.value,
      unit: data.unit,
      date: Timestamp.fromDate(data.date),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Only add optional fields if they exist (Firestore doesn't allow undefined)
    if (previousValue !== undefined) {
      recordData.previousValue = previousValue;
    }
    if (data.workoutId !== undefined) {
      recordData.workoutId = data.workoutId;
    }
    if (data.stravaActivityId !== undefined) {
      recordData.stravaActivityId = data.stravaActivityId;
    }
    if (data.notes !== undefined && data.notes !== '') {
      recordData.notes = data.notes;
    }

    const docRef = await addDoc(recordsRef, recordData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add personal record');
  }
}

export async function updatePersonalRecord(
  recordId: string,
  data: Partial<{
    value: number;
    date: Date;
    notes: string;
  }>
): Promise<void> {
  try {
    const recordRef = doc(getDbInstance(), 'personalRecords', recordId);
    const updateData: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    
    // Only add fields that are defined
    if (data.value !== undefined) {
      updateData.value = data.value;
    }
    if (data.date !== undefined) {
      updateData.date = Timestamp.fromDate(data.date);
    }
    if (data.notes !== undefined && data.notes !== '') {
      updateData.notes = data.notes;
    }
    
    await updateDoc(recordRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update personal record');
  }
}

export async function deletePersonalRecord(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(getDbInstance(), 'personalRecords', recordId));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete personal record');
  }
}
