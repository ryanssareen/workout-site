'use client';

import { useMemo } from 'react';
import { decodePolyline } from '@/lib/polyline';

interface MiniRoutePreviewProps {
  polyline: string;
  className?: string;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Lightweight SVG-based route preview for workout cards.
 * No Leaflet dependency — just renders the polyline as an SVG path.
 */
export function MiniRoutePreview({
  polyline: encodedPolyline,
  className = '',
  width = 200,
  height = 80,
  strokeColor = '#10b981',
  strokeWidth = 2,
}: MiniRoutePreviewProps) {
  const svgPath = useMemo(() => {
    try {
      const points = decodePolyline(encodedPolyline);
      if (points.length < 2) return null;

      // Find bounds
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;

      for (const [lat, lng] of points) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }

      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;

      // Add padding (10%)
      const padding = 0.1;
      const padX = width * padding;
      const padY = height * padding;
      const drawWidth = width - padX * 2;
      const drawHeight = height - padY * 2;

      // Map lat/lng to SVG coordinates
      // Note: lat is inverted (higher lat = lower y in SVG)
      const svgPoints = points.map(([lat, lng]) => {
        const x = padX + ((lng - minLng) / lngRange) * drawWidth;
        const y = padY + ((maxLat - lat) / latRange) * drawHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      return `M${svgPoints.join('L')}`;
    } catch {
      return null;
    }
  }, [encodedPolyline, width, height]);

  if (!svgPath) return null;

  return (
    <div className={`rounded-md overflow-hidden bg-muted/30 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        <path
          d={svgPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      </svg>
    </div>
  );
}
