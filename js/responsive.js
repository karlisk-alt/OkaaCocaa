const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

let gameDpr = 1;

function isCoarsePointer() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function resizeGame() {
  const shell = document.querySelector('.game-shell');
  const canvasWrap = document.querySelector('.canvas-wrap');
  const canvas = document.getElementById('game');
  if (!shell || !canvasWrap || !canvas) return;

  gameDpr = Math.min(window.devicePixelRatio || 1, 2.5);

  let availW = canvasWrap.clientWidth || shell.clientWidth;
  let availH = canvasWrap.clientHeight;

  if (availW <= 0) availW = window.innerWidth;
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
  root.classList.toggle('touch-device', isCoarsePointer() || 'ontouchstart' in window);

  resizeGame();

  window.addEventListener('resize', resizeGame);
  window.addEventListener('orientationchange', () => setTimeout(resizeGame, 150));
  document.addEventListener('fullscreenchange', resizeGame);
  window.visualViewport?.addEventListener('resize', resizeGame);
  window.visualViewport?.addEventListener('scroll', resizeGame);

  if (typeof ResizeObserver !== 'undefined') {
    const shell = document.querySelector('.game-shell');
    const wrap = document.querySelector('.canvas-wrap');
    if (shell) new ResizeObserver(resizeGame).observe(shell);
    if (wrap) new ResizeObserver(resizeGame).observe(wrap);
  }

  document.addEventListener('touchmove', (e) => {
    if (document.body.classList.contains('game-active')) e.preventDefault();
  }, { passive: false });
}

function getGameDpr() {
  return gameDpr;
}

function setPlayMode(active) {
  document.body.classList.toggle('game-active', active);
}