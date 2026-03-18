'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Shield, ArrowLeft, Play, Loader2, Copy, Check, ChevronDown,
  ChevronUp, AlertTriangle, Search, XCircle, Clock, Zap,
} from 'lucide-react';
import { API_REGISTRY, API_CATEGORIES, getEndpointsByCategory, type ApiEndpoint } from '@/lib/api-registry';

// ─── Auth check ──────────────────────────────────────────────────────────────

function useAdminAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/admin/verify', { credentials: 'include' })
      .then(r => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);
  return authed;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const METHOD_BG: Record<string, string> = {
  GET: 'border-emerald-500/30',
  POST: 'border-blue-500/30',
  PUT: 'border-amber-500/30',
  PATCH: 'border-purple-500/30',
  DELETE: 'border-red-500/30',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestResult {
  status: number;
  statusText: string;
  ok: boolean;
  duration: number;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ApiPlaygroundPage() {
  const authed = useAdminAuth();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(API_CATEGORIES.map(c => c.id)));

  if (authed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-400/50 mx-auto" />
          <p className="text-muted-foreground">Admin access required.</p>
          <a href="/youwillneverguessthisistheadmin" className="text-sm text-indigo-400 hover:underline">Go to admin login</a>
        </div>
      </div>
    );
  }

  const grouped = getEndpointsByCategory();
  const methods = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  const filteredGrouped = Object.entries(grouped)
    .map(([catId, endpoints]) => {
      const filtered = endpoints.filter(e => {
        if (methodFilter !== 'ALL' && e.method !== methodFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
        }
        return true;
      });
      return [catId, filtered] as [string, ApiEndpoint[]];
    })
    .filter(([, endpoints]) => endpoints.length > 0);

  const toggleGroup = (catId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <a
            href="/youwillneverguessthisistheadmin"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </a>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">API Playground</h1>
              <p className="text-[11px] text-muted-foreground">{API_REGISTRY.length} endpoints</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar — Endpoint List */}
          <div className="lg:w-80 xl:w-96 shrink-0 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border/60 rounded-lg text-foreground placeholder-muted-foreground/40 focus:border-indigo-500/40 focus:outline-none"
              />
            </div>

            {/* Method filter */}
            <div className="flex gap-1 bg-muted/20 border border-border/40 rounded-lg p-1">
              {methods.map(m => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`flex-1 px-2 py-1 text-[11px] font-mono rounded-md transition-all ${
                    methodFilter === m
                      ? 'bg-foreground/10 text-foreground border border-border/60'
                      : 'text-muted-foreground hover:text-foreground/60'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Endpoint groups */}
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filteredGrouped.map(([catId, endpoints]) => {
                const cat = API_CATEGORIES.find(c => c.id === catId);
                const isExpanded = expandedGroups.has(catId);
                return (
                  <div key={catId} className="bg-muted/15 border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleGroup(catId)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{cat?.label ?? catId}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{endpoints.length}</span>
                      </div>
                      {isExpanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/20">
                        {endpoints.map(ep => {
                          const key = `${ep.method}:${ep.path}`;
                          const isSelected = selectedEndpoint && `${selectedEndpoint.method}:${selectedEndpoint.path}` === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedEndpoint(ep)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/25 transition-colors ${
                                isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'
                              }`}
                            >
                              <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${METHOD_COLORS[ep.method]}`}>
                                {ep.method}
                              </span>
                              <span className="font-mono text-[11px] text-foreground/70 truncate">{ep.path}</span>
                              {ep.dangerous && <AlertTriangle size={10} className="text-amber-500/50 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredGrouped.length === 0 && (
                <div className="text-center py-8 text-muted-foreground/40 text-xs">No endpoints match</div>
              )}
            </div>
          </div>

          {/* Main — Request Panel */}
          <div className="flex-1 min-w-0">
            {selectedEndpoint ? (
              <RequestPanel endpoint={selectedEndpoint} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/50">Select an endpoint</p>
                <p className="text-xs text-muted-foreground/30 mt-1">Pick from the sidebar to start testing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Request Panel ───────────────────────────────────────────────────────────

function RequestPanel({ endpoint }: { endpoint: ApiEndpoint }) {
  const [body, setBody] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<RequestResult[]>([]);
  const prevEndpointRef = useRef<string>('');

  const endpointKey = `${endpoint.method}:${endpoint.path}`;
  if (prevEndpointRef.current !== endpointKey) {
    prevEndpointRef.current = endpointKey;
    setBody('');
    setQueryParams(endpoint.params?.replace('?', '') || '');
    setResult(null);
    setHistory([]);
  }

  const hasBody = endpoint.method !== 'GET' && endpoint.method !== 'DELETE';

  const sendRequest = async () => {
    setLoading(true);
    const start = performance.now();

    try {
      const url = queryParams ? `${endpoint.path}?${queryParams}` : endpoint.path;
      const options: RequestInit = {
        method: endpoint.method,
        credentials: 'include',
        headers: {} as Record<string, string>,
      };

      if (hasBody && body.trim()) {
        (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
        options.body = body;
      }

      const res = await fetch(url, options);
      const duration = Math.round(performance.now() - start);
      const responseBody = await res.text();

      let formatted = responseBody;
      try {
        formatted = JSON.stringify(JSON.parse(responseBody), null, 2);
      } catch {}

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });

      const r: RequestResult = {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        duration,
        body: formatted,
        headers: responseHeaders,
        timestamp: Date.now(),
      };

      setResult(r);
      setHistory(prev => [r, ...prev].slice(0, 10));
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const r: RequestResult = {
        status: 0,
        statusText: 'Network Error',
        ok: false,
        duration,
        body: err instanceof Error ? err.message : 'Request failed',
        headers: {},
        timestamp: Date.now(),
      };
      setResult(r);
      setHistory(prev => [r, ...prev].slice(0, 10));
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Endpoint header */}
      <div className={`bg-muted/20 border rounded-xl p-4 ${METHOD_BG[endpoint.method]}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded border ${METHOD_COLORS[endpoint.method]}`}>
            {endpoint.method}
          </span>
          <span className="font-mono text-sm text-foreground font-medium">{endpoint.path}</span>
          {endpoint.dangerous && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded">
              <AlertTriangle size={10} /> Dangerous
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{endpoint.description}</p>
        <div className="flex gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded">Auth: {endpoint.auth}</span>
          {endpoint.params && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded font-mono">Params: {endpoint.params}</span>
          )}
        </div>
      </div>

      {/* Query params */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Query Parameters</label>
        <input
          type="text"
          value={queryParams}
          onChange={e => setQueryParams(e.target.value)}
          placeholder="key=value&key2=value2"
          className="w-full px-3 py-2 text-sm font-mono bg-muted/20 border border-border/40 rounded-lg text-foreground placeholder-muted-foreground/30 focus:border-indigo-500/40 focus:outline-none"
        />
      </div>

      {/* Request body */}
      {hasBody && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder='{"key": "value"}'
            rows={6}
            className="w-full px-3 py-2 text-sm font-mono bg-muted/20 border border-border/40 rounded-lg text-foreground placeholder-muted-foreground/30 focus:border-indigo-500/40 focus:outline-none resize-y"
          />
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center gap-3">
        <button
          onClick={sendRequest}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
            endpoint.dangerous
              ? 'bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/20 text-amber-300'
              : 'bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-300'
          }`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Send Request
        </button>
        {endpoint.dangerous && (
          <span className="text-[11px] text-amber-400/60">This endpoint has side effects</span>
        )}
      </div>

      {/* Response */}
      {result && (
        <div className="bg-muted/15 border border-border/30 rounded-xl overflow-hidden">
          {/* Response header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold font-mono ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.status} {result.statusText}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} />
                {result.duration}ms
              </span>
            </div>
            <button
              onClick={copyResponse}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 bg-muted/30 hover:bg-muted/50 border border-border/30 rounded-md transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Response body */}
          <pre className="p-4 text-xs font-mono text-foreground/80 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
            {result.body}
          </pre>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Recent Requests</h3>
          <div className="space-y-1">
            {history.slice(1).map((r, i) => (
              <button
                key={i}
                onClick={() => setResult(r)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/10 hover:bg-muted/20 border border-border/20 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono font-bold ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{r.duration}ms</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
