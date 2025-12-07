import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Workout, WorkoutFormData } from '@/types';

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

export async function getCoachStudents(coachId: string): Promise<any[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('coachId', '==', coachId), where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
}
