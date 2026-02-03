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
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    if (!sessionId) {
        return localStorage.getItem('userSessionId');
    }
    
    return sessionId;
}

function setUserSessionId(sessionId) {
    localStorage.setItem('userSessionId', sessionId);
    
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url);
}

function getCurrentUser() {
    const sessionId = getUserSessionId();
    if (!sessionId) return null;
    
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
    
    // Sprawdź czy użytkownik ma aktywną sesję
    currentUser = getCurrentUser();
    if (currentUser) {
        showUserPanel();
        return;
    }
    
    // Czy to admin? (brak parametru participant i session)
    const hasParticipant = urlParams.has('participant');
    const hasSession = urlParams.has('session');
    
    if (!hasParticipant && !hasSession) {
        // To admin - pokaż start screen
        showStartScreen();
        return;
    }
    
    // To nowy użytkownik
    showRegistrationScreen();
}

// ========== EKRAN START DLA ADMINA ==========
function showStartScreen() {
    hideAllScreens();
    
    // Pokaż animację ładowania
    document.getElementById('loading-screen').classList.add('active');
    
    // Po krótkim czasie przejdź do admin panelu
    setTimeout(() => {
        document.getElementById('loading-screen').classList.remove('active');
        showAdminPanel();
    }, 1000);
}

// ========== REJESTRACJA UCZESTNIKA ==========
function showRegistrationScreen() {
    hideAllScreens();
    
    // Sprawdź limit
    const activeParticipants = participants.filter(p => p.active !== false);
    if (activeParticipants.length >= 50) {
        document.getElementById('login-screen').innerHTML = `
            <div class="screen active" id="limit-screen" style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                <div style="text-align: center; max-width: 500px; padding: 30px; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div style="font-size: 60px; color: #f44336; margin-bottom: 20px;">
                        <i class="fas fa-users-slash"></i>
                    </div>
                    <h2 style="margin-bottom: 20px; color: #333;">Limit uczestników osiągnięty</h2>
                    <p style="margin-bottom: 20px; color: #666; line-height: 1.6;">
                        Niestety, osiągnięto maksymalną liczbę uczestników (50 osób).
                        <br>Nie możesz dołączyć do tego wydarzenia.
                    </p>
                    <p style="font-size: 14px; color: #999;">
                        Skontaktuj się z organizatorem w celu uzyskania więcej informacji.
                    </p>
                </div>
            </div>
        `;
        return;
    }
    
    // Pokaż normalny ekran rejestracji
    document.getElementById('login-screen').classList.add('active');
    
    // Inicjalizacja elementów UI
    initializeRegistrationForm();
}

function initializeRegistrationForm() {
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
    const form = document.getElementById('register-form');
    if (form) {
        form.addEventListener('submit', handleRegistration);
    }
}

function updateInterests() {
    const selected = Array.from(document.querySelectorAll('.option-btn.multi.selected'))
        .map(btn => btn.dataset.value);
    document.getElementById('reg-interests').value = JSON.stringify(selected);
}

function handleRegistration(e) {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const gender = document.getElementById('reg-gender').value;
    const interests = document.getElementById('reg-interests').value;
    
    // Walidacja
    if (!username || !email || !gender || !interests) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }
    
    if (!validateEmail(email)) {
        alert('Proszę podać poprawny adres email!');
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
        active: true,
        lastSeen: new Date().toISOString()
    };
    
    // Zapisz sesję
    const sessionId = saveUserSession(newUser);
    newUser.sessionId = sessionId;
    
    // Dodaj do listy
    participants.push(newUser);
    localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    
    currentUser = newUser;
    showUserPanel();
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ========== PANEL UŻYTKOWNIKA ==========
function showUserPanel() {
    hideAllScreens();
    document.getElementById('user-panel').classList.add('active');
    
    // Aktualizuj nazwę użytkownika
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = currentUser.username;
    }
    
    // Aktualizuj zawartość
    updateUserContent();
    
    // Obsługa wylogowania
    const logoutBtn = document.getElementById('user-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

function updateUserContent() {
    const userContent = document.getElementById('user-content');
    if (!userContent) return;
    
    userContent.innerHTML = '';
    
    // Aktualizuj lastSeen
    const userIndex = participants.findIndex(p => p.id === currentUser.id);
    if (userIndex !== -1) {
        participants[userIndex].lastSeen = new Date().toISOString();
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    }
    
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
                    <p><i class="fas fa-user"></i> Login: ${currentUser.username}</p>
                    <p><i class="fas fa-venus-mars"></i> Płeć: ${currentUser.gender}</p>
                    <p><i class="fas fa-heart"></i> Szukam: ${Array.isArray(currentUser.interested) ? currentUser.interested.join(', ') : currentUser.interested}</p>
                </div>
                <div class="session-info" style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <p style="font-size: 12px; color: #666;">
                        <i class="fas fa-info-circle"></i> Jesteś zalogowany jako uczestnik.
                        <br>Nie zamykaj tej karty podczas wydarzenia.
                    </p>
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
}

function handleLogout() {
    localStorage.removeItem('userSessionId');
    
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url);
    
    currentUser = null;
    location.href = location.pathname + '?participant';
}

// ========== TIMER DLA UŻYTKOWNIKA ==========
function showUserTable() {
    const userContent = document.getElementById('user-content');
    if (!userContent) return;
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    
    if (!roundPairings) {
        userContent.innerHTML = `
            <div class="waiting-screen">
                <div class="waiting-icon">
                    <i class="fas fa-random"></i>
                </div>
                <h3>Trwa losowanie par...</h3>
                <p>Proszę czekać na przypisanie do stolika.</p>
            </div>
        `;
        return;
    }
    
    // Znajdź stolik użytkownika
    let userTable = null;
    let partner = null;
    
    for (const pair of roundPairings.pairs) {
        const userInPair = pair.find(p => p.id === currentUser.id);
        if (userInPair) {
            partner = pair.find(p => p.id !== currentUser.id);
            userTable = pair;
            break;
        }
    }
    
    // Jeśli nie w parach, sprawdź przerwę
    if (!userTable && roundPairings.breakTable) {
        const inBreak = roundPairings.breakTable.find(p => p.id === currentUser.id);
        if (inBreak) {
            userContent.innerHTML = `
                <div class="table-screen">
                    <h3><i class="fas fa-coffee"></i> Przerwa - Runda ${eventData.currentRound}</h3>
                    <p style="margin: 20px 0;">W tej rundzie masz przerwę. Możesz odpocząć lub porozmawiać z innymi osobami.</p>
                    <div class="timer-container" style="margin: 30px 0;">
                        <div class="table-timer" id="user-timer">${formatTime(eventData.roundTime * 60)}</div>
                        <p style="margin-top: 10px; color: #666;">Pozostały czas rundy</p>
                    </div>
                </div>
            `;
            startUserTimer(eventData.roundTime * 60, 'user-timer');
            return;
        }
    }
    
    if (userTable && partner) {
        userContent.innerHTML = `
            <div class="table-screen">
                <h3><i class="fas fa-chair"></i> Stolik - Runda ${eventData.currentRound}</h3>
                
                <div class="table-display" style="display: flex; justify-content: center; align-items: center; gap: 40px; margin: 30px 0;">
                    <div class="seat you" style="text-align: center; padding: 20px; border-radius: 15px; background: #f0f7ff; min-width: 150px;">
                        <div style="font-size: 40px; color: #667eea;">
                            <i class="fas fa-user"></i>
                        </div>
                        <h4 style="margin: 10px 0;">TY</h4>
                        <p style="font-weight: bold;">${currentUser.username}</p>
                        <p style="font-size: 12px; color: #666;">${currentUser.gender}</p>
                        <div class="seat-number" style="margin-top: 10px; padding: 5px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 12px;">Miejsce 1</div>
                    </div>
                    
                    <div style="font-size: 50px; color: #ff6b6b;">
                        <i class="fas fa-heart"></i>
                    </div>
                    
                    <div class="seat partner" style="text-align: center; padding: 20px; border-radius: 15px; background: #fff0f0; min-width: 150px;">
                        <div style="font-size: 40px; color: #ff6b6b;">
                            <i class="fas fa-user"></i>
                        </div>
                        <h4 style="margin: 10px 0;">ROZMÓWCA</h4>
                        <p style="font-weight: bold;">${partner.username}</p>
                        <p style="font-size: 12px; color: #666;">${partner.gender}</p>
                        <div class="seat-number" style="margin-top: 10px; padding: 5px 10px; background: #ff6b6b; color: white; border-radius: 10px; font-size: 12px;">Miejsce 2</div>
                    </div>
                </div>
                
                <div class="timer-container" style="margin: 30px 0;">
                    <div class="table-timer" id="user-timer">${formatTime(eventData.roundTime * 60)}</div>
                    <p style="margin-top: 10px; color: #666;">Pozostały czas rozmowy</p>
                </div>
                
                <button id="start-rating-btn" class="btn" disabled style="margin-top: 20px; padding: 15px 30px; font-size: 16px;">
                    <i class="fas fa-hourglass-half"></i> Oceń po zakończeniu czasu
                </button>
            </div>
        `;
        
        // Timer rozmowy
        startUserTimer(eventData.roundTime * 60, 'user-timer', function() {
            const ratingBtn = document.getElementById('start-rating-btn');
            if (ratingBtn) {
                ratingBtn.disabled = false;
                ratingBtn.innerHTML = '<i class="fas fa-star"></i> Oceń rozmówcę TERAZ';
                ratingBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)';
                ratingBtn.style.color = 'white';
                
                ratingBtn.addEventListener('click', function() {
                    showRatingScreen(partner);
                });
            }
        });
    } else {
        userContent.innerHTML = `
            <div class="waiting-screen">
                <div class="waiting-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Nie znaleziono stolika</h3>
                <p>Nie znaleziono stolika dla Ciebie w tej rundzie.</p>
                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                    Skontaktuj się z organizatorem.
                </p>
            </div>
        `;
    }
}

