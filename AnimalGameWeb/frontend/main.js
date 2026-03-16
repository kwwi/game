const API_BASE = 'http://localhost:8080/api/games';

let gameId = null;
let gameState = null;
let selectedPieceId = null;
let selectedPos = null; // {r,c}
let username = '';
let mySide = null; // 'A' or 'B'
let pollTimer = null;

const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const usernameInput = document.getElementById('username');
const gameIdInput = document.getElementById('gameIdInput');

document.getElementById('btnNew').addEventListener('click', () => {
  username = (usernameInput.value || '').trim();
  if (!username) {
    alert('请先输入用户名');
    return;
  }
  fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.json())
    .then(data => {
      gameId = data.gameId;
      gameIdInput.value = gameId;
      gameState = data.state;
      mySide = data.side;
      selectedPieceId = null;
      selectedPos = null;
      updateStatus();
      renderBoard();
      startPolling();
    })
    .catch(err => alert('创建对局失败: ' + err));
});

document.getElementById('btnJoin').addEventListener('click', () => {
  username = (usernameInput.value || '').trim();
  if (!username) {
    alert('请先输入用户名');
    return;
  }
  const gid = (gameIdInput.value || '').trim();
  if (!gid) {
    alert('请输入要加入的对局ID');
    return;
  }
  fetch(`${API_BASE}/${gid}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then(r => r.json())
    .then(data => {
      gameId = data.gameId;
      gameIdInput.value = gameId;
      gameState = data.state;
      mySide = data.side;
      selectedPieceId = null;
      selectedPos = null;
      updateStatus();
      renderBoard();
      startPolling();
    })
    .catch(err => alert('加入对局失败: ' + err));
});

document.getElementById('btnFlip').addEventListener('click', () => {
  alert('现在翻牌由轮到操作的玩家点击未翻面的棋子来完成。');
});

function updateStatus() {
  if (!gameState) {
    statusEl.textContent = '未开始对局';
    updateCaptured([], []);
    return;
  }
  statusEl.textContent =
    `对局: ${gameId} | 当前回合: ${gameState.currentSide}` +
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
        }
        updateStatus();
        renderBoard();
      })
      .catch(() => {
        // 轮询失败暂时忽略，不打断游戏
      });
  }, 2000);
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
    alert('请先输入用户名并新建/加入对局');
    return;
  }

  if (gameState.currentSide !== mySide) {
    alert('当前不是你的回合');
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
        .catch(err => alert('翻牌失败: ' + err));
      return;
    }
    // 这里只允许选中当前阵营的棋子
    if (!isCurrentCampPiece(piece)) {
      alert('不是当前阵营的棋子');
      return;
    }
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    renderBoard();
    return;
  }

  if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
    selectedPieceId = null;
    selectedPos = null;
    renderBoard();
    return;
  }

  // 若点到己方另一枚明棋：切换选中
  if (piece && !piece.faceDown && isCurrentCampPiece(piece)) {
    selectedPieceId = piece.id;
    selectedPos = { r, c };
    renderBoard();
    return;
  }

  // 未翻面棋子会阻挡移动，且不可被吃
  if (piece && piece.faceDown) {
    alert('未翻面棋子会阻挡移动，且不可被吃');
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
      updateStatus();
      renderBoard();
    })
    .catch(err => alert('走子失败: ' + err));
}

