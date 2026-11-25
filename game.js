'use strict';

const W = 360, H = 600;
const $ = (id) => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');

// ---------- saved settings ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('brick-' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('brick-' + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

const PACKS = {
  bricks:   { name: '🧱 לבנים',   fx: 'pixel', items: [null] },
  aliens:   { name: '👾 חייזרים', fx: 'glow',  items: ['👾', '👽', '🛸'] },
  balloons: { name: '🎈 בלונים',  fx: 'pop',   items: ['🎈'] },
  plates:   { name: '🍽️ צלחות',   fx: 'shard', items: ['🍽️'] },
  cups:     { name: '☕ כוסות',    fx: 'shard', items: ['☕', '🍵', '🥛'] },
  glass:    { name: '🍷 זכוכית',  fx: 'shard', items: ['🍷', '🥂', '🍸', '🏺'] },
  eggs:     { name: '🥚 ביצים',   fx: 'splat', items: ['🥚'] },
  fruit:    { name: '🍉 פירות',   fx: 'splat', items: ['🍉', '🍊', '🍓'] },
};

let chosen = store.get('packs', ['bricks']);
let myEmojis = store.get('emojis', []);
let myImages = store.get('images', []);
let muted = store.get('muted', false);

// ---------- customize screen ----------
function say(text) { $('customMsg').textContent = text; }
const hasTargets = () => chosen.length || myEmojis.length || myImages.length;

function renderCustom() {
  $('packs').replaceChildren(...Object.entries(PACKS).map(([key, pack]) => {
    const b = document.createElement('button');
    b.textContent = pack.name;
    b.setAttribute('aria-pressed', chosen.includes(key));
    b.onclick = () => {
      chosen = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
      store.set('packs', chosen);
      renderCustom();
    };
    return b;
  }));
  const mine = [
    ...myEmojis.map((e, i) => removable(e, () => { myEmojis.splice(i, 1); store.set('emojis', myEmojis); })),
    ...myImages.map((src, i) => {
      const img = new Image();
      img.src = src;
      img.alt = 'תמונה שלי';
      return removable(img, () => { myImages.splice(i, 1); store.set('images', myImages); });
    }),
  ];
  $('mine').replaceChildren(...mine);
}

function removable(content, remove) {
  const b = document.createElement('button');
  b.append(content);
  b.title = 'הסרה';
  b.onclick = () => { remove(); renderCustom(); };
  return b;
}

function addEmojis() {
  const text = $('emojiInput').value;
  const parts = window.Intl && Intl.Segmenter
    ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment)
    : Array.from(text);
  const found = parts.filter((p) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(p));
  if (!found.length) return say('לא מצאתי אימוג\'י. פתחו את מקלדת האימוג\'ים ונסו שוב.');
  myEmojis = [...new Set([...myEmojis, ...found])].slice(-12);
  store.set('emojis', myEmojis);
  $('emojiInput').value = '';
  say('נוסף!');
  renderCustom();
}

// Crops to a small square so several pictures fit in the phone's storage.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 96, side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function addImages(event) {
  let message = 'התמונות נוספו!';
  for (const file of event.target.files) {
    if (myImages.length >= 8) { message = 'אפשר עד 8 תמונות. הסירו אחת כדי להוסיף.'; break; }
    try {
      myImages.push(await shrink(file));
      if (!store.set('images', myImages)) message = 'אין מקום לשמור. התמונה תישאר עד לסגירת המשחק.';
    } catch { message = 'אחד הקבצים לא נפתח כתמונה.'; }
  }
  event.target.value = '';
  say(message);
  renderCustom();
}

// ---------- sound (8-bit, generated in code) ----------
let audio;
function tone(freq, dur, type = 'square', slideTo = freq, vol = 0.07) {
  if (muted || !audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur);
}
function breakSound(fx) {
  if (fx === 'pop') tone(600, 0.08, 'sine', 90, 0.2);
  else if (fx === 'shard') [2400, 3100, 1900].forEach((f) => tone(f + Math.random() * 500, 0.12, 'triangle', f / 2, 0.05));
  else if (fx === 'glow') tone(900, 0.2, 'sawtooth', 120);
  else if (fx === 'splat') tone(200, 0.12, 'sawtooth', 60, 0.12);
  else tone(440, 0.07, 'square', 220);
}
function renderMute() {
  document.querySelectorAll('.mute').forEach((b) => {
    const small = b.classList.contains('small');
    b.textContent = muted ? (small ? '🔇' : '🔇 צליל כבוי') : (small ? '🔊' : '🔊 צליל פועל');
  });
}

