
// ============================================================
// 🔧 FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAEK8hpUXtLM4YFc2PPr4i5tKrsnRrkW_c",
  authDomain: "parlaypicks-6329a.firebaseapp.com",
  databaseURL: "https://parlaypicks-6329a-default-rtdb.firebaseio.com",
  projectId: "parlaypicks-6329a",
  storageBucket: "parlaypicks-6329a.firebasestorage.app",
  messagingSenderId: "463367015110",
  appId: "1:463367015110:web:b131bf978cb53b222225c7",
  measurementId: "G-DKVRZMDWQR"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// CONSTANTS
// ============================================================
const NUM_PICKS = 2;
const NUM_PLAYERS = 4;
const PLAYER_COLORS = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4'];
const PLAYER_NAMES = ['Tristan', 'Josh', 'Scott', 'Cole'];
const PICK_TYPES = ['Game Line', 'Spread', 'Over/Under', 'Moneyline', 'Player Prop'];
const PLACEHOLDERS = [
  ['e.g. Chiefs -3.5 vs Ravens', 'e.g. Mahomes 275+ pass yds'],
  ['e.g. 49ers ML vs Seahawks', 'e.g. Derrick Henry 80+ rush yds'],
  ['e.g. Cowboys +7 vs Eagles', 'e.g. Lamar Jackson 1+ rush TD'],
  ['e.g. Lions -6.5 vs Vikings', 'e.g. Tyreek Hill 90+ rec yds']
];

// ============================================================
// WEEK SYSTEM — Runs Tuesday to Monday (football schedule)
// Season starts Tuesday Sep 8, 2026
// ============================================================
const SEASON_START = new Date(2026, 8, 8);

function getSeasonWeek() {
  const now = new Date();
  const diffMs = now - SEASON_START;
  const diffDays = Math.floor(diffMs / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  if (weekNum < 1) return 1;
  return weekNum;
}

function getWeekKey() {
  const week = getSeasonWeek();
  return `2026-FBW-${String(week).padStart(2, '0')}`;
}

function getWeekDates(weekNum) {
  const startDate = new Date(SEASON_START);
  startDate.setDate(startDate.getDate() + (weekNum - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return { startDate, endDate };
}

function getWeekDateRange() {
  const week = getSeasonWeek();
  const { startDate, endDate } = getWeekDates(week);
  const opts = { month: 'short', day: 'numeric' };
  return `🏈 Week ${week} — ${startDate.toLocaleDateString('en-US', opts)} – ${endDate.toLocaleDateString('en-US', opts)}, ${startDate.getFullYear()}`;
}

function weekKeyToLabel(weekKey) {
  if (weekKey.includes('FBW')) {
    const parts = weekKey.split('-FBW-');
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    const { startDate, endDate } = getWeekDates(week);
    const opts = { month: 'short', day: 'numeric' };
    return `Week ${week} — ${startDate.toLocaleDateString('en-US', opts)} – ${endDate.toLocaleDateString('en-US', opts)}, ${year}`;
  }
  if (weekKey.includes('NFL')) {
    const parts = weekKey.split('-NFL-W');
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    const { startDate, endDate } = getWeekDates(week);
    const opts = { month: 'short', day: 'numeric' };
    return `Week ${week} — ${startDate.toLocaleDateString('en-US', opts)} – ${endDate.toLocaleDateString('en-US', opts)}, ${year}`;
  }
  const parts = weekKey.split('-W');
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - jan1.getDay() + 1;
  const monday = new Date(year, 0, 1 + daysOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `Week of ${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${year}`;
}

function parlayLabel(index) {
  return String.fromCharCode(65 + index);
}

// ============================================================
// TAB SWITCHING
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
  });
});

// ============================================================
// CURRENT WEEK & PARLAY STATE
// ============================================================
const weekKey = getWeekKey();
const weekRef = db.ref(`weeks/${weekKey}`);
let currentParlayIndex = 0;
let totalParlays = 1;

