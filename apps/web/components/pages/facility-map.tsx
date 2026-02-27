"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type Map, type Marker } from "maplibre-gl";

interface Point {
  x: number;
  y: number;
}

interface MapRobot {
  id: string;
  name: string;
  status: string;
  x: number;
  y: number;
}

interface MapAsset {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

interface MapZone {
  id: string;
  name: string;
  type: string;
  polygon: Point[];
}

interface FacilityMapProps {
  floorplanImageUrl?: string;
  robots?: MapRobot[];
  assets?: MapAsset[];
  zones?: MapZone[];
  className?: string;
}

const ORIGIN = { lon: -79.384, lat: 43.653 };
const SCALE = 0.00001;

function toLngLat(point: Point): [number, number] {
  return [ORIGIN.lon + point.x * SCALE, ORIGIN.lat - point.y * SCALE];
}

export function FacilityMap({
  floorplanImageUrl = "/static/floorplans/warehouse_demo.png",
  robots = [],
  assets = [],
  zones = [],
  className = "h-[460px]"
}: FacilityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRefs = useRef<Marker[]>([]);

  const floorplanBounds = useMemo(
    () =>
      [
        toLngLat({ x: 0, y: 0 }),
        toLngLat({ x: 320, y: 0 }),
        toLngLat({ x: 320, y: 200 }),
        toLngLat({ x: 0, y: 200 })
      ] as [[number, number], [number, number], [number, number], [number, number]],
    []
  );

  const resolvedFloorplanImageUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return floorplanImageUrl;
    }
    try {
      return new URL(floorplanImageUrl, window.location.origin).toString();
    } catch {
      return floorplanImageUrl;
    }
  }, [floorplanImageUrl]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: toLngLat({ x: 160, y: 100 }),
      zoom: 18,
      minZoom: 16,
      maxZoom: 21,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      if (!map.getSource("floorplan-image")) {
        map.addSource("floorplan-image", {
          type: "image",
          url: resolvedFloorplanImageUrl,
          coordinates: floorplanBounds
        });
        map.addLayer({
          id: "floorplan-image-layer",
          type: "raster",
          source: "floorplan-image",
          paint: {
            "raster-opacity": 0.9
          }
        });
      }
    });

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [floorplanBounds, resolvedFloorplanImageUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const sourceId = "zones-source";
    const fillLayerId = "zones-fill";
    const lineLayerId = "zones-line";

    const zoneFeatures = zones.map((zone) => ({
      type: "Feature",
      properties: {
        id: zone.id,
        name: zone.name,
        type: zone.type
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...zone.polygon.map((point) => toLngLat(point)), toLngLat(zone.polygon[0])]]
      }
    }));

    const sourceData = {
      type: "FeatureCollection",
      features: zoneFeatures
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(sourceData as any);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: sourceData as any
      });
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.12
        }
      });
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#2563eb",
          "line-width": 1.5
        }
      });
    }
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    robots.forEach((robot) => {
      const element = document.createElement("div");
      element.className = "rounded-full border border-white bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow";
      element.textContent = robot.name;

      const marker = new maplibregl.Marker({ element }).setLngLat(toLngLat({ x: robot.x, y: robot.y })).addTo(map);
      markerRefs.current.push(marker);
    });

    assets.forEach((asset) => {
      const element = document.createElement("div");
      element.className = "rounded-full border border-slate-700 bg-white px-2 py-0.5 text-[10px] text-slate-700 shadow";
      element.textContent = asset.name;

      const marker = new maplibregl.Marker({ element }).setLngLat(toLngLat({ x: asset.x, y: asset.y })).addTo(map);
      markerRefs.current.push(marker);
    });
  }, [robots, assets]);

  return <div ref={containerRef} className={`w-full overflow-hidden rounded-3xl border border-border ${className}`} />;
}
