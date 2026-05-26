// ============================================================
// CONFIG
// ============================================================
const RANK_POINTS = {1:12,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1,11:0,12:0};
const MAX_MATCHES = 6;
const MIN_MATCHES = 3;
const SLOTS_PER_MATCH = 2;

// matchData[matchIdx][slotIdx] = { file, preview }
const matchData = Array.from({length: MAX_MATCHES}, () => [null, null]);

// ============================================================
// BUILD GRID
// ============================================================
function buildMatchGrid() {
  const grid = document.getElementById('matchGrid');
  if (!grid) {
    console.error('Element matchGrid tidak ditemukan!');
    return;
  }
  grid.innerHTML = '';

  for (let m = 0; m < MAX_MATCHES; m++) {
    const isRequired = m < MIN_MATCHES;
    const block = document.createElement('div');
    block.className = 'match-block';
    block.id = `block-${m}`;

    const dotClass = isRequired ? 'req-dot' : 'opt-dot';
    const label = isRequired ? 'Wajib' : 'Opsional';

    block.innerHTML = `
      <div class="match-block-title">
        <span class="${dotClass}"></span>
        MATCH ${m + 1}
        <span style="font-size:8px;color:${isRequired ? '#3a7bd5' : '#2a3a5a'}">${label}</span>
      </div>
      <div class="slot-row" id="slots-${m}"></div>
    `;
    grid.appendChild(block);

    const slotRow = block.querySelector(`#slots-${m}`);
    if (slotRow) {
      for (let s = 0; s < SLOTS_PER_MATCH; s++) {
        slotRow.appendChild(createSlot(m, s));
      }
    }
  }
}

function createSlot(m, s) {
  const wrapper = document.createElement('div');
  wrapper.className = 'match-slot';
  wrapper.id = `slot-${m}-${s}`;
  wrapper.onclick = () => triggerInput(m, s);

  const optLabel = s === 1
    ? '<span class="slot-opt-badge">opsional</span>'
    : '';

  wrapper.innerHTML = `
    <div class="slot-icon">📷</div>
    <div class="slot-label">${s === 0 ? 'Foto A' : 'Foto B'}</div>
    ${optLabel}
    <input type="file" id="file-${m}-${s}" accept="image/*">
  `;

  const fileInput = wrapper.querySelector('input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => handleFile(e, m, s));
  }
  return wrapper;
}

function triggerInput(m, s) {
  const input = document.getElementById(`file-${m}-${s}`);
  if (input) input.click();
}

// ============================================================
// FILE HANDLING
// ============================================================
function handleFile(e, m, s) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    matchData[m][s] = { file, preview: ev.target.result };
    renderSlot(m, s);
    updateStatus();
  };
  reader.readAsDataURL(file);
}

function renderSlot(m, s) {
  const slot = document.getElementById(`slot-${m}-${s}`);
  if (!slot) return;
  const data = matchData[m][s];
  const optLabel = s === 1 ? '<span class="slot-opt-badge">opsional</span>' : '';

  if (data && data.preview) {
    slot.className = 'match-slot has-image';
    slot.innerHTML = `
      <img class="slot-preview" src="${data.preview}" alt="Match ${m+1} Foto ${s+1}">
      <div class="slot-overlay">
        <button class="remove-btn" onclick="removeSlot(event,${m},${s})">✕ Hapus</button>
      </div>
      ${optLabel}
      <input type="file" id="file-${m}-${s}" accept="image/*">
    `;
    const fileInput = slot.querySelector('input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => handleFile(e, m, s));
    }
    slot.onclick = (e) => {
      if (!e.target.closest('.slot-overlay')) triggerInput(m, s);
    };
  } else {
    const newSlot = createSlot(m, s);
    slot.replaceWith(newSlot);
  }
}

function removeSlot(e, m, s) {
  e.stopPropagation();
  matchData[m][s] = null;
  const slot = document.getElementById(`slot-${m}-${s}`);
  if (slot) {
    const newSlot = createSlot(m, s);
    slot.replaceWith(newSlot);
  }
  updateStatus();
}

// ============================================================
// STATUS
// ============================================================
function getActiveMatches() {
  return matchData
    .map((slots, idx) => ({ idx, slotA: slots[0], slotB: slots[1] }))
    .filter(m => m.slotA !== null);
}

function updateStatus() {
  const active = getActiveMatches().length;
  const countInfo = document.getElementById('matchCountInfo');
  const btn = document.getElementById('btnCalculate');
  if (countInfo) countInfo.textContent = `${active} match diupload (min. ${MIN_MATCHES})`;
  if (btn) btn.disabled = active < MIN_MATCHES;
}

