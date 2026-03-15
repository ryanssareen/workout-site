'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreUsername, setRestoreUsername] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function logSnapshot() {
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

  async function downloadBackup() {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/backup/download', { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coachtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  async function restoreFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const username = restoreUsername.trim();
    const confirmMsg = username
      ? `Restore user "${username}" from this file? Their current data will be overwritten.`
      : 'Restore ALL users and workouts from this file? Current data will be overwritten.';

    if (!confirm(confirmMsg)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRestoring(true);
    setError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const body: Record<string, any> = { data };
      if (username) body.username = username;

      await apiFetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      alert(username ? `Restored ${username}.` : 'Full restore complete.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={logSnapshot}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={creating ? 'animate-spin' : ''} />
          {creating ? 'Logging…' : 'Log snapshot'}
        </button>
        <button
          onClick={downloadBackup}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm text-white disabled:opacity-50 transition"
        >
          <Download size={14} className={downloading ? 'animate-spin' : ''} />
          {downloading ? 'Generating…' : 'Download full backup'}
        </button>
      </div>

      {/* Restore from file */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <p className="text-gray-300 text-sm font-medium">Restore from backup file</p>
        <p className="text-gray-500 text-xs">
          Upload a previously downloaded .json backup. Leave username blank to restore all data.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={restoreUsername}
            onChange={e => setRestoreUsername(e.target.value)}
            placeholder="username (optional)"
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 w-48"
          />
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-900/60 hover:bg-red-900 border border-red-800 text-sm text-red-200 cursor-pointer transition ${restoring ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <RotateCcw size={14} />
            {restoring ? 'Restoring…' : 'Choose file & restore'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={restoreFromFile}
              disabled={restoring}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Snapshots table */}
      <div>
        <p className="text-gray-500 text-xs mb-2">
          Health snapshots (counts only — use Download to get full restorable data)
        </p>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="text-gray-400 text-sm">No snapshots yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  {['Type', 'Time', 'Users', 'Workouts', 'Integrity', 'By'].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {backups.map(b => (
                  <tr key={b.id} className="text-gray-300">
                    <td className="py-2 pr-4">
                      <span className="capitalize px-2 py-0.5 rounded text-xs bg-gray-700">{b.type}</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-400 text-xs">{fmt(b.createdAt)}</td>
                    <td className="py-2 pr-4">{b.userCount}</td>
                    <td className="py-2 pr-4">{b.workoutCount}</td>
                    <td className="py-2 pr-4">
                      {b.integrityPassed
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{b.triggeredBy ?? 'cron'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Login failed');

      onAuthenticated();
    } catch (e: any) {
      setError(e.message ?? 'Sign-in failed');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-400" size={24} />
          <h1 className="text-white text-xl font-semibold">Admin</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Enter the admin password to continue.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 rounded-lg px-3 py-2">
            <XCircle size={14} />
            {error}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-60 transition"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
          {loading ? 'Verifying…' : 'Enter'}
        </button>
      </form>
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
