// ============================================
// SPEED DATING PRO - JEDNA APLIKACJA
// ============================================

// ========== KONFIGURACJA ==========
let participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
let eventData = JSON.parse(localStorage.getItem('speedDatingEvent')) || {
    status: 'waiting',
    currentRound: 1,
    totalRounds: 3,
    roundTime: 5,
    ratingTime: 2,
    pairings: [],
    ratings: []
};

let currentUser = null;
let timerInterval = null;
let timeLeft = 0;

// ========== SESJE UŻYTKOWNIKÓW ==========
function getUserSessionId() {
    // Pobierz ID sesji z URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    // Jeśli nie ma w URL, sprawdź w localStorage dla tego urządzenia
    if (!sessionId) {
        return localStorage.getItem('userSessionId');
    }
    
    return sessionId;
}

function setUserSessionId(sessionId) {
    // Zapisz w localStorage dla tego urządzenia
    localStorage.setItem('userSessionId', sessionId);
    
    // Zaktualizuj URL bez przeładowania strony
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url);
}

function getCurrentUser() {
    const sessionId = getUserSessionId();
    if (!sessionId) return null;
    
    // Znajdź użytkownika na podstawie ID sesji
    return participants.find(p => p.sessionId === sessionId);
}

function saveUserSession(user) {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    user.sessionId = sessionId;
    setUserSessionId(sessionId);
    return sessionId;
}

// ========== ROZPOZNANIE ROLI ==========
function detectRole() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 1. Sprawdź czy użytkownik ma aktywną sesję
    currentUser = getCurrentUser();
    if (currentUser) {
        showUserPanel();
        return;
    }
    
    // 2. Czy to admin? (bez parametrów i bez zalogowanych adminów)
    const adminKey = localStorage.getItem('adminKey');
    if (!urlParams.has('participant') && !adminKey) {
        showAdminPanel();
        return;
    }
    
    // 3. To nowy użytkownik (?participant w URL lub ?session)
    showRegistrationScreen();
}

// ========== REJESTRACJA UCZESTNIKA ==========
function showRegistrationScreen() {
    hideAllScreens();
    document.getElementById('login-screen').classList.add('active');
    
    // Sprawdź limit uczestników
    if (participants.length >= 50) {
        document.getElementById('login-screen').innerHTML = `
            <div class="waiting-screen" style="text-align: center; padding: 50px;">
                <h2><i class="fas fa-users-slash"></i> Limit osiągnięty</h2>
                <p>Niestety, osiągnięto maksymalną liczbę uczestników (50 osób).</p>
                <p>Skontaktuj się z organizatorem.</p>
            </div>
        `;
        return;
    }
    
    // Obsługa wyboru płci
    document.querySelectorAll('.option-btn:not(.multi)').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.option-btn:not(.multi)').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('reg-gender').value = this.dataset.value;
        });
    });
    
    // Obsługa wyboru zainteresowań
    document.querySelectorAll('.option-btn.multi').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('selected');
            updateInterests();
        });
    });
    
    // Obsługa formularza
    document.getElementById('register-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const gender = document.getElementById('reg-gender').value;
        const interests = document.getElementById('reg-interests').value;
        
        if (!username || !email || !gender || !interests) {
            alert('Proszę wypełnić wszystkie pola!');
            return;
        }
        
        // Sprawdź czy email już istnieje
        if (participants.some(p => p.email === email)) {
            alert('Ten adres email jest już zarejestrowany!');
            return;
        }
        
        // Sprawdź czy nazwa użytkownika już istnieje
        if (participants.some(p => p.username === username)) {
            alert('Ta nazwa użytkownika jest już zajęta!');
            return;
        }
        
        // Stwórz nowego uczestnika
        const newUser = {
            id: Date.now(),
            username: username,
            email: email,
            gender: gender,
            interested: JSON.parse(interests),
            joinedAt: new Date().toISOString(),
            ratings: {},
            tableHistory: [],
            active: true
        };
        
        // Zapisz sesję użytkownika
        const sessionId = saveUserSession(newUser);
        newUser.sessionId = sessionId;
        
        // Dodaj do listy uczestników
        participants.push(newUser);
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
        
        currentUser = newUser;
        showUserPanel();
    });
}

