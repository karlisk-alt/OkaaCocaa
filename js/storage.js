const ScoreStorage = (() => {
  const DATA_KEY = 'blockrunner_data';
  const LEGACY_KEY = 'blockrunner_highscore';
  const MAX_ENTRIES = 10;
  const MAX_NAME_LEN = 12;

  let cached = null;
  let memoryFallback = { playerName: '', leaderboard: [] };

  function defaultData() {
    return { playerName: '', leaderboard: [], difficulty: 'normal' };
  }

  function readRaw() {
    if (cached) return cached;

    try {
      const val = localStorage.getItem(DATA_KEY);
      if (val) {
        cached = JSON.parse(val);
        memoryFallback = cached;
        return cached;
      }
    } catch (_) {}

    try {
      const match = document.cookie.match(new RegExp(`(?:^|; )${DATA_KEY}=([^;]*)`));
      if (match) {
        cached = JSON.parse(decodeURIComponent(match[1]));
        memoryFallback = cached;
        return cached;
      }
    } catch (_) {}

    cached = typeof structuredClone === 'function'
      ? structuredClone(memoryFallback)
      : JSON.parse(JSON.stringify(memoryFallback));
    migrateLegacyScore(cached);
    return cached;
  }

  function migrateLegacyScore(data) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && data.leaderboard.length === 0) {
        const score = parseInt(legacy, 10) || 0;
        if (score > 0) {
          data.leaderboard.push({
            name: 'Player',
            score,
            date: new Date().toISOString().slice(0, 10),
          });
        }
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (_) {}
  }

  function write(data) {
    cached = data;
    memoryFallback = data;
    const str = JSON.stringify(data);

    try {
      localStorage.setItem(DATA_KEY, str);
    } catch (_) {}

    try {
      document.cookie = `${DATA_KEY}=${encodeURIComponent(str)}; max-age=31536000; path=/; SameSite=Lax`;
    } catch (_) {}
  }

  function sanitizeName(name) {
    return String(name || 'Player')
      .trim()
      .slice(0, MAX_NAME_LEN)
      .replace(/[<>"'&]/g, '') || 'Player';
  }

  function getLeaderboard() {
    const data = readRaw();
    return [...data.leaderboard].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  }

  function getTopScore() {
    const board = getLeaderboard();
    return board.length ? board[0].score : 0;
  }

  function getPlayerName() {
    return readRaw().playerName || '';
  }

  function setPlayerName(name) {
    const data = readRaw();
    data.playerName = sanitizeName(name);
    write(data);
    return data.playerName;
  }

  function qualifies(score) {
    const board = getLeaderboard();
    if (board.length < MAX_ENTRIES) return true;
    const lowest = board[board.length - 1].score;
    return score > lowest;
  }

  function addEntry(name, score) {
    const data = readRaw();
    const entry = {
      name: sanitizeName(name),
      score: Math.max(0, Math.floor(score)),
      date: new Date().toISOString().slice(0, 10),
    };

    data.playerName = entry.name;
    data.leaderboard.push(entry);
    data.leaderboard.sort((a, b) => b.score - a.score);
    data.leaderboard = data.leaderboard.slice(0, MAX_ENTRIES);
    write(data);
    return { entry, board: getLeaderboard() };
  }

  function minScoreToQualify() {
    const board = getLeaderboard();
    if (board.length < MAX_ENTRIES) return 1;
    return board[board.length - 1].score + 1;
  }

  function getDifficulty() {
    return readRaw().difficulty || 'normal';
  }

  function setDifficulty(level) {
    const data = readRaw();
    data.difficulty = ['easy', 'normal', 'hard'].includes(level) ? level : 'normal';
    write(data);
    return data.difficulty;
  }

  return {
    getLeaderboard,
    getTopScore,
    getPlayerName,
    setPlayerName,
    qualifies,
    addEntry,
    minScoreToQualify,
    getDifficulty,
    setDifficulty,
    MAX_NAME_LEN,
  };
})();