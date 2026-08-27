import { zzfx } from "./zzfx";
import { ATLAS, FONT_CHARS, SPRITE_START, FONT_START } from "./sprites";

let muted = false;
const sfxJump = () => { if (!muted) zzfx(...([,,324,.01,.01,.09,1,2.3,10,-26,,,,.4,,,,.69,.03] as number[])); };
const sfxStart = () => { if (!muted) zzfx(...([,,659,,.09,.09,5,.8,,,367,.05,.03,,,,,.98,.04] as number[])); };
const sfxLevelUp = () => { if (!muted) zzfx(...([1.6,,642,,.29,.21,1,.3,,,358,.07,.04,.2,,,.1,.5,.24] as number[])); };
const sfxExp = () => { if (!muted) zzfx(...([,,486,.02,.14,.09,,.9,-13,27,,,,,,,,.7,.09] as number[])); };
const sfxHit = () => { if (!muted) zzfx(...([2,,134,.02,.04,.08,5,.8178692417324012,-5,,,,,.2,1.2,.2,.15,.55,.03] as number[])); };
const sfxLand = () => { if (!muted) zzfx(...([,,90,.01,,.05,5,,,,,,,.1,-4,,.01,.1,.02] as number[])); };

const WIDTH = 1560;
const HEIGHT = 720;
const GRAVITY = 0.5;
const JUMP_POWER = 10;
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 40;
const CLOUD_WIDTH = 118 * 2; // cloud.gif 2x
const CLOUD_Y = HEIGHT - 260;
const CLOUD_COUNT = 10;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext("2d")!;
canvas.style.position = "absolute";
canvas.style.left = "50%";
canvas.style.top = "50%";
function resize() {
  document.documentElement.style.height = innerHeight + "px";
  const s = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  canvas.style.transform = `translate(-50%,-50%)scale(${s})`;
}
resize();
addEventListener("resize", resize);

const spriteSheet = new Image();
spriteSheet.src = "sprites.gif";
const _fc = document.createElement("canvas");
_fc.width = 800;
_fc.height = 64;
const _fx = _fc.getContext("2d")!;

function drawText(text: string, x: number, y: number, scale = 1, align = 0, color = "#fff") {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const ci = FONT_CHARS.indexOf(text[i]);
    if (ci >= 0) w += ATLAS[FONT_START + ci][2];
  }
  w *= scale;
  const h = 16 * scale;
  _fx.globalCompositeOperation = "source-over";
  _fx.clearRect(0, 0, w + 1, h);
  _fx.imageSmoothingEnabled = false;
  let cx = 0;
  for (let i = 0; i < text.length; i++) {
    const ci = FONT_CHARS.indexOf(text[i]);
    if (ci >= 0) {
      const [fx, fy, fw, fh] = ATLAS[FONT_START + ci];
      _fx.drawImage(spriteSheet, fx, fy, fw, fh, cx, 0, fw * scale, h);
      cx += fw * scale;
    }
  }
  _fx.globalCompositeOperation = "source-in";
  _fx.fillStyle = color;
  _fx.fillRect(0, 0, w, h);
  _fx.globalCompositeOperation = "source-over";
  ctx.drawImage(_fc, 0, 0, w, h, x - w * align, y, w, h);
}
let animFrame = 0;
let animTimer = 0;
let facingRight = true;

