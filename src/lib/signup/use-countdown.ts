'use client';

// =============================================================================
// signup/use-countdown — the final-screen urgency timer.
//
// Session-honest: the start time is stored in sessionStorage, so the timer
// survives a refresh and does NOT reset (a resetting timer is a tell). It
// starts the first time the hook mounts — i.e. when the offer screen renders.
// =============================================================================

import { useEffect, useState } from 'react';

const START_KEY = 'webnua.signup.countdown-start';

export type Countdown = {
  remaining: number;
  expired: boolean;
};

export function useCountdown(totalSeconds: number): Countdown {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    let start = Number(sessionStorage.getItem(START_KEY));
    if (!start || Number.isNaN(start)) {
      start = Date.now();
      sessionStorage.setItem(START_KEY, String(start));
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setRemaining(Math.max(0, totalSeconds - elapsed));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [totalSeconds]);

  return { remaining, expired: remaining <= 0 };
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
