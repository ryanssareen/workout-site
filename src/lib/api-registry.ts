export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  category: string;
  description: string;
  testable: boolean;
  auth: 'admin' | 'user' | 'cron' | 'public';
  dangerous?: boolean;
  params?: string;
}

export interface ApiCategory {
  id: string;
  label: string;
  color: string;
}

export const API_CATEGORIES: ApiCategory[] = [
  { id: 'admin', label: 'Admin', color: 'red' },
  { id: 'cron', label: 'Cron', color: 'amber' },
  { id: 'ai', label: 'AI', color: 'purple' },
  { id: 'auth', label: 'Auth', color: 'blue' },
  { id: 'strava', label: 'Strava', color: 'orange' },
  { id: 'webhooks', label: 'Webhooks', color: 'yellow' },
  { id: 'workouts', label: 'Workouts', color: 'green' },
  { id: 'import', label: 'Import', color: 'cyan' },
  { id: 'templates', label: 'Templates', color: 'indigo' },
  { id: 'email', label: 'Email', color: 'pink' },
  { id: 'reports', label: 'Reports', color: 'violet' },
  { id: 'export', label: 'Export', color: 'teal' },
  { id: 'push', label: 'Push', color: 'sky' },
  { id: 'other', label: 'Other', color: 'gray' },
];