function startUserTimer(seconds, elementId, onComplete = null) {
    let timeLeft = seconds;
    const timerElement = document.getElementById(elementId);
    
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
            
            // Zmiana koloru gdy mało czasu
            if (timeLeft < 60) {
                timerElement.style.color = '#ff6b6b';
                timerElement.style.animation = timeLeft < 30 ? 'pulse 1s infinite' : 'none';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            if (onComplete) onComplete();
        }
    }, 1000);
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ========== ALGORYTM DOBIERANIA PAR ==========
function generateSmartPairings() {
    const pairings = [];
    const usedPairs = new Set();
    
    const activeParticipants = participants.filter(p => p.active !== false);
    const totalRounds = eventData.totalRounds;
    
    for (let round = 1; round <= totalRounds; round++) {
        const roundPairings = {
            round: round,
            pairs: [],
            breakTable: []
        };
        
        // Losowa kolejność w każdej rundzie
        const availableParticipants = [...activeParticipants];
        shuffleArray(availableParticipants);
        const paired = new Set();
        
        // Krok 1: Dopasowanie według preferencji
        for (let i = 0; i < availableParticipants.length; i++) {
            if (paired.has(availableParticipants[i].id)) continue;
            
            let bestMatchIndex = null;
            let bestMatchScore = -1;
            
            for (let j = i + 1; j < availableParticipants.length; j++) {
                if (paired.has(availableParticipants[j].id)) continue;
                
                const pairKey = getPairKey(availableParticipants[i].id, availableParticipants[j].id);
                if (usedPairs.has(pairKey)) continue;
                
                // Oblicz score dopasowania
                const score = calculateMatchScore(
                    availableParticipants[i],
                    availableParticipants[j]
                );
                
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatchIndex = j;
                }
            }
            
            if (bestMatchIndex !== null && bestMatchScore >= 0) {
                const pairKey = getPairKey(
                    availableParticipants[i].id,
                    availableParticipants[bestMatchIndex].id
                );
                usedPairs.add(pairKey);
                
                roundPairings.pairs.push([
                    availableParticipants[i],
                    availableParticipants[bestMatchIndex]
                ]);
                paired.add(availableParticipants[i].id);
                paired.add(availableParticipants[bestMatchIndex].id);
            }
        }
        
        // Krok 2: Dopasuj pozostałych
        const remaining = availableParticipants.filter(p => !paired.has(p.id));
        for (let i = 0; i < remaining.length; i += 2) {
            if (i + 1 < remaining.length) {
                const pairKey = getPairKey(remaining[i].id, remaining[i + 1].id);
                
                if (!usedPairs.has(pairKey)) {
                    roundPairings.pairs.push([remaining[i], remaining[i + 1]]);
                    usedPairs.add(pairKey);
                } else {
                    roundPairings.breakTable.push(remaining[i]);
                }
            } else {
                roundPairings.breakTable.push(remaining[i]);
            }
        }
        
        pairings.push(roundPairings);
    }
    
    eventData.pairings = pairings;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    return pairings;
}

