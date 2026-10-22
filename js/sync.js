/**
 * MISHLAND CROSS-DEVICE & MULTI-TAB SYNC ENGINE (v6)
 * Работает одновременно:
 * 1) Через Интернет между телефонами, планшетами и компьютерами (WebSocket MQTT Cloud Room)
 * 2) Между вкладками одного браузера (BroadcastChannel API + localStorage fallback, даже без интернета на file://)
 */
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = (urlParams.get('room') || localStorage.getItem('mishland_room_code') || 'MISHA')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9_-]/g, '') || 'MISHA';

  let roomCode = initialRoom;
  try {
    localStorage.setItem('mishland_room_code', roomCode);
  } catch (e) {}

  function getStorageKey() {
    return 'mishland_shared_state_v6_' + roomCode;
  }
  function getChannelName() {
    return 'mishland_sync_channel_v6_' + roomCode;
  }

  const TAB_ID_KEY = 'mishland_tab_id_v6';
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = 'p_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    try {
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    } catch (e) {}
  }

  let channel = null;
  let mqttClient = null;
  let mqttConnected = false;
  let currentBrokerIdx = 0;

  const MQTT_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];

  function getMqttTopicState() {
    return 'mishland/v6/room/' + roomCode + '/state';
  }
  function getMqttTopicPing() {
    return 'mishland/v6/room/' + roomCode + '/ping';
  }

  function createInitialState() {
    const locCandles = {};
    if (window.MishlandData && window.MishlandData.locations) {
      window.MishlandData.locations.forEach(function (l) {
        locCandles[l.id] = 0;
      });
    }
    return {
      version: 1,
      roomCode: roomCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      phase: 'PROLOGUE_1',
      voteRound: 1,
      prologueBranch: 'branch_compass',
      currentLocationId: null,
      previousLocationId: null,
      partyPosition: { x: 0, z: 4.2 },
      locBranch: null,
      quizIndex: 0,
      riddleVariant: 0,
      revealedLetters: [],
      bonusHintText: '',
      completedLocations: [],
      locationCandles: locCandles, // { locId: number of lit candles on that location }
      specialRewardClaimed: {},
      teamScore: 0,
      birthdayWish: '',
      lastFeedback: null,
      players: {},
      suggestions: [],
      eventLog: [
        {
          id: 'init_1',
          text: '🎂 Добро пожаловать в Мишлэнд! Подключайтесь с телефонов, планшетов и компьютеров и зажигайте свечи на всех локациях!',
          time: Date.now()
        }
      ]
    };
  }

  let currentState = null;
  let lastKnownVersion = -1;
  const listeners = [];

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveToStorage(state) {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch (e) {}
  }

  function notifyListeners() {
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](currentState);
      } catch (err) {
        console.error('Listener error:', err);
      }
    }
  }

  // Merge players dictionary so simultaneous joins from different phones never overwrite each other
  function mergeIncomingState(incoming) {
    if (!incoming || typeof incoming !== 'object') return false;
    if (!currentState) {
      currentState = incoming;
      lastKnownVersion = incoming.version || 1;
      saveToStorage(currentState);
      return true;
    }

    const isNewer =
      (incoming.version || 0) > lastKnownVersion ||
      ((incoming.version || 0) === lastKnownVersion && (incoming.updatedAt || 0) > (currentState.updatedAt || 0));

    // Always merge active players from both states and detect vote changes
    let playerVotesChanged = false;
    const mergedPlayers = Object.assign({}, currentState.players || {}, incoming.players || {});
    if (currentState.players && incoming.players) {
      Object.keys(mergedPlayers).forEach(function (pid) {
        const pLocal = currentState.players[pid];
        const pRem = incoming.players[pid];
        if (pLocal && pRem) {
          const remTime = Math.max(pRem.lastSeen || 0, pRem.voteUpdatedAt || 0);
          const locTime = Math.max(pLocal.lastSeen || 0, pLocal.voteUpdatedAt || 0);
          if (
            pRem.voteChoiceId !== pLocal.voteChoiceId ||
            pRem.voteRound !== pLocal.voteRound ||
            pRem.voteLabel !== pLocal.voteLabel
          ) {
            playerVotesChanged = true;
          }
          mergedPlayers[pid] = remTime >= locTime ? pRem : pLocal;
          mergedPlayers[pid].score = Math.max(pLocal.score || 0, pRem.score || 0);
        }
      });
    }

    // Merge locationCandles max values so lit candles never unlight on race conditions
    const mergedCandles = Object.assign({}, currentState.locationCandles || {}, incoming.locationCandles || {});
    Object.keys(mergedCandles).forEach(function (lid) {
      const c1 = (currentState.locationCandles && currentState.locationCandles[lid]) || 0;
      const c2 = (incoming.locationCandles && incoming.locationCandles[lid]) || 0;
      mergedCandles[lid] = Math.max(c1, c2);
    });

    if (isNewer) {
      currentState = incoming;
      currentState.players = mergedPlayers;
      currentState.locationCandles = mergedCandles;
      lastKnownVersion = currentState.version || 1;
      saveToStorage(currentState);
      return true;
    } else {
      const prevPlayerCount = Object.keys(currentState.players || {}).length;
      currentState.players = mergedPlayers;
      currentState.locationCandles = mergedCandles;
      if (Object.keys(mergedPlayers).length !== prevPlayerCount || playerVotesChanged) {
        currentState.version = Math.max(currentState.version || 1, incoming.version || 1) + (playerVotesChanged ? 1 : 0);
        lastKnownVersion = currentState.version;
        saveToStorage(currentState);
        return true;
      }
    }
    return false;
  }

  function setupBroadcastChannel() {
    if (channel) {
      try {
        channel.close();
      } catch (e) {}
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(getChannelName());
        channel.onmessage = function (ev) {
          if (ev.data && ev.data.type === 'STATE_SYNC' && ev.data.state) {
            if (mergeIncomingState(ev.data.state)) {
              notifyListeners();
            }
          }
        };
      }
    } catch (e) {
      channel = null;
    }
  }

  function connectCloudMultiplayer() {
    if (typeof window.mqtt === 'undefined') return;
    if (mqttClient) {
      try {
        mqttClient.end(true);
      } catch (e) {}
      mqttClient = null;
    }

    const brokerUrl = MQTT_BROKERS[currentBrokerIdx % MQTT_BROKERS.length];
    try {
      mqttClient = window.mqtt.connect(brokerUrl, {
        clientId: 'mishland_' + roomCode + '_' + tabId + '_' + Math.random().toString(16).slice(2, 6),
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 4000
      });

      mqttClient.on('connect', function () {
        mqttConnected = true;
        mqttClient.subscribe([getMqttTopicState(), getMqttTopicPing()], { qos: 0 }, function () {
          // Ask existing peers in the room for the latest state
          mqttClient.publish(
            getMqttTopicPing(),
            JSON.stringify({ type: 'REQUEST_STATE', sender: tabId, time: Date.now() }),
            { qos: 0, retain: false }
          );
          // Also publish our state if we already have players
          if (currentState && Object.keys(currentState.players || {}).length > 0) {
            publishStateToCloud(currentState);
          }
        });
        notifyListeners();
      });

      mqttClient.on('message', function (topic, payload) {
        try {
          const msg = JSON.parse(payload.toString());
          if (topic === getMqttTopicState() && msg && msg.state) {
            if (msg.sender !== tabId) {
              if (mergeIncomingState(msg.state)) {
                notifyListeners();
              }
            }
          } else if (topic === getMqttTopicPing() && msg && msg.type === 'REQUEST_STATE') {
            if (msg.sender !== tabId && currentState && currentState.version > 1) {
              publishStateToCloud(currentState);
            }
          }
        } catch (e) {}
      });

      mqttClient.on('error', function () {
        mqttConnected = false;
        currentBrokerIdx = (currentBrokerIdx + 1) % MQTT_BROKERS.length;
      });

      mqttClient.on('offline', function () {
        mqttConnected = false;
        notifyListeners();
      });
    } catch (e) {
      mqttConnected = false;
    }
  }

  function publishStateToCloud(state) {
    if (mqttClient && mqttConnected) {
      try {
        mqttClient.publish(
          getMqttTopicState(),
          JSON.stringify({ sender: tabId, state: state }),
          { qos: 0, retain: true }
        );
      } catch (e) {}
    }
  }

  function init() {
    const stored = loadFromStorage();
    if (stored && stored.version) {
      currentState = stored;
      if (!currentState.locationCandles) {
        currentState.locationCandles = {};
      }
      lastKnownVersion = stored.version;
    } else {
      currentState = createInitialState();
      saveToStorage(currentState);
      lastKnownVersion = currentState.version;
    }

    setupBroadcastChannel();
    connectCloudMultiplayer();

    window.addEventListener('storage', function (ev) {
      if (ev.key === getStorageKey() && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue);
          if (mergeIncomingState(parsed)) {
            notifyListeners();
          }
        } catch (e) {}
      }
    });

    setInterval(function () {
      const latest = loadFromStorage();
      if (latest && mergeIncomingState(latest)) {
        notifyListeners();
      }
    }, 300);

    setInterval(function () {
      if (currentState && currentState.players && currentState.players[tabId]) {
        updateState(function (st) {
          if (st.players[tabId]) {
            st.players[tabId].lastSeen = Date.now();
          }
        }, true);
      }
    }, 4000);
  }

  function updateState(mutatorFn, isSilentHeartbeat) {
    const latest = loadFromStorage();
    if (latest) {
      mergeIncomingState(latest);
    }
    if (!currentState) {
      currentState = createInitialState();
    }
    if (!currentState.locationCandles) {
      currentState.locationCandles = {};
    }

    mutatorFn(currentState);
    currentState.version = (currentState.version || 1) + 1;
    currentState.updatedAt = Date.now();
    lastKnownVersion = currentState.version;

    saveToStorage(currentState);
    if (channel) {
      try {
        channel.postMessage({ type: 'STATE_SYNC', state: currentState });
      } catch (e) {}
    }
    publishStateToCloud(currentState);

    if (!isSilentHeartbeat) {
      notifyListeners();
    }
  }

  function setRoomCode(newRoomCode) {
    const cleaned = String(newRoomCode || 'MISHA')
      .trim()
      .toUpperCase()
      .replace(/[^A-ZА-Я0-9_-]/g, '');
    if (!cleaned || cleaned === roomCode) return roomCode;

    const myOldPlayer = getMyPlayer();
    roomCode = cleaned;
    try {
      localStorage.setItem('mishland_room_code', roomCode);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', roomCode);
      window.history.replaceState({}, '', newUrl.toString());
    } catch (e) {}

    const stored = loadFromStorage();
    if (stored && stored.version) {
      currentState = stored;
      lastKnownVersion = stored.version;
    } else {
      currentState = createInitialState();
      lastKnownVersion = currentState.version;
    }

    if (myOldPlayer) {
      currentState.players[tabId] = myOldPlayer;
      currentState.players[tabId].lastSeen = Date.now();
    }
    saveToStorage(currentState);
    setupBroadcastChannel();
    connectCloudMultiplayer();
    notifyListeners();
    return roomCode;
  }

  function addLog(st, text) {
    if (!st.eventLog) st.eventLog = [];
    st.eventLog.unshift({
      id: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      text: text,
      time: Date.now()
    });
    if (st.eventLog.length > 8) {
      st.eventLog = st.eventLog.slice(0, 8);
    }
  }

  function lightLocationCandle(st, locId, stageNumber) {
    if (!st.locationCandles) st.locationCandles = {};
    const locObj =
      window.MishlandData &&
      window.MishlandData.locations.find(function (l) {
        return l.id === locId;
      });
    const maxCandles = locObj ? locObj.totalCandles || 3 : 3;
    const currentLit = st.locationCandles[locId] || 0;
    const nextLit = Math.min(maxCandles, Math.max(currentLit, stageNumber));
    st.locationCandles[locId] = nextLit;

    if (nextLit >= maxCandles) {
      if (!st.completedLocations) st.completedLocations = [];
      if (st.completedLocations.indexOf(locId) === -1) {
        st.completedLocations.push(locId);
      }
    }
    return { lit: nextLit, total: maxCandles };
  }

  function getLocationCandleStats(arg1, arg2) {
    let locId, st;
    if (typeof arg1 === 'string') {
      locId = arg1;
      st = arg2 || currentState;
    } else {
      st = arg1 || currentState;
      locId = arg2;
    }
    const locObj =
      window.MishlandData &&
      window.MishlandData.locations.find(function (l) {
        return l.id === locId;
      });
    const total = locObj ? locObj.totalCandles || (locObj.specialType ? 1 : 3) : 3;
    if (!st) return { lit: 0, total: total };

    let lit = (st.locationCandles && st.locationCandles[locId]) || 0;
    if (st.completedLocations && st.completedLocations.indexOf(locId) !== -1) {
      lit = total;
    }
    return { lit: Math.min(total, lit), total: total };
  }

  function getTotalCandleStats(state) {
    const st = state || currentState;
    let totalLit = 0;
    let totalPossible = 0;
    if (window.MishlandData && window.MishlandData.locations) {
      window.MishlandData.locations.forEach(function (loc) {
        const s = getLocationCandleStats(loc.id, st);
        totalLit += s.lit;
        totalPossible += s.total;
      });
    }
    return { lit: totalLit, total: totalPossible };
  }

  function castVote(choiceId, choiceLabel) {
    updateState(function (st) {
      if (!st.players || !st.players[tabId]) return;
      const p = st.players[tabId];
      p.voteChoiceId = String(choiceId);
      p.voteLabel = choiceLabel || String(choiceId);
      p.voteRound = st.voteRound || 1;
      p.voteUpdatedAt = Date.now();
      p.lastSeen = Date.now();
      addLog(
        st,
        '🗳️ ' + p.emoji + ' ' + p.name + ' проголосовал(а) за: «' + p.voteLabel + '»'
      );
    });
  }

  function getShareUrl() {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', roomCode);
      return u.toString();
    } catch (e) {
      return window.location.href;
    }
  }

  function resetGame(keepPlayers) {
    updateState(function (st) {
      const oldPlayers = keepPlayers ? st.players || {} : {};
      const fresh = createInitialState();
      Object.keys(fresh).forEach(function (k) {
        st[k] = fresh[k];
      });
      if (keepPlayers) {
        Object.keys(oldPlayers).forEach(function (pid) {
          oldPlayers[pid].score = 0;
          oldPlayers[pid].voteChoiceId = null;
          oldPlayers[pid].voteLabel = null;
          oldPlayers[pid].voteRound = st.voteRound || 1;
          oldPlayers[pid].pingLocationId = null;
        });
        st.players = oldPlayers;
      }
      addLog(st, '🎉 Медвежонок Миша начал новое праздничное приключение в Мишлэнде!');
    });
  }

  function joinAsCharacter(charObj, customName, gender) {
    updateState(function (st) {
      if (!st.players) st.players = {};
      const existingScore = st.players[tabId] ? st.players[tabId].score || 0 : 0;

      const isHost = charObj.id === 'misha';
      const playerName =
        customName && customName.trim()
          ? customName.trim()
          : isHost
          ? 'Миша'
          : 'Друг';

      const finalGender = gender || charObj.defaultGender || 'male';

      st.players[tabId] = {
        tabId: tabId,
        charId: charObj.id,
        name: playerName,
        gender: finalGender,
        avatarLabel: charObj.avatarLabel || charObj.role,
        roleTitle: charObj.role,
        emoji: charObj.emoji,
        color: charObj.color,
        isHost: isHost,
        score: existingScore,
        lastSeen: Date.now(),
        voteChoiceId: null,
        voteLabel: null,
        voteRound: st.voteRound || 1,
        voteUpdatedAt: Date.now(),
        pingLocationId: null
      };

      const genderBadge = finalGender === 'female' ? '👩 Дама' : '👨 Джентльмен';
      addLog(
        st,
        isHost
          ? '👑 Именинник Медвежонок ' + playerName + ' (' + genderBadge + ') создал игру!'
          : '🌟 Друг ' + charObj.emoji + ' ' + playerName + ' (' + genderBadge + ', ' + charObj.avatarLabel + ') подключился к празднику!'
      );
    });
  }

  function awardBonusToAllPlayers(st, pointsPerPlayer) {
    if (!st.players) st.players = {};
    const pids = Object.keys(st.players);
    if (pids.length === 0) {
      st.teamScore = (st.teamScore || 0) + pointsPerPlayer;
      return { count: 1, totalAdded: pointsPerPlayer, names: ['Команда Миши'] };
    }
    const names = [];
    pids.forEach(function (pid) {
      const p = st.players[pid];
      p.score = (p.score || 0) + pointsPerPlayer;
      names.push(p.emoji + ' ' + p.name);
    });
    const totalAdded = pids.length * pointsPerPlayer;
    st.teamScore = (st.teamScore || 0) + totalAdded;
    return { count: pids.length, totalAdded: totalAdded, names: names };
  }

  function awardBonusToWomenOnly(st, pointsPerWoman) {
    if (!st.players) st.players = {};
    const pids = Object.keys(st.players);
    const womenNames = [];
    const menNames = [];

    pids.forEach(function (pid) {
      const p = st.players[pid];
      if (p.gender === 'female') {
        p.score = (p.score || 0) + pointsPerWoman;
        womenNames.push(p.emoji + ' ' + p.name);
      } else {
        menNames.push(p.emoji + ' ' + p.name);
      }
    });

    const totalAdded = womenNames.length * pointsPerWoman;
    st.teamScore = (st.teamScore || 0) + totalAdded;
    return {
      womenCount: womenNames.length,
      menCount: menNames.length,
      womenNames: womenNames,
      menNames: menNames,
      totalAdded: totalAdded
    };
  }

  function getMyPlayer() {
    if (!currentState || !currentState.players) return null;
    return currentState.players[tabId] || null;
  }

  function getActivePlayers() {
    if (!currentState || !currentState.players) return [];
    const now = Date.now();
    return Object.values(currentState.players).filter(function (p) {
      return now - (p.lastSeen || 0) < 90000;
    });
  }

  init();

  window.MishlandSync = {
    getTabId: function () {
      return tabId;
    },
    getRoomCode: function () {
      return roomCode;
    },
    setRoomCode: setRoomCode,
    getShareUrl: getShareUrl,
    isCloudConnected: function () {
      return mqttConnected;
    },
    isOnlineConnected: function () {
      return mqttConnected;
    },
    getState: function () {
      return currentState;
    },
    getMyPlayer: getMyPlayer,
    getActivePlayers: getActivePlayers,
    getLocationCandleStats: getLocationCandleStats,
    getTotalCandleStats: getTotalCandleStats,
    lightLocationCandle: lightLocationCandle,
    castVote: castVote,
    updateState: updateState,
    addLog: addLog,
    resetGame: resetGame,
    joinAsCharacter: joinAsCharacter,
    awardBonusToAllPlayers: awardBonusToAllPlayers,
    awardBonusToWomenOnly: awardBonusToWomenOnly,
    subscribe: function (fn) {
      listeners.push(fn);
      if (currentState) fn(currentState);
    }
  };
})();
