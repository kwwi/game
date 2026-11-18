const API_BASE = 'http://localhost:8080/api/games';
const ROOMS_API = 'http://localhost:8080/api/rooms';
const PIECE_IMG_BASE = 'assets/pieces';

const PIECE_FILE = {
  WHALE: 'whale.jpg',
  PHOENIX: 'phoenix.jpg',
  DRAGON: 'dragon.jpg',
  ELEPHANT: 'elephant.jpg',
  LION: 'lion.jpg',
  TIGER: 'tiger.jpg',
  LEOPARD: 'leopard.jpg',
  FORTUNE: 'fortune.jpg',
  WOLF: 'wolf.jpg',
  DOG: 'dog.jpg',
  CAT: 'cat.jpg',
  MOUSE: 'mouse.jpg'
};
const BACK_IMG = PIECE_IMG_BASE + '/back.jpg';

let gameId = null;
let gameState = null;
let prevPiecesMap = null;
let selectedPieceId = null;
let selectedPos = null;
let selectedPieceType = null;
let selectedPieceCamp = null;
let username = '';
let mySide = null;
let pollTimer = null;
let roomPollTimer = null;
let tipTimer = null;
let animBusy = false;
let boardBuilt = false;
let boardRows = 0;
let boardCols = 0;
let reduceMotion = false;

try {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch (e) {
  reduceMotion = false;
}

const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const usernameInput = document.getElementById('username');
const gameIdInput = document.getElementById('gameIdInput');
const roomPanel = document.getElementById('roomPanel');
const roomListEl = document.getElementById('roomList');
const btnLeave = document.getElementById('btnLeave');
const tipEl = document.getElementById('tip');
const pieceGhostEl = document.getElementById('pieceGhost');
const resultBannerEl = document.getElementById('resultBanner');
const btnMute = document.getElementById('btnMute');

const TYPE_RANK = {
  WHALE: 12, PHOENIX: 11, DRAGON: 10, ELEPHANT: 9, LION: 8, TIGER: 7,
  LEOPARD: 6, FORTUNE: 5, WOLF: 4, DOG: 3, CAT: 2, MOUSE: 1
};
const BOARD_GAP_PX = 6;
const BOARD_COLS_DEFAULT = 8;
const BOARD_ROWS_DEFAULT = 7;

const audio = window.AnimalAudio || {
  unlock: function () {},
  play: function () {},
  playAnimal: function () {},
  isMuted: function () { return false; },
  toggleMuted: function () { return false; },
  setMuted: function () {},
  preload: function () {}
};

function syncMuteButton() {
  if (!btnMute) return;
  const muted = audio.isMuted();
  btnMute.textContent = muted ? '🔇' : '🔊';
  btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

if (btnMute) {
  syncMuteButton();
  btnMute.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMuted();
    syncMuteButton();
  });
}

document.addEventListener('pointerdown', () => audio.unlock(), { once: false, passive: true });

function pieceImageUrl(type) {
  const file = PIECE_FILE[type];
  return file ? PIECE_IMG_BASE + '/' + file : null;
}

function toZh(type) {
  switch (type) {
    case 'WHALE': return '鲸';
    case 'PHOENIX': return '凤';
    case 'DRAGON': return '龙';
    case 'ELEPHANT': return '象';
    case 'LION': return '狮';
    case 'TIGER': return '虎';
    case 'LEOPARD': return '豹';
    case 'FORTUNE': return '财';
    case 'WOLF': return '狼';
    case 'DOG': return '狗';
    case 'CAT': return '猫';
    case 'MOUSE': return '鼠';
    default: return '?';
  }
}

