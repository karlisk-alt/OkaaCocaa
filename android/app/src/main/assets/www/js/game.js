const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 32;
// GAME_WIDTH / GAME_HEIGHT defined in responsive.js
const GRAVITY = 0.55;
const FRICTION = 0.82;
const COMBO_WINDOW = 120;
const INVINCIBLE_FRAMES = 90;
const JUMP_BUFFER_MAX = 12;
const DASH_FRAMES = 10;
const DASH_COOLDOWN = 90;
const STOMP_CHAIN_WINDOW = 180;

const keys = {};
let newBestFlash = 0;
let playerName = 'Player';
let scoreSubmitted = false;
let lastSubmitted = null;
let gameState = 'menu';
let difficulty = 'normal';
let score = 0;
let lives = 3;
let currentLevel = 0;
let cameraX = 0;
let shakeX = 0;
let shakeY = 0;
let activeEffect = null;
let effectTimer = 0;
let rainbowHue = 0;
let comboCount = 0;
let comboTimer = 0;
let invincibleTimer = 0;
let damageFlash = 0;
let checkpoint = { x: 64, y: 12 * TILE };
let levelBannerTimer = 0;
let levelWidth = 200;
let flagWave = 0;
let jumpBuffer = 0;
let dashTimer = 0;
let dashCooldown = 0;
let animFrame = 0;

const stats = {
  stomps: 0, items: 0, coins: 0, hearts: 0,
  stompChain: 0, stompChainTimer: 0,
  levelStart: 0, gameStart: 0, levelTimes: [], totalTime: 0,
};

const player = {
  x: 64, y: 0, w: 28, h: 36,
  vx: 0, vy: 0, onGround: false, facing: 1, trail: [],
  jumpsLeft: 2, coyoteTimer: 0, wasJumpKey: false,
};

const EFFECTS = {
  coke: { name: 'HYPE', duration: 480, points: 100, desc: 'Speed & jump boost!', speedMult: 1.6, jumpMult: 1.35, apply() { player.w = 28; } },
  meth: { name: 'TWEAK', duration: 360, points: 250, desc: 'Inverted controls + shake!', speedMult: 2.2, jumpMult: 1.1, invertControls: true, shake: true, apply() { player.w = 32; } },
  weed: { name: 'CHILL', duration: 420, points: 150, desc: 'Slow-mo + floaty jumps!', speedMult: 0.75, jumpMult: 1.5, slowMo: true, blur: true, apply() { player.w = 28; } },
};

let platforms = [];
let movingPlatforms = [];
let collectibles = [];
let coins = [];
let spikes = [];
let hearts = [];
let enemies = [];
let flyers = [];
let particles = [];
let popups = [];
let checkpoints = [];
let flag = { x: 0, y: 0, w: 24, h: 48 };
let levelTheme = LEVELS[0].theme;

function getHighScore() { return ScoreStorage.getTopScore(); }

function checkNewBestFlash() {
  const best = getHighScore();
  if (score > best) newBestFlash = 120;
  return best;
}

function escHtml(str) {
  const d = document.createElement('span');
  d.textContent = str;
  return d.innerHTML;
}

function renderLeaderboard(listId) {
  const el = document.getElementById(listId);
  if (!el) return;
  const board = ScoreStorage.getLeaderboard();
  if (!board.length) {
    el.innerHTML = '<li class="empty">No scores yet — be the first!</li>';
    return;
  }
  el.innerHTML = board.map((entry, i) => `
    <li class="${lastSubmitted && entry.name === lastSubmitted.name && entry.score === lastSubmitted.score ? 'highlight' : ''}">
      <span class="rank">${i + 1}.</span>
      <span class="lb-name">${escHtml(entry.name)}</span>
      <span class="lb-score">${entry.score.toLocaleString()}</span>
      <span class="lb-date">${entry.date}</span>
    </li>
  `).join('');
}

function getNameFromInput(inputId) {
  const input = document.getElementById(inputId);
  const name = input?.value.trim() || ScoreStorage.getPlayerName() || 'Player';
  return ScoreStorage.setPlayerName(name);
}

