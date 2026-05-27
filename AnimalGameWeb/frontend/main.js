const API_BASE = 'http://localhost:8080/api/games';
const ROOMS_API = 'http://localhost:8080/api/rooms';

let gameId = null;
let gameState = null;
let selectedPieceId = null;
let selectedPos = null; // {r,c}
let selectedPieceType = null;
let selectedPieceCamp = null;
let username = '';
let mySide = null; // 'A' or 'B'
let pollTimer = null;
let roomPollTimer = null;
let tipTimer = null;

const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const usernameInput = document.getElementById('username');
const gameIdInput = document.getElementById('gameIdInput');
const roomPanel = document.getElementById('roomPanel');
const roomListEl = document.getElementById('roomList');
const btnLeave = document.getElementById('btnLeave');
const tipEl = document.getElementById('tip');
const pieceGhostEl = document.getElementById('pieceGhost');

const TYPE_RANK = { WHALE: 12, PHOENIX: 11, DRAGON: 10, ELEPHANT: 9, LION: 8, TIGER: 7, LEOPARD: 6, FORTUNE: 5, WOLF: 4, DOG: 3, CAT: 2, MOUSE: 1 };
const BOARD_GAP_PX = 4;
const BOARD_COLS_DEFAULT = 8;
const BOARD_ROWS_DEFAULT = 7;

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
  const framePadY = 36;
  const maxH = Math.max(120, stage.clientHeight - framePadY - capturedReserve);
  const gap = BOARD_GAP_PX;
  const raw = Math.min(
    (maxW - gap * (cols - 1)) / cols,
    (maxH - gap * (rows - 1)) / rows
  );
  let cell = Number.isFinite(raw) ? Math.floor(raw) : 40;
  cell = Math.min(88, Math.max(14, cell));
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
  boardEl.style.gap = `${gap}px`;
  boardEl.style.width = `${cols * cell + (cols - 1) * gap}px`;
  boardEl.style.height = `${rows * cell + (rows - 1) * gap}px`;
  boardEl.style.setProperty('--cell', `${cell}px`);
  const fs = Math.max(10, Math.min(20, Math.floor(cell * 0.38)));
  boardEl.style.fontSize = `${fs}px`;
  if (pieceGhostEl) {
    pieceGhostEl.style.fontSize = `${Math.min(22, fs + 4)}px`;
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
  updateStatus();
  renderBoard();
  startPolling();
  if (roomPanel) roomPanel.style.display = 'none';
}

document.getElementById('btnQuickJoin').addEventListener('click', () => {
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

// 点击房间列表中的“可加入”按钮加入房间
if (roomListEl) {
  roomListEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-room]');
    if (!btn) return;
    const roomId = btn.getAttribute('data-room');
    joinRoomById(roomId);
  });
}

