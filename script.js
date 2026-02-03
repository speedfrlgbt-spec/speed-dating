// ============================================
// SPEED DATING PRO - JEDNA APLIKACJA
// ============================================

// ========== KONFIGURACJA ==========
let participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
let eventData = JSON.parse(localStorage.getItem('speedDatingEvent')) || {
    status: 'waiting', // waiting, active, finished
    currentRound: 1,
    totalRounds: 3,
    roundTime: 5, // minuty
    ratingTime: 2, // minuty
    pairings: [],
    ratings: []
};

let currentUser = null;
let timerInterval = null;
let timeLeft = 0;

// ========== ROZPOZNANIE ROLI ==========
function detectRole() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 1. Czy to admin? (bez parametru i bez zalogowanego użytkownika)
    if (!urlParams.has('participant') && !localStorage.getItem('currentUser')) {
        showAdminPanel();
        return;
    }
    
    // 2. Czy to zalogowany użytkownik?
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        const userExists = participants.find(p => p.id === currentUser.id);
        if (userExists) {
            showUserPanel();
            return;
        } else {
            localStorage.removeItem('currentUser');
            currentUser = null;
        }
    }
    
    // 3. To nowy użytkownik (?participant w URL)
    showRegistrationScreen();
}

// ========== REJESTRACJA UCZESTNIKA ==========
function showRegistrationScreen() {
    hideAllScreens();
    document.getElementById('login-screen').classList.add('active');
    
    // Obsługa wyboru płci
    document.querySelectorAll('.option-btn:not(.multi)').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.option-btn:not(.multi)').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('reg-gender').value = this.dataset.value;
        });
    });
    
    // Obsługa wyboru zainteresowań (wielokrotny)
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
        
        // Stwórz nowego uczestnika
        const newUser = {
            id: Date.now(),
            username: username,
            email: email,
            gender: gender,
            interested: JSON.parse(interests),
            joinedAt: new Date().toISOString(),
            ratings: {},
            tableHistory: []
        };
        
        // Dodaj do listy uczestników
        participants.push(newUser);
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
        
        // Zaloguj użytkownika
        currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Przejdź do panelu użytkownika
        showUserPanel();
    });
}

function updateInterests() {
    const selected = Array.from(document.querySelectorAll('.option-btn.multi.selected'))
        .map(btn => btn.dataset.value);
    document.getElementById('reg-interests').value = JSON.stringify(selected);
}

