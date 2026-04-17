# Library Exports (updated 2026-04-17, training-plan phase 1-3)
# fn=function, class=class. Type-only files omitted.

## src/lib
constants.ts
  MS_PER_DAY  |  MS_PER_HOUR  |  MS_PER_MINUTE  |  SECONDS_PER_DAY
  COACH_QUERY_WINDOW_DAYS  |  FIRESTORE_BATCH_LIMIT  |  MAX_USERS_PER_RUN
admin-auth.ts
  fn getAdminUids
  fn createPasswordSessionToken
  fn verifyPasswordSessionToken
  fn checkPasswordMatches
  +3 more
analytics.ts
  fn getTimeRangeStart
  fn filterByTimeRange
  fn computeSummary
  fn computeTimeSeries
  fn computeTypeDistribution
  fn computeWeeklyRhythm
  fn computeCalendarData
  fn computeInsights
  fn computePRTimeline
  fn detectDuplicates
api-auth.ts
  fn verifyApiRequest
  fn isVerifiedUser
  fn verifyPlanAccess (training plan gate — beta+athlete check; loads activePlanId/lastFailedPlanId)
backup.ts
  fn generateBackupData
  fn createBackup
  fn createSeedBackup
  fn createDeltaBackup
  +3 more
dateUtils.ts
  fn safeToDate
  fn formatInTimezone
  fn formatTime
  fn formatDateTime
  +1 more
dayKey.ts
  fn normalizeTimezone
  fn parseLocalDate
  fn getDayKey
firebase-admin.ts
  fn getFirebaseAdminApp
  fn getFirebaseAdminDb
  fn getFirebaseAdminAuth
groq-dedup.ts
  fn runDedupPipeline
  fn executeDedupDeletions
groq-format.ts
  fn formatWorkouts
  fn formatWorkoutFallback
posthog.ts
  fn initPostHog
  fn identifyUser
  fn resetUser
  fn track
push.ts
  fn sendPushNotification
  fn sendPushToUsers
# 7 single-export files:
achievements:checkAchievements  |  api-client:createWorkoutViaApi  |  api-registry:getEndpointsByCategory
milestones:detectNewMilestones  |  polyline:decodePolyline  |  pr-detection:extractPRCandidates
utils:cn

## src/lib/email
accountActionTemplate.ts
  fn generateAccountDisabledEmail
  fn generateAccountDeletedEmail
  fn generateAccountRestoredEmail
announcementTemplate.ts
  fn generateAnnouncementEmail
  fn generateFeatureUpdateEmail
assignmentTemplate.ts
  fn generateAssignmentEmail
  fn generateAssignmentSubject
summaryTemplate.ts
  fn generateSummaryEmail
  fn generateSummarySubject
wrapTemplate.ts
  fn generateWrapSubject
  fn generateWrapEmail

## src/lib/firebase
admin.ts
  fn getAdminAuth
  fn getAdminDb
  adminAuth (proxy)  |  adminDb (proxy)
adminUserMapping.ts
  fn adminGetUsernameFromUid
  fn adminGetUserByUsername
  fn adminGetUserDocRef
  fn adminResolveUsername
auth.ts
  fn createUser
  fn createGoogleUser
  fn signIn
  fn signOut
  +4 more
config.ts
  fn getAuthInstance
  fn getDbInstance
  fn getStorageInstance
  fn getAppInstance
firestore.ts
  fn createWorkout        (emits summaryVersion+summary via applySummaryOnCreate — every new workout carries planStatus='active')
  fn getWorkout
  fn getUserWorkouts
  fn updateWorkout        (re-generates summary inline via applySummaryOnUpdate)
  completeWorkout / toggleWorkoutCompletion also invoke applySummaryOnUpdate
  +18 more
userMapping.ts
  fn validateUsername
  fn getUsernameFromUid
  fn isUsernameAvailable

## src/lib/import
validator.ts
  fn validateWorkouts
  fn deduplicateAgainstExisting
enricher.ts  fn enrichWorkouts
mapper.ts  fn mapColumns
parser.ts  fn parseFile
transformer.ts  fn transformRows

## src/lib/reports
cache.ts
  fn getCachedReport
  fn setCachedReport

## src/lib/reports/templates
index.ts  fn getTemplate

## src/lib/schemas
profile.ts
  SPORT_OPTIONS  |  TRAINING_FOR_OPTIONS  |  AGE_RANGE_OPTIONS  |  EXPERIENCE_LEVEL_OPTIONS
  profileSchema  |  type ProfileFormData
workout.ts
  RECURRING_FREQUENCIES  |  type RecurringFrequency
  workoutSchema  |  type WorkoutSchema

## src/lib/stores
authStore.ts  useAuthStore
stravaSyncStore.ts  useStravaSyncStore
workoutStore.ts  useWorkoutStore (5-min TTL cache + request deduplication)

## src/lib/training
constraints.ts
  fn computeSessionLoad
  fn getTrainingPhase
  fn buildConstraints
logicEngine.ts
  fn analyzeHistory
  fn generateLogicOutput
planEngine.ts  fn generatePlanSkeletons
validator.ts  fn validatePlan
summary.ts  (training-plan Unit 2 / R19)
  fn computeWorkoutSummary — pure; emits AdherenceState with 5 values (on-target, slightly-off, exceeded, missed, unplanned)
  fn isSummaryStale — monotonic summaryVersion comparison (NOT timestamps)
  fn mergeSummaryIntoUpdate — SDK-agnostic merge helper for every workout write site
  fn buildCreateSummaryFields — initial summaryVersion+summary+planStatus='active' for new workouts
multiWeekPlanner.ts  (training-plan Unit 3 / R3, R4)
  fn generateMultiWeekPlan — deterministic phase map + weekly skeletons; endurance-led with strength/mobility filler
  fn defaultPlanLengthWeeks — per-goal defaults (5K=8w, 10K=10w, HM=12w, M=16w, OlyTri=16w, IM=24w)
planTemplates.ts  (training-plan Unit 4 / R20)
  PLAN_TEMPLATES — 5 seeded methodologies (Balanced Marathon, Daniels VDOT, Polarized, Trisutto, Beginner)
  fn getMatchingTemplates  |  fn getDefaultTemplate  |  fn getTemplateById
  fn buildMethodologyPromptSection — wraps addendum in [METHODOLOGY_ADDENDUM]…[END] delimiter
planCreation.ts  (training-plan Unit 6)
  fn createPlanContent — per-phase Groq enrichment (70B → 8B fallback) over multiWeekPlanner skeleton with carried-forward context; rules-based fallback when API key missing
  type EnhancedSession, PlanCreationResult
