(function() {
  const RANK_POINTS = {1:12,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1,11:0,12:0};
  const MAX_MATCHES = 6;
  const MIN_MATCHES = 3;
  const SLOTS_PER_MATCH = 2;
  const matchData = Array.from({length: MAX_MATCHES}, () => [null, null]);

  function buildMatchGrid() {
    const grid = document.getElementById('matchGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let m = 0; m < MAX_MATCHES; m++) {
      const isRequired = m < MIN_MATCHES;
      const block = document.createElement('div');
      block.className = 'match-block';
      const dotClass = isRequired ? 'req-dot' : 'opt-dot';
      const label = isRequired ? 'Wajib' : 'Opsional';
      block.innerHTML = `<div class="match-block-title"><span class="${dotClass}"></span>MATCH ${m + 1}<span style="font-size:8px;color:${isRequired ? '#3a7bd5' : '#2a3a5a'}">${label}</span></div><div class="slot-row" id="slots-${m}"></div>`;
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
    const optLabel = s === 1 ? '<span class="slot-opt-badge">opsional</span>' : '';
    wrapper.innerHTML = `<div class="slot-icon">📷</div><div class="slot-label">${s === 0 ? 'Foto A' : 'Foto B'}</div>${optLabel}<input type="file" id="file-${m}-${s}" accept="image/*">`;
    wrapper.querySelector('input').addEventListener('change', (e) => handleFile(e, m, s));
    return wrapper;
  }

  function triggerInput(m, s) {
    document.getElementById(`file-${m}-${s}`).click();
  }

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
      slot.innerHTML = `<img class="slot-preview" src="${data.preview}"><div class="slot-overlay"><button class="remove-btn" onclick="window.removeSlot(event,${m},${s})">✕ Hapus</button></div>${optLabel}<input type="file" id="file-${m}-${s}" accept="image/*">`;
      slot.querySelector('input').addEventListener('change', (e) => handleFile(e, m, s));
      slot.onclick = (e) => { if (!e.target.closest('.slot-overlay')) triggerInput(m, s); };
    } else {
      const newSlot = createSlot(m, s);
      slot.replaceWith(newSlot);
    }
  }

  window.removeSlot = function(e, m, s) {
    e.stopPropagation();
    matchData[m][s] = null;
    const slot = document.getElementById(`slot-${m}-${s}`);
    if (slot) slot.replaceWith(createSlot(m, s));
    updateStatus();
  };

  function getActiveMatches() {
    return matchData.map((slots, idx) => ({ idx, slotA: slots[0], slotB: slots[1] })).filter(m => m.slotA !== null);
  }

  function updateStatus() {
    const active = getActiveMatches().length;
    const countInfo = document.getElementById('matchCountInfo');
    const btn = document.getElementById('btnCalculate');
    if (countInfo) countInfo.textContent = `${active} match diupload (min. ${MIN_MATCHES})`;
    if (btn) btn.disabled = active < MIN_MATCHES;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 5000);
  }

  function setStep(msg) {
    const step = document.getElementById('loadingStep');
    if (step) step.textContent = msg;
  }

  function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('active', show);
  }

  function toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function extractMatch(matchIdx, slotA, slotB, captains) {
    const capList = captains.join(', ');
    const prompt = `Ini screenshot Free Fire Match ${matchIdx + 1}. ${slotB ? 'Ada 2 gambar.' : 'Ada 1 gambar.'} Cari nama kapten dari daftar: ${capList}. Beri rank (1-12) dan total kill tim kapten. Kembalikan JSON: {"match":${matchIdx + 1},"results":[{"captain":"nama","rank":angka,"kills":angka,"found":true/false}]}`;
    
    const contents = [];
    const b64A = await toBase64(slotA.file);
    contents.push({ type: 'image_url', image_url: { url: `data:${slotA.file.type};base64,${b64A}` } });
    if (slotB) {
      const b64B = await toBase64(slotB.file);
      contents.push({ type: 'image_url', image_url: { url: `data:${slotB.file.type};base64,${b64B}` } });
    }
    contents.push({ type: 'text', text: prompt });

    const resp = await fetch('/api/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: contents }], max_tokens: 1000 })
    });
    if (!resp.ok) throw new Error(`API Error ${resp.status}`);
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }

  window.calculate = async function() {
    const ftName = document.getElementById('ftName').value.trim();
    const capRaw = document.getElementById('captainNames').value.trim();
    if (!ftName) return showToast('Nama FT wajib diisi!');
    if (!capRaw) return showToast('Nama kapten wajib diisi!');
    const captains = capRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!captains.length) return showToast('Masukkan nama kapten!');
    const activeMatches = getActiveMatches();
    if (activeMatches.length < MIN_MATCHES) return showToast(`Upload minimal ${MIN_MATCHES} foto!`);
    
    showLoading(true);
    const allResults = [];
    try {
      for (let i = 0; i < activeMatches.length; i++) {
        const { idx, slotA, slotB } = activeMatches[i];
        setStep(`Match ${idx + 1}... (${i + 1}/${activeMatches.length})`);
        allResults.push(await extractMatch(idx, slotA, slotB, captains));
        setStep(`Match ${idx + 1} selesai ✓`);
        await new Promise(r => setTimeout(r, 300));
      }
      setStep('Menghitung standing...');
      await new Promise(r => setTimeout(r, 400));
      
      const stats = {};
      captains.forEach(cap => { stats[cap] = { captain: cap, booyah: 0, totalKills: 0, stPoints: 0, matches: [] }; });
      allResults.forEach(matchResult => {
        if (matchResult?.results) {
          matchResult.results.forEach(r => {
            const s = stats[r.captain];
            if (s) {
              const rp = RANK_POINTS[r.rank] || 0;
              s.totalKills += r.kills;
              s.stPoints += rp;
              if (r.rank === 1) s.booyah++;
              s.matches.push({ match: matchResult.match, rank: r.rank, kills: r.kills, found: r.found, rankPts: rp });
            }
          });
        }
      });
      const rows = captains.map(cap => { const s = stats[cap]; s.totalPts = s.stPoints + s.totalKills; return s; });
      rows.sort((a, b) => {
        if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
        if (b.booyah !== a.booyah) return b.booyah - a.booyah;
        return b.totalKills - a.totalKills;
      });
      
      const tbody = document.getElementById('standingsBody');
      if (tbody) {
        tbody.innerHTML = '';
        const trophies = ['🥇', '🥈', '🥉'];
        rows.forEach((row, idx) => {
          const rank = idx + 1;
          tbody.innerHTML += `<tr class="${rank <= 3 ? 'rank-' + rank : ''}"><td>${String(rank).padStart(2,'0')}</td><td style="text-align:left">${row.captain}</td><td>${row.booyah}</td><td>${row.totalKills}</td><td>${row.stPoints}</td><td class="total-pts">${row.totalPts}</td><td>${rank <= 3 ? '<span class="trophy">' + trophies[rank-1] + '</span>' : ''}</td></tr>`;
        });
      }
      
      const table = document.getElementById('breakdownTable');
      if (table) {
        let html = '<table class="breakdown-table"><tr><th>Kapten</th>';
        for (let m = 0; m < activeMatches.length; m++) html += `<th colspan="3">Match ${m+1}</th>`;
        html += '<th>Total</th></tr>';
        html += '<tr><th></th>';
        for (let m = 0; m < activeMatches.length; m++) html += '<th>Rank</th><th>Kill</th><th>Pts</th>';
        html += '<th></th></tr>';
        rows.forEach(row => {
          html += `<tr><td>${row.captain}</td>`;
          for (let m = 0; m < activeMatches.length; m++) {
            const md = row.matches.find(x => x.match === m+1);
            if (md && md.found) html += `<td>#${md.rank}</td><td>${md.kills}</td><td>${md.rankPts + md.kills}</td>`;
            else html += `<td>-</td><td>-</td><td>0</td>`;
          }
          html += `<td>${row.totalPts}</td></tr>`;
        });
        html += '</table>';
        table.innerHTML = html;
      }
      
      document.getElementById('ftCreditName').textContent = ftName;
      document.getElementById('formSection').style.display = 'none';
      document.getElementById('resultSection').classList.add('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      showToast('Error: ' + err.message);
    } finally {
      showLoading(false);
    }
  };

  window.toggleBreakdown = function() {
    const wrap = document.getElementById('breakdownWrap');
    if (wrap) {
      wrap.classList.toggle('visible');
      const btn = document.querySelector('.btn-toggle');
      if (btn) btn.textContent = wrap.classList.contains('visible') ? 'Sembunyikan Detail ▴' : 'Detail Per Match ▾';
    }
  };

  window.resetAll = function() {
    for (let m = 0; m < MAX_MATCHES; m++) matchData[m] = [null, null];
    document.getElementById('ftName').value = '';
    document.getElementById('captainNames').value = '';
    document.getElementById('breakdownWrap')?.classList.remove('visible');
    document.getElementById('resultSection')?.classList.remove('visible');
    document.getElementById('formSection').style.display = 'block';
    buildMatchGrid();
    updateStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  buildMatchGrid();
  updateStatus();
})();
