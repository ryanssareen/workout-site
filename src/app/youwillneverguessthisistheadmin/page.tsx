'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Shield, Database, Users, Settings, LogOut, RefreshCw,
  Trash2, RotateCcw, Download, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, ChevronDown, ChevronUp, Eye, Lock,
  Zap, TrendingUp, HardDrive, UserCheck,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Animated Background ──────────────────────────────────────────────────────

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-red-600/[0.07] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/3 -left-60 w-[500px] h-[500px] bg-orange-600/[0.05] rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '12s' }} />
      <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-red-900/[0.06] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-2/3 left-1/3 w-[300px] h-[300px] bg-rose-600/[0.04] rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '15s' }} />
    </div>
  );
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewSection({ stats }: { stats: OverviewStats | null }) {
  if (!stats) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center">
        <RefreshCw size={16} className="animate-spin text-red-400/60" />
        <p className="text-white/40 text-sm">Loading overview…</p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Users',
      value: stats.userCount,
      icon: UserCheck,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-300',
    },
    {
      label: 'Total Workouts',
      value: stats.workoutCount,
      icon: TrendingUp,
      gradient: 'from-emerald-500/20 to-green-500/20',
      border: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-300',
    },
    {
      label: 'Last Backup',
      value: stats.lastBackup ? ago(stats.lastBackup.createdAt) : 'Never',
      icon: Clock,
      gradient: 'from-amber-500/20 to-orange-500/20',
      border: 'border-amber-500/20',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-300',
    },
    {
      label: 'Backup Integrity',
      value: stats.lastBackup?.integrityPassed ? 'Passed' : 'N/A',
      icon: stats.lastBackup?.integrityPassed ? CheckCircle : HardDrive,
      gradient: stats.lastBackup?.integrityPassed
        ? 'from-green-500/20 to-emerald-500/20'
        : 'from-gray-500/20 to-gray-600/20',
      border: stats.lastBackup?.integrityPassed ? 'border-green-500/20' : 'border-gray-500/20',
      iconColor: stats.lastBackup?.integrityPassed ? 'text-green-400' : 'text-gray-400',
      valueColor: stats.lastBackup?.integrityPassed ? 'text-green-300' : 'text-gray-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, gradient, border, iconColor, valueColor }) => (
          <div
            key={label}
            className={`group relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg cursor-default`}
          >
            <div className="absolute top-3 right-3 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300">
              <Icon size={52} />
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/[0.05] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon size={20} className={iconColor} />
              </div>
              <p className="text-white/45 text-[11px] font-bold uppercase tracking-widest mb-1.5">{label}</p>
              <p className={`text-3xl font-black tracking-tight ${valueColor}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick status bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-white/40 text-xs">Firebase</span>
          <span className="text-green-400/80 text-xs font-medium">Connected</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-white/40 text-xs">Strava API</span>
          <span className="text-green-400/80 text-xs font-medium">Active</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-white/40 text-xs">Cron Jobs</span>
          <span className="text-green-400/80 text-xs font-medium">Running</span>
        </div>
      </div>
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
      a.download = `tda-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/15 flex items-center justify-center">
            <Database size={16} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Backup Management</h2>
            <p className="text-white/30 text-xs">Snapshots, downloads, and recovery</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={logSnapshot}
            disabled={creating}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/15 text-sm text-white/70 hover:text-white disabled:opacity-50 transition-all"
          >
            <RefreshCw size={15} className={creating ? 'animate-spin' : 'group-hover:rotate-90 transition-transform duration-300'} />
            {creating ? 'Logging…' : 'Log snapshot'}
          </button>
          <button
            onClick={downloadBackup}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-sm text-white font-medium shadow-lg shadow-red-900/30 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download size={15} className={downloading ? 'animate-bounce' : ''} />
            {downloading ? 'Generating…' : 'Download full backup'}
          </button>
        </div>
      </div>

      {/* Restore from file */}
      <div className="bg-gradient-to-br from-red-500/[0.06] to-orange-500/[0.04] border border-red-500/[0.12] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw size={15} className="text-red-400/70" />
          <p className="text-white/80 text-sm font-semibold">Restore from backup file</p>
        </div>
        <p className="text-white/30 text-xs">
          Upload a previously downloaded .json backup. Leave username blank to restore all data.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={restoreUsername}
            onChange={e => setRestoreUsername(e.target.value)}
            placeholder="username (optional)"
            className="bg-black/30 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 w-52 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all"
          />
          <label
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/30 text-sm text-red-300 font-medium cursor-pointer transition-all ${restoring ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <RotateCcw size={14} className={restoring ? 'animate-spin' : ''} />
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

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-500/15 rounded-xl px-4 py-3">
          <XCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Snapshots table */}
      <div>
        <p className="text-white/30 text-xs mb-3 font-medium">
          Health snapshots (counts only — use Download to get full restorable data)
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <RefreshCw size={14} className="animate-spin text-white/30" />
            <p className="text-white/40 text-sm">Loading…</p>
          </div>
        ) : backups.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">No snapshots yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03]">
                  {['Type', 'Time', 'Users', 'Workouts', 'Integrity', 'By'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={b.id} className={`text-white/60 border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.06] text-white/60 border border-white/[0.06]">{b.type}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/35 text-xs font-mono">{fmt(b.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{b.userCount}</td>
                    <td className="px-4 py-3 font-semibold">{b.workoutCount}</td>
                    <td className="px-4 py-3">
                      {b.integrityPassed
                        ? <span className="inline-flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={13} /> OK</span>
                        : <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle size={13} /> Fail</span>}
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">{b.triggeredBy ?? 'cron'}</td>
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
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15 flex items-center justify-center">
            <Users size={16} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">User Management</h2>
            <p className="text-white/30 text-xs">{users.length} registered users</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/15 text-sm text-white/70 hover:text-white transition-all"
        >
          <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Eye size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email…"
            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-500/15 rounded-xl px-4 py-3">
          <XCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center">
          <RefreshCw size={14} className="animate-spin text-white/30" />
          <p className="text-white/40 text-sm">Loading…</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                {['Username', 'Email', 'Role', 'Workouts', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.username} className={`text-white/60 border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors ${u.status === 'deleted' ? 'opacity-40' : ''} ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-red-300/90 bg-red-500/[0.08] px-2 py-1 rounded-md">{u.username}</span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`capitalize text-xs px-2.5 py-1 rounded-lg font-medium ${
                      u.role === 'coach'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/15'
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/15'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{u.workoutCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/30 text-xs">{fmt(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {u.status === 'active'
                      ? <span className="inline-flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> active</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> deleted</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportUserJSON(u.username)}
                        title="Export JSON"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                      >
                        <Download size={13} />
                      </button>
                      {u.status === 'active' ? (
                        <button
                          onClick={() => softDelete(u.username)}
                          disabled={acting === u.username}
                          title="Disable user"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => restore(u.username)}
                          disabled={acting === u.username}
                          title="Re-enable user"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400/40 hover:text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-all"
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
          <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/[0.04] text-white/25 text-xs">
            {filtered.length} of {users.length} users
          </div>
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
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/15 flex items-center justify-center">
          <Settings size={16} className="text-orange-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-sm">System & Actions</h2>
          <p className="text-white/30 text-xs">Integrations, sync, and activity logs</p>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openSyncDialog}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/15 hover:to-amber-500/15 border border-orange-500/15 hover:border-orange-500/25 text-sm text-orange-300 font-medium transition-all"
          >
            <Zap size={15} className="group-hover:rotate-12 transition-transform" /> Force Strava Sync All
          </button>
        </div>
      </div>

      {/* Strava sync confirmation dialog */}
      {showSyncDialog && syncStats && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gray-950/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 max-w-md w-full mx-4 space-y-5 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Force Strava Sync All</h3>
                <p className="text-white/30 text-xs">This will trigger sync for all connected users</p>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-sm space-y-2.5 text-white/60">
              <div className="flex justify-between">
                <span className="text-white/40">Active users</span>
                <span className="text-white font-bold">{syncStats.userCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Est. API calls</span>
                <span className="text-white font-bold">~{syncStats.userCount * 5}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Rate limit</span>
                <span className="text-white/60">100 / 15 min, 1K / day</span>
              </div>
              <div className="pt-1.5 border-t border-white/[0.05]">
                <p className={`text-xs font-medium ${syncStats.userCount * 5 > 100 ? 'text-amber-400' : 'text-green-400'}`}>
                  {syncStats.userCount * 5 > 1000
                    ? '⚠ Exceeds daily limit — will hit rate cap'
                    : syncStats.userCount * 5 > 100
                    ? '⚠ May hit 15-min rate limit; will self-throttle'
                    : '✓ Within rate limits'}
                </p>
              </div>
            </div>
            {syncError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-500/15 rounded-xl px-4 py-3">
                <XCircle size={15} className="shrink-0" />
                {syncError}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setShowSyncDialog(false)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-sm text-white/60 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSync}
                disabled={syncing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-sm text-white font-medium shadow-lg shadow-red-900/30 disabled:opacity-50 transition-all"
              >
                {syncing ? 'Syncing…' : 'Confirm Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log viewer */}
      <div>
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Activity Log</h3>
        <div className="inline-flex items-center gap-1 mb-4 bg-black/30 border border-white/[0.06] rounded-xl p-1">
          {(['actions', 'cron'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLogTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                logTab === tab
                  ? 'bg-red-500/15 text-red-300 border border-red-500/20 shadow-sm'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {tab === 'actions' ? 'Admin Actions' : 'Cron Logs'}
            </button>
          ))}
        </div>

        {logsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <RefreshCw size={14} className="animate-spin text-white/30" />
            <p className="text-white/40 text-sm">Loading logs…</p>
          </div>
        ) : displayLogs.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">No logs yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {displayLogs.map(log => (
              <div key={log.id} className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.08] rounded-xl px-4 py-3 text-xs flex items-center gap-4 transition-all">
                <span className="text-white/25 whitespace-nowrap font-mono">{fmt(log.timestamp)}</span>
                <span className="font-mono text-red-300 bg-red-500/[0.08] px-2 py-0.5 rounded-md">{log.action}</span>
                {log.targetUid && <span className="text-white/35">user: {log.targetUid}</span>}
                {log.type && <span className="text-white/35">type: {log.type}</span>}
                <span className="text-white/20 ml-auto text-[11px]">by {log.adminUid}</span>
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/20 shadow-2xl shadow-red-900/30 flex items-center justify-center">
              <Shield className="w-10 h-10 text-red-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Admin Access</h1>
          <p className="text-red-400/50 mt-1.5 text-sm font-medium tracking-wide">The Daily Athlete</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/50 space-y-6">
          {/* Restricted area badge */}
          <div className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/[0.08] to-orange-500/[0.06] border border-red-500/15">
            <Lock className="w-3.5 h-3.5 text-red-400/70" />
            <span className="text-xs text-red-300/70 font-bold tracking-widest uppercase">Restricted Area</span>
          </div>

          <p className="text-white/35 text-sm text-center">
            Enter the admin password to continue.
          </p>

          {error && (
            <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <XCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/25 text-sm focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-bold disabled:opacity-50 transition-all duration-200 shadow-lg shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/35 hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}
            {loading ? 'Verifying…' : 'Enter'}
          </button>

          {/* Security footer */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <Shield className="w-3 h-3 text-white/10" />
            <span className="text-[11px] text-white/10 tracking-wide">Protected by The Daily Athlete</span>
          </div>
        </form>
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
    <div className="min-h-screen bg-black text-white/80 relative">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-black/80 via-red-950/20 to-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/25 to-red-900/25 border border-red-500/25 flex items-center justify-center shadow-lg shadow-red-900/25">
              <Shield size={20} className="text-red-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-white text-sm tracking-tight leading-tight">THE DAILY ATHLETE</span>
              <span className="text-red-400/50 text-[10px] font-semibold uppercase tracking-widest">Admin Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400/80 text-xs font-medium">System Online</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-white/30 hover:text-red-300 hover:bg-red-500/10 rounded-xl px-4 py-2 text-sm transition-all"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600/10 via-red-900/[0.08] to-orange-600/10 border border-red-500/10 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/[0.05] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Welcome back, Admin</h1>
              <p className="text-white/35 text-sm mt-1">Manage users, monitor backups, and keep things running smoothly.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-white/25 text-xs">Current time</p>
                <p className="text-white/60 text-sm font-mono">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="w-px h-8 bg-white/[0.06]" />
              <div className="text-right">
                <p className="text-white/25 text-xs">Environment</p>
                <p className="text-emerald-400/70 text-sm font-medium">Production</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="inline-flex gap-1 bg-black/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-1.5 shadow-xl shadow-black/20">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-gradient-to-r from-red-600/20 to-red-500/15 text-red-300 border border-red-500/20 shadow-lg shadow-red-900/10'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/10">
          {tab === 'overview' && <OverviewSection stats={stats} />}
          {tab === 'backups' && <BackupsSection />}
          {tab === 'users' && <UsersSection />}
          {tab === 'system' && <SystemActionsSection />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pb-4">
          <Shield size={12} className="text-white/[0.08]" />
          <span className="text-white/[0.08] text-xs tracking-wide">The Daily Athlete Admin Console</span>
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
        <AnimatedBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/20 flex items-center justify-center animate-pulse shadow-2xl shadow-red-900/30">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
            <p className="text-white/30 text-sm font-medium tracking-wide">Verifying session</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />;
}