function getPairKey(id1, id2) {
    return `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
}

function calculateMatchScore(user1, user2) {
    let score = 0;
    
    // Wzajemne zainteresowanie: +20 punktów
    if (user1.interested.includes(user2.gender) && 
        user2.interested.includes(user1.gender)) {
        score += 20;
    }
    // Jednostronne zainteresowanie: +5 punktów
    else if (user1.interested.includes(user2.gender) || 
             user2.interested.includes(user1.gender)) {
        score += 5;
    }
    // Brak zainteresowania: -10 punktów
    else {
        score -= 10;
    }
    
    // Różne płeć: +2 punkty (zwiększa różnorodność)
    if (user1.gender !== user2.gender) {
        score += 2;
    }
    
    return score;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ========== PANEL ADMINISTRATORA ==========
function showAdminPanel() {
    hideAllScreens();
    
    // Upewnij się, że ekran admina istnieje
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) {
        console.error('Element #admin-panel nie istnieje w DOM');
        document.body.innerHTML = `
            <div style="padding: 50px; text-align: center;">
                <h1>Błąd ładowania panelu administratora</h1>
                <p>Odśwież stronę lub sprawdź konsolę.</p>
            </div>
        `;
        return;
    }
    
    adminPanel.classList.add('active');
    
    // Załaduj ustawienia
    document.getElementById('round-time').value = eventData.roundTime;
    document.getElementById('rating-time').value = eventData.ratingTime;
    document.getElementById('current-round-display').textContent = eventData.currentRound;
    document.getElementById('anim-round').textContent = eventData.currentRound;
    document.getElementById('total-rounds').value = eventData.totalRounds;
    
    // Aktualizuj URL dla uczestników
    updateParticipantURL();
    
    // Aktualizuj interfejs
    updateAdminInterface();
    
    // Dodaj event listeners
    setupAdminEventListeners();
}

function updateParticipantURL() {
    const participantUrl = window.location.origin + window.location.pathname + '?participant';
    const participantLink = document.getElementById('participant-link');
    if (participantLink) {
        participantLink.innerHTML = `
            <div class="url-container" style="margin: 15px 0;">
                <p style="margin-bottom: 8px; font-weight: bold;"><i class="fas fa-link"></i> Link dla uczestników:</p>
                <div style="display: flex; gap: 10px;">
                    <input type="text" value="${participantUrl}" readonly 
                           style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-family: monospace;">
                    <button onclick="copyToClipboard('${participantUrl}')" 
                            class="btn" style="white-space: nowrap;">
                        <i class="fas fa-copy"></i> Kopiuj
                    </button>
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    <i class="fas fa-info-circle"></i> Wyślij ten link uczestnikom, aby się zarejestrowali
                </p>
            </div>
        `;
    }
}

function setupAdminEventListeners() {
    // Podstawowe przyciski
    const actions = {
        'save-time': saveTimeSettings,
        'start-event': startEvent,
        'next-round': nextRound,
        'end-event': endEvent,
        'pause-timer': toggleTimer,
        'reset-timer': resetTimer,
        'export-data': exportData,
        'refresh-data': () => updateAdminInterface(),
        'clear-all': clearAllData,
        'regenerate-pairs': regeneratePairs
    };
    
    for (const [id, handler] of Object.entries(actions)) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    }
}

function regeneratePairs() {
    if (confirm('Wygenerować nowe pary dla bieżącej rundy?')) {
        generateSmartPairings();
        updateAdminInterface();
        alert('Pary zostały ponownie wygenerowane!');
    }
}

function updateAdminInterface() {
    // Pobierz świeże dane
    participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
    const freshEventData = JSON.parse(localStorage.getItem('speedDatingEvent'));
    if (freshEventData) {
        eventData = freshEventData;
    }
    
    const activeParticipants = participants.filter(p => p.active !== false);
    
    // Aktualizuj liczniki
    document.getElementById('participant-count').textContent = `${activeParticipants.length}/50`;
    
    // Aktualizuj listę uczestników
    updateParticipantsList(activeParticipants);
    
    // Aktualizuj statystyki
    updateStatistics();
    
    // Aktualizuj animację stolików
    updateTablesAnimation();
    
    // Aktualizuj timer jeśli event aktywny
    if (eventData.status === 'active') {
        updateMainTimerDisplay();
    }
}

function updateParticipantsList(activeParticipants) {
    const participantsList = document.getElementById('participants-list');
    if (!participantsList) return;
    
    if (activeParticipants.length === 0) {
        participantsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-users" style="font-size: 40px; margin-bottom: 15px;"></i>
                <p>Brak uczestników</p>
                <p style="font-size: 14px;">Uczestnicy pojawią się po rejestracji</p>
            </div>
        `;
        return;
    }
    
    participantsList.innerHTML = activeParticipants.map(p => `
        <div class="participant-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; margin-bottom: 10px; background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-user"></i>
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <strong>${p.username}</strong>
                        <span style="font-size: 11px; padding: 2px 8px; background: ${p.gender === 'male' ? '#4CAF50' : '#E91E63'}; color: white; border-radius: 10px;">
                            ${p.gender === 'male' ? 'Mężczyzna' : 'Kobieta'}
                        </span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin: 5px 0;">
                        ${p.email} • Dołączył: ${new Date(p.joinedAt).toLocaleDateString()}
                    </p>
                    <p style="font-size: 11px; color: #888;">
                        <i class="fas fa-heart"></i> Szuka: ${Array.isArray(p.interested) ? p.interested.join(', ') : p.interested}
                    </p>
                </div>
            </div>
            <div style="text-align: right; min-width: 100px;">
                <div class="participant-status ${getParticipantStatusClass(p.id)}" 
                     style="padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; margin-bottom: 5px;">
                    ${getParticipantStatus(p.id)}
                </div>
                <div style="font-size: 10px; color: #666;">
                    ${isUserOnline(p.lastSeen) ? '🟢 Online' : '⚪ Offline'}
                </div>
            </div>
        </div>
    `).join('');
}

