import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp, writeBatch, deleteField,
} from 'firebase/firestore';
import { getDbInstance } from './config';
import { Workout, WorkoutFormData, WorkoutComment, WorkoutRating, PersonalRecord, PRCategory, Milestone } from '@/types';
import { addDays, addWeeks, addMonths } from 'date-fns';

// Extended form data to include recurring fields
export interface ExtendedWorkoutFormData extends WorkoutFormData {
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurringEndDate?: Date;
}

// Helper to calculate next date based on frequency
function getNextDate(currentDate: Date, frequency: string): Date {
  switch (frequency) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'biweekly':
      return addWeeks(currentDate, 2);
    case 'monthly':
      return addMonths(currentDate, 1);
    default:
      return addWeeks(currentDate, 1);
  }
}

export async function createWorkout(data: ExtendedWorkoutFormData, createdByUsername: string): Promise<string> {
  try {
    const ownerUsername = data.assignedTo;

    const baseWorkoutData: any = {
      name: data.name,
      type: data.type,
      createdBy: createdByUsername,
      assignedTo: data.assignedTo,
      ownerUsername,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add legacy fields for backward compatibility
    if (data.description) baseWorkoutData.description = data.description;
    if (data.duration) baseWorkoutData.duration = data.duration;

    // Add tags if provided
    if (data.tags && data.tags.length > 0) baseWorkoutData.tags = data.tags;

    // Add type-specific data
    if (data.swim) baseWorkoutData.swim = data.swim;
    if (data.bike) baseWorkoutData.bike = data.bike;
    if (data.run) baseWorkoutData.run = data.run;
    if (data.strength) baseWorkoutData.strength = data.strength;
    if (data.other) baseWorkoutData.other = data.other;

    // Handle recurring workouts
    if (data.isRecurring && data.recurringFrequency && data.recurringEndDate) {
      const db = getDbInstance();
      const batch = writeBatch(db);
      const workoutIds: string[] = [];

      let currentDate = new Date(data.date);
      const endDate = new Date(data.recurringEndDate);
      let isFirstWorkout = true;
      let firstWorkoutId = '';

      // Create workouts from start date until end date
      while (currentDate <= endDate) {
        const workoutRef = doc(collection(db, 'users', ownerUsername, 'workouts'));
        const workoutData = {
          ...baseWorkoutData,
          date: Timestamp.fromDate(currentDate),
          isRecurring: true,
          recurringFrequency: data.recurringFrequency,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(workoutRef, workoutData);
        workoutIds.push(workoutRef.id);

        if (isFirstWorkout) {
          firstWorkoutId = workoutRef.id;
          isFirstWorkout = false;
        }

        // Move to next date based on frequency
        currentDate = getNextDate(currentDate, data.recurringFrequency);
      }

      await batch.commit();
      console.log(`Created ${workoutIds.length} recurring workouts`);
      return firstWorkoutId;
    } else {
      // Single workout creation
      const workoutData = {
        ...baseWorkoutData,
        date: Timestamp.fromDate(data.date),
      };
      const workoutsRef = collection(getDbInstance(), 'users', ownerUsername, 'workouts');
      const docRef = await addDoc(workoutsRef, workoutData);
      return docRef.id;
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create workout');
  }
}

export async function getWorkout(ownerUsername: string, id: string): Promise<Workout | null> {
  try {
    const docRef = doc(getDbInstance(), 'users', ownerUsername, 'workouts', id);
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

export async function getUserWorkouts(username: string, role: 'coach' | 'athlete' | 'student'): Promise<Workout[]> {
  try {
    const db = getDbInstance();

    // Handle both 'athlete' and legacy 'student' role
    if (role === 'athlete' || role === 'student') {
      // Athletes see workouts in their own subcollection
      const workoutsRef = collection(db, 'users', username, 'workouts');
      const q = query(workoutsRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Workout[];
    } else {
      // Coaches see:
      // 1. Workouts they created (createdBy = coachUsername) across students
      // 2. Workouts in their students' subcollections (including Strava imports)

      // Get coach's students
      const students = await getCoachStudents(username);

      const allWorkouts: Workout[] = [];

      // For each student, get ALL their workouts
      for (const student of students) {
        const studentUsername = student.uid; // uid field contains username (doc.id)
        const studentWorkoutsRef = collection(db, 'users', studentUsername, 'workouts');
        const snap = await getDocs(query(studentWorkoutsRef, orderBy('date', 'desc')));

        const studentWorkouts = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Workout);

        // Enrich with athlete name
        for (const w of studentWorkouts) {
          if (!w.assignedToName) {
            w.assignedToName = student.displayName || undefined;
          }
        }

        allWorkouts.push(...studentWorkouts);
      }

      const uniqueWorkouts = allWorkouts;

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

export async function updateWorkout(ownerUsername: string, id: string, data: Partial<WorkoutFormData>): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'users', ownerUsername, 'workouts', id);
    const updateData: any = { updatedAt: serverTimestamp() };

    // Copy only defined values (Firestore rejects undefined)
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Convert JS Date to Firestore Timestamp
    if (data.date) { updateData.date = Timestamp.fromDate(data.date); }

    // When type changes, explicitly delete old type-specific fields
    const TYPE_FIELDS = ['swim', 'bike', 'run', 'strength', 'other'] as const;
    if (data.type) {
      for (const field of TYPE_FIELDS) {
        if (field !== data.type) {
          updateData[field] = deleteField();
        }
      }
    }

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout');
  }
}

export async function deleteWorkout(ownerUsername: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(getDbInstance(), 'users', ownerUsername, 'workouts', id));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete workout');
  }
}

export async function toggleWorkoutCompletion(ownerUsername: string, id: string, completed: boolean): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'users', ownerUsername, 'workouts', id);
    await updateDoc(docRef, { completed, updatedAt: serverTimestamp() });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update workout status');
  }
}

