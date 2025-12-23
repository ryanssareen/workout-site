import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Workout, WorkoutFormData, WorkoutComment, WorkoutRating, PersonalRecord, PRCategory } from '@/types';

export async function createWorkout(data: WorkoutFormData, createdBy: string): Promise<string> {
  try {
    const workoutData = {
      name: data.name,
      type: data.type,
      description: data.description,
      date: Timestamp.fromDate(data.date),
      duration: data.duration || null,
      createdBy,
      assignedTo: data.assignedTo,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'workouts'), workoutData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create workout');
  }
}

export async function getWorkout(id: string): Promise<Workout | null> {
  try {
    const docRef = doc(db, 'workouts', id);
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
    const workoutsRef = collection(db, 'workouts');
    const field = role === 'coach' ? 'createdBy' : 'assignedTo';
    const q = query(workoutsRef, where(field, '==', userId), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Workout[];
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return [];
  }
}

export async function updateWorkout(id: string, data: Partial<WorkoutFormData>): Promise<void> {
  try {
    const docRef = doc(db, 'workouts', id);
    const updateData: any = { ...data, updatedAt: serverTimestamp() };
    if (data.date) { updateData.date = Timestamp.fromDate(data.date); }
    await updateDoc(docRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout');
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workouts', id));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete workout');
  }
}

export async function toggleWorkoutCompletion(id: string, completed: boolean): Promise<void> {
  try {
    const docRef = doc(db, 'workouts', id);
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
    const docRef = doc(db, 'workouts', id);
    const updateData: Record<string, any> = {
      completed,
      updatedAt: serverTimestamp(),
    };

    if (completed) {
      updateData.completedAt = serverTimestamp();
      updateData.completedBy = 'manual';
      if (notes) {
        updateData.completionNotes = notes;
      }
    } else {
      // Clear completion fields when un-completing
      updateData.completedAt = null;
      updateData.completedBy = null;
      updateData.completionNotes = null;
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
    const commentsRef = collection(db, 'workouts', workoutId, 'comments');
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
    const commentsRef = collection(db, 'workouts', workoutId, 'comments');
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
    const commentRef = doc(db, 'workouts', workoutId, 'comments', commentId);
    await deleteDoc(commentRef);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete comment');
  }
}

export async function getCoachStudents(coachId: string): Promise<any[]> {
  try {
    // Get coach's user document to check email
    const coachDoc = await getDoc(doc(db, 'users', coachId));
    const coachEmail = coachDoc.exists() ? coachDoc.data()?.email : null;

    const usersRef = collection(db, 'users');
    let q;

    // Special case: rsareen@gmail.com gets ALL students
    if (coachEmail === 'rsareen@gmail.com') {
      q = query(usersRef, where('role', '==', 'student'));
    } else {
      // Regular coaches only see students assigned to them
      q = query(usersRef, where('coachId', '==', coachId), where('role', '==', 'student'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching students:', error);
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
    const coachDoc = await getDoc(doc(db, 'users', coachId));
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
    const userRef = doc(db, 'users', studentId);
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
    const userRef = doc(db, 'users', studentId);
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
    const userRef = doc(db, 'users', userId);
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
    const userRef = doc(db, 'users', userId);
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
    const recordsRef = collection(db, 'personalRecords');
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
    const recordsRef = collection(db, 'personalRecords');
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

    const recordData = {
      userId,
      ...data,
      date: Timestamp.fromDate(data.date),
      previousValue,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

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
    const recordRef = doc(db, 'personalRecords', recordId);
    const updateData: Record<string, any> = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    if (data.date) {
      updateData.date = Timestamp.fromDate(data.date);
    }
    await updateDoc(recordRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update personal record');
  }
}

export async function deletePersonalRecord(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'personalRecords', recordId));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete personal record');
  }
}
