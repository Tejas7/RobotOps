"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTitle } from "@/components/pages/page-title";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useRbac } from "@/hooks/use-rbac";
import { useGlobalFilters } from "@/store/use-global-filters";
import { formatDate } from "@/lib/utils";

interface Robot {
  id: string;
  name: string;
  status: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  robotId: string | null;
}

interface SessionRecord {
  id: string;
  robotId: string;
  startedAt: string;
  endedAt: string | null;
  reason: "incident_response" | "testing" | "recovery" | "training";
  notes: string;
  source: "incident" | "robot";
}

export default function TeleoperationPage() {
  const searchParams = useSearchParams();
  const source = (searchParams?.get("source") as "incident" | "robot" | null) ?? "robot";

  const { siteId } = useGlobalFilters();
  const { can } = useRbac();
  const { connected } = useLiveSocket();

  const robotsQuery = useAuthedQuery<Robot[]>(["teleop-robots", siteId], `/robots/last_state?site_id=${siteId}`);
  const incidentsQuery = useAuthedQuery<Incident[]>(["teleop-incidents", siteId], `/incidents?site_id=${siteId}&status=open`);

  const [selectedRobotId, setSelectedRobotId] = useState<string>("r1");
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [reason, setReason] = useState<SessionRecord["reason"]>("incident_response");
  const [notes, setNotes] = useState("Operator intervention for blocked mission.");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const latencyMs = connected ? 42 : 0;
  const connectionQuality = connected ? (latencyMs < 80 ? "Good" : latencyMs < 150 ? "Fair" : "Poor") : "Disconnected";

  const canStart = can("teleop.start");
  const canStop = can("teleop.stop");

  const recommendedRobot = useMemo(() => {
    if (source === "incident") {
      return incidentsQuery.data?.find((incident) => incident.robotId)?.robotId ?? selectedRobotId;
    }
    return selectedRobotId;
  }, [incidentsQuery.data, selectedRobotId, source]);

  function startSession() {
    if (!canStart) {
      return;
    }

    const sessionRecord: SessionRecord = {
      id: `ts-${Date.now()}`,
      robotId: recommendedRobot,
      startedAt: new Date().toISOString(),
      endedAt: null,
      reason,
      notes,
      source
    };
    setActiveSession(sessionRecord);
  }

  function endSession() {
    if (!activeSession || !canStop) {
      return;
    }

    const finished = {
      ...activeSession,
      endedAt: new Date().toISOString(),
      notes
    };
    setHistory((current) => [finished, ...current]);
    setActiveSession(null);
    setConfirmEnd(false);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Teleoperation" subtitle="Remote intervention with permission-gated controls and session metadata logging." />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardTitle>Video stream placeholder</CardTitle>
          <CardMeta>Dummy stream URL: wss://video.robotops.local/stream/{recommendedRobot}</CardMeta>
          <div className="mt-4 h-[380px] rounded-3xl border border-border bg-slate-900 p-4 text-slate-100">
            <div className="flex h-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-950">
              <p className="text-sm">Teleop video placeholder for robot {recommendedRobot}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <p className="rounded-xl border border-border bg-surface p-2">Latency: {latencyMs} ms</p>
            <p className="rounded-xl border border-border bg-surface p-2">Connection: {connectionQuality}</p>
            <p className="rounded-xl border border-border bg-surface p-2">WebSocket: {connected ? "Connected" : "Disconnected"}</p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <Button disabled={!canStart || Boolean(activeSession)} onClick={startSession}>Start session</Button>
            <Button variant="secondary" disabled={!activeSession || !canStop} onClick={() => setConfirmEnd(true)}>
              End session
            </Button>
            <Button variant="danger" disabled={!activeSession || !canStop}>Emergency hold</Button>
          </div>

          {!canStart ? <p className="mt-2 text-xs text-muted">Missing `teleop.start` permission.</p> : null}
          {!canStop ? <p className="text-xs text-muted">Missing `teleop.stop` permission.</p> : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Session controls</CardTitle>
            <div className="mt-2 space-y-2 text-sm">
              <label className="block">
                Start from
                <select
                  className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2"
                  value={source}
                  disabled
                >
                  <option value="incident">Incident context</option>
                  <option value="robot">Robot detail context</option>
                </select>
              </label>

              <label className="block">
                Robot
                <select
                  className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2"
                  value={selectedRobotId}
                  onChange={(event) => setSelectedRobotId(event.target.value)}
                >
                  {(robotsQuery.data ?? []).map((robot) => (
                    <option key={robot.id} value={robot.id}>
                      {robot.name} ({robot.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                Reason
                <select
                  className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2"
                  value={reason}
                  onChange={(event) => setReason(event.target.value as SessionRecord["reason"])}
                >
                  <option value="incident_response">incident_response</option>
                  <option value="testing">testing</option>
                  <option value="recovery">recovery</option>
                  <option value="training">training</option>
                </select>
              </label>

              <label className="block">
                Notes
                <textarea
                  className="mt-1 h-24 w-full rounded-2xl border border-border bg-white p-2"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            </div>
          </Card>

          <Card>
            <CardTitle>Session recording metadata</CardTitle>
            <ul className="mt-2 space-y-2 text-xs text-muted">
              {activeSession ? (
                <li className="rounded-xl border border-border bg-surface p-2">
                  Active: {activeSession.id} • started {formatDate(activeSession.startedAt)}
                </li>
              ) : null}
              {history.map((record) => (
                <li key={record.id} className="rounded-xl border border-border bg-surface p-2">
                  {record.robotId} • {record.reason} • {formatDate(record.startedAt)} - {formatDate(record.endedAt)}
                </li>
              ))}
              {!activeSession && history.length === 0 ? <li>No sessions recorded yet.</li> : null}
            </ul>
          </Card>

          <Card>
            <CardTitle>Open incidents context</CardTitle>
            <ul className="mt-2 space-y-2 text-xs text-muted">
              {(incidentsQuery.data ?? []).map((incident) => (
                <li key={incident.id} className="rounded-xl border border-border bg-surface p-2">
                  {incident.title} ({incident.robotId ?? "no robot"})
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="End teleoperation session"
        description="Ending the session will store reason and notes metadata in the local session history panel."
        confirmLabel="End session"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={endSession}
      />
    </div>
  );
}