document.getElementById('week-header').textContent = getWeekDateRange();

// ============================================================
// PARLAY NAVIGATION
// ============================================================
const parlayNav = document.getElementById('parlay-nav');
const parlayLabelEl = document.getElementById('parlay-label');
const prevParlayBtn = document.getElementById('prev-parlay');
const nextParlayBtn = document.getElementById('next-parlay');
const addParlayBtn = document.getElementById('add-parlay');

function updateParlayNav() {
  parlayLabelEl.textContent = `Parlay ${parlayLabel(currentParlayIndex)}`;
  prevParlayBtn.disabled = currentParlayIndex === 0;
  nextParlayBtn.disabled = currentParlayIndex >= totalParlays - 1;
}

prevParlayBtn.addEventListener('click', () => {
  if (currentParlayIndex > 0) {
    currentParlayIndex--;
    updateParlayNav();
    loadCurrentParlay();
  }
});

nextParlayBtn.addEventListener('click', () => {
  if (currentParlayIndex < totalParlays - 1) {
    currentParlayIndex++;
    updateParlayNav();
    loadCurrentParlay();
  }
});

addParlayBtn.addEventListener('click', () => {
  currentParlayIndex = totalParlays;
  totalParlays++;
  weekRef.child('parlayCount').set(totalParlays);
  updateParlayNav();
  loadCurrentParlay();
});

// ============================================================
// BUILD ENTRY FORM
// ============================================================
const playersContainer = document.getElementById('players-container');

for (let p = 0; p < NUM_PLAYERS; p++) {
  const section = document.createElement('div');
  section.className = 'player-section';
  section.id = `player-section-${p}`;

  let picksHTML = '';
  for (let k = 0; k < NUM_PICKS; k++) {
    const optionsHTML = PICK_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
    picksHTML += `
      <div class="pick-row">
        <div class="pick-number">${k + 1}</div>
        <select class="pick-type" data-player="${p}" data-pick="${k}">
          ${optionsHTML}
        </select>
        <input type="text" class="pick-input" data-player="${p}" data-pick="${k}"
               placeholder="${PLACEHOLDERS[p][k]}">
      </div>`;
  }

  section.innerHTML = `
    <div class="player-header">
      <div class="player-avatar ${PLAYER_COLORS[p]}">${p + 1}</div>
      <div class="player-name">${PLAYER_NAMES[p]}</div>
    </div>
    <div class="picks-grid">${picksHTML}</div>
    <div class="lock-row">
      <input type="checkbox" class="lock-check" id="lock-${p}" data-player="${p}">
      <label for="lock-${p}">🔒 Locked In</label>
    </div>`;

  playersContainer.appendChild(section);
}

// ============================================================
// DEBOUNCED SAVE TO FIREBASE
// ============================================================
const debounceTimers = {};

function debounceSave(key, value, delay = 500) {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => {
    weekRef.child(key).set(value);
  }, delay);
}

function getParlayPath() {
  return `parlays/${currentParlayIndex}`;
}

document.querySelectorAll('.pick-type').forEach(select => {
  select.addEventListener('change', () => {
    const p = select.dataset.player;
    const k = select.dataset.pick;
    weekRef.child(`${getParlayPath()}/players/${p}/picks/${k}/type`).set(select.value);
  });
});

document.querySelectorAll('.pick-input').forEach(input => {
  input.addEventListener('input', () => {
    const p = input.dataset.player;
    const k = input.dataset.pick;
    debounceSave(`${getParlayPath()}/players/${p}/picks/${k}/text`, input.value);
  });
});

document.querySelectorAll('.lock-check').forEach(cb => {
  cb.addEventListener('change', () => {
    const p = cb.dataset.player;
    weekRef.child(`${getParlayPath()}/players/${p}/locked`).set(cb.checked);
  });
});

