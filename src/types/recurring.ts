import { Timestamp } from 'firebase/firestore';
import { WorkoutTag, SwimData, BikeData, RunData, StrengthData, OtherData } from './workout';

export interface RecurringSchedule {
  id: string;
  coachId: string;
  studentId: string;
  intervalDays: number;

  workoutTemplate: {
    name: string;
    type: 'swim' | 'bike' | 'run' | 'strength' | 'other';
    tags?: WorkoutTag[];
    swim?: SwimData;
    bike?: BikeData;
    run?: RunData;
    strength?: StrengthData;
    other?: OtherData;
  };

  endCondition: {
    type: 'date' | 'count' | 'none';
    endDate?: Date | Timestamp;
    remainingCount?: number;
    totalCount?: number;
  };

  nextSendDate: Date | Timestamp;
  lastSendDate?: Date | Timestamp;
  status: 'active' | 'paused' | 'completed' | 'cancelled';

  sentWorkoutIds: string[];
  originalWorkoutId?: string;

  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateRecurringScheduleInput {
  coachId: string;
  studentId: string;
  intervalDays: number;
  workoutTemplate: RecurringSchedule['workoutTemplate'];
  endCondition: {
    type: 'date' | 'count' | 'none';
    endDate?: Date;
    totalCount?: number;
  };
}
