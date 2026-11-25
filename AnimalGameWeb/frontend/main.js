const API_BASE = 'http://localhost:8080/api/games';
const ROOMS_API = 'http://localhost:8080/api/rooms';
const BOARD_GAP_PX = 0;
const LONG_PRESS_MS = 280;
const DRAG_MOVE_PX = 8;
const AI_TURN_DELAY_MS = 1000;

let gameId = null;
let gameState = null;
let prevPiecesMap = null;
let selectedPieceId = null;
let selectedPos = null;
let selectedPieceType = null;
let selectedPieceCamp = null;
let username = '';
let mySide = null;
let myRole = null;
let isSolo = false;
let isVsAi = false;
let pollTimer = null;
let roomPollTimer = null;
let tipTimer = null;
let animBusy = false;
let actionPending = false;
let reduceMotion = false;
let enteringRoom = false;
let dragState = null;
let aiTurnTimer = null;
let boardBuilt = false;
let boardRows = 0;
let boardCols = 0;
let layoutBoardTimer = null;

try {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch (e) {
  reduceMotion = false;
}

const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const gameIdInput = document.getElementById('gameIdInput');
const roomListEl = document.getElementById('roomList');
const btnLeave = document.getElementById('btnLeave');
const tipEl = document.getElementById('tip');
const resultBannerEl = document.getElementById('resultBanner');
const btnMute = document.getElementById('btnMute');
const btnMuteLobby = document.getElementById('btnMuteLobby');
const viewLobby = document.getElementById('viewLobby');
const viewGame = document.getElementById('viewGame');
const gameModeLabel = document.getElementById('gameModeLabel');
const boardEl = document.getElementById('board');
const aiReasonPanel = document.getElementById('aiReasonPanel');
const aiReasonSource = document.getElementById('aiReasonSource');
const aiReasonStatus = document.getElementById('aiReasonStatus');
const aiReasonResult = document.getElementById('aiReasonResult');
const aiReasonBody = document.getElementById('aiReasonBody');

let aiReasoningUiEnabled = false;

const TYPE_RANK = {
  WHALE: 12, PHOENIX: 11, DRAGON: 10, ELEPHANT: 9, LION: 8, TIGER: 7,
  LEOPARD: 6, JACKAL: 5, WOLF: 4, DOG: 3, CAT: 2, MOUSE: 1
};
const BOARD_COLS_DEFAULT = 8;
const BOARD_ROWS_DEFAULT = 7;

const audio = window.AnimalAudio || {
  unlock() {},
  play() {},
  playAnimal() {},
  isMuted() { return false; },
  toggleMuted() { return false; },
  setMuted() {},
  preload() {}
};

function syncMuteButton() {
  const muted = audio.isMuted();
  const label = muted ? '🔇' : '🔊';
  [btnMute, btnMuteLobby].forEach(btn => {
    if (!btn) return;
    btn.textContent = label;
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  });
}

function wireMute(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMuted();
    syncMuteButton();
  });
}

syncMuteButton();
wireMute(btnMute);
wireMute(btnMuteLobby);
document.addEventListener('pointerdown', () => audio.unlock(), { once: false, passive: true });

function toZh(type) {
  switch (type) {
    case 'WHALE': return '鲸';
    case 'PHOENIX': return '凤';
    case 'DRAGON': return '龙';
    case 'ELEPHANT': return '象';
    case 'LION': return '狮';
    case 'TIGER': return '虎';
    case 'LEOPARD': return '豹';
    case 'JACKAL': return '豺';
    case 'WOLF': return '狼';
    case 'DOG': return '狗';
    case 'CAT': return '猫';
    case 'MOUSE': return '鼠';
    default: return '?';
  }
}

function showTip(msg) {
  if (!tipEl) return;
  tipEl.textContent = msg;
  tipEl.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => tipEl.classList.remove('show'), 2200);
}

let resultBannerTimer = null;

function showResultBanner(text) {
  if (!resultBannerEl) return;
  const card = resultBannerEl.querySelector('.banner-card');
  if (card) card.textContent = text;
  resultBannerEl.classList.add('show');
  clearTimeout(resultBannerTimer);
  resultBannerTimer = setTimeout(() => hideResultBanner(), 2800);
}

function hideResultBanner() {
  clearTimeout(resultBannerTimer);
  resultBannerTimer = null;
  if (resultBannerEl) resultBannerEl.classList.remove('show');
}

