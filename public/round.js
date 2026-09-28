export const ROUND_SECONDS = 60;
export function createRound() {
  return { status: 'ready', remaining: ROUND_SECONDS, elapsed: 0, score: 0, streak: 0, lastCatch: -Infinity };
}
export function advanceRound(round, seconds) {
  if (round.status !== 'running') return;
  const elapsed = Math.min(Math.max(0, seconds), round.remaining);
  round.remaining = Math.max(0, round.remaining - elapsed);
  round.elapsed += elapsed;
  if (round.remaining === 0) round.status = 'settling';
}
export function registerCatch(round) {
  if (!['running', 'settling'].includes(round.status)) return false;
  round.score += 1;
  round.streak = round.elapsed - round.lastCatch < 2 ? round.streak + 1 : 1;
  round.lastCatch = round.elapsed;
  return true;
}
export function tongueProgress(seconds) {
  if (seconds < 0.16) return Math.max(0, seconds / 0.16);
  if (seconds < 0.23) return 1;
  return Math.max(0, 1 - (seconds - 0.23) / 0.24);
}