function showEndScreenSubmit() {
  scoreSubmitted = false;
  resetEndScreenUI();
  const qualifies = ScoreStorage.qualifies(score);
  const qualifyEl = document.getElementById('qualify-message');
  const submitBtn = document.getElementById('submit-score-btn');
  const feedback = document.getElementById('submit-feedback');
  feedback.classList.add('hidden');
  document.getElementById('end-name-input').value = playerName;

  if (score <= 0) {
    qualifyEl.textContent = 'No score to submit.';
    submitBtn.disabled = true;
  } else if (qualifies) {
    qualifyEl.textContent = 'You made the leaderboard — enter your name and submit!';
    qualifyEl.className = 'qualify-msg qualify-yes';
    submitBtn.disabled = false;
  } else {
    qualifyEl.textContent = `Need ${ScoreStorage.minScoreToQualify().toLocaleString()} pts to make the top 10.`;
    qualifyEl.className = 'qualify-msg qualify-no';
    submitBtn.disabled = true;
  }

  const totalSec = Math.floor((performance.now() - stats.gameStart) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  document.getElementById('end-stats').innerHTML = `
    <div class="stat-row"><span>Time</span><span>${mins}:${secs.toString().padStart(2, '0')}</span></div>
    <div class="stat-row"><span>Items collected</span><span>${stats.items}</span></div>
    <div class="stat-row"><span>Coins</span><span>${stats.coins}</span></div>
    <div class="stat-row"><span>Enemies stomped</span><span>${stats.stomps}</span></div>
    <div class="stat-row"><span>Hearts found</span><span>${stats.hearts}</span></div>
    <div class="stat-row"><span>Difficulty</span><span>${DIFFICULTY[difficulty].label} (${Math.round(getDifficultyScoreMult() * 100)}% score)</span></div>
  `;

  renderLeaderboard('end-leaderboard');
}

function submitScore() {
  if (score <= 0 || !ScoreStorage.qualifies(score) || scoreSubmitted) return;
  playerName = getNameFromInput('end-name-input');
  ScoreStorage.addEntry(playerName, score);
  scoreSubmitted = true;
  lastSubmitted = { name: playerName, score };
  document.getElementById('submit-feedback').textContent = `Score saved! Press Play Again or R to restart.`;
  document.getElementById('submit-feedback').classList.remove('hidden');
  document.getElementById('submit-score-btn').disabled = true;
  document.getElementById('high-score').textContent = getHighScore();
  document.getElementById('hud-player-name').textContent = playerName;
  document.getElementById('start-name-input').value = playerName;
  renderLeaderboard('end-leaderboard');
  renderLeaderboard('start-leaderboard');
  AudioFX.levelComplete();
  document.getElementById('end-name-input').blur();
  document.getElementById('play-again-btn')?.focus();
}

function buildLevel(levelIndex) {
  const lvl = LEVELS[levelIndex];
  const diff = DIFFICULTY[difficulty];
  platforms = []; movingPlatforms = []; collectibles = [];
  coins = []; spikes = []; hearts = []; enemies = []; flyers = [];
  checkpoints = [];
  levelTheme = lvl.theme;
  levelWidth = lvl.width;

  lvl.ground.forEach(([x, y, w]) => {
    for (let i = 0; i < w; i++) platforms.push({ x: (x + i) * TILE, y: y * TILE, w: TILE, h: TILE, type: 'ground' });
  });
  lvl.floats.forEach(([x, y, w]) => {
    for (let i = 0; i < w; i++) platforms.push({ x: (x + i) * TILE, y: y * TILE, w: TILE, h: TILE, type: 'brick' });
  });
  lvl.moving.forEach((m) => {
    const mp = {
      x: m.x * TILE, y: (m.yBase || m.y) * TILE, w: m.w * TILE, h: TILE, type: 'moving',
      originX: m.x * TILE, originY: (m.yBase || m.y) * TILE,
      range: m.range, speed: m.speed, axis: m.axis || 'x', dir: 1, offset: 0,
    };
    movingPlatforms.push(mp);
    platforms.push(mp);
  });

  lvl.loot.forEach(([tx, row, type]) => {
    collectibles.push({ x: tx * TILE + 4, y: row * TILE - 26, w: 24, h: 24, type, collected: false, bob: Math.random() * Math.PI * 2 });
  });
  (lvl.coins || []).forEach(([tx, row]) => {
    coins.push({ x: tx * TILE + 8, y: row * TILE - 22, w: 16, h: 16, collected: false, bob: Math.random() * Math.PI * 2, spin: 0 });
  });
  (lvl.hearts || []).forEach(([tx, row]) => {
    hearts.push({ x: tx * TILE + 4, y: row * TILE - 26, w: 24, h: 24, collected: false, bob: Math.random() * Math.PI * 2 });
  });

  const spikeMult = difficulty === 'hard' ? 1 : difficulty === 'easy' ? 0 : 1;
  (lvl.spikes || []).forEach(([tx, ty, w], i) => {
    if (difficulty === 'easy' && i > 0) return;
    for (let j = 0; j < w * spikeMult; j++) {
      spikes.push({ x: (tx + j) * TILE, y: ty * TILE - 14, w: TILE, h: 14 });
    }
  });

  lvl.enemies.forEach(([tx, ty]) => {
    enemies.push({
      x: tx * TILE, y: ty * TILE - 28, w: 28, h: 28, type: 'walker',
      vx: (1.2 + levelIndex * 0.3) * diff.enemyMult,
      minX: tx * TILE - 64, maxX: tx * TILE + 64, alive: true,
    });
  });
  (lvl.flyers || []).forEach(([tx, ty, range]) => {
    flyers.push({
      x: tx * TILE, y: ty * TILE, w: 26, h: 20, type: 'flyer',
      vx: 1.5 * diff.enemyMult, minX: tx * TILE - range, maxX: tx * TILE + range,
      alive: true, wing: 0,
    });
  });

  lvl.checkpoints.forEach(([tx, ty], i) => {
    checkpoints.push({ x: tx * TILE, y: ty * TILE - 40, w: 8, h: 40, id: i, activated: false });
  });

  flag.x = lvl.flag[0] * TILE;
  flag.y = lvl.flag[1] * TILE;
  resetPlayer();
  checkpoint = { x: 64, y: 12 * TILE };
  cameraX = 0;
  levelBannerTimer = 180;
  stats.levelStart = performance.now();
  updateHUD();
}

function resetPlayer() {
  player.x = 64; player.y = 12 * TILE;
  player.vx = 0; player.vy = 0; player.trail = [];
  player.w = 28; player.jumpsLeft = 2;
  player.coyoteTimer = 0; player.wasJumpKey = false;
  jumpBuffer = 0; dashTimer = 0;
}

function resetEndScreenUI() {
  const submitBtn = document.getElementById('submit-score-btn');
  const feedback = document.getElementById('submit-feedback');
  if (submitBtn) submitBtn.disabled = false;
  if (feedback) feedback.classList.add('hidden');
}

function hideAllOverlays() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.activeElement?.blur();
}