// ---------- difficulty ----------
const FIXED = {
  easy:   { name: 'קל',     speed: 250, paddle: 96, lives: 5, tough: 0,    rows: 4, drop: 0.22 },
  medium: { name: 'בינוני', speed: 310, paddle: 76, lives: 3, tough: 0.2,  rows: 5, drop: 0.17 },
  hard:   { name: 'קשה',    speed: 380, paddle: 60, lives: 2, tough: 0.45, rows: 6, drop: 0.13 },
};
function settings(mode, level) {
  if (mode !== 'campaign') return FIXED[mode];
  const step = level - 1;
  return {
    name: 'מסע', lives: 3,
    speed: Math.min(430, 250 + step * 18),
    paddle: Math.max(56, 96 - step * 4),
    tough: Math.min(0.65, step * 0.08),
    rows: Math.min(8, 3 + Math.ceil(level / 2)),
    drop: Math.max(0.12, 0.22 - step * 0.01),
  };
}

const LAYOUTS = [
  () => true,
  (r, c) => (r + c) % 2 === 0,
  (r, c) => c >= 3 - r && c <= 3 + r,
  (r, c) => r % 2 === 0 || c === 0 || c === 6,
  (r, c) => c !== 3,
];

const POWERS = {
  wide:  { icon: '↔️', label: 'משטח רחב' },
  multi: { icon: '✳️', label: 'עוד כדורים' },
  life:  { icon: '❤️', label: 'חיים נוספים' },
  slow:  { icon: '🐢', label: 'כדור איטי' },
  fire:  { icon: '🔥', label: 'כדור אש' },
};

// ---------- game state ----------
let game = null, running = false, lastTime = 0, targets = [];

function buildTargets() {
  const list = [];
  for (const key of chosen) {
    const pack = PACKS[key];
    if (pack) pack.items.forEach((emoji) => list.push({ emoji, fx: pack.fx }));
  }
  myEmojis.forEach((emoji) => list.push({ emoji, fx: 'splat' }));
  myImages.forEach((src) => {
    const img = new Image();
    img.src = src;
    list.push({ img, fx: 'shard' });
  });
  return list.length ? list : [{ emoji: null, fx: 'pixel' }];
}

function buildLevel() {
  const cfg = settings(game.mode, game.level);
  game.cfg = cfg;
  const layout = LAYOUTS[(game.level - 1) % LAYOUTS.length];
  const cols = 7, bw = 48, bh = 34, left = (W - cols * bw) / 2;
  game.bricks = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!layout(r, c)) continue;
      let hp = 1;
      if (Math.random() < cfg.tough) hp = game.level >= 5 && Math.random() < 0.3 ? 3 : 2;
      game.bricks.push({
        x: left + c * bw + 2, y: 46 + r * bh + 2, w: bw - 4, h: bh - 4, hp,
        color: ['#ff2fa8', '#ff8a2f', '#ffe83b', '#3bff7a', '#2ff3ff', '#8f7bff'][r % 6],
        target: targets[Math.floor(Math.random() * targets.length)],
      });
    }
  }
  game.drops = [];
  game.bits = [];
  game.wide = game.slow = game.fire = 0;
  game.paddle.w = cfg.paddle;
  resetBall();
}

function resetBall() {
  game.balls = [{ x: game.paddle.x, y: H - 62, vx: 0, vy: 0, stuck: true }];
}

function start(mode) {
  if (!hasTargets()) { chosen = ['bricks']; store.set('packs', chosen); }
  targets = buildTargets();
  game = { mode, level: 1, score: 0, paddle: { x: W / 2, w: 80 }, note: '', noteTime: 0 };
  game.lives = settings(mode, 1).lives;
  buildLevel();
  show('game');
  fit();
  $('overlay').hidden = true;
  run();
}

function launch() {
  for (const b of game.balls) {
    if (!b.stuck) continue;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    b.vx = Math.cos(angle) * game.cfg.speed;
    b.vy = Math.sin(angle) * game.cfg.speed;
    b.stuck = false;
    tone(300, 0.1, 'square', 600);
  }
}

