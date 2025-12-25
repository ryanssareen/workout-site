// Quick script to delete duplicate Strava workouts
// Run this in Firebase Console > Firestore > Run Query

/*
To delete duplicate Strava workouts:

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: workout-tracker-8048f
3. Go to Firestore Database
4. Click on "workouts" collection
5. Look for duplicate workouts with same stravaActivityId
6. Manually delete the duplicates (keep the first one)

OR

Use this query to find them:
- Filter: source == "strava"
- Sort by: date (descending)
- Look for duplicate names/times
- Delete the extras
*/

// After deleting duplicates, the new transaction lock will prevent future ones!
console.log('See instructions above to delete duplicate Strava workouts');
