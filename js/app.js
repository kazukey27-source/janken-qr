/**
 * Janken QR Game - Main Application Logic
 */
(function() {
  'use strict';

  // Game State
  const state = {
    mode: 'menu',
    isHost: false,
    roomId: null,
    myChoice: null,
    opponentChoice: null,
    opponentChosen: false,
    roundState: 'waiting',
    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      maxStreak: 0,
      history: []
    },
    // Duel Mode state
    duel: {
      step: 1, // 1: P1 scan, 2: P2 scan, 3: result
      p1Hand: null,
      p2Hand: null
    }
  };

  const HAND_NAMES = {
    rock: { name: 'グー', icon: '✊', beats: 'scissors' },
    scissors: { name: 'チョキ', icon: '✌️', beats: 'paper' },
    paper: { name: 'パー', icon: '🖐️', beats: 'rock' }
  };

  // DOM Elements
  const screens = {
    menu: document.getElementById('screen-menu'),
    host: document.getElementById('screen-host'),
    guest: document.getElementById('screen-guest'),
    battle: document.getElementById('screen-battle'),
    camDuel: document.getElementById('screen-cam-duel'),
    cards: document.getElementById('screen-cards'),
    secret: document.getElementById('screen-secret')
  };

  // Switch Screens
  function showScreen(name) {
    state.mode = name;
    Object.keys(screens).forEach(key => {
      if (screens[key]) {
        screens[key].classList.toggle('active', key === name);
      }
    });
    // Stop camera if not in a camera screen
    if (name !== 'guest' && name !== 'secret' && name !== 'camDuel') {
      window.qrScanner.stop();
    }
  }

  // Determine Winner
  function judge(myChoice, opChoice) {
    if (myChoice === opChoice) return 'draw';
    if (HAND_NAMES[myChoice].beats === opChoice) return 'win';
    return 'lose';
  }

  // Update Stats UI
  function updateStatsUI() {
    const winsEl = document.getElementById('stat-wins');
    const lossesEl = document.getElementById('stat-losses');
    const drawsEl = document.getElementById('stat-draws');
    const streakEl = document.getElementById('stat-streak');
    const historyEl = document.getElementById('stat-history');

    if (winsEl) winsEl.textContent = state.stats.wins;
    if (lossesEl) lossesEl.textContent = state.stats.losses;
    if (drawsEl) drawsEl.textContent = state.stats.draws;
    if (streakEl) streakEl.textContent = state.stats.streak;

    if (historyEl) {
      historyEl.innerHTML = state.stats.history.slice(-8).map(res => {
        if (res === 'win') return '<span class="hist-badge hist-win">○</span>';
        if (res === 'lose') return '<span class="hist-badge hist-lose">×</span>';
        return '<span class="hist-badge hist-draw">△</span>';
      }).join('');
    }
  }

  // Setup PeerJS Callbacks
  function initP2PCallbacks() {
    window.p2p.callbacks.onOpen = (id) => {
      console.log('Room ready:', id);
    };

    window.p2p.callbacks.onConnect = () => {
      window.sound.playConnected();
      showScreen('battle');
      startNewRound('最初はグー！じゃんけん…');
    };

    window.p2p.callbacks.onData = (data) => {
      handleIncomingData(data);
    };

    window.p2p.callbacks.onClose = () => {
      alert('相手との接続が切断されました。');
      showScreen('menu');
    };

    window.p2p.callbacks.onError = (err) => {
      console.error('P2P Error:', err);
      const msg = typeof err === 'string' ? err : (err.message || '接続エラーが発生しました。');
      const errEl = document.getElementById('host-error') || document.getElementById('guest-error');
      if (errEl) errEl.textContent = msg;
    };
  }

  // Handle incoming network messages
  function handleIncomingData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'CHOSEN':
        state.opponentChosen = true;
        updateOpponentStatus('あいては手を選びました！👀');
        window.sound.playTone(500, 'sine', 0.1, 0.2);
        checkBothChosen();
        break;

      case 'REVEAL':
        state.opponentChoice = data.choice;
        checkRevealAndJudge();
        break;

      case 'REMATCH_REQUEST':
        startNewRound('最初はグー！じゃんけん…');
        break;

      case 'REACTION':
        showReactionEmoji(data.emoji, false);
        window.sound.playStamp();
        break;
    }
  }

  function updateOpponentStatus(text) {
    const el = document.getElementById('opponent-choice-status');
    if (el) el.textContent = text;
  }

  // Start a new Round in Battle Mode
  function startNewRound(promptText = 'じゃんけん…') {
    state.myChoice = null;
    state.opponentChoice = null;
    state.opponentChosen = false;
    state.roundState = 'selecting';

    const promptEl = document.getElementById('call-text');
    if (promptEl) promptEl.textContent = promptText;

    const resultBox = document.getElementById('result-box');
    if (resultBox) resultBox.classList.remove('active');

    const handsContainer = document.getElementById('hands-selection');
    if (handsContainer) handsContainer.classList.remove('disabled');

    document.querySelectorAll('.hand-card').forEach(card => {
      card.classList.remove('selected');
    });

    const myHandDisplay = document.getElementById('my-revealed-hand');
    const opHandDisplay = document.getElementById('op-revealed-hand');
    if (myHandDisplay) myHandDisplay.innerHTML = '❓';
    if (opHandDisplay) opHandDisplay.innerHTML = '❓';

    updateOpponentStatus('あいてが手を選ぶのを待っています…');

    const rematchBtn = document.getElementById('btn-rematch');
    if (rematchBtn) rematchBtn.style.display = 'none';

    window.sound.playCountdown(1);
  }

  function makeChoice(hand) {
    if (state.roundState !== 'selecting' || state.myChoice) return;

    window.sound.playSelect();
    state.myChoice = hand;

    document.querySelectorAll('.hand-card').forEach(card => {
      if (card.dataset.hand === hand) {
        card.classList.add('selected');
      }
    });

    const handsContainer = document.getElementById('hands-selection');
    if (handsContainer) handsContainer.classList.add('disabled');

    window.p2p.send({ type: 'CHOSEN' });
    checkBothChosen();
  }

  function checkBothChosen() {
    if (state.myChoice && state.opponentChosen) {
      state.roundState = 'countdown';
      window.p2p.send({ type: 'REVEAL', choice: state.myChoice });
      checkRevealAndJudge();
    }
  }

  function checkRevealAndJudge() {
    if (!state.myChoice || !state.opponentChoice) return;

    state.roundState = 'revealed';

    const promptEl = document.getElementById('call-text');
    if (promptEl) promptEl.textContent = 'ぽん！！！';
    window.sound.playPon();

    const myHandDisplay = document.getElementById('my-revealed-hand');
    const opHandDisplay = document.getElementById('op-revealed-hand');

    if (myHandDisplay) {
      myHandDisplay.innerHTML = `<span class="hand-icon-large">${HAND_NAMES[state.myChoice].icon}</span><span class="hand-label">${HAND_NAMES[state.myChoice].name}</span>`;
      myHandDisplay.classList.add('pop-anim');
    }
    if (opHandDisplay) {
      opHandDisplay.innerHTML = `<span class="hand-icon-large">${HAND_NAMES[state.opponentChoice].icon}</span><span class="hand-label">${HAND_NAMES[state.opponentChoice].name}</span>`;
      opHandDisplay.classList.add('pop-anim');
    }

    const result = judge(state.myChoice, state.opponentChoice);
    state.stats.history.push(result);

    const resultBox = document.getElementById('result-box');
    const resultTitle = document.getElementById('result-title');
    const resultSub = document.getElementById('result-subtitle');

    setTimeout(() => {
      if (result === 'win') {
        state.stats.wins++;
        state.stats.streak++;
        if (state.stats.streak > state.stats.maxStreak) {
          state.stats.maxStreak = state.stats.streak;
        }
        window.sound.playWin();
        window.confetti.fire(120);

        if (resultTitle) {
          resultTitle.textContent = 'あなたの勝ち！🎉';
          resultTitle.className = 'result-title win-text';
        }
        if (resultSub) {
          resultSub.textContent = state.stats.streak > 1 ? `${state.stats.streak}連勝中！！すごい！` : 'ナイス勝利！';
        }
      } else if (result === 'lose') {
        state.stats.losses++;
        state.stats.streak = 0;
        window.sound.playLose();

        if (resultTitle) {
          resultTitle.textContent = 'あなたの負け…😢';
          resultTitle.className = 'result-title lose-text';
        }
        if (resultSub) {
          resultSub.textContent = 'ドンマイ！次は勝てるはず！';
        }
      } else {
        state.stats.draws++;
        window.sound.playDraw();

        if (resultTitle) {
          resultTitle.textContent = 'あいこ！🤝';
          resultTitle.className = 'result-title draw-text';
        }
        if (resultSub) {
          resultSub.textContent = 'もう一回！あいこで…';
        }
      }

      if (resultBox) resultBox.classList.add('active');
      updateStatsUI();

      if (result === 'draw') {
        setTimeout(() => {
          if (state.roundState === 'revealed') {
            startNewRound('あいこで…しょ！');
          }
        }, 2200);
      } else {
        const rematchBtn = document.getElementById('btn-rematch');
        if (rematchBtn) rematchBtn.style.display = 'inline-flex';
      }
    }, 600);
  }

  // Floating Reaction Stamp
  function showReactionEmoji(emoji, isMine = true) {
    const container = document.getElementById('reactions-layer') || document.body;
    const el = document.createElement('div');
    el.className = 'flying-emoji';
    el.textContent = emoji;

    const startX = isMine ? (window.innerWidth * 0.3) : (window.innerWidth * 0.7);
    el.style.left = (startX + (Math.random() - 0.5) * 80) + 'px';
    el.style.bottom = '120px';

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2000);
  }

  function sendReaction(emoji) {
    window.sound.playStamp();
    showReactionEmoji(emoji, true);
    window.p2p.send({ type: 'REACTION', emoji });
  }

  // Host Mode
  function startHostMode() {
    window.sound.playClick();
    showScreen('host');

    const qrContainer = document.getElementById('host-qr-code');
    const roomUrlInput = document.getElementById('host-room-url');
    const roomIdSpan = document.getElementById('host-room-id');
    const copyStatus = document.getElementById('host-copy-status');
    const localNotice = document.getElementById('host-local-notice');

    if (window.location.protocol === 'file:') {
      if (localNotice) localNotice.style.display = 'block';
    } else {
      if (localNotice) localNotice.style.display = 'none';
    }

    if (qrContainer) qrContainer.innerHTML = '<div class="spinner"></div><p style="font-size:12px; margin-top:8px;">ルームID発行中...</p>';
    if (copyStatus) copyStatus.textContent = '';

    window.p2p.createRoom(null, (roomId) => {
      state.roomId = roomId;
      if (roomIdSpan) roomIdSpan.textContent = roomId;

      let joinUrl = window.location.href.split('?')[0] + '?room=' + encodeURIComponent(roomId);
      if (roomUrlInput) roomUrlInput.value = joinUrl;

      if (window.QRCodeGenerator) {
        window.QRCodeGenerator.render(qrContainer, joinUrl, {
          width: 240,
          height: 240,
          colorDark: '#01012B',
          colorLight: '#FFFFFF'
        });
      }
    });
  }

  // Guest Scan Mode
  function startGuestMode(defaultRoom = '') {
    window.sound.playClick();
    showScreen('guest');

    const input = document.getElementById('input-join-room-id');
    if (input && defaultRoom) input.value = defaultRoom;

    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-canvas');

    window.qrScanner.start(video, canvas, (scannedText) => {
      window.sound.playScanSuccess();
      window.qrScanner.stop();

      let targetRoom = scannedText;
      try {
        if (scannedText.includes('room=')) {
          const url = new URL(scannedText);
          targetRoom = url.searchParams.get('room') || scannedText;
        }
      } catch (e) {}

      if (input) input.value = targetRoom;
      joinRoomById(targetRoom);
    }).catch(err => {
      console.warn('Camera could not start:', err);
      const camErr = document.getElementById('camera-error-msg');
      if (camErr) camErr.style.display = 'block';
    });
  }

  function joinRoomById(roomId) {
    if (!roomId) return;
    window.sound.playClick();
    state.roomId = roomId;

    const guestStatus = document.getElementById('guest-connect-status');
    if (guestStatus) guestStatus.textContent = '接続中... ' + roomId;

    window.p2p.joinRoom(roomId, () => {
      console.log('Joined room, waiting for connection open');
    });
  }

  // --- CAMERA DUEL MODE (1 Device with 2 Players) ---
  function startCameraDuel() {
    window.sound.playClick();
    showScreen('camDuel');

    state.duel = {
      step: 1,
      p1Hand: null,
      p2Hand: null
    };

    updateDuelUI();
    startDuelScanner();
  }

  function updateDuelUI() {
    const badge = document.getElementById('duel-step-badge');
    const instruction = document.getElementById('duel-instruction');
    const p1Status = document.getElementById('p1-duel-status');
    const p2Status = document.getElementById('p2-duel-status');
    const resultBox = document.getElementById('duel-result-box');

    if (resultBox) resultBox.classList.remove('active');

    if (state.duel.step === 1) {
      if (badge) badge.textContent = 'プレイヤー1のターン';
      if (instruction) instruction.textContent = 'プレイヤー1の手札QRコードをカメラにかざしてください';
      if (p1Status) p1Status.innerHTML = 'P1: <span style="color:var(--accent);">スキャン待ち ⏳</span>';
      if (p2Status) p2Status.innerHTML = 'P2: <span style="color:var(--text-sub);">未スキャン</span>';
    } else if (state.duel.step === 2) {
      if (badge) badge.textContent = 'プレイヤー2のターン';
      if (instruction) instruction.textContent = 'プレイヤー2の手札QRコードをカメラにかざしてください';
      if (p1Status) p1Status.innerHTML = 'P1: <span style="color:var(--primary);">準備完了 ✅</span>';
      if (p2Status) p2Status.innerHTML = 'P2: <span style="color:var(--accent);">スキャン待ち ⏳</span>';
    }
  }

  function startDuelScanner() {
    const video = document.getElementById('duel-video');
    const canvas = document.getElementById('duel-canvas');

    window.qrScanner.start(video, canvas, (scannedText) => {
      handleDuelScanned(scannedText);
    }).catch(err => {
      alert('カメラの起動に失敗しました。カメラのアクセス許可を確認してください。');
      showScreen('menu');
    });
  }

  function extractHandFromQR(text) {
    if (text.startsWith('JANKEN:')) {
      const h = text.replace('JANKEN:', '').trim().toLowerCase();
      if (HAND_NAMES[h]) return h;
    }
    // Secret QR token support
    if (text.startsWith('SECRET_JANKEN:')) {
      try {
        const raw = atob(text.replace('SECRET_JANKEN:', ''));
        const obj = JSON.parse(raw);
        if (obj && obj.hand && HAND_NAMES[obj.hand]) return obj.hand;
      } catch(e){}
    }
    return null;
  }

  function handleDuelScanned(scannedText) {
    const hand = extractHandFromQR(scannedText);
    if (!hand) {
      // じゃんけんQRコードではない場合、継続スキャン
      setTimeout(() => {
        window.qrScanner.scanLoop();
      }, 500);
      return;
    }

    window.sound.playScanSuccess();

    if (state.duel.step === 1) {
      state.duel.p1Hand = hand;
      state.duel.step = 2;
      updateDuelUI();
      // 少し待ってからP2のスキャン再開
      setTimeout(() => {
        window.qrScanner.scanLoop();
      }, 1200);
    } else if (state.duel.step === 2) {
      state.duel.p2Hand = hand;
      state.duel.step = 3;
      window.qrScanner.stop();
      finishDuel();
    }
  }

  function finishDuel() {
    const p1Status = document.getElementById('p1-duel-status');
    const p2Status = document.getElementById('p2-duel-status');
    if (p1Status) p1Status.innerHTML = 'P1: <span style="color:var(--primary);">準備完了 ✅</span>';
    if (p2Status) p2Status.innerHTML = 'P2: <span style="color:var(--primary);">準備完了 ✅</span>';

    const p1El = document.getElementById('duel-p1-hand');
    const p2El = document.getElementById('duel-p2-hand');
    const resBox = document.getElementById('duel-result-box');
    const resTitle = document.getElementById('duel-result-title');

    window.sound.playPon();

    if (p1El) p1El.innerHTML = HAND_NAMES[state.duel.p1Hand].icon;
    if (p2El) p2El.innerHTML = HAND_NAMES[state.duel.p2Hand].icon;

    const res = judge(state.duel.p1Hand, state.duel.p2Hand);

    if (res === 'win') {
      resTitle.textContent = 'プレイヤー1の勝ち！🎉';
      resTitle.className = 'result-title win-text';
      window.sound.playWin();
      window.confetti.fire(120);
    } else if (res === 'lose') {
      resTitle.textContent = 'プレイヤー2の勝ち！🎉';
      resTitle.className = 'result-title lose-text';
      window.sound.playWin();
      window.confetti.fire(120);
    } else {
      resTitle.textContent = 'あいこ！🤝';
      resTitle.className = 'result-title draw-text';
      window.sound.playDraw();
    }

    if (resBox) resBox.classList.add('active');
  }

  // --- Show QR Cards ---
  function showQRCards() {
    window.sound.playClick();
    showScreen('cards');

    const hands = ['rock', 'scissors', 'paper'];
    hands.forEach(h => {
      const container = document.getElementById(`qr-card-${h}`);
      if (container && window.QRCodeGenerator) {
        window.QRCodeGenerator.render(container, `JANKEN:${h}`, {
          width: 180,
          height: 180,
          colorDark: '#01012B',
          colorLight: '#FFFFFF'
        });
      }
    });
  }

  // --- Secret Offline QR Mode ---
  let secretHandP1 = null;
  function startSecretMode() {
    window.sound.playClick();
    showScreen('secret');
    secretHandP1 = null;

    document.getElementById('secret-step-1').style.display = 'block';
    document.getElementById('secret-step-2').style.display = 'none';
    document.getElementById('secret-step-3').style.display = 'none';
    document.getElementById('secret-result-area').style.display = 'none';
  }

  function secretGenerateP1(hand) {
    window.sound.playSelect();
    secretHandP1 = hand;
    document.getElementById('secret-step-1').style.display = 'none';
    document.getElementById('secret-step-2').style.display = 'block';

    const qrBox = document.getElementById('secret-qr-box');
    if (qrBox && window.QRCodeGenerator) {
      const token = btoa(JSON.stringify({ hand: hand, salt: Math.random().toString(36).substring(2) }));
      window.QRCodeGenerator.render(qrBox, `SECRET_JANKEN:${token}`, {
        width: 220,
        height: 220
      });
    }
  }

  function secretStartScanP2() {
    window.sound.playClick();
    document.getElementById('secret-step-2').style.display = 'none';
    document.getElementById('secret-step-3').style.display = 'block';

    const video = document.getElementById('secret-video');
    const canvas = document.getElementById('secret-canvas');

    window.qrScanner.start(video, canvas, (text) => {
      window.sound.playScanSuccess();
      window.qrScanner.stop();

      try {
        if (text.startsWith('SECRET_JANKEN:')) {
          const raw = atob(text.replace('SECRET_JANKEN:', ''));
          const data = JSON.parse(raw);
          secretShowResult(data.hand);
        } else if (text.startsWith('JANKEN:')) {
          secretShowResult(text.replace('JANKEN:', ''));
        } else {
          alert('じゃんけんQRコードではありません。');
        }
      } catch (e) {
        alert('QRコードの読み取りに失敗しました。');
      }
    });
  }

  function secretShowResult(opHand) {
    document.getElementById('secret-step-3').style.display = 'none';
    const resultArea = document.getElementById('secret-result-area');
    resultArea.style.display = 'block';

    const chooseButtons = document.getElementById('secret-p2-choose');
    chooseButtons.innerHTML = Object.keys(HAND_NAMES).map(h => `
      <button class="hand-card" data-p2hand="${h}">
        <span class="hand-card-icon">${HAND_NAMES[h].icon}</span>
        <span class="hand-card-name">${HAND_NAMES[h].name}</span>
      </button>
    `).join('');

    chooseButtons.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p2Hand = btn.dataset.p2hand;
        const res = judge(p2Hand, opHand);
        const resBox = document.getElementById('secret-final-result');
        resBox.innerHTML = `
          <h3 style="font-size:18px; margin-bottom:8px;">結果発表！</h3>
          <p style="font-size:14px; margin-bottom:4px;">プレイヤー1: <strong>${HAND_NAMES[opHand].icon} ${HAND_NAMES[opHand].name}</strong></p>
          <p style="font-size:14px; margin-bottom:12px;">プレイヤー2: <strong>${HAND_NAMES[p2Hand].icon} ${HAND_NAMES[p2Hand].name}</strong></p>
          <div class="result-title ${res === 'win' ? 'win-text' : (res === 'lose' ? 'lose-text' : 'draw-text')}">
            ${res === 'win' ? 'プレイヤー2の勝ち！🎉' : (res === 'lose' ? 'プレイヤー1の勝ち！🎉' : 'あいこ！🤝')}
          </div>
        `;
        if (res === 'win' || res === 'lose') {
          window.sound.playWin();
          window.confetti.fire(100);
        } else {
          window.sound.playDraw();
        }
      });
    });
  }

  // Setup Event Listeners
  function setupEvents() {
    // Menu navigation
    document.getElementById('btn-mode-host').addEventListener('click', startHostMode);
    document.getElementById('btn-mode-guest').addEventListener('click', () => startGuestMode());
    document.getElementById('btn-mode-camera-duel').addEventListener('click', startCameraDuel);
    document.getElementById('btn-mode-cards').addEventListener('click', showQRCards);
    document.getElementById('btn-mode-secret').addEventListener('click', startSecretMode);

    // Back to Menu buttons
    document.querySelectorAll('.btn-back-menu').forEach(btn => {
      btn.addEventListener('click', () => {
        window.sound.playClick();
        window.p2p.destroy();
        showScreen('menu');
      });
    });

    // Copy URL Button
    const btnCopy = document.getElementById('btn-copy-url');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const input = document.getElementById('host-room-url');
        if (input) {
          input.select();
          navigator.clipboard.writeText(input.value).then(() => {
            const status = document.getElementById('host-copy-status');
            if (status) status.textContent = '✅ URLをコピーしました！';
            window.sound.playClick();
          });
        }
      });
    }

    // Guest manual join
    const btnManualJoin = document.getElementById('btn-manual-join');
    if (btnManualJoin) {
      btnManualJoin.addEventListener('click', () => {
        const id = document.getElementById('input-join-room-id').value.trim();
        if (id) joinRoomById(id);
      });
    }

    // Camera switch buttons
    const btnSwitchCam = document.getElementById('btn-switch-camera');
    if (btnSwitchCam) {
      btnSwitchCam.addEventListener('click', () => {
        window.sound.playClick();
        window.qrScanner.switchCamera();
      });
    }

    const btnSwitchCamDuel = document.getElementById('btn-switch-camera-duel');
    if (btnSwitchCamDuel) {
      btnSwitchCamDuel.addEventListener('click', () => {
        window.sound.playClick();
        window.qrScanner.switchCamera();
      });
    }

    // Duel buttons
    const btnDuelRestart = document.getElementById('btn-duel-restart');
    if (btnDuelRestart) {
      btnDuelRestart.addEventListener('click', startCameraDuel);
    }
    const btnDuelCards = document.getElementById('btn-duel-show-cards');
    if (btnDuelCards) {
      btnDuelCards.addEventListener('click', showQRCards);
    }

    // Sound toggle
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const enabled = window.sound.toggleSound();
        btnSound.textContent = enabled ? '🔊' : '🔇';
      });
    }

    // Hand selection in battle
    document.querySelectorAll('.hand-card').forEach(card => {
      card.addEventListener('click', () => {
        const hand = card.dataset.hand;
        if (hand) makeChoice(hand);
      });
    });

    // Rematch button
    const btnRematch = document.getElementById('btn-rematch');
    if (btnRematch) {
      btnRematch.addEventListener('click', () => {
        window.sound.playClick();
        window.p2p.send({ type: 'REMATCH_REQUEST' });
        startNewRound('最初はグー！じゃんけん…');
      });
    }

    // Reaction emojis
    document.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        if (emoji) sendReaction(emoji);
      });
    });

    // Secret mode buttons
    document.querySelectorAll('[data-secret-p1]').forEach(btn => {
      btn.addEventListener('click', () => {
        secretGenerateP1(btn.dataset.secretP1);
      });
    });
    const btnSecretNext = document.getElementById('btn-secret-scan');
    if (btnSecretNext) {
      btnSecretNext.addEventListener('click', secretStartScanP2);
    }
  }

  // Auto join if room in URL parameter
  function checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      console.log('Room found in URL:', room);
      startGuestMode(room);
      joinRoomById(room);
    }
  }

  // App Initialize
  function init() {
    initP2PCallbacks();
    setupEvents();
    updateStatsUI();
    checkUrlParam();
  }

  window.addEventListener('DOMContentLoaded', init);

})();