// ============================================================
// LOAD CURRENT PARLAY DATA INTO FORM
// ============================================================
function loadCurrentParlay() {
  weekRef.child(getParlayPath()).once('value', (snapshot) => {
    const data = snapshot.val() || {};
    const players = data.players || {};

    let totalFilled = 0;

    for (let p = 0; p < NUM_PLAYERS; p++) {
      const pData = players[p] || {};
      const section = document.getElementById(`player-section-${p}`);

      const lockCb = section.querySelector('.lock-check');
      lockCb.checked = pData.locked || false;
      section.classList.toggle('locked', pData.locked || false);

      const picks = pData.picks || {};
      for (let k = 0; k < NUM_PICKS; k++) {
        const pickData = picks[k] || {};
        const typeSelect = section.querySelector(`.pick-type[data-pick="${k}"]`);
        const textInput = section.querySelector(`.pick-input[data-pick="${k}"]`);

        typeSelect.value = pickData.type || 'Game Line';
        textInput.value = pickData.text || '';

        if (pickData.text && pickData.text.trim() !== '') {
          totalFilled++;
        }
      }
    }

    document.getElementById('total-picks-count').textContent = totalFilled;

    const betSlip = data.betSlip || {};
    betOddsInput.value = betSlip.odds || '';
    betAmountInput.value = betSlip.betAmount || '';
    winAmountInput.value = betSlip.winAmount || '';
    updatePayout();
  });
}

// ============================================================
// REAL-TIME LISTENER — Current Week
// ============================================================
weekRef.on('value', (snapshot) => {
  const data = snapshot.val() || {};

  totalParlays = data.parlayCount || 1;

  // Handle legacy data (pre-parlay system)
  if (data.players && !data.parlays) {
    const migrationData = {
      players: data.players
    };
    if (data.betSlip) migrationData.betSlip = data.betSlip;
    if (data.results) migrationData.results = data.results;
    weekRef.child('parlays/0').set(migrationData);
    weekRef.child('players').remove();
    if (data.betSlip) weekRef.child('betSlip').remove();
    if (data.results) weekRef.child('results').remove();
    if (!data.parlayCount) weekRef.child('parlayCount').set(1);
    return;
  }

  updateParlayNav();

  const parlayData = (data.parlays && data.parlays[currentParlayIndex]) || {};
  const players = parlayData.players || {};

  let totalFilled = 0;

  for (let p = 0; p < NUM_PLAYERS; p++) {
    const pData = players[p] || {};
    const section = document.getElementById(`player-section-${p}`);

    const lockCb = section.querySelector('.lock-check');
    lockCb.checked = pData.locked || false;
    section.classList.toggle('locked', pData.locked || false);

    const picks = pData.picks || {};
    for (let k = 0; k < NUM_PICKS; k++) {
      const pickData = picks[k] || {};
      const typeSelect = section.querySelector(`.pick-type[data-pick="${k}"]`);
      const textInput = section.querySelector(`.pick-input[data-pick="${k}"]`);

      if (document.activeElement !== typeSelect) {
        typeSelect.value = pickData.type || 'Game Line';
      }
      if (document.activeElement !== textInput) {
        textInput.value = pickData.text || '';
      }

      if (pickData.text && pickData.text.trim() !== '') {
        totalFilled++;
      }
    }
  }

  document.getElementById('total-picks-count').textContent = totalFilled;
  buildSummary(data);

  const betSlip = parlayData.betSlip || {};
  if (document.activeElement !== betOddsInput) betOddsInput.value = betSlip.odds || '';
  if (document.activeElement !== betAmountInput) betAmountInput.value = betSlip.betAmount || '';
  if (document.activeElement !== winAmountInput) winAmountInput.value = betSlip.winAmount || '';
  updatePayout();
});