function burst(brick) {
  const fx = brick.target.fx;
  const colors = {
    pixel: [brick.color], glow: ['#3bff7a', '#2ff3ff', '#fff'], pop: ['#ff3b5c', '#ffe83b', '#2ff3ff', '#fff'],
    shard: ['#fff', '#bfefff', '#8fd8ff'], splat: ['#ffe83b', '#ff8a2f', '#ff3b5c'],
  }[fx];
  const count = fx === 'shard' ? 16 : 20;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * (fx === 'pop' ? 240 : 160);
    game.bits.push({
      x: brick.x + brick.w / 2, y: brick.y + brick.h / 2,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size: 2 + Math.random() * 5, life: 0.4 + Math.random() * 0.4,
      color: colors[i % colors.length], fx,
      angle: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
    });
  }
  breakSound(fx);
}

function hit(brick, fire) {
  brick.hp = fire ? 0 : brick.hp - 1;
  if (brick.hp > 0) { tone(700, 0.04); return; }
  game.bricks.splice(game.bricks.indexOf(brick), 1);
  game.score += 10 * game.level;
  burst(brick);
  if (Math.random() < game.cfg.drop) {
    const keys = Object.keys(POWERS);
    game.drops.push({ x: brick.x + brick.w / 2, y: brick.y, type: keys[Math.floor(Math.random() * keys.length)] });
  }
}

function collect(type) {
  if (type === 'wide') game.wide = 12;
  if (type === 'slow') game.slow = 8;
  if (type === 'fire') game.fire = 7;
  if (type === 'life') game.lives = Math.min(9, game.lives + 1);
  if (type === 'multi') {
    if (game.balls.some((b) => b.stuck)) launch();
    const source = game.balls[0];
    for (const turn of [-0.45, 0.45]) {
      if (game.balls.length >= 8) break;
      const a = Math.atan2(source.vy, source.vx) + turn;
      game.balls.push({ x: source.x, y: source.y, vx: Math.cos(a) * game.cfg.speed, vy: Math.sin(a) * game.cfg.speed, stuck: false });
    }
  }
  game.note = POWERS[type].label;
  game.noteTime = 1.4;
  tone(500, 0.2, 'square', 1200);
}

// Keeps the ball from flying almost flat, which would take forever to come down.
function keepSteep(ball) {
  const speed = Math.hypot(ball.vx, ball.vy) || game.cfg.speed;
  if (Math.abs(ball.vy) < speed * 0.25) {
    ball.vy = (ball.vy < 0 ? -1 : 1) * speed * 0.25;
    ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(speed * speed - ball.vy * ball.vy);
  }
}

function moveBall(ball, dt) {
  const R = 6, p = game.paddle, py = H - 52;
  const factor = game.slow > 0 ? 0.65 : 1;
  ball.x += ball.vx * dt * factor;
  ball.y += ball.vy * dt * factor;
  if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); keepSteep(ball); }
  if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); keepSteep(ball); }
  if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }

  if (ball.vy > 0 && ball.y + R >= py && ball.y - R <= py + 12 && Math.abs(ball.x - p.x) <= p.w / 2 + R) {
    // Where the ball lands on the paddle sets the direction it leaves in.
    const offset = Math.max(-1, Math.min(1, (ball.x - p.x) / (p.w / 2)));
    const angle = -Math.PI / 2 + offset * 1.05;
    ball.vx = Math.cos(angle) * game.cfg.speed;
    ball.vy = Math.sin(angle) * game.cfg.speed;
    ball.y = py - R;
    tone(220, 0.05);
  }

  for (const brick of game.bricks) {
    const nx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const ny = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    const dx = ball.x - nx, dy = ball.y - ny;
    if (dx * dx + dy * dy > R * R) continue;
    const fire = game.fire > 0;
    if (!fire) {
      if (Math.abs(dx) > Math.abs(dy)) ball.vx = Math.sign(dx) * Math.abs(ball.vx);
      else ball.vy = (Math.sign(dy) || -Math.sign(ball.vy)) * Math.abs(ball.vy);
      keepSteep(ball);
    }
    hit(brick, fire);
    break;
  }
}

