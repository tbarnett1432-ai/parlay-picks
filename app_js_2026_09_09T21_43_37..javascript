
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
// HELPERS
// ============================================================
const PLAYER_COLORS = ['avatar-1', 'avatar-2', 'avatar-3'];
const PICK_TYPES = ['Game Line', 'Spread', 'Over/Under', 'Moneyline', 'Player Prop'];
const PLACEHOLDERS = [
  ['e.g. Chiefs -3.5 vs Ravens', 'e.g. Over 47.5 Bills vs Dolphins', 'e.g. Mahomes 275+ pass yds'],
  ['e.g. 49ers ML vs Seahawks', 'e.g. Under 43.5 Steelers vs Browns', 'e.g. Derrick Henry 80+ rush yds'],
  ['e.g. Cowboys +7 vs Eagles', 'e.g. Lamar Jackson 1+ rush TD', 'e.g. Packers ML vs Bears']
];

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

for (let p = 0; p < 3; p++) {
  const section = document.createElement('div');
  section.className = 'player-section';
  section.id = `player-section-${p}`;

  let picksHTML = '';
  for (let k = 0; k < 3; k++) {
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
      <input type="text" class="player-name-input" data-player="${p}"
             placeholder="Player ${p + 1} Name">
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

// Name inputs
document.querySelectorAll('.player-name-input').forEach(input => {
  input.addEventListener('input', () => {
    const p = input.dataset.player;
    debounceSave(`players/${p}/name`, input.value);
  });
});

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
// REAL-TIME LISTENER — Sync from Firebase
// ============================================================
weekRef.on('value', (snapshot) => {
  const data = snapshot.val() || {};
  const players = data.players || {};

  let totalFilled = 0;

  for (let p = 0; p < 3; p++) {
    const pData = players[p] || {};
    const section = document.getElementById(`player-section-${p}`);

    // Name
    const nameInput = section.querySelector('.player-name-input');
    if (document.activeElement !== nameInput) {
      nameInput.value = pData.name || '';
    }

    // Locked
    const lockCb = section.querySelector('.lock-check');
    lockCb.checked = pData.locked || false;
    section.classList.toggle('locked', pData.locked || false);

    // Picks
    const picks = pData.picks || {};
    for (let k = 0; k < 3; k++) {
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

  for (let p = 0; p < 3; p++) {
    const pData = players[p] || {};
    const picks = pData.picks || {};
    const name = pData.name || `Player ${p + 1}`;
    const locked = pData.locked || false;

    let rowsHTML = '';
    for (let k = 0; k < 3; k++) {
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

