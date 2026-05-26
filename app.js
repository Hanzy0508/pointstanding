// Poin system
const RANK_POINTS = {
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6,
    6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
    11: 0, 12: 0
};

let tournamentData = {
    ftName: '',
    captains: [],
    matches: {}
};

// DOM Elements
document.getElementById('calculateBtn').addEventListener('click', calculateStandings);
document.getElementById('showBreakdownBtn')?.addEventListener('click', showBreakdown);
document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('breakdownModal').classList.add('hidden');
});

async function calculateStandings() {
    // Get FT Name
    tournamentData.ftName = document.getElementById('ftName').value || 'Unknown FT';
    
    // Get captains list
    const captainsInput = document.getElementById('captains').value;
    tournamentData.captains = captainsInput.split(/[,\n]/).map(c => c.trim()).filter(c => c);
    
    if (tournamentData.captains.length === 0) {
        alert('Masukkan nama kapten tim!');
        return;
    }
    
    // Collect images
    const matches = {};
    for (let match = 1; match <= 6; match++) {
        const leftInput = document.querySelector(`.match-left[data-match="${match}"]`);
        const rightInput = document.querySelector(`.match-right[data-match="${match}"]`);
        
        if (leftInput && leftInput.files[0] && rightInput && rightInput.files[0]) {
            matches[match] = {
                left: leftInput.files[0],
                right: rightInput.files[0]
            };
        } else if (match <= 3 && (!leftInput?.files[0] || !rightInput?.files[0])) {
            alert(`Match ${match} wajib diisi!`);
            return;
        }
    }
    
    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    // Process each match
    const allMatchResults = {};
    
    for (const [matchNum, images] of Object.entries(matches)) {
        try {
            const result = await scanMatchImages(images.left, images.right, matchNum);
            allMatchResults[matchNum] = result;
        } catch (error) {
            console.error(`Error scanning match ${matchNum}:`, error);
            allMatchResults[matchNum] = {};
        }
    }
    
    // Calculate standings
    const standings = calculateTotalPoints(allMatchResults);
    
    // Display results
    displayStandings(standings, allMatchResults);
    
    // Hide loading
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
}

async function scanMatchImages(leftImage, rightImage, matchNum) {
    // Simulasi AI scan (karena API key perlu di backend)
    // Di production, panggil API ke /api/scan-match
    
    const formData = new FormData();
    formData.append('left', leftImage);
    formData.append('right', rightImage);
    formData.append('match', matchNum);
    formData.append('captains', JSON.stringify(tournamentData.captains));
    
    try {
        const response = await fetch('/api/scan-match', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Scan failed');
        
        return await response.json();
    } catch (error) {
        console.warn('Backend not available, using mock data');
        return generateMockData(matchNum);
    }
}

function generateMockData(matchNum) {
    // Mock data untuk testing
    const mockResults = {};
    tournamentData.captains.forEach((captain, idx) => {
        const rank = (idx % 12) + 1;
        const kills = Math.floor(Math.random() * 15);
        mockResults[captain] = {
            rank: rank,
            kills: kills,
            rankPoints: RANK_POINTS[rank] || 0,
            totalPoints: (RANK_POINTS[rank] || 0) + kills,
            isBooyah: rank === 1
        };
    });
    return mockResults;
}

function calculateTotalPoints(allMatchResults) {
    const standings = {};
    
    tournamentData.captains.forEach(captain => {
        standings[captain] = {
            totalPoints: 0,
            totalKills: 0,
            booyahCount: 0,
            matches: []
        };
    });
    
    for (const [matchNum, matchResult] of Object.entries(allMatchResults)) {
        for (const [captain, data] of Object.entries(matchResult)) {
            if (standings[captain]) {
                standings[captain].totalPoints += data.totalPoints;
                standings[captain].totalKills += data.kills;
                if (data.isBooyah) standings[captain].booyahCount++;
                standings[captain].matches.push({
                    match: matchNum,
                    rank: data.rank,
                    kills: data.kills,
                    points: data.totalPoints
                });
            }
        }
    }
    
    // Sort: points desc, booyah desc, kills desc
    const sorted = Object.entries(standings).sort((a, b) => {
        if (a[1].totalPoints !== b[1].totalPoints) {
            return b[1].totalPoints - a[1].totalPoints;
        }
        if (a[1].booyahCount !== b[1].booyahCount) {
            return b[1].booyahCount - a[1].booyahCount;
        }
        return b[1].totalKills - a[1].totalKills;
    });
    
    return sorted;
}

function displayStandings(standings, matchDetails) {
    const ftDisplay = document.getElementById('ftDisplay');
    ftDisplay.innerHTML = `<strong>🏢 ${tournamentData.ftName}</strong>`;
    
    let html = '<table><thead><tr>';
    html += '<th>No</th><th>Team Name</th><th>🏆 Booyah</th><th>💀 Kills</th><th>⭐ ST Points</th><th>📊 Total Pts</th><th>🥇 Juara</th>';
    html += '</tr></thead><tbody>';
    
    standings.forEach(([team, data], idx) => {
        const rank = idx + 1;
        let rankClass = '';
        let trophy = '';
        
        if (rank === 1) {
            rankClass = 'rank-1';
            trophy = '🥇';
        } else if (rank === 2) {
            rankClass = 'rank-2';
            trophy = '🥈';
        } else if (rank === 3) {
            rankClass = 'rank-3';
            trophy = '🥉';
        }
        
        html += `<tr class="${rankClass}">`;
        html += `<td>${rank}</td>`;
        html += `<td><strong>${team}</strong></td>`;
        html += `<td>${data.booyahCount}</td>`;
        html += `<td>${data.totalKills}</td>`;
        html += `<td>${data.totalPoints - data.totalKills}</td>`;
        html += `<td><strong>${data.totalPoints}</strong></td>`;
        html += `<td class="trophy">${trophy}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    document.getElementById('standingsTable').innerHTML = html;
    
    // Store match details for breakdown
    window.matchDetails = matchDetails;
    window.standingsData = standings;
}

function showBreakdown() {
    const breakdownContent = document.getElementById('breakdownContent');
    let html = '';
    
    window.standingsData.forEach(([team, data]) => {
        html += `<div style="margin-bottom: 30px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px;">`;
        html += `<h3 style="color: #ffd700;">${team}</h3>`;
        html += `<table style="width: 100%; margin-top: 10px;">`;
        html += `<thead><tr><th>Match</th><th>Rank</th><th>Kills</th><th>Rank Points</th><th>Match Points</th></tr></thead><tbody>`;
        
        data.matches.forEach(match => {
            html += `<tr>`;
            html += `<td>Match ${match.match}</td>`;
            html += `<td>#${match.rank}</td>`;
            html += `<td>${match.kills}</td>`;
            html += `<td>${match.points - match.kills}</td>`;
            html += `<td><strong>${match.points}</strong></td>`;
            html += `</tr>`;
        });
        
        html += `<tr style="background: rgba(255,215,0,0.2);">`;
        html += `<td colspan="3"><strong>TOTAL</strong></td>`;
        html += `<td><strong>${data.totalPoints - data.totalKills}</strong></td>`;
        html += `<td><strong>${data.totalPoints}</strong></td>`;
        html += `</tr>`;
        html += `</tbody></table></div>`;
    });
    
    breakdownContent.innerHTML = html;
    document.getElementById('breakdownModal').classList.remove('hidden');
}

// Close modal on click outside
window.onclick = function(event) {
    const modal = document.getElementById('breakdownModal');
    if (event.target === modal) {
        modal.classList.add('hidden');
    }
};
