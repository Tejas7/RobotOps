import type { CanonicalEnvelopeInput, RawCaptureEntryInput } from "./schemas";

function compareIsoDate(a: string, b: string) {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (aMs !== bMs) {
    return aMs - bMs;
  }
  return a.localeCompare(b);
}

export function sortCaptureEntriesDeterministically(entries: RawCaptureEntryInput[]) {
  return [...entries].sort((left, right) => {
    const byTimestamp = compareIsoDate(left.timestamp, right.timestamp);
    if (byTimestamp !== 0) {
      return byTimestamp;
    }
    return left.capture_index - right.capture_index;
  });
}

export function sortCanonicalEnvelopesDeterministically(envelopes: CanonicalEnvelopeInput[]) {
  return [...envelopes].sort((left, right) => {
    const byType = left.message_type.localeCompare(right.message_type);
    if (byType !== 0) {
      return byType;
    }
    const byTimestamp = compareIsoDate(left.timestamp, right.timestamp);
    if (byTimestamp !== 0) {
      return byTimestamp;
    }
    return left.message_id.localeCompare(right.message_id);
  });
}

export interface CanonicalEnvelopeDiffItem {
  index: number;
  expected: CanonicalEnvelopeInput | null;
  actual: CanonicalEnvelopeInput | null;
}

export interface CanonicalEnvelopeComparisonResult {
  matches: boolean;
  diffs: CanonicalEnvelopeDiffItem[];
}

export function compareCanonicalEnvelopeSets(actual: CanonicalEnvelopeInput[], expected: CanonicalEnvelopeInput[]) {
  const sortedActual = sortCanonicalEnvelopesDeterministically(actual);
  const sortedExpected = sortCanonicalEnvelopesDeterministically(expected);
  const diffs: CanonicalEnvelopeDiffItem[] = [];

  const len = Math.max(sortedActual.length, sortedExpected.length);
  for (let index = 0; index < len; index += 1) {
    const actualItem = sortedActual[index] ?? null;
    const expectedItem = sortedExpected[index] ?? null;
    if (!actualItem || !expectedItem) {
      diffs.push({
        index,
        expected: expectedItem,
        actual: actualItem
      });
      continue;
    }

    const actualJson = JSON.stringify(actualItem);
    const expectedJson = JSON.stringify(expectedItem);
    if (actualJson !== expectedJson) {
      diffs.push({
        index,
        expected: expectedItem,
        actual: actualItem
      });
    }
  }

  return {
    matches: diffs.length === 0,
    diffs
  } satisfies CanonicalEnvelopeComparisonResult;
}
