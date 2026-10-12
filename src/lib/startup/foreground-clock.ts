/** Track visible time independently of wall time; visibility events update the clock. */
export function createForegroundClock(startedAt: number, visible: boolean) {
  let last = startedAt, active = 0, foreground = visible;
  const sample = (now: number) => {
    if (foreground) active += Math.max(0, now - last);
    last = now;
    const elapsed = Math.max(0, now - startedAt);
    return { elapsed, foreground: active, background: Math.max(0, elapsed - active) };
  };
  return { sample, setVisible(now: number, next: boolean) { sample(now); foreground = next; } };
}