export const API_REGISTRY: ApiEndpoint[] = [
  // ── Admin ──
  { method: 'GET', path: '/api/admin/verify', category: 'admin', description: 'Check admin session', testable: true, auth: 'admin' },
  { method: 'POST', path: '/api/admin/verify', category: 'admin', description: 'Admin login', testable: false, auth: 'public' },
  { method: 'DELETE', path: '/api/admin/verify', category: 'admin', description: 'Admin logout', testable: false, auth: 'admin' },
  { method: 'GET', path: '/api/admin/backup', category: 'admin', description: 'List backups', testable: true, auth: 'admin' },
  { method: 'POST', path: '/api/admin/backup', category: 'admin', description: 'Create backup', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/admin/backup/[id]', category: 'admin', description: 'Get backup detail', testable: false, auth: 'admin' },
  { method: 'POST', path: '/api/admin/backup/[id]', category: 'admin', description: 'Full restore from backup', testable: false, auth: 'admin', dangerous: true },
  { method: 'POST', path: '/api/admin/backup/[id]/restore-user', category: 'admin', description: 'Restore single user from backup', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/admin/backup/download', category: 'admin', description: 'Download latest backup', testable: true, auth: 'admin' },
  { method: 'POST', path: '/api/admin/backup/seed', category: 'admin', description: 'Upload seed backup (gzip)', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/admin/users', category: 'admin', description: 'List users', testable: true, auth: 'admin', params: '?export=csv' },
  { method: 'GET', path: '/api/admin/users/[uid]', category: 'admin', description: 'Get user detail', testable: false, auth: 'admin' },
  { method: 'DELETE', path: '/api/admin/users/[uid]', category: 'admin', description: 'Soft-delete user', testable: false, auth: 'admin', dangerous: true },
  { method: 'PATCH', path: '/api/admin/users/[uid]', category: 'admin', description: 'Restore deleted user', testable: false, auth: 'admin' },
  { method: 'GET', path: '/api/admin/logs', category: 'admin', description: 'View admin/cron logs', testable: true, auth: 'admin', params: '?type=actions|cron' },
  { method: 'POST', path: '/api/admin/assign-athletes', category: 'admin', description: 'Assign athletes to coach (legacy)', testable: false, auth: 'admin' },
  { method: 'POST', path: '/api/admin/migrate-merged-workouts', category: 'admin', description: 'Run merge migration', testable: false, auth: 'admin', dangerous: true },
  { method: 'POST', path: '/api/admin/restore', category: 'admin', description: 'Full restore from file (legacy)', testable: false, auth: 'admin', dangerous: true },

  // ── Cron ──
  { method: 'GET', path: '/api/cron/backup', category: 'cron', description: 'Trigger cron backup', testable: false, auth: 'cron', dangerous: true, params: '?type=daily|weekly|monthly' },
  { method: 'GET', path: '/api/cron/send-reminders', category: 'cron', description: 'Send reminder emails', testable: false, auth: 'cron', dangerous: true },
  { method: 'GET', path: '/api/cron/send-summaries', category: 'cron', description: 'Send 10-day summary emails', testable: false, auth: 'cron', dangerous: true },
  { method: 'GET', path: '/api/cron/send-weekly-wrap', category: 'cron', description: 'Send weekly wrap emails', testable: false, auth: 'cron', dangerous: true },
  { method: 'GET', path: '/api/cron/generate-insights', category: 'cron', description: 'Generate AI insights', testable: false, auth: 'cron', dangerous: true },

  // ── AI ──
  { method: 'POST', path: '/api/ai/workout-suggestions', category: 'ai', description: '3-tier workout suggestion pipeline', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/suggestions', category: 'ai', description: 'Quick workout suggestions', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/chat', category: 'ai', description: 'AI coach chat', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/reports/generate', category: 'ai', description: 'Generate AI report', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/reports', category: 'ai', description: 'Get/create reports', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/profile-tagline', category: 'ai', description: 'Generate profile tagline', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/profanity-check', category: 'ai', description: 'Check text for profanity', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/workout-recommendation', category: 'ai', description: 'Workout recommendation', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/route-comment', category: 'ai', description: 'AI comment on route', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/format-workouts', category: 'ai', description: 'Format workout data', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/ai/backfill-comments', category: 'ai', description: 'Backfill AI comments', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/ai/test', category: 'ai', description: 'Test Groq API key', testable: true, auth: 'public' },

  // ── Auth ──
  { method: 'POST', path: '/api/auth/create-user', category: 'auth', description: 'Create user + userMapping', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/auth/check-username', category: 'auth', description: 'Check username availability', testable: true, auth: 'public', params: '?username=test' },
  { method: 'GET', path: '/api/auth/strava/authorize', category: 'auth', description: 'Start Strava OAuth', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/auth/strava/callback', category: 'auth', description: 'Strava OAuth callback', testable: false, auth: 'public' },
  { method: 'POST', path: '/api/auth/strava/disconnect', category: 'auth', description: 'Disconnect Strava', testable: false, auth: 'user' },

  // ── Strava ──
  { method: 'POST', path: '/api/strava/sync', category: 'strava', description: 'Sync Strava activities', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/strava/sync', category: 'strava', description: 'Sync (GET mode, quota fallback)', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/strava/sync-all', category: 'strava', description: 'Sync all users', testable: false, auth: 'admin', dangerous: true },
  { method: 'POST', path: '/api/strava/cleanup', category: 'strava', description: 'Clean up Strava data', testable: false, auth: 'admin', dangerous: true },
  { method: 'POST', path: '/api/strava/migrate-photos', category: 'strava', description: 'Migrate Strava photos', testable: false, auth: 'admin', dangerous: true },
  { method: 'POST', path: '/api/strava/migrate-routes', category: 'strava', description: 'Migrate Strava routes', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/strava/migrate-routes/status', category: 'strava', description: 'Route migration status', testable: true, auth: 'admin' },
  { method: 'GET', path: '/api/strava/activity-details', category: 'strava', description: 'Get activity details', testable: false, auth: 'user', params: '?id=...' },
  { method: 'GET', path: '/api/strava/webhook-subscription', category: 'strava', description: 'Get webhook subscription', testable: true, auth: 'admin' },
  { method: 'POST', path: '/api/strava/webhook-subscription', category: 'strava', description: 'Create webhook subscription', testable: false, auth: 'admin', dangerous: true },
  { method: 'DELETE', path: '/api/strava/webhook-subscription', category: 'strava', description: 'Delete webhook subscription', testable: false, auth: 'admin', dangerous: true },
  { method: 'GET', path: '/api/strava/webhook-status', category: 'strava', description: 'Check webhook status', testable: true, auth: 'admin' },
  { method: 'POST', path: '/api/strava/test-match', category: 'strava', description: 'Test Strava matching', testable: false, auth: 'admin' },

  // ── Webhooks ──
  { method: 'GET', path: '/api/webhooks/strava', category: 'webhooks', description: 'Strava webhook verification', testable: false, auth: 'public' },
  { method: 'POST', path: '/api/webhooks/strava', category: 'webhooks', description: 'Strava webhook event receiver', testable: false, auth: 'public' },

  // ── Workouts ──
  { method: 'GET', path: '/api/workouts', category: 'workouts', description: 'List workouts', testable: false, auth: 'user', params: '?username=...' },
  { method: 'POST', path: '/api/workouts', category: 'workouts', description: 'Create workout', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/workouts/[id]', category: 'workouts', description: 'Get workout detail', testable: false, auth: 'user' },
  { method: 'PUT', path: '/api/workouts/[id]', category: 'workouts', description: 'Update workout', testable: false, auth: 'user' },
  { method: 'DELETE', path: '/api/workouts/[id]', category: 'workouts', description: 'Delete workout', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/workouts/import', category: 'workouts', description: 'Import workouts (CSV/XLSX)', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/workouts/merge', category: 'workouts', description: 'Merge imported + Strava', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/workouts/auto-dedup', category: 'workouts', description: 'Auto-deduplicate workouts', testable: false, auth: 'user', dangerous: true },
  { method: 'POST', path: '/api/workouts/fix-timezone', category: 'workouts', description: 'Fix timezone issues', testable: false, auth: 'admin', dangerous: true },

  // ── Import ──
  { method: 'POST', path: '/api/import/analyze', category: 'import', description: 'Analyze CSV/XLSX file', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/import/confirm', category: 'import', description: 'Confirm import', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/import/remap', category: 'import', description: 'Remap import columns', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/import/format-description', category: 'import', description: 'Format workout descriptions', testable: false, auth: 'user' },

  // ── Templates ──
  { method: 'GET', path: '/api/templates', category: 'templates', description: 'List templates', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/templates', category: 'templates', description: 'Create template', testable: false, auth: 'user' },
  { method: 'GET', path: '/api/templates/[id]', category: 'templates', description: 'Get template', testable: false, auth: 'user' },
  { method: 'DELETE', path: '/api/templates/[id]', category: 'templates', description: 'Delete template', testable: false, auth: 'user' },

  // ── Email ──
  { method: 'POST', path: '/api/send-workout-email', category: 'email', description: 'Send workout email', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/send-reset-email', category: 'email', description: 'Send password reset email', testable: false, auth: 'public' },
  { method: 'POST', path: '/api/reset-password', category: 'email', description: 'Reset password', testable: false, auth: 'public' },
  { method: 'POST', path: '/api/notifications/workout-comment', category: 'email', description: 'Workout comment notification', testable: false, auth: 'user' },

  // ── Reports ──
  { method: 'POST', path: '/api/reports/send', category: 'reports', description: 'Send report', testable: false, auth: 'user' },
  { method: 'POST', path: '/api/reports/email', category: 'reports', description: 'Email report', testable: false, auth: 'user' },

  // ── Export ──
  { method: 'GET', path: '/api/export/workouts', category: 'export', description: 'Export workouts', testable: false, auth: 'user', params: '?username=...' },

  // ── Push ──
  { method: 'POST', path: '/api/push/subscribe', category: 'push', description: 'Subscribe to push notifications', testable: false, auth: 'user' },
  { method: 'DELETE', path: '/api/push/subscribe', category: 'push', description: 'Unsubscribe from push', testable: false, auth: 'user' },

  // ── Other ──
  { method: 'GET', path: '/api/health', category: 'other', description: 'Health check', testable: true, auth: 'public' },
  { method: 'GET', path: '/api/mcp', category: 'other', description: 'MCP endpoint', testable: true, auth: 'public' },
  { method: 'GET', path: '/api/debug/list-users', category: 'other', description: 'Debug: list all users', testable: true, auth: 'public' },
  { method: 'GET', path: '/api/test-brevo', category: 'other', description: 'Test Brevo email (sends real email!)', testable: false, auth: 'public', dangerous: true },
  { method: 'GET', path: '/api/test-strava', category: 'other', description: 'Test Strava config', testable: true, auth: 'public' },
  { method: 'GET', path: '/api/test/strava-sim', category: 'other', description: 'Strava simulator', testable: true, auth: 'public' },
];

export function getEndpointsByCategory(): Record<string, ApiEndpoint[]> {
  const grouped: Record<string, ApiEndpoint[]> = {};
  for (const cat of API_CATEGORIES) {
    grouped[cat.id] = API_REGISTRY.filter(e => e.category === cat.id);
  }
  return grouped;
}