function syncPlayMode() {
  setPlayMode?.(gameState === 'playing');
}

function startGame(fullReset = true) {
  const endVisible = !document.getElementById('end-screen').classList.contains('hidden');
  const nameId = endVisible ? 'end-name-input' : 'start-name-input';
  playerName = getNameFromInput(nameId);
  if (endVisible) {
    document.getElementById('start-name-input').value = playerName;
  }

  difficulty = document.getElementById('difficulty-select')?.value || ScoreStorage.getDifficulty();
  ScoreStorage.setDifficulty(difficulty);
  gameState = 'playing';
  scoreSubmitted = false;
  lastSubmitted = null;
  resetEndScreenUI();
  hideAllOverlays();

  if (fullReset) {
    score = 0;
    lives = DIFFICULTY[difficulty].lives;
    currentLevel = 0;
    activeEffect = null; effectTimer = 0;
    comboCount = 0; comboTimer = 0;
    invincibleTimer = 0; damageFlash = 0;
    dashTimer = 0; dashCooldown = 0;
    stats.stomps = 0; stats.items = 0; stats.coins = 0; stats.hearts = 0;
    stats.stompChain = 0; stats.stompChainTimer = 0;
    stats.levelTimes = [];
    stats.gameStart = performance.now();
  }
  buildLevel(currentLevel);
  syncPlayMode();
}

function goToMainMenu() {
  gameState = 'menu';
  scoreSubmitted = false;
  lastSubmitted = null;
  resetEndScreenUI();
  hideAllOverlays();
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('start-name-input').value = playerName;
  renderLeaderboard('start-leaderboard');
  buildLevel(0);
  syncPlayMode();
}

function updateHUD() {
  const best = checkNewBestFlash();
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = `${currentLevel + 1} / ${LEVELS.length}`;
  const diffMultEl = document.getElementById('diff-mult');
  if (diffMultEl) {
    const m = getDifficultyScoreMult();
    diffMultEl.textContent = m === 1 ? '' : `${Math.round(m * 100)}%`;
    diffMultEl.classList.toggle('hidden', m === 1);
  }
  document.getElementById('high-score').textContent = best;
  document.getElementById('hud-player-name').textContent = playerName;
  document.getElementById('level-name').textContent = LEVELS[currentLevel]?.name || '';
  document.getElementById('high-score').classList.toggle('new-best', newBestFlash > 0 && score > best);

  const progress = Math.min(100, (player.x / (flag.x + flag.w)) * 100);
  document.getElementById('progress-fill').style.width = `${progress}%`;

  const effectBar = document.getElementById('effect-bar-fill');
  const effectWrap = document.getElementById('effect-bar-wrap');
  if (activeEffect && effectTimer > 0) {
    effectWrap.classList.remove('hidden');
    effectBar.style.width = `${(effectTimer / activeEffect.duration) * 100}%`;
    effectBar.style.background = activeEffect.name === 'HYPE' ? '#ffd700' : activeEffect.name === 'TWEAK' ? '#ff6b9d' : '#6bffb8';
  } else {
    effectWrap.classList.add('hidden');
  }

  const comboEl = document.getElementById('combo-display');
  if (comboCount > 1) { comboEl.textContent = `x${comboCount} COMBO`; comboEl.classList.add('active'); }
  else { comboEl.textContent = ''; comboEl.classList.remove('active'); }

  const el = document.getElementById('effect-display');
  if (activeEffect && effectTimer > 0) {
    el.textContent = `${activeEffect.name}: ${activeEffect.desc} (${Math.ceil(effectTimer / 60)}s)`;
    el.classList.add('active');
  } else {
    el.textContent = 'No active effect';
    el.classList.remove('active');
  }

  const dashEl = document.getElementById('dash-indicator');
  dashEl.classList.toggle('ready', dashCooldown <= 0 && dashTimer <= 0);
  dashEl.classList.toggle('cooldown', dashCooldown > 0);
}

function getTimeScale() { return activeEffect?.slowMo ? 0.55 : 1; }
function getSpeedMult() { return activeEffect ? activeEffect.speedMult : 1; }
function getJumpForce() { return activeEffect ? -11.5 * activeEffect.jumpMult : -11.5; }

function getMoveInput() {
  let left = keys['ArrowLeft'] || keys['a'] || keys['A'] || touchInput.left;
  let right = keys['ArrowRight'] || keys['d'] || keys['D'] || touchInput.right;
  if (activeEffect?.invertControls) [left, right] = [right, left];
  return { left, right };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function canCollect(player, c) {
  const bobY = Math.sin(c.bob) * 3;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2 + bobY;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  return Math.abs(cx - px) < 34 && Math.abs(cy - py) < 38;
}

function addPopup(x, y, text, color = '#ffd700') {
  popups.push({ x, y, text, color, life: 60, vy: -1.5 });
}

function getDifficultyScoreMult() {
  return DIFFICULTY[difficulty]?.scoreMult ?? 1;
}

function addScore(basePts) {
  const pts = Math.round(basePts * getDifficultyScoreMult());
  score += pts;
  return pts;
}

function scorePopupSuffix() {
  const mult = getDifficultyScoreMult();
  if (mult === 1) return '';
  return ` (${DIFFICULTY[difficulty].label})`;
}

function applyEffect(type) {
  const fx = EFFECTS[type];
  const mult = Math.max(1, comboCount);
  const pts = addScore(fx.points * mult);
  stats.items++;
  if (comboTimer > 0) comboCount = Math.min(comboCount + 1, 5);
  else comboCount = 1;
  comboTimer = COMBO_WINDOW;
  if (comboCount > 1) AudioFX.combo();
  activeEffect = fx; effectTimer = fx.duration; fx.apply();
  addPopup(player.x, player.y - 10, `+${pts}${mult > 1 ? ' x' + mult : ''}${scorePopupSuffix()}`, type === 'coke' ? '#fff' : type === 'meth' ? '#ff6b9d' : '#6bffb8');
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, type === 'coke' ? '#fff' : type === 'meth' ? '#ff6b9d' : '#6bffb8', 12);
  AudioFX.collect(type);
  updateHUD();
}