function layoutBoardGrid() {
  const stage = document.querySelector('.board-stage');
  if (!stage || !boardEl) return;
  const frame = boardEl.closest('.board-frame');
  const cols = gameState ? (gameState.cols || BOARD_COLS_DEFAULT) : BOARD_COLS_DEFAULT;
  const rows = gameState ? (gameState.rows || BOARD_ROWS_DEFAULT) : BOARD_ROWS_DEFAULT;
  const pad = 8;
  const maxW = stage.clientWidth - pad * 2;
  const capEl = frame && frame.querySelector('.captured-panel');
  const capturedReserve = Math.max(64, (capEl && capEl.offsetHeight > 0 ? capEl.offsetHeight : 0) + 20);
  const framePadY = 40;
  const maxH = Math.max(120, stage.clientHeight - framePadY - capturedReserve);
  const gap = BOARD_GAP_PX;
  const raw = Math.min(
    (maxW - gap * (cols - 1)) / cols,
    (maxH - gap * (rows - 1)) / rows
  );
  let cell = Number.isFinite(raw) ? Math.floor(raw) : 40;
  cell = Math.min(92, Math.max(28, cell));
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
  boardEl.style.gap = `${gap}px`;
  boardEl.style.width = `${cols * cell + (cols - 1) * gap}px`;
  boardEl.style.height = `${rows * cell + (rows - 1) * gap}px`;
  boardEl.style.setProperty('--cell', `${cell}px`);
  if (pieceGhostEl) {
    const g = Math.min(56, Math.max(36, Math.floor(cell * 0.85)));
    pieceGhostEl.style.width = g + 'px';
    pieceGhostEl.style.height = g + 'px';
  }
}

let layoutBoardTimer = null;
function scheduleLayoutBoardGrid() {
  if (layoutBoardTimer) cancelAnimationFrame(layoutBoardTimer);
  layoutBoardTimer = requestAnimationFrame(() => {
    layoutBoardTimer = null;
    layoutBoardGrid();
  });
}

function enterRoom(data) {
  gameId = data.gameId;
  gameIdInput.value = gameId;
  gameState = data.state;
  mySide = data.side;
  selectedPieceId = null;
  selectedPos = null;
  selectedPieceType = null;
  selectedPieceCamp = null;
  prevPiecesMap = null;
  boardBuilt = false;
  hideResultBanner();
  updateStatus();
  renderBoard({ force: true });
  startPolling();
  if (roomPanel) roomPanel.classList.add('collapsed');
  audio.unlock();
}

document.getElementById('btnQuickJoin').addEventListener('click', () => {
  audio.unlock();
  username = (usernameInput.value || '').trim();
  if (!username) {
    showTip('请先输入用户名');
    return;
  }
  fetch(`${ROOMS_API}/quick-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('无空位')))
    .then(data => enterRoom(data))
    .catch(err => showTip('快速加入失败: ' + (err.message || err)));
});

document.getElementById('btnJoin').addEventListener('click', () => {
  audio.unlock();
  username = (usernameInput.value || '').trim();
  if (!username) {
    showTip('请先输入用户名');
    return;
  }
  const gid = (gameIdInput.value || '').trim();
  if (!gid) {
    showTip('请输入房间ID');
    return;
  }
  fetch(`${ROOMS_API}/${gid}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('房间已满或不存在')))
    .then(data => enterRoom(data))
    .catch(err => showTip('加入房间失败: ' + (err.message || err)));
});

document.getElementById('btnRefreshRooms').addEventListener('click', refreshRoomList);

const btnToggleRooms = document.getElementById('btnToggleRooms');
if (btnToggleRooms && roomPanel) {
  btnToggleRooms.addEventListener('click', () => {
    roomPanel.classList.toggle('collapsed');
  });
}