function update(dt) {
  const p = game.paddle;
  game.wide = Math.max(0, game.wide - dt);
  game.slow = Math.max(0, game.slow - dt);
  game.fire = Math.max(0, game.fire - dt);
  game.noteTime = Math.max(0, game.noteTime - dt);
  p.w = game.cfg.paddle * (game.wide > 0 ? 1.55 : 1);
  p.x = Math.max(p.w / 2, Math.min(W - p.w / 2, p.x));

  const steps = 4;
  for (let i = 0; i < steps; i++) {
    for (const ball of game.balls) {
      if (ball.stuck) { ball.x = p.x; ball.y = H - 62; }
      else moveBall(ball, dt / steps);
    }
  }
  game.balls = game.balls.filter((b) => b.y < H + 20);

  game.drops = game.drops.filter((d) => {
    d.y += 120 * dt;
    if (d.y > H - 62 && d.y < H - 34 && Math.abs(d.x - p.x) < p.w / 2 + 14) { collect(d.type); return false; }
    return d.y < H + 20;
  });

  for (const bit of game.bits) {
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.vy += (bit.fx === 'glow' ? 0 : 320) * dt;
    bit.angle += bit.spin * dt;
    bit.life -= dt;
  }
  game.bits = game.bits.filter((b) => b.life > 0);

  if (!game.bricks.length) {
    game.score += 100 * game.level;
    saveBest();
    tone(400, 0.5, 'square', 1600);
    pauseWith('שלב ' + game.level + ' הושלם! 🎉', 'ניקוד: ' + game.score, 'לשלב הבא', () => {
      game.level++;
      buildLevel();
    });
  } else if (!game.balls.length) {
    game.lives--;
    tone(300, 0.4, 'sawtooth', 70, 0.12);
    if (game.lives > 0) { game.drops = []; game.wide = game.slow = game.fire = 0; resetBall(); }
    else {
      saveBest();
      const mode = game.mode;
      pauseWith('המשחק נגמר', 'ניקוד: ' + game.score + ' · שלב ' + game.level, 'שוב!', () => start(mode));
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(143,123,255,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 30) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const b of game.bricks) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const t = b.target;
    if (t.img) {
      if (t.img.complete) ctx.drawImage(t.img, cx - b.h / 2, b.y, b.h, b.h);
    } else if (t.emoji) {
      ctx.font = '26px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(t.emoji, cx, cy + 1);
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y + 4, b.w, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(b.x, b.y + 4, b.w, 4);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(b.x, b.y + b.h - 8, b.w, 4);
    }
    if (b.hp > 1) {
      ctx.strokeStyle = b.hp > 2 ? '#ff3b5c' : '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  for (const bit of game.bits) {
    ctx.save();
    ctx.translate(bit.x, bit.y);
    ctx.rotate(bit.angle);
    ctx.globalAlpha = Math.min(1, bit.life * 3);
    ctx.fillStyle = bit.color;
    if (bit.fx === 'glow') { ctx.shadowColor = bit.color; ctx.shadowBlur = 10; }
    if (bit.fx === 'shard') {
      ctx.beginPath();
      ctx.moveTo(0, -bit.size * 1.6);
      ctx.lineTo(bit.size, bit.size);
      ctx.lineTo(-bit.size * 0.6, bit.size * 0.5);
      ctx.fill();
    } else if (bit.fx === 'splat' || bit.fx === 'pop') {
      ctx.beginPath();
      ctx.arc(0, 0, bit.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-bit.size / 2, -bit.size / 2, bit.size, bit.size);
    }
    ctx.restore();
  }

  ctx.font = '20px sans-serif';
  for (const d of game.drops) {
    ctx.fillStyle = '#46308f';
    ctx.fillRect(d.x - 15, d.y - 13, 30, 26);
    ctx.strokeStyle = '#ffe83b';
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x - 15, d.y - 13, 30, 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(POWERS[d.type].icon, d.x, d.y + 1);
  }

  const p = game.paddle;
  ctx.fillStyle = '#2ff3ff';
  ctx.fillRect(p.x - p.w / 2, H - 52, p.w, 12);
  ctx.fillStyle = '#ff2fa8';
  ctx.fillRect(p.x - p.w / 2, H - 52, 8, 12);
  ctx.fillRect(p.x + p.w / 2 - 8, H - 52, 8, 12);

  ctx.fillStyle = game.fire > 0 ? '#ff6a00' : '#fff';
  for (const b of game.balls) ctx.fillRect(b.x - 6, b.y - 6, 12, 12);

  ctx.fillStyle = '#ffe83b';
  ctx.font = 'bold 20px "Courier New", monospace';
  if (game.noteTime > 0) ctx.fillText(game.note, W / 2, H - 110);
  else if (game.balls.some((b) => b.stuck)) ctx.fillText('נגעו והרימו כדי לשגר', W / 2, H - 110);

  $('hud').textContent = `${game.cfg.name} · שלב ${game.level} · ניקוד ${game.score} · ❤️${game.lives}`;
}

function frame(time) {
  if (!running) return;
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  if (running) requestAnimationFrame(frame);
}

function run() {
  running = true;
  lastTime = performance.now();
  draw();
  requestAnimationFrame(frame);
}

let resume = null;
function pauseWith(title, text, button, action) {
  running = false;
  $('ovTitle').textContent = title;
  $('ovText').textContent = text;
  $('ovMain').textContent = button;
  resume = action;
  $('overlay').hidden = false;
}
function pause() {
  if (running) pauseWith('השהיה', '', 'להמשיך', null);
}

function saveBest() {
  const best = store.get('best', {});
  if (game.score > (best[game.mode] || 0)) { best[game.mode] = game.score; store.set('best', best); }
}

// ---------- screens and input ----------
function show(name) {
  for (const id of ['menu', 'custom', 'help', 'game']) $(id).hidden = id !== name;
  if (name === 'custom') { say(''); renderCustom(); }
  if (name === 'menu') {
    const best = store.get('best', {}).campaign;
    $('best').textContent = best ? 'השיא שלך במסע: ' + best : 'בלי פרסומות. רק לפוצץ.';
  }
}

function fit() {
  const stage = $('stage');
  if (!stage.clientWidth) return;
  const scale = Math.min((stage.clientWidth - 4) / W, (stage.clientHeight - 4) / H);
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  canvas.width = Math.round(W * scale * ratio);
  canvas.height = Math.round(H * scale * ratio);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (game) draw();
}

// Dragging anywhere moves the paddle by the same distance, so the finger never has to cover it.
let dragX = null;
const stageEl = $('stage');
stageEl.addEventListener('pointerdown', (e) => {
  dragX = e.clientX;
  stageEl.setPointerCapture(e.pointerId);
});
stageEl.addEventListener('pointermove', (e) => {
  if (!game || !running) return;
  const width = canvas.getBoundingClientRect().width;
  if (dragX !== null) {
    game.paddle.x += (e.clientX - dragX) * (W / width) * 1.25;
    dragX = e.clientX;
  } else if (e.pointerType === 'mouse') {
    game.paddle.x = (e.clientX - canvas.getBoundingClientRect().left) * (W / width);
  }
  game.paddle.x = Math.max(game.paddle.w / 2, Math.min(W - game.paddle.w / 2, game.paddle.x));
});
stageEl.addEventListener('pointerup', () => { dragX = null; if (running) launch(); });
stageEl.addEventListener('pointercancel', () => { dragX = null; });

const keysDown = new Set();
addEventListener('keydown', (e) => {
  if (!game || !running) return;
  if (e.key === 'ArrowLeft') game.paddle.x -= 28;
  if (e.key === 'ArrowRight') game.paddle.x += 28;
  if (e.key === ' ') { e.preventDefault(); launch(); }
});

document.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => start(b.dataset.start); });
document.querySelectorAll('[data-show]').forEach((b) => { b.onclick = () => show(b.dataset.show); });
document.querySelectorAll('.mute').forEach((b) => {
  b.onclick = () => { muted = !muted; store.set('muted', muted); renderMute(); };
});
addEventListener('pointerdown', () => {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!audio && Ctor) audio = new Ctor();
  if (audio && audio.state === 'suspended') audio.resume();
});
$('emojiAdd').onclick = addEmojis;
$('emojiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addEmojis(); });
$('imageInput').onchange = addImages;
$('pauseBtn').onclick = pause;
$('ovMain').onclick = () => {
  const action = resume;
  $('overlay').hidden = true;
  if (action) action();
  if (!running) run();
};
$('ovQuit').onclick = () => { saveBest(); running = false; game = null; show('menu'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('resize', fit);

// ---------- install ----------
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('installBtn').hidden = false;
});
$('installBtn').onclick = () => {
  if (installPrompt) installPrompt.prompt();
  installPrompt = null;
  $('installBtn').hidden = true;
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

renderMute();
show('menu');