// Input
const keys: Record<string, boolean> = {};
addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (e.repeat) return;
  }
  if (e.code === "KeyM" && !e.repeat) {
    muted = !muted;
    sfxJump();
  }
  keys[e.code] = true;
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
function updateTouch(e: TouchEvent) {
  let l = false, r = false;
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    if (t.clientX > innerWidth / 2) r = true;
    else l = true;
  }
  if (l && r) {
    keys["Space"] = true;
  } else {
    keys["ArrowLeft"] = l;
    keys["ArrowRight"] = r;
  }
}
const mobile = "ontouchstart" in window;
addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (cleared) { keys["Space"] = true; return; }
  if (titleScreen) {
    const t = e.changedTouches[0];
    if (t.clientY < innerHeight * 0.15) {
      if (t.clientX > innerWidth / 2) {
        muted = !muted;
      } else {
        showBestTimes = !showBestTimes;
      }
      sfxJump();
    } else if (!showBestTimes) {
      keys["Space"] = true;
    }
    return;
  }
  updateTouch(e);
});
addEventListener("touchend", (e) => {
  if (!titleScreen && !cleared) updateTouch(e);
});

// Fibonacci
function fib(n: number): number {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

// Stats at level
function statsAt(level: number) {
  return {
    airJumps: fib(level),
    // BASE_SPEED=5, SPEED_GROWTH=0.3
    speed: 5 * (1 + level * 0.3),
  };
}

// Max horizontal range: (1 + airJumps) jumps worth of air time * speed
function maxRange(level: number): number {
  const s = statsAt(level);
  const totalJumps = 1 + s.airJumps;
  const airTime = totalJumps * (2 * JUMP_POWER / GRAVITY);
  return airTime * s.speed;
}

// Difficulty: 0.91 at cloud 1, 0.95 at cloud 10
function difficulty(i: number): number {
  return 0.91 + i * (0.95 - 0.91) / (CLOUD_COUNT - 1);
}

// Jump height clamp: -PLAYER_HEIGHT * 1.5

// Cloud checkpoints — sequential, gap between cloud i-1 and cloud i
interface Cloud { x: number; y: number; width: number; level: number; }
const clouds: Cloud[] = [];
clouds.push({ x: 0, y: CLOUD_Y, width: CLOUD_WIDTH, level: 0 });
let cloudX = CLOUD_WIDTH;
for (let i = 0; i < CLOUD_COUNT; i++) {
  const gap = maxRange(i) * difficulty(i);
  cloudX += gap;
  clouds.push({
    x: cloudX,
    y: CLOUD_Y,
    width: CLOUD_WIDTH,
    level: i + 1,
  });
  cloudX += CLOUD_WIDTH;
}

// Obstacles — spawned in gaps from Lv.5 onward
interface Obstacle {
  x: number;
  baseY: number;
  amplitude: number;
  speed: number;
  width: number;
  height: number;
  phase: number;
}

const obstacles: Obstacle[] = [];
for (let i = 5; i < clouds.length; i++) {
  const count = Math.max(1, Math.round(1 + fib(i - 5) * 0.5));
  const prevEnd = clouds[i - 1].x + CLOUD_WIDTH;
  const gapStart = prevEnd;
  const gapEnd = clouds[i].x;
  const gapLen = gapEnd - gapStart;

  for (let j = 0; j < count; j++) {
    const t = (j + 1) / (count + 1);
    obstacles.push({
      x: gapStart + gapLen * t,
      baseY: 160 + Math.random() * (HEIGHT - 320),
      amplitude: 40 + Math.random() * 40,
      speed: 0.0005 + Math.random() * 0.0003,
      width: 96,
      height: 96,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// Player state
let playerLevel = 0;
let px = 80;
let py = CLOUD_Y - PLAYER_HEIGHT;
let vx = 0;
let vy = 0;
let onGround = false;
let hasJumped = false;
let airJumpsUsed = 0;
let cameraX = 0;

// Bonus speed from falling (resets on level up)
let bonusSpeed = 0;
let damaged = false;

// Star effects
interface Star {
  _x: number; _y: number; _vx: number; _vy: number;
  _t: number; _s: number; _a: number; _l: number;
}
const stars: Star[] = [];
let starTimer = 0;
let bgBlend = 0;

// Display timers
let levelUpTimer = 0;
let expUpTimer = 0;
let flashRed = false;
let flashTimer = 0;
let startTime = performance.now();
let clearTime = 0;
let cleared = false;
let titleScreen = true;
let showBestTimes = false;

function formatTime(ms: number): string {
  const t = ms / 10 | 0;
  const cc = t % 100;
  const ss = (t / 100 | 0) % 60;
  const mm = t / 6000 | 0;
  return `${mm < 10 ? "0" : ""}${mm}:${ss < 10 ? "0" : ""}${ss}:${cc < 10 ? "0" : ""}${cc}`;
}


function currentStats() {
  const s = statsAt(playerLevel);
  return { ...s, speed: s.speed + bonusSpeed };
}

function restart() {
  px = 80;
  py = CLOUD_Y - PLAYER_HEIGHT;
  vx = 0;
  vy = 0;
  onGround = false;
  hasJumped = false;
  airJumpsUsed = 0;
  cameraX = 0;
  lastPlatform = -1;
  activeSegments = [];
  currentSegment = [];
  finishedTrails.length = 0;
  stars.length = 0;
  bgBlend = 0;
  starTimer = 0;
}

function tryJump() {
  const s = currentStats();
  if (onGround) {
    vy = -JUMP_POWER;
    sfxJump();
    onGround = false;
    hasJumped = true;
    spawnJumpParticles();
  } else if (airJumpsUsed < s.airJumps) {
    vy = -JUMP_POWER;
    airJumpsUsed++;
    sfxJump();
    hasJumped = true;
    spawnJumpParticles();
  }
}

let lastPlatform = -1;

function landOn(surfaceY: number, platform: number) {
  py = surfaceY - PLAYER_HEIGHT;
  vy = 0;
  onGround = true;
  airJumpsUsed = 0;

  // Keep rainbow only if it connects two different platforms
  if (currentSegment.length > 1) activeSegments.push(currentSegment);
  if (platform !== lastPlatform && activeSegments.length > 0) {
    spawnLandingParticles();
    for (const seg of activeSegments) finishedTrails.push(seg);
  }
  activeSegments = [];
  currentSegment = [];
  damaged = false;
  lastPlatform = platform;
}

function update() {
  if (cleared) {
    if (keys["Space"]) {
      keys["Space"] = false;
      cleared = false;
      sfxStart();
      playerLevel = 0;
      bonusSpeed = 0;
      levelUpTimer = 0;
      expUpTimer = 0;
      flashTimer = 0;
      flashRed = false;
      damaged = false;
      hasJumped = false;
      startTime = performance.now();
      particles.length = 0;
      stars.length = 0;
      bgBlend = 0;
      starTimer = 0;
      keys["ArrowRight"] = false;
      restart();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (levelUpTimer > 0) levelUpTimer--;
    if (flashTimer > 0) flashTimer--;
    return;
  }

  const s = currentStats();

  // Movement
  vx = 0;
  if (keys["ArrowLeft"]) vx = -s.speed;
  if (keys["ArrowRight"]) vx = s.speed;

  // Animation
  if (vx !== 0) {
    if (vx > 0) facingRight = true;
    else facingRight = false;
    animTimer++;
    // ANIM_SPEED = 6
    if (animTimer >= 6) {
      animTimer = 0;
      animFrame = (animFrame % 4) + 1;
    }
  } else {
    animFrame = 0;
    animTimer = 0;
  }

  // Star timer & spawning
  if (keys["ArrowRight"] && vx !== 0 && !damaged && playerLevel >= 4) {
    starTimer++;
  } else if (vx === 0 || damaged) {
    starTimer = 0;
  }
  const starTier = starTimer < 180 ? 0 : starTimer < 480 ? 1 : 2;
  bgBlend += (starTier / 2 - bgBlend) * 0.02;
  // small stars: always when moving (no level/timer restriction)
  if (vx !== 0 && !damaged) {
    const r = Math.random;
    if (r() < 0.03 + starTier * 0.05) {
      stars.push({ _x: cameraX + WIDTH + r() * 100, _y: r() * HEIGHT,
        _vx: -(3 + starTier * 0.5 + r() * 2), _vy: (r() - 0.5) * 0.5,
        _t: 0, _s: r() < 0.5 ? 0 : 1, _a: 0, _l: 200 + r() * 100 | 0 });
    }
  }
  // mid + big stars (tier 2 only)
  if (starTier >= 2) {
    const r = Math.random;
    if (r() < 0.07) {
      stars.push({ _x: cameraX + WIDTH + r() * 100, _y: r() * HEIGHT,
        _vx: -(3 + r() * 1.5), _vy: (r() - 0.5) * 0.4,
        _t: 1, _s: r() < 0.5 ? 0 : 1, _a: 0, _l: 250 + r() * 100 | 0 });
    }
    if (r() < 0.015) {
      stars.push({ _x: cameraX + WIDTH + r() * 100, _y: r() * HEIGHT * 0.8 + HEIGHT * 0.1,
        _vx: -(2 + r() * 1.5), _vy: (r() - 0.5) * 0.3,
        _t: 2, _s: r() < 0.5 ? 0 : 1, _a: 0, _l: 300 + r() * 100 | 0 });
    }
  }

  // Jump (consume on press)
  if (keys["Space"]) {
    tryJump();
    keys["Space"] = false;
  }

  // Physics
  vy += GRAVITY;
  px += vx;
  py += vy;

  // Clamp height
  if (py < -PLAYER_HEIGHT * 1.5) {
    py = -PLAYER_HEIGHT * 1.5;
    if (vy < 0) vy = 0;
  }

  onGround = false;

  // Cloud collision — all clouds are platforms
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    if (
      vy >= 0 &&
      px + PLAYER_WIDTH > c.x && px < c.x + c.width &&
      py + PLAYER_HEIGHT >= c.y &&
      py + PLAYER_HEIGHT <= c.y + vy + 1
    ) {
      if (i > playerLevel) {
        playerLevel = i;
        bonusSpeed = 0;
        if (playerLevel >= CLOUD_COUNT) {
          levelUpTimer = 300;
          sfxLevelUp();
          clearTime = performance.now() - startTime;
          cleared = true;
          const times: number[] = JSON.parse(localStorage.getItem("rainbowspeed:t") || "[]");
          times.push(clearTime);
          times.sort((a, b) => a - b);
          if (times.length > 5) times.length = 5;
          localStorage.setItem("rainbowspeed:t", JSON.stringify(times));
        } else {
          levelUpTimer = 120;
          sfxLevelUp();
        }
        spawnLandingParticles();
        flashRed = false;
        flashTimer = 20;
        for (let j = 0; j < 30; j++) {
          particles.push({
            x: cameraX + Math.random() * WIDTH,
            y: Math.random() * HEIGHT,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 40 + Math.random() * 20,
          });
        }
        landOn(c.y, i);
        return;
      }
      if (hasJumped) {
        sfxLand();
        hasJumped = false;
      }
      landOn(c.y, i);
      break;
    }
  }

  // Obstacle collision — lose momentum and fall
  const now = performance.now();
  for (const o of obstacles) {
    const oy = o.baseY + Math.sin(now * o.speed + o.phase) * o.amplitude;
    if (
      px + PLAYER_WIDTH > o.x && px < o.x + o.width &&
      py + PLAYER_HEIGHT > oy && py < oy + o.height
    ) {
      vx = 0;
      if (vy < 0) vy = 0;
      airJumpsUsed = currentStats().airJumps;
      // Finalize current segment and stop generating rainbow
      if (currentSegment.length > 1) {
        activeSegments.push(currentSegment);
      }
      currentSegment = [];
      if (!damaged) {
        sfxHit();
      }
      damaged = true;
      flashRed = true;
      flashTimer = 15;
      break;
    }
  }

  // Fall off screen → gain EXP based on progress toward next cloud
  if (py > HEIGHT + 100) {
    if (playerLevel < CLOUD_COUNT) {
      const gapStart = clouds[playerLevel].x + CLOUD_WIDTH;
      const gapEnd = clouds[playerLevel + 1].x;
      const progress = (px - gapStart) / (gapEnd - gapStart);
      if (progress >= 0.5) {
        const ratio = (progress - 0.5) * 2; // 0 at 50%, 1 at 100%
        // BONUS_PER_FALL = 0.3
        bonusSpeed += 0.3 * ratio;
        expUpTimer = 90;
        sfxExp();
      }
    }
    restart();
  }

  if (px < 0) px = 0;

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Update stars
  for (let i = stars.length - 1; i >= 0; i--) {
    const st = stars[i];
    st._x += st._vx;
    st._y += st._vy;
    st._l--;
    st._a = st._l > 30 ? Math.min(st._a + 0.05, 0.9) : st._l / 30 * 0.9;
    if (st._l <= 0 || st._x < cameraX - 50) stars.splice(i, 1);
  }

  // Rainbow trail — record while airborne and moving forward, break on stop
  if (!onGround && vx > 0 && !damaged) {
    currentSegment.push({ x: px + PLAYER_WIDTH / 2, y: py + PLAYER_HEIGHT / 2 });
  } else if (currentSegment.length > 1) {
    activeSegments.push(currentSegment);
    currentSegment = [];
  }
  // Remove trails that scrolled off screen
  while (finishedTrails.length > 0) {
    const t = finishedTrails[0];
    if (t[t.length - 1].x < cameraX - 100) finishedTrails.shift();
    else break;
  }

  // Camera follows player (never scrolls back left, clamped so last cloud is center-right)
  const targetX = px - WIDTH * 0.25;
  const maxCameraX = clouds[clouds.length - 1].x - WIDTH * 0.4;
  if (targetX > cameraX) cameraX = Math.min(targetX, maxCameraX);
  if (cameraX < 0) cameraX = 0;

  if (levelUpTimer > 0) levelUpTimer--;
  if (expUpTimer > 0) expUpTimer--;
  if (flashTimer > 0) flashTimer--;
}

// Jump particles
interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
const particles: Particle[] = [];

function spawnJumpParticles() {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: px + PLAYER_WIDTH / 2,
      y: py + PLAYER_HEIGHT,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 30 + Math.random() * 15,
    });
  }
}

function spawnLandingParticles() {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: px + PLAYER_WIDTH / 2,
      y: py + PLAYER_HEIGHT,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 25 + Math.random() * 10,
    });
  }
}

