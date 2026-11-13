export type BreathPhaseKind = 'in' | 'hold' | 'out';

export type BreathPhase = {
  kind: BreathPhaseKind;
  label: string;
  seconds: number;
};

export type BreathPattern = {
  id: string;
  title: string;
  /** The phase lengths, for example "4 · 4 · 4 · 4". */
  summary: string;
  description: string;
  phases: BreathPhase[];
};

const breatheIn = (seconds: number): BreathPhase => ({ kind: 'in', label: 'Breathe in', seconds });
const hold = (seconds: number): BreathPhase => ({ kind: 'hold', label: 'Hold', seconds });
const breatheOut = (seconds: number): BreathPhase => ({ kind: 'out', label: 'Breathe out', seconds });

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'box',
    title: 'Box',
    summary: '4 · 4 · 4 · 4',
    description: 'Equal sides, like a square. Steadies a busy mind.',
    phases: [breatheIn(4), hold(4), breatheOut(4), hold(4)],
  },
  {
    id: 'long-exhale',
    title: 'Long exhale',
    summary: '4 · 7 · 8',
    description: 'A slow breath out. Good before sleep.',
    phases: [breatheIn(4), hold(7), breatheOut(8)],
  },
  {
    id: 'even',
    title: 'Even',
    summary: '5 · 5',
    description: 'In and out at the same pace. Simple and calm.',
    phases: [breatheIn(5), breatheOut(5)],
  },
];

export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.phases.reduce((total, phase) => total + phase.seconds, 0);
}

export type BreathMoment = {
  /** Index into `pattern.phases`. */
  phaseIndex: number;
  phase: BreathPhase;
  /** Whole seconds left in this phase, counting down to 1. */
  secondsLeft: number;
  /** Full cycles finished so far. */
  cycles: number;
};

/** Where a session is after `elapsedSeconds`, so the screen can be drawn from the clock alone. */
export function breathMomentAt(pattern: BreathPattern, elapsedSeconds: number): BreathMoment {
  const total = cycleSeconds(pattern);
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const cycles = Math.floor(elapsed / total);
  let intoCycle = elapsed - cycles * total;
  for (let phaseIndex = 0; phaseIndex < pattern.phases.length; phaseIndex++) {
    const phase = pattern.phases[phaseIndex];
    if (intoCycle < phase.seconds) {
      return { phaseIndex, phase, secondsLeft: Math.ceil(phase.seconds - intoCycle), cycles };
    }
    intoCycle -= phase.seconds;
  }
  // Only reachable through floating point rounding at a cycle boundary.
  return { phaseIndex: 0, phase: pattern.phases[0], secondsLeft: pattern.phases[0].seconds, cycles };
}