function collectCoin(c) {
  c.collected = true;
  const pts = addScore(25);
  stats.coins++;
  addPopup(c.x, c.y, `+${pts}${scorePopupSuffix()}`, '#ffd700');
  spawnParticles(c.x + 8, c.y + 8, '#ffd700', 6);
  AudioFX.coin();
  updateHUD();
}

function collectHeart(h) {
  if (lives >= 5) return;
  h.collected = true;
  lives = Math.min(5, lives + 1);
  stats.hearts++;
  addPopup(h.x, h.y, '+1 LIFE', '#ff6b9d');
  spawnParticles(h.x + 12, h.y + 12, '#ff6b9d', 10);
  AudioFX.heart();
  updateHUD();
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 30 + Math.random() * 20, color, size: 2 + Math.random() * 3 });
  }
}

function tryJump() {
  if (player.onGround || player.coyoteTimer > 0) {
    player.vy = getJumpForce();
    player.jumpsLeft = 1;
    player.coyoteTimer = 0;
    player.onGround = false;
    jumpBuffer = 0;
    AudioFX.jump();
    return true;
  }
  if (player.jumpsLeft > 0) {
    player.vy = getJumpForce() * 0.88;
    player.jumpsLeft--;
    jumpBuffer = 0;
    AudioFX.jump();
    return true;
  }
  return false;
}

function tryDash() {
  if (dashCooldown > 0 || dashTimer > 0) return;
  dashTimer = DASH_FRAMES;
  dashCooldown = DASH_COOLDOWN;
  player.vx = player.facing * 12;
  player.vy = 0;
  AudioFX.dash();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#58a6ff', 8);
}

function updateMovingPlatforms() {
  const ts = getTimeScale();
  movingPlatforms.forEach((mp) => {
    mp.offset += mp.speed * mp.dir * ts;
    if (mp.offset >= mp.range || mp.offset <= 0) mp.dir *= -1;
    mp.offset = Math.max(0, Math.min(mp.range, mp.offset));
    if (mp.axis === 'y') mp.y = mp.originY + mp.offset;
    else mp.x = mp.originX + mp.offset;
  });
}

function updatePlayer() {
  const ts = getTimeScale();
  animFrame++;

  if (dashTimer > 0) {
    dashTimer--;
    player.x += player.facing * 14 * ts;
    player.vy = 0;
    if (dashTimer <= 0) player.vx = player.facing * 4;
    platforms.forEach((p) => {
      if (!rectsOverlap(player, p)) return;
      if (player.vy >= 0 && player.y + player.h - p.y < 20) {
        player.y = p.y - player.h;
        player.onGround = true;
      }
    });
    if (player.onGround) { player.jumpsLeft = 2; player.coyoteTimer = 10; }
    if (player.y > GAME_HEIGHT + 50) loseLife();
    return;
  }

  const { left, right } = getMoveInput();
  const accel = 0.7 * getSpeedMult() * ts;
  if (left) { player.vx -= accel; player.facing = -1; }
  if (right) { player.vx += accel; player.facing = 1; }
  player.vx = Math.max(-5 * getSpeedMult(), Math.min(5 * getSpeedMult(), player.vx));
  player.vx *= player.onGround ? FRICTION : 0.98;

  const jumpKey = keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W'] || touchInput.jump;
  const jumpJustPressed = jumpKey && !player.wasJumpKey;
  const jumpReleased = !jumpKey && player.wasJumpKey;
  player.wasJumpKey = jumpKey;
  if (touchInput.jump) { player.wasJumpKey = false; touchInput.jump = false; }

  if (jumpJustPressed) {
    if (!tryJump()) jumpBuffer = JUMP_BUFFER_MAX;
  }
  if (jumpBuffer > 0) {
    jumpBuffer--;
    if (tryJump()) jumpBuffer = 0;
  }
  if (jumpReleased && player.vy < -3) player.vy *= 0.45;

  const dashKey = keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight'];
  if (dashKey && !keys._dashHeld) tryDash();
  keys._dashHeld = dashKey;

  player.vy += GRAVITY * ts;
  player.x += player.vx * ts;
  player.y += player.vy * ts;
  player.onGround = false;

  if (activeEffect?.name === 'TWEAK') {
    player.trail.push({ x: player.x, y: player.y, hue: rainbowHue });
    if (player.trail.length > 14) player.trail.shift();
    rainbowHue = (rainbowHue + 12) % 360;
  } else player.trail = [];

  platforms.forEach((p) => {
    if (!rectsOverlap(player, p)) return;
    const overlapX = Math.min(player.x + player.w - p.x, p.x + p.w - player.x);
    const overlapY = Math.min(player.y + player.h - p.y, p.y + p.h - player.y);
    if (overlapX < overlapY) {
      if (player.x + player.w / 2 < p.x + p.w / 2) player.x = p.x - player.w;
      else player.x = p.x + p.w;
      player.vx = 0;
    } else if (player.vy > 0) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      if (p.type === 'moving') {
        if (p.axis === 'x') player.x += p.speed * p.dir * ts;
        else player.y += p.speed * p.dir * ts;
      }
    } else {
      player.y = p.y + p.h;
      player.vy = 0;
    }
  });

  if (invincibleTimer <= 0) {
    spikes.forEach((s) => { if (rectsOverlap(player, s)) loseLife(); });
  }

  checkpoints.forEach((cp) => {
    if (!cp.activated && player.x + player.w > cp.x && player.x < cp.x + 40) {
      cp.activated = true;
      checkpoint = { x: cp.x, y: cp.y };
      addPopup(cp.x, cp.y - 20, 'CHECKPOINT', '#58a6ff');
      AudioFX.checkpoint();
    }
  });

  if (player.onGround) { player.jumpsLeft = 2; player.coyoteTimer = 10; }
  else if (player.coyoteTimer > 0) player.coyoteTimer--;

  if (player.y > GAME_HEIGHT + 50) loseLife();
  if (player.x < 0) { player.x = 0; player.vx = 0; }
}

