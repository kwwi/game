import { createApp } from './scene/App.js';

const API_BASE = 'http://localhost:8080/api/games';
const ROOMS_API = 'http://localhost:8080/api/rooms';
const PIECE_IMG_BASE = 'assets/pieces';

const PIECE_FILE = {
  WHALE: 'ink/whale.svg',
  PHOENIX: 'ink/phoenix.svg',
  DRAGON: 'ink/dragon.svg',
  ELEPHANT: 'ink/elephant.svg',
  LION: 'ink/lion.svg',
  TIGER: 'ink/tiger.svg',
  LEOPARD: 'ink/leopard.svg',
  FORTUNE: 'ink/fortune.svg',
  WOLF: 'ink/wolf.svg',
  DOG: 'ink/dog.svg',
  CAT: 'ink/cat.svg',
  MOUSE: 'ink/mouse.svg'
};

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
let pollTimer = null;
let roomPollTimer = null;
let tipTimer = null;
let animBusy = false;
let reduceMotion = false;
let app3d = null;
let enteringRoom = false;

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
const webglRoot = document.getElementById('webgl-root');

const TYPE_RANK = {
  WHALE: 12, PHOENIX: 11, DRAGON: 10, ELEPHANT: 9, LION: 8, TIGER: 7,
  LEOPARD: 6, FORTUNE: 5, WOLF: 4, DOG: 3, CAT: 2, MOUSE: 1
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
  if (viewLobby) viewLobby.classList.remove('hidden');
  if (viewGame) viewGame.classList.add('hidden');
  if (app3d) app3d.showLobby();
  refreshRoomList();
  startRoomPolling();
}

function showGameHud() {
  if (viewLobby) viewLobby.classList.add('hidden');
  if (viewGame) viewGame.classList.remove('hidden');
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
  if (!gameState) return null;
  return gameState.pieces.find(p => p.r === r && p.c === c) || null;
}

function isSpecialCell(r, c) {
  return (r === 2 && c === 2) || (r === 2 && c === 7) ||
    (r === 6 && c === 2) || (r === 6 && c === 7);
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

function updateLegalHighlights() {
  if (!app3d) return;
  if (selectedPieceId == null || !canControlBoard()) {
    app3d.battle.clearHighlights();
    return;
  }
  const legal = [];
  const danger = [];
  const rows = gameState.rows || BOARD_ROWS_DEFAULT;
  const cols = gameState.cols || BOARD_COLS_DEFAULT;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (!isLegalTarget(r, c)) continue;
      const t = findPieceAt(r, c);
      if (t) danger.push({ r, c });
      else legal.push({ r, c });
    }
  }
  app3d.battle.setHighlights(legal, danger);
}

function syncBattleSelection() {
  if (!app3d) return;
  app3d.battle.setSelected(selectedPieceId);
  updateLegalHighlights();
}

async function renderBoard(opts = {}) {
  if (!app3d) return;
  const prevMap = opts.prevMap || prevPiecesMap;
  await app3d.battle.syncBoard(gameState, {
    force: !!opts.force,
    animate: opts.animate !== false && !reduceMotion,
    prevMap,
    selectedId: selectedPieceId
  });
  prevPiecesMap = piecesToMap(gameState && gameState.pieces);
  syncBattleSelection();
}

async function applyBoardDiff(prevMap, state, opts = {}) {
  if (!app3d) return;
  if (!opts.animate || !prevMap || reduceMotion) {
    await app3d.battle.syncBoard(state, {
      force: true,
      animate: false,
      selectedId: selectedPieceId
    });
    prevPiecesMap = piecesToMap(state.pieces);
    syncBattleSelection();
    return;
  }

  const nextMap = piecesToMap(state.pieces);
  let hasChange = false;
  nextMap.forEach((n, id) => {
    const p = prevMap.get(id);
    if (!p) return;
    if ((p.faceDown && !n.faceDown) || p.r !== n.r || p.c !== n.c) hasChange = true;
  });
  prevMap.forEach((_, id) => { if (!nextMap.has(id)) hasChange = true; });

  if (!hasChange) {
    prevPiecesMap = nextMap;
    syncBattleSelection();
    return;
  }

  animBusy = true;
  try {
    // audio cues from diffs
    nextMap.forEach((n, id) => {
      const p = prevMap.get(id);
      if (!p) return;
      if (p.faceDown && !n.faceDown) {
        audio.play('flip');
        audio.playAnimal(n.type);
      } else if (p.r !== n.r || p.c !== n.c) {
        const victim = [...prevMap.values()].find(v => !nextMap.has(v.id) && v.r === n.r && v.c === n.c);
        if (victim) {
          audio.play('capture');
          audio.playAnimal(n.type);
        } else {
          audio.play('move');
        }
      }
    });
    await app3d.battle.syncBoard(state, {
      animate: true,
      prevMap,
      selectedId: selectedPieceId
    });
    prevPiecesMap = nextMap;
  } finally {
    animBusy = false;
    syncBattleSelection();
  }
}

function updateStatus(opts = {}) {
  if (!statusEl || !gameState) return;
  const aHtml = 'A';
  const bHtml = 'B';
  const roleText = myRole === 'SPECTATOR'
    ? '观战'
    : (isSolo ? '自弈' : (`我方: ${mySide || '—'}`));
  statusEl.innerHTML =
    `房间: ${(gameId || '').slice(0, 8)} | ${aHtml} vs ${bHtml} | 当前回合: ${gameState.currentSide}` +
    ` | ${roleText} | 结果: ${gameState.result}`;

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
          (r.full ? '<span class="room-badge">满员</span>' : '');
        info.innerHTML = `<code>${String(roomId).slice(0, 8)}</code> ${badges}<div class="empty">${r.playerA || '空'} vs ${r.playerB || '空'}</div>`;
        const actions = document.createElement('div');
        actions.className = 'lobby-actions';
        if (!r.solo && !r.full) {
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
    mySide = data.side || null;
    if (isSolo && gameState) mySide = gameState.currentSide;
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    prevPiecesMap = null;
    hideResultBanner();
    if (gameModeLabel) {
      if (myRole === 'SPECTATOR') gameModeLabel.textContent = '观战中';
      else if (isSolo) gameModeLabel.textContent = '自己对弈';
      else gameModeLabel.textContent = '对局中';
    }

    // Preload battle board while transition plays
    if (app3d) {
      await app3d.battle.syncBoard(gameState, { force: true, animate: false, selectedId: null });
      prevPiecesMap = piecesToMap(gameState.pieces);
      await app3d.enterBattleWithTransition();
    }
    showGameHud();
    updateStatus();
    startPolling();
    if (roomPollTimer) { clearInterval(roomPollTimer); roomPollTimer = null; }
    audio.unlock();
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
      return applyBoardDiff(prevMap, state, { animate: !reduceMotion });
    })
    .catch(() => showTip('走子失败'));
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
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    prevPiecesMap = null;
    animBusy = false;
    hideResultBanner();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (app3d) {
      app3d.battle.syncBoard(null, { force: true });
      app3d.battle.clearHighlights();
    }
    showLobby();
  });
}

// Boot 3D
app3d = createApp(webglRoot, {
  reduceMotion,
  onCellAction: (cell) => onCellAction(cell),
  onHoverCell: () => {}
});

showLobby();
audio.preload();
