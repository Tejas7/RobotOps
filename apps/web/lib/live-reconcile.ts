import {
  isCursorAfter,
  reconcileLiveCollection,
  type LiveDeltaEnvelope,
  type LiveStreamName
} from "@robotops/shared";

interface ReconcileParams<T extends { id: string }> {
  expectedStream: LiveStreamName;
  envelope: LiveDeltaEnvelope<unknown>;
  currentCursor?: string;
  currentItems: readonly T[];
  mapUpsert: (value: unknown) => T | null;
  sort?: (left: T, right: T) => number;
}

interface ReconcileDeltaResult<T extends { id: string }> {
  applied: boolean;
  cursor?: string;
  items: T[];
}

export function reconcileLiveDelta<T extends { id: string }>(params: ReconcileParams<T>): ReconcileDeltaResult<T> {
  if (params.envelope.stream !== params.expectedStream) {
    return {
      applied: false,
      cursor: params.currentCursor,
      items: [...params.currentItems]
    };
  }

  if (!isCursorAfter(params.envelope.cursor, params.currentCursor)) {
    return {
      applied: false,
      cursor: params.currentCursor,
      items: [...params.currentItems]
    };
  }

  const upserts: T[] = [];
  for (const value of params.envelope.upserts) {
    const mapped = params.mapUpsert(value);
    if (mapped) {
      upserts.push(mapped);
    }
  }

  const reconciled = reconcileLiveCollection(params.currentItems, upserts, params.envelope.deletes, {
    sort: params.sort
  });

  return {
    applied: true,
    cursor: params.envelope.cursor,
    items: reconciled.items
  };
}