function joinRoomById(roomId) {
  username = (usernameInput.value || '').trim();
  if (!username) {
    alert('请先输入用户名');
    return;
  }
  fetch(`${ROOMS_API}/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('房间已满或不存在')))
    .then(data => enterRoom(data))
    .catch(err => alert('加入房间失败: ' + (err.message || err)));
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
  }, 2000);
}

function updateStatus() {
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
  if (gameState.aCamp === 'RED') a.forEach(p => red.push(p.type));
  else if (gameState.aCamp === 'BLACK') a.forEach(p => black.push(p.type));
  if (gameState.bCamp === 'RED') b.forEach(p => red.push(p.type));
  else if (gameState.bCamp === 'BLACK') b.forEach(p => black.push(p.type));
  updateCaptured(red, black);
}

function updateCaptured(redTypes, blackTypes) {
  const elRed = document.getElementById('capturedRed');
  const elBlack = document.getElementById('capturedBlack');
  if (elRed) elRed.textContent = redTypes.length ? redTypes.map(t => toZh(t)).join(' ') : '无';
  if (elBlack) elBlack.textContent = blackTypes.length ? blackTypes.map(t => toZh(t)).join(' ') : '无';
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (!gameId) return;
  pollTimer = setInterval(() => {
    fetch(`${API_BASE}/${gameId}`)
      .then(r => r.json())
      .then(state => {
        // 若本地还没状态或状态有变化，则更新
        const prevResult = gameState && gameState.result;
        const prevTurn = gameState && gameState.currentSide;
        gameState = state;
        // 每次轮次或结果变化时，清空本地选中，刷新界面
        if (!prevTurn || prevTurn !== state.currentSide || prevResult !== state.result) {
          selectedPieceId = null;
          selectedPos = null;
          selectedPieceType = null;
          selectedPieceCamp = null;
        }
        updateStatus();
        renderBoard();
        updateBoardInteractivity();
      })
      .catch(() => {
        // 轮询失败暂时忽略，不打断游戏
      });
  }, 2000);
}

// 房间列表实时刷新（只在未进入房间时）
function startRoomPolling() {
  if (roomPollTimer) clearInterval(roomPollTimer);
  roomPollTimer = setInterval(() => {
    if (!gameId) {
      refreshRoomList();
    }
  }, 3000);
}

function findPieceAt(r, c) {
  if (!gameState) return null;
  return gameState.pieces.find(p => p.r === r && p.c === c) || null;
}

function renderBoard() {
  boardEl.innerHTML = '';
  if (!gameState) return;
  const rows = gameState.rows || 7;
  const cols = gameState.cols || 8;

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (isSpecialCell(r, c)) {
        cell.classList.add('special');
      }

      const piece = findPieceAt(r, c);
      if (piece) {
        if (piece.faceDown) {
          cell.textContent = '？';
          cell.classList.add('face-down');
        } else {
          cell.textContent = toZh(piece.type);
          cell.classList.add(piece.camp === 'RED' ? 'piece-red' : 'piece-black');
        }
        if (selectedPieceId != null && selectedPos &&
            selectedPieceId === piece.id &&
            selectedPos.r === r && selectedPos.c === c) {
          cell.classList.add('selected');
        }
      }

      cell.addEventListener('click', () => onCellClicked(r, c));

      boardEl.appendChild(cell);
    }
  }
  updateBoardInteractivity();
  updatePieceGhost();
  scheduleLayoutBoardGrid();
}

function isSpecialCell(r, c) {
  return (r === 2 && c === 2) || (r === 2 && c === 7) ||
         (r === 6 && c === 2) || (r === 6 && c === 7);
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

function onCellClicked(r, c) {
  if (!gameId || !gameState) return;

  if (!username || !mySide) {
    showTip('请先输入用户名并新建/加入对局');
    return;
  }

  if (gameState.currentSide !== mySide) {
    showTip('当前不是你的回合');
    return;
  }

  const piece = findPieceAt(r, c);
  const currentSide = gameState.currentSide;

  if (selectedPieceId == null) {
    if (!piece) return;
    if (piece.faceDown) {
      // 点选未翻面的棋子：发起翻牌请求
      fetch(`${API_BASE}/${gameId}/flip?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r, c })
      })
        .then(r => r.json())
        .then(state => {
          gameState = state;
          selectedPieceId = null;
          selectedPos = null;
          updateStatus();
          renderBoard();
        })
        .catch(err => showTip('翻牌失败'));
      return;
    }
    // 这里只允许选中当前阵营的棋子
    if (!isCurrentCampPiece(piece)) {
      showTip('不是当前阵营的棋子');
      return;
    }
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    selectedPieceType = piece.type;
    selectedPieceCamp = piece.camp;
    renderBoard();
    return;
  }

  if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
    selectedPieceId = null;
    selectedPos = null;
    selectedPieceType = null;
    selectedPieceCamp = null;
    renderBoard();
    updatePieceGhost();
    return;
  }

  // 若点到己方另一枚明棋：切换选中
  if (piece && !piece.faceDown && isCurrentCampPiece(piece)) {
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    selectedPieceType = piece.type;
    selectedPieceCamp = piece.camp;
    renderBoard();
    return;
  }

  // 未翻面棋子会阻挡移动，且不可被吃
  if (piece && piece.faceDown) {
    showTip('未翻面棋子会阻挡移动，且不可被吃');
    return;
  }

  // 有目标棋子（且明棋）则尝试吃子，否则普通移动
  const to = { r, c };
  const capture = !!piece;
  const capturedId = capture ? piece.id : null;
  sendMove(selectedPieceId, selectedPos, to, capture, capturedId);
}

function isCurrentCampPiece(piece) {
  // 根据 aCamp/bCamp 和 currentSide 判定当前阵营
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

  fetch(`${API_BASE}/${gameId}/move?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(state => {
      gameState = state;
      selectedPieceId = null;
      selectedPos = null;
      selectedPieceType = null;
      selectedPieceCamp = null;
      updateStatus();
      renderBoard();
      updatePieceGhost();
    })
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

function updatePieceGhost() {
  if (!pieceGhostEl) return;
  if (!selectedPieceId || !selectedPieceType) {
    pieceGhostEl.style.display = 'none';
    return;
  }
  pieceGhostEl.textContent = toZh(selectedPieceType);
  pieceGhostEl.className = selectedPieceCamp === 'RED' ? 'piece-red' : 'piece-black';
}

document.addEventListener('mousemove', function (e) {
  if (selectedPieceId && selectedPieceType && pieceGhostEl) {
    pieceGhostEl.style.display = 'block';
    pieceGhostEl.style.left = e.clientX + 'px';
    pieceGhostEl.style.top = e.clientY + 'px';
    pieceGhostEl.textContent = toZh(selectedPieceType);
    pieceGhostEl.className = selectedPieceCamp === 'RED' ? 'piece-red' : 'piece-black';
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

// 退出房间：清理状态并显示房间列表
if (btnLeave) {
  btnLeave.addEventListener('click', () => {
    gameId = null;
    gameState = null;
    mySide = null;
    selectedPieceId = null;
    selectedPos = null;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    updateStatus();
    boardEl.innerHTML = '';
    scheduleLayoutBoardGrid();
    if (roomPanel) roomPanel.style.display = 'block';
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

refreshRoomList();
startRoomPolling();
scheduleLayoutBoardGrid();

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