function refreshRoomList() {
  fetch(ROOMS_API)
    .then(r => r.json())
    .then(rooms => {
      const el = roomListEl;
      if (!el) return;
      if (!rooms.length) {
        el.innerHTML = '<p>暂无房间</p>';
        return;
      }
      let html = '<table class="room-table"><thead><tr><th>房间ID</th><th>玩家A</th><th>玩家B</th><th>状态</th></tr></thead><tbody>';
      rooms.forEach(r => {
        const shortId = r.roomId ? r.roomId.slice(0, 8) : '';
        const a = (r.playerA || '—') + (r.roleA ? '<span class="role-' + (r.roleA === '红' ? 'red">(红)' : 'black">(黑)') + '</span>' : '');
        const b = (r.playerB || '—') + (r.roleB ? '<span class="role-' + (r.roleB === '红' ? 'red">(红)' : 'black">(黑)') + '</span>' : '');
        const statusCell = r.full
          ? '已满'
          : `<button type="button" data-room="${r.roomId}">可加入</button>`;
        const rowClass = r.full ? ' class="full"' : '';
        html += '<tr' + rowClass + '><td>' + shortId + '</td><td>' + a + '</td><td>' + b + '</td><td>' + statusCell + '</td></tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    })
    .catch(() => { const el = roomListEl; if (el) el.innerHTML = '<p>加载失败</p>'; });
}

if (roomListEl) {
  roomListEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-room]');
    if (!btn) return;
    joinRoomById(btn.getAttribute('data-room'));
  });
}

function joinRoomById(roomId) {
  audio.unlock();
  username = (usernameInput.value || '').trim();
  if (!username) {
    showTip('请先输入用户名');
    return;
  }
  fetch(`${ROOMS_API}/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('房间已满或不存在')))
    .then(data => enterRoom(data))
    .catch(err => showTip('加入房间失败: ' + (err.message || err)));
}

document.getElementById('btnFlip').addEventListener('click', () => {
  showTip('现在翻牌由轮到操作的玩家点击未翻面的棋子来完成。');
});

function showTip(msg) {
  if (!tipEl) return;
  tipEl.textContent = msg;
  tipEl.style.display = 'block';
  if (tipTimer) clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    tipEl.style.display = 'none';
  }, 2200);
}

function hideResultBanner() {
  if (resultBannerEl) {
    resultBannerEl.classList.remove('show');
  }
}

function showResultBanner(text) {
  if (!resultBannerEl) return;
  const card = resultBannerEl.querySelector('.banner-card');
  if (card) card.textContent = text;
  resultBannerEl.classList.add('show');
  setTimeout(hideResultBanner, 2800);
}

function updateStatus(opts) {
  opts = opts || {};
  if (!gameState) {
    statusEl.textContent = '未开始对局';
    updateCaptured([], []);
    return;
  }
  const aCamp = gameState.aCamp;
  const bCamp = gameState.bCamp;
  const aRoleText = aCamp === 'RED' ? 'A方(红)' : (aCamp === 'BLACK' ? 'A方(黑)' : 'A方');
  const bRoleText = bCamp === 'RED' ? 'B方(红)' : (bCamp === 'BLACK' ? 'B方(黑)' : 'B方');
  const aHtml = aCamp === 'RED'
    ? `<span class="role-red">${aRoleText}</span>`
    : aCamp === 'BLACK'
      ? `<span class="role-black">${aRoleText}</span>`
      : aRoleText;
  const bHtml = bCamp === 'RED'
    ? `<span class="role-red">${bRoleText}</span>`
    : bCamp === 'BLACK'
      ? `<span class="role-black">${bRoleText}</span>`
      : bRoleText;
  statusEl.innerHTML =
    `房间: ${(gameId || '').slice(0, 8)} | ${aHtml} vs ${bHtml} | 当前回合: ${gameState.currentSide}` +
    ` | 我方: ${mySide || '未加入'} | 结果: ${gameState.result}`;

  const red = [];
  const black = [];
  const a = gameState.capturedByA || [];
  const b = gameState.capturedByB || [];
  if (gameState.aCamp === 'RED') a.forEach(p => red.push(p));
  else if (gameState.aCamp === 'BLACK') a.forEach(p => black.push(p));
  if (gameState.bCamp === 'RED') b.forEach(p => red.push(p));
  else if (gameState.bCamp === 'BLACK') b.forEach(p => black.push(p));
  updateCaptured(red, black);

  if (opts.prevResult && opts.prevResult !== gameState.result && gameState.result !== 'ONGOING') {
    if (gameState.result === 'DRAW') {
      audio.play('draw');
      showResultBanner('平局');
    } else if (gameState.result === 'A_WIN' || gameState.result === 'B_WIN') {
      audio.play('win');
      const won = (gameState.result === 'A_WIN' && mySide === 'A') ||
        (gameState.result === 'B_WIN' && mySide === 'B');
      showResultBanner(won ? '胜利！' : (mySide ? '惜败' : gameState.result));
    }
  }
}

function updateCaptured(redPieces, blackPieces) {
  renderCapturedList('capturedRed', redPieces);
  renderCapturedList('capturedBlack', blackPieces);
}

function renderCapturedList(elId, pieces) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  if (!pieces || !pieces.length) {
    el.innerHTML = '<span class="empty">无</span>';
    return;
  }
  pieces.forEach(p => {
    const type = typeof p === 'string' ? p : p.type;
    const camp = typeof p === 'string' ? null : p.camp;
    const imgUrl = pieceImageUrl(type);
    if (imgUrl) {
      const img = document.createElement('img');
      img.className = 'captured-thumb' + (camp === 'RED' ? ' camp-red' : camp === 'BLACK' ? ' camp-black' : '');
      img.src = imgUrl;
      img.alt = toZh(type);
      img.title = toZh(type);
      img.onerror = function () {
        this.replaceWith(Object.assign(document.createElement('span'), {
          textContent: toZh(type),
          className: 'empty'
        }));
      };
      el.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = toZh(type);
      el.appendChild(span);
    }
  });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (!gameId) return;
  pollTimer = setInterval(() => {
    if (animBusy) return;
    fetch(`${API_BASE}/${gameId}`)
      .then(r => r.json())
      .then(state => {
        if (animBusy) return;
        const prevResult = gameState && gameState.result;
        const prevTurn = gameState && gameState.currentSide;
        const prevMap = piecesToMap(gameState && gameState.pieces);
        gameState = state;
        if (!prevTurn || prevTurn !== state.currentSide || prevResult !== state.result) {
          selectedPieceId = null;
          selectedPos = null;
          selectedPieceType = null;
          selectedPieceCamp = null;
        }
        updateStatus({ prevResult: prevResult });
        applyBoardDiff(prevMap, state, { animate: !reduceMotion && !!prevMap });
        updateBoardInteractivity();
      })
      .catch(() => {});
  }, 2000);
}

function startRoomPolling() {
  if (roomPollTimer) clearInterval(roomPollTimer);
  roomPollTimer = setInterval(() => {
    if (!gameId) refreshRoomList();
  }, 3000);
}

function findPieceAt(r, c) {
  if (!gameState) return null;
  return gameState.pieces.find(p => p.r === r && p.c === c) || null;
}

function piecesToMap(pieces) {
  const map = new Map();
  if (!pieces) return map;
  pieces.forEach(p => map.set(p.id, p));
  return map;
}

function cellKey(r, c) {
  return r + ',' + c;
}

function getCellEl(r, c) {
  return boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

function ensureBoardSkeleton(rows, cols) {
  if (boardBuilt && boardRows === rows && boardCols === cols) return;
  boardEl.innerHTML = '';
  boardRows = rows;
  boardCols = cols;
  boardBuilt = true;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      if (isSpecialCell(r, c)) cell.classList.add('special');
      cell.addEventListener('click', () => onCellClicked(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function createPieceEl(piece) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'piece';
  btn.dataset.id = String(piece.id);
  fillPieceEl(btn, piece);
  return btn;
}

function fillPieceEl(el, piece) {
  el.dataset.id = String(piece.id);
  el.dataset.type = piece.faceDown ? '' : (piece.type || '');
  el.classList.toggle('face-down', !!piece.faceDown);
  el.classList.toggle('camp-red', !piece.faceDown && piece.camp === 'RED');
  el.classList.toggle('camp-black', !piece.faceDown && piece.camp === 'BLACK');
  el.classList.toggle(
    'selected-piece',
    selectedPieceId != null && selectedPieceId === piece.id
  );
  el.setAttribute('aria-label', piece.faceDown ? '未翻开棋子' : toZh(piece.type));

  el.innerHTML = '';
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  const fallback = document.createElement('span');
  fallback.className = 'piece-fallback';
  fallback.textContent = piece.faceDown ? '？' : toZh(piece.type);
  fallback.hidden = true;

  if (piece.faceDown) {
    img.src = BACK_IMG;
  } else {
    const url = pieceImageUrl(piece.type);
    if (url) img.src = url;
    else {
      img.remove();
      fallback.hidden = false;
      el.appendChild(fallback);
      return;
    }
  }
  img.onerror = function () {
    img.remove();
    fallback.hidden = false;
  };
  el.appendChild(img);
  el.appendChild(fallback);
}

function clearCell(cell) {
  if (!cell) return;
  cell.classList.remove('selected', 'face-down', 'piece-red', 'piece-black', 'legal-hint');
  const piece = cell.querySelector('.piece');
  if (piece) piece.remove();
}

function placePieceInCell(cell, piece) {
  clearCell(cell);
  if (!piece) return;
  const el = createPieceEl(piece);
  cell.appendChild(el);
  if (selectedPieceId != null && selectedPieceId === piece.id) {
    cell.classList.add('selected');
  }
}

function renderBoard(opts) {
  opts = opts || {};
  if (!gameState) {
    boardEl.innerHTML = '';
    boardBuilt = false;
    prevPiecesMap = null;
    scheduleLayoutBoardGrid();
    return;
  }
  const rows = gameState.rows || BOARD_ROWS_DEFAULT;
  const cols = gameState.cols || BOARD_COLS_DEFAULT;
  ensureBoardSkeleton(rows, cols);

  const nextMap = piecesToMap(gameState.pieces);
  if (opts.force || !prevPiecesMap || reduceMotion) {
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const cell = getCellEl(r, c);
        const piece = findPieceAt(r, c);
        placePieceInCell(cell, piece);
      }
    }
    prevPiecesMap = nextMap;
    updateBoardInteractivity();
    updatePieceGhost();
    scheduleLayoutBoardGrid();
    return;
  }

  applyBoardDiff(prevPiecesMap, gameState, { animate: !!opts.animate });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function applyBoardDiff(prevMap, state, opts) {
  opts = opts || {};
  const nextMap = piecesToMap(state.pieces);
  const rows = state.rows || BOARD_ROWS_DEFAULT;
  const cols = state.cols || BOARD_COLS_DEFAULT;
  ensureBoardSkeleton(rows, cols);

  if (!opts.animate || !prevMap || reduceMotion) {
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        placePieceInCell(getCellEl(r, c), findPieceAt(r, c));
      }
    }
    prevPiecesMap = nextMap;
    updatePieceGhost();
    scheduleLayoutBoardGrid();
    return Promise.resolve();
  }

  const flips = [];
  const moves = [];
  const captures = [];

  nextMap.forEach((next, id) => {
    const prev = prevMap.get(id);
    if (!prev) return;
    if (prev.faceDown && !next.faceDown) {
      flips.push({ id, next });
    } else if (prev.r !== next.r || prev.c !== next.c) {
      moves.push({ id, prev, next });
    }
  });

  prevMap.forEach((prev, id) => {
    if (!nextMap.has(id)) {
      captures.push({ id, prev });
    }
  });

  if (!flips.length && !moves.length && !captures.length) {
    // Keep existing piece nodes so idle CSS animations do not restart every poll.
    syncSelectionHighlights();
    prevPiecesMap = nextMap;
    updatePieceGhost();
    return Promise.resolve();
  }

  animBusy = true;
  const tasks = [];

  flips.forEach(f => {
    tasks.push(animateFlip(f.next));
  });

  moves.forEach(m => {
    const victim = captures.find(c => c.prev.r === m.next.r && c.prev.c === m.next.c);
    tasks.push(animateMove(m.prev, m.next, victim));
    if (victim) {
      captures.splice(captures.indexOf(victim), 1);
    }
  });

  captures.forEach(c => {
    tasks.push(animateCaptureOnly(c.prev));
  });

  return Promise.all(tasks).then(() => {
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        placePieceInCell(getCellEl(r, c), findPieceAt(r, c));
      }
    }
    prevPiecesMap = nextMap;
    animBusy = false;
    updatePieceGhost();
    scheduleLayoutBoardGrid();
  }).catch(() => {
    animBusy = false;
    renderBoard({ force: true });
  });
}

function animateFlip(piece) {
  const cell = getCellEl(piece.r, piece.c);
  if (!cell) return Promise.resolve();
  audio.play('flip');
  placePieceInCell(cell, piece);
  const el = cell.querySelector('.piece');
  if (el && !reduceMotion) {
    el.classList.add('anim-flip');
  }
  audio.playAnimal(piece.type);
  return wait(reduceMotion ? 0 : 560);
}

function animateMove(prev, next, victim) {
  const fromCell = getCellEl(prev.r, prev.c);
  const toCell = getCellEl(next.r, next.c);
  if (!fromCell || !toCell) return Promise.resolve();

  const mover = fromCell.querySelector('.piece');
  if (!mover) {
    placePieceInCell(toCell, next);
    return Promise.resolve();
  }

  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  if (victim) {
    audio.play('capture');
    const victimEl = toCell.querySelector('.piece');
    if (victimEl && !reduceMotion) victimEl.classList.add('anim-capture-victim');
    audio.playAnimal(next.type);
  } else {
    audio.play('move');
  }

  if (!reduceMotion) {
    fromCell.classList.add('moving-from');
    mover.classList.add('anim-move');
    // Force layout, then animate via CSS vars (idle keyframes are disabled by .anim-move).
    mover.style.setProperty('--move-x', '0px');
    mover.style.setProperty('--move-y', '0px');
    mover.style.setProperty('--move-scale', '1');
    mover.style.setProperty('--move-bright', '1');
    void mover.offsetWidth;
    mover.style.setProperty('--move-x', dx + 'px');
    mover.style.setProperty('--move-y', dy + 'px');
    if (victim) {
      mover.style.setProperty('--move-scale', '1.12');
      mover.style.setProperty('--move-bright', '1.15');
    }
  }

  return wait(reduceMotion ? 0 : (victim ? 450 : 300)).then(() => {
    mover.classList.remove('anim-move');
    mover.style.removeProperty('--move-x');
    mover.style.removeProperty('--move-y');
    mover.style.removeProperty('--move-scale');
    mover.style.removeProperty('--move-bright');
    fromCell.classList.remove('moving-from');
    clearCell(fromCell);
    placePieceInCell(toCell, next);
  });
}

function syncSelectionHighlights() {
  if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach(cell => {
    const pieceEl = cell.querySelector('.piece');
    const id = pieceEl ? Number(pieceEl.dataset.id) : null;
    const selected = selectedPieceId != null && id === selectedPieceId;
    cell.classList.toggle('selected', selected);
    if (pieceEl) pieceEl.classList.toggle('selected-piece', selected);
  });
}

function animateCaptureOnly(prev) {
  const cell = getCellEl(prev.r, prev.c);
  if (!cell) return Promise.resolve();
  const el = cell.querySelector('.piece');
  if (el && !reduceMotion) el.classList.add('anim-capture-victim');
  audio.play('capture');
  return wait(reduceMotion ? 0 : 450).then(() => clearCell(cell));
}

function isSpecialCell(r, c) {
  return (r === 2 && c === 2) || (r === 2 && c === 7) ||
         (r === 6 && c === 2) || (r === 6 && c === 7);
}

function onCellClicked(r, c) {
  if (!gameId || !gameState) return;
  audio.unlock();

  if (!username || !mySide) {
    showTip('请先输入用户名并新建/加入对局');
    return;
  }

  if (gameState.currentSide !== mySide) {
    showTip('当前不是你的回合');
    return;
  }

  if (animBusy) return;

  const piece = findPieceAt(r, c);

  if (selectedPieceId == null) {
    if (!piece) return;
    if (piece.faceDown) {
      const prevMap = piecesToMap(gameState.pieces);
      fetch(`${API_BASE}/${gameId}/flip?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r, c })
      })
        .then(res => res.json())
        .then(state => {
          const prevResult = gameState && gameState.result;
          gameState = state;
          selectedPieceId = null;
          selectedPos = null;
          selectedPieceType = null;
          selectedPieceCamp = null;
          updateStatus({ prevResult });
          updateBoardInteractivity();
          return applyBoardDiff(prevMap, state, { animate: !reduceMotion });
        })
        .catch(() => showTip('翻牌失败'));
      return;
    }
    if (!isCurrentCampPiece(piece)) {
      showTip('不是当前阵营的棋子');
      return;
    }
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    selectedPieceType = piece.type;
    selectedPieceCamp = piece.camp;
    audio.play('select');
    audio.playAnimal(piece.type);
    renderBoard({ force: true });
    return;
  }

  if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    renderBoard({ force: true });
    updatePieceGhost();
    return;
  }

  if (piece && !piece.faceDown && isCurrentCampPiece(piece)) {
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    selectedPieceType = piece.type;
    selectedPieceCamp = piece.camp;
    audio.play('select');
    renderBoard({ force: true });
    return;
  }

  if (piece && piece.faceDown) {
    showTip('未翻面棋子会阻挡移动，且不可被吃');
    return;
  }

  const to = { r, c };
  const capture = !!piece;
  const capturedId = capture ? piece.id : null;
  sendMove(selectedPieceId, selectedPos, to, capture, capturedId);
}

