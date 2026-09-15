
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
// HELPERS
// ============================================================
function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekDateRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `📅 Week of ${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${now.getFullYear()}`;
}

function weekKeyToLabel(weekKey) {
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
// BUILD ENTRY FORM
// ============================================================
const weekKey = getWeekKey();
const weekRef = db.ref(`weeks/${weekKey}`);

document.getElementById('week-header').textContent = getWeekDateRange();

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

// Pick type selects
document.querySelectorAll('.pick-type').forEach(select => {
  select.addEventListener('change', () => {
    const p = select.dataset.player;
    const k = select.dataset.pick;
    weekRef.child(`players/${p}/picks/${k}/type`).set(select.value);
  });
});

// Pick text inputs
document.querySelectorAll('.pick-input').forEach(input => {
  input.addEventListener('input', () => {
    const p = input.dataset.player;
    const k = input.dataset.pick;
    debounceSave(`players/${p}/picks/${k}/text`, input.value);
  });
});

// Lock checkboxes
document.querySelectorAll('.lock-check').forEach(cb => {
  cb.addEventListener('change', () => {
    const p = cb.dataset.player;
    weekRef.child(`players/${p}/locked`).set(cb.checked);
  });
});

// ============================================================
// REAL-TIME LISTENER — Current Week (Entry + Summary)
// ============================================================
weekRef.on('value', (snapshot) => {
  const data = snapshot.val() || {};
  const players = data.players || {};

  let totalFilled = 0;

  for (let p = 0; p < NUM_PLAYERS; p++) {
    const pData = players[p] || {};
    const section = document.getElementById(`player-section-${p}`);

    // Locked
    const lockCb = section.querySelector('.lock-check');
    lockCb.checked = pData.locked || false;
    section.classList.toggle('locked', pData.locked || false);

    // Picks
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

  // Update summary
  document.getElementById('total-picks-count').textContent = totalFilled;
  buildSummary(players);
});

// ============================================================
// BUILD SUMMARY VIEW
// ============================================================
function buildSummary(players) {
  const container = document.getElementById('summary-container');
  container.innerHTML = '';

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

    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `
      <h3>
        <span class="player-avatar ${PLAYER_COLORS[p]}" style="width:28px;height:28px;font-size:12px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;">${p + 1}</span>
        ${name} ${statusHTML}
      </h3>
      <table class="summary-table">
        <thead><tr><th>#</th><th>Type</th><th>Pick</th></tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>`;

    container.appendChild(card);
  }
}

// ============================================================
// HISTORY TAB — Load All Weeks (supports variable picks per week)
// ============================================================
const allWeeksRef = db.ref('weeks');

allWeeksRef.on('value', (snapshot) => {
  const allWeeks = snapshot.val() || {};
  const weekKeys = Object.keys(allWeeks).sort().reverse();

  const historyContainer = document.getElementById('history-container');
  const noHistory = document.getElementById('no-history');
  const recordBanner = document.getElementById('overall-record');

  historyContainer.innerHTML = '';

  if (weekKeys.length === 0) {
    noHistory.style.display = 'block';
    recordBanner.style.display = 'none';
    return;
  }

  noHistory.style.display = 'none';
  recordBanner.style.display = 'block';

  let totalWins = 0;
  let totalLosses = 0;
  let totalPending = 0;

  weekKeys.forEach(wk => {
    const weekData = allWeeks[wk];
    const players = weekData.players || {};
    const results = weekData.results || {};

    const weekDiv = document.createElement('div');
    weekDiv.className = 'history-week';

    let rowsHTML = '';
    let weekWins = 0;
    let weekLosses = 0;
    let weekPending = 0;
    let hasPicks = false;

    // Loop through all players that exist in this week's data
    const playerKeys = Object.keys(players);
    for (let i = 0; i < playerKeys.length; i++) {
      const p = playerKeys[i];
      const pData = players[p] || {};
      const picks = pData.picks || {};
      const playerIndex = parseInt(p);
      const playerName = PLAYER_NAMES[playerIndex] || `Player ${playerIndex + 1}`;

      // Loop through ALL picks that exist for this player (not limited to NUM_PICKS)
      const pickKeys = Object.keys(picks);
      for (let j = 0; j < pickKeys.length; j++) {
        const k = pickKeys[j];
        const pick = picks[k] || {};
        if (!pick.text || pick.text.trim() === '') continue;

        hasPicks = true;
        const resultKey = `p${p}_k${k}`;
        const result = results[resultKey] || 'pending';
        const type = pick.type || 'Game Line';
        const badgeClass = 'badge-' + type.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');

        if (result === 'win') { weekWins++; totalWins++; }
        else if (result === 'loss') { weekLosses++; totalLosses++; }
        else { weekPending++; totalPending++; }

        const winClass = result === 'win' ? ' win' : '';
        const lossClass = result === 'loss' ? ' loss' : '';

        rowsHTML += `
          <tr>
            <td><strong>${playerName}</strong></td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
            <td>${pick.text}</td>
            <td>
              <button class="result-btn${winClass}" data-week="${wk}" data-key="${resultKey}" data-action="win">✅ W</button>
              <button class="result-btn${lossClass}" data-week="${wk}" data-key="${resultKey}" data-action="loss">❌ L</button>
            </td>
          </tr>`;
      }
    }

    if (!hasPicks) return;

    let weekResultHTML = '';
    if (weekPending > 0) {
      weekResultHTML = `<span class="history-week-result result-pending">⏳ ${weekWins}W - ${weekLosses}L - ${weekPending} pending</span>`;
    } else if (weekLosses === 0 && weekWins > 0) {
      weekResultHTML = `<span class="history-week-result result-win">🎉 PERFECT ${weekWins}-${weekLosses}</span>`;
    } else {
      weekResultHTML = `<span class="history-week-result ${weekWins > weekLosses ? 'result-win' : 'result-loss'}">${weekWins}W - ${weekLosses}L</span>`;
    }

    weekDiv.innerHTML = `
      <div class="history-week-header">
        <h3>📅 ${weekKeyToLabel(wk)}</h3>
        ${weekResultHTML}
      </div>
      <table class="history-table">
        <thead><tr><th>Player</th><th>Type</th><th>Pick</th><th>Result</th></tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>`;

    historyContainer.appendChild(weekDiv);
  });

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
      <div class="record-stat stat-pending">
        <div class="num">${totalPending}</div>
        <div class="lbl">Pending</div>
      </div>
      <div class="record-stat stat-pct">
        <div class="num">${winPct}%</div>
        <div class="lbl">Win Rate</div>
      </div>
    </div>`;

  document.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const week = btn.dataset.week;
      const key = btn.dataset.key;
      const action = btn.dataset.action;

      const resultRef = db.ref(`weeks/${week}/results/${key}`);

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