function stompEnemy(e, bonus) {
  e.alive = false;
  player.vy = -8;
  if (stats.stompChainTimer > 0) stats.stompChain = Math.min(stats.stompChain + 1, 8);
  else stats.stompChain = 1;
  stats.stompChainTimer = STOMP_CHAIN_WINDOW;
  const chainMult = stats.stompChain;
  const pts = addScore(50 * chainMult + bonus);
  stats.stomps++;
  addPopup(e.x, e.y, `+${pts}${chainMult > 1 ? ' x' + chainMult : ''}${scorePopupSuffix()}`, '#ff7b72');
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff4444', 8);
  AudioFX.stomp();
  updateHUD();
}

function updateEnemies() {
  const ts = getTimeScale();
  if (invincibleTimer > 0) return;

  enemies.forEach((e) => {
    if (!e.alive) return;
    e.x += e.vx * ts;
    if (e.x <= e.minX || e.x >= e.maxX) e.vx *= -1;
    if (rectsOverlap(player, e)) {
      if (player.vy > 0 && player.y + player.h - e.y < 14) stompEnemy(e, 0);
      else loseLife();
    }
  });

  flyers.forEach((f) => {
    if (!f.alive) return;
    f.x += f.vx * ts;
    f.wing += 0.3;
    if (f.x <= f.minX || f.x >= f.maxX) f.vx *= -1;
    if (rectsOverlap(player, f)) {
      if (player.vy > 0 && player.y + player.h - f.y < 12) stompEnemy(f, 25);
      else loseLife();
    }
  });
}

function updateCollectibles() {
  collectibles.forEach((c) => {
    if (c.collected) return;
    c.bob += 0.08;
    if (canCollect(player, c)) { c.collected = true; applyEffect(c.type); }
  });
  coins.forEach((c) => {
    if (c.collected) return;
    c.bob += 0.1; c.spin += 0.15;
    if (canCollect(player, c)) collectCoin(c);
  });
  hearts.forEach((h) => {
    if (h.collected) return;
    h.bob += 0.06;
    if (canCollect(player, h)) collectHeart(h);
  });
}

function updatePopups() {
  popups = popups.filter((p) => { p.y += p.vy; p.life--; return p.life > 0; });
}

function updateParticles() {
  particles = particles.filter((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; return p.life > 0; });
}

function updateCombo() {
  if (comboTimer > 0) { comboTimer--; if (comboTimer <= 0) { comboCount = 0; updateHUD(); } }
  if (stats.stompChainTimer > 0) { stats.stompChainTimer--; if (stats.stompChainTimer <= 0) stats.stompChain = 0; }
}

function updateEffect() {
  if (effectTimer > 0) {
    effectTimer--;
    if (effectTimer <= 0) { activeEffect = null; player.w = 28; updateHUD(); }
  }
  if (activeEffect?.shake) { shakeX = (Math.random() - 0.5) * 6; shakeY = (Math.random() - 0.5) * 4; }
  else { shakeX = 0; shakeY = 0; }
  if (invincibleTimer > 0) invincibleTimer--;
  if (damageFlash > 0) damageFlash--;
  if (levelBannerTimer > 0) levelBannerTimer--;
  if (newBestFlash > 0) newBestFlash--;
  if (dashCooldown > 0) dashCooldown--;
  flagWave += 0.08;
}

function loseLife() {
  if (invincibleTimer > 0) return;
  lives--;
  damageFlash = 30;
  AudioFX.hurt();
  updateHUD();
  if (lives <= 0) { endGame(false); return; }
  player.x = checkpoint.x; player.y = checkpoint.y;
  player.vx = 0; player.vy = 0;
  activeEffect = null; effectTimer = 0; player.w = 28;
  invincibleTimer = INVINCIBLE_FRAMES;
  dashTimer = 0;
}

