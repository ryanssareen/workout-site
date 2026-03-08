'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { decodePolyline } from '@/lib/polyline';
import 'leaflet/dist/leaflet.css';

// Component to fit map bounds to the route
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, positions]);
  return null;
}

interface RouteData {
  polyline?: string;
  startLatLng?: [number, number];
  endLatLng?: [number, number];
  aiComment?: string;
}

interface RouteMapProps {
  routeData: RouteData;
  className?: string;
  height?: number;
  workoutId?: string; // If provided, auto-generates AI comment for existing workouts
  ownerUsername?: string; // Required for AI comment generation
}

export function RouteMap({ routeData, className = '', height = 300, workoutId, ownerUsername }: RouteMapProps) {
  const [positions, setPositions] = useState<[number, number][]>([]);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(routeData.aiComment || null);
  const [loadingComment, setLoadingComment] = useState(false);
  const commentAttempted = useRef(false);

  useEffect(() => {
    setIsClient(true);
    if (routeData.polyline) {
      try {
        const decoded = decodePolyline(routeData.polyline);
        if (decoded.length === 0) {
          setError('No route points decoded');
        } else {
          setPositions(decoded);
        }
      } catch (err) {
        console.error('Failed to decode polyline:', err);
        setError('Failed to decode route data');
      }
    }
  }, [routeData.polyline]);

  // Auto-generate AI comment for existing workouts that don't have one
  useEffect(() => {
    if (commentAttempted.current) return;
    if (!workoutId || !ownerUsername || aiComment || !isClient) return;

    commentAttempted.current = true;
    setLoadingComment(true);
    fetch('/api/ai/route-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId, ownerUsername }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.comment) setAiComment(data.comment);
      })
      .catch(() => {})
      .finally(() => setLoadingComment(false));
  }, [workoutId, ownerUsername, aiComment, isClient]);

  if (!isClient) {
    return (
      <div className={`bg-muted/50 rounded-xl flex items-center justify-center animate-pulse ${className}`} style={{ height }}>
        <p className="text-muted-foreground text-sm">Loading map...</p>
      </div>
    );
  }

  if (error || positions.length === 0) {
    if (error) {
      return (
        <div className={`bg-muted/50 rounded-xl flex items-center justify-center ${className}`} style={{ height }}>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      );
    }
    return null;
  }

  const center = positions[Math.floor(positions.length / 2)] || [0, 0];
  const startPos = positions[0];
  const endPos = positions[positions.length - 1];

  return (
    <div className="space-y-2">
      <div className={`rounded-xl overflow-hidden border shadow-sm ${className}`} style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
        >
          {/* Dark map tiles — CartoDB Positron for light mode compat, looks clean */}
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

          {/* Route glow (wider, translucent behind) */}
          <Polyline
            positions={positions}
            pathOptions={{ color: '#10b981', weight: 12, opacity: 0.15, lineCap: 'round', lineJoin: 'round' }}
          />
          {/* Main route line */}
          <Polyline
            positions={positions}
            pathOptions={{ color: '#10b981', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />

          {/* Start marker — green circle */}
          {startPos && (
            <CircleMarker center={startPos} radius={6}
              pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#22c55e', fillOpacity: 1 }}
            />
          )}
          {/* End marker — red circle */}
          {endPos && startPos !== endPos && (
            <CircleMarker center={endPos} radius={6}
              pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#ef4444', fillOpacity: 1 }}
            />
          )}

          <FitBounds positions={positions} />
        </MapContainer>
      </div>
      {(aiComment || loadingComment) && (
        <div className="rounded-lg bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/20 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">🤖</span>
            {loadingComment ? (
              <p className="text-sm text-muted-foreground italic animate-pulse">Thinking of something witty...</p>
            ) : (
              <p className="text-base font-medium text-foreground">{aiComment}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
