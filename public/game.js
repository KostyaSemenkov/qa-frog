import { createRound, advanceRound, registerCatch, tongueProgress, ROUND_SECONDS } from './round.js';

const $ = id => document.getElementById(id);
const scene = $('scene'), frog = $('frog-wrap'), bugsLayer = $('bugs');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const bugsWord = n => n % 100 >= 11 && n % 100 <= 14 ? 'жуков' : n % 10 === 1 ? 'жук' : n % 10 >= 2 && n % 10 <= 4 ? 'жука' : 'жуков';
let round = createRound(), bugs = [], queue = [], shot = null, nextId = 1;
let width = 1000, height = 480, bugSize = 84, bugHeight = 76;
let sound = true, audio = null, nextTalk = 4, speechLeft = 0, best = 0;
let priorStatus = 'running', previousFrame = 0, spawnClock = 0;
try { best = Math.max(0, Math.floor(Number(localStorage.getItem('qa-frog-best')) || 0)); if (!Number.isFinite(best)) best = 0; } catch {}
$('best').replaceChildren(String(best), Object.assign(document.createElement('small'), { textContent: ` ${bugsWord(best)}` }));

function resize() {
  width = scene.clientWidth; height = scene.clientHeight;
  bugSize = width < 620 ? 72 : 84; bugHeight = width < 620 ? 67 : 76;
  $('tongue-layer').setAttribute('viewBox', `0 0 ${width} ${height}`);
  for (const bug of bugs) {
    bug.x = Math.max(bugSize / 2, Math.min(width - bugSize / 2, bug.x));
    bug.baseY = Math.min(height * .53, bug.baseY);
  }
}
new ResizeObserver(resize).observe(scene);

function initAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !audio) audio = new Audio();
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}
function note(frequency, end, duration, delay = 0, volume = .07) {
  if (!sound || !audio || audio.state !== 'running') return;
  const now = audio.currentTime + delay;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .015);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(now); oscillator.stop(now + duration + .02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function speak() {
  speechLeft = 1.9; $('speech').classList.add('visible');
  if (!sound) return;
  // Two croaks also work in browsers that do not provide speech voices.
  note(260, 90, .22, 0, .10); note(290, 100, .25, .28, .10);
  if ('speechSynthesis' in window && !speechSynthesis.speaking) {
    const utterance = new SpeechSynthesisUtterance('qa qa');
    utterance.lang = 'en-US'; utterance.pitch = .7; utterance.rate = .9; utterance.volume = .55;
    speechSynthesis.speak(utterance);
  }
}
function stopAudio() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

function spawnBug(decorative = false) {
  const el = document.createElement('button');
  const id = nextId++;
  el.className = 'bug'; el.type = 'button'; el.setAttribute('aria-label', `Поймать жука ${id}`);
  el.innerHTML = '<img src="/assets/beetle.png" alt="" draggable="false">';
  const bug = { id, el, x: bugSize + Math.random() * Math.max(1, width - bugSize * 2), baseY: 48 + Math.random() * (height * .44 - 48), y: 0, phase: Math.random() * Math.PI * 2, speed: (22 + Math.random() * 28) * (Math.random() > .5 ? 1 : -1), age: 0, pending: false };
  bug.y = bug.baseY;
  if (decorative) { el.disabled = true; el.setAttribute('aria-hidden', 'true'); }
  el.addEventListener('click', () => catchBug(bug));
  bugsLayer.append(el); bugs.push(bug); placeBug(bug);
}
function placeBug(bug, scale = 1) {
  bug.el.style.transform = `translate(${bug.x - bugSize / 2}px,${bug.y - bugHeight / 2}px) scale(${scale}) rotate(${Math.sin(bug.age * 2 + bug.phase) * 5}deg)`;
}
function catchBug(bug) {
  if (round.status !== 'running' || bug.pending) return;
  initAudio(); bug.pending = true; bug.el.classList.add('caught'); bug.el.disabled = true;
  queue.push(bug); if (!shot) nextShot();
}
function nextShot() {
  const bug = queue.shift();
  if (!bug) return;
  shot = { bug, elapsed: 0, x: bug.x, y: bug.y };
  note(220, 650, .11, 0, .035);
}
function mouth() {
  const sceneRect = scene.getBoundingClientRect(), frogRect = frog.getBoundingClientRect();
  return { x: frogRect.left - sceneRect.left + frogRect.width * .595, y: frogRect.top - sceneRect.top + frogRect.height * .395 };
}
function clearTongue() {
  for (const id of ['tongue-shadow', 'tongue', 'tongue-shine']) $(id).setAttribute('d', '');
}
function animateShot(dt) {
  if (!shot) return;
  shot.elapsed += dt;
  const p = tongueProgress(shot.elapsed), start = mouth();
  const x = start.x + (shot.x - start.x) * p, y = start.y + (shot.y - start.y) * p;
  const bend = 12 * Math.sin(Math.PI * p);
  const d = `M ${start.x} ${start.y} Q ${(start.x+x)/2} ${(start.y+y)/2+bend} ${x} ${y}`;
  for (const id of ['tongue-shadow', 'tongue', 'tongue-shine']) $(id).setAttribute('d', d);
  if (shot.elapsed >= .16) {
    shot.bug.x = x; shot.bug.y = y; placeBug(shot.bug, Math.max(.05, p));
  }
  if (shot.elapsed >= .47) {
    const bug = shot.bug; bug.el.remove(); bugs = bugs.filter(item => item !== bug);
    registerCatch(round); pop(shot.x, shot.y); shot = null; clearTongue();
    frog.classList.remove('eating'); void frog.offsetWidth; frog.classList.add('eating');
    note(450, 120, .11, 0, .08);
    $('combo').textContent = round.streak > 1 ? `${round.streak} подряд. Вот это аппетит!` : 'Баг найден. Баг съеден.';
    nextShot(); updateHud();
  }
}
function pop(x, y) {
  const label = document.createElement('span'); label.className = 'floating-score'; label.textContent = '+1';
  label.style.left = `${x}px`; label.style.top = `${y - 10}px`; $('effects').append(label);
  label.addEventListener('animationend', () => label.remove(), { once: true });
  for (let i = 0; i < 5; i++) {
    const spark = document.createElement('span'); spark.className = 'spark'; spark.style.left = `${x}px`; spark.style.top = `${y}px`;
    spark.style.setProperty('--dx', `${Math.cos(i * 1.256) * 35}px`); spark.style.setProperty('--dy', `${Math.sin(i * 1.256) * 35}px`);
    $('effects').append(spark); spark.addEventListener('animationend', () => spark.remove(), { once: true });
  }
}
function updateHud() {
  $('score').textContent = round.score;
  $('score').nextElementSibling.textContent = ` ${bugsWord(round.score)}`;
  const seconds = Math.ceil(round.remaining);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('timer').parentElement.classList.toggle('urgent', seconds <= 10);
  $('progress').style.width = `${round.remaining / ROUND_SECONDS * 100}%`;
}
function start() {
  initAudio(); stopAudio(); round = createRound(); round.status = 'running';
  bugsLayer.replaceChildren(); $('effects').replaceChildren(); bugs = []; queue = []; shot = null;
  nextTalk = 2.5; speechLeft = 0; spawnClock = 0; clearTongue(); $('speech').classList.remove('visible');
  $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Пауза');
  $('status').textContent = 'Охота открыта'; $('combo').textContent = 'Каждый баг — маленькая победа';
  for (let i = 0; i < 6; i++) spawnBug();
  $('announcement').textContent = 'Охота началась. У тебя 60 секунд.'; previousFrame = performance.now(); updateHud();
  $('pause').focus({ preventScroll: true });
}
function showCard(kicker, title, description, button, note) {
  $('card-kicker').textContent = kicker; $('card-title').textContent = title; $('card-description').textContent = description;
  $('play').textContent = button; $('card-note').textContent = note; $('overlay').hidden = false; $('play').focus({ preventScroll: true });
}
function togglePause() {
  if (round.status === 'paused') {
    round.status = priorStatus; previousFrame = performance.now(); $('overlay').hidden = true;
    $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Пауза'); $('status').textContent = 'Охота открыта';
    $('pause').focus({ preventScroll: true }); return;
  }
  if (!['running', 'settling'].includes(round.status)) return;
  priorStatus = round.status; round.status = 'paused'; stopAudio();
  $('pause').textContent = '▷'; $('pause').setAttribute('aria-label', 'Продолжить'); $('status').textContent = 'Маленький перерыв';
  showCard('МОЖНО ВЫДОХНУТЬ', 'Баги подождут.', 'Время остановлено. Лягушка никуда не торопится.', 'Продолжить охоту →', 'Нажми пробел или кнопку, когда будешь готов.');
}
function finish() {
  round.status = 'ended'; stopAudio(); clearTongue();
  const record = round.score > best;
  if (record) { best = round.score; try { localStorage.setItem('qa-frog-best', String(best)); } catch {} }
  $('best').replaceChildren(String(best), Object.assign(document.createElement('small'), { textContent: ` ${bugsWord(best)}` }));
  $('pause').disabled = true; $('status').textContent = 'Пруд стал немного чище';
  for (const bug of bugs) bug.el.disabled = true;
  showCard(record ? 'НОВЫЙ ЛИЧНЫЙ РЕКОРД' : 'РАБОТА ВЫПОЛНЕНА', `${round.score} ${bugsWord(round.score)}. Красота.`, round.score ? 'Лягушка сыта. Релиз спасён. Ещё один маленький перерыв?' : 'Жуки оказались проворнее. Попробуем ещё раз?', 'Ещё один раунд →', `Твой лучший результат — ${best}`);
  $('announcement').textContent = `Раунд завершён. Поймано ${round.score} ${bugsWord(round.score)}.`;
  speak();
}

$('play').addEventListener('click', () => round.status === 'paused' ? togglePause() : start());
$('pause').addEventListener('click', togglePause);
$('sound').addEventListener('click', () => {
  sound = !sound; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? 'Выключить звук' : 'Включить звук');
  $('sound-label').textContent = sound ? 'Звук вкл.' : 'Звук выкл.'; $('sound-icon').textContent = sound ? '♫' : '♪';
  if (sound) initAudio(); else stopAudio();
});
document.addEventListener('keydown', event => {
  if (event.code === 'Escape') togglePause();
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (round.status === 'ready' || round.status === 'ended') { if (!$('play').disabled) start(); } else togglePause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && ['running','settling'].includes(round.status)) togglePause(); });