function awardTimeBonus() {
  const elapsed = (performance.now() - stats.levelStart) / 1000;
  stats.levelTimes.push(elapsed);
  const bonus = addScore(Math.max(0, Math.floor((180 - elapsed) * 5)));
  if (bonus > 0) {
    addPopup(flag.x, flag.y - 30, `TIME +${bonus}${scorePopupSuffix()}`, '#58a6ff');
  }
}

function checkWin() {
  if (player.x + player.w >= flag.x) {
    const pts = addScore(500);
    addPopup(flag.x, flag.y, `+${pts}${scorePopupSuffix()}`, '#22c55e');
    awardTimeBonus();
    AudioFX.levelComplete();
    if (currentLevel < LEVELS.length - 1) {
      currentLevel++;
      buildLevel(currentLevel);
      gameState = 'playing';
    } else endGame(true);
    updateHUD();
  }
}

function endGame(won) {
  gameState = won ? 'won' : 'lost';
  if (!won) AudioFX.gameOver();
  stats.totalTime = performance.now() - stats.gameStart;
  document.getElementById('end-title').textContent = won ? 'You Beat The Game!' : 'Game Over';
  const hs = getHighScore();
  document.getElementById('end-message').textContent =
    `Final score: ${score.toLocaleString()}${score > hs ? ' — beats the leaderboard!' : ''} · Top: ${hs.toLocaleString()}`;
  showEndScreenSubmit();
  document.getElementById('end-screen').classList.remove('hidden');
  syncPlayMode();
}

function togglePause() {
  if (gameState === 'playing') { gameState = 'paused'; document.getElementById('pause-screen').classList.remove('hidden'); }
  else if (gameState === 'paused') { gameState = 'playing'; document.getElementById('pause-screen').classList.add('hidden'); }
  syncPlayMode();
}

function toggleMute() {
  const muted = AudioFX.toggleMute();
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  document.getElementById('mute-btn').classList.toggle('muted', muted);
}

function toggleFullscreen() {
  const shell = document.querySelector('.game-shell');
  if (!document.fullscreenElement) {
    shell.requestFullscreen?.().then?.(() => resizeGame?.());
  } else {
    document.exitFullscreen?.().then?.(() => resizeGame?.());
  }
}

function updateCamera() {
  const target = player.x - GAME_WIDTH * 0.35;
  cameraX += (target - cameraX) * 0.1;
  cameraX = Math.max(0, Math.min(cameraX, levelWidth * TILE - GAME_WIDTH));
}