// ============================================================
// BUILD SUMMARY VIEW
// ============================================================
function buildSummary(weekData) {
  const container = document.getElementById('summary-container');
  container.innerHTML = '';

  const parlays = weekData.parlays || {};
  const parlayKeys = Object.keys(parlays).sort();

  parlayKeys.forEach(pi => {
    const parlayData = parlays[pi] || {};
    const players = parlayData.players || {};
    const betSlip = parlayData.betSlip || {};
    const pIndex = parseInt(pi);

    const parlaySection = document.createElement('div');
    parlaySection.className = 'summary-parlay-section';

    let parlayHeaderHTML = '';
    if (parlayKeys.length > 1) {
      parlayHeaderHTML = `<h3 class="summary-parlay-title">🎯 Parlay ${parlayLabel(pIndex)}</h3>`;
    }

    let betSlipHTML = '';
    if (betSlip.odds || betSlip.betAmount || betSlip.winAmount) {
      const odds = betSlip.odds ? `+${betSlip.odds}` : '—';
      const betAmt = betSlip.betAmount ? `$${parseFloat(betSlip.betAmount).toFixed(2)}` : '—';
      const winAmt = betSlip.winAmount ? `$${parseFloat(betSlip.winAmount).toFixed(2)}` : '—';
      betSlipHTML = `
        <div class="summary-bet-slip">
          <span>Odds: <strong>${odds}</strong></span>
          <span>Wager: <strong>${betAmt}</strong></span>
          <span>To Win: <strong>${winAmt}</strong></span>
        </div>`;
    }

    let cardsHTML = '';
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const pData = players[p] || {};
      const picks = pData.picks || {};
      const name = PLAYER_NAMES[p];
      const locked = pData.locked || false;

      let rowsHTML = '';
      for (let k = 0; k < NUM_PICKS; k++) {
        const pick = picks[k] || {};
        const type = pick.type || 'Game Line';
        const text = pick.text || '—';
        const badgeClass = 'badge-' + type.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');

        rowsHTML += `
          <tr>
            <td>${k + 1}</td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td>${text}</td>
          </tr>`;
      }

      const statusHTML = locked
        ? '<span class="status-locked">✅ Locked In</span>'
        : '<span class="status-pending">⏳ Pending</span>';

      cardsHTML += `
        <div class="summary-card">
          <h3>
            <span class="player-avatar ${PLAYER_COLORS[p]}" style="width:28px;height:28px;font-size:12px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;">${p + 1}</span>
            ${name} ${statusHTML}
          </h3>
          <table class="summary-table">
            <thead><tr><th>#</th><th>Type</th><th>Pick</th></tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>`;
    }

    parlaySection.innerHTML = `${parlayHeaderHTML}${betSlipHTML}${cardsHTML}`;
    container.appendChild(parlaySection);
  });
}

// ============================================================
// BET SLIP — Save & Calculate
// ============================================================
const betOddsInput = document.getElementById('parlay-odds');
const betAmountInput = document.getElementById('bet-amount');
const winAmountInput = document.getElementById('win-amount');
const betPayout = document.getElementById('bet-payout');

function updatePayout() {
  const odds = parseFloat(betOddsInput.value);
  const betAmt = parseFloat(betAmountInput.value);
  const winAmt = parseFloat(winAmountInput.value);

  if (odds && betAmt && winAmt) {
    const totalPayout = betAmt + winAmt;
    betPayout.textContent = `💵 Total Payout: $${totalPayout.toFixed(2)}`;
  } else if (odds && betAmt && !winAmt) {
    let calcWin = 0;
    if (odds > 0) {
      calcWin = betAmt * (odds / 100);
    } else {
      calcWin = betAmt * (100 / Math.abs(odds));
    }
    betPayout.textContent = `💵 Estimated Win: $${calcWin.toFixed(2)} | Total Payout: $${(betAmt + calcWin).toFixed(2)}`;
  } else {
    betPayout.textContent = '';
  }
}

function saveBetSlip() {
  weekRef.child(`${getParlayPath()}/betSlip`).set({
    odds: betOddsInput.value || '',
    betAmount: betAmountInput.value || '',
    winAmount: winAmountInput.value || ''
  });
}

betOddsInput.addEventListener('input', () => { updatePayout(); saveBetSlip(); });
betAmountInput.addEventListener('input', () => { updatePayout(); saveBetSlip(); });
winAmountInput.addEventListener('input', () => { updatePayout(); saveBetSlip(); });

