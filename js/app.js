/**
 * MISHLAND APPLICATION CONTROLLER
 * Управляет игровым циклом, выбором из Медвежонка Миши и 10 безымянных персонажей (с вводом своего имени и пола),
 * ветвящимися диалогами, викториной с 4 вариантами ответов (включая 1963 год, Научный городок и Зенит),
 * загадками на СЛОВО и ЧИСЛО, а также безвопросными бонусными локациями:
 * - 🍺 Бар «Пенная Кружка» (всем наливают пива и начисляют баллы без вопросов)
 * - 🧖‍♂️ Царская Баня «Лёгкий Пар» (всем начисляют банный бонус без вопросов)
 * - 💅 Салон «Маник & Педик» (баллы начисляются ТОЛЬКО ЖЕНЩИНАМ!)
 */
(function () {
  let selectedLobbyCharId = 'misha';
  let selectedLobbyGender = 'male'; // 'male' | 'female'
  let genderManuallyChosen = false;
  let lastRenderedVersion = -1;
  let lastCompletedCount = 0;
  let audioCtx = null;

  function playSound(type) {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'physics') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'success') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach(function (freq, idx) {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(freq, now + idx * 0.09);
          g.gain.setValueAtTime(0.16, now + idx * 0.09);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
          o.start(now + idx * 0.09);
          o.stop(now + idx * 0.09 + 0.29);
        });
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.22);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }

  function init() {
    window.Mishland3D.init('canvas-container', 'map-hover-tooltip', handle3DLocationClick);

    setupTopBarControls();
    setupInviteModalControls();
    setupMobileToggles();
    setupLobbyEvents();

    const roomCode = window.MishlandSync.getRoomCode ? window.MishlandSync.getRoomCode() : 'MISHA';
    const roomLabel = document.getElementById('hud-room-code-label');
    if (roomLabel) roomLabel.textContent = roomCode;
    const lobbyBadge = document.getElementById('lobby-room-badge');
    if (lobbyBadge) lobbyBadge.textContent = roomCode;

    window.MishlandSync.subscribe(function (state) {
      onStateUpdated(state);
    });

    const me = window.MishlandSync.getMyPlayer();
    if (!me) {
      openLobbyModal();
    } else {
      document.getElementById('lobby-modal').classList.add('hidden');
    }

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
        toggleZeroOcclusion();
      }
    });
  }

  function openInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (!modal) return;
    const roomCode = window.MishlandSync.getRoomCode ? window.MishlandSync.getRoomCode() : 'MISHA';
    const shareUrl = window.MishlandSync.getShareUrl ? window.MishlandSync.getShareUrl() : window.location.href;
    const roomInput = document.getElementById('invite-room-input');
    const linkInput = document.getElementById('invite-link-input');
    const qrImg = document.getElementById('invite-qr-img');

    if (roomInput) roomInput.value = roomCode;
    if (linkInput) linkInput.value = shareUrl;
    if (qrImg) {
      qrImg.src =
        'https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=' +
        encodeURIComponent(shareUrl);
    }
    modal.style.display = 'flex';
  }

  function setupInviteModalControls() {
    const openBtns = [
      document.getElementById('btn-invite-friends'),
      document.getElementById('btn-open-invite-badge'),
      document.getElementById('btn-open-invite-left')
    ];
    openBtns.forEach(function (b) {
      if (b) {
        b.addEventListener('click', function () {
          playSound('click');
          openInviteModal();
        });
      }
    });

    const closeBtn = document.getElementById('btn-close-invite');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        playSound('click');
        const modal = document.getElementById('invite-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    const copyBtn = document.getElementById('btn-copy-invite');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        playSound('success');
        const linkInput = document.getElementById('invite-link-input');
        const shareUrl = linkInput ? linkInput.value : window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).catch(function () {});
        } else if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
        }
        copyBtn.textContent = '✅ Скопировано!';
        setTimeout(function () {
          copyBtn.textContent = '📋 Копировать';
        }, 2000);
      });
    }

    const changeRoomBtn = document.getElementById('btn-change-room');
    if (changeRoomBtn) {
      changeRoomBtn.addEventListener('click', function () {
        const roomInput = document.getElementById('invite-room-input');
        const val = roomInput ? roomInput.value.trim() : '';
        if (val && window.MishlandSync.setRoomCode) {
          playSound('click');
          window.MishlandSync.setRoomCode(val);
        }
      });
    }
  }

  function setupMobileToggles() {
    const btnPlayers = document.getElementById('btn-mobile-players');
    const btnStory = document.getElementById('btn-mobile-story');
    const btnMapOnly = document.getElementById('btn-mobile-maponly');

    function setMobileMode(mode) {
      document.body.classList.remove('mobile-show-players', 'mobile-map-only');
      if (btnPlayers) btnPlayers.classList.toggle('active', mode === 'players');
      if (btnStory) btnStory.classList.toggle('active', mode === 'story');
      if (btnMapOnly) btnMapOnly.classList.toggle('active', mode === 'map');

      if (mode === 'players') {
        document.body.classList.add('mobile-show-players');
      } else if (mode === 'map') {
        document.body.classList.add('mobile-map-only');
      }
    }

    if (btnPlayers) {
      btnPlayers.addEventListener('click', function () {
        playSound('click');
        setMobileMode('players');
      });
    }
    if (btnStory) {
      btnStory.addEventListener('click', function () {
        playSound('click');
        setMobileMode('story');
      });
    }
    if (btnMapOnly) {
      btnMapOnly.addEventListener('click', function () {
        playSound('click');
        setMobileMode('map');
      });
    }
  }

  function setupTopBarControls() {
    document.querySelectorAll('[data-cam-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        playSound('click');
        const mode = btn.getAttribute('data-cam-mode');
        document.querySelectorAll('[data-cam-mode]').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        window.Mishland3D.setCameraMode(mode);
      });
    });

    const physBtn = document.getElementById('btn-physics-impulse');
    if (physBtn) {
      physBtn.addEventListener('click', function () {
        playSound('physics');
        const st = window.MishlandSync.getState();
        window.Mishland3D.triggerPhysicalImpulse(st ? st.currentLocationId : null);
      });
    }

    const toggleHudBtn = document.getElementById('btn-toggle-hud');
    if (toggleHudBtn) {
      toggleHudBtn.addEventListener('click', function () {
        playSound('click');
        toggleZeroOcclusion();
      });
    }

    const openRoleBtn = document.getElementById('btn-change-role');
    if (openRoleBtn) {
      openRoleBtn.addEventListener('click', function () {
        playSound('click');
        openLobbyModal();
      });
    }

    const newTabBtn = document.getElementById('btn-open-friend-tab');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', function () {
        playSound('click');
        const url = window.MishlandSync.getShareUrl ? window.MishlandSync.getShareUrl() : window.location.href;
        window.open(url, '_blank');
      });
    }

    const resetBtn = document.getElementById('btn-reset-game');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        playSound('click');
        window.MishlandSync.resetGame(true);
        window.Mishland3D.setCameraMode('overview');
      });
    }
  }

  function toggleZeroOcclusion() {
    document.body.classList.toggle('hud-minimized');
    const btn = document.getElementById('btn-toggle-hud');
    if (btn) {
      const isMin = document.body.classList.contains('hud-minimized');
      btn.textContent = isMin ? '👁️ Показать панели (H)' : '👁️ Чистый 3D (H)';
      btn.classList.toggle('active', isMin);
    }
  }

  function updateGenderButtonsUI() {
    const fBtn = document.getElementById('gender-btn-female');
    const mBtn = document.getElementById('gender-btn-male');
    if (fBtn) {
      fBtn.style.background =
        selectedLobbyGender === 'female' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(30, 41, 59, 0.75)';
      fBtn.style.borderColor =
        selectedLobbyGender === 'female' ? '#f472b6' : 'rgba(148, 163, 184, 0.3)';
      fBtn.style.color = selectedLobbyGender === 'female' ? '#fdf2f8' : '#cbd5e1';
    }
    if (mBtn) {
      mBtn.style.background =
        selectedLobbyGender === 'male' ? 'rgba(56, 189, 248, 0.32)' : 'rgba(30, 41, 59, 0.75)';
      mBtn.style.borderColor =
        selectedLobbyGender === 'male' ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)';
      mBtn.style.color = selectedLobbyGender === 'male' ? '#f0f9ff' : '#cbd5e1';
    }
  }

  function openLobbyModal() {
    const modal = document.getElementById('lobby-modal');
    modal.classList.remove('hidden');

    const activePlayers = window.MishlandSync.getActivePlayers();
    const takenCharIds = {};
    activePlayers.forEach(function (p) {
      if (p.tabId !== window.MishlandSync.getTabId()) {
        takenCharIds[p.charId] = p.name;
      }
    });

    const me = window.MishlandSync.getMyPlayer();
    const nameInput = document.getElementById('lobby-custom-name');

    if (me) {
      selectedLobbyCharId = me.charId;
      selectedLobbyGender = me.gender || 'male';
      genderManuallyChosen = true;
      if (nameInput) nameInput.value = me.name;
    } else {
      genderManuallyChosen = false;
      if (!takenCharIds['misha']) {
        selectedLobbyCharId = 'misha';
        selectedLobbyGender = 'male';
        if (nameInput) nameInput.value = 'Миша';
      } else {
        const avail = window.MishlandData.characters.find(function (c) {
          return c.id !== 'misha' && !takenCharIds[c.id];
        });
        const chosen = avail || window.MishlandData.characters[1];
        selectedLobbyCharId = chosen.id;
        selectedLobbyGender = chosen.defaultGender || 'female';
        if (nameInput) nameInput.value = '';
      }
    }

    updateGenderButtonsUI();
    renderLobbyCharacters(takenCharIds);
  }

  function renderLobbyCharacters(takenCharIds) {
    const grid = document.getElementById('lobby-char-grid');
    if (!grid) return;

    const chars = window.MishlandData.characters;
    grid.innerHTML = chars
      .map(function (c) {
        const isSelected = c.id === selectedLobbyCharId;
        const takenBy = takenCharIds[c.id];
        const titleText = c.isHostRole ? 'Миша 👑' : c.avatarLabel;
        return (
          '<div class="char-card ' +
          (isSelected ? 'selected ' : '') +
          (takenBy ? 'taken ' : '') +
          '" data-char-id="' +
          c.id +
          '">' +
          '<div class="char-card-top">' +
          '<span class="char-emoji">' +
          c.emoji +
          '</span>' +
          '<span class="char-tag ' +
          (c.isHostRole ? 'host-tag' : '') +
          '">' +
          (takenBy
            ? 'Занят: ' + takenBy
            : c.isHostRole
            ? 'Именинник'
            : 'Друг') +
          '</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:15px;color:#fff;margin-top:2px;">' +
          titleText +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    grid.querySelectorAll('.char-card').forEach(function (card) {
      card.addEventListener('click', function () {
        playSound('click');
        const prevId = selectedLobbyCharId;
        selectedLobbyCharId = card.getAttribute('data-char-id');
        const pickedChar = window.MishlandData.characters.find(function (x) {
          return x.id === selectedLobbyCharId;
        });
        if (pickedChar && !genderManuallyChosen) {
          selectedLobbyGender = pickedChar.defaultGender || 'male';
          updateGenderButtonsUI();
        }
        renderLobbyCharacters(takenCharIds);

        const nameInput = document.getElementById('lobby-custom-name');
        const errEl = document.getElementById('lobby-name-error');
        if (errEl) errEl.style.display = 'none';

        if (nameInput) {
          if (selectedLobbyCharId === 'misha' && !nameInput.value.trim()) {
            nameInput.value = 'Миша';
          } else if (prevId === 'misha' && selectedLobbyCharId !== 'misha' && nameInput.value.trim() === 'Миша') {
            nameInput.value = '';
          }
          if (selectedLobbyCharId !== 'misha') {
            nameInput.focus();
          }
        }
      });
    });

    const joinBtn = document.getElementById('btn-join-game');
    const nameInput = document.getElementById('lobby-custom-name');
    const charObj = window.MishlandData.characters.find(function (x) {
      return x.id === selectedLobbyCharId;
    });

    if (nameInput && charObj) {
      nameInput.placeholder = charObj.isHostRole
        ? 'Имя (Миша)'
        : 'Введите ваше имя...';
    }

    if (joinBtn && charObj) {
      joinBtn.innerHTML = charObj.isHostRole
        ? '👑 Играть за Мишу'
        : '🎉 Войти (' + charObj.emoji + ' ' + charObj.avatarLabel + ')';
    }
  }

  function setupLobbyEvents() {
    const joinBtn = document.getElementById('btn-join-game');
    const nameInput = document.getElementById('lobby-custom-name');
    const fBtn = document.getElementById('gender-btn-female');
    const mBtn = document.getElementById('gender-btn-male');

    if (fBtn) {
      fBtn.addEventListener('click', function () {
        playSound('click');
        selectedLobbyGender = 'female';
        genderManuallyChosen = true;
        updateGenderButtonsUI();
      });
    }
    if (mBtn) {
      mBtn.addEventListener('click', function () {
        playSound('click');
        selectedLobbyGender = 'male';
        genderManuallyChosen = true;
        updateGenderButtonsUI();
      });
    }

    function tryJoin() {
      const charObj =
        window.MishlandData.characters.find(function (x) {
          return x.id === selectedLobbyCharId;
        }) || window.MishlandData.characters[0];

      const customName = nameInput ? nameInput.value.trim() : '';
      const errEl = document.getElementById('lobby-name-error');

      if (!charObj.isHostRole && !customName) {
        playSound('error');
        if (errEl) {
          errEl.textContent =
            '✍️ У этого персонажа нет имени! Пожалуйста, введите своё имя в поле ниже, чтобы подключиться.';
          errEl.style.display = 'block';
        }
        if (nameInput) {
          nameInput.focus();
          nameInput.style.borderColor = '#f87171';
        }
        return;
      }

      if (errEl) errEl.style.display = 'none';
      if (nameInput) nameInput.style.borderColor = '';

      playSound('success');
      window.MishlandSync.joinAsCharacter(charObj, customName || 'Миша', selectedLobbyGender);
      document.getElementById('lobby-modal').classList.add('hidden');
      window.Mishland3D.triggerPhysicalImpulse();
    }

    if (joinBtn) {
      joinBtn.addEventListener('click', tryJoin);
    }
    if (nameInput) {
      nameInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          tryJoin();
        }
      });
    }
  }

  function canMakeFinalChoice(state) {
    const me = window.MishlandSync.getMyPlayer();
    const activePlayers = window.MishlandSync.getActivePlayers();
    const mishaExists = activePlayers.some(function (p) {
      return p.isHost;
    });
    if (!mishaExists) return true;
    return !!(me && me.isHost);
  }

  function handle3DLocationClick(locId) {
    const state = window.MishlandSync.getState();
    const me = window.MishlandSync.getMyPlayer();
    const locObj = window.MishlandData.locations.find(function (l) {
      return l.id === locId;
    });
    if (!locObj) return;

    playSound('click');

    const activePlayers = window.MishlandSync.getActivePlayers();
    const isDecisionMaker = canMakeFinalChoice(state);
    const currentRound = (state && state.voteRound) || 1;
    const myCurrentVote =
      me && (me.voteRound || 1) === currentRound ? me.voteChoiceId : null;

    // Cast vote for this location on the 3D map
    window.MishlandSync.updateState(function (st) {
      const myTabId = window.MishlandSync.getTabId();
      if (st.players && st.players[myTabId]) {
        st.players[myTabId].pingLocationId = locId;
        st.players[myTabId].voteChoiceId = locId;
        st.players[myTabId].voteLabel = locObj.icon + ' ' + locObj.shortName;
        st.players[myTabId].voteRound = st.voteRound || 1;
        st.players[myTabId].voteUpdatedAt = Date.now();
        st.players[myTabId].lastSeen = Date.now();
      }
      window.MishlandSync.addLog(
        st,
        '🗳️ ' +
          (me ? me.emoji + ' ' + me.name : 'Игрок') +
          ' голосует за локацию «' +
          locObj.name +
          '»!'
      );
    });

    window.Mishland3D.setCameraMode('location', locId);

    // If Misha (decision maker) clicks a 3D location and either is playing solo or clicked it to confirm:
    if (isDecisionMaker && (activePlayers.length <= 1 || myCurrentVote === locId)) {
      travelToLocation(locId);
    }
  }

  function travelToLocation(locId) {
    const locObj = window.MishlandData.locations.find(function (l) {
      return l.id === locId;
    });
    if (!locObj) return;

    playSound('physics');

    // On mobile, automatically show the story panel when entering a location
    document.body.classList.remove('mobile-show-players', 'mobile-map-only');
    const btnPlayers = document.getElementById('btn-mobile-players');
    const btnStory = document.getElementById('btn-mobile-story');
    const btnMapOnly = document.getElementById('btn-mobile-maponly');
    if (btnPlayers) btnPlayers.classList.remove('active');
    if (btnMapOnly) btnMapOnly.classList.remove('active');
    if (btnStory) btnStory.classList.add('active');

    window.MishlandSync.updateState(function (st) {
      st.currentLocationId = locId;
      st.locBranch = null;
      st.revealedLetters = [];
      st.bonusHintText = '';
      st.suggestions = [];
      st.lastFeedback = null;
      clearVotes(st);

      // SPECIAL BONUS LOCATIONS WITHOUT QUESTIONS (Bar, Banya, Manik & Pedik)
      if (locObj.specialType) {
        st.phase = 'LOC_SPECIAL';
        if (!st.completedLocations) st.completedLocations = [];
        if (st.completedLocations.indexOf(locId) === -1) {
          st.completedLocations.push(locId);
        }
        if (window.MishlandSync.lightLocationCandle) {
          window.MishlandSync.lightLocationCandle(st, locId, 1);
        }

        if (locObj.specialType === 'BAR_NO_QUIZ') {
          const res = window.MishlandSync.awardBonusToAllPlayers(st, locObj.bonusPoints || 100);
          st.lastFeedback = {
            type: 'success',
            text:
              '🍺 Бармен без единого вопроса налил ВСЕМ по пенной кружке! Каждому игроку начислено +' +
              (locObj.bonusPoints || 100) +
              ' очков (всего +' +
              res.totalAdded +
              ' в копилку команды)! Зажжена свеча локации (1 из 1): ' +
              locObj.candleName +
              '!'
          };
          window.MishlandSync.addLog(
            st,
            '🍺 В Баре «Пенная Кружка» всем налили пенного и начислили по +' +
              (locObj.bonusPoints || 100) +
              ' баллов без вопросов!'
          );
        } else if (locObj.specialType === 'BANYA_NO_QUIZ') {
          const res = window.MishlandSync.awardBonusToAllPlayers(st, locObj.bonusPoints || 100);
          st.lastFeedback = {
            type: 'success',
            text:
              '🧖‍♂️ С лёгким паром! Банщик пропарил всех дубовыми и берёзовыми вениками без вопросов! Каждому начислено +' +
              (locObj.bonusPoints || 100) +
              ' очков (всего +' +
              res.totalAdded +
              ' команде)! Зажжена свеча локации (1 из 1): ' +
              locObj.candleName +
              '!'
          };
          window.MishlandSync.addLog(
            st,
            '🧖‍♂️ В Царской Бане «Лёгкий Пар» всем выдали банный бонус +' +
              (locObj.bonusPoints || 100) +
              ' очков без вопросов!'
          );
        } else if (locObj.specialType === 'MANIC_PEDIC_WOMEN_ONLY') {
          const res = window.MishlandSync.awardBonusToWomenOnly(st, locObj.bonusPoints || 150);
          if (res.womenCount > 0) {
            st.lastFeedback = {
              type: 'success',
              text:
                '💅 Строго по правилам салона «Маник & Педик»: баллы (+' +
                (locObj.bonusPoints || 150) +
                ' очк.) начислены ТОЛЬКО ЖЕНЩИНАМ (' +
                res.womenNames.join(', ') +
                ')! Мужчинам начислено 0 очков. Зажжена свеча локации (1 из 1): ' +
                locObj.candleName +
                '!'
            };
          } else {
            st.lastFeedback = {
              type: 'error',
              text:
                '💅 Внимание! В салоне «Маник & Педик» баллы начисляются ТОЛЬКО ЖЕНЩИНАМ! Сейчас среди игроков нет дам (мужчинам начислено 0 баллов). Вы можете переключить пол на 👩 Женский кнопкой ниже или позвать подругу!'
            };
          }
          window.MishlandSync.addLog(
            st,
            '💅 Отряд заглянул в «Маник & Педик»: бонус +' +
              (locObj.bonusPoints || 150) +
              ' очков начислен только дамам (' +
              res.womenCount +
              ' чел.), мужчинам — 0!'
          );
        }
      } else {
        st.phase = 'LOC_STEP_1';
        st.quizIndex = st.completedLocations.indexOf(locId) !== -1 ? 1 : 0;
        st.riddleVariant = st.completedLocations.indexOf(locId) !== -1 ? 1 : 0;
        window.MishlandSync.addLog(
          st,
          '🧭 Медвежонок Миша выбрал маршрут и повёл друзей в локацию: ' + locObj.icon + ' ' + locObj.name
        );
      }
    });

    window.Mishland3D.setCameraMode('location', locId);
    if (locId === 'bar') {
      window.Mishland3D.triggerBarToast();
    } else if (locId === 'banya') {
      window.Mishland3D.triggerBanyaSteam();
    } else if (locId === 'zenit') {
      window.Mishland3D.kickSoccerBall();
    } else {
      window.Mishland3D.triggerPhysicalImpulse(locId);
    }
  }

  function clearVotes(st) {
    st.voteRound = (st.voteRound || 1) + 1;
    if (!st.players) return;
    Object.keys(st.players).forEach(function (tid) {
      st.players[tid].voteChoiceId = null;
      st.players[tid].voteLabel = null;
      st.players[tid].voteRound = st.voteRound;
      st.players[tid].pingLocationId = null;
    });
  }

  function onStateUpdated(state) {
    if (!state) return;

    const completedCount = (state.completedLocations || []).length;
    if (completedCount > lastCompletedCount) {
      playSound('success');
      window.Mishland3D.triggerConfettiExplosion();
    }
    lastCompletedCount = completedCount;

    window.Mishland3D.syncWithGameState(state);
    renderTopBar(state);
    renderLeftDock(state);

    if (state.version !== lastRenderedVersion) {
      lastRenderedVersion = state.version;
      renderRightStoryDock(state);
    }
    renderBottomEventBar(state);
  }

  function renderTopBar(state) {
    const scoreEl = document.getElementById('hud-team-score');
    if (scoreEl) scoreEl.textContent = state.teamScore || 0;

    const totalCandlesEl = document.getElementById('hud-total-candles-text');
    if (totalCandlesEl && window.MishlandSync.getTotalCandleStats) {
      const tot = window.MishlandSync.getTotalCandleStats(state);
      totalCandlesEl.textContent = tot.lit + '/' + tot.total;
    }

    const candleTrack = document.getElementById('hud-candle-track');
    if (candleTrack) {
      const completed = state.completedLocations || [];
      candleTrack.innerHTML = window.MishlandData.locations
        .map(function (loc) {
          const isLit = completed.indexOf(loc.id) !== -1;
          const cStats = window.MishlandSync.getLocationCandleStats
            ? window.MishlandSync.getLocationCandleStats(loc.id, state)
            : { lit: isLit ? 1 : 0, total: loc.totalCandles || 3 };
          return (
            '<div class="candle-slot ' +
            (isLit ? 'lit' : cStats.lit > 0 ? 'partial' : '') +
            '" title="' +
            loc.name +
            ' — Свечей зажжено: ' +
            cStats.lit +
            ' из ' +
            cStats.total +
            '">' +
            (isLit ? '🕯️' : loc.icon) +
            '</div>'
          );
        })
        .join('');
    }

    const tabsCountEl = document.getElementById('hud-tabs-count');
    const netDot = document.getElementById('hud-net-dot');
    if (tabsCountEl) {
      const active = window.MishlandSync.getActivePlayers();
      const isOnline = window.MishlandSync.isOnlineConnected && window.MishlandSync.isOnlineConnected();
      const roomCode = window.MishlandSync.getRoomCode ? window.MishlandSync.getRoomCode() : 'MISHA';
      if (netDot) {
        netDot.style.background = isOnline ? '#10b981' : '#fbbf24';
      }
      tabsCountEl.textContent = roomCode + ' • ' + Math.max(1, active.length) + ' игр.';
    }
  }

  function renderLeftDock(state) {
    const playersContainer = document.getElementById('hud-players-list');
    const activePlayers = window.MishlandSync.getActivePlayers();
    const myTabId = window.MishlandSync.getTabId();
    const currentRound = (state && state.voteRound) || 1;

    if (playersContainer) {
      if (activePlayers.length === 0) {
        playersContainer.innerHTML =
          '<div style="font-size:14px;color:#cbd5e1;">Выберите героя в лобби</div>';
      } else {
        playersContainer.innerHTML = activePlayers
          .map(function (p) {
            const isMe = p.tabId === myTabId;
            const gIcon = p.gender === 'female' ? '👩' : '👨';
            const hasVoted = !!(p.voteChoiceId && (p.voteRound || 1) === currentRound);
            const voteBadgeHtml = hasVoted
              ? '<div style="margin-top:4px;font-size:13px;color:#34d399;font-weight:800;">🗳️ ' +
                (p.voteLabel || p.voteChoiceId) +
                '</div>'
              : '<div style="margin-top:4px;font-size:12.5px;color:#94a3b8;">⏳ Голосует...</div>';
            return (
              '<div class="player-item ' +
              (isMe ? 'is-me ' : '') +
              (p.isHost ? 'is-host ' : '') +
              '">' +
              '<div class="player-info">' +
              '<div class="player-avatar">' +
              p.emoji +
              '</div>' +
              '<div style="min-width:0;">' +
              '<div class="player-name">' +
              (p.isHost ? '👑 ' : '') +
              p.name +
              ' ' +
              gIcon +
              (isMe ? ' (Вы)' : '') +
              '</div>' +
              voteBadgeHtml +
              '</div>' +
              '</div>' +
              '<div class="player-score-badge">⭐ ' +
              (p.score || 0) +
              '</div>' +
              '</div>'
            );
          })
          .join('');
      }
    }
  }

  function getVotesByChoice(state) {
    const map = {};
    if (!state || !state.players) return map;
    const currentRound = state.voteRound || 1;
    const activePlayers = window.MishlandSync.getActivePlayers();
    activePlayers.forEach(function (p) {
      if (p.voteChoiceId && (p.voteRound || 1) === currentRound) {
        const key = String(p.voteChoiceId);
        if (!map[key]) map[key] = [];
        map[key].push({
          tabId: p.tabId,
          name: p.name,
          emoji: p.emoji,
          isHost: !!p.isHost,
          label: p.voteLabel || key
        });
      }
    });
    return map;
  }

  function renderVotingStatusBoard(state) {
    const activePlayers = window.MishlandSync.getActivePlayers();
    const currentRound = (state && state.voteRound) || 1;
    const isDecisionMaker = canMakeFinalChoice(state);

    const friends = activePlayers.filter(function (p) {
      return !p.isHost;
    });
    const votedFriends = friends.filter(function (p) {
      return !!(p.voteChoiceId && (p.voteRound || 1) === currentRound);
    });
    const votedAll = activePlayers.filter(function (p) {
      return !!(p.voteChoiceId && (p.voteRound || 1) === currentRound);
    });

    const allFriendsVoted = friends.length > 0 && votedFriends.length >= friends.length;

    const playersChipsHtml = activePlayers
      .map(function (p) {
        const hasVoted = !!(p.voteChoiceId && (p.voteRound || 1) === currentRound);
        if (hasVoted) {
          return (
            '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,0.24);border:1.5px solid rgba(52,211,153,0.7);color:#fff;padding:5px 11px;border-radius:999px;font-size:13.5px;font-weight:800;">' +
            '<span>' +
            p.emoji +
            ' ' +
            p.name +
            (p.isHost ? ' 👑' : '') +
            ':</span>' +
            '<span style="color:#fde047;">' +
            (p.voteLabel || p.voteChoiceId) +
            '</span>' +
            '</div>'
          );
        } else {
          return (
            '<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(30,41,59,0.85);border:1px dashed rgba(148,163,184,0.5);color:#cbd5e1;padding:5px 11px;border-radius:999px;font-size:13px;">' +
            '<span>' +
            p.emoji +
            ' ' +
            p.name +
            ': ⏳</span>' +
            '</div>'
          );
        }
      })
      .join('');

    const statusLabel = allFriendsVoted
      ? isDecisionMaker
        ? '✅ Все проголосовали • 👑 Выбор за Мишей!'
        : '✅ Все проголосовали • Ждём Мишу 👑'
      : isDecisionMaker
      ? '👑 Вы видите голоса и выбираете последним'
      : '🗳️ Нажмите на вариант, чтобы проголосовать';

    return (
      '<div style="background:rgba(15,23,42,0.88);border:1.5px solid ' +
      (allFriendsVoted ? 'rgba(52,211,153,0.75)' : 'rgba(56,189,248,0.55)') +
      ';border-radius:14px;padding:10px 13px;display:flex;flex-direction:column;gap:8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<span style="font-size:13.5px;font-weight:800;color:#38bdf8;">🗳️ Голоса (' +
      votedAll.length +
      '/' +
      Math.max(1, activePlayers.length) +
      ')</span>' +
      '<span style="font-size:13px;font-weight:800;color:' +
      (allFriendsVoted ? '#34d399' : '#fde047') +
      ';">' +
      statusLabel +
      '</span>' +
      '</div>' +
      (playersChipsHtml
        ? '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + playersChipsHtml + '</div>'
        : '') +
      '</div>'
    );
  }

  /**
   * Renders interactive choices where ALL players can vote by tapping the card,
   * Misha sees who voted for what, and Misha makes the final choice last.
   * items: Array of { id, shortLabel, titleHtml, subHtml }
   */
  function renderVotableChoicesList(state, items, isCompactGrid) {
    const votesMap = getVotesByChoice(state);
    const me = window.MishlandSync.getMyPlayer();
    const myTabId = window.MishlandSync.getTabId();
    const currentRound = (state && state.voteRound) || 1;
    const myVoteId =
      me && (me.voteRound || 1) === currentRound && me.voteChoiceId
        ? String(me.voteChoiceId)
        : null;
    const isDecisionMaker = canMakeFinalChoice(state);

    let maxVotes = 0;
    Object.keys(votesMap).forEach(function (k) {
      if (votesMap[k].length > maxVotes) {
        maxVotes = votesMap[k].length;
      }
    });

    const cardsHtml = items
      .map(function (item) {
        const cid = String(item.id);
        const voters = votesMap[cid] || [];
        const isMyVote = myVoteId === cid;
        const isLeader = maxVotes > 0 && voters.length === maxVotes;

        const votersBadges = voters
          .map(function (v) {
            return (
              '<span class="vote-chip" style="' +
              (v.tabId === myTabId
                ? 'background:rgba(16,185,129,0.35);border-color:#34d399;color:#fff;'
                : '') +
              '">' +
              v.emoji +
              ' ' +
              v.name +
              (v.isHost ? ' 👑' : '') +
              '</span>'
            );
          })
          .join('');

        return (
          '<div class="choice-btn ' +
          (isMyVote ? 'voted ' : '') +
          (isLeader ? 'leader ' : '') +
          '" data-cast-vote-id="' +
          cid +
          '" data-cast-vote-label="' +
          String(item.shortLabel || cid).replace(/"/g, '&quot;') +
          '" style="display:flex;flex-direction:column;gap:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
          '<div style="flex:1;">' +
          item.titleHtml +
          '</div>' +
          (isDecisionMaker
            ? '<button type="button" class="btn-primary" data-final-confirm-id="' +
              cid +
              '" style="padding:8px 14px;font-size:13.5px;flex-shrink:0;">' +
              '👑 Выбрать' +
              '</button>'
            : '<span style="font-size:13px;font-weight:800;padding:4px 10px;border-radius:999px;flex-shrink:0;background:' +
              (isMyVote ? 'rgba(16,185,129,0.3);color:#a7f3d0;' : 'rgba(255,255,255,0.1);color:#e2e8f0;') +
              '">' +
              (isMyVote ? '✅ Голос' : '🗳️') +
              '</span>') +
          '</div>' +
          (voters.length > 0
            ? '<div class="choice-votes">' + votersBadges + '</div>'
            : '') +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="' +
      (isCompactGrid ? 'map-choices-grid' : 'choice-list') +
      '">' +
      cardsHtml +
      '</div>'
    );
  }

  function bindVotableChoicesEvents(container, onFinalConfirm) {
    container.querySelectorAll('[data-cast-vote-id]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const cid = el.getAttribute('data-cast-vote-id');
        const label = el.getAttribute('data-cast-vote-label') || cid;
        playSound('click');
        if (window.MishlandSync.castVote) {
          window.MishlandSync.castVote(cid, label);
        }
      });
    });

    container.querySelectorAll('[data-final-confirm-id]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const cid = btn.getAttribute('data-final-confirm-id');
        onFinalConfirm(cid);
      });
    });
  }

  function awardPoints(st, points) {
    const myTabId = window.MishlandSync.getTabId();
    st.teamScore = (st.teamScore || 0) + points;
    if (st.players && st.players[myTabId]) {
      st.players[myTabId].score = (st.players[myTabId].score || 0) + points;
    }
  }

  function renderLocationCandleBar(loc, state) {
    if (!loc) return '';
    const cStats = window.MishlandSync.getLocationCandleStats
      ? window.MishlandSync.getLocationCandleStats(loc.id, state)
      : { lit: 0, total: loc.totalCandles || 3 };
    let iconsHtml = '';
    for (let i = 0; i < cStats.total; i++) {
      const isLit = i < cStats.lit;
      iconsHtml +=
        '<span style="font-size:18px;filter:' +
        (isLit ? 'drop-shadow(0 0 8px #fbbf24)' : 'grayscale(1) opacity(0.4)') +
        ';">🕯️</span>';
    }
    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(15,23,42,0.85);border:1.5px solid rgba(251,191,36,0.55);border-radius:12px;padding:8px 13px;font-size:14px;">' +
      '<span>🕯️ <strong>' +
      loc.shortName +
      ':</strong> <strong style="color:#fde047;">' +
      cStats.lit +
      ' из ' +
      cStats.total +
      '</strong></span>' +
      '<span style="display:flex;gap:5px;align-items:center;">' +
      iconsHtml +
      '</span>' +
      '</div>'
    );
  }

  function renderGoalBanner() {
    return '';
  }

  function play1963Melody() {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const melody = [
        { f: 523.25, t: 0.0, d: 0.16 },
        { f: 659.25, t: 0.17, d: 0.16 },
        { f: 783.99, t: 0.34, d: 0.16 },
        { f: 1046.5, t: 0.51, d: 0.28 },
        { f: 880.0, t: 0.82, d: 0.16 },
        { f: 783.99, t: 0.99, d: 0.16 },
        { f: 659.25, t: 1.16, d: 0.18 },
        { f: 1046.5, t: 1.36, d: 0.36 }
      ];
      melody.forEach(function (n) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(n.f, now + n.t);
        g.gain.setValueAtTime(0.16, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
        o.start(now + n.t);
        o.stop(now + n.t + n.d + 0.02);
      });
    } catch (e) {}
  }

  function renderZenitKickButton(loc) {
    if (!loc) return '';
    if (loc.id === 'zenit') {
      return (
        '<button class="btn-secondary" id="btn-zenit-kick-ball" style="width:100%;border-color:#38bdf8;color:#e0f2fe;font-weight:800;">' +
        '⚽ Удар по 3D-мячу на поле!' +
        '</button>'
      );
    }
    if (loc.id === 'music') {
      return (
        '<button class="btn-secondary" id="btn-music-play-1963" style="width:100%;border-color:#a78bfa;color:#ede9fe;font-weight:800;">' +
        '🎹 Включить ретро-мелодию!' +
        '</button>'
      );
    }
    return '';
  }

  function bindZenitKickButton() {
    const kickBtn = document.getElementById('btn-zenit-kick-ball');
    if (kickBtn) {
      kickBtn.addEventListener('click', function () {
        playSound('physics');
        window.Mishland3D.kickSoccerBall();
      });
    }
    const musBtn = document.getElementById('btn-music-play-1963');
    if (musBtn) {
      musBtn.addEventListener('click', function () {
        play1963Melody();
        window.Mishland3D.triggerPhysicalImpulse('music');
      });
    }
  }

  function renderRightStoryDock(state) {
    const container = document.getElementById('hud-story-content');
    if (!container) return;

    const me = window.MishlandSync.getMyPlayer();

    // PHASE 1: PROLOGUE STEP 1
    if (state.phase === 'PROLOGUE_1') {
      const p1 = window.MishlandData.prologue.step1;
      const choiceItems = p1.choices.map(function (c, idx) {
        return {
          id: c.id,
          shortLabel: 'Вариант ' + (idx + 1),
          titleHtml:
            '<div>' +
            c.text +
            ' <span style="color:#fde047;font-weight:800;">+' +
            c.points +
            '</span></div>'
        };
      });

      container.innerHTML =
        '<div class="phase-header">' +
        '<span class="phase-badge">🎬 Старт</span>' +
        '<span class="category-badge">🎂 День Рождения</span>' +
        '</div>' +
        '<div class="scene-title">' +
        window.MishlandData.prologue.title +
        '</div>' +
        '<div class="scene-narrative">' +
        p1.description +
        '</div>' +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, choiceItems);

      bindVotableChoicesEvents(container, function (cid) {
        const choiceObj = p1.choices.find(function (x) {
          return x.id === cid;
        });
        if (!choiceObj) return;
        playSound('click');
        window.MishlandSync.updateState(function (st) {
          st.prologueBranch = choiceObj.nextBranch;
          st.phase = 'PROLOGUE_2';
          awardPoints(st, choiceObj.points);
          clearVotes(st);
          window.MishlandSync.addLog(
            st,
            '👑 Миша утвердил выбор команды: ' + choiceObj.text
          );
        });
      });
      return;
    }

    // PHASE 2: PROLOGUE STEP 2
    if (state.phase === 'PROLOGUE_2') {
      const branchKey = state.prologueBranch || 'branch_compass';
      const p2 =
        window.MishlandData.prologue.step2[branchKey] ||
        window.MishlandData.prologue.step2.branch_compass;

      const choiceItems = p2.choices.map(function (c, idx) {
        return {
          id: c.id,
          shortLabel: 'Снаряжение ' + (idx + 1),
          titleHtml:
            '<div>' +
            c.text +
            ' <span style="color:#fde047;font-weight:800;">+' +
            c.points +
            '</span></div>'
        };
      });

      container.innerHTML =
        '<div class="phase-header">' +
        '<span class="phase-badge">🎒 Снаряжение</span>' +
        '<span class="category-badge">🗺️ Выход на карту</span>' +
        '</div>' +
        '<div class="scene-title">Подготовка экспедиции</div>' +
        '<div class="scene-narrative">' +
        p2.description +
        '</div>' +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, choiceItems);

      bindVotableChoicesEvents(container, function (cid) {
        const choiceObj = p2.choices.find(function (x) {
          return x.id === cid;
        });
        if (!choiceObj) return;
        playSound('success');
        window.MishlandSync.updateState(function (st) {
          st.phase = 'MAP';
          awardPoints(st, choiceObj.points);
          clearVotes(st);
          window.MishlandSync.addLog(st, '👑 Миша утвердил снаряжение: ' + choiceObj.outcomeText);
        });
        window.Mishland3D.setCameraMode('overview');
      });
      return;
    }

    // PHASE 3: MAP SELECTION (All players vote for next location, Misha chooses last)
    if (state.phase === 'MAP' || !state.currentLocationId) {
      const completed = state.completedLocations || [];
      const totalLocs = window.MishlandData.locations.length;
      const mapChoiceItems = window.MishlandData.locations.map(function (loc) {
        const isDone = completed.indexOf(loc.id) !== -1;
        const cStats = window.MishlandSync.getLocationCandleStats
          ? window.MishlandSync.getLocationCandleStats(loc.id, state)
          : { lit: isDone ? 1 : 0, total: loc.totalCandles || 3 };
        return {
          id: loc.id,
          shortLabel: loc.icon + ' ' + loc.shortName,
          titleHtml:
            '<div>' +
            '<div style="font-weight:800;font-size:15px;">' +
            loc.icon +
            ' ' +
            loc.shortName +
            '</div>' +
            '<div style="font-size:13px;font-weight:800;margin-top:2px;color:' +
            (isDone ? '#34d399' : '#fde047') +
            ';">🕯️ ' +
            cStats.lit +
            ' / ' +
            cStats.total +
            (isDone ? ' ✅' : '') +
            '</div>' +
            '</div>'
        };
      });

      container.innerHTML =
        '<div class="phase-header">' +
        '<span class="phase-badge">🗺️ 3D-Карта</span>' +
        '<span class="category-badge">Локаций: ' +
        completed.length +
        ' / ' +
        totalLocs +
        '</span>' +
        '</div>' +
        '<div class="scene-title">Куда отправится отряд?</div>' +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, mapChoiceItems, true);

      bindVotableChoicesEvents(container, function (locId) {
        travelToLocation(locId);
      });
      return;
    }

    const loc = window.MishlandData.locations.find(function (l) {
      return l.id === state.currentLocationId;
    });
    if (!loc) return;

    // SPECIAL PHASE: BAR, BANYA, MANIC & PEDIC (NO QUIZ QUESTIONS!)
    if (state.phase === 'LOC_SPECIAL' || loc.specialType) {
      const completed = state.completedLocations || [];
      const totalLocs = window.MishlandData.locations.length;
      const allCandlesReady = completed.length >= totalLocs;
      const activePlayers = window.MishlandSync.getActivePlayers();

      let extraActionHtml = '';
      if (loc.specialType === 'BAR_NO_QUIZ') {
        extraActionHtml =
          '<button class="btn-primary" id="btn-bar-extra-round">🍻 Налить ещё всем (+50 очков)</button>';
      } else if (loc.specialType === 'BANYA_NO_QUIZ') {
        extraActionHtml =
          '<button class="btn-primary" id="btn-banya-extra-steam">🌿 Поддать парку всем (+50 очков)</button>';
      } else if (loc.specialType === 'MANIC_PEDIC_WOMEN_ONLY') {
        const myGender = me ? me.gender : 'male';
        extraActionHtml =
          '<button class="btn-primary" id="btn-beauty-extra-women">💅 Ещё +100 баллов дамам</button>' +
          '<button class="btn-secondary" id="btn-toggle-my-gender">' +
          (myGender === 'female'
            ? '👩 Пол: Дама (сменить на 👨)'
            : '👨 Пол: Мужчина (сменить на 👩 Даму для бонуса)') +
          '</button>';
      }

      const playersSummaryHtml =
        '<div class="puzzle-box">' +
        '<div style="font-size:14px;font-weight:800;color:#fde047;">👥 Бонусы игрокам:</div>' +
        activePlayers
          .map(function (p) {
            const isWoman = p.gender === 'female';
            const badge =
              loc.specialType === 'MANIC_PEDIC_WOMEN_ONLY'
                ? isWoman
                  ? '<span style="color:#34d399;font-weight:800;">👩 +Бонус!</span>'
                  : '<span style="color:#f87171;font-weight:700;">👨 0 очк.</span>'
                : '<span style="color:#34d399;font-weight:800;">✅ +Бонус!</span>';
            return (
              '<div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">' +
              '<span>' +
              p.emoji +
              ' <strong>' +
              p.name +
              '</strong></span>' +
              badge +
              '</div>'
            );
          })
          .join('') +
        '</div>';

      container.innerHTML =
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">' +
        loc.icon +
        ' Бонус</span>' +
        '<span class="category-badge">🕯️ ' +
        loc.candleName +
        '</span>' +
        '</div>' +
        '<div class="scene-title">' +
        loc.specialTitle +
        '</div>' +
        (state.lastFeedback
          ? '<div class="feedback-banner ' +
            state.lastFeedback.type +
            '">' +
            state.lastFeedback.text +
            '</div>'
          : '') +
        '<div class="scene-narrative">' +
        loc.specialDescription +
        '</div>' +
        playersSummaryHtml +
        '<div class="choice-list">' +
        extraActionHtml +
        (allCandlesReady
          ? '<button class="btn-primary" id="btn-goto-finale">🎂 Зажечь Торт и загадать желание!</button>'
          : '<button class="btn-secondary" id="btn-special-back-map">🗺️ На 3D-карту</button>') +
        '</div>';

      const barBtn = document.getElementById('btn-bar-extra-round');
      if (barBtn) {
        barBtn.addEventListener('click', function () {
          playSound('success');
          window.Mishland3D.triggerBarToast();
          window.MishlandSync.updateState(function (st) {
            const res = window.MishlandSync.awardBonusToAllPlayers(st, 50);
            st.lastFeedback = {
              type: 'success',
              text:
                '🍻 Дзынь! Кружки с пенным чокнулись! Каждому игроку без вопросов начислено ещё +50 очков (всего +' +
                res.totalAdded +
                ' команде)!'
            };
            window.MishlandSync.addLog(
              st,
              '🍻 В Баре «Пенная Кружка» повторили тост за Мишу: всем ещё по +50 баллов без вопросов!'
            );
          });
        });
      }

      const banyaBtn = document.getElementById('btn-banya-extra-steam');
      if (banyaBtn) {
        banyaBtn.addEventListener('click', function () {
          playSound('success');
          window.Mishland3D.triggerBanyaSteam();
          window.MishlandSync.updateState(function (st) {
            const res = window.MishlandSync.awardBonusToAllPlayers(st, 50);
            st.lastFeedback = {
              type: 'success',
              text:
                '🧖‍♂️ Ух, горячо! Клубы пара взмыли вверх, а всем игрокам без вопросов начислено ещё по +50 очков (всего +' +
                res.totalAdded +
                ' команде)!'
            };
            window.MishlandSync.addLog(
              st,
              '🌿 В Царской Бане поддали парку: всем игрокам ещё по +50 баллов без вопросов!'
            );
          });
        });
      }

      const beautyBtn = document.getElementById('btn-beauty-extra-women');
      if (beautyBtn) {
        beautyBtn.addEventListener('click', function () {
          playSound('success');
          window.Mishland3D.triggerPhysicalImpulse('beauty');
          window.MishlandSync.updateState(function (st) {
            const res = window.MishlandSync.awardBonusToWomenOnly(st, 100);
            if (res.womenCount > 0) {
              st.lastFeedback = {
                type: 'success',
                text:
                  '💅 Блеск и красота! Ещё +100 баллов начислено ТОЛЬКО ЖЕНЩИНАМ (' +
                  res.womenNames.join(', ') +
                  ')! Мужчинам — 0 баллов!'
              };
            } else {
              st.lastFeedback = {
                type: 'error',
                text:
                  '💅 В салоне «Маник & Педик» баллы начисляются ТОЛЬКО ЖЕНЩИНАМ! Мужчинам начислено 0 баллов.'
              };
            }
          });
        });
      }

      const toggleGenderBtn = document.getElementById('btn-toggle-my-gender');
      if (toggleGenderBtn) {
        toggleGenderBtn.addEventListener('click', function () {
          playSound('click');
          const myTabId = window.MishlandSync.getTabId();
          window.MishlandSync.updateState(function (st) {
            if (st.players && st.players[myTabId]) {
              const p = st.players[myTabId];
              p.gender = p.gender === 'female' ? 'male' : 'female';
              if (p.gender === 'female') {
                p.score = (p.score || 0) + 150;
                st.teamScore = (st.teamScore || 0) + 150;
                st.lastFeedback = {
                  type: 'success',
                  text:
                    '👩 Вы переключили пол на Женский (Дама) и сразу получили +150 бонусных баллов от салона «Маник & Педик»!'
                };
              } else {
                st.lastFeedback = {
                  type: 'error',
                  text:
                    '👨 Вы переключили пол на Мужской (Джентльмен) — в салоне «Маник & Педик» мужчинам начисляется 0 баллов!'
                };
              }
            }
          });
        });
      }

      const backMapBtn = document.getElementById('btn-special-back-map');
      if (backMapBtn) {
        backMapBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            clearVotes(st);
            st.phase = 'MAP';
          });
          window.Mishland3D.setCameraMode('overview');
        });
      }

      const finaleBtn = document.getElementById('btn-goto-finale');
      if (finaleBtn) {
        finaleBtn.addEventListener('click', function () {
          playSound('success');
          window.MishlandSync.updateState(function (st) {
            clearVotes(st);
            st.phase = 'FINALE';
          });
        });
      }
      return;
    }

    // PHASE 4: LOCATION STEP 1 (All players vote, Misha chooses last)
    if (state.phase === 'LOC_STEP_1') {
      const choiceItems = loc.step1.choices.map(function (c, idx) {
        return {
          id: c.id,
          shortLabel: 'Шаг ' + (idx + 1),
          titleHtml:
            '<div>' +
            c.text +
            ' <span style="color:#fde047;font-weight:800;">+' +
            c.points +
            '</span></div>'
        };
      });

      container.innerHTML =
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">' +
        loc.icon +
        ' Шаг 1</span>' +
        '<span class="category-badge">' +
        loc.categoryName +
        '</span>' +
        '</div>' +
        '<div class="scene-title">' +
        loc.name +
        '</div>' +
        '<div class="scene-narrative">' +
        loc.step1.description +
        '</div>' +
        renderZenitKickButton(loc) +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, choiceItems);

      bindZenitKickButton();

      bindVotableChoicesEvents(container, function (cid) {
        const choiceObj = loc.step1.choices.find(function (x) {
          return x.id === cid;
        });
        if (!choiceObj) return;
        playSound('click');
        window.MishlandSync.updateState(function (st) {
          st.locBranch = choiceObj.nextBranch;
          st.phase = 'LOC_STEP_2';
          awardPoints(st, choiceObj.points);
          clearVotes(st);
          window.MishlandSync.addLog(
            st,
            '👑 Миша утвердил решение в «' + loc.shortName + '»: ' + choiceObj.text
          );
        });
      });
      return;
    }

    // PHASE 5: LOCATION STEP 2 (All players vote, Misha chooses last)
    if (state.phase === 'LOC_STEP_2') {
      const branchKey = state.locBranch || Object.keys(loc.step2)[0];
      const step2Data = loc.step2[branchKey] || Object.values(loc.step2)[0];

      const choiceItems = step2Data.choices.map(function (c, idx) {
        return {
          id: c.id,
          shortLabel: 'Действие ' + (idx + 1),
          titleHtml:
            '<div>' +
            c.text +
            ' <span style="color:#fde047;font-weight:800;">+' +
            c.points +
            '</span></div>'
        };
      });

      container.innerHTML =
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">' +
        loc.icon +
        ' Шаг 2 • Свеча №1</span>' +
        '<span class="category-badge">' +
        loc.categoryName +
        '</span>' +
        '</div>' +
        '<div class="scene-title">' +
        loc.shortName +
        '</div>' +
        '<div class="scene-narrative">' +
        step2Data.description +
        '</div>' +
        renderZenitKickButton(loc) +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, choiceItems);

      bindZenitKickButton();

      bindVotableChoicesEvents(container, function (cid) {
        const choiceObj = step2Data.choices.find(function (x) {
          return x.id === cid;
        });
        if (!choiceObj) return;
        playSound('success');
        window.MishlandSync.updateState(function (st) {
          st.bonusHintText = choiceObj.bonusHint || '';
          st.phase = 'LOC_QUIZ';
          st.lastFeedback = null;
          awardPoints(st, choiceObj.points);
          clearVotes(st);
          if (window.MishlandSync.lightLocationCandle) {
            window.MishlandSync.lightLocationCandle(st, loc.id, 1);
          }
          window.MishlandSync.addLog(
            st,
            '🕯️ Зажжена 1-я свеча локации «' + loc.shortName + '»!'
          );
        });
      });
      return;
    }

    // PHASE 6: CATEGORY QUIZ QUESTION (4 OPTIONS — All players vote A/B/V/G, Misha sees votes & chooses last!)
    if (state.phase === 'LOC_QUIZ') {
      const qIdx = (state.quizIndex || 0) % loc.quiz.length;
      const quizObj = loc.quiz[qIdx];
      const letters = ['А', 'Б', 'В', 'Г'];

      const quizChoiceItems = quizObj.options.map(function (opt, idx) {
        const letter = letters[idx] || String(idx + 1);
        return {
          id: String(idx),
          shortLabel: letter + '. ' + opt,
          titleHtml: '<strong>' + letter + '.</strong> ' + opt
        };
      });

      container.innerHTML =
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">❓ Вопрос ' +
        (qIdx + 1) +
        '/' +
        loc.quiz.length +
        ' • Свеча №2</span>' +
        '<span class="category-badge">🏆 +50 очк.</span>' +
        '</div>' +
        '<div class="scene-title">' +
        loc.shortName +
        '</div>' +
        '<div class="scene-narrative">' +
        quizObj.question +
        '</div>' +
        renderZenitKickButton(loc) +
        (state.lastFeedback
          ? '<div class="feedback-banner ' +
            state.lastFeedback.type +
            '">' +
            state.lastFeedback.text +
            '</div>'
          : '') +
        renderVotingStatusBoard(state) +
        renderVotableChoicesList(state, quizChoiceItems) +
        (loc.quiz.length > 1
          ? '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            '<button class="btn-secondary" id="btn-next-quiz-q" style="flex:1;">🔄 Другой вопрос</button>' +
            '<button class="btn-secondary" id="btn-skip-to-riddle">К шифру →</button>' +
            '</div>'
          : '');

      bindZenitKickButton();

      const nextQBtn = document.getElementById('btn-next-quiz-q');
      if (nextQBtn) {
        nextQBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            st.quizIndex = ((st.quizIndex || 0) + 1) % loc.quiz.length;
            st.lastFeedback = null;
            clearVotes(st);
          });
        });
      }

      const skipRiddleBtn = document.getElementById('btn-skip-to-riddle');
      if (skipRiddleBtn) {
        skipRiddleBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            st.phase = 'LOC_RIDDLE';
            st.lastFeedback = null;
            clearVotes(st);
          });
        });
      }

      bindVotableChoicesEvents(container, function (cid) {
        const idx = parseInt(cid, 10);
        if (idx === quizObj.correctIndex) {
          playSound('success');
          window.Mishland3D.triggerPhysicalImpulse(loc.id);
          window.MishlandSync.updateState(function (st) {
            awardPoints(st, 50);
            clearVotes(st);
            if (window.MishlandSync.lightLocationCandle) {
              window.MishlandSync.lightLocationCandle(st, loc.id, 2);
            }
            st.phase = 'LOC_RIDDLE';
            st.lastFeedback = {
              type: 'success',
              text: '🕯️ Зажжена 2-я свеча (+50 очков)! ' + quizObj.explanation
            };
            window.MishlandSync.addLog(
              st,
              '👑 Миша утвердил верный ответ (' +
                letters[idx] +
                ') и зажёг 2-ю свечу в «' +
                loc.shortName +
                '»!'
            );
          });
        } else {
          playSound('error');
          window.MishlandSync.updateState(function (st) {
            st.lastFeedback = {
              type: 'error',
              text: '❌ Вариант «' + letters[idx] + '» неверный! Выберите другой вариант.'
            };
          });
        }
      });
      return;
    }

    // PHASE 7: GUESS THE WORD OR NUMBER (All players can propose & vote on answers, Misha chooses last)
    if (state.phase === 'LOC_RIDDLE') {
      const rIdx = (state.riddleVariant || 0) % loc.riddles.length;
      const riddle = loc.riddles[rIdx];
      const answerStr = String(riddle.answer).toUpperCase();
      const revealed = state.revealedLetters || [];
      const isDecisionMaker = canMakeFinalChoice(state);
      const votesMap = getVotesByChoice(state);

      const cellsHtml = answerStr
        .split('')
        .map(function (ch, idx) {
          const isRev = revealed.indexOf(idx) !== -1;
          return (
            '<div class="letter-cell ' +
            (isRev ? 'revealed' : '') +
            '">' +
            (isRev ? ch : '•') +
            '</div>'
          );
        })
        .join('');

      const suggestions = state.suggestions || [];

      container.innerHTML =
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">' +
        (riddle.type === 'WORD' ? '🔤 СЛОВО • Свеча №3' : '🔢 ЧИСЛО • Свеча №3') +
        '</span>' +
        '<span class="category-badge">🏆 +100 очк.</span>' +
        '</div>' +
        '<div class="scene-title">Шифр: ' +
        loc.shortName +
        '</div>' +
        (state.lastFeedback
          ? '<div class="feedback-banner ' +
            state.lastFeedback.type +
            '">' +
            state.lastFeedback.text +
            '</div>'
          : '') +
        '<div class="scene-narrative">' +
        riddle.question +
        '</div>' +
        (state.bonusHintText
          ? '<div style="font-size:14px;color:#fde68a;background:rgba(251,191,36,0.18);padding:9px 12px;border-radius:10px;border:1px solid rgba(251,191,36,0.45);">💡 <strong>Улика:</strong> ' +
            state.bonusHintText +
            '</div>'
          : '') +
        renderVotingStatusBoard(state) +
        '<div class="puzzle-box">' +
        '<div class="puzzle-type-banner">' +
        '<span>' +
        (riddle.type === 'WORD'
          ? 'Слово (' + answerStr.length + ' букв)'
          : 'Число (' + answerStr.length + ' цифр)') +
        '</span>' +
        '<span>🕯️ Свеча №3</span>' +
        '</div>' +
        '<div class="letter-slots">' +
        cellsHtml +
        '</div>' +
        '<div class="puzzle-input-row">' +
        '<input type="text" id="riddle-answer-input" class="puzzle-input" placeholder="' +
        (riddle.type === 'WORD' ? 'Введите слово...' : 'Введите число...') +
        '" autocomplete="off" />' +
        '<button class="btn-secondary" id="btn-suggest-tab">🗳️ Голос</button>' +
        (isDecisionMaker
          ? '<button class="btn-primary" id="btn-submit-riddle">👑 Выбрать</button>'
          : '') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn-secondary" id="btn-reveal-letter" style="flex:1;">💡 Буква</button>' +
        '<button class="btn-secondary" id="btn-switch-riddle" style="flex:1;">🔄 Другая</button>' +
        '</div>' +
        (suggestions.length > 0
          ? '<div class="suggestions-box">' +
            suggestions
              .map(function (s) {
                const votersForVal = votesMap[s.value] || [];
                const voterChips = votersForVal
                  .map(function (v) {
                    return '<span class="vote-chip">' + v.emoji + ' ' + v.name + '</span>';
                  })
                  .join('');
                return (
                  '<div class="suggestion-chip" style="flex-direction:column;align-items:stretch;gap:6px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
                  '<span>' +
                  s.emoji +
                  ' <strong>' +
                  s.name +
                  ':</strong> <strong style="color:#fde047;font-size:15px;">«' +
                  s.value +
                  '»</strong></span>' +
                  '<div style="display:flex;gap:6px;">' +
                  '<button class="btn-secondary" style="padding:6px 11px;font-size:13px;" data-vote-suggestion="' +
                  s.value +
                  '">🗳️ Голос</button>' +
                  (isDecisionMaker
                    ? '<button class="btn-primary" style="padding:6px 12px;font-size:13px;" data-try-suggestion="' +
                      s.value +
                      '">👑 Выбрать</button>'
                    : '') +
                  '</div>' +
                  '</div>' +
                  (voterChips ? '<div class="choice-votes">' + voterChips + '</div>' : '') +
                  '</div>'
                );
              })
              .join('') +
            '</div>'
          : '') +
        '</div>';

      const inputEl = document.getElementById('riddle-answer-input');
      const submitBtn = document.getElementById('btn-submit-riddle');

      function checkRiddleValue(rawVal) {
        const cleaned = String(rawVal || '')
          .trim()
          .toUpperCase()
          .replace(/Ё/g, 'Е');
        const target = answerStr.replace(/Ё/g, 'Е');

        if (!cleaned) return;

        if (cleaned === target) {
          playSound('success');
          window.Mishland3D.triggerPhysicalImpulse(loc.id);
          window.MishlandSync.updateState(function (st) {
            const pts = Math.max(50, 100 - (st.revealedLetters || []).length * 15);
            awardPoints(st, pts);
            clearVotes(st);
            if (!st.completedLocations) st.completedLocations = [];
            if (st.completedLocations.indexOf(loc.id) === -1) {
              st.completedLocations.push(loc.id);
            }
            if (window.MishlandSync.lightLocationCandle) {
              window.MishlandSync.lightLocationCandle(st, loc.id, loc.totalCandles || 3);
            }
            st.lastFeedback = {
              type: 'success',
              text:
                '🎉 Ура! Загадка разгадана: «' +
                answerStr +
                '»! Все свечи локации зажжены! Вы получили ' +
                loc.candleName +
                ' (+' +
                pts +
                ' очков)!'
            };
            window.MishlandSync.addLog(
              st,
              '🕯️ 👑 Миша утвердил верный ответ «' +
                answerStr +
                '» и зажёг все свечи в локации «' +
                loc.shortName +
                '»!'
            );
            if (st.completedLocations.length >= window.MishlandData.locations.length) {
              st.teamScore += 200;
              st.phase = 'FINALE';
            } else {
              st.phase = 'LOC_VICTORY';
            }
          });
        } else {
          playSound('error');
          window.MishlandSync.updateState(function (st) {
            st.lastFeedback = {
              type: 'error',
              text: '❌ Не совсем («' + cleaned + '»). Подсказка: ' + riddle.hint
            };
          });
        }
      }

      function proposeAndVoteValue(rawVal) {
        const val = String(rawVal || '').trim().toUpperCase();
        if (!val) return;
        playSound('click');
        window.MishlandSync.updateState(function (st) {
          if (!st.suggestions) st.suggestions = [];
          const exists = st.suggestions.some(function (s) {
            return s.value === val;
          });
          if (!exists) {
            st.suggestions.unshift({
              name: me ? me.name : 'Друг',
              emoji: me ? me.emoji : '🎉',
              value: val
            });
            st.suggestions = st.suggestions.slice(0, 6);
          }
          const myTabId = window.MishlandSync.getTabId();
          if (st.players && st.players[myTabId]) {
            st.players[myTabId].voteChoiceId = val;
            st.players[myTabId].voteLabel = val;
            st.players[myTabId].voteRound = st.voteRound || 1;
            st.players[myTabId].voteUpdatedAt = Date.now();
            st.players[myTabId].lastSeen = Date.now();
          }
          awardPoints(st, 10);
          window.MishlandSync.addLog(
            st,
            '🗳️ ' +
              (me ? me.emoji + ' ' + me.name : 'Игрок') +
              ' проголосовал за версию ответа: «' +
              val +
              '»'
          );
        });
      }

      if (submitBtn && inputEl) {
        submitBtn.addEventListener('click', function () {
          checkRiddleValue(inputEl.value);
        });
      }
      if (inputEl) {
        inputEl.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') {
            if (isDecisionMaker) {
              checkRiddleValue(inputEl.value);
            } else {
              proposeAndVoteValue(inputEl.value);
            }
          }
        });
      }

      const revealBtn = document.getElementById('btn-reveal-letter');
      if (revealBtn) {
        revealBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            if (!st.revealedLetters) st.revealedLetters = [];
            for (let i = 0; i < answerStr.length; i++) {
              if (st.revealedLetters.indexOf(i) === -1) {
                st.revealedLetters.push(i);
                break;
              }
            }
            st.lastFeedback = {
              type: 'success',
              text: '💡 Подсказка Хранителя: ' + riddle.hint
            };
          });
        });
      }

      const suggestBtn = document.getElementById('btn-suggest-tab');
      if (suggestBtn && inputEl) {
        suggestBtn.addEventListener('click', function () {
          proposeAndVoteValue(inputEl.value);
          inputEl.value = '';
        });
      }

      const switchRiddleBtn = document.getElementById('btn-switch-riddle');
      if (switchRiddleBtn) {
        switchRiddleBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            st.riddleVariant = ((st.riddleVariant || 0) + 1) % loc.riddles.length;
            st.revealedLetters = [];
            st.lastFeedback = null;
            clearVotes(st);
          });
        });
      }

      container.querySelectorAll('[data-vote-suggestion]').forEach(function (b) {
        b.addEventListener('click', function () {
          proposeAndVoteValue(b.getAttribute('data-vote-suggestion'));
        });
      });

      container.querySelectorAll('[data-try-suggestion]').forEach(function (b) {
        b.addEventListener('click', function () {
          checkRiddleValue(b.getAttribute('data-try-suggestion'));
        });
      });
      return;
    }

    // PHASE 8: LOCATION VICTORY
    if (state.phase === 'LOC_VICTORY') {
      const completed = state.completedLocations || [];
      const totalLocs = window.MishlandData.locations.length;
      container.innerHTML =
        renderGoalBanner(state) +
        renderLocationCandleBar(loc, state) +
        '<div class="phase-header">' +
        '<span class="phase-badge">🕯️ Все свечи локации зажжены!</span>' +
        '<span class="category-badge">Торт: ' +
        completed.length +
        ' из ' +
        totalLocs +
        '</span>' +
        '</div>' +
        '<div class="scene-title">' +
        loc.candleName +
        ' ваша!</div>' +
        '<div class="scene-narrative">' +
        'Хранитель локации <strong>«' +
        loc.name +
        '»</strong> торжественно передаёт вам волшебную свечу! На Великом Торте в центре замка вспыхнул новый огонёк. Осталось собрать ещё <strong>' +
        (totalLocs - completed.length) +
        '</strong> свечей, чтобы исполнить цель Дня Рождения Миши!' +
        '</div>' +
        renderZenitKickButton(loc) +
        '<div class="choice-list">' +
        '<button class="btn-primary" id="btn-back-to-map">🗺️ Выбрать следующую локацию на 3D-карте</button>' +
        '<button class="btn-secondary" id="btn-replay-question">❓ Ответить на другие вопросы этой локации</button>' +
        '<button class="btn-secondary" id="btn-replay-loc">🔄 Разгадать ещё одну загадку этой локации</button>' +
        '</div>';

      bindZenitKickButton();

      const backBtn = document.getElementById('btn-back-to-map');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            clearVotes(st);
            st.phase = 'MAP';
          });
          window.Mishland3D.setCameraMode('overview');
        });
      }

      const replayQuizBtn = document.getElementById('btn-replay-question');
      if (replayQuizBtn) {
        replayQuizBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            clearVotes(st);
            st.quizIndex = ((st.quizIndex || 0) + 1) % loc.quiz.length;
            st.lastFeedback = null;
            st.phase = 'LOC_QUIZ';
          });
        });
      }

      const replayBtn = document.getElementById('btn-replay-loc');
      if (replayBtn) {
        replayBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.updateState(function (st) {
            clearVotes(st);
            st.riddleVariant = ((st.riddleVariant || 0) + 1) % loc.riddles.length;
            st.revealedLetters = [];
            st.lastFeedback = null;
            st.phase = 'LOC_RIDDLE';
          });
        });
      }
      return;
    }

    // PHASE 9: GRAND BIRTHDAY FINALE & WISH
    if (state.phase === 'FINALE') {
      const activePlayers = window.MishlandSync.getActivePlayers();
      const totalLocs = window.MishlandData.locations.length;
      container.innerHTML =
        '<div class="phase-header">' +
        '<span class="phase-badge">🎂 ЦЕЛЬ ДОСТИГНУТА!</span>' +
        '<span class="category-badge">🏆 Счёт: ' +
        (state.teamScore || 0) +
        '</span>' +
        '</div>' +
        '<div class="scene-title">С Днём Рождения, Медвежонок Миша! 🎉</div>' +
        '<div class="scene-narrative">' +
        'Главная цель достигнута! Все <strong>' +
        totalLocs +
        ' Волшебных Свечей Мишлэнда</strong> собраны и горят на вершине Великого Торта! Теперь именинник Миша может загадать своё самое заветное желание и запустить физичный праздничный салют!' +
        '</div>' +
        (state.birthdayWish
          ? '<div class="feedback-banner success">🌠 <strong>Загаданное желание Миши:</strong> «' +
            state.birthdayWish +
            '» — Да будет так!</div>'
          : '<div class="puzzle-box">' +
            '<div style="font-size:12px;font-weight:700;color:#fbbf24;">🌠 Загадайте желание Именинника:</div>' +
            '<div class="puzzle-input-row">' +
            '<input type="text" id="wish-input" class="puzzle-input" placeholder="Например: Здоровья, побед Зенита и радостных встреч с друзьями!" />' +
            '<button class="btn-primary" id="btn-save-wish">Загадать ✨</button>' +
            '</div>' +
            '</div>') +
        '<div class="puzzle-box">' +
        '<div style="font-weight:800;color:#fbbf24;font-size:13px;">🏅 Итоговый рейтинг гостей праздника:</div>' +
        activePlayers
          .sort(function (a, b) {
            return (b.score || 0) - (a.score || 0);
          })
          .map(function (p, i) {
            return (
              '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.08);">' +
              '<span>' +
              (i + 1) +
              '. ' +
              p.emoji +
              ' <strong>' +
              p.name +
              '</strong> ' +
              (p.gender === 'female' ? '👩' : '👨') +
              ' <span style="font-size:11px;color:#94a3b8;">(' +
              (p.avatarLabel || '') +
              ')</span></span>' +
              '<span style="color:#fbbf24;font-weight:800;">' +
              (p.score || 0) +
              ' очк.</span>' +
              '</div>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="choice-list">' +
        '<button class="btn-primary" id="btn-launch-fireworks">🎆 Задуть свечи и запустить Салют + Физику!</button>' +
        '<button class="btn-secondary" id="btn-play-again">🔄 Начать новое приключение</button>' +
        '</div>';

      window.Mishland3D.setCameraMode('location', 'castle');

      const wishBtn = document.getElementById('btn-save-wish');
      const wishInput = document.getElementById('wish-input');
      if (wishBtn && wishInput) {
        wishBtn.addEventListener('click', function () {
          const val = wishInput.value.trim();
          if (!val) return;
          playSound('success');
          window.MishlandSync.updateState(function (st) {
            st.birthdayWish = val;
            awardPoints(st, 100);
            window.MishlandSync.addLog(
              st,
              '🌠 Именинник Миша загадал желание и задул свечи на Великом Торте!'
            );
          });
          window.Mishland3D.triggerConfettiExplosion(new THREE.Vector3(0, 4, -2));
          window.Mishland3D.triggerPhysicalImpulse('castle');
        });
      }

      const fwBtn = document.getElementById('btn-launch-fireworks');
      if (fwBtn) {
        fwBtn.addEventListener('click', function () {
          playSound('success');
          window.Mishland3D.triggerConfettiExplosion(new THREE.Vector3(0, 4, -2));
          window.Mishland3D.triggerPhysicalImpulse('castle');
        });
      }

      const againBtn = document.getElementById('btn-play-again');
      if (againBtn) {
        againBtn.addEventListener('click', function () {
          playSound('click');
          window.MishlandSync.resetGame(true);
          window.Mishland3D.setCameraMode('overview');
        });
      }
    }
  }

  function renderBottomEventBar(state) {
    const logEl = document.getElementById('hud-latest-event');
    if (!logEl) return;
    const latest = state.eventLog && state.eventLog[0];
    logEl.textContent = latest
      ? latest.text
      : '🎂 Кликните по любой локации на 3D-карте Мишлэнда!';
  }

  window.addEventListener('DOMContentLoaded', init);
})();
