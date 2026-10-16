/**
 * @fileoverview Geospatial map component using Leaflet + React-Leaflet.
 * Renders location markers colored by priority band.
 * Requires CSR (client-side rendering) — must be dynamically imported with ssr:false.
 *
 * Shows synthetic data disclaimer prominently.
 * Uses OpenStreetMap tiles (free, no API key required).
 */

'use client';

import { useEffect, useRef } from 'react';
import { CanonicalIssue, LocationEvidence } from '@/lib/types';

interface CivicMapProps {
  issues: CanonicalIssue[];
  evidence: Record<string, LocationEvidence>;
  selectedIssueId?: string | null;
  onSelectIssue?: (issueId: string) => void;
  height?: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#EF4444',
  High: '#F97316',
  Medium: '#EAB308',
  Low: '#22C55E',
};

/**
 * Civic priority geospatial map.
 * Dynamically builds Leaflet map with colored markers and clustering.
 */
export default function CivicMap({
  issues,
  evidence,
  selectedIssueId,
  onSelectIssue,
  height = 500,
}: CivicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let L: typeof import('leaflet');
    let map: ReturnType<typeof import('leaflet')['map']>;

    const init = async () => {
      // Dynamically import leaflet to avoid SSR issues
      L = (await import('leaflet')).default;

      // Fix default marker icon paths for webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapInstanceRef.current) return; // Already initialized

      // Center on mean of all issue coordinates, default to Vijayawada area
      const coords = issues.map(i => [i.latitude, i.longitude] as [number, number]);
      const centerLat = coords.length ? coords.reduce((s, c) => s + c[0], 0) / coords.length : 16.45;
      const centerLon = coords.length ? coords.reduce((s, c) => s + c[1], 0) / coords.length : 80.51;

      map = L.map(mapRef.current!, {
        center: [centerLat, centerLon],
        zoom: 11,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Dark tile layer (CartoDB Dark Matter — free, no API key)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Add markers for each issue
      for (const issue of issues) {
        addMarker(L, map, issue, onSelectIssue);
      }
    };

    init().catch(console.error);

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as ReturnType<typeof import('leaflet')['map']>).remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when issues change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const map = mapInstanceRef.current as ReturnType<typeof import('leaflet')['map']>;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;
      // Remove markers not in current issues
      const currentIds = new Set(issues.map(i => i.issueId));
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          (marker as ReturnType<typeof L.circleMarker>).remove();
          markersRef.current.delete(id);
        }
      });
      // Add or update markers
      for (const issue of issues) {
        if (!markersRef.current.has(issue.issueId)) {
          addMarker(L, map, issue, onSelectIssue);
        }
      }
    };

    updateMarkers().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  // Pan to selected issue
  useEffect(() => {
    if (!selectedIssueId || !mapInstanceRef.current) return;
    const issue = issues.find(i => i.issueId === selectedIssueId);
    if (!issue) return;
    const map = mapInstanceRef.current as ReturnType<typeof import('leaflet')['map']>;
    map.setView([issue.latitude, issue.longitude], 14, { animate: true });

    // Open popup for selected marker
    const marker = markersRef.current.get(selectedIssueId);
    if (marker) {
      (marker as ReturnType<typeof import('leaflet')['circleMarker']>).openPopup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIssueId]);

  function addMarker(
    L: typeof import('leaflet'),
    map: ReturnType<typeof L.map>,
    issue: CanonicalIssue,
    onSelect?: (id: string) => void
  ) {
    const color = PRIORITY_COLORS[issue.priority.band] ?? '#6B7280';
    const radius = issue.priority.band === 'Critical' ? 14 :
                   issue.priority.band === 'High' ? 11 :
                   issue.priority.band === 'Medium' ? 9 : 7;

    const marker = L.circleMarker([issue.latitude, issue.longitude], {
      radius,
      fillColor: color,
      color: issue.isSeeded ? '#FFB21A' : '#0B0D0F',
      weight: issue.isSeeded ? 2 : 1,
      opacity: 1,
      fillOpacity: 0.85,
    });

    const seedLabel = issue.isSeeded ? '<span style="color:#FFB21A;font-size:0.7rem;"> ★ DEMO SEED</span>' : '';
    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:200px;color:#F0F0F2;background:#17191C;border-radius:8px;">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.25rem;">${issue.title}${seedLabel}</div>
        <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:0.5rem;">
          ${issue.locationId ?? 'No location'} · ${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.25rem;">
          <span style="background:${color}20;color:${color};padding:2px 6px;border-radius:4px;font-size:0.75rem;font-weight:600;">
            Score: ${issue.priority.total} · ${issue.priority.band}
          </span>
        </div>
        <div style="font-size:0.75rem;color:#9CA3AF;">${issue.reportCount} report(s) · ${issue.status}</div>
        <div style="font-size:0.75rem;color:#6B7280;margin-top:0.25rem;">${issue.department}</div>
      </div>
    `, {
      className: 'civic-popup',
      maxWidth: 260,
    });

    marker.on('click', () => {
      onSelect?.(issue.issueId);
    });

    marker.addTo(map);
    markersRef.current.set(issue.issueId, marker);
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Map container */}
      <div
        ref={mapRef}
        id="civic-map"
        style={{ height, width: '100%', borderRadius: 12 }}
        aria-label="Civic issue priority map"
      />

      {/* Legend overlay */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        left: 16,
        background: 'rgba(11,13,15,0.9)',
        border: '1px solid #2A2D32',
        borderRadius: 8,
        padding: '0.625rem 0.875rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        zIndex: 1000,
        fontSize: '0.75rem',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: '#9CA3AF', fontWeight: 600, marginBottom: '0.125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Priority
        </div>
        {['Critical', 'High', 'Medium', 'Low'].map(band => (
          <div key={band} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: PRIORITY_COLORS[band],
              boxShadow: band === 'Critical' ? '0 0 6px #EF444480' : 'none',
            }} />
            <span style={{ color: '#F0F0F2' }}>{band}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #2A2D32', paddingTop: '0.375rem', marginTop: '0.125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6B7280', border: '2px solid #FFB21A' }} />
            <span style={{ color: '#FFB21A' }}>Demo seed</span>
          </div>
        </div>
      </div>

      {/* Tile attribution notice */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(11,13,15,0.85)',
        border: '1px dashed #3B82F640',
        borderRadius: 6,
        padding: '0.25rem 0.625rem',
        fontSize: '0.7rem',
        color: '#3B82F6',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}>
        🔬 Synthetic coordinates · OpenStreetMap tiles (CARTO Dark)
      </div>
    </div>
  );
}
