// Process a new Strava activity - CLEAN VERSION
async function processActivity(
  stravaAthleteId: string,
  stravaActivityId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`\n🏃 Processing Strava activity ${stravaActivityId} for athlete ${stravaAthleteId}`);

    // Find user by Strava ID
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaId', '==', stravaAthleteId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return { success: false, message: `No user found with Strava ID ${stravaAthleteId}` };
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`👤 Found user: ${userData.displayName} (${userId})`);

    // Check if we already imported this activity (STRICT CHECK)
    const existingWorkout = await adminDb
      .collection('workouts')
      .where('stravaActivityId', '==', stravaActivityId)
      .limit(1)
      .get();

    if (!existingWorkout.empty) {
      console.log(`✅ Activity ${stravaActivityId} already imported as workout ${existingWorkout.docs[0].id} - SKIPPING`);
      return { success: true, message: 'Activity already imported (duplicate prevented)' };
    }

    // DOUBLE CHECK: Also check by activity ID string conversion
    const existingWorkout2 = await adminDb
      .collection('workouts')
      .where('stravaActivityId', '==', String(stravaActivityId))
      .limit(1)
      .get();

    if (!existingWorkout2.empty) {
      console.log(`✅ Activity ${stravaActivityId} already imported (string check) - SKIPPING`);
      return { success: true, message: 'Activity already imported (duplicate prevented)' };
    }

    // TRIPLE CHECK: Check if ANY workout for this user was created in last 60 seconds
    // This catches rapid duplicate webhooks
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentWorkouts = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('source', '==', 'strava')
      .where('createdAt', '>', admin.firestore.Timestamp.fromDate(sixtySecondsAgo))
      .get();

    if (!recentWorkouts.empty) {
      console.log(`⚠️ Found ${recentWorkouts.size} Strava workouts created in last 60 seconds`);
    }

    // Get access token
    const accessToken = await getAccessToken(userId, userData);
    if (!accessToken) {
      return { success: false, message: 'Failed to get access token' };
    }

    // Fetch activity details
    const activity = await fetchActivityDetails(stravaActivityId, accessToken);
    if (!activity) {
      return { success: false, message: 'Failed to fetch activity details' };
    }

    const workoutType = mapStravaType(activity.type);
    const activityDate = new Date(activity.start_date_local);
    
    console.log(`📅 Activity: ${activity.name} (${activity.type} → ${workoutType}) on ${activityDate.toISOString()}`);

    // FINAL CHECK: Check for same name and date (catches rapid webhooks)
    if (!recentWorkouts.empty) {
      for (const doc of recentWorkouts.docs) {
        const data = doc.data();
        const existingDate = data.date?.toDate?.();
        if (data.name === activity.name && existingDate && 
            Math.abs(existingDate.getTime() - activityDate.getTime()) < 60000) {
          console.log(`🛑 DUPLICATE DETECTED: Same workout "${data.name}" created ${Math.round((Date.now() - data.createdAt.toMillis()) / 1000)}s ago - SKIPPING`);
          return { success: true, message: 'Duplicate prevented (recent webhook)' };
        }
      }
    }

    // Prepare stats
    const actualStats: any = {};
    if (activity.distance) actualStats.distance = activity.distance;
    if (activity.moving_time) actualStats.duration = activity.moving_time;
    if (activity.calories) actualStats.calories = activity.calories;
    if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
    if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
    if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
    if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
    if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

    // CREATE NEW WORKOUT from Strava activity
    const newWorkoutRef = adminDb.collection('workouts').doc();
    const workoutId = newWorkoutRef.id;
    
    const newWorkoutData = {
      name: activity.name,
      type: workoutType,
      description: `Imported from Strava\nDistance: ${(activity.distance / 1000).toFixed(2)} km\nMoving time: ${Math.round(activity.moving_time / 60)} min`,
      date: admin.firestore.Timestamp.fromDate(activityDate),
      duration: Math.round(activity.moving_time / 60),
      createdBy: userId,
      assignedTo: userId,
      completed: true,
      completedAt: admin.firestore.Timestamp.fromDate(activityDate),
      completedBy: 'strava',
      stravaActivityId: stravaActivityId,
      actualStats,
      source: 'strava',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await newWorkoutRef.set(newWorkoutData);
    console.log(`✅ Created new workout ${workoutId} from Strava activity`);

    // DELETE old incomplete workouts of same type within ±2 days (optional cleanup)
    const twoDaysBefore = new Date(activityDate);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    const twoDaysAfter = new Date(activityDate);
    twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

    const oldWorkoutsSnapshot = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('type', '==', workoutType)
      .where('completed', '==', false)
      .where('date', '>=', admin.firestore.Timestamp.fromDate(twoDaysBefore))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(twoDaysAfter))
      .get();

    if (!oldWorkoutsSnapshot.empty) {
      console.log(`🗑️ Found ${oldWorkoutsSnapshot.size} old incomplete ${workoutType} workouts to delete`);
      
      const batch = adminDb.batch();
      oldWorkoutsSnapshot.docs.forEach(doc => {
        console.log(`  ❌ Deleting old workout: ${doc.data().name} (${doc.id})`);
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log(`✅ Deleted ${oldWorkoutsSnapshot.size} old workouts`);
    }

    return {
      success: true,
      message: `Created workout "${activity.name}" from Strava${oldWorkoutsSnapshot.size > 0 ? ` and deleted ${oldWorkoutsSnapshot.size} old workout(s)` : ''}`
    };
  } catch (error: any) {
    console.error('❌ Error processing activity:', error);
    return { success: false, message: error.message || 'Unknown error' };
  }
}
