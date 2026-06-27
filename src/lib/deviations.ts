import type { ClockDirection, DeviationSeverity } from "@prisma/client";

// Graded deviation flagging (§6.2). Stamping a little early or late is normal,
// so flagging is graded, never binary. The restaurant sets the thresholds:
//
//   • |delta| ≤ toleranceLow            → NONE  (counts as on time, no flag)
//   • toleranceLow < |delta| ≤ high     → LOW   (neutral colour, "no rush")
//   • |delta| > toleranceHigh           → HIGH  (needs attention)
//
// A *repeated pattern* — the same person, same kind of deviation several days
// in a row — is escalated to HIGH even when each single instance is only LOW.
// That pattern detection is what actually catches buddy punching or a real
// problem, not one stray late stamp.

const MS_PER_MIN = 60_000;

/** Signed minutes a stamp deviates from the shift boundary it belongs to.
 *  IN is measured against the shift start, OUT against the shift end.
 *  Positive = late / stayed over; negative = early / left under. */
export function minutesDelta(
  stampTime: Date,
  shiftStart: Date,
  shiftEnd: Date,
  direction: ClockDirection,
): number {
  const boundary = direction === "IN" ? shiftStart : shiftEnd;
  return Math.round((stampTime.getTime() - boundary.getTime()) / MS_PER_MIN);
}

export type ToleranceConfig = {
  toleranceLowMinutes: number;
  toleranceHighMinutes: number;
};

/** Grade a single deviation from its signed magnitude and the thresholds. */
export function gradeDeviation(
  delta: number,
  { toleranceLowMinutes, toleranceHighMinutes }: ToleranceConfig,
): DeviationSeverity {
  const abs = Math.abs(delta);
  if (abs <= toleranceLowMinutes) return "NONE";
  if (abs <= toleranceHighMinutes) return "LOW";
  return "HIGH";
}

/** Repeated-pattern detection (§6.2): several same-direction deviations of at
 *  least LOW severity in a row escalate to HIGH. `priorDeltas` are the person's
 *  most recent deltas for the SAME stamp direction, newest first. */
export function isRepeatedPattern(
  currentDelta: number,
  priorDeltas: number[],
  tolerance: ToleranceConfig,
  runLength = 3,
): boolean {
  const flagged = (d: number) => gradeDeviation(d, tolerance) !== "NONE";
  const sameSign = (d: number) =>
    Math.sign(d) === Math.sign(currentDelta) && currentDelta !== 0;

  if (!flagged(currentDelta)) return false;
  let run = 1; // the current stamp
  for (const d of priorDeltas) {
    if (flagged(d) && sameSign(d)) run += 1;
    else break;
    if (run >= runLength) return true;
  }
  return run >= runLength;
}

/** Final severity for a stamp: the single-instance grade, bumped to HIGH if it
 *  is part of a repeated pattern. */
export function severityForStamp(
  currentDelta: number,
  priorDeltas: number[],
  tolerance: ToleranceConfig,
): DeviationSeverity {
  const base = gradeDeviation(currentDelta, tolerance);
  if (base === "NONE") return "NONE";
  if (isRepeatedPattern(currentDelta, priorDeltas, tolerance)) return "HIGH";
  return base;
}