// ========== PANEL UŻYTKOWNIKA ==========
function showUserPanel() {
    hideAllScreens();
    document.getElementById('user-panel').classList.add('active');
    document.getElementById('user-name').textContent = currentUser.username;
    
    const userContent = document.getElementById('user-content');
    userContent.innerHTML = '';
    
    if (eventData.status === 'waiting') {
        // Wydarzenie jeszcze się nie zaczęło
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
            </div>
        `;
    } else if (eventData.status === 'active') {
        // Wydarzenie trwa - pokaż stolik użytkownika
        showUserTable();
    } else {
        // Wydarzenie zakończone
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
    
    // Obsługa wylogowania
    document.getElementById('user-logout').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        currentUser = null;
        location.href = location.pathname + '?participant';
    });
}

function showUserTable() {
    const userContent = document.getElementById('user-content');
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    
    if (!roundPairings) {
        userContent.innerHTML = `<div class="waiting-screen"><p>Trwa losowanie par...</p></div>`;
        return;
    }
    
    // Znajdź stolik użytkownika
    let userTable = null;
    let partner = null;
    
    // Szukaj w parach
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
                    <p>W tej rundzie masz przerwę. Możesz odpocząć lub porozmawiać z innymi osobami.</p>
                    <div class="table-timer" id="user-timer">${formatTime(eventData.roundTime * 60)}</div>
                    <p>Następna runda za:</p>
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
                
                <div class="table-display">
                    <div class="seat you">
                        <i class="fas fa-user"></i>
                        <h4>TY</h4>
                        <p>${currentUser.username}</p>
                        <div class="seat-number">Miejsce 1</div>
                    </div>
                    
                    <div style="font-size: 40px; color: #667eea;">
                        <i class="fas fa-heart"></i>
                    </div>
                    
                    <div class="seat partner">
                        <i class="fas fa-user"></i>
                        <h4>ROZMÓWCA</h4>
                        <p>${partner.username}</p>
                        <p><small>${partner.gender}</small></p>
                        <div class="seat-number">Miejsce 2</div>
                    </div>
                </div>
                
                <div class="table-timer" id="user-timer">${formatTime(eventData.roundTime * 60)}</div>
                <p>Pozostały czas rozmowy</p>
                
                <button id="start-rating-btn" class="btn" disabled style="margin-top: 30px;">
                    <i class="fas fa-hourglass-half"></i> Oceń po zakończeniu czasu
                </button>
            </div>
        `;
        
        // Timer rozmowy
        startUserTimer(eventData.roundTime * 60, 'user-timer', function() {
            const ratingBtn = document.getElementById('start-rating-btn');
            ratingBtn.disabled = false;
            ratingBtn.innerHTML = '<i class="fas fa-star"></i> Oceń rozmówcę TERAZ';
            ratingBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)';
            
            ratingBtn.addEventListener('click', function() {
                showRatingScreen(partner);
            });
        });
    } else {
        userContent.innerHTML = `<div class="waiting-screen"><p>Nie znaleziono stolika dla Ciebie w tej rundzie.</p></div>`;
    }
}

