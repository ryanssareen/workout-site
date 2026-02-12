'use client';

import { useEffect, useState } from 'react';
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
}

interface RouteMapProps {
  routeData: RouteData;
  className?: string;
  height?: number;
}

export function RouteMap({ routeData, className = '', height = 300 }: RouteMapProps) {
  const [positions, setPositions] = useState<[number, number][]>([]);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          pathOptions={{ color: '#10b981', weight: 7, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }}
        />
        {/* Main route line */}
        <Polyline
          positions={positions}
          pathOptions={{ color: '#10b981', weight: 3.5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
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
  );
}