function isUserOnline(lastSeen) {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    return (now - lastSeenTime) < 5 * 60 * 1000; // 5 minut
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

function getParticipantStatus(userId) {
    if (eventData.status === 'waiting') return 'Oczekuje';
    if (eventData.status === 'finished') return 'Zakończono';
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    if (!roundPairings) return 'Oczekuje';
    
    for (const pair of roundPairings.pairs) {
        if (pair.find(p => p.id === userId)) return 'W parze';
    }
    
    if (roundPairings.breakTable?.find(p => p.id === userId)) return 'Przerwa';
    
    return 'Oczekuje';
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
        
        // Znajdź wzajemne dopasowania
        const mutualMatches = {};
        eventData.ratings.forEach(rating => {
            if (rating.rating === 'yes') {
                const key = `${Math.min(rating.from, rating.to)}-${Math.max(rating.from, rating.to)}`;
                if (!mutualMatches[key]) mutualMatches[key] = { count: 0 };
                mutualMatches[key].count++;
            }
        });
        
        matches = Object.values(mutualMatches).filter(m => m.count === 2).length;
    }
    
    // Aktualizuj wszystkie statystyki
    const stats = {
        'pairs-count': pairsCount,
        'break-count': breakCount,
        'yes-count': yesCount,
        'matches-count': matches,
        'total-participants': activeParticipants.length
    };
    
    for (const [id, value] of Object.entries(stats)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

function updateTablesAnimation() {
    const animationContainer = document.getElementById('tables-animation');
    if (!animationContainer) return;
    
    animationContainer.innerHTML = '';
    
    if (eventData.status !== 'active' || !eventData.pairings[eventData.currentRound - 1]) {
        animationContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-chair" style="font-size: 40px; margin-bottom: 15px;"></i>
                <p>Brak aktywnych stolików</p>
                <p style="font-size: 14px;">Stoliki pojawią się po rozpoczęciu wydarzenia</p>
            </div>
        `;
        return;
    }
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    
    // Pokaż pary
    roundPairings.pairs.forEach((pair, index) => {
        const table = document.createElement('div');
        table.className = 'table-item';
        table.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-left: 5px solid #667eea;
        `;
        
        table.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="font-weight: bold; color: #667eea; font-size: 14px;">
                    <i class="fas fa-chair"></i> Stolik ${index + 1}
                </div>
                <div style="font-size: 12px; color: #666;">
                    Runda ${eventData.currentRound}
                </div>
            </div>
            <div style="display: flex; justify-content: space-around; gap: 20px;">
                ${pair.map(person => `
                    <div style="text-align: center; flex: 1;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 10px;">
                            <i class="fas fa-user"></i>
                        </div>
                        <strong style="display: block;">${person.username}</strong>
                        <div style="font-size: 11px; color: #666;">
                            ${person.gender === 'male' ? '♂ Mężczyzna' : '♀ Kobieta'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        animationContainer.appendChild(table);
    });
    
    // Pokaż stolik przerw
    if (roundPairings.breakTable?.length > 0) {
        const breakTable = document.createElement('div');
        breakTable.className = 'table-item break';
        breakTable.style.cssText = `
            background: #FFF3E0;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
            border-left: 5px solid #FF9800;
        `;
        
        breakTable.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="font-weight: bold; color: #FF9800; font-size: 14px;">
                    <i class="fas fa-coffee"></i> Stolik przerwy
                </div>
                <div style="font-size: 12px; color: #666;">
                    ${roundPairings.breakTable.length} osoba(y)
                </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${roundPairings.breakTable.map(person => `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: white; border-radius: 20px; border: 1px solid #FFE0B2;">
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: #FF9800; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <div style="font-weight: bold; font-size: 12px;">${person.username}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        animationContainer.appendChild(breakTable);
    }
}

// ========== FUNKCJE ADMINISTRATORA ==========
function saveTimeSettings() {
    eventData.roundTime = parseInt(document.getElementById('round-time').value);
    eventData.ratingTime = parseInt(document.getElementById('rating-time').value);
    eventData.totalRounds = parseInt(document.getElementById('total-rounds').value);
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    showNotification('Ustawienia czasu zapisane!', 'success');
}

function startEvent() {
    const activeParticipants = participants.filter(p => p.active !== false);
    if (activeParticipants.length < 2) {
        showNotification('Potrzeba co najmniej 2 uczestników!', 'error');
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
    
    showNotification(`Wydarzenie rozpoczęte! ${activeParticipants.length} uczestników, ${eventData.totalRounds} rund.`, 'success');
}

function nextRound() {
    if (eventData.currentRound >= eventData.totalRounds) {
        showNotification('To już ostatnia runda!', 'warning');
        return;
    }
    
    eventData.currentRound++;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    resetTimer();
    
    document.getElementById('current-round-display').textContent = eventData.currentRound;
    document.getElementById('anim-round').textContent = eventData.currentRound;
    updateAdminInterface();
    
    showNotification(`Rozpoczynasz rundę ${eventData.currentRound}`, 'info');
}

function endEvent() {
    if (confirm('Czy na pewno chcesz zakończyć wydarzenie?')) {
        eventData.status = 'finished';
        localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
        
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        updateAdminInterface();
        showNotification('Wydarzenie zakończone!', 'success');
    }
}

function startMainTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timeLeft = eventData.roundTime * 60;
    updateMainTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateMainTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            showNotification('Czas rundy minął!', 'warning');
        }
    }, 1000);
}

function updateMainTimerDisplay() {
    const timerElement = document.getElementById('main-timer');
    if (timerElement) {
        timerElement.textContent = formatTime(timeLeft);
        
        if (timeLeft < 60) {
            timerElement.style.color = '#ff6b6b';
            timerElement.style.fontWeight = 'bold';
        }
    }
}

function toggleTimer() {
    const pauseBtn = document.getElementById('pause-timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        pauseBtn.innerHTML = '<i class="fas fa-play"></i> Wznów';
        showNotification('Timer wstrzymany', 'info');
    } else {
        startMainTimer();
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pauza';
        showNotification('Timer wznowiony', 'success');
    }
}

function resetTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    startMainTimer();
    
    const pauseBtn = document.getElementById('pause-timer');
    if (pauseBtn) {
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pauza';
    }
    
    showNotification('Timer zresetowany', 'info');
}