function drawCloud(c: Cloud) {
  const sx = c.x - cameraX;
  if (sx + c.width < -100 || sx > WIDTH + 100) return;

  // cloud = ATLAS[SPRITE_START + 1]
  ctx.drawImage(spriteSheet, ATLAS[SPRITE_START + 1][0], ATLAS[SPRITE_START + 1][1], ATLAS[SPRITE_START + 1][2], ATLAS[SPRITE_START + 1][3], sx, c.y, 118 * 2, 23 * 2);

  drawText(`LEVEL ${c.level}`, sx + c.width / 2, c.y - 16 - 4, 1, 0.5, "#B2C1DB");
}

// Rainbow trail — interpolated bands for smooth gradient
const RAINBOW_KEYS = [
  [255, 0, 0], [255, 127, 0], [255, 255, 0],
  [0, 255, 0], [0, 0, 255], [139, 0, 255],
];
const RAINBOW_BAND_COUNT = 18;
const RAINBOW_BANDS: string[] = [];
for (let i = 0; i < RAINBOW_BAND_COUNT; i++) {
  const t = i / (RAINBOW_BAND_COUNT - 1) * (RAINBOW_KEYS.length - 1);
  const idx = Math.min(Math.floor(t), RAINBOW_KEYS.length - 2);
  const f = t - idx;
  const a = RAINBOW_KEYS[idx], b = RAINBOW_KEYS[idx + 1];
  RAINBOW_BANDS.push(`rgb(${a[0] + (b[0] - a[0]) * f | 0},${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0})`);
}
const BAND_HEIGHT = 2.5;
const RAINBOW_HEIGHT = BAND_HEIGHT * RAINBOW_BAND_COUNT;
type Trail = { x: number; y: number }[];
const finishedTrails: Trail[] = [];
let activeSegments: Trail[] = [];
let currentSegment: Trail = [];