// ========== PANEL UŻYTKOWNIKA (bez zmian w logice) ==========
function showUserPanel() {
    hideAllScreens();
    document.getElementById('user-panel').classList.add('active');
    document.getElementById('user-name').textContent = currentUser.username;
    
    const userContent = document.getElementById('user-content');
    userContent.innerHTML = '';
    
    if (eventData.status === 'waiting') {
        userContent.innerHTML = `
            <div class="waiting-screen">
                <div class="waiting-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <h3>Czekamy na rozpoczęcie</h3>
                <p>Wydarzenie jeszcze się nie rozpoczęło. Organizator poinformuje Cię, 
                kiedy będziesz mógł dołączyć do rozmów.</p>
                <div class="user-info">
                    <p><strong>Twoje dane:</strong></p>
                    <p>Login: ${currentUser.username}</p>
                    <p>Płeć: ${currentUser.gender}</p>
                    <p>Zainteresowania: ${currentUser.interested.join(', ')}</p>
                </div>
                <div class="session-info">
                    <p><small>ID sesji: ${currentUser.sessionId}</small></p>
                </div>
            </div>
        `;
    } else if (eventData.status === 'active') {
        showUserTable();
    } else {
        userContent.innerHTML = `
            <div class="waiting-screen">
                <div class="waiting-icon">
                    <i class="fas fa-flag-checkered"></i>
                </div>
                <h3>Wydarzenie zakończone</h3>
                <p>Dziękujemy za udział! Organizator prześle Ci wyniki dopasowań.</p>
            </div>
        `;
    }
    
    // Wylogowanie
    document.getElementById('user-logout').addEventListener('click', function() {
        localStorage.removeItem('userSessionId');
        
        // Usuń parametr sesji z URL
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.replaceState({}, '', url);
        
        currentUser = null;
        location.href = location.pathname + '?participant';
    });
}

// ========== POPRAWIONY ALGORYTM DOBIERANIA PAR ==========
function generateSmartPairings() {
    const pairings = [];
    const usedPairs = new Set();
    
    // Filtruj tylko aktywnych uczestników
    const activeParticipants = participants.filter(p => p.active !== false);
    
    for (let round = 1; round <= eventData.totalRounds; round++) {
        const roundPairings = {
            round: round,
            pairs: [],
            breakTable: []
        };
        
        // Losowa kolejność uczestników w każdej rundzie
        const availableParticipants = [...activeParticipants];
        shuffleArray(availableParticipants);
        const paired = new Set();
        
        // Krok 1: Znajdź IDEALNE pary (wzajemne zainteresowanie)
        for (let i = 0; i < availableParticipants.length; i++) {
            if (paired.has(availableParticipants[i].id)) continue;
            
            let bestMatch = null;
            let bestMatchScore = -1;
            
            for (let j = i + 1; j < availableParticipants.length; j++) {
                if (paired.has(availableParticipants[j].id)) continue;
                
                const pairKey = `${Math.min(availableParticipants[i].id, availableParticipants[j].id)}-${Math.max(availableParticipants[i].id, availableParticipants[j].id)}`;
                if (usedPairs.has(pairKey)) continue;
                
                // System punktowy dla dopasowania
                let score = 0;
                
                // Wzajemne zainteresowanie płcią: +10 punktów
                if (availableParticipants[i].interested.includes(availableParticipants[j].gender) &&
                    availableParticipants[j].interested.includes(availableParticipants[i].gender)) {
                    score += 10;
                }
                
                // Jednostronne zainteresowanie: +5 punktów
                else if (availableParticipants[i].interested.includes(availableParticipants[j].gender) ||
                         availableParticipants[j].interested.includes(availableParticipants[i].gender)) {
                    score += 5;
                }
                
                // Unikaj par z poprzednich rund
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = j;
                }
            }
            
            if (bestMatch !== null && bestMatchScore > 0) {
                const pairKey = `${Math.min(availableParticipants[i].id, availableParticipants[bestMatch].id)}-${Math.max(availableParticipants[i].id, availableParticipants[bestMatch].id)}`;
                usedPairs.add(pairKey);
                
                roundPairings.pairs.push([
                    availableParticipants[i],
                    availableParticipants[bestMatch]
                ]);
                paired.add(availableParticipants[i].id);
                paired.add(availableParticipants[bestMatch].id);
            }
        }
        
        // Krok 2: Dopasuj pozostałe osoby (bez wzajemnego zainteresowania)
        const remaining = availableParticipants.filter(p => !paired.has(p.id));
        for (let i = 0; i < remaining.length; i += 2) {
            if (i + 1 < remaining.length) {
                const pairKey = `${Math.min(remaining[i].id, remaining[i + 1].id)}-${Math.max(remaining[i].id, remaining[i + 1].id)}`;
                
                if (!usedPairs.has(pairKey)) {
                    roundPairings.pairs.push([remaining[i], remaining[i + 1]]);
                    usedPairs.add(pairKey);
                    paired.add(remaining[i].id);
                    paired.add(remaining[i + 1].id);
                } else {
                    // Jeśli para już była, jedna osoba idzie na przerwę
                    roundPairings.breakTable.push(remaining[i]);
                }
            } else {
                // Nieparzysta liczba osób - ostatnia idzie na przerwę
                roundPairings.breakTable.push(remaining[i]);
            }
        }
        
        // Krok 3: Dodaj do historii stolików
        roundPairings.pairs.forEach(pair => {
            pair.forEach(participant => {
                const user = participants.find(p => p.id === participant.id);
                if (user) {
                    if (!user.tableHistory) user.tableHistory = [];
                    const partner = pair.find(p => p.id !== participant.id);
                    user.tableHistory.push({
                        round: round,
                        partnerId: partner.id,
                        partnerName: partner.username
                    });
                }
            });
        });
        
        pairings.push(roundPairings);
    }
    
    eventData.pairings = pairings;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    
    return pairings;
}

