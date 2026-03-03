"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { FacilityMap } from "@/components/pages/facility-map";
import { PageTitle } from "@/components/pages/page-title";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { type LiveDeltaPayload, useLiveSocket } from "@/hooks/use-live-socket";
import { reconcileLiveDelta } from "@/lib/live-reconcile";
import { useGlobalFilters } from "@/store/use-global-filters";

interface Floorplan {
  id: string;
  name: string;
  imageUrl: string;
  zones: Array<{ id: string; name: string; type: string; polygon: Array<{ x: number; y: number }> }>;
}

interface Robot {
  id: string;
  name: string;
  status: string;
  x: number;
  y: number;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  proximityEvents: Array<{ id: string; riskLevel: string; distanceM: number; timestamp: string }>;
}

interface RobotPathResponse {
  robotId: string;
  from: string;
  to: string;
  intervalSeconds: number;
  totalPoints: number;
  points: Array<{
    id: string;
    floorplanId: string;
    x: number;
    y: number;
    headingDegrees: number;
    confidence: number;
    timestamp: string;
  }>;
}

export default function FacilityPage() {
  const { siteId } = useGlobalFilters();
  const { socket } = useLiveSocket({
    siteId,
    streams: ["robot_last_state"]
  });
  const floorplansQuery = useAuthedQuery<Floorplan[]>(["floorplans", siteId], `/floorplans?site_id=${siteId}`);
  const robotsQuery = useAuthedQuery<Robot[]>(["robots-last-state", siteId], `/robots/last_state?site_id=${siteId}`);
  const assetsQuery = useAuthedQuery<Asset[]>(["assets", siteId], `/rtls/assets?site_id=${siteId}`);

  const [liveRobots, setLiveRobots] = useState<Robot[] | null>(null);
  const robotCursorRef = useRef<string | undefined>(undefined);
  const [selectedFloorplanId, setSelectedFloorplanId] = useState("f1");
  const [showZones, setShowZones] = useState(true);
  const [showRobots, setShowRobots] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showProximity, setShowProximity] = useState(true);
  const [playbackPosition, setPlaybackPosition] = useState(80);
  const [playbackRobotId, setPlaybackRobotId] = useState("");
  const [incidentNote, setIncidentNote] = useState("Potential congestion near High Traffic Aisle");

  const robots = liveRobots ?? robotsQuery.data ?? [];

  useEffect(() => {
    if (!playbackRobotId && robots.length > 0) {
      setPlaybackRobotId(robots[0].id);
    }
  }, [playbackRobotId, robots]);

  const pathQuery = useAuthedQuery<RobotPathResponse>(
    ["robot-path", siteId, playbackRobotId],
    playbackRobotId ? `/robots/${playbackRobotId}/path?interval_seconds=20` : undefined
  );

  useEffect(() => {
    setLiveRobots(null);
    robotCursorRef.current = undefined;
  }, [siteId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const mapRobot = (value: unknown): Robot | null => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const row = value as { id?: unknown };
      if (typeof row.id !== "string") {
        return null;
      }
      return value as Robot;
    };

    const onDelta = (payload: LiveDeltaPayload<unknown>) => {
      setLiveRobots((current) => {
        const reconciled = reconcileLiveDelta<Robot>({
          expectedStream: "robot_last_state",
          envelope: payload,
          currentCursor: robotCursorRef.current,
          currentItems: current ?? robotsQuery.data ?? [],
          mapUpsert: mapRobot,
          sort: (left, right) => left.name.localeCompare(right.name)
        });

        if (!reconciled.applied) {
          return current;
        }

        robotCursorRef.current = reconciled.cursor;
        return reconciled.items;
      });
    };

    socket.on("delta", onDelta);
    return () => {
      socket.off("delta", onDelta);
    };
  }, [robotsQuery.data, socket]);

  const floorplans = floorplansQuery.data ?? [];

  useEffect(() => {
    if (!selectedFloorplanId && floorplans[0]?.id) {
      setSelectedFloorplanId(floorplans[0].id);
    }
  }, [floorplans, selectedFloorplanId]);

  const floorplan = useMemo(
    () => floorplans.find((entry) => entry.id === selectedFloorplanId) ?? floorplans[0],
    [floorplans, selectedFloorplanId]
  );

  const selectedRobot = robots.find((robot) => robot.id === playbackRobotId);

  const pathPoints = (pathQuery.data?.points ?? []).filter(
    (entry) => !floorplan?.id || entry.floorplanId === floorplan.id
  );

  const proximityEvents = (assetsQuery.data ?? [])
    .flatMap((asset) => asset.proximityEvents.map((event) => ({ ...event, assetName: asset.name })))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageTitle title="Facility" subtitle="Spatial operations view across robots, zones, mission context, and RTLS assets." />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Facility map</CardTitle>
                <CardMeta>Full-width map with floorplan overlay, live layers, and playback trails</CardMeta>
              </div>
              <select
                className="rounded-full border border-border bg-white px-3 py-2 text-sm"
                aria-label="Select floorplan"
                value={floorplan?.id ?? ""}
                onChange={(event) => setSelectedFloorplanId(event.target.value)}
              >
                {floorplans.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <FacilityMap
                className="h-[620px]"
                floorplanImageUrl={floorplan?.imageUrl}
                zones={showZones ? floorplan?.zones ?? [] : []}
                robots={
                  showRobots
                    ? robots.map((robot) => ({
                        id: robot.id,
                        name: robot.name,
                        status: robot.status,
                        x: robot.x,
                        y: robot.y
                      }))
                    : []
                }
                assets={
                  showAssets
                    ? (assetsQuery.data ?? []).map((asset) => ({
                        id: asset.id,
                        name: asset.name,
                        type: asset.type,
                        x: asset.x,
                        y: asset.y
                      }))
                    : []
                }
                trails={
                  pathPoints.length
                    ? [
                        {
                          robotId: playbackRobotId,
                          points: pathPoints.map((point) => ({ x: point.x, y: point.y }))
                        }
                      ]
                    : []
                }
                playbackPercent={playbackPosition}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Layer toggles</CardTitle>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showZones} onChange={(event) => setShowZones(event.target.checked)} /> Zones
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showRobots} onChange={(event) => setShowRobots(event.target.checked)} /> Robots
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showAssets} onChange={(event) => setShowAssets(event.target.checked)} /> RTLS assets
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showProximity} onChange={(event) => setShowProximity(event.target.checked)} /> Proximity events
              </label>
            </div>
          </Card>

          <Card>
            <CardTitle>Playback scrubber</CardTitle>
            <CardMeta>Historical path playback for selected robot</CardMeta>
            <select
              className="mt-3 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
              value={playbackRobotId}
              onChange={(event) => setPlaybackRobotId(event.target.value)}
              aria-label="Playback robot"
            >
              <option value="">Select robot</option>
              {robots.map((robot) => (
                <option key={robot.id} value={robot.id}>
                  {robot.name}
                </option>
              ))}
            </select>
            <input
              type="range"
              min={0}
              max={100}
              aria-label="Playback position"
              value={playbackPosition}
              onChange={(event) => setPlaybackPosition(Number(event.target.value))}
              className="mt-3 w-full"
            />
            <p className="mt-2 text-xs text-muted">
              Playback: {playbackPosition}% • {selectedRobot?.name ?? "No robot selected"} • {pathPoints.length}/
              {pathQuery.data?.totalPoints ?? 0} points
            </p>
          </Card>

          <Card>
            <CardTitle>Measure distance tool</CardTitle>
            <CardMeta>Stub for path and clearance measurements</CardMeta>
            <p className="mt-2 text-sm text-muted">Click two points on map to measure distance (Phase 2 interaction).</p>
            <Button variant="secondary" className="mt-3 w-full">Start measure mode</Button>
          </Card>

          <Card>
            <CardTitle>Incident pin and note</CardTitle>
            <textarea
              aria-label="Incident note"
              className="mt-2 h-24 w-full rounded-2xl border border-border bg-white p-2 text-sm"
              value={incidentNote}
              onChange={(event) => setIncidentNote(event.target.value)}
            />
            <Button className="mt-2 w-full">Drop incident pin</Button>
          </Card>

          {showProximity ? (
            <Card>
              <CardTitle>Proximity events</CardTitle>
              <ul className="mt-2 space-y-2 text-xs text-muted">
                {proximityEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-border bg-surface p-2">
                    {event.assetName}: {event.riskLevel} risk at {event.distanceM.toFixed(1)}m
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