function draw() {
  ctx.imageSmoothingEnabled = false;
  // Sky — pastel rainbow cycle based on bgBlend
  const now = performance.now();
  if (bgBlend < 0.001) {
    ctx.fillStyle = "#D4DDED";
  } else if (clearTime > 0) {
    const t = (startTime + clearTime) * 0.0008;
    const cr = 212 + bgBlend * (30 * Math.sin(t) + 15) | 0;
    const cg = 221 + bgBlend * (20 * Math.sin(t + 2.1) - 14) | 0;
    const cb = 237 + bgBlend * (25 * Math.sin(t + 4.2) - 14) | 0;
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  } else {
    const t = now * 0.0008;
    const cr = 212 + bgBlend * (30 * Math.sin(t) + 15) | 0;
    const cg = 221 + bgBlend * (20 * Math.sin(t + 2.1) - 14) | 0;
    const cb = 237 + bgBlend * (25 * Math.sin(t + 4.2) - 14) | 0;
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  }
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Clouds
  for (const c of clouds) drawCloud(c);

  // Obstacles
  for (const o of obstacles) {
    const sx = o.x - cameraX;
    if (sx + o.width < 0 || sx > WIDTH) continue;
    const oy = o.baseY + Math.sin(now * o.speed + o.phase) * o.amplitude;
    // spike = ATLAS[SPRITE_START]
    ctx.drawImage(spriteSheet, ATLAS[SPRITE_START][0], ATLAS[SPRITE_START][1], ATLAS[SPRITE_START][2], ATLAS[SPRITE_START][3], sx, oy, o.width, o.height);
  }

  // Stars
  for (const st of stars) {
    const sx = st._x - cameraX;
    if (sx < -30 || sx > WIDTH + 30) continue;
    const sp = ATLAS[SPRITE_START + 6 - st._t * 2 + st._s];
    const scale = st._t === 2 ? 2 : st._t === 1 ? 1.5 : 1;
    ctx.globalAlpha = st._a;
    ctx.drawImage(spriteSheet, sp[0], sp[1], sp[2], sp[3],
      sx, st._y, sp[2] * scale, sp[3] * scale);
  }
  ctx.globalAlpha = 1;

  // Rainbow trails — draw all finished + active
  const allTrails = [...finishedTrails, ...activeSegments];
  if (currentSegment.length > 1) allTrails.push(currentSegment);
  for (const t of allTrails) {
    // Glow
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = RAINBOW_HEIGHT + 10;
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(t[0].x - cameraX, t[0].y);
    for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x - cameraX, t[i].y);
    ctx.stroke();

    // Bands
    ctx.lineWidth = BAND_HEIGHT;
    ctx.globalAlpha = 0.85;
    for (let b = 0; b < RAINBOW_BAND_COUNT; b++) {
      ctx.strokeStyle = RAINBOW_BANDS[b];
      const offsetY = (b - RAINBOW_BAND_COUNT / 2) * BAND_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(t[0].x - cameraX, t[0].y + offsetY);
      for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x - cameraX, t[i].y + offsetY);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = (p.life / 30) * 0.6;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x - cameraX, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player
  const [fsx, fsy, fsw, fsh] = ATLAS[animFrame];
  const drawX = px - cameraX - (fsw - PLAYER_WIDTH) / 2;
  const drawY = py + PLAYER_HEIGHT - fsh;
  ctx.save();
  if (!facingRight) {
    ctx.scale(-1, 1);
    ctx.drawImage(spriteSheet, fsx, fsy, fsw, fsh, -drawX - fsw, drawY, fsw, fsh);
  } else {
    ctx.drawImage(spriteSheet, fsx, fsy, fsw, fsh, drawX, drawY, fsw, fsh);
  }
  ctx.restore();

  // Screen flash
  if (flashTimer > 0) {
    ctx.globalAlpha = flashTimer / 20 * 0.3;
    ctx.fillStyle = flashRed ? "#f00" : "#fff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  }

  // Level up / clear notification
  if (levelUpTimer > 0 && !cleared) {
    ctx.globalAlpha = Math.min(1, levelUpTimer / 30);
    drawText("LEVEL UP", WIDTH / 2, HEIGHT / 2 - 40, 2, 0.5, "#E679D8");
    const s = currentStats();
    drawText(`LEVEL ${playerLevel}  SPEED ${Math.round(s.speed * 10)}  JUMPS ${1 + s.airJumps}`, WIDTH / 2, HEIGHT / 2 + 10, 1, 0.5, "#B2C1DB");
    ctx.globalAlpha = 1;
  }

  // EXP up notification
  if (expUpTimer > 0) {
    ctx.globalAlpha = Math.min(1, expUpTimer / 20);
    drawText("EXP UP", WIDTH / 2, HEIGHT / 2 - 16, 2, 0.5, "#B2C1DB");
    ctx.globalAlpha = 1;
  }

  // Jump counter (bottom center)
  const s = currentStats();
  if (s.airJumps === 0) {
    drawText("PRESS SPACE TO JUMP", WIDTH / 2, HEIGHT - 54, mobile ? 2 : 1, 0.5, "#3F266B");
  } else {
    const remaining = s.airJumps - airJumpsUsed;
    drawText(`JUMPS ${remaining} / ${s.airJumps}`, WIDTH / 2, HEIGHT - 54, mobile ? 2 : 1, 0.5, "#3F266B");
  }

  // HUD
  drawText(`LEVEL ${playerLevel}  SPEED ${Math.round(s.speed * 10)}`, 10, 10, mobile ? 2 : 1, 0, "#3F266B");

  // Clear screen with rankings
  if (cleared) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;

    drawText("CLEAR", WIDTH / 2, 110, 3, 0.5, "#E679D8");
    drawText(`TIME ${formatTime(clearTime)}`, WIDTH / 2, 190, 2, 0.5, "#fff");
    drawText("BEST TIMES", WIDTH / 2, 260, 2, 0.5, "#E679D8");

    const times: number[] = JSON.parse(localStorage.getItem("rainbowspeed:t") || "[]");
    let highlighted = false;
    for (let i = 0; i < times.length; i++) {
      const color = !highlighted && times[i] === clearTime ? (highlighted = true, "#E679D8") : "#fff";
      drawText(`${i + 1} ${formatTime(times[i])}`, WIDTH / 2, 320 + i * 40, 1, 0.5, color);
    }

    drawText("PRESS SPACE TO RESTART", WIDTH / 2, 330 + times.length * 40 + 50, 1, 0.5, "#B2C1DB");
  }
}

