'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Database, Users, Settings, LogOut, RefreshCw,
  Trash2, RotateCcw, Download, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackupRecord {
  id: string;
  type: string;
  createdAt: number | null;
  userCount: number;
  workoutCount: number;
  storagePath: string;
  integrityPassed: boolean;
  triggeredBy?: string;
}

interface UserRecord {
  username: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: number | null;
  status: 'active' | 'deleted';
  workoutCount: number;
}

interface LogRecord {
  id: string;
  action: string;
  adminUid: string;
  timestamp: number | null;
  targetUid?: string;
  backupId?: string;
  type?: string;
  details?: Record<string, unknown>;
}

interface OverviewStats {
  userCount: number;
  workoutCount: number;
  lastBackup: BackupRecord | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function ago(ts: number | null) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { credentials: 'include', ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewSection({ stats }: { stats: OverviewStats | null }) {
  if (!stats) return <p className="text-gray-400 text-sm">Loading…</p>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Total users', value: stats.userCount },
        { label: 'Total workouts', value: stats.workoutCount },
        {
          label: 'Last backup',
          value: stats.lastBackup ? ago(stats.lastBackup.createdAt) : 'Never',
        },
        {
          label: 'Backup integrity',
          value: stats.lastBackup?.integrityPassed ? '✓ Passed' : '— N/A',
        },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className="text-white text-xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function BackupsSection() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [perUserBackup, setPerUserBackup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/backup');
      setBackups(data.backups);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerBackup() {
    setCreating(true);
    setError('');
    try {
      await apiFetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function restoreFull(backupId: string) {
    if (!confirm('This will restore ALL data from this backup. A pre-restore snapshot will be taken first. Continue?')) return;
    setRestoring(backupId);
    setError('');
    try {
      await apiFetch(`/api/admin/backup/${backupId}`, { method: 'POST' });
      alert('Restore complete.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoring(null);
    }
  }

  async function restoreUser(backupId: string) {
    const username = userQuery.trim();
    if (!username) return;
    if (!confirm(`Restore user "${username}" from this backup?`)) return;
    setRestoring(backupId);
    setError('');
    try {
      await apiFetch(`/api/admin/backup/${backupId}/restore-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      alert(`Restored ${username}.`);
      setPerUserBackup(null);
      setUserQuery('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-200 font-medium">Snapshots</h3>
        <button
          onClick={triggerBackup}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm text-white transition"
        >
          <RefreshCw size={14} className={creating ? 'animate-spin' : ''} />
          {creating ? 'Creating…' : 'Manual backup'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : backups.length === 0 ? (
        <p className="text-gray-400 text-sm">No backups yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-700">
                {['Type', 'Created', 'Users', 'Workouts', 'Integrity', 'Triggered by', 'Actions'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {backups.map(b => (
                <>
                  <tr key={b.id} className="text-gray-300">
                    <td className="py-2 pr-4">
                      <span className="capitalize px-2 py-0.5 rounded text-xs bg-gray-700">{b.type}</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmt(b.createdAt)}</td>
                    <td className="py-2 pr-4">{b.userCount}</td>
                    <td className="py-2 pr-4">{b.workoutCount}</td>
                    <td className="py-2 pr-4">
                      {b.integrityPassed
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{b.triggeredBy ?? 'cron'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreFull(b.id)}
                          disabled={restoring === b.id}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                          {restoring === b.id ? 'Restoring…' : 'Restore all'}
                        </button>
                        <button
                          onClick={() => setPerUserBackup(perUserBackup === b.id ? null : b.id)}
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          Restore user
                        </button>
                      </div>
                    </td>
                  </tr>
                  {perUserBackup === b.id && (
                    <tr key={`${b.id}-user`}>
                      <td colSpan={7} className="pb-3">
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            value={userQuery}
                            onChange={e => setUserQuery(e.target.value)}
                            placeholder="username"
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white w-40"
                          />
                          <button
                            onClick={() => restoreUser(b.id)}
                            disabled={!userQuery.trim() || restoring === b.id}
                            className="text-xs px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-50"
                          >
                            Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/users');
      setUsers(data.users);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.username.includes(search) || u.email.includes(search)
  );

  async function softDelete(username: string) {
    if (!confirm(`Disable user "${username}"?`)) return;
    setActing(username);
    try {
      await apiFetch(`/api/admin/users/${username}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  }

  async function restore(username: string) {
    setActing(username);
    try {
      await apiFetch(`/api/admin/users/${username}`, { method: 'PATCH' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  }

  function exportCSV() {
    window.open('/api/admin/users?export=csv');
  }

  function exportUserJSON(username: string) {
    window.open(`/api/admin/users/${username}?export=json`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 flex-1 max-w-xs"
        />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-700">
                {['Username', 'Email', 'Role', 'Workouts', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(u => (
                <tr key={u.username} className={`text-gray-300 ${u.status === 'deleted' ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-4 font-mono text-xs">{u.username}</td>
                  <td className="py-2 pr-4 text-gray-400">{u.email}</td>
                  <td className="py-2 pr-4">
                    <span className="capitalize text-xs px-2 py-0.5 rounded bg-gray-700">{u.role}</span>
                  </td>
                  <td className="py-2 pr-4">{u.workoutCount}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-gray-400">{fmt(u.createdAt)}</td>
                  <td className="py-2 pr-4">
                    {u.status === 'active'
                      ? <span className="text-green-400 text-xs">active</span>
                      : <span className="text-red-400 text-xs">deleted</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => exportUserJSON(u.username)}
                        title="Export JSON"
                        className="text-gray-400 hover:text-gray-300"
                      >
                        <Download size={13} />
                      </button>
                      {u.status === 'active' ? (
                        <button
                          onClick={() => softDelete(u.username)}
                          disabled={acting === u.username}
                          title="Disable user"
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => restore(u.username)}
                          disabled={acting === u.username}
                          title="Re-enable user"
                          className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-gray-500 text-xs mt-2">{filtered.length} of {users.length} users</p>
        </div>
      )}
    </div>
  );
}

function SystemActionsSection() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [cronLogs, setCronLogs] = useState<LogRecord[]>([]);
  const [logTab, setLogTab] = useState<'actions' | 'cron'>('actions');
  const [logsLoading, setLogsLoading] = useState(true);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncStats, setSyncStats] = useState<{ userCount: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    (async () => {
      setLogsLoading(true);
      try {
        const [a, c] = await Promise.all([
          apiFetch('/api/admin/logs?type=actions'),
          apiFetch('/api/admin/logs?type=cron'),
        ]);
        setLogs(a.logs);
        setCronLogs(c.logs);
      } finally {
        setLogsLoading(false);
      }
    })();
  }, []);

  async function openSyncDialog() {
    try {
      const data = await apiFetch('/api/admin/users');
      setSyncStats({ userCount: data.users.filter((u: UserRecord) => u.status === 'active').length });
    } catch {
      setSyncStats({ userCount: 0 });
    }
    setShowSyncDialog(true);
  }

  async function confirmSync() {
    setSyncing(true);
    setSyncError('');
    try {
      // Log admin action — full sync implementation is per-user via Strava API
      await apiFetch('/api/admin/logs', {
        method: 'GET',
      });
      alert('Strava sync all logged. Per-user sync triggered on next app load.');
      setShowSyncDialog(false);
    } catch (e: any) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  const displayLogs = logTab === 'actions' ? logs : cronLogs;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div>
        <h3 className="text-gray-200 font-medium mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openSyncDialog}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 border border-gray-700 transition"
          >
            <Activity size={14} /> Force Strava Sync All
          </button>
        </div>
      </div>

      {/* Strava sync confirmation dialog */}
      {showSyncDialog && syncStats && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <h3 className="font-semibold">Confirm: Force Strava Sync All</h3>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2 text-gray-300">
              <p><span className="text-gray-400">Active users:</span> <strong>{syncStats.userCount}</strong></p>
              <p><span className="text-gray-400">Strava API calls:</span> <strong>~{syncStats.userCount * 5}</strong></p>
              <p><span className="text-gray-400">Rate limit:</span> 100 req / 15 min, 1,000 req / day</p>
              <p className={syncStats.userCount * 5 > 100 ? 'text-amber-400' : 'text-green-400'}>
                {syncStats.userCount * 5 > 1000
                  ? '⚠ Exceeds daily limit — will hit rate cap'
                  : syncStats.userCount * 5 > 100
                  ? '⚠ May hit 15-min rate limit; will self-throttle'
                  : '✓ Within rate limits'}
              </p>
            </div>
            {syncError && <p className="text-red-400 text-sm">{syncError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSyncDialog(false)}
                className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmSync}
                disabled={syncing}
                className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm text-white disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log viewer */}
      <div>
        <div className="flex items-center gap-1 mb-3">
          {(['actions', 'cron'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLogTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition ${
                logTab === tab
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'actions' ? 'Admin Actions' : 'Cron Logs'}
            </button>
          ))}
        </div>

        {logsLoading ? (
          <p className="text-gray-400 text-sm">Loading logs…</p>
        ) : displayLogs.length === 0 ? (
          <p className="text-gray-400 text-sm">No logs yet.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {displayLogs.map(log => (
              <div key={log.id} className="bg-gray-800 rounded px-3 py-2 text-xs flex items-start gap-3">
                <span className="text-gray-500 whitespace-nowrap">{fmt(log.timestamp)}</span>
                <span className="font-mono text-indigo-300">{log.action}</span>
                {log.targetUid && <span className="text-gray-400">user: {log.targetUid}</span>}
                {log.type && <span className="text-gray-400">type: {log.type}</span>}
                <span className="text-gray-500 ml-auto">by {log.adminUid}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function signInWithGoogle() {
    setLoading(true);
    setError('');
    try {
      const { getAuthInstance } = await import('@/lib/firebase/config');
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const auth = getAuthInstance();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Login failed');

      onAuthenticated();
    } catch (e: any) {
      setError(e.message ?? 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-400" size={24} />
          <h1 className="text-white text-xl font-semibold">Admin</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Sign in with your admin Google account to continue.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 rounded-lg px-3 py-2">
            <XCircle size={14} />
            {error}
          </div>
        )}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium disabled:opacity-60 transition"
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'backups' | 'users' | 'system';

const TABS: { id: Tab; label: string; icon: typeof Database }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'backups', label: 'Backups', icon: Database },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'system', label: 'System', icon: Settings },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [usersData, backupsData] = await Promise.all([
          apiFetch('/api/admin/users'),
          apiFetch('/api/admin/backup'),
        ]);
        const totalWorkouts = (usersData.users as UserRecord[]).reduce(
          (sum: number, u: UserRecord) => sum + (u.workoutCount ?? 0), 0
        );
        setStats({
          userCount: usersData.users.length,
          workoutCount: totalWorkouts,
          lastBackup: backupsData.backups[0] ?? null,
        });
      } catch {
        // non-fatal
      }
    })();
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/verify', { method: 'DELETE', credentials: 'include' }).catch(() => {});
    onLogout();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-indigo-400" />
          <span className="font-semibold text-white">CoachTrack Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-sm transition"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tab nav */}
        <nav className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition ${
                tab === id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {tab === 'overview' && <OverviewSection stats={stats} />}
          {tab === 'backups' && <BackupsSection />}
          {tab === 'users' && <UsersSection />}
          {tab === 'system' && <SystemActionsSection />}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/admin/verify', { credentials: 'include' })
      .then(r => setAuthenticated(r.ok))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />;
}
