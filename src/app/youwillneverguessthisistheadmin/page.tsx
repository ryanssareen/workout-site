'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Shield, Database, Users, Settings, LogOut, RefreshCw,
  Trash2, RotateCcw, Download, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, ChevronDown, ChevronUp, Eye, Lock,
  Zap, TrendingUp, HardDrive, UserCheck, Upload, Terminal,
  Search, Play, Loader2, Ban,
} from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { API_REGISTRY, API_CATEGORIES, getEndpointsByCategory, type ApiEndpoint } from '@/lib/api-registry';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BackupRecord {
  id: string;
  type: string;
  tier?: 'full' | 'delta';
  createdAt: number | null;
  userCount: number;
  workoutCount: number;
  storagePath: string | null;
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

class ApiError extends Error {
  isQuota: boolean;
  status: number;
  constructor(message: string, status: number, isQuota = false) {
    super(message);
    this.status = status;
    this.isQuota = isQuota;
  }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { credentials: 'include', ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(
      err.error ?? res.statusText,
      res.status,
      err.isQuota === true || res.status === 429
    );
  }
  return res.json();
}

function QuotaBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const quota = error.includes('quota') || error.includes('Quota') || error.includes('RESOURCE_EXHAUSTED');
  return (
    <div className={`flex items-center gap-3 text-sm rounded-xl px-4 py-3 ${
      quota
        ? 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/30 border border-amber-500/15'
        : 'text-red-400 bg-red-100 dark:bg-red-950/30 border border-red-500/15'
    }`}>
      {quota ? <AlertTriangle size={15} className="shrink-0" /> : <XCircle size={15} className="shrink-0" />}
      <span className="flex-1">
        {quota ? 'Firebase daily quota exceeded — data will load when quota resets (Pacific midnight).' : error}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border text-xs font-medium text-foreground/60 hover:text-foreground transition-all"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

// ─── Animated Background ──────────────────────────────────────────────────────

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-red-500/10 dark:bg-red-600/[0.07] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/3 -left-60 w-[500px] h-[500px] bg-orange-500/10 dark:bg-orange-600/[0.05] rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '12s' }} />
      <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-red-500/10 dark:bg-red-900/[0.06] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-2/3 left-1/3 w-[300px] h-[300px] bg-rose-500/10 dark:bg-rose-600/[0.04] rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '15s' }} />
    </div>
  );
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewSection({ stats, error, onRetry }: { stats: OverviewStats | null; error?: string; onRetry?: () => void }) {
  if (error) {
    return (
      <div className="py-6">
        <QuotaBanner error={error} onRetry={onRetry} />
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center">
        <RefreshCw size={16} className="animate-spin text-red-400/60" />
        <p className="text-muted-foreground text-sm">Loading overview...</p>
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
      valueColor: 'text-blue-600 dark:text-blue-300',
    },
    {
      label: 'Total Workouts',
      value: stats.workoutCount,
      icon: TrendingUp,
      gradient: 'from-emerald-500/20 to-green-500/20',
      border: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-600 dark:text-emerald-300',
    },
    {
      label: 'Last Backup',
      value: stats.lastBackup ? ago(stats.lastBackup.createdAt) : 'Never',
      icon: Clock,
      gradient: 'from-amber-500/20 to-orange-500/20',
      border: 'border-amber-500/20',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-600 dark:text-amber-300',
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
      valueColor: stats.lastBackup?.integrityPassed ? 'text-green-600 dark:text-green-300' : 'text-gray-400',
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
              <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon size={20} className={iconColor} />
              </div>
              <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest mb-1.5">{label}</p>
              <p className={`text-3xl font-black tracking-tight ${valueColor}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick status bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/25 border border-border/50">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-muted-foreground text-xs">Firebase</span>
          <span className="text-green-600 dark:text-green-400/80 text-xs font-medium">Connected</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/25 border border-border/50">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-muted-foreground text-xs">Strava API</span>
          <span className="text-green-600 dark:text-green-400/80 text-xs font-medium">Active</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/25 border border-border/50">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-muted-foreground text-xs">Cron Jobs</span>
          <span className="text-green-600 dark:text-green-400/80 text-xs font-medium">Running</span>
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
  const [seeding, setSeeding] = useState(false);
  const [restoreUsername, setRestoreUsername] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seedInputRef = useRef<HTMLInputElement>(null);

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

  async function triggerBackup(tier: 'full' | 'delta' | 'compact') {
    setCreating(true);
    setError('');
    try {
      await apiFetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
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

  async function seedFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Upload "${file.name}" as the seed full backup? This registers it in Storage for the tiered backup system.`)) {
      if (seedInputRef.current) seedInputRef.current.value = '';
      return;
    }

    setSeeding(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      // Compress with CompressionStream to fit under Vercel's 4.5MB body limit
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new Uint8Array(buffer));
      writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();

      const res = await fetch('/api/admin/backup/seed', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Encoding': 'gzip', 'Content-Type': 'application/octet-stream' },
        body: compressed,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Seed upload failed');

      alert(`Seed backup registered: ${data.userCount} users, ${data.workoutCount} workouts`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
      if (seedInputRef.current) seedInputRef.current.value = '';
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
            <h2 className="text-foreground font-bold text-sm">Backup Management</h2>
            <p className="text-muted-foreground/70 text-xs">Snapshots, downloads, and recovery</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => triggerBackup('delta')}
            disabled={creating}
            className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted/70 border border-border hover:border-border text-xs text-foreground/70 hover:text-foreground disabled:opacity-50 transition-all"
          >
            <RefreshCw size={13} className={creating ? 'animate-spin' : 'group-hover:rotate-90 transition-transform duration-300'} />
            {creating ? 'Running…' : 'Delta'}
          </button>
          <button
            onClick={() => triggerBackup('full')}
            disabled={creating}
            className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/15 hover:border-blue-500/25 text-xs text-blue-600 dark:text-blue-300 font-medium disabled:opacity-50 transition-all"
          >
            <Database size={13} />
            {creating ? 'Running…' : 'Full seed'}
          </button>
          <button
            onClick={() => triggerBackup('compact')}
            disabled={creating}
            className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/25 text-xs text-emerald-600 dark:text-emerald-300 font-medium disabled:opacity-50 transition-all"
          >
            <HardDrive size={13} />
            {creating ? 'Running…' : 'Compact'}
          </button>
          <button
            onClick={downloadBackup}
            disabled={downloading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-xs text-white font-medium shadow-lg shadow-red-300/30 dark:shadow-red-900/30 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download size={13} className={downloading ? 'animate-bounce' : ''} />
            {downloading ? 'Generating…' : 'Download'}
          </button>
          <label
            className={`group flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/15 hover:border-purple-500/25 text-xs text-purple-600 dark:text-purple-300 font-medium cursor-pointer transition-all ${seeding ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload size={13} className={seeding ? 'animate-pulse' : ''} />
            {seeding ? 'Uploading…' : 'Upload seed'}
            <input
              ref={seedInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={seedFromFile}
              disabled={seeding}
            />
          </label>
        </div>
      </div>

      {/* Restore from file */}
      <div className="bg-gradient-to-br from-red-500/[0.06] to-orange-500/[0.04] border border-red-500/[0.12] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw size={15} className="text-red-400/70" />
          <p className="text-foreground/80 text-sm font-semibold">Restore from backup file</p>
        </div>
        <p className="text-muted-foreground/70 text-xs">
          Upload a previously downloaded .json backup. Leave username blank to restore all data.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={restoreUsername}
            onChange={e => setRestoreUsername(e.target.value)}
            placeholder="username (optional)"
            className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 w-52 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all"
          />
          <label
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/30 text-sm text-red-600 dark:text-red-300 font-medium cursor-pointer transition-all ${restoring ? 'opacity-50 pointer-events-none' : ''}`}
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

      {error && <QuotaBanner error={error} onRetry={load} />}

      {/* Snapshots table */}
      <div>
        <p className="text-muted-foreground/70 text-xs mb-3 font-medium">
          Backup history -- Full backups in Storage, Deltas capture only changed docs
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <RefreshCw size={14} className="animate-spin text-muted-foreground/70" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : backups.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No snapshots yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  {['Type', 'Tier', 'Time', 'Users', 'Workouts', 'Storage', 'By'].map(h => (
                    <th key={h} className="text-left text-muted-foreground text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={b.id} className={`text-foreground/60 border-t border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 text-foreground/60 border border-border/60">{b.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        b.tier === 'full'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/15'
                          : b.tier === 'delta'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/15'
                          : 'bg-muted/60 text-muted-foreground border border-border/60'
                      }`}>{b.tier ?? 'legacy'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground/70 text-xs font-mono">{fmt(b.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{b.userCount}</td>
                    <td className="px-4 py-3 font-semibold">{b.workoutCount}</td>
                    <td className="px-4 py-3">
                      {b.storagePath
                        ? <span className="inline-flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={13} /> Yes</span>
                        : <span className="text-muted-foreground/70 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/70 text-xs">{b.triggeredBy ?? 'cron'}</td>
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

  const [disableTarget, setDisableTarget] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const filtered = users.filter(u =>
    u.username.includes(search) || u.email.includes(search)
  );

  async function softDelete(username: string, reason: string) {
    setActing(username);
    try {
      await apiFetch(`/api/admin/users/${username}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
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

  async function permanentDelete(username: string, reason: string) {
    setActing(username);
    try {
      await apiFetch(`/api/admin/users/${username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
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
            <h2 className="text-foreground font-bold text-sm">User Management</h2>
            <p className="text-muted-foreground/70 text-xs">{users.length} registered users</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted/70 border border-border hover:border-border text-sm text-foreground/70 hover:text-foreground transition-all"
        >
          <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Eye size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground/50 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all"
          />
        </div>
      </div>

      {error && <QuotaBanner error={error} onRetry={load} />}

      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center">
          <RefreshCw size={14} className="animate-spin text-muted-foreground/70" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                {['Username', 'Email', 'Role', 'Workouts', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-muted-foreground text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.username} className={`text-foreground/60 border-t border-border/50 hover:bg-muted/30 transition-colors ${u.status === 'deleted' ? 'opacity-40' : ''} ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-red-600 dark:text-red-300/90 bg-red-500/[0.08] px-2 py-1 rounded-md">{u.username}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`capitalize text-xs px-2.5 py-1 rounded-lg font-medium ${
                      u.role === 'coach'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/15'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/15'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{u.workoutCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground/70 text-xs">{fmt(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {u.status === 'active'
                      ? <span className="inline-flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> active</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> disabled</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => exportUserJSON(u.username)}
                        title="Export JSON"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-foreground/60 hover:bg-muted/60 transition-all"
                      >
                        <Download size={13} />
                      </button>
                      {u.status === 'active' ? (
                        <button
                          onClick={() => { setDisableTarget(u.username); setDisableReason(''); }}
                          disabled={acting === u.username}
                          title="Disable user"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-400/40 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-all"
                        >
                          <Ban size={13} />
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
                      <button
                        onClick={() => { setDeleteTarget(u.username); setDeleteReason(''); setDeleteConfirmText(''); }}
                        disabled={acting === u.username}
                        title="Permanently delete user"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-muted/25 border-t border-border/50 text-muted-foreground/70 text-xs">
            {filtered.length} of {users.length} users
          </div>
        </div>
      )}

      {/* Disable reason modal */}
      {disableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Ban size={16} className="text-amber-400" />
              Disable <span className="font-mono text-amber-400">{disableTarget}</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              The account will be disabled but can be re-enabled later. The user will be notified via email.
            </p>
            <textarea
              value={disableReason}
              onChange={e => setDisableReason(e.target.value)}
              placeholder="e.g. Violation of terms of service"
              rows={3}
              className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDisableTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = disableTarget;
                  const reason = disableReason.trim() || 'No reason provided';
                  setDisableTarget(null);
                  await softDelete(target, reason);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-all"
              >
                Disable Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-red-500/30 bg-background p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Trash2 size={16} className="text-red-400" />
              Permanently Delete <span className="font-mono text-red-400">{deleteTarget}</span>
            </h3>
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-xs text-red-400 font-medium">
                This will permanently remove the user&apos;s account, all workouts, personal records, and Firebase Auth. This cannot be undone.
              </p>
            </div>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              placeholder="e.g. Spam account, requested by user"
              rows={3}
              className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
              autoFocus
            />
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Type <span className="font-mono font-semibold text-red-400">{deleteTarget}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmText !== deleteTarget}
                onClick={async () => {
                  const target = deleteTarget;
                  const reason = deleteReason.trim() || 'No reason provided';
                  setDeleteTarget(null);
                  await permanentDelete(target, reason);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
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

  const [logsError, setLogsError] = useState('');

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const [a, c] = await Promise.all([
        apiFetch('/api/admin/logs?type=actions'),
        apiFetch('/api/admin/logs?type=cron'),
      ]);
      setLogs(a.logs);
      setCronLogs(c.logs);
    } catch (e: any) {
      setLogsError(e.message);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

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
          <h2 className="text-foreground font-bold text-sm">System & Actions</h2>
          <p className="text-muted-foreground/70 text-xs">Integrations, sync, and activity logs</p>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h3 className="text-foreground/60 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openSyncDialog}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/15 hover:to-amber-500/15 border border-orange-500/15 hover:border-orange-500/25 text-sm text-orange-600 dark:text-orange-300 font-medium transition-all"
          >
            <Zap size={15} className="group-hover:rotate-12 transition-transform" /> Force Strava Sync All
          </button>
        </div>
      </div>

      {/* Strava sync confirmation dialog */}
      {showSyncDialog && syncStats && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-5 shadow-2xl shadow-foreground/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Force Strava Sync All</h3>
                <p className="text-muted-foreground/70 text-xs">This will trigger sync for all connected users</p>
              </div>
            </div>
            <div className="bg-muted/30 border border-border/60 rounded-xl p-4 text-sm space-y-2.5 text-foreground/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active users</span>
                <span className="text-foreground font-bold">{syncStats.userCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. API calls</span>
                <span className="text-foreground font-bold">~{syncStats.userCount * 5}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate limit</span>
                <span className="text-foreground/60">100 / 15 min, 1K / day</span>
              </div>
              <div className="pt-1.5 border-t border-border/50">
                <p className={`text-xs font-medium ${syncStats.userCount * 5 > 100 ? 'text-amber-400' : 'text-green-400'}`}>
                  {syncStats.userCount * 5 > 1000
                    ? '⚠ Exceeds daily limit — will hit rate cap'
                    : syncStats.userCount * 5 > 100
                    ? '⚠ May hit 15-min rate limit; will self-throttle'
                    : '✓ Within rate limits'}
                </p>
              </div>
            </div>
            {syncError && <QuotaBanner error={syncError} />}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setShowSyncDialog(false)}
                className="px-5 py-2.5 rounded-xl bg-muted/50 hover:bg-muted/70 border border-border text-sm text-foreground/60 hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSync}
                disabled={syncing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-sm text-white font-medium shadow-lg shadow-red-300/30 dark:shadow-red-900/30 disabled:opacity-50 transition-all"
              >
                {syncing ? 'Syncing…' : 'Confirm Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log viewer */}
      <div>
        <h3 className="text-foreground/60 text-xs font-semibold uppercase tracking-widest mb-3">Activity Log</h3>
        <div className="inline-flex items-center gap-1 mb-4 bg-muted/50 border border-border/60 rounded-xl p-1">
          {(['actions', 'cron'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLogTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                logTab === tab
                  ? 'bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/20 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/60 hover:bg-muted/40 border border-transparent'
              }`}
            >
              {tab === 'actions' ? 'Admin Actions' : 'Cron Logs'}
            </button>
          ))}
        </div>

        {logsError && <QuotaBanner error={logsError} onRetry={loadLogs} />}

        {logsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <RefreshCw size={14} className="animate-spin text-muted-foreground/70" />
            <p className="text-muted-foreground text-sm">Loading logs...</p>
          </div>
        ) : displayLogs.length === 0 && !logsError ? (
          <p className="text-muted-foreground text-sm text-center py-8">No logs yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {displayLogs.map(log => (
              <div key={log.id} className="group bg-muted/25 hover:bg-muted/40 border border-border/50 hover:border-border rounded-xl px-4 py-3 text-xs flex items-center gap-4 transition-all">
                <span className="text-muted-foreground/70 whitespace-nowrap font-mono">{fmt(log.timestamp)}</span>
                <span className="font-mono text-red-600 dark:text-red-300 bg-red-500/[0.08] px-2 py-0.5 rounded-md">{log.action}</span>
                {log.targetUid && <span className="text-muted-foreground/70">user: {log.targetUid}</span>}
                {log.type && <span className="text-muted-foreground/70">type: {log.type}</span>}
                <span className="text-muted-foreground/70 ml-auto text-[11px]">by {log.adminUid}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Endpoints Section ───────────────────────────────────────────────────

interface TestResult {
  status: number;
  ok: boolean;
  duration: number;
  timestamp: number;
  preview?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const AUTH_COLORS: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/15',
  user: 'bg-blue-500/10 text-blue-400 border-blue-500/15',
  cron: 'bg-amber-500/10 text-amber-400 border-amber-500/15',
  public: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
};

function ApiEndpointsSection() {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(API_CATEGORIES.map(c => c.id))
  );
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  const grouped = getEndpointsByCategory();
  const methods = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  const filteredGrouped = Object.entries(grouped).map(([catId, endpoints]) => {
    const filtered = endpoints.filter(e => {
      if (methodFilter !== 'ALL' && e.method !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      }
      return true;
    });
    return [catId, filtered] as [string, ApiEndpoint[]];
  }).filter(([, endpoints]) => endpoints.length > 0);

  const totalEndpoints = API_REGISTRY.length;
  const testableCount = API_REGISTRY.filter(e => e.testable).length;
  const testedCount = Object.keys(testResults).length;
  const healthyCount = Object.values(testResults).filter(r => r.ok).length;

  const toggleGroup = (catId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    const key = `${endpoint.method}:${endpoint.path}`;
    setTesting(key);
    const start = performance.now();
    try {
      const url = endpoint.params ? `${endpoint.path}${endpoint.params.split('|')[0]}` : endpoint.path;
      const res = await fetch(url, { credentials: 'include' });
      const duration = Math.round(performance.now() - start);
      const body = await res.text();
      let preview = body.slice(0, 300);
      try { preview = JSON.stringify(JSON.parse(body), null, 2).slice(0, 500); } catch {}
      setTestResults(prev => ({ ...prev, [key]: { status: res.status, ok: res.ok, duration, timestamp: Date.now(), preview } }));
      setExpandedResult(key);
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setTestResults(prev => ({
        ...prev,
        [key]: { status: 0, ok: false, duration, timestamp: Date.now(), preview: err instanceof Error ? err.message : 'Network error' },
      }));
      setExpandedResult(key);
    } finally {
      setTesting(null);
    }
  };

  const testAll = async () => {
    setTestingAll(true);
    const testable = API_REGISTRY.filter(e => e.testable);
    for (const endpoint of testable) {
      await testEndpoint(endpoint);
      await new Promise(r => setTimeout(r, 150));
    }
    setTestingAll(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/20 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">API Endpoints</h2>
            <p className="text-xs text-muted-foreground">{totalEndpoints} endpoints &middot; {testableCount} testable &middot; {testedCount} tested &middot; {healthyCount} healthy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/youwillneverguessthisistheadmin/api"
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-600 dark:text-purple-300 rounded-lg transition-all"
          >
            <Zap size={14} />
            Playground
          </a>
          <button
            onClick={testAll}
            disabled={testingAll || !!testing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-lg transition-all disabled:opacity-50"
          >
            {testingAll ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Test All
          </button>
        </div>
      </div>

      {/* Search + Method Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border/60 rounded-lg text-foreground placeholder-muted-foreground/40 focus:border-indigo-500/40 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 bg-muted/30 border border-border/60 rounded-lg p-1">
          {methods.map(m => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                methodFilter === m
                  ? 'bg-foreground/10 text-foreground border border-border/60'
                  : 'text-muted-foreground hover:text-foreground/60'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint Groups */}
      <div className="space-y-3">
        {filteredGrouped.map(([catId, endpoints]) => {
          const cat = API_CATEGORIES.find(c => c.id === catId);
          const isExpanded = expandedGroups.has(catId);
          return (
            <div key={catId} className="bg-muted/20 border border-border/40 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(catId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{cat?.label ?? catId}</span>
                  <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">{endpoints.length}</span>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {endpoints.map((ep) => {
                    const key = `${ep.method}:${ep.path}`;
                    const result = testResults[key];
                    const isCurrentlyTesting = testing === key;
                    const isResultExpanded = expandedResult === key;
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          {/* Method badge */}
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border shrink-0 ${METHOD_COLORS[ep.method]}`}>
                            {ep.method}
                          </span>

                          {/* Path */}
                          <span className="font-mono text-xs text-foreground/80 shrink-0">{ep.path}</span>
                          {ep.params && <span className="text-[10px] text-muted-foreground/50 font-mono hidden sm:inline">{ep.params}</span>}

                          {/* Description */}
                          <span className="text-xs text-muted-foreground hidden md:inline flex-1 truncate">{ep.description}</span>

                          {/* Spacer */}
                          <div className="flex-1 md:flex-none" />

                          {/* Auth badge */}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border hidden sm:inline ${AUTH_COLORS[ep.auth]}`}>
                            {ep.auth}
                          </span>

                          {/* Dangerous marker */}
                          {ep.dangerous && (
                            <AlertTriangle size={12} className="text-amber-500/60 shrink-0" />
                          )}

                          {/* Health dot */}
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            !result ? 'bg-muted-foreground/20'
                            : result.ok ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                            : 'bg-red-400 shadow-sm shadow-red-400/50'
                          }`} />

                          {/* Test button */}
                          {ep.testable && (
                            <button
                              onClick={() => testEndpoint(ep)}
                              disabled={!!testing || testingAll}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-muted/40 hover:bg-muted/60 border border-border/40 rounded-md text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
                            >
                              {isCurrentlyTesting ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                              Test
                            </button>
                          )}

                          {/* Expand result */}
                          {result && (
                            <button
                              onClick={() => setExpandedResult(isResultExpanded ? null : key)}
                              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                            >
                              <Eye size={12} />
                            </button>
                          )}
                        </div>

                        {/* Result panel */}
                        {isResultExpanded && result && (
                          <div className="mx-4 mb-3 p-3 bg-background/50 border border-border/30 rounded-lg">
                            <div className="flex items-center gap-4 mb-2 text-xs">
                              <span className={`font-bold ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.status || 'ERR'}
                              </span>
                              <span className="text-muted-foreground">{result.duration}ms</span>
                              <span className="text-muted-foreground/40">{new Date(result.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {result.preview && (
                              <pre className="text-[11px] text-muted-foreground/70 bg-muted/20 rounded-md p-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono">
                                {result.preview}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGrouped.length === 0 && (
        <div className="text-center py-12 text-muted-foreground/50 text-sm">
          No endpoints match your search
        </div>
      )}
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & branding */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/20 shadow-2xl shadow-red-300/30 dark:shadow-red-900/30 flex items-center justify-center">
              <Shield className="w-10 h-10 text-red-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">Admin Access</h1>
          <p className="text-red-400/50 mt-1.5 text-sm font-medium tracking-wide">The Daily Athlete</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-muted/30 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl shadow-foreground/5 space-y-6">
          {/* Restricted area badge */}
          <div className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/[0.08] to-orange-500/[0.06] border border-red-500/15">
            <Lock className="w-3.5 h-3.5 text-red-400/70" />
            <span className="text-xs text-red-600 dark:text-red-300/70 font-bold tracking-widest uppercase">Restricted Area</span>
          </div>

          <p className="text-muted-foreground text-sm text-center">
            Enter the admin password to continue.
          </p>

          {error && (
            <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-100 dark:bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <XCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-muted/40 border border-border text-foreground placeholder-muted-foreground/50 text-sm focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
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
            <Shield className="w-3 h-3 text-muted-foreground/30" />
            <span className="text-[11px] text-muted-foreground/30 tracking-wide">Protected by The Daily Athlete</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'backups' | 'users' | 'system' | 'api';

const TABS: { id: Tab; label: string; icon: typeof Database }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'backups', label: 'Backups', icon: Database },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'system', label: 'System', icon: Settings },
  { id: 'api', label: 'API', icon: Terminal },
];

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const loadStats = useCallback(async () => {
    setStatsError('');
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
    } catch (e: any) {
      setStatsError(e.message);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function handleLogout() {
    await fetch('/api/admin/verify', { method: 'DELETE', credentials: 'include' }).catch(() => {});
    onLogout();
  }

  return (
    <div className="min-h-screen bg-background text-foreground/80 relative">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-background/80 via-red-100/50 dark:via-red-950/20 to-background/80 backdrop-blur-2xl border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/25 to-red-900/25 border border-red-500/25 flex items-center justify-center shadow-lg shadow-red-900/25">
              <Shield size={20} className="text-red-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-foreground text-sm tracking-tight leading-tight">THE DAILY ATHLETE</span>
              <span className="text-red-400/50 text-[10px] font-semibold uppercase tracking-widest">Admin Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-600 dark:text-green-600 dark:text-green-400/80 text-xs font-medium">System Online</span>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-muted-foreground hover:text-red-600 dark:text-red-300 hover:bg-red-500/10 rounded-xl px-4 py-2 text-sm transition-all"
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
              <h1 className="text-2xl font-black text-foreground tracking-tight">Welcome back, Admin</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage users, monitor backups, and keep things running smoothly.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-muted-foreground/70 text-xs">Current time</p>
                <p className="text-foreground/60 text-sm font-mono">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="w-px h-8 bg-border/60" />
              <div className="text-right">
                <p className="text-muted-foreground/70 text-xs">Environment</p>
                <p className="text-emerald-600 dark:text-emerald-400/70 text-sm font-medium">Production</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="inline-flex gap-1 bg-muted/40 backdrop-blur-xl border border-border/60 rounded-2xl p-1.5 shadow-xl shadow-foreground/5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-gradient-to-r from-red-600/20 to-red-500/15 text-red-600 dark:text-red-300 border border-red-500/20 shadow-lg shadow-red-300/10 dark:shadow-red-900/10'
                  : 'text-muted-foreground hover:text-foreground/60 hover:bg-muted/40 border border-transparent'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="bg-muted/25 backdrop-blur-sm border border-border/60 rounded-2xl p-6 sm:p-8 shadow-xl shadow-foreground/5">
          {tab === 'overview' && <OverviewSection stats={stats} error={statsError} onRetry={loadStats} />}
          {tab === 'backups' && <BackupsSection />}
          {tab === 'users' && <UsersSection />}
          {tab === 'system' && <SystemActionsSection />}
          {tab === 'api' && <ApiEndpointsSection />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pb-4">
          <Shield size={12} className="text-muted-foreground/30" />
          <span className="text-muted-foreground/30 text-xs tracking-wide">The Daily Athlete Admin Console</span>
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
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <AnimatedBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/20 flex items-center justify-center animate-pulse shadow-2xl shadow-red-300/30 dark:shadow-red-900/30">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
            <p className="text-muted-foreground/70 text-sm font-medium tracking-wide">Verifying session</p>
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