// ========== PANEL ADMINISTRATORA (z ulepszeniami) ==========
function showAdminPanel() {
    hideAllScreens();
    document.getElementById('admin-panel').classList.add('active');
    
    // Załaduj ustawienia
    document.getElementById('round-time').value = eventData.roundTime;
    document.getElementById('rating-time').value = eventData.ratingTime;
    document.getElementById('current-round-display').textContent = eventData.currentRound;
    document.getElementById('anim-round').textContent = eventData.currentRound;
    document.getElementById('total-rounds').value = eventData.totalRounds;
    
    // Wygeneruj URL dla uczestników z unikalnym tokenem
    const participantUrl = window.location.origin + window.location.pathname + '?participant';
    document.getElementById('participant-link').innerHTML = `
        <div style="margin: 15px 0;">
            <p><strong>Link dla uczestników:</strong></p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; word-break: break-all;">
                <code>${participantUrl}</code>
            </div>
            <button onclick="copyToClipboard('${participantUrl}')" class="btn" style="margin-top: 10px;">
                <i class="fas fa-copy"></i> Kopiuj link
            </button>
        </div>
    `;
    
    // Aktualizuj interfejs
    updateAdminInterface();
    
    // Event listeners
    document.getElementById('save-time').addEventListener('click', saveTimeSettings);
    document.getElementById('start-event').addEventListener('click', startEvent);
    document.getElementById('next-round').addEventListener('click', nextRound);
    document.getElementById('end-event').addEventListener('click', endEvent);
    document.getElementById('pause-timer').addEventListener('click', toggleTimer);
    document.getElementById('reset-timer').addEventListener('click', resetTimer);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('refresh-data').addEventListener('click', updateAdminInterface);
    document.getElementById('clear-all').addEventListener('click', clearAllData);
    
    // Auto-odświeżanie co 10 sekund
    setInterval(updateAdminInterface, 10000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link skopiowany do schowka!');
    });
}

function updateAdminInterface() {
    // Pobierz świeże dane
    participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
    eventData = JSON.parse(localStorage.getItem('speedDatingEvent')) || eventData;
    
    // Aktualizuj licznik
    const activeParticipants = participants.filter(p => p.active !== false);
    document.getElementById('participant-count').textContent = `${activeParticipants.length}/50`;
    
    // Aktualizuj listę uczestników
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = activeParticipants.map(p => `
        <div class="participant-item">
            <div class="participant-info">
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div>
                    <strong>${p.username}</strong>
                    <p style="font-size: 12px; color: #666;">
                        ${p.email} • ${p.gender} • 
                        Szuka: ${Array.isArray(p.interested) ? p.interested.join(', ') : p.interested}
                    </p>
                </div>
            </div>
            <div class="participant-status ${getParticipantStatusClass(p.id)}">
                ${getParticipantStatus(p.id)}
                ${p.sessionId ? `<br><small style="font-size: 10px;">Online</small>` : ''}
            </div>
        </div>
    `).join('');
    
    // Aktualizuj statystyki
    updateStatistics();
    
    // Aktualizuj animację stolików
    updateTablesAnimation();
}