function exportData() {
    const exportData = {
        event: eventData,
        participants: participants,
        timestamp: new Date().toISOString(),
        summary: {
            totalParticipants: participants.length,
            activeParticipants: participants.filter(p => p.active !== false).length,
            totalRounds: eventData.totalRounds,
            completedRounds: eventData.currentRound - 1,
            totalRatings: eventData.ratings ? eventData.ratings.length : 0,
            yesRatings: eventData.ratings ? eventData.ratings.filter(r => r.rating === 'yes').length : 0
        }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `speed-dating-export-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    
    showNotification('Dane wyeksportowane do pliku JSON!', 'success');
}

function clearAllData() {
    if (confirm('CZY NA PEWNO? To usunie WSZYSTKICH uczestników i dane wydarzenia! Ta operacja jest nieodwracalna.')) {
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
        showNotification('Wszystkie dane zostały usunięte!', 'warning');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Link skopiowany do schowka!', 'success');
    }).catch(err => {
        console.error('Błąd kopiowania:', err);
        showNotification('Błąd kopiowania', 'error');
    });
}

function showNotification(message, type = 'info') {
    // Utwórz element powiadomienia
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#FF9800' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: bold;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Usuń po 3 sekundach
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ========== OCENIANIE ==========
function showRatingScreen(partner) {
    hideAllScreens();
    const ratingScreen = document.getElementById('rating-screen');
    if (ratingScreen) {
        ratingScreen.classList.add('active');
        document.getElementById('rate-person').textContent = partner.username;
        
        let selectedRating = null;
        
        document.querySelectorAll('.rate-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                selectedRating = this.dataset.rating;
            });
        });
        
        document.getElementById('submit-rating').addEventListener('click', function() {
            if (!selectedRating) {
                alert('Wybierz ocenę (TAK lub NIE)!');
                return;
            }
            
            // Zapisz ocenę
            if (!currentUser.ratings) currentUser.ratings = {};
            currentUser.ratings[partner.id] = {
                rating: selectedRating,
                note: document.getElementById('rating-note').value,
                round: eventData.currentRound,
                timestamp: new Date().toISOString()
            };
            
            // Zapisz zmiany
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Zaktualizuj główną listę
            const userIndex = participants.findIndex(p => p.id === currentUser.id);
            if (userIndex !== -1) {
                participants[userIndex] = currentUser;
                localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
            }
            
            // Zapisz w danych wydarzenia
            if (!eventData.ratings) eventData.ratings = [];
            eventData.ratings.push({
                from: currentUser.id,
                to: partner.id,
                rating: selectedRating,
                round: eventData.currentRound
            });
            localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
            
            alert('Dziękujemy za ocenę!');
            showUserPanel();
        });
    }
}

// ========== FUNKCJE POMOCNICZE ==========
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// ========== INICJALIZACJA ==========
function initializeApp() {
    // Dodaj style CSS
    addCustomStyles();
    
    // Poczekaj na załadowanie DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', detectRole);
    } else {
        // DOM już załadowany
        detectRole();
    }
}

function addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .status-waiting {
            background: #f0f0f0;
            color: #666;
            border: 1px solid #ddd;
        }
        
        .status-paired {
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: white;
        }
        
        .status-break {
            background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
            color: white;
        }
        
        .table-timer {
            font-size: 48px;
            font-weight: bold;
            color: #667eea;
            text-align: center;
            font-family: monospace;
            margin: 20px 0;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
            text-decoration: none;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .screen {
            display: none;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        
        .screen.active {
            display: block;
        }
        
        #admin-panel {
            padding: 20px;
            background: #f5f7fa;
        }
        
        .admin-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border-left: 4px solid #667eea;
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #333;
            margin: 0;
        }
    `;
    document.head.appendChild(style);
}

// ========== URUCHOM APLIKACJĘ ==========
initializeApp();
