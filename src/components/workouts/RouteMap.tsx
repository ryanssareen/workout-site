'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { decodePolyline } from '@/lib/polyline';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

// Component to fit map bounds to the route
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, positions]);
  
  return null;
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
  
  // Don't render on server (SSR)
  if (!isClient) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-muted-foreground text-sm">Loading map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }
  
  if (positions.length === 0) {
    return null;
  }
  
  const center = positions[Math.floor(positions.length / 2)] || [0, 0];
  const startPos = positions[0];
  const endPos = positions[positions.length - 1];
  
  return (
    <div className={`rounded-lg overflow-hidden border ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={positions}
          pathOptions={{
            color: '#f97316',
            weight: 4,
            opacity: 0.8
          }}
        />
        {startPos && (
          <Marker position={startPos} icon={startIcon} />
        )}
        {endPos && startPos !== endPos && (
          <Marker position={endPos} icon={endIcon} />
        )}
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
