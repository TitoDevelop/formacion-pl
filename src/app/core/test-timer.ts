import { signal } from '@angular/core';

export interface AttemptTiming {
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
}

export interface TimerResumeState {
  startedAt: string;
  elapsedSeconds: number;
}

type ActiveTimerState = {
  startedAtMs: number;
  accumulatedSeconds: number;
  segmentStartedAtMs: number;
};

export function formatDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const twoDigits = (value: number) => value.toString().padStart(2, '0');

  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(remainder)}`
    : `${twoDigits(minutes)}:${twoDigits(remainder)}`;
}

export class TestTimer {
  readonly elapsedSeconds = signal(0);

  private startedAtMs = 0;
  private accumulatedSeconds = 0;
  private segmentStartedAtMs = 0;
  private storageKey = '';
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(key: string, resumeState?: TimerResumeState): void {
    this.stop();
    this.storageKey = `alpha-test-start:${key}`;

    const storedState = this.readStoredState();
    const resumedStartedAt = resumeState ? Date.parse(resumeState.startedAt) : NaN;
    const now = Date.now();
    const state = storedState ?? {
      startedAtMs: Number.isFinite(resumedStartedAt) ? resumedStartedAt : now,
      accumulatedSeconds: Math.max(0, Math.floor(resumeState?.elapsedSeconds ?? 0)),
      segmentStartedAtMs: now
    };

    this.startedAtMs = state.startedAtMs;
    this.accumulatedSeconds = state.accumulatedSeconds;
    this.segmentStartedAtMs = state.segmentStartedAtMs;
    if (storedState === null) this.storeState(state);

    this.updateElapsed();
    this.intervalId = setInterval(() => this.updateElapsed(), 1000);
  }

  snapshot(): AttemptTiming {
    const finishedAtMs = Date.now();
    return {
      startedAt: new Date(this.startedAtMs || finishedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationSeconds: this.elapsedAt(finishedAtMs)
    };
  }

  pause(): TimerResumeState {
    const state = {
      startedAt: new Date(this.startedAtMs || Date.now()).toISOString(),
      elapsedSeconds: this.elapsedAt(Date.now())
    };
    this.clear();
    this.elapsedSeconds.set(state.elapsedSeconds);
    return state;
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  clear(): void {
    this.stop();
    if (!this.storageKey) return;
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      // El temporizador sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }

  private updateElapsed(): void {
    this.elapsedSeconds.set(this.elapsedAt(Date.now()));
  }

  private elapsedAt(now: number): number {
    return Math.max(0, this.accumulatedSeconds + Math.floor((now - this.segmentStartedAtMs) / 1000));
  }

  private readStoredState(): ActiveTimerState | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return null;

      // Compatibilidad con los timestamps guardados por la primera versión.
      if (!raw.startsWith('{')) {
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 && value <= Date.now()
          ? { startedAtMs: value, accumulatedSeconds: 0, segmentStartedAtMs: value }
          : null;
      }

      const state = JSON.parse(raw) as Partial<ActiveTimerState>;
      return typeof state.startedAtMs === 'number' && Number.isFinite(state.startedAtMs) &&
        typeof state.accumulatedSeconds === 'number' && Number.isFinite(state.accumulatedSeconds) &&
        typeof state.segmentStartedAtMs === 'number' && Number.isFinite(state.segmentStartedAtMs) &&
        state.segmentStartedAtMs <= Date.now()
        ? state as ActiveTimerState
        : null;
    } catch {
      return null;
    }
  }

  private storeState(state: ActiveTimerState): void {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // El cálculo en memoria sigue siendo válido durante la sesión actual.
    }
  }
}
