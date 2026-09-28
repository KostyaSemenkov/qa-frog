import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound, advanceRound, registerCatch, tongueProgress } from '../public/round.js';

test('pausing does not consume game time; time expires precisely even on slow frames', () => {
  const round = createRound(); round.status = 'running'; advanceRound(round, 12.5);
  round.status = 'paused'; advanceRound(round, 120); assert.equal(round.remaining, 47.5);
  round.status = 'running'; advanceRound(round, 100); assert.equal(round.remaining, 0);
  assert.equal(round.elapsed, 60); assert.equal(round.status, 'settling');
});
test('a catch started before timeout counts when the tongue returns; ended and paused rounds cannot score', () => {
  const round = createRound(); round.status = 'running'; advanceRound(round, 60);
  assert.equal(registerCatch(round), true); assert.equal(round.score, 1);
  round.status = 'ended'; assert.equal(registerCatch(round), false);
  round.status = 'paused'; assert.equal(registerCatch(round), false); assert.equal(round.score, 1);
});
test('tongue reaches a beetle, holds it and retracts fully', () => {
  assert.equal(tongueProgress(0), 0); assert.equal(tongueProgress(.16), 1);
  assert.equal(tongueProgress(.22), 1); assert.ok(tongueProgress(.35) > 0 && tongueProgress(.35) < 1);
  assert.equal(tongueProgress(.48), 0);
});