// ============================================================
// HISTORY TAB — Load All Weeks
// ============================================================
const allWeeksRef = db.ref('weeks');

allWeeksRef.on('value', (snapshot) => {
  const allWeeks = snapshot.val() || {};
  const weekKeys = Object.keys(allWeeks).sort().reverse();

  const historyContainer = document.getElementById('history-container');
  const noHistory = document.getElementById('no-history');
  const recordBanner = document.getElementById('overall-record');
  const playerRecordsContainer = document.getElementById('player-records');

  historyContainer.innerHTML = '';

  if (weekKeys.length === 0) {
    noHistory.style.display = 'block';
    recordBanner.style.display = 'none';
    playerRecordsContainer.style.display = 'none';
    return;
  }

  noHistory.style.display = 'none';
  recordBanner.style.display = 'block';
  playerRecordsContainer.style.display = 'block';

  let totalWins = 0;
  let totalLosses = 0;
  let totalPending = 0;
  let totalNC = 0;

  const playerStats = {};
  for (let p = 0; p < NUM_PLAYERS; p++) {
    playerStats[p] = { wins: 0, losses: 0, pending: 0, nc: 0 };
  }

  weekKeys.forEach(wk => {
    const weekData = allWeeks[wk];

    // Determine parlays — support both old and new format
    let parlaysMap = {};
    if (weekData.parlays) {
      parlaysMap = weekData.parlays;
    } else if (weekData.players) {
      parlaysMap = { 0: { players: weekData.players, betSlip: weekData.betSlip || {}, results: weekData.results || {} } };
    }

    const parlayIndexes = Object.keys(parlaysMap).sort();
    if (parlayIndexes.length === 0) return;

    const weekDiv = document.createElement('div');
    weekDiv.className = 'history-week';

    let weekWins = 0;
    let weekLosses = 0;
    let weekPending = 0;
    let weekNC = 0;
    let hasPicks = false;
    let parlaysHTML = '';

    parlayIndexes.forEach(pi => {
      const parlayData = parlaysMap[pi] || {};
      const players = parlayData.players || {};
      const results = parlayData.results || {};
      const betSlip = parlayData.betSlip || {};
      const pIdx = parseInt(pi);

      let rowsHTML = '';
      let parlayWins = 0;
      let parlayLosses = 0;
      let parlayPending = 0;
      let parlayNC = 0;
      let parlayHasPicks = false;

      const playerKeys = Object.keys(players);
      for (let i = 0; i < playerKeys.length; i++) {
        const p = playerKeys[i];
        const pData = players[p] || {};
        const picks = pData.picks || {};
        const playerIndex = parseInt(p);
        const playerName = PLAYER_NAMES[playerIndex] || `Player ${playerIndex + 1}`;

        if (!playerStats[playerIndex]) {
          playerStats[playerIndex] = { wins: 0, losses: 0, pending: 0, nc: 0 };
        }

        const pickKeys = Object.keys(picks);
        for (let j = 0; j < pickKeys.length; j++) {
          const k = pickKeys[j];
          const pick = picks[k] || {};
          if (!pick.text || pick.text.trim() === '') continue;

          parlayHasPicks = true;
          hasPicks = true;
          const resultKey = `p${p}_k${k}`;
          const result = results[resultKey] || 'pending';
          const type = pick.type || 'Game Line';
          const badgeClass = 'badge-' + type.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');

          if (result === 'win') {
            parlayWins++; weekWins++; totalWins++;
            playerStats[playerIndex].wins++;
          } else if (result === 'loss') {
            parlayLosses++; weekLosses++; totalLosses++;
            playerStats[playerIndex].losses++;
          } else if (result === 'nc') {
            parlayNC++; weekNC++; totalNC++;
            playerStats[playerIndex].nc++;
          } else {
            parlayPending++; weekPending++; totalPending++;
            playerStats[playerIndex].pending++;
          }

          const winClass = result === 'win' ? ' win' : '';
          const lossClass = result === 'loss' ? ' loss' : '';
          const ncClass = result === 'nc' ? ' nc' : '';

          // Always use parlays path for result saving
          const resultPath = `weeks/${wk}/parlays/${pi}/results/${resultKey}`;

          rowsHTML += `
            <tr>
              <td><strong>${playerName}</strong></td>
              <td><span class="badge ${badgeClass}">${type}</span></td>
              <td>${pick.text}</td>
              <td class="result-cell">
                <button class="result-btn${winClass}" data-result-path="${resultPath}" data-action="win">✅ W</button>
                <button class="result-btn${lossClass}" data-result-path="${resultPath}" data-action="loss">❌ L</button>
                <button class="result-btn${ncClass}" data-result-path="${resultPath}" data-action="nc">🚫 NC</button>
              </td>
            </tr>`;
        }
      }

      if (!parlayHasPicks) return;

      let betSlipHTML = '';
      if (betSlip.odds || betSlip.betAmount || betSlip.winAmount) {
        const odds = betSlip.odds ? `+${betSlip.odds}` : '—';
        const betAmt = betSlip.betAmount ? `$${parseFloat(betSlip.betAmount).toFixed(2)}` : '—';
        const winAmt = betSlip.winAmount ? `$${parseFloat(betSlip.winAmount).toFixed(2)}` : '—';
        const tp = (betSlip.betAmount && betSlip.winAmount)
          ? `$${(parseFloat(betSlip.betAmount) + parseFloat(betSlip.winAmount)).toFixed(2)}`
          : '—';

        betSlipHTML = `
          <div class="history-bet-slip">
            <div class="bet-slip-item">
              <span class="bet-slip-label">Odds</span>
              <span class="bet-slip-value">${odds}</span>
            </div>
            <div class="bet-slip-item">
              <span class="bet-slip-label">Wager</span>
              <span class="bet-slip-value">${betAmt}</span>
            </div>
            <div class="bet-slip-item">
              <span class="bet-slip-label">To Win</span>
              <span class="bet-slip-value bet-slip-win">${winAmt}</span>
            </div>
            <div class="bet-slip-item">
              <span class="bet-slip-label">Payout</span>
              <span class="bet-slip-value bet-slip-payout">${tp}</span>
            </div>
          </div>`;
      }

      let parlayResultHTML = '';
      if (parlayPending > 0) {
        parlayResultHTML = `<span class="history-week-result result-pending">⏳ ${parlayWins}W - ${parlayLosses}L${parlayNC > 0 ? ` - ${parlayNC}NC` : ''} - ${parlayPending} pending</span>`;
      } else if (parlayLosses === 0 && parlayWins > 0) {
        parlayResultHTML = `<span class="history-week-result result-win">🎉 PERFECT ${parlayWins}-${parlayLosses}${parlayNC > 0 ? ` - ${parlayNC}NC` : ''}</span>`;
      } else {
        parlayResultHTML = `<span class="history-week-result ${parlayWins > parlayLosses ? 'result-win' : 'result-loss'}">${parlayWins}W - ${parlayLosses}L${parlayNC > 0 ? ` - ${parlayNC}NC` : ''}</span>`;
      }

      const parlayTitle = parlayIndexes.length > 1 ? `Parlay ${parlayLabel(pIdx)} — ` : '';

      parlaysHTML += `
        <div class="history-parlay-block">
          <div class="history-parlay-header">
            <h4>🎯 ${parlayTitle}${parlayResultHTML}</h4>
          </div>
          ${betSlipHTML}
          <table class="history-table">
            <thead><tr><th>Player</th><th>Type</th><th>Pick</th><th>Result</th></tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>`;
    });

    if (!hasPicks) return;

    let weekResultHTML = '';
    if (weekPending > 0) {
      weekResultHTML = `<span class="history-week-result result-pending">⏳ ${weekWins}W - ${weekLosses}L${weekNC > 0 ? ` - ${weekNC}NC` : ''} - ${weekPending} pending</span>`;
    } else if (weekLosses === 0 && weekWins > 0) {
      weekResultHTML = `<span class="history-week-result result-win">🎉 PERFECT ${weekWins}-${weekLosses}${weekNC > 0 ? ` - ${weekNC}NC` : ''}</span>`;
    } else {
      weekResultHTML = `<span class="history-week-result ${weekWins > weekLosses ? 'result-win' : 'result-loss'}">${weekWins}W - ${weekLosses}L${weekNC > 0 ? ` - ${weekNC}NC` : ''}</span>`;
    }

    weekDiv.innerHTML = `
      <div class="history-week-header">
        <h3>📅 ${weekKeyToLabel(wk)}</h3>
        ${weekResultHTML}
      </div>
      ${parlaysHTML}`;

    historyContainer.appendChild(weekDiv);
  });

  // Overall record banner
  const totalBets = totalWins + totalLosses;
  const winPct = totalBets > 0 ? Math.round((totalWins / totalBets) * 100) : 0;

  recordBanner.innerHTML = `
    <h2>📊 Overall Record</h2>
    <div class="record-stats">
      <div class="record-stat stat-wins">
        <div class="num">${totalWins}</div>
        <div class="lbl">Wins</div>
      </div>
      <div class="record-stat stat-losses">
        <div class="num">${totalLosses}</div>
        <div class="lbl">Losses</div>
      </div>
      <div class="record-stat stat-nc">
        <div class="num">${totalNC}</div>
        <div class="lbl">No Contest</div>
      </div>
      <div class="record-stat stat-pending">
        <div class="num">${totalPending}</div>
        <div class="lbl">Pending</div>
      </div>
      <div class="record-stat stat-pct">
        <div class="num">${winPct}%</div>
        <div class="lbl">Win Rate</div>
      </div>
    </div>`;

  // Individual player records
  let playerCardsHTML = '';
  for (let p = 0; p < NUM_PLAYERS; p++) {
    const stats = playerStats[p];
    const pTotal = stats.wins + stats.losses;
    const pPct = pTotal > 0 ? Math.round((stats.wins / pTotal) * 100) : 0;

    playerCardsHTML += `
      <div class="player-record-card">
        <div class="player-record-header">
          <span class="player-avatar ${PLAYER_COLORS[p]}" style="width:32px;height:32px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;">${p + 1}</span>
          <span class="player-record-name">${PLAYER_NAMES[p]}</span>
          <span class="player-record-pct">${pPct}%</span>
        </div>
        <div class="player-record-stats">
          <span class="pr-stat pr-wins">${stats.wins}W</span>
          <span class="pr-divider">-</span>
          <span class="pr-stat pr-losses">${stats.losses}L</span>
          ${stats.nc > 0 ? `<span class="pr-divider">-</span><span class="pr-stat pr-nc">${stats.nc}NC</span>` : ''}
          ${stats.pending > 0 ? `<span class="pr-divider">-</span><span class="pr-stat pr-pending">${stats.pending}P</span>` : ''}
        </div>
        <div class="player-record-bar">
          <div class="bar-wins" style="width: ${pTotal > 0 ? (stats.wins / pTotal) * 100 : 0}%"></div>
          <div class="bar-losses" style="width: ${pTotal > 0 ? (stats.losses / pTotal) * 100 : 0}%"></div>
        </div>
      </div>`;
  }

  playerRecordsContainer.innerHTML = `
    <h2>👤 Individual Records</h2>
    <div class="player-records-grid">${playerCardsHTML}</div>`;

  // Attach click handlers to result buttons — using direct Firebase path
  document.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resultPath = btn.dataset.resultPath;
      const action = btn.dataset.action;
      const resultRef = db.ref(resultPath);

      resultRef.once('value', (snap) => {
        const current = snap.val();
        if (current === action) {
          resultRef.remove();
        } else {
          resultRef.set(action);
        }
      });
    });
  });
});