// ============================================================
// TOAST / LOADING
// ============================================================
function showToast(msg, dur = 5000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), dur);
}

function setStep(msg) {
  const step = document.getElementById('loadingStep');
  if (step) step.textContent = msg;
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.toggle('active', show);
}

// ============================================================
// IMAGE → BASE64
// ============================================================
function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(',')[1]);
    r.onerror = () => rej(new Error('Gagal membaca gambar'));
    r.readAsDataURL(file);
  });
}

// ============================================================
// API CALL PER MATCH - DEEPSEEK
// ============================================================
async function extractMatch(matchIdx, slotA, slotB, captains) {
  const capList = captains.join(', ');

  const prompt = `Ini adalah screenshot hasil akhir Free Fire Match ${matchIdx + 1}.
${slotB ? 'Ada 2 gambar: sisi kiri dan sisi kanan layar hasil match.' : 'Ada 1 gambar hasil match.'}

Daftar nama kapten yang harus dicari: ${capList}

TUGAS:
1. Baca semua nama pemain dari gambar.
2. Cari nama kapten atau yang paling mirip di antara semua pemain.
3. Catat POSISI/RANK tim kapten (angka 1-12).
4. Catat TOTAL KILL semua anggota tim kapten.
5. Jika tidak ditemukan sama sekali: rank 0, kills 0, found false.

CATATAN:
- Nama bisa sedikit berbeda (spasi, karakter khusus, huruf besar/kecil).
- Jumlahkan semua kill seluruh anggota tim kapten.
- Kembalikan HANYA JSON mentah, tanpa markdown, tanpa backtick.

Format wajib:
{"match":${matchIdx + 1},"results":[{"captain":"nama","rank":angka,"kills":angka,"found":true_atau_false}]}`;

  const contents = [];
  
  const b64A = await toBase64(slotA.file);
  const mimeA = slotA.file.type || 'image/jpeg';
  contents.push({
    type: 'image_url',
    image_url: { url: `data:${mimeA};base64,${b64A}` }
  });
  
  if (slotB) {
    const b64B = await toBase64(slotB.file);
    const mimeB = slotB.file.type || 'image/jpeg';
    contents.push({
      type: 'image_url',
      image_url: { url: `data:${mimeB};base64,${b64B}` }
    });
  }
  
  contents.push({ type: 'text', text: prompt });

  const resp = await fetch('/api/deepseek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: contents }],
      max_tokens: 1000
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const raw = (data.choices?.[0]?.message?.content || '').trim();
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Gagal parse JSON match ${matchIdx + 1}: ${clean.slice(0, 120)}`);
  }
}

// ============================================================
// MAIN CALCULATE
// ============================================================
async function calculate() {
  const ftName = document.getElementById('ftName').value.trim();
  const capRaw = document.getElementById('captainNames').value.trim();

  if (!ftName) { showToast('Nama FT wajib diisi!'); return; }
  if (!capRaw) { showToast('Nama kapten wajib diisi!'); return; }

  const captains = capRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  if (!captains.length) { showToast('Masukkan minimal 1 nama kapten!'); return; }

  const activeMatches = getActiveMatches();
  if (activeMatches.length < MIN_MATCHES) {
    showToast(`Upload minimal ${MIN_MATCHES} foto Match (Foto A setiap match wajib ada)!`);
    return;
  }

  showLoading(true);
  const allResults = [];

  try {
    for (let i = 0; i < activeMatches.length; i++) {
      const { idx, slotA, slotB } = activeMatches[i];
      setStep(`Membaca Match ${idx + 1}... (${i + 1}/${activeMatches.length})`);
      const result = await extractMatch(idx, slotA, slotB, captains);
      allResults.push(result);
      setStep(`Match ${idx + 1} selesai ✓`);
      await new Promise(r => setTimeout(r, 300));
    }

    setStep('Menghitung total standing...');
    await new Promise(r => setTimeout(r, 400));
    buildStandings(captains, allResults, ftName, activeMatches.length);
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 7000);
  } finally {
    showLoading(false);
  }
}

// ============================================================
// BUILD STANDINGS
// ============================================================
function buildStandings(captains, allResults, ftName, matchCount) {
  const stats = {};
  captains.forEach(cap => {
    stats[cap] = { captain: cap, booyah: 0, totalKills: 0, stPoints: 0, matches: [] };
  });

  allResults.forEach(matchResult => {
    if (matchResult && matchResult.results) {
      matchResult.results.forEach(r => {
        const s = stats[r.captain];
        if (!s) return;
        const rp = RANK_POINTS[r.rank] || 0;
        s.totalKills += r.kills;
        s.stPoints += rp;
        if (r.rank === 1) s.booyah++;
        s.matches.push({ match: matchResult.match, rank: r.rank, kills: r.kills, found: r.found, rankPts: rp });
      });
    }
  });

  const rows = captains.map(cap => {
    const s = stats[cap];
    s.totalPts = s.stPoints + s.totalKills;
    return s;
  });

  rows.sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    if (b.booyah !== a.booyah) return b.booyah - a.booyah;
    return b.totalKills - a.totalKills;
  });

  renderStandings(rows, ftName, matchCount, allResults);
}

// ============================================================
// RENDER RESULT
// ============================================================
function renderStandings(rows, ftName, matchCount, allResults) {
  const tbody = document.getElementById('standingsBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const trophies = ['🥇', '🥈', '🥉'];

  rows.forEach((row, idx) => {
    const rank = idx + 1;
    const tr = document.createElement('tr');
    tr.className = `table-row ${rank <= 3 ? 'rank-' + rank : ''}`;
    tr.innerHTML = `
      <td style="text-align:center">${String(rank).padStart(2, '0')}</td>
      <td style="text-align:left">${esc(row.captain)}</td>
      <td class="num-cell" style="text-align:center">${row.booyah}</td>
      <td class="num-cell" style="text-align:center">${row.totalKills}</td>
      <td class="num-cell" style="text-align:center">${row.stPoints}</td>
      <td class="total-pts" style="text-align:center">${row.totalPts}</td>
      <td style="text-align:center">${rank <= 3 ? '<span class="trophy">' + trophies[rank - 1] + '</span>' : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  buildBreakdown(rows, matchCount);

  const ftCredit = document.getElementById('ftCreditName');
  if (ftCredit) ftCredit.textContent = ftName;
  const formSection = document.getElementById('formSection');
  const resultSection = document.getElementById('resultSection');
  if (formSection) formSection.style.display = 'none';
  if (resultSection) resultSection.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildBreakdown(rows, matchCount) {
  const table = document.getElementById('breakdownTable');
  if (!table) return;
  let html = '<table class="breakdown-table"><tr><th>Kapten</th>';
  for (let m = 0; m < matchCount; m++) {
    html += `<th colspan="3">Match ${m + 1}</th>`;
  }
  html += '<th>Total</th></tr>';
  html += '<tr><th></th>';
  for (let m = 0; m < matchCount; m++) {
    html += '<th>Rank</th><th>Kill</th><th>Pts</th>';
  }
  html += '<th></th></tr>';

  rows.forEach(row => {
    html += `<tr><td style="text-align:left;font-weight:600;">${esc(row.captain)}</td>`;
    for (let m = 0; m < matchCount; m++) {
      const md = row.matches.find(x => x.match === m + 1);
      if (md && md.found) {
        html += `<td style="color:#7aabff;text-align:center">#${md.rank}</td><td style="color:#7aabff;text-align:center">${md.kills}</td><td style="color:#FFD700;text-align:center">${md.rankPts + md.kills}</td>`;
      } else {
        html += `<td style="color:#333;text-align:center">-</td><td style="color:#333;text-align:center">-</td><td style="color:#333;text-align:center">0</td>`;
      }
    }
    html += `<td style="color:#FFD700;font-weight:700;text-align:center">${row.totalPts}</td></tr>`;
  });
  html += '</table>';
  table.innerHTML = html;
}

function toggleBreakdown() {
  const wrap = document.getElementById('breakdownWrap');
  if (!wrap) return;
  wrap.classList.toggle('visible');
  const btn = document.querySelector('.btn-toggle');
  if (btn) btn.textContent = wrap.classList.contains('visible') ? 'Sembunyikan Detail ▴' : 'Detail Per Match ▾';
}

function resetAll() {
  for (let m = 0; m < MAX_MATCHES; m++) {
    matchData[m] = [null, null];
  }
  const ftName = document.getElementById('ftName');
  const captainNames = document.getElementById('captainNames');
  if (ftName) ftName.value = '';
  if (captainNames) captainNames.value = '';
  const breakdownWrap = document.getElementById('breakdownWrap');
  if (breakdownWrap) breakdownWrap.classList.remove('visible');
  const resultSection = document.getElementById('resultSection');
  const formSection = document.getElementById('formSection');
  if (resultSection) resultSection.classList.remove('visible');
  if (formSection) formSection.style.display = 'block';
  buildMatchGrid();
  updateStatus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// INIT - PASTIKAN DOM UDH SIAP
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  buildMatchGrid();
  updateStatus();
});