function startUserTimer(seconds, elementId, onComplete = null) {
    let timeLeft = seconds;
    const timerElement = document.getElementById(elementId);
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
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

// ========== OCENIANIE ==========
function showRatingScreen(partner) {
    hideAllScreens();
    document.getElementById('rating-screen').classList.add('active');
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
        
        // Znajdź użytkownika w głównej liście i zaktualizuj
        const userIndex = participants.findIndex(p => p.id === currentUser.id);
        if (userIndex !== -1) {
            participants[userIndex] = currentUser;
            localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
        }
        
        // Zapisz ocenę w danych wydarzenia
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

// ========== ALGORYTM DOBIERANIA PAR ==========
function generateSmartPairings() {
    const pairings = [];
    const usedPairs = new Set();
    
    for (let round = 1; round <= eventData.totalRounds; round++) {
        const roundPairings = {
            round: round,
            pairs: [],
            breakTable: []
        };
        
        const availableParticipants = [...participants];
        shuffleArray(availableParticipants);
        const paired = new Set();
        
        // Krok 1: Znajdź IDEALNE pary (wzajemne zainteresowanie)
        for (let i = 0; i < availableParticipants.length; i++) {
            if (paired.has(availableParticipants[i].id)) continue;
            
            let bestMatch = null;
            
            for (let j = i + 1; j < availableParticipants.length; j++) {
                if (paired.has(availableParticipants[j].id)) continue;
                
                const pairKey = `${Math.min(availableParticipants[i].id, availableParticipants[j].id)}-${Math.max(availableParticipants[i].id, availableParticipants[j].id)}`;
                if (usedPairs.has(pairKey)) continue;
                
                // Sprawdź wzajemne zainteresowanie
                const mutualInterest = 
                    availableParticipants[i].interested.includes(availableParticipants[j].gender) &&
                    availableParticipants[j].interested.includes(availableParticipants[i].gender);
                
                if (mutualInterest) {
                    bestMatch = j;
                    usedPairs.add(pairKey);
                    break;
                }
            }
            
            if (bestMatch !== null) {
                roundPairings.pairs.push([
                    availableParticipants[i],
                    availableParticipants[bestMatch]
                ]);
                paired.add(availableParticipants[i].id);
                paired.add(availableParticipants[bestMatch].id);
            }
        }
        
        // Krok 2: Pozostałe osoby idą na przerwę
        const unpaired = availableParticipants.filter(p => !paired.has(p.id));
        if (unpaired.length > 0) {
            roundPairings.breakTable = [...unpaired];
        }
        
        pairings.push(roundPairings);
    }
    
    eventData.pairings = pairings;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    return pairings;
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
    document.getElementById('admin-panel').classList.add('active');
    
    // Załaduj ustawienia czasu
    document.getElementById('round-time').value = eventData.roundTime;
    document.getElementById('rating-time').value = eventData.ratingTime;
    document.getElementById('current-round-display').textContent = eventData.currentRound;
    document.getElementById('anim-round').textContent = eventData.currentRound;
    
    // Aktualizuj interfejs
    updateAdminInterface();
    
    // Event listeners dla admina
    document.getElementById('save-time').addEventListener('click', saveTimeSettings);
    document.getElementById('start-event').addEventListener('click', startEvent);
    document.getElementById('next-round').addEventListener('click', nextRound);
    document.getElementById('end-event').addEventListener('click', endEvent);
    document.getElementById('pause-timer').addEventListener('click', toggleTimer);
    document.getElementById('reset-timer').addEventListener('click', resetTimer);
    document.getElementById('export-data').addEventListener('click', exportData);
}

function updateAdminInterface() {
    // Aktualizuj liczbę uczestników
    document.getElementById('participant-count').textContent = participants.length;
    
    // Aktualizuj listę uczestników
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = participants.map(p => `
        <div class="participant-item">
            <div class="participant-info">
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div>
                    <strong>${p.username}</strong>
                    <p style="font-size: 12px; color: #666;">${p.email} • ${p.gender}</p>
                </div>
            </div>
            <div class="participant-status status-waiting">
                ${getParticipantStatus(p.id)}
            </div>
        </div>
    `).join('');
    
    // Aktualizuj statystyki
    updateStatistics();
    
    // Aktualizuj animację stolików
    updateTablesAnimation();
}

function getParticipantStatus(userId) {
    if (eventData.status !== 'active') return 'Oczekuje';
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    if (!roundPairings) return 'Oczekuje';
    
    // Sprawdź czy w parach
    for (const pair of roundPairings.pairs) {
        if (pair.find(p => p.id === userId)) return 'W parze';
    }
    
    // Sprawdź czy na przerwie
    if (roundPairings.breakTable?.find(p => p.id === userId)) return 'Przerwa';
    
    return 'Oczekuje';
}

function updateStatistics() {
    const pairsCount = eventData.pairings.length > 0 ? 
        eventData.pairings[eventData.currentRound - 1]?.pairs.length || 0 : 0;
    const breakCount = eventData.pairings.length > 0 ?
        eventData.pairings[eventData.currentRound - 1]?.breakTable?.length || 0 : 0;
    
    // Policz oceny TAK
    let yesCount = 0;
    if (eventData.ratings) {
        yesCount = eventData.ratings.filter(r => r.rating === 'yes').length;
    }
    
    document.getElementById('pairs-count').textContent = pairsCount;
    document.getElementById('break-count').textContent = breakCount;
    document.getElementById('yes-count').textContent = yesCount;
}

function updateTablesAnimation() {
    const animationContainer = document.getElementById('tables-animation');
    animationContainer.innerHTML = '';
    
    if (eventData.status !== 'active' || !eventData.pairings[eventData.currentRound - 1]) {
        animationContainer.innerHTML = '<p style="color: #666; padding: 50px; text-align: center;">Brak aktywnych stolików</p>';
        return;
    }
    
    const roundPairings = eventData.pairings[eventData.currentRound - 1];
    
    // Pokaż pary
    roundPairings.pairs.forEach((pair, index) => {
        const table = document.createElement('div');
        table.className = 'table-item';
        table.innerHTML = `
            <div class="table-number">Stolik ${index + 1}</div>
            ${pair.map(person => `
                <div class="table-seat">
                    <strong>${person.username}</strong>
                    <div style="font-size: 12px;">${person.gender}</div>
                </div>
            `).join('')}
        `;
        animationContainer.appendChild(table);
    });
    
    // Pokaż stolik przerw (jeśli jest)
    if (roundPairings.breakTable?.length > 0) {
        const breakTable = document.createElement('div');
        breakTable.className = 'table-item break';
        breakTable.innerHTML = `
            <div class="table-number"><i class="fas fa-coffee"></i> Przerwa</div>
            ${roundPairings.breakTable.map(person => `
                <div class="table-seat">
                    ${person.username}
                </div>
            `).join('')}
        `;
        animationContainer.appendChild(breakTable);
    }
}

// ========== FUNKCJE ADMINISTRATORA ==========
function saveTimeSettings() {
    eventData.roundTime = parseInt(document.getElementById('round-time').value);
    eventData.ratingTime = parseInt(document.getElementById('rating-time').value);
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    alert('Ustawienia czasu zapisane!');
}

function startEvent() {
    if (participants.length < 2) {
        alert('Potrzeba co najmniej 2 uczestników!');
        return;
    }
    
    // Wygeneruj pary
    generateSmartPairings();
    
    // Ustaw status wydarzenia
    eventData.status = 'active';
    eventData.currentRound = 1;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    // Uruchom timer
    startMainTimer();
    
    // Aktualizuj interfejs
    updateAdminInterface();
    
    alert(`Wydarzenie rozpoczęte! Wygenerowano ${eventData.pairings.length} rund.`);
}

function nextRound() {
    if (eventData.currentRound >= eventData.totalRounds) {
        alert('To już ostatnia runda!');
        return;
    }
    
    eventData.currentRound++;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    // Zresetuj timer
    resetTimer();
    
    // Aktualizuj interfejs
    document.getElementById('current-round-display').textContent = eventData.currentRound;
    document.getElementById('anim-round').textContent = eventData.currentRound;
    updateAdminInterface();
    
    alert(`Rozpoczynasz rundę ${eventData.currentRound}`);
}

function endEvent() {
    eventData.status = 'finished';
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    // Zatrzymaj timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    updateAdminInterface();
    alert('Wydarzenie zakończone!');
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
            alert('Czas rundy minął!');
        }
    }, 1000);
}