function showLobby() {
  document.body.classList.remove('mode-battle');
  document.body.classList.add('mode-lobby');
  if (viewLobby) viewLobby.classList.remove('hidden');
  if (viewGame) viewGame.classList.add('hidden');
  hideAiReasonPanel();
  refreshRoomList();
  startRoomPolling();
}

function hideAiReasonPanel() {
  aiReasoningUiEnabled = false;
  if (!aiReasonPanel) return;
  aiReasonPanel.classList.add('hidden');
  if (aiReasonStatus) {
    aiReasonStatus.textContent = '';
    aiReasonStatus.classList.remove('thinking');
  }
  if (aiReasonSource) aiReasonSource.textContent = '';
  if (aiReasonResult) {
    aiReasonResult.textContent = '';
    aiReasonResult.classList.add('hidden');
  }
  if (aiReasonBody) {
    aiReasonBody.textContent = '';
    aiReasonBody.classList.add('hidden');
  }
}

function ensureAiReasonPanelVisible() {
  if (!aiReasonPanel || !isVsAi) return;
  aiReasonPanel.classList.remove('hidden');
}

function setAiReasonThinking() {
  if (!isVsAi) return;
  ensureAiReasonPanelVisible();
  if (aiReasonStatus) {
    aiReasonStatus.textContent = '正在思考局面与候选着法…';
    aiReasonStatus.classList.add('thinking');
  }
  if (aiReasonSource) aiReasonSource.textContent = '';
  if (aiReasonResult) aiReasonResult.classList.add('hidden');
  if (aiReasonBody) aiReasonBody.classList.add('hidden');
}

function renderAiReasonPayload(payload) {
  if (!payload) return;
  if (payload.reasoningEnabled) aiReasoningUiEnabled = true;
  if (!isVsAi || !aiReasoningUiEnabled) {
    if (aiReasonPanel) aiReasonPanel.classList.add('hidden');
    return;
  }
  ensureAiReasonPanelVisible();
  if (aiReasonStatus) {
    aiReasonStatus.classList.remove('thinking');
    aiReasonStatus.textContent = payload.applied === false
      ? '本回合未落子'
      : '本回合推理完成';
  }
  if (aiReasonSource) {
    const src = payload.source || '';
    aiReasonSource.textContent = src ? `来源: ${src}` : '';
  }
  if (aiReasonResult) {
    const action = payload.chosenAction || '';
    const id = payload.actionId != null ? `#${payload.actionId} ` : '';
    aiReasonResult.textContent = action ? `结果：${id}${action}` : '结果：—';
    aiReasonResult.classList.toggle('hidden', !action);
  }
  if (aiReasonBody) {
    const parts = [];
    if (payload.reason) parts.push(payload.reason);
    if (payload.modelReasoning && payload.modelReasoning !== payload.reason) {
      parts.push(payload.modelReasoning);
    }
    const text = parts.join('\n\n').trim();
    aiReasonBody.textContent = text || '（模型未返回详细理由）';
    aiReasonBody.classList.toggle('hidden', !text);
  }
}

function showGameHud() {
  document.body.classList.remove('mode-lobby');
  document.body.classList.add('mode-battle');
  if (viewLobby) viewLobby.classList.add('hidden');
  if (viewGame) viewGame.classList.remove('hidden');
  scheduleLayoutBoardGrid();
}

function requireUsername() {
  username = (usernameInput.value || '').trim();
  if (!username) {
    showTip('请先输入用户名');
    return null;
  }
  return username;
}

function canControlBoard() {
  if (!gameId || !gameState || myRole !== 'PLAYER') return false;
  if (actionPending || animBusy) return false;
  if (isSolo) return true;
  return !!mySide && gameState.currentSide === mySide;
}

function piecesToMap(pieces) {
  const map = new Map();
  if (!pieces) return map;
  pieces.forEach(p => map.set(p.id, p));
  return map;
}

function findPieceAt(r, c) {
  return findPieceInState(gameState, r, c);
}

function findPieceInState(state, r, c) {
  if (!state || !state.pieces) return null;
  return state.pieces.find(p => p.r === r && p.c === c) || null;
}

function isSpecialCell(r, c) {
  return (r === 2 && c === 3) || (r === 2 && c === 6) ||
    (r === 6 && c === 3) || (r === 6 && c === 6);
}

function isAdjacent(from, to) {
  return Math.abs(from.r - to.r) + Math.abs(from.c - to.c) === 1;
}

