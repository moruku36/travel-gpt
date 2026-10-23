// MapLibre GL globe. The map is created once; trip changes only update markers and the
// route source, so chatting never re-creates the map. Markers are plain DOM elements whose
// text is set with textContent (never innerHTML) so place names cannot inject markup.
import { useEffect, useRef, useState } from 'react';
import { GlobeControl, LngLatBounds, Map as MLMap, Marker, NavigationControl, GeolocateControl, getVersion, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Copied to /public by scripts/copy-maplibre-worker.mjs (bundling breaks the default relative URL).
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export interface MapPin {
  key: string;
  lng: number;
  lat: number;
  label: string;
  title: string;
  color: string;
  variant: 'stop' | 'candidate' | 'suggestion' | 'destination';
  dimmed?: boolean;
  badge?: string;
}

export interface RouteLine {
  key: string;
  color: string;
  coordinates: [number, number][];
  estimated: boolean;
}

export interface MapFocus {
  lng: number;
  lat: number;
  zoom: number;
  seq: number;
}

interface Props {
  pins: MapPin[];
  routes: RouteLine[];
  selectedKey: string | null;
  focus: MapFocus | null;
  fitKey: string;
  onSelect: (key: string | null) => void;
  onViewport?: (v: { lng: number; lat: number; zoom: number }) => void;
}

export default function MapView({ pins, routes, selectedKey, focus, fitKey, onSelect, onViewport }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement; sig: string }>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportRef = useRef(onViewport);
  onViewportRef.current = onViewport;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const loaded = useRef(false);

  // Fit the camera to the visible pins. Before the first 'load' the camera can still be
  // reset by the style/projection, so the fit is repeated once the map has loaded.
  const fitToPins = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts = pinsRef.current.filter((p) => !p.dimmed);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 13) });
      return;
    }
    const b = new LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 60, maxZoom: 15, duration: loaded.current ? 800 : 0 });
  };
  const fitRef = useRef(fitToPins);
  fitRef.current = fitToPins;

  // create once
  useEffect(() => {
    if (!container.current) return;
    let map: MLMap;
    try {
      map = new MLMap({
        container: container.current,
        style: MAP_STYLE,
        center: [139.7, 35.7],
        zoom: 1.6,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed('この端末では地図を表示できません（WebGL 非対応）。旅程とチャットはそのまま使えます。');
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new GlobeControl(), 'top-right');
    map.addControl(new GeolocateControl({ trackUserLocation: false, positionOptions: { enableHighAccuracy: false } }), 'top-right');
    map.on('style.load', () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch {
        // older GPUs: stay on mercator
      }
      if (!map.getSource('routes')) {
        map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
          filter: ['!=', ['get', 'estimated'], true],
        });
        map.addLayer({
          id: 'routes-estimated',
          type: 'line',
          source: 'routes',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [1, 2] },
          filter: ['==', ['get', 'estimated'], true],
        });
      }
      setReady(true);
    });
    map.once('load', () => {
      loaded.current = true;
      fitRef.current();
    });
    map.on('error', (e) => {
      // Tile hiccups are common; only surface a full failure before the style loads.
      if (!map.isStyleLoaded()) setFailed(`地図タイルを読み込めません: ${String((e as unknown as { error?: Error }).error?.message ?? '')}`.trim());
    });
    map.on('click', (e) => {
      const target = e.originalEvent.target as HTMLElement | null;
      if (!target?.closest('.pin')) onSelectRef.current(null);
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      onViewportRef.current?.({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    const current = markers.current;
    return () => {
      ro.disconnect();
      current.forEach((m) => m.marker.remove());
      current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.key);
      const sig = `${p.lng},${p.lat},${p.label},${p.color},${p.variant},${p.dimmed},${p.badge},${p.title}`;
      const existing = markers.current.get(p.key);
      if (existing && existing.sig === sig) continue;
      if (existing) existing.marker.remove();
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `pin pin-${p.variant}${p.dimmed ? ' pin-dimmed' : ''}`;
      el.style.setProperty('--pin', p.color);
      el.title = p.title;
      el.setAttribute('aria-label', p.title);
      const label = document.createElement('span');
      label.className = 'pin-label';
      label.textContent = p.label;
      el.appendChild(label);
      if (p.badge) {
        const b = document.createElement('span');
        b.className = 'pin-badge';
        b.textContent = p.badge;
        el.appendChild(b);
      }
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectRef.current(p.key);
      });
      const marker = new Marker({ element: el, anchor: p.variant === 'destination' ? 'center' : 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      markers.current.set(p.key, { marker, el, sig });
    }
    for (const [key, m] of markers.current) {
      if (!seen.has(key)) {
        m.marker.remove();
        markers.current.delete(key);
      }
    }
  }, [pins]);

  // selection highlight + bring into view
  useEffect(() => {
    for (const [key, m] of markers.current) {
      m.el.classList.toggle('pin-selected', key === selectedKey);
      m.el.style.zIndex = key === selectedKey ? '10' : '';
    }
    const map = mapRef.current;
    const sel = selectedKey ? markers.current.get(selectedKey) : undefined;
    if (map && sel) {
      const ll = sel.marker.getLngLat();
      const bounds = map.getBounds();
      if (!bounds.contains(ll)) map.easeTo({ center: ll, duration: 600 });
    }
  }, [selectedKey, pins]);

  // routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource<GeoJSONSource>('routes');
    src?.setData({
      type: 'FeatureCollection',
      features: routes
        .filter((r) => r.coordinates.length >= 2)
        .map((r) => ({
          type: 'Feature',
          properties: { color: r.color, estimated: r.estimated },
          geometry: { type: 'LineString', coordinates: r.coordinates },
        })),
    });
  }, [routes, ready]);

  // explicit focus from chat
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom, speed: 1.4, essential: true });
  }, [focus]);

  // fit to all pins when the set of places changes meaningfully (e.g. day switch)
  useEffect(() => {
    if (fitKey && loaded.current) fitRef.current();
  }, [fitKey]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map" role="region" aria-label="地図" />
      {failed && (
        <div className="map-fallback" role="status">
          {failed}
        </div>
      )}
    </div>
  );
}