function getParticipantStatusClass(userId) {
    if (eventData.status !== 'active') return 'status-waiting';
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    if (!roundPairings) return 'status-waiting';
    
    for (const pair of roundPairings.pairs) {
        if (pair.find(p => p.id === userId)) return 'status-paired';
    }
    
    if (roundPairings.breakTable?.find(p => p.id === userId)) return 'status-break';
    
    return 'status-waiting';
}

function updateStatistics() {
    const activeParticipants = participants.filter(p => p.active !== false);
    const pairsCount = eventData.pairings.length > 0 ? 
        eventData.pairings[eventData.currentRound - 1]?.pairs.length || 0 : 0;
    const breakCount = eventData.pairings.length > 0 ?
        eventData.pairings[eventData.currentRound - 1]?.breakTable?.length || 0 : 0;
    
    let yesCount = 0;
    let matches = 0;
    
    if (eventData.ratings) {
        yesCount = eventData.ratings.filter(r => r.rating === 'yes').length;
        
        // Znajdź wzajemne dopasowania (obie osoby dały sobie TAK)
        const mutualMatches = {};
        eventData.ratings.forEach(rating => {
            if (rating.rating === 'yes') {
                const key = `${Math.min(rating.from, rating.to)}-${Math.max(rating.from, rating.to)}`;
                if (!mutualMatches[key]) mutualMatches[key] = { from: rating.from, to: rating.to, count: 0 };
                mutualMatches[key].count++;
            }
        });
        
        matches = Object.values(mutualMatches).filter(m => m.count === 2).length;
    }
    
    document.getElementById('pairs-count').textContent = pairsCount;
    document.getElementById('break-count').textContent = breakCount;
    document.getElementById('yes-count').textContent = yesCount;
    document.getElementById('matches-count').textContent = matches;
    document.getElementById('total-participants').textContent = activeParticipants.length;
}

function saveTimeSettings() {
    eventData.roundTime = parseInt(document.getElementById('round-time').value);
    eventData.ratingTime = parseInt(document.getElementById('rating-time').value);
    eventData.totalRounds = parseInt(document.getElementById('total-rounds').value);
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    alert('Ustawienia zapisane!');
}

function startEvent() {
    const activeParticipants = participants.filter(p => p.active !== false);
    if (activeParticipants.length < 2) {
        alert('Potrzeba co najmniej 2 uczestników!');
        return;
    }
    
    if (activeParticipants.length % 2 !== 0) {
        if (!confirm('Nieparzysta liczba uczestników. Jedna osoba będzie miała przerwę w każdej rundzie. Kontynuować?')) {
            return;
        }
    }
    
    generateSmartPairings();
    
    eventData.status = 'active';
    eventData.currentRound = 1;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    startMainTimer();
    updateAdminInterface();
    
    alert(`Wydarzenie rozpoczęte! ${activeParticipants.length} uczestników, ${eventData.totalRounds} rund.`);
}

function clearAllData() {
    if (confirm('CZY NA PEWNO? To usunie wszystkich uczestników i dane wydarzenia!')) {
        localStorage.removeItem('speedDatingParticipants');
        localStorage.removeItem('speedDatingEvent');
        participants = [];
        eventData = {
            status: 'waiting',
            currentRound: 1,
            totalRounds: 3,
            roundTime: 5,
            ratingTime: 2,
            pairings: [],
            ratings: []
        };
        updateAdminInterface();
        alert('Wszystkie dane zostały usunięte!');
    }
}

// ========== URUCHOMIENIE APLIKACJI ==========
document.addEventListener('DOMContentLoaded', function() {
    detectRole();
    
    // Dodaj CSS dla statusów
    const style = document.createElement('style');
    style.textContent = `
        .status-waiting { background: #f0f0f0; color: #666; }
        .status-paired { background: #4CAF50; color: white; }
        .status-break { background: #FF9800; color: white; }
        .participant-status {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            text-align: center;
            min-width: 80px;
        }
    `;
    document.head.appendChild(style);
});