function drawParallax() {
  const hills = levelTheme.parallax || '#2d7a32';
  ctx.fillStyle = hills;
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 280 - cameraX * 0.35) % (GAME_WIDTH + 300)) - 80;
    ctx.beginPath();
    ctx.moveTo(hx, 16 * TILE);
    ctx.quadraticCurveTo(hx + 80, 16 * TILE - 60 - i * 8, hx + 160, 16 * TILE);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 350 - cameraX * 0.15) % (GAME_WIDTH + 400)) - 100;
    ctx.fillRect(bx, 16 * TILE - 120 - (i % 3) * 30, 60 + i * 15, 120 + (i % 3) * 30);
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  levelTheme.sky.forEach((c, i) => grad.addColorStop(i / (levelTheme.sky.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 200 - cameraX * 0.2) % (GAME_WIDTH + 200)) - 100;
    ctx.beginPath();
    ctx.ellipse(cx, 50 + i * 20, 45 + i * 8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParallax();
  ctx.fillStyle = levelTheme.ground;
  ctx.fillRect(0, 16 * TILE, GAME_WIDTH, GAME_HEIGHT - 16 * TILE);

  ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
  for (let x = -cameraX % 40; x < GAME_WIDTH; x += 40) {
    ctx.fillRect(x, 16 * TILE - 8, 20, 8);
  }
}

function drawPlatforms() {
  platforms.forEach((p) => {
    const sx = p.x - cameraX;
    if (sx + p.w < -10 || sx > GAME_WIDTH + 10) return;
    if (p.type === 'moving') {
      ctx.fillStyle = '#6a5acd'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#8a7ae8'; ctx.fillRect(sx + 2, p.y + 2, p.w - 4, 6);
      ctx.strokeStyle = '#4a3a9d'; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    } else if (p.type === 'ground') {
      ctx.fillStyle = '#5a3e28'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = levelTheme.ground; ctx.fillRect(sx, p.y, p.w, 6);
    } else {
      ctx.fillStyle = '#c84b1a'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#e86a30'; ctx.fillRect(sx + 2, p.y + 2, p.w - 4, 6);
      ctx.strokeStyle = '#8b3010'; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    }
  });
}

function drawSpikes() {
  spikes.forEach((s) => {
    const sx = s.x - cameraX;
    if (sx + s.w < -10 || sx > GAME_WIDTH + 10) return;
    ctx.fillStyle = '#888';
    for (let i = 0; i < s.w; i += TILE) {
      ctx.beginPath();
      ctx.moveTo(sx + i, s.y + s.h);
      ctx.lineTo(sx + i + TILE / 2, s.y);
      ctx.lineTo(sx + i + TILE, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawCheckpoints() {
  checkpoints.forEach((cp) => {
    const sx = cp.x - cameraX;
    if (sx < -20 || sx > GAME_WIDTH + 20) return;
    ctx.fillStyle = cp.activated ? '#22c55e' : '#555';
    ctx.fillRect(sx, cp.y, cp.w, cp.h);
    if (cp.activated) { ctx.fillStyle = '#86efac'; ctx.fillRect(sx + 1, cp.y + 4, cp.w - 2, 8); }
  });
}

function drawCoins() {
  coins.forEach((c) => {
    if (c.collected) return;
    const sx = c.x - cameraX;
    const sy = c.y + Math.sin(c.bob) * 3;
    if (sx < -20 || sx > GAME_WIDTH + 20) return;
    ctx.save();
    ctx.translate(sx + 8, sy + 8);
    ctx.scale(Math.cos(c.spin) * 0.4 + 0.6, 1);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffec8b';
    ctx.fillRect(-2, -5, 4, 10);
    ctx.restore();
  });
}

function drawHearts() {
  hearts.forEach((h) => {
    if (h.collected) return;
    const sx = h.x - cameraX;
    const sy = h.y + Math.sin(h.bob) * 4;
    if (sx < -30 || sx > GAME_WIDTH + 30) return;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.moveTo(sx + 12, sy + 8);
    ctx.bezierCurveTo(sx + 12, sy, sx, sy, sx, sy + 8);
    ctx.bezierCurveTo(sx, sy + 14, sx + 12, sy + 18, sx + 12, sy + 22);
    ctx.bezierCurveTo(sx + 12, sy + 18, sx + 24, sy + 14, sx + 24, sy + 8);
    ctx.bezierCurveTo(sx + 24, sy, sx + 12, sy, sx + 12, sy + 8);
    ctx.fill();
  });
}

function drawCollectibles() {
  collectibles.forEach((c) => {
    if (c.collected) return;
    const sx = c.x - cameraX;
    const sy = c.y + Math.sin(c.bob) * 3;
    if (sx < -30 || sx > GAME_WIDTH + 30) return;
    if (c.type === 'coke') {
      ctx.fillStyle = '#888'; ctx.fillRect(sx - 2, sy + 10, 22, 6);
      ctx.fillStyle = '#ddd'; ctx.fillRect(sx, sy + 11, 18, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx + 1, sy + 15, 16, 2);
    } else if (c.type === 'meth') {
      ctx.save(); ctx.translate(sx + 10, sy + 10);
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ccc'; ctx.fillRect(-2, -12, 4, 6);
      ctx.fillStyle = '#ff3366'; ctx.fillRect(-1, 2, 2, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = '#2d8a4e'; ctx.beginPath(); ctx.ellipse(sx + 10, sy + 12, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.ellipse(sx + 6, sy + 8, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 14, sy + 8, 5, 3, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function drawEnemies() {
  enemies.forEach((e) => {
    if (!e.alive) return;
    const sx = e.x - cameraX;
    if (sx < -40 || sx > GAME_WIDTH + 40) return;
    ctx.fillStyle = '#8b4513';
    ctx.beginPath(); ctx.ellipse(sx + e.w / 2, e.y + e.h - 4, e.w / 2, e.h / 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(sx + 6, e.y + 8, 6, 8); ctx.fillRect(sx + 16, e.y + 8, 6, 8);
    ctx.fillStyle = '#000'; ctx.fillRect(sx + 8, e.y + 10, 3, 4); ctx.fillRect(sx + 18, e.y + 10, 3, 4);
  });
}

function drawFlyers() {
  flyers.forEach((f) => {
    if (!f.alive) return;
    const sx = f.x - cameraX;
    if (sx < -40 || sx > GAME_WIDTH + 40) return;
    const wingOff = Math.sin(f.wing) * 6;
    ctx.fillStyle = '#6b3fa0';
    ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9b6fd0';
    ctx.beginPath(); ctx.ellipse(sx - 2, f.y + 8 + wingOff, 8, 4, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + f.w + 2, f.y + 8 - wingOff, 8, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444'; ctx.fillRect(sx + 8, f.y + 6, 4, 4); ctx.fillRect(sx + 16, f.y + 6, 4, 4);
  });
}

function drawFlag() {
  const sx = flag.x - cameraX;
  const wave = Math.sin(flagWave) * 4;
  ctx.fillStyle = '#666';
  ctx.fillRect(sx, flag.y, 4, flag.h);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(sx + 4, flag.y + wave);
  ctx.quadraticCurveTo(sx + 20, flag.y + 12 + wave * 1.5, sx + 28, flag.y + 12);
  ctx.quadraticCurveTo(sx + 20, flag.y + 24 - wave, sx + 4, flag.y + 24);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  if (invincibleTimer > 0 && Math.floor(invincibleTimer / 6) % 2 === 0) return;

  player.trail.forEach((t, i) => {
    ctx.fillStyle = `hsla(${t.hue}, 80%, 60%, ${(i / player.trail.length) * 0.4})`;
    ctx.fillRect(t.x - cameraX, t.y, player.w, player.h);
  });

  const sx = player.x - cameraX;
  const sy = player.y;
  const running = player.onGround && Math.abs(player.vx) > 0.5;
  const legOff = running ? Math.sin(animFrame * 0.4) * 4 : 0;

  if (activeEffect?.name === 'HYPE') { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 16; }
  if (dashTimer > 0) { ctx.fillStyle = 'rgba(88,166,255,0.4)'; ctx.fillRect(sx - 4, sy, player.w + 8, player.h); }

  ctx.fillStyle = '#e52521'; ctx.fillRect(sx, sy + 8, player.w, player.h - 8);
  ctx.fillStyle = '#ff6b5b'; ctx.fillRect(sx + 4, sy + 12, player.w - 8, player.h - 16);
  ctx.fillStyle = '#cc1a16';
  ctx.fillRect(sx + 6, sy + player.h - 6 + legOff, 5, 6);
  ctx.fillRect(sx + 17, sy + player.h - 6 - legOff, 5, 6);
  ctx.fillStyle = '#ffcc99'; ctx.fillRect(sx + 6, sy, 16, 14);
  ctx.fillStyle = '#e52521'; ctx.fillRect(sx + 4, sy - 2, 20, 8);
  ctx.fillStyle = '#fff';
  const eyeX = player.facing > 0 ? sx + 14 : sx + 6;
  ctx.fillRect(eyeX, sy + 4, 5, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(eyeX + (player.facing > 0 ? 2 : 0), sy + 5, 3, 4);
  ctx.shadowBlur = 0;
}

function drawPopups() {
  popups.forEach((p) => {
    const sx = p.x - cameraX;
    ctx.globalAlpha = p.life / 60;
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(p.text, sx, p.y); ctx.fillText(p.text, sx, p.y);
    ctx.globalAlpha = 1;
  });
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = p.life / 50;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cameraX, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  });
}

function drawLevelBanner() {
  if (levelBannerTimer <= 0) return;
  ctx.globalAlpha = Math.min(1, levelBannerTimer / 60);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, GAME_HEIGHT / 2 - 40, GAME_WIDTH, 80);
  ctx.font = 'bold 28px Segoe UI, sans-serif';
  ctx.fillStyle = '#58a6ff'; ctx.textAlign = 'center';
  ctx.fillText(`Level ${currentLevel + 1}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 5);
  ctx.font = '16px Segoe UI, sans-serif'; ctx.fillStyle = '#c9d1d9';
  ctx.fillText(LEVELS[currentLevel].name, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22);
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

function draw() {
  const dpr = typeof getGameDpr === 'function' ? getGameDpr() : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawPlatforms();
  drawSpikes();
  drawCheckpoints();
  drawCoins();
  drawHearts();
  drawCollectibles();
  drawEnemies();
  drawFlyers();
  drawFlag();
  drawPlayer();
  drawParticles();
  drawPopups();
  drawLevelBanner();

  if (activeEffect?.name === 'HYPE') { ctx.fillStyle = 'rgba(255, 215, 0, 0.06)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
  if (activeEffect?.name === 'TWEAK') { ctx.fillStyle = `hsla(${rainbowHue}, 60%, 50%, 0.08)`; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
  if (activeEffect?.blur) {
    ctx.fillStyle = 'rgba(107, 255, 184, 0.1)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.strokeStyle = 'rgba(107, 255, 184, 0.15)'; ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, GAME_WIDTH - 16, GAME_HEIGHT - 16);
  }
  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${damageFlash / 40})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  ctx.restore();
}

function update() {
  if (gameState !== 'playing') return;
  updateMovingPlatforms();
  updatePlayer();
  updateEnemies();
  updateCollectibles();
  updatePopups();
  updateParticles();
  updateCombo();
  updateEffect();
  updateCamera();
  checkWin();
  if (animFrame % 15 === 0) updateHUD();
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

const touchInput = { left: false, right: false, jump: false, dash: false };

function setupTouch() {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      touchInput[key] = true;
      el.setPointerCapture?.(e.pointerId);
    };
    const up = () => { touchInput[key] = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  };
  const bindOnce = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const fire = (e) => { e.preventDefault(); if (gameState === 'playing') tryDash(); };
    el.addEventListener('pointerdown', fire);
  };
  bind('btn-left', 'left');
  bind('btn-right', 'right');
  bind('btn-jump', 'jump');
  bindOnce('btn-dash');
}

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'ArrowUp') e.preventDefault();

  const onEndScreen = gameState === 'won' || gameState === 'lost';
  const onMenu = gameState === 'menu';

  if ((e.key === 'r' || e.key === 'R') && !onMenu) {
    e.preventDefault();
    startGame(true);
    return;
  }
  if (e.key === 'p' || e.key === 'P') {
    if (!onEndScreen && !onMenu) togglePause();
    return;
  }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
  if (e.key === 'Shift' && gameState === 'playing') tryDash();
});

document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function handlePlayAgain(e) {
  e?.preventDefault();
  startGame(true);
}

function bindTapButton(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  let lastTap = 0;
  const run = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap < 400) return;
    lastTap = now;
    handler(e);
  };
  el.addEventListener('click', run);
  el.addEventListener('touchend', run, { passive: false });
}

bindTapButton('start-btn', () => { AudioFX.init(); startGame(true); });
bindTapButton('play-again-btn', handlePlayAgain);
bindTapButton('main-menu-btn', () => goToMainMenu());
bindTapButton('restart-btn', () => startGame(true));
bindTapButton('resume-btn', () => togglePause());
bindTapButton('submit-score-btn', () => submitScore());
bindTapButton('mute-btn', () => toggleMute());
bindTapButton('pause-btn', () => togglePause());
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
document.getElementById('end-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitScore(); }
});

setupTouch();
initResponsive();
playerName = ScoreStorage.getPlayerName() || 'Player';
difficulty = ScoreStorage.getDifficulty();
document.getElementById('start-name-input').value = playerName;
document.getElementById('difficulty-select').value = difficulty;
document.getElementById('high-score').textContent = getHighScore();
document.getElementById('hud-player-name').textContent = playerName;
renderLeaderboard('start-leaderboard');
buildLevel(0);
loop();