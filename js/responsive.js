const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

let gameDpr = 1;

function isCoarsePointer() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function syncViewportUnits() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

function resizeGame() {
  const shell = document.querySelector('.game-shell');
  const canvasWrap = document.querySelector('.canvas-wrap');
  const canvas = document.getElementById('game');
  if (!shell || !canvasWrap || !canvas) return;

  syncViewportUnits();
  gameDpr = Math.min(window.devicePixelRatio || 1, 2.5);

  const touchLayout = document.documentElement.classList.contains('touch-device');
  let availW = canvasWrap.clientWidth || shell.clientWidth;
  let availH = canvasWrap.clientHeight;

  if (touchLayout && window.visualViewport) {
    const vv = window.visualViewport;
    shell.style.height = `${vv.height}px`;
    shell.style.width = '100%';
    availW = vv.width;
    const hud = shell.querySelector('.hud');
    const progress = shell.querySelector('.progress-wrap');
    const chromeH = (hud?.offsetHeight || 0) + (progress?.offsetHeight || 0) + 4;
    const top = Math.max(0, shell.getBoundingClientRect().top);
    availH = vv.height - top - chromeH;
  } else {
    shell.style.height = '';
    shell.style.width = '';
  }

  if (availW <= 0) availW = window.visualViewport?.width || window.innerWidth;
  if (availH <= 0) availH = availW * (GAME_HEIGHT / GAME_WIDTH);
  if (availW <= 0 || availH <= 0) return;

  const scale = Math.min(availW / GAME_WIDTH, availH / GAME_HEIGHT);
  const displayW = Math.floor(GAME_WIDTH * scale);
  const displayH = Math.floor(GAME_HEIGHT * scale);

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
  canvas.width = Math.floor(GAME_WIDTH * gameDpr);
  canvas.height = Math.floor(GAME_HEIGHT * gameDpr);

  document.documentElement.style.setProperty('--game-display-scale', scale.toFixed(4));
}

function initResponsive() {
  const root = document.documentElement;
  const touch = isCoarsePointer() || 'ontouchstart' in window;
  root.classList.toggle('touch-device', touch);
  root.classList.toggle('ios-device', isIOS());

  resizeGame();

  window.addEventListener('resize', resizeGame);
  window.addEventListener('orientationchange', () => setTimeout(resizeGame, 250));
  document.addEventListener('fullscreenchange', resizeGame);
  window.visualViewport?.addEventListener('resize', resizeGame);
  window.visualViewport?.addEventListener('scroll', resizeGame);
  window.addEventListener('pageshow', (e) => { if (e.persisted) resizeGame(); });

  if (typeof ResizeObserver !== 'undefined') {
    const shell = document.querySelector('.game-shell');
    const wrap = document.querySelector('.canvas-wrap');
    if (shell) new ResizeObserver(resizeGame).observe(shell);
    if (wrap) new ResizeObserver(resizeGame).observe(wrap);
  }

  const blockScroll = (e) => {
    if (document.body.classList.contains('game-active')) e.preventDefault();
  };
  document.addEventListener('touchmove', blockScroll, { passive: false });
  document.addEventListener('gesturestart', (e) => {
    if (document.body.classList.contains('game-active')) e.preventDefault();
  }, { passive: false });
}

function getGameDpr() {
  return gameDpr;
}

function setPlayMode(active) {
  document.body.classList.toggle('game-active', active);
}