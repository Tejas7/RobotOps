export const LIVE_STREAMS = ["robot_last_state", "incidents", "missions"] as const;

export type LiveStreamName = (typeof LIVE_STREAMS)[number];

export interface LiveCursorV1 {
  v: 1;
  t: string;
  id: string;
}

export interface LiveSubscribePayload {
  tenant_id?: string;
  site_id: string;
  streams: LiveStreamName[];
  cursor?: Partial<Record<LiveStreamName, string>>;
}

export interface LiveDeltaEnvelope<T = unknown> {
  stream: LiveStreamName;
  cursor: string;
  upserts: T[];
  deletes: string[];
  snapshot: boolean;
  batch_index: number;
  batch_total: number;
}

export type LiveUpsert<T> = T;
export type LiveDelete = string;

export interface LiveReconcileResult<T extends { id: string }> {
  items: T[];
  appliedUpserts: number;
  appliedDeletes: number;
}

function encodeBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  if (typeof btoa !== "undefined") {
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  throw new Error("No base64url encoder available");
}

function decodeBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  if (typeof atob !== "undefined") {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  }

  throw new Error("No base64url decoder available");
}

function normalizeCursorValue(raw: unknown): LiveCursorV1 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.v !== 1 || typeof candidate.t !== "string" || typeof candidate.id !== "string") {
    return null;
  }

  const timestamp = new Date(candidate.t);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  if (!candidate.id.trim()) {
    return null;
  }

  return {
    v: 1,
    t: timestamp.toISOString(),
    id: candidate.id
  };
}

export function encodeLiveCursor(cursor: LiveCursorV1): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function createLiveCursor(timestamp: string | Date, id: string): LiveCursorV1 {
  return {
    v: 1,
    t: (timestamp instanceof Date ? timestamp : new Date(timestamp)).toISOString(),
    id
  };
}

export function decodeLiveCursor(cursor: string): LiveCursorV1 | null {
  try {
    const decoded = decodeBase64Url(cursor);
    const parsed = JSON.parse(decoded) as unknown;
    return normalizeCursorValue(parsed);
  } catch {
    return null;
  }
}

export function compareLiveCursor(left: string | null | undefined, right: string | null | undefined): -1 | 0 | 1 {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }

  const leftCursor = decodeLiveCursor(left);
  const rightCursor = decodeLiveCursor(right);

  if (!leftCursor || !rightCursor) {
    return left === right ? 0 : left > right ? 1 : -1;
  }

  const leftTime = new Date(leftCursor.t).getTime();
  const rightTime = new Date(rightCursor.t).getTime();

  if (leftTime === rightTime) {
    if (leftCursor.id === rightCursor.id) {
      return 0;
    }
    return leftCursor.id > rightCursor.id ? 1 : -1;
  }

  return leftTime > rightTime ? 1 : -1;
}

export function isCursorAfter(candidate: string | null | undefined, current: string | null | undefined): boolean {
  return compareLiveCursor(candidate, current) === 1;
}

export function reconcileLiveCollection<T extends { id: string }>(
  current: readonly T[],
  upserts: readonly T[],
  deletes: readonly string[],
  options?: {
    sort?: (left: T, right: T) => number;
  }
): LiveReconcileResult<T> {
  const byId = new Map<string, T>(current.map((item) => [item.id, item]));
  let appliedUpserts = 0;
  let appliedDeletes = 0;

  for (const upsert of upserts) {
    byId.set(upsert.id, upsert);
    appliedUpserts += 1;
  }

  for (const id of deletes) {
    if (byId.delete(id)) {
      appliedDeletes += 1;
    }
  }

  const items = [...byId.values()];
  if (options?.sort) {
    items.sort(options.sort);
  }

  return {
    items,
    appliedUpserts,
    appliedDeletes
  };
}
