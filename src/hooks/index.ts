import { useCallback, useEffect, useRef, useState } from 'react';
import { msUntilMidnight, todayISO } from '@/utils/date';
import { useAppStore } from '@/store/appStore';

/**
 * A ticking clock that stays accurate when the tab is backgrounded: the
 * interval is cheap, and visibility changes force an immediate resync.
 */
export function useTicker(intervalMs = 1000, active = true): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => setTick(Date.now()), intervalMs);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      setTick(Date.now());
      if (document.visibilityState === 'visible') start();
      else stop();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, active]);

  return tick;
}

/** Rolls the app over to the new day at local midnight, with no reload. */
export function useDayRollover(): void {
  const setToday = useAppStore((s) => s.setToday);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setToday(todayISO());
        schedule();
      }, msUntilMidnight());
    };

    const resync = () => {
      setToday(todayISO());
      schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [setToday]);
}

/** True when the OS or the in-app setting asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const setting = useAppStore((s) => s.settings.appearance.reduceMotion);
  const [system, setSystem] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return system || setting;
}

/** Animates a number towards `value`. Snaps instantly under reduced motion. */
export function useCountUp(value: number, durationMs = 800): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs, reduced]);

  return display;
}

/** Locks body scrolling while a modal or sheet is open. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Calls `handler` on Escape. Used by every dismissible overlay. */
export function useEscapeKey(active: boolean, handler: () => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        ref.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}

/** Traps Tab focus inside a container while it is open. */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = containerRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return containerRef;
}

export interface CountdownTimer {
  remaining: number;
  running: boolean;
  finished: boolean;
  start: () => void;
  pause: () => void;
  reset: (seconds?: number) => void;
  addSeconds: (seconds: number) => void;
}

/**
 * A wall-clock countdown. Storing the deadline instead of decrementing a
 * counter keeps it accurate across backgrounded tabs and throttled timers.
 */
export function useCountdown(
  totalSeconds: number,
  onComplete?: () => void,
): CountdownTimer {
  const [target, setTarget] = useState(totalSeconds);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [paused, setPaused] = useState(totalSeconds);
  const finishedRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    setTarget(totalSeconds);
    setPaused(totalSeconds);
    setDeadline(null);
    finishedRef.current = false;
  }, [totalSeconds]);

  const tick = useTicker(250, deadline !== null);
  const remaining =
    deadline === null ? paused : Math.max(0, (deadline - tick) / 1000);

  useEffect(() => {
    if (deadline === null || finishedRef.current) return;
    if (remaining <= 0) {
      finishedRef.current = true;
      setDeadline(null);
      setPaused(0);
      completeRef.current?.();
    }
  }, [remaining, deadline]);

  const start = useCallback(() => {
    if (paused <= 0) return;
    finishedRef.current = false;
    setDeadline(Date.now() + paused * 1000);
  }, [paused]);

  const pause = useCallback(() => {
    setDeadline((current) => {
      if (current === null) return null;
      setPaused(Math.max(0, (current - Date.now()) / 1000));
      return null;
    });
  }, []);

  const reset = useCallback(
    (seconds?: number) => {
      const next = seconds ?? target;
      finishedRef.current = false;
      setDeadline(null);
      setPaused(next);
      setTarget(next);
    },
    [target],
  );

  const addSeconds = useCallback((seconds: number) => {
    finishedRef.current = false;
    setDeadline((current) => (current === null ? null : current + seconds * 1000));
    setPaused((current) => Math.max(0, current + seconds));
  }, []);

  return {
    remaining,
    running: deadline !== null,
    finished: remaining <= 0,
    start,
    pause,
    reset,
    addSeconds,
  };
}

/** Plays a short chime without shipping an audio file. */
export function useChime(): () => void {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(() => {
    try {
      type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
      if (!Ctor) return;
      if (!ctxRef.current) ctxRef.current = new Ctor();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      [880, 1174.7].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.14);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.55);
      });
    } catch {
      /* Audio is a nicety; never let it break a session. */
    }
  }, []);
}

/** Keeps the screen awake during a focus or workout session, where supported. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    type NavigatorWithWakeLock = Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        /* Denied or unsupported: the session still works. */
      }
    };
    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