function canCapture(attackerType, defenderType) {
  if (attackerType === 'MOUSE' && ['WHALE', 'PHOENIX', 'DRAGON', 'ELEPHANT'].indexOf(defenderType) >= 0) return true;
  return (TYPE_RANK[attackerType] || 0) > (TYPE_RANK[defenderType] || 0);
}

function isCurrentCampPiece(piece) {
  const side = gameState.currentSide;
  const camp = side === 'A' ? gameState.aCamp : gameState.bCamp;
  return camp && piece.camp === camp;
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

function getCellEl(r, c) {
  return boardEl ? boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`) : null;
}

function layoutBoardGrid() {
  const stage = document.querySelector('.board-stage');
  if (!stage || !boardEl) return;
  const cols = gameState ? (gameState.cols || BOARD_COLS_DEFAULT) : BOARD_COLS_DEFAULT;
  const rows = gameState ? (gameState.rows || BOARD_ROWS_DEFAULT) : BOARD_ROWS_DEFAULT;
  const pad = 8;
  const maxW = stage.clientWidth - pad * 2;
  const maxH = Math.max(120, stage.clientHeight - pad * 2);
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
}

function scheduleLayoutBoardGrid() {
  if (layoutBoardTimer) cancelAnimationFrame(layoutBoardTimer);
  layoutBoardTimer = requestAnimationFrame(() => {
    layoutBoardTimer = null;
    layoutBoardGrid();
  });
}

function ensureBoardSkeleton(rows, cols) {
  if (!boardEl) return;
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
      if (isSpecialCell(r, c)) {
        cell.classList.add('special');
        const frame = document.createElement('span');
        frame.className = 'special-frame';
        frame.setAttribute('aria-hidden', 'true');
        cell.appendChild(frame);
      }
      cell.addEventListener('click', () => {
        if (suppressClickOnce) {
          suppressClickOnce = false;
          return;
        }
        onCellAction({ r, c });
      });
      boardEl.appendChild(cell);
    }
  }
  bindBoardDrag();
  scheduleLayoutBoardGrid();
}

let suppressClickOnce = false;

function bindBoardDrag() {
  if (!boardEl || boardEl.dataset.dragBound === '1') return;
  boardEl.dataset.dragBound = '1';
  boardEl.addEventListener('pointerdown', onBoardPointerDown);
  window.addEventListener('pointermove', onBoardPointerMove);
  window.addEventListener('pointerup', onBoardPointerUp);
  window.addEventListener('pointercancel', onBoardPointerUp);
}

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest ? el.closest('.cell') : null;
  if (!cell || !boardEl.contains(cell)) return null;
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  return { r, c, el: cell };
}

function clearDragGhost() {
  if (dragState && dragState.ghost && dragState.ghost.parentNode) {
    dragState.ghost.parentNode.removeChild(dragState.ghost);
  }
  if (dragState && dragState.pieceEl) {
    dragState.pieceEl.classList.remove('dragging');
  }
}

function endDrag() {
  if (dragState && dragState.timer) clearTimeout(dragState.timer);
  clearDragGhost();
  dragState = null;
}

function onBoardPointerDown(e) {
  if (e.button != null && e.button !== 0) return;
  if (!canControlBoard() || animBusy || actionPending) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  const piece = findPieceAt(cell.r, cell.c);
  if (!piece || piece.faceDown) return;
  if (!isCurrentCampPiece(piece)) return;

  dragState = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    from: { r: cell.r, c: cell.c },
    piece,
    pieceEl: cell.el.querySelector('.piece'),
    active: false,
    moved: false,
    timer: null,
    ghost: null
  };
  dragState.timer = setTimeout(() => {
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    beginDrag(e.clientX, e.clientY);
  }, LONG_PRESS_MS);
}

function beginDrag(x, y) {
  if (!dragState || dragState.active) return;
  dragState.active = true;
  selectedPieceId = dragState.piece.id;
  selectedPos = { ...dragState.from };
  selectedPieceType = dragState.piece.type;
  selectedPieceCamp = dragState.piece.camp;
  syncBattleSelection();
  audio.play('select');

  if (dragState.pieceEl) dragState.pieceEl.classList.add('dragging');
  const ghost = document.createElement('div');
  ghost.className = 'piece-drag-ghost' +
    (dragState.piece.camp === 'RED' ? ' camp-red' : ' camp-black');
  ghost.textContent = toZh(dragState.piece.type);
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
  document.body.appendChild(ghost);
  dragState.ghost = ghost;
}

function onBoardPointerMove(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const dist = Math.hypot(dx, dy);
  if (!dragState.active) {
    if (dist > DRAG_MOVE_PX) {
      // Moved before long-press → cancel drag, allow normal click
      endDrag();
    }
    return;
  }
  dragState.moved = true;
  if (dragState.ghost) {
    dragState.ghost.style.left = `${e.clientX}px`;
    dragState.ghost.style.top = `${e.clientY}px`;
  }
}

function onBoardPointerUp(e) {
  if (!dragState || (e.pointerId != null && dragState.pointerId !== e.pointerId)) return;
  const wasActive = dragState.active;
  const moved = dragState.moved;
  const from = dragState.from;
  const piece = dragState.piece;
  endDrag();

  if (!wasActive) return; // short tap → click handler will run
  suppressClickOnce = true;

  if (!moved) {
    // Long-press without move: keep selection
    return;
  }
  const target = cellFromPoint(e.clientX, e.clientY);
  if (!target || (target.r === from.r && target.c === from.c)) {
    syncBattleSelection();
    return;
  }
  selectedPieceId = piece.id;
  selectedPos = { ...from };
  selectedPieceType = piece.type;
  selectedPieceCamp = piece.camp;
  if (!isLegalTarget(target.r, target.c)) {
    showTip('非法落点');
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    syncBattleSelection();
    return;
  }
  const dest = findPieceAt(target.r, target.c);
  if (dest && dest.faceDown) {
    showTip('未翻面棋子会阻挡移动，且不可被吃');
    syncBattleSelection();
    return;
  }
  sendMove(piece.id, from, { r: target.r, c: target.c }, !!dest, dest ? dest.id : null);
}

function fillPieceEl(el, piece) {
  el.dataset.id = String(piece.id);
  el.dataset.type = piece.type || '';
  el.classList.toggle('face-down', !!piece.faceDown);
  el.classList.toggle('camp-red', !piece.faceDown && piece.camp === 'RED');
  el.classList.toggle('camp-black', !piece.faceDown && piece.camp === 'BLACK');
  el.classList.toggle(
    'selected-piece',
    selectedPieceId != null && selectedPieceId === piece.id
  );
  el.setAttribute('aria-label', piece.faceDown ? '未翻开棋子' : toZh(piece.type));

  el.innerHTML = '';
  const glyph = document.createElement('span');
  glyph.className = 'piece-glyph';
  glyph.textContent = piece.faceDown ? '？' : toZh(piece.type);
  el.appendChild(glyph);
}

function createPieceEl(piece) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'piece';
  fillPieceEl(btn, piece);
  return btn;
}

function clearCell(cell) {
  if (!cell) return;
  cell.classList.remove('selected', 'legal-hint', 'legal-danger');
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

function clearHighlights() {
  if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('legal-hint', 'legal-danger', 'selected');
  });
  boardEl.querySelectorAll('.piece.selected-piece').forEach(el => {
    el.classList.remove('selected-piece');
  });
}

function updateLegalHighlights() {
  clearHighlights();
  if (selectedPieceId == null || !canControlBoard() || !gameState) return;

  if (selectedPos) {
    const sel = getCellEl(selectedPos.r, selectedPos.c);
    if (sel) {
      sel.classList.add('selected');
      const pe = sel.querySelector('.piece');
      if (pe) pe.classList.add('selected-piece');
    }
  }

  const rows = gameState.rows || BOARD_ROWS_DEFAULT;
  const cols = gameState.cols || BOARD_COLS_DEFAULT;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (!isLegalTarget(r, c)) continue;
      if (selectedPos && selectedPos.r === r && selectedPos.c === c) continue;
      const cell = getCellEl(r, c);
      if (!cell) continue;
      const t = findPieceAt(r, c);
      cell.classList.add(t ? 'legal-danger' : 'legal-hint');
    }
  }
}

function syncBattleSelection() {
  updateLegalHighlights();
}

function updateBoardInteractivity() {
  if (!boardEl) return;
  boardEl.classList.toggle('board-disabled', !canControlBoard());
}

async function renderBoard(opts = {}) {
  if (!gameState) {
    if (boardEl) boardEl.innerHTML = '';
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
    paintBoardFromState(gameState);
    prevPiecesMap = nextMap;
    updateBoardInteractivity();
    syncBattleSelection();
    scheduleLayoutBoardGrid();
    return;
  }

  await applyBoardDiff(prevPiecesMap, gameState, { animate: opts.animate !== false });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function applyBoardDiff(prevMap, state, opts = {}) {
  const nextMap = piecesToMap(state.pieces);
  const rows = state.rows || BOARD_ROWS_DEFAULT;
  const cols = state.cols || BOARD_COLS_DEFAULT;
  ensureBoardSkeleton(rows, cols);

  if (!opts.animate || !prevMap || reduceMotion) {
    paintBoardFromState(state);
    prevPiecesMap = nextMap;
    updateBoardInteractivity();
    syncBattleSelection();
    scheduleLayoutBoardGrid();
    return;
  }

  const flips = [];
  const moves = [];
  const captures = [];

  nextMap.forEach((next, id) => {
    const prev = prevMap.get(id);
    if (!prev) return;
    if (prev.faceDown && !next.faceDown) flips.push({ next });
    else if (prev.r !== next.r || prev.c !== next.c) moves.push({ prev, next });
  });
  prevMap.forEach((prev, id) => {
    if (!nextMap.has(id)) captures.push({ prev });
  });

  if (!flips.length && !moves.length && !captures.length) {
    paintBoardFromState(state);
    prevPiecesMap = nextMap;
    syncBattleSelection();
    updateBoardInteractivity();
    return;
  }

  animBusy = true;
  try {
    for (const f of flips) {
      audio.play('flip');
      audio.playAnimal(f.next.type);
      const cell = getCellEl(f.next.r, f.next.c);
      const el = cell && cell.querySelector('.piece');
      if (el && !reduceMotion) {
        el.classList.add('anim-flip');
        await wait(220);
        fillPieceEl(el, f.next);
        await wait(220);
        el.classList.remove('anim-flip');
      } else {
        placePieceInCell(cell, f.next);
      }
    }

    for (const m of moves) {
      const victim = captures.find(c => c.prev.r === m.next.r && c.prev.c === m.next.c);
      if (victim) {
        audio.play('capture');
        audio.playAnimal(m.next.type);
        captures.splice(captures.indexOf(victim), 1);
      } else {
        audio.play('move');
      }
      const fromCell = getCellEl(m.prev.r, m.prev.c);
      const toCell = getCellEl(m.next.r, m.next.c);
      if (fromCell) clearCell(fromCell);
      if (victim && toCell) clearCell(toCell);
      placePieceInCell(toCell, m.next);
      await wait(reduceMotion ? 0 : 180);
    }

    for (const c of captures) {
      const cell = getCellEl(c.prev.r, c.prev.c);
      if (cell) clearCell(cell);
    }

    // Always sync from the response state (not global gameState) to avoid poll races
    paintBoardFromState(state);
    prevPiecesMap = nextMap;
  } finally {
    animBusy = false;
    updateBoardInteractivity();
    syncBattleSelection();
    scheduleLayoutBoardGrid();
  }
}

function paintBoardFromState(state) {
  if (!state) return;
  const rows = state.rows || BOARD_ROWS_DEFAULT;
  const cols = state.cols || BOARD_COLS_DEFAULT;
  ensureBoardSkeleton(rows, cols);
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      placePieceInCell(getCellEl(r, c), findPieceInState(state, r, c));
    }
  }
}

function updateStatus(opts = {}) {
  if (!statusEl || !gameState) return;
  const roleText = myRole === 'SPECTATOR'
    ? '观战'
    : (isSolo ? '自弈' : isVsAi ? '人机' : (`我方: ${mySide || '—'}`));
  const thinking = isVsAi && gameState.result === 'ONGOING' && gameState.currentSide === 'B'
    ? ' | AI思考中…'
    : '';
  statusEl.innerHTML =
    `房间: ${(gameId || '').slice(0, 8)} | A vs ${isVsAi ? 'AI' : 'B'} | 当前回合: ${gameState.currentSide}` +
    ` | ${roleText} | 结果: ${gameState.result}${thinking}`;

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
      if (isSolo || myRole === 'SPECTATOR') {
        const winner = gameState.result === 'A_WIN' ? 'A方' : 'B方';
        showResultBanner(isSolo ? `对局结束 · ${winner}胜` : `${winner}胜利`);
      } else if (isVsAi) {
        const won = gameState.result === 'A_WIN';
        showResultBanner(won ? '胜利！' : '惜败 · AI胜');
      } else {
        const won = (gameState.result === 'A_WIN' && mySide === 'A') ||
          (gameState.result === 'B_WIN' && mySide === 'B');
        showResultBanner(won ? '胜利！' : (mySide ? '惜败' : gameState.result));
      }
    }
  }

  if (isSolo && gameState.currentSide && gameState.result === 'ONGOING') {
    mySide = gameState.currentSide;
  }
  updateBoardInteractivity();
}

function updateCaptured(redPieces, blackPieces) {
  renderCapturedList('capturedRed', redPieces);
  renderCapturedList('capturedBlack', blackPieces);
}

function renderCapturedList(id, pieces) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!pieces || !pieces.length) {
    el.innerHTML = '<span class="empty">无</span>';
    return;
  }
  const listCamp = id === 'capturedRed' ? 'RED' : id === 'capturedBlack' ? 'BLACK' : null;
  pieces.forEach(p => {
    const type = typeof p === 'string' ? p : p.type;
    const camp = (typeof p === 'string' ? null : p.camp) || listCamp;
    const span = document.createElement('span');
    span.className =
      'captured-glyph' +
      (camp === 'RED' ? ' camp-red' : camp === 'BLACK' ? ' camp-black' : '');
    span.textContent = toZh(type);
    span.title = toZh(type);
    el.appendChild(span);
  });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (!gameId) return;
  pollTimer = setInterval(() => {
    if (animBusy || actionPending || dragState) return;
    fetch(`${API_BASE}/${gameId}`)
      .then(r => r.json())
      .then(state => {
        if (animBusy || actionPending || dragState) return;
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
        updateStatus({ prevResult });
        return applyBoardDiff(prevMap, state, { animate: !reduceMotion && !!prevMap });
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

function refreshRoomList() {
  if (!roomListEl) return;
  fetch(ROOMS_API)
    .then(r => r.json())
    .then(list => {
      roomListEl.innerHTML = '';
      if (!list || !list.length) {
        roomListEl.innerHTML = '<div class="empty">暂无房间，快速加入或自己对弈</div>';
        return;
      }
      list.forEach(r => {
        const roomId = r.roomId || r.id;
        if (!roomId) return;
        const row = document.createElement('div');
        row.className = 'room-row' + (r.full && !r.solo ? ' full' : '');
        const info = document.createElement('div');
        const badges = (r.solo ? '<span class="room-badge solo">自弈</span>' : '') +
          (r.vsAi ? '<span class="room-badge solo">人机</span>' : '') +
          (r.full ? '<span class="room-badge">满员</span>' : '');
        const nameB = r.vsAi || r.playerB === '__AI__' ? 'AI' : (r.playerB || '空');
        info.innerHTML = `<code>${String(roomId).slice(0, 8)}</code> ${badges}<div class="empty">${r.playerA || '空'} vs ${nameB}</div>`;
        const actions = document.createElement('div');
        actions.className = 'lobby-actions';
        if (!r.solo && !r.vsAi && !r.full) {
          const joinBtn = document.createElement('button');
          joinBtn.type = 'button';
          joinBtn.textContent = (!r.hasGame && !r.playerA) ? '进入空房' : '加入';
          joinBtn.addEventListener('click', () => joinRoomById(roomId));
          actions.appendChild(joinBtn);
        }
        if (r.hasGame) {
          const sp = document.createElement('button');
          sp.type = 'button';
          sp.className = 'ghost';
          sp.textContent = '观战';
          sp.addEventListener('click', () => spectateRoomById(roomId));
          actions.appendChild(sp);
        }
        row.appendChild(info);
        row.appendChild(actions);
        roomListEl.appendChild(row);
      });
    })
    .catch(() => {
      roomListEl.innerHTML = '<div class="empty">无法加载房间列表</div>';
    });
}

function postRoom(path, body) {
  return fetch(`${ROOMS_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(r => r.ok ? r.json() : Promise.reject(new Error('请求失败')));
}

async function enterRoom(data) {
  if (enteringRoom) return;
  enteringRoom = true;
  try {
    gameId = data.gameId;
    if (gameIdInput) gameIdInput.value = gameId;
    gameState = data.state;
    myRole = data.role || 'PLAYER';
    isSolo = !!data.solo;
    isVsAi = !!data.vsAi;
    mySide = data.side || null;
    if (isSolo && gameState) mySide = gameState.currentSide;
    if (isVsAi) mySide = 'A';
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    prevPiecesMap = null;
    boardBuilt = false;
    hideResultBanner();
    if (gameModeLabel) {
      if (myRole === 'SPECTATOR') gameModeLabel.textContent = '观战中';
      else if (isSolo) gameModeLabel.textContent = '自己对弈';
      else if (isVsAi) gameModeLabel.textContent = '人机对弈';
      else gameModeLabel.textContent = '对局中';
    }

    showGameHud();
    await renderBoard({ force: true, animate: false });
    updateStatus();
    startPolling();
    if (roomPollTimer) { clearInterval(roomPollTimer); roomPollTimer = null; }
    audio.unlock();
    if (isVsAi) {
      ensureAiReasonPanelVisible();
      if (aiReasonStatus) {
        aiReasonStatus.textContent = '人机对弈已开始；开启 show-reasoning 后将展示推理。';
        aiReasonStatus.classList.remove('thinking');
      }
    } else {
      hideAiReasonPanel();
    }
    scheduleAiTurnIfNeeded();
  } finally {
    enteringRoom = false;
  }
}

function onCellAction(cell) {
  if (!gameId || !gameState || !cell) return;
  audio.unlock();
  const { r, c } = cell;

  if (myRole === 'SPECTATOR') {
    showTip('观战模式不可操作棋子');
    return;
  }
  if (!username || myRole !== 'PLAYER') {
    showTip('请先从大厅加入对局');
    return;
  }
  if (isSolo) mySide = gameState.currentSide;
  if (!canControlBoard()) {
    showTip('当前不是你的回合');
    return;
  }
  if (animBusy) return;

  const piece = findPieceAt(r, c);

  if (selectedPieceId == null) {
    if (!piece) return;
    if (piece.faceDown) {
      submitFlip(r, c);
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
    syncBattleSelection();
    return;
  }

  if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    syncBattleSelection();
    return;
  }

  if (piece && !piece.faceDown && isCurrentCampPiece(piece)) {
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    selectedPieceType = piece.type;
    selectedPieceCamp = piece.camp;
    audio.play('select');
    syncBattleSelection();
    return;
  }

  if (piece && piece.faceDown) {
    showTip('未翻面棋子会阻挡移动，且不可被吃');
    return;
  }

  if (!isLegalTarget(r, c)) {
    showTip('非法落点');
    return;
  }

  const capture = !!piece;
  const capturedId = capture ? piece.id : null;
  sendMove(selectedPieceId, selectedPos, { r, c }, capture, capturedId);
}

function submitFlip(r, c) {
  if (actionPending || animBusy) return;
  const prevMap = piecesToMap(gameState.pieces);
  actionPending = true;
  if (isVsAi) showTip('AI 思考中…');
  fetch(`${API_BASE}/${gameId}/flip?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ r, c })
  })
    .then(res => res.json())
    .then(state => applyServerState(prevMap, state))
    .catch(() => showTip('翻牌失败'))
    .finally(() => { actionPending = false; updateBoardInteractivity(); });
}

function sendMove(moverId, from, to, capture, capturedId) {
  if (actionPending || animBusy) return;
  const body = {
    moverId,
    from,
    to,
    capture: !!capture,
    capturedId: capturedId == null ? null : capturedId
  };
  const prevMap = piecesToMap(gameState.pieces);
  actionPending = true;
  if (isVsAi) showTip('AI 思考中…');

  fetch(`${API_BASE}/${gameId}/move?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(state => applyServerState(prevMap, state))
    .catch(() => showTip('走子失败'))
    .finally(() => { actionPending = false; updateBoardInteractivity(); });
}

async function applyServerState(prevMap, state, opts = {}) {
  const prevResult = gameState && gameState.result;
  gameState = state;
  selectedPieceId = null;
  selectedPos = null;
  selectedPieceType = null;
  selectedPieceCamp = null;
  updateStatus({ prevResult });
  await applyBoardDiff(prevMap, state, { animate: !reduceMotion });
  paintBoardFromState(state);
  prevPiecesMap = piecesToMap(state.pieces);
  updateBoardInteractivity();
  syncBattleSelection();
  if (opts.scheduleAi !== false) {
    scheduleAiTurnIfNeeded();
  }
}

function clearAiTurnTimer() {
  if (aiTurnTimer) {
    clearTimeout(aiTurnTimer);
    aiTurnTimer = null;
  }
}

function scheduleAiTurnIfNeeded() {
  clearAiTurnTimer();
  if (!isVsAi || !gameId || !gameState) return;
  if (gameState.result !== 'ONGOING') return;
  if (gameState.currentSide !== 'B') return;
  if (myRole !== 'PLAYER') return;
  showTip('AI 思考中…');
  setAiReasonThinking();
  updateStatus();
  aiTurnTimer = setTimeout(() => {
    aiTurnTimer = null;
    requestAiTurn();
  }, AI_TURN_DELAY_MS);
}

function requestAiTurn() {
  if (!isVsAi || !gameId || !username) return;
  if (actionPending || animBusy) {
    scheduleAiTurnIfNeeded();
    return;
  }
  if (!gameState || gameState.result !== 'ONGOING' || gameState.currentSide !== 'B') return;
  const prevMap = piecesToMap(gameState.pieces);
  actionPending = true;
  showTip('AI 思考中…');
  setAiReasonThinking();
  fetch(`${API_BASE}/${gameId}/ai-turn?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('AI 回合失败')))
    .then(async (payload) => {
      const state = payload && payload.state ? payload.state : payload;
      renderAiReasonPayload(payload);
      if (payload && payload.reasoningEnabled && payload.reason) {
        showTip(`AI：${payload.reason}`);
      } else if (payload && payload.chosenAction) {
        showTip(`AI：${payload.chosenAction}`);
      }
      await applyServerState(prevMap, state, { scheduleAi: false });
    })
    .catch(err => {
      showTip(err.message || 'AI 回合失败');
      if (aiReasonStatus) {
        aiReasonStatus.classList.remove('thinking');
        aiReasonStatus.textContent = err.message || 'AI 回合失败';
      }
    })
    .finally(() => {
      actionPending = false;
      updateBoardInteractivity();
      updateStatus();
    });
}

function joinRoomById(id) {
  if (!requireUsername()) return;
  postRoom(`/${id}/join`, { username })
    .then(data => enterRoom(data))
    .catch(err => showTip('加入失败: ' + (err.message || err)));
}

function spectateRoomById(id) {
  if (!requireUsername()) return;
  postRoom(`/${id}/spectate`, { username })
    .then(data => enterRoom(data))
    .catch(err => showTip('观战失败: ' + (err.message || err)));
}

document.getElementById('btnQuickJoin').addEventListener('click', () => {
  audio.unlock();
  if (!requireUsername()) return;
  postRoom('/quick-join', { username })
    .then(data => enterRoom(data))
    .catch(err => showTip('快速加入失败: ' + (err.message || err)));
});

const btnSolo = document.getElementById('btnSolo');
if (btnSolo) {
  btnSolo.addEventListener('click', () => {
    audio.unlock();
    if (!requireUsername()) return;
    postRoom('/solo', { username })
      .then(data => enterRoom(data))
      .catch(err => showTip('自弈失败: ' + (err.message || err)));
  });
}

const btnVsAi = document.getElementById('btnVsAi');
if (btnVsAi) {
  btnVsAi.addEventListener('click', () => {
    audio.unlock();
    if (!requireUsername()) return;
    showTip('正在匹配 AI…');
    postRoom('/vs-ai', { username })
      .then(data => enterRoom(data))
      .catch(err => showTip('人机对弈失败: ' + (err.message || err)));
  });
}

document.getElementById('btnJoin').addEventListener('click', () => {
  const id = (gameIdInput.value || '').trim();
  if (!id) return showTip('请输入房间ID');
  joinRoomById(id);
});

document.getElementById('btnSpectateId').addEventListener('click', () => {
  const id = (gameIdInput.value || '').trim();
  if (!id) return showTip('请输入房间ID');
  spectateRoomById(id);
});

document.getElementById('btnRefreshRooms').addEventListener('click', () => refreshRoomList());

document.getElementById('btnFlip').addEventListener('click', () => {
  showTip('相邻走子；高阶吃低阶；鼠可吃鲸/凤/龙/象。未翻面不可吃。');
});

if (btnLeave) {
  btnLeave.addEventListener('click', () => {
    const leavingId = gameId;
    const leavingUser = username;
    if (leavingId && leavingUser) {
      postRoom(`/${leavingId}/leave`, { username: leavingUser }).catch(() => {});
    }
    gameId = null;
    gameState = null;
    mySide = null;
    myRole = null;
    isSolo = false;
    isVsAi = false;
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    prevPiecesMap = null;
    animBusy = false;
    actionPending = false;
    clearAiTurnTimer();
    endDrag();
    hideAiReasonPanel();
    boardBuilt = false;
    if (boardEl) boardEl.innerHTML = '';
    hideResultBanner();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    showLobby();
  });
}

window.addEventListener('resize', scheduleLayoutBoardGrid);

showLobby();
audio.preload();