function main() {
  if (titleScreen) {
    if (keys["KeyB"]) {
      keys["KeyB"] = false;
      showBestTimes = !showBestTimes;
      sfxJump();
    }
    if (keys["Space"]) {
      keys["Space"] = false;
      showBestTimes = false;
      sfxStart();
      playerLevel = 0;
      bonusSpeed = 0;
      levelUpTimer = 0;
      expUpTimer = 0;
      flashTimer = 0;
      flashRed = false;
      damaged = false;
      startTime = performance.now();
      particles.length = 0;
      stars.length = 0;
      bgBlend = 0;
      starTimer = 0;
      restart();
      titleScreen = false;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#D4DDED";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (showBestTimes) {
      drawText("BEST TIMES", WIDTH / 2, 200, 3, 0.5, "#E679D8");
      const times: number[] = JSON.parse(localStorage.getItem("rainbowspeed:t") || "[]");
      if (times.length === 0) {
        drawText("NO RECORD", WIDTH / 2, 320, 1, 0.5, "#B2C1DB");
      } else {
        for (let i = 0; i < times.length; i++) {
          drawText(`${i + 1} ${formatTime(times[i])}`, WIDTH / 2, 300 + i * 40, 1, 0.5, "#3F266B");
        }
      }
      if (mobile) {
        drawText("TAP TO BACK", WIDTH / 2, 540, 1, 0.5, "#B2C1DB");
      } else {
        drawText("PRESS B TO BACK", WIDTH / 2, 540, 1, 0.5, "#B2C1DB");
      }
    } else {
      drawText("RAINBOW SPEED", WIDTH / 2, 200, 3, 0.5, "#E679D8");
      if (mobile) {
        drawText("MOVE : TAP R OR L", WIDTH / 2, 320, 1, 0.5, "#B2C1DB");
        drawText("JUMP : TAP R AND L", WIDTH / 2, 360, 1, 0.5, "#B2C1DB");
        drawText("TAP TO START", WIDTH / 2, 460, 1, 0.5, "#3F266B");
      } else {
        drawText("MOVE : R OR L   JUMP : SPACE", WIDTH / 2, 340, 1, 0.5, "#B2C1DB");
        drawText("M : MUTE   B : BEST TIMES", WIDTH / 2, 380, 1, 0.5, "#B2C1DB");
        drawText("PRESS SPACE TO START", WIDTH / 2, 460, 1, 0.5, "#3F266B");
      }
    }
  } else {
    update();
    draw();
  }
  if (mobile && titleScreen) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff";
    ctx.fillRect(WIDTH - 148, 0, 148, 56);
    ctx.fillRect(0, 0, 328, 56);
    ctx.globalAlpha = 1;
  }
  if (mobile) {
    drawText("MUTE", WIDTH - 10, 10, 2, 1, muted ? "#3F266B" : "#B2C1DB");
    if (titleScreen) drawText("BEST TIMES", 10, 10, 2, 0, showBestTimes ? "#3F266B" : "#B2C1DB");
  } else {
    drawText("MUTE", WIDTH - 10, 10, 1, 1, muted ? "#3F266B" : "#B2C1DB");
  }
  if (titleScreen) {
    ctx.font = "9px monospace";
    ctx.fillStyle = "#B2C1DB";
    ctx.fillText("2026 Flyable Heart", WIDTH / 2 - 25, HEIGHT - 10);
  }
}
let lastFrame = 0;
let fpsLimit = 0;
let detectFrames = 0;
let detectStart = 0;
function loop(now: number) {
  requestAnimationFrame(loop);
  // Detect: first 1s, if >70 frames → 120Hz, enable limit
  if (detectFrames >= 0) {
    if (!detectStart) detectStart = now;
    detectFrames++;
    if (detectFrames > 70) { fpsLimit = 15; detectFrames = -1; }
    if (now - detectStart >= 1000) detectFrames = -1;
  }
  if (now - lastFrame < fpsLimit) return;
  lastFrame = now;
  // @ts-ignore: debug FPS counter (dead code in production)
  if (false) {
    let fpsCount = 0;
    let fpsTime = 0;
    let fpsDisplay = 0;
    fpsCount++;
    if (now - fpsTime >= 1000) {
      fpsDisplay = fpsCount;
      fpsCount = 0;
      fpsTime = now;
    }
    main();
    drawText(`${fpsDisplay} ${fpsLimit ? "LIMIT" : ""}`, WIDTH - 10, 40, 2, 1, "#E679D8");
    return;
  }
  main();
}

spriteSheet.onload = () => requestAnimationFrame(loop);