function frame(now) {
  const dt = previousFrame ? Math.max(0, (now - previousFrame) / 1000) : 0; previousFrame = now;
  const active = ['running', 'settling'].includes(round.status);
  if (active) {
    advanceRound(round, dt); animateShot(Math.min(dt, .05));
    if (round.status === 'running') {
      spawnClock += dt;
      if (spawnClock > .65 && bugs.length < 7) { spawnBug(); spawnClock = 0; }
      nextTalk -= dt; if (nextTalk <= 0) { speak(); nextTalk = 7 + Math.random() * 5; }
    }
    if (round.status === 'settling' && !shot && !queue.length) finish();
    updateHud();
  }
  if (round.status !== 'paused') {
    if (speechLeft > 0) { speechLeft -= dt; if (speechLeft <= 0) $('speech').classList.remove('visible'); }
    for (const bug of bugs) {
      if (bug.pending) continue;
      if (active || (round.status === 'ready' && !reduceMotion)) {
        const move = Math.min(dt, .05); bug.age += move;
        bug.x += bug.speed * move * (reduceMotion ? .5 : 1);
        if (bug.x > width - bugSize / 2) { bug.x = width - bugSize / 2; bug.speed = -Math.abs(bug.speed); }
        if (bug.x < bugSize / 2) { bug.x = bugSize / 2; bug.speed = Math.abs(bug.speed); }
        bug.y = bug.baseY + Math.sin(bug.age * 1.6 + bug.phase) * 20;
        placeBug(bug);
      }
    }
  }
  requestAnimationFrame(frame);
}
resize(); requestAnimationFrame(frame);
async function loadAssets() {
  try {
    await Promise.all(['/assets/frog.png','/assets/beetle.png'].map(src => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = src;
    })));
    $('play').disabled = false; $('play').textContent = 'Начать охоту →';
    for (let i = 0; i < 4; i++) spawnBug(true);
  } catch {
    $('card-description').textContent = 'Не удалось загрузить картинки. Обнови страницу, чтобы попробовать снова.';
    $('play').textContent = 'Картинки не загрузились';
  }
}
loadAssets();