function isCurrentCampPiece(piece) {
  const side = gameState.currentSide;
  const camp = side === 'A' ? gameState.aCamp : gameState.bCamp;
  return camp && piece.camp === camp;
}

function sendMove(moverId, from, to, capture, capturedId) {
  const body = {
    moverId,
    from,
    to,
    capture: !!capture,
    capturedId: capturedId == null ? null : capturedId
  };
  const prevMap = piecesToMap(gameState.pieces);

  fetch(`${API_BASE}/${gameId}/move?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(state => {
      const prevResult = gameState && gameState.result;
      gameState = state;
      selectedPieceId = null;
      selectedPos = null;
      selectedPieceType = null;
      selectedPieceCamp = null;
      updateStatus({ prevResult });
      updateBoardInteractivity();
      return applyBoardDiff(prevMap, state, { animate: !reduceMotion });
    })
    .then(() => updatePieceGhost())
    .catch(() => showTip('走子失败'));
}

function getBoardCellFromPoint(clientX, clientY) {
  if (!boardEl || !boardEl.firstElementChild) return null;
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0) return null;
  const cs = getComputedStyle(boardEl);
  const gap = parseFloat(cs.gap || cs.columnGap || String(BOARD_GAP_PX)) || BOARD_GAP_PX;
  const first = boardEl.firstElementChild;
  const cellW = first.offsetWidth;
  const cellH = first.offsetHeight;
  const stepX = cellW + gap;
  const stepY = cellH + gap;
  const cols = gameState ? (gameState.cols || BOARD_COLS_DEFAULT) : BOARD_COLS_DEFAULT;
  const rows = gameState ? (gameState.rows || BOARD_ROWS_DEFAULT) : BOARD_ROWS_DEFAULT;
  const c = Math.floor(x / stepX);
  const r = Math.floor(y / stepY);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
  const xIn = x - c * stepX;
  const yIn = y - r * stepY;
  if (xIn >= cellW || yIn >= cellH) return null;
  return { r: r + 1, c: c + 1 };
}

function isAdjacent(from, to) {
  return Math.abs(from.r - to.r) + Math.abs(from.c - to.c) === 1;
}

function canCapture(attackerType, defenderType) {
  if (attackerType === 'MOUSE' && ['WHALE', 'PHOENIX', 'DRAGON', 'ELEPHANT'].indexOf(defenderType) >= 0) return true;
  return (TYPE_RANK[attackerType] || 0) > (TYPE_RANK[defenderType] || 0);
}

function isLegalTarget(toR, toC) {
  if (!selectedPos || selectedPieceId == null || !gameState) return false;
  if (selectedPos.r === toR && selectedPos.c === toC) return true;
  if (!isAdjacent(selectedPos, { r: toR, c: toC })) return false;
  const target = findPieceAt(toR, toC);
  if (!target) return true;
  if (target.faceDown) return false;
  if (target.camp === selectedPieceCamp) return false;
  if (isSpecialCell(toR, toC)) return false;
  return canCapture(selectedPieceType, target.type);
}

let ghostContentKey = null;

function updatePieceGhost() {
  if (!pieceGhostEl) return;
  if (!selectedPieceId || !selectedPieceType) {
    pieceGhostEl.style.display = 'none';
    pieceGhostEl.innerHTML = '';
    ghostContentKey = null;
    return;
  }
  const key = selectedPieceType + '|' + (selectedPieceCamp || '');
  if (ghostContentKey === key && pieceGhostEl.firstChild) {
    return;
  }
  ghostContentKey = key;
  const url = pieceImageUrl(selectedPieceType);
  pieceGhostEl.innerHTML = '';
  pieceGhostEl.className = selectedPieceCamp === 'RED' ? 'camp-red' : 'camp-black';
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = toZh(selectedPieceType);
    pieceGhostEl.appendChild(img);
  } else {
    pieceGhostEl.textContent = toZh(selectedPieceType);
  }
}

document.addEventListener('mousemove', function (e) {
  if (selectedPieceId && selectedPieceType && pieceGhostEl) {
    pieceGhostEl.style.display = 'block';
    pieceGhostEl.style.left = e.clientX + 'px';
    pieceGhostEl.style.top = e.clientY + 'px';
    // Content is rebuilt only when selection changes, not on every move.
    if (ghostContentKey !== selectedPieceType + '|' + (selectedPieceCamp || '')) {
      updatePieceGhost();
    }
  } else if (pieceGhostEl) {
    pieceGhostEl.style.display = 'none';
  }
});

if (boardEl) {
  boardEl.addEventListener('mousemove', function (e) {
    if (!selectedPieceId || !gameState || gameState.currentSide !== mySide) {
      boardEl.style.cursor = '';
      return;
    }
    const cell = getBoardCellFromPoint(e.clientX, e.clientY);
    if (!cell) {
      boardEl.style.cursor = '';
      return;
    }
    boardEl.style.cursor = isLegalTarget(cell.r, cell.c) ? 'pointer' : 'not-allowed';
  });
  boardEl.addEventListener('mouseleave', function () {
    boardEl.style.cursor = '';
  });
}

if (btnLeave) {
  btnLeave.addEventListener('click', () => {
    gameId = null;
    gameState = null;
    mySide = null;
    selectedPieceId = null;
    selectedPos = null;
    prevPiecesMap = null;
    boardBuilt = false;
    animBusy = false;
    hideResultBanner();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    updateStatus();
    boardEl.innerHTML = '';
    scheduleLayoutBoardGrid();
    if (roomPanel) roomPanel.classList.remove('collapsed');
    refreshRoomList();
  });
}

window.addEventListener('resize', scheduleLayoutBoardGrid);
window.addEventListener('load', scheduleLayoutBoardGrid);
if (typeof ResizeObserver !== 'undefined') {
  const stageEl = document.querySelector('.board-stage');
  if (stageEl) {
    new ResizeObserver(() => scheduleLayoutBoardGrid()).observe(stageEl);
  }
}

function updateBoardInteractivity() {
  if (!boardEl) return;
  if (!gameId || !gameState || !mySide) {
    boardEl.classList.remove('board-disabled');
    return;
  }
  if (gameState.currentSide !== mySide) {
    boardEl.classList.add('board-disabled');
  } else {
    boardEl.classList.remove('board-disabled');
  }
}

refreshRoomList();
startRoomPolling();
scheduleLayoutBoardGrid();
audio.preload();
