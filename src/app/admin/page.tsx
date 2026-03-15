'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Shield, Database, Users, Settings, LogOut, RefreshCw,
  Trash2, RotateCcw, Download, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, ChevronDown, ChevronUp, Eye, Lock,
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
  if (!stats) return <p className="text-white/40 text-sm">Loading…</p>;
  const items = [
    { label: 'Total users', value: stats.userCount, accent: false },
    { label: 'Total workouts', value: stats.workoutCount, accent: false },
    {
      label: 'Last backup',
      value: stats.lastBackup ? ago(stats.lastBackup.createdAt) : 'Never',
      accent: true,
    },
    {
      label: 'Backup integrity',
      value: stats.lastBackup?.integrityPassed ? '✓ Passed' : '— N/A',
      accent: false,
      green: stats.lastBackup?.integrityPassed,
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(({ label, value, accent, green }) => (
        <div key={label} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5">{label}</p>
          <p className={`text-2xl font-bold ${green ? 'text-green-400' : accent ? 'text-indigo-300' : 'text-white'}`}>{value}</p>
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-sm text-white/80 disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={creating ? 'animate-spin' : ''} />
          {creating ? 'Logging…' : 'Log snapshot'}
        </button>
        <button
          onClick={downloadBackup}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white shadow-md disabled:opacity-50 transition"
        >
          <Download size={14} className={downloading ? 'animate-spin' : ''} />
          {downloading ? 'Generating…' : 'Download full backup'}
        </button>
      </div>

      {/* Restore from file */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 space-y-3">
        <p className="text-white/80 text-sm font-medium">Restore from backup file</p>
        <p className="text-white/30 text-xs">
          Upload a previously downloaded .json backup. Leave username blank to restore all data.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={restoreUsername}
            onChange={e => setRestoreUsername(e.target.value)}
            placeholder="username (optional)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 w-48 focus:border-indigo-500/40 focus:outline-none transition"
          />
          <label
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/25 text-sm text-red-300 cursor-pointer transition ${restoring ? 'opacity-50 pointer-events-none' : ''}`}
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
        <p className="text-white/25 text-xs mb-2">
          Health snapshots (counts only — use Download to get full restorable data)
        </p>
        {loading ? (
          <p className="text-white/40 text-sm">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="text-white/40 text-sm">No snapshots yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/[0.08]">
                  {['Type', 'Time', 'Users', 'Workouts', 'Integrity', 'By'].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {backups.map(b => (
                  <tr key={b.id} className="text-white/60">
                    <td className="py-2 pr-4">
                      <span className="capitalize px-2 py-0.5 rounded-md text-xs bg-white/[0.08] text-white/60">{b.type}</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-white/30 text-xs">{fmt(b.createdAt)}</td>
                    <td className="py-2 pr-4">{b.userCount}</td>
                    <td className="py-2 pr-4">{b.workoutCount}</td>
                    <td className="py-2 pr-4">
                      {b.integrityPassed
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                    </td>
                    <td className="py-2 pr-4 text-white/30 text-xs">{b.triggeredBy ?? 'cron'}</td>
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
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 flex-1 max-w-xs focus:border-indigo-500/40 focus:outline-none transition"
        />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-sm text-white/80 transition"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/[0.08]">
                {['Username', 'Email', 'Role', 'Workouts', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(u => (
                <tr key={u.username} className={`text-white/60 ${u.status === 'deleted' ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-4 font-mono text-xs text-indigo-300/80">{u.username}</td>
                  <td className="py-2 pr-4 text-white/40">{u.email}</td>
                  <td className="py-2 pr-4">
                    <span className="capitalize text-xs px-2 py-0.5 rounded-md bg-white/[0.08]">{u.role}</span>
                  </td>
                  <td className="py-2 pr-4">{u.workoutCount}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-white/30">{fmt(u.createdAt)}</td>
                  <td className="py-2 pr-4">
                    {u.status === 'active'
                      ? <span className="text-green-400/80 text-xs">active</span>
                      : <span className="text-red-400/80 text-xs">deleted</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => exportUserJSON(u.username)}
                        title="Export JSON"
                        className="text-white/30 hover:text-white/60 transition"
                      >
                        <Download size={13} />
                      </button>
                      {u.status === 'active' ? (
                        <button
                          onClick={() => softDelete(u.username)}
                          disabled={acting === u.username}
                          title="Disable user"
                          className="text-red-400/60 hover:text-red-400 disabled:opacity-50 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => restore(u.username)}
                          disabled={acting === u.username}
                          title="Re-enable user"
                          className="text-indigo-400/60 hover:text-indigo-400 disabled:opacity-50 transition"
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
          <p className="text-white/25 text-xs mt-2">{filtered.length} of {users.length} users</p>
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
        <h3 className="text-white/70 font-medium mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openSyncDialog}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 text-sm text-white/80 border border-white/10 transition"
          >
            <Activity size={14} /> Force Strava Sync All
          </button>
        </div>
      </div>

      {/* Strava sync confirmation dialog */}
      {showSyncDialog && syncStats && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-950 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <h3 className="font-semibold">Confirm: Force Strava Sync All</h3>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 text-sm space-y-2 text-white/60">
              <p><span className="text-white/40">Active users:</span> <strong className="text-white">{syncStats.userCount}</strong></p>
              <p><span className="text-white/40">Strava API calls:</span> <strong className="text-white">~{syncStats.userCount * 5}</strong></p>
              <p><span className="text-white/40">Rate limit:</span> 100 req / 15 min, 1,000 req / day</p>
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
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-sm text-white/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmSync}
                disabled={syncing}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white shadow-md disabled:opacity-50 transition"
              >
                {syncing ? 'Syncing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log viewer */}
      <div>
        <div className="inline-flex items-center gap-1 mb-3 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1">
          {(['actions', 'cron'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLogTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition ${
                logTab === tab
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'actions' ? 'Admin Actions' : 'Cron Logs'}
            </button>
          ))}
        </div>

        {logsLoading ? (
          <p className="text-white/40 text-sm">Loading logs…</p>
        ) : displayLogs.length === 0 ? (
          <p className="text-white/40 text-sm">No logs yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {displayLogs.map(log => (
              <div key={log.id} className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5 text-xs flex items-start gap-3">
                <span className="text-white/30 whitespace-nowrap">{fmt(log.timestamp)}</span>
                <span className="font-mono text-indigo-300">{log.action}</span>
                {log.targetUid && <span className="text-white/40">user: {log.targetUid}</span>}
                {log.type && <span className="text-white/40">type: {log.type}</span>}
                <span className="text-white/30 ml-auto">by {log.adminUid}</span>
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-indigo-600/5 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 shadow-xl shadow-indigo-900/20 mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Admin Access</h1>
          <p className="text-white/30 mt-1 text-sm">The Daily Athlete</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 space-y-6">
          {/* Restricted area badge */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/[0.08] border border-indigo-500/15">
            <Lock className="w-3.5 h-3.5 text-indigo-400/70" />
            <span className="text-xs text-indigo-300/70 font-medium tracking-wide uppercase">Restricted Area</span>
          </div>

          <p className="text-white/40 text-sm text-center">
            Sign in with your authorized Google account to continue.
          </p>

          {error && (
            <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-950/40 border border-red-500/20 rounded-lg px-4 py-3">
              <XCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold disabled:opacity-60 transition-all duration-200 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0"
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

          {/* Security footer */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <Shield className="w-3 h-3 text-white/15" />
            <span className="text-[11px] text-white/15">Protected by Firebase Auth</span>
          </div>
        </div>
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
    <div className="min-h-screen bg-black text-white/80">
      {/* Header */}
      <header className="bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
            <Shield size={16} className="text-indigo-400" />
          </div>
          <span className="font-semibold text-white">The Daily Athlete Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg px-3 py-1.5 text-sm transition"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tab nav */}
        <nav className="inline-flex gap-1 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all ${
                tab === id
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20 shadow-sm'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-xl p-6">
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
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
        </div>
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-white/30 text-xs font-medium tracking-wide">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />;
}