function updateMainTimerDisplay() {
    document.getElementById('main-timer').textContent = formatTime(timeLeft);
}

function toggleTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        document.getElementById('pause-timer').innerHTML = '<i class="fas fa-play"></i> Wznów';
    } else {
        startMainTimer();
        document.getElementById('pause-timer').innerHTML = '<i class="fas fa-pause"></i> Pauza';
    }
}

function resetTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    startMainTimer();
    document.getElementById('pause-timer').innerHTML = '<i class="fas fa-pause"></i> Pauza';
}

function exportData() {
    // Przygotuj dane do eksportu
    const exportData = {
        event: eventData,
        participants: participants,
        timestamp: new Date().toISOString()
    };
    
    // Utwórz i pobierz plik JSON
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `speed-dating-data-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert('Dane wyeksportowane!');
}

// ========== FUNKCJE POMOCNICZE ==========
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// ========== URUCHOMIENIE APLIKACJI ==========
document.addEventListener('DOMContentLoaded', function() {
    detectRole();
    
    // Dodaj URL dla uczestników na ekranie admina
    const participantUrl = window.location.origin + window.location.pathname + '?participant';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        document.getElementById('role-text').innerHTML = `
            <div style="margin: 40px 0;">
                <p>Adres dla uczestników:</p>
                <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <code>${participantUrl}</code>
                </div>
                <button onclick="navigator.clipboard.writeText('${participantUrl}').then(() => alert('Skopiowano!'))" 
                        class="btn" style="margin-top: 10px;">
                    <i class="fas fa-copy"></i> Kopiuj link
                </button>
            </div>
        `;
    }
});