// Enhanced completion with notes and rating
export async function completeWorkout(
  ownerUsername: string,
  id: string,
  completed: boolean,
  notes?: string
): Promise<void> {
  try {
    const docRef = doc(getDbInstance(), 'users', ownerUsername, 'workouts', id);

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

      console.log('Late completion check:', {
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
  ownerUsername: string,
  workoutId: string,
  userId: string,
  userRole: 'coach' | 'athlete' | 'student',
  userName: string,
  text: string,
  rating?: WorkoutRating,
  parentCommentId?: string
): Promise<string> {
  try {
    const commentsRef = collection(getDbInstance(), 'users', ownerUsername, 'workouts', workoutId, 'comments');
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

export async function getWorkoutComments(ownerUsername: string, workoutId: string): Promise<WorkoutComment[]> {
  try {
    const commentsRef = collection(getDbInstance(), 'users', ownerUsername, 'workouts', workoutId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as WorkoutComment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

export async function deleteWorkoutComment(ownerUsername: string, workoutId: string, commentId: string): Promise<void> {
  try {
    const commentRef = doc(getDbInstance(), 'users', ownerUsername, 'workouts', workoutId, 'comments', commentId);
    await deleteDoc(commentRef);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete comment');
  }
}

// In-memory cache for coach students (rarely changes, expensive query)
const coachStudentsCache = new Map<string, { data: any[]; fetchedAt: number }>();
const COACH_STUDENTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getCoachStudents(coachUsername: string): Promise<any[]> {
  try {
    // Check cache first
    const cached = coachStudentsCache.get(coachUsername);
    if (cached && Date.now() - cached.fetchedAt < COACH_STUDENTS_CACHE_TTL) {
      return cached.data;
    }

    const usersRef = collection(getDbInstance(), 'users');

    // Single query with 'in' operator for both 'athlete' and legacy 'student' roles
    const q = query(
      usersRef,
      where('coachUsername', '==', coachUsername),
      where('role', 'in', ['athlete', 'student'])
    );
    const snapshot = await getDocs(q);
    const athletes = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));

    // Cache result
    coachStudentsCache.set(coachUsername, { data: athletes, fetchedAt: Date.now() });

    console.log('Found athletes:', athletes.length);
    return athletes;
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

export async function getCoachDashboardStats(coachUsername: string): Promise<CoachStats> {
  try {
    // Get students
    const students = await getCoachStudents(coachUsername);

    // Get all workouts visible to this coach
    const workouts = await getUserWorkouts(coachUsername, 'coach');

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
      const studentUsername = student.uid; // uid contains username (doc.id)
      const studentWorkouts = workouts.filter(w => w.assignedTo === studentUsername);
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

// Get coach info by username
export async function getCoachInfo(coachUsername: string): Promise<{ uid: string; displayName: string; email: string } | null> {
  try {
    const coachDoc = await getDoc(doc(getDbInstance(), 'users', coachUsername));
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

// Update user's Strava connection
export async function updateUserStravaConnection(
  username: string,
  stravaData: {
    stravaId: string;
    stravaAccessToken: string;
    stravaRefreshToken: string;
    stravaTokenExpiresAt: number;
  }
): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', username);
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
export async function disconnectStrava(username: string): Promise<void> {
  try {
    const userRef = doc(getDbInstance(), 'users', username);
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PersonalRecord[];
  } catch (error) {
    console.error('Error fetching personal records:', error);
    return [];
  }
}

// Helper to determine if a new record beats the existing one
// For speed category: lower is better (faster time)
// For all other categories (distance, strength, endurance): higher is better
function isNewRecordBetter(category: PRCategory, newValue: number, existingValue: number): boolean {
  if (category === 'speed') {
    return newValue < existingValue; // Lower time = faster = better
  }
  return newValue > existingValue; // Higher distance/weight/reps = better
}

export interface AddRecordResult {
  id: string;
  isNewRecord: boolean;
  previousValue?: number;
  message: string;
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
): Promise<AddRecordResult> {
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
      const existingValue = oldRecord.value as number;
      previousValue = existingValue;

      // Check if the new record beats the existing one
      if (!isNewRecordBetter(data.category, data.value, existingValue)) {
        // New record doesn't beat existing - reject it
        const comparisonWord = data.category === 'speed' ? 'faster than' : 'better than';
        return {
          id: '',
          isNewRecord: false,
          previousValue: existingValue,
          message: `Didn't beat your current record of ${existingValue} ${oldRecord.unit}. Your new value needs to be ${comparisonWord} that.`
        };
      }

      // New record beats existing - delete old record
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

    const improvementText = previousValue !== undefined
      ? ` You improved from ${previousValue} ${data.unit}!`
      : '';

    return {
      id: docRef.id,
      isNewRecord: true,
      previousValue,
      message: `New record!${improvementText}`
    };
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

// Milestone Functions
export async function getMilestones(username: string): Promise<Milestone[]> {
  try {
    const milestonesRef = collection(getDbInstance(), 'users', username, 'milestones');
    const q = query(milestonesRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Milestone[];
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }
}

export async function addMilestone(
  username: string,
  data: {
    userId: string;
    category: string;
    name: string;
    description: string;
    value: number;
    unit: string;
    icon: string;
    date: Date;
    workoutId?: string;
  }
): Promise<string | null> {
  try {
    const milestonesRef = collection(getDbInstance(), 'users', username, 'milestones');
    // Dedup: check if this exact milestone already exists
    const q = query(milestonesRef, where('category', '==', data.category), where('value', '==', data.value));
    const existing = await getDocs(q);
    if (!existing.empty) return null; // Already earned

    const milestoneData: Record<string, any> = {
      userId: data.userId,
      category: data.category,
      name: data.name,
      description: data.description,
      value: data.value,
      unit: data.unit,
      icon: data.icon,
      date: Timestamp.fromDate(data.date),
      createdAt: serverTimestamp(),
    };
    if (data.workoutId) milestoneData.workoutId = data.workoutId;

    const docRef = await addDoc(milestonesRef, milestoneData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding milestone:', error);
    return null;
  }
}
