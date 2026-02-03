// ============================================
// SPEED DATING PRO - DZIAŁAJĄCA APLIKACJA
// ============================================

// ========== KONFIGURACJA ==========
let participants = [];
let eventData = {};
let currentUser = null;
let timerInterval = null;
let timeLeft = 0;

// ========== INICJALIZACJA DANYCH ==========
function initializeData() {
    try {
        const storedParticipants = localStorage.getItem('speedDatingParticipants');
        const storedEvent = localStorage.getItem('speedDatingEvent');
        
        participants = storedParticipants ? JSON.parse(storedParticipants) : [];
        eventData = storedEvent ? JSON.parse(storedEvent) : {
            status: 'waiting',
            currentRound: 1,
            totalRounds: 3,
            roundTime: 5,
            ratingTime: 2,
            pairings: [],
            ratings: []
        };
    } catch (error) {
        console.error('Błąd ładowania danych:', error);
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
    }
}

// ========== SESJE UŻYTKOWNIKÓW ==========
function getUserSessionId() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session');
        
        if (!sessionId) {
            return localStorage.getItem('userSessionId');
        }
        
        return sessionId;
    } catch (error) {
        console.error('Błąd pobierania sesji:', error);
        return null;
    }
}

function setUserSessionId(sessionId) {
    try {
        localStorage.setItem('userSessionId', sessionId);
        
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.replaceState({}, '', url);
    } catch (error) {
        console.error('Błąd ustawiania sesji:', error);
    }
}

function getCurrentUser() {
    try {
        const sessionId = getUserSessionId();
        if (!sessionId || !participants || participants.length === 0) {
            return null;
        }
        
        return participants.find(p => p && p.sessionId === sessionId) || null;
    } catch (error) {
        console.error('Błąd pobierania użytkownika:', error);
        return null;
    }
}

function saveUserSession(user) {
    try {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        user.sessionId = sessionId;
        setUserSessionId(sessionId);
        return sessionId;
    } catch (error) {
        console.error('Błąd zapisywania sesji:', error);
        return null;
    }
}

// ========== GŁÓWNA FUNKCJA INICJALIZUJĄCA ==========
function initApp() {
    console.log('Inicjalizacja aplikacji...');
    
    // 1. Inicjalizuj dane
    initializeData();
    
    // 2. Sprawdź czy DOM jest gotowy
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM załadowany, wykrywanie roli...');
            detectRole();
        });
    } else {
        console.log('DOM już załadowany, wykrywanie roli...');
        detectRole();
    }
    
    // 3. Dodaj globalne style
    addGlobalStyles();
}

// ========== WYKRYWANIE ROLI ==========
function detectRole() {
    console.log('Wykrywanie roli użytkownika...');
    
    // Najpierw ukryj wszystkie ekrany
    hideAllScreens();
    
    // Pokaż loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('active');
    }
    
    // Krótkie opóźnienie dla pewności, że DOM jest gotowy
    setTimeout(() => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hasParticipant = urlParams.has('participant');
            const hasSession = urlParams.has('session');
            
            console.log('URL params:', { hasParticipant, hasSession });
            console.log('Uczestnicy:', participants.length);
            
            // Sprawdź czy użytkownik ma aktywną sesję
            currentUser = getCurrentUser();
            console.log('Bieżący użytkownik:', currentUser ? currentUser.username : 'brak');
            
            if (currentUser) {
                console.log('Pokazuję panel użytkownika dla:', currentUser.username);
                showUserPanel();
                return;
            }
            
            // Jeśli nie ma użytkownika i nie ma parametru participant - to admin
            if (!hasParticipant && !hasSession) {
                console.log('Pokazuję panel administratora');
                showAdminPanel();
                return;
            }
            
            // Jeśli jest parametr participant lub session - pokaż rejestrację
            console.log('Pokazuję ekran rejestracji');
            showRegistrationScreen();
            
        } catch (error) {
            console.error('Błąd w detectRole:', error);
            // W razie błędu pokaż ekran błędu
            showErrorScreen('Błąd ładowania aplikacji: ' + error.message);
        }
    }, 300);
}

// ========== EKRAN REJESTRACJI ==========
function showRegistrationScreen() {
    hideAllScreens();
    
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) {
        showErrorScreen('Brak ekranu rejestracji w HTML');
        return;
    }
    
    loginScreen.classList.add('active');
    
    // Sprawdź limit uczestników
    const activeParticipants = participants.filter(p => p && p.active !== false);
    if (activeParticipants.length >= 50) {
        loginScreen.innerHTML = `
            <div style="padding: 40px; text-align: center; max-width: 500px; margin: 0 auto;">
                <div style="font-size: 60px; color: #f44336; margin-bottom: 20px;">
                    <i class="fas fa-users-slash"></i>
                </div>
                <h2 style="color: #333;">Limit uczestników osiągnięty</h2>
                <p style="color: #666; margin: 20px 0;">
                    Niestety, osiągnięto maksymalną liczbę 50 uczestników.
                </p>
                <button onclick="location.reload()" class="btn">
                    <i class="fas fa-redo"></i> Odśwież
                </button>
            </div>
        `;
        return;
    }
    
    // Inicjalizuj formularz rejestracji
    setTimeout(() => {
        initializeRegistrationForm();
    }, 100);
}

function initializeRegistrationForm() {
    // Obsługa wyboru płci
    document.querySelectorAll('.option-btn:not(.multi)').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.option-btn:not(.multi)').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            const genderInput = document.getElementById('reg-gender');
            if (genderInput) genderInput.value = this.dataset.value;
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
    } else {
        console.error('Formularz rejestracji nie znaleziony');
    }
}

function updateInterests() {
    const selected = Array.from(document.querySelectorAll('.option-btn.multi.selected'))
        .map(btn => btn.dataset.value);
    const interestsInput = document.getElementById('reg-interests');
    if (interestsInput) {
        interestsInput.value = JSON.stringify(selected);
    }
}

function handleRegistration(e) {
    e.preventDefault();
    
    const username = document.getElementById('reg-username')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const gender = document.getElementById('reg-gender')?.value;
    const interests = document.getElementById('reg-interests')?.value;
    
    if (!username || !email || !gender || !interests) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }
    
    if (!validateEmail(email)) {
        alert('Proszę podać poprawny adres email!');
        return;
    }
    
    // Sprawdź czy email już istnieje
    if (participants.some(p => p && p.email === email)) {
        alert('Ten adres email jest już zarejestrowany!');
        return;
    }
    
    // Sprawdź czy nazwa użytkownika już istnieje
    if (participants.some(p => p && p.username === username)) {
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
    
    const userPanel = document.getElementById('user-panel');
    if (!userPanel) {
        showErrorScreen('Brak panelu użytkownika w HTML');
        return;
    }
    
    userPanel.classList.add('active');
    
    // Aktualizuj dane użytkownika
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && currentUser) {
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
    
    // Aktualizuj lastSeen
    const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
    if (userIndex !== -1) {
        participants[userIndex].lastSeen = new Date().toISOString();
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    }
    
    if (eventData.status === 'waiting') {
        userContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; color: #667eea; margin-bottom: 20px;">
                    <i class="fas fa-clock"></i>
                </div>
                <h3 style="color: #333; margin-bottom: 15px;">Czekamy na rozpoczęcie</h3>
                <p style="color: #666; margin-bottom: 25px;">
                    Wydarzenie jeszcze się nie rozpoczęło. Organizator poinformuje Cię, 
                    kiedy będziesz mógł dołączyć do rozmów.
                </p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: left; max-width: 400px; margin: 0 auto;">
                    <h4 style="color: #333; margin-bottom: 10px;">Twoje dane:</h4>
                    <p><i class="fas fa-user" style="width: 20px; color: #667eea;"></i> <strong>Login:</strong> ${currentUser.username}</p>
                    <p><i class="fas fa-venus-mars" style="width: 20px; color: #667eea;"></i> <strong>Płeć:</strong> ${currentUser.gender}</p>
                    <p><i class="fas fa-heart" style="width: 20px; color: #667eea;"></i> <strong>Szukam:</strong> ${Array.isArray(currentUser.interested) ? currentUser.interested.join(', ') : currentUser.interested}</p>
                </div>
            </div>
        `;
    } else if (eventData.status === 'active') {
        showUserTable();
    } else {
        userContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; color: #4CAF50; margin-bottom: 20px;">
                    <i class="fas fa-flag-checkered"></i>
                </div>
                <h3 style="color: #333; margin-bottom: 15px;">Wydarzenie zakończone</h3>
                <p style="color: #666;">Dziękujemy za udział! Organizator prześle Ci wyniki dopasowań.</p>
            </div>
        `;
    }
}

function showUserTable() {
    const userContent = document.getElementById('user-content');
    if (!userContent) return;
    
    const roundPairings = eventData.pairings && eventData.pairings[eventData.currentRound - 1];
    
    if (!roundPairings) {
        userContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; color: #667eea; margin-bottom: 20px;">
                    <i class="fas fa-random"></i>
                </div>
                <h3 style="color: #333;">Trwa losowanie par...</h3>
                <p style="color: #666;">Proszę czekać na przypisanie do stolika.</p>
            </div>
        `;
        return;
    }
    
    // Znajdź stolik użytkownika
    let userTable = null;
    let partner = null;
    
    if (roundPairings.pairs) {
        for (const pair of roundPairings.pairs) {
            if (pair && pair.find(p => p && p.id === currentUser.id)) {
                partner = pair.find(p => p && p.id !== currentUser.id);
                userTable = pair;
                break;
            }
        }
    }
    
    // Jeśli nie w parach, sprawdź przerwę
    if (!userTable && roundPairings.breakTable) {
        const inBreak = roundPairings.breakTable.find(p => p && p.id === currentUser.id);
        if (inBreak) {
            userContent.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <h3 style="color: #333; margin-bottom: 20px;">
                        <i class="fas fa-coffee" style="color: #FF9800;"></i> Przerwa - Runda ${eventData.currentRound}
                    </h3>
                    <p style="color: #666; margin-bottom: 30px;">
                        W tej rundzie masz przerwę. Możesz odpocząć lub porozmawiać z innymi osobami.
                    </p>
                    <div style="font-size: 48px; font-weight: bold; color: #667eea; margin: 20px 0; font-family: monospace;">
                        ${formatTime(eventData.roundTime * 60)}
                    </div>
                    <p style="color: #666;">Pozostały czas rundy</p>
                </div>
            `;
            startUserTimer(eventData.roundTime * 60);
            return;
        }
    }
    
    if (userTable && partner) {
        userContent.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h3 style="color: #333; margin-bottom: 30px;">
                    <i class="fas fa-chair" style="color: #667eea;"></i> Stolik - Runda ${eventData.currentRound}
                </h3>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 40px; margin-bottom: 40px; flex-wrap: wrap;">
                    <div style="text-align: center; padding: 25px; border-radius: 15px; background: linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%); width: 180px;">
                        <div style="font-size: 50px; color: #667eea; margin-bottom: 15px;">
                            <i class="fas fa-user"></i>
                        </div>
                        <h4 style="color: #333; margin-bottom: 10px;">TY</h4>
                        <p style="font-weight: bold; color: #333; margin-bottom: 5px;">${currentUser.username}</p>
                        <p style="color: #666; font-size: 14px;">${currentUser.gender}</p>
                        <div style="margin-top: 15px; padding: 5px 15px; background: #667eea; color: white; border-radius: 20px; font-size: 12px; display: inline-block;">
                            Miejsce 1
                        </div>
                    </div>
                    
                    <div style="font-size: 60px; color: #ff6b6b;">
                        <i class="fas fa-heart"></i>
                    </div>
                    
                    <div style="text-align: center; padding: 25px; border-radius: 15px; background: linear-gradient(135deg, #fff0f0 0%, #ffebee 100%); width: 180px;">
                        <div style="font-size: 50px; color: #ff6b6b; margin-bottom: 15px;">
                            <i class="fas fa-user"></i>
                        </div>
                        <h4 style="color: #333; margin-bottom: 10px;">ROZMÓWCA</h4>
                        <p style="font-weight: bold; color: #333; margin-bottom: 5px;">${partner.username}</p>
                        <p style="color: #666; font-size: 14px;">${partner.gender}</p>
                        <div style="margin-top: 15px; padding: 5px 15px; background: #ff6b6b; color: white; border-radius: 20px; font-size: 12px; display: inline-block;">
                            Miejsce 2
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <div style="font-size: 48px; font-weight: bold; color: #667eea; margin: 20px 0; font-family: monospace;" id="user-timer">
                        ${formatTime(eventData.roundTime * 60)}
                    </div>
                    <p style="color: #666;">Pozostały czas rozmowy</p>
                </div>
                
                <button id="start-rating-btn" class="btn" disabled style="padding: 15px 40px; font-size: 16px;">
                    <i class="fas fa-hourglass-half"></i> Oceń po zakończeniu czasu
                </button>
            </div>
        `;
        
        // Timer rozmowy
        startUserTimer(eventData.roundTime * 60, function() {
            const ratingBtn = document.getElementById('start-rating-btn');
            if (ratingBtn) {
                ratingBtn.disabled = false;
                ratingBtn.innerHTML = '<i class="fas fa-star"></i> Oceń rozmówcę TERAZ';
                ratingBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)';
                
                ratingBtn.addEventListener('click', function() {
                    showRatingScreen(partner);
                });
            }
        });
    } else {
        userContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; color: #FF9800; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="color: #333;">Nie znaleziono stolika</h3>
                <p style="color: #666;">Nie znaleziono stolika dla Ciebie w tej rundzie.</p>
            </div>
        `;
    }
}

function startUserTimer(seconds, onComplete = null) {
    let timeLeft = seconds;
    const timerElement = document.getElementById('user-timer');
    
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
            
            if (timeLeft < 60) {
                timerElement.style.color = '#ff6b6b';
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

function handleLogout() {
    localStorage.removeItem('userSessionId');
    
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url);
    
    currentUser = null;
    location.href = location.pathname + '?participant';
}

// ========== OCENIANIE ==========
function showRatingScreen(partner) {
    hideAllScreens();
    
    const ratingScreen = document.getElementById('rating-screen');
    if (!ratingScreen) {
        console.error('Brak ekranu oceniania');
        return;
    }
    
    ratingScreen.classList.add('active');
    
    // Zaktualizuj nazwę osoby do oceny
    const ratePerson = document.getElementById('rate-person');
    if (ratePerson && partner) {
        ratePerson.textContent = partner.username || 'Rozmówca';
    }
    
    // Zresetuj wybór
    let selectedRating = null;
    
    // Obsługa przycisków oceny
    document.querySelectorAll('.rate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedRating = this.dataset.rating;
        });
    });
    
    // Obsługa wysłania oceny
    const submitBtn = document.getElementById('submit-rating');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            if (!selectedRating) {
                alert('Wybierz ocenę (TAK lub NIE)!');
                return;
            }
            
            if (!currentUser || !partner) {
                alert('Błąd danych użytkownika!');
                return;
            }
            
            // Zapisz ocenę
            if (!currentUser.ratings) currentUser.ratings = {};
            currentUser.ratings[partner.id] = {
                rating: selectedRating,
                note: document.getElementById('rating-note')?.value || '',
                round: eventData.currentRound || 1,
                timestamp: new Date().toISOString()
            };
            
            // Zaktualizuj dane użytkownika
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Zaktualizuj w głównej liście
            const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
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
                round: eventData.currentRound || 1,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
            
            alert('Dziękujemy za ocenę!');
            showUserPanel();
        });
    }
}

// ========== ALGORYTM DOBIERANIA PAR ==========
function generateSmartPairings() {
    try {
        const activeParticipants = participants.filter(p => p && p.active !== false);
        const pairings = [];
        const usedPairs = new Set();
        
        for (let round = 1; round <= eventData.totalRounds; round++) {
            const roundPairings = {
                round: round,
                pairs: [],
                breakTable: []
            };
            
            // Losowa kolejność
            const shuffled = [...activeParticipants].sort(() => Math.random() - 0.5);
            const pairedIds = new Set();
            
            // Proste dopasowanie
            for (let i = 0; i < shuffled.length; i++) {
                if (pairedIds.has(shuffled[i].id)) continue;
                
                // Znajdź niezaparowaną osobę
                for (let j = i + 1; j < shuffled.length; j++) {
                    if (pairedIds.has(shuffled[j].id)) continue;
                    
                    // Utwórz parę
                    roundPairings.pairs.push([shuffled[i], shuffled[j]]);
                    pairedIds.add(shuffled[i].id);
                    pairedIds.add(shuffled[j].id);
                    break;
                }
            }
            
            // Osoby bez pary idą na przerwę
            shuffled.forEach(p => {
                if (!pairedIds.has(p.id)) {
                    roundPairings.breakTable.push(p);
                }
            });
            
            pairings.push(roundPairings);
        }
        
        eventData.pairings = pairings;
        localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
        
        return pairings;
    } catch (error) {
        console.error('Błąd generowania par:', error);
        showNotification('Błąd generowania par!', 'error');
        return [];
    }
}

// ========== PANEL ADMINISTRATORA ==========
function showAdminPanel() {
    hideAllScreens();
    
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) {
        // Jeśli nie ma panelu admina, utwórz go dynamicznie
        createAdminPanel();
    } else {
        adminPanel.classList.add('active');
        initializeAdminPanel();
    }
}

function createAdminPanel() {
    // Jeśli brakuje panelu admina, dodaj go dynamicznie
    const mainContainer = document.getElementById('app-container') || document.body;
    
    mainContainer.innerHTML = `
        <div id="admin-panel" class="screen active">
            <div style="min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
                <div style="max-width: 1400px; margin: 0 auto;">
                    <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0;">
                            <div>
                                <h1 style="margin: 0; color: #333;">
                                    <i class="fas fa-crown" style="color: #FFD700;"></i> Panel Administratora
                                </h1>
                                <p style="color: #666; margin: 5px 0 0 0;">Zarządzanie wydarzeniem Speed Dating</p>
                            </div>
                            <div style="font-size: 14px; color: #666;">
                                <div id="main-timer" style="font-size: 24px; font-weight: bold; color: #667eea;">05:00</div>
                                <div>Runda: <span id="current-round-display">1</span>/<span id="total-rounds-display">3</span></div>
                            </div>
                        </div>
                        
                        <!-- Stats Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid #667eea;">
                                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Uczestnicy</h3>
                                <div style="font-size: 36px; font-weight: bold; color: #333;" id="participant-count">0</div>
                                <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">z 50 miejsc</p>
                            </div>
                            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid #4CAF50;">
                                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Aktywne pary</h3>
                                <div style="font-size: 36px; font-weight: bold; color: #333;" id="pairs-count">0</div>
                            </div>
                            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid #FF9800;">
                                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Na przerwie</h3>
                                <div style="font-size: 36px; font-weight: bold; color: #333;" id="break-count">0</div>
                            </div>
                            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid #E91E63;">
                                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Oceny TAK</h3>
                                <div style="font-size: 36px; font-weight: bold; color: #333;" id="yes-count">0</div>
                            </div>
                        </div>
                        
                        <!-- Two Columns Layout -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                            <!-- Left Column: Participants List -->
                            <div>
                                <div style="background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); height: 100%;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                        <h2 style="margin: 0; color: #333; font-size: 18px;">
                                            <i class="fas fa-users"></i> Lista uczestników
                                        </h2>
                                        <button onclick="updateAdminInterface()" class="btn" style="padding: 8px 16px; font-size: 12px;">
                                            <i class="fas fa-redo"></i> Odśwież
                                        </button>
                                    </div>
                                    <div id="participants-list" style="max-height: 400px; overflow-y: auto;">
                                        <!-- Participants will be loaded here -->
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Right Column: Event Control -->
                            <div>
                                <div style="background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); height: 100%;">
                                    <h2 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">
                                        <i class="fas fa-cogs"></i> Sterowanie wydarzeniem
                                    </h2>
                                    
                                    <!-- Time Settings -->
                                    <div style="margin-bottom: 25px;">
                                        <h3 style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Ustawienia czasu</h3>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                            <div>
                                                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #666;">Czas rundy (min)</label>
                                                <input type="number" id="round-time" value="5" min="1" max="30" 
                                                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                                            </div>
                                            <div>
                                                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #666;">Czas oceny (min)</label>
                                                <input type="number" id="rating-time" value="2" min="1" max="10" 
                                                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                                            </div>
                                            <div>
                                                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #666;">Liczba rund</label>
                                                <input type="number" id="total-rounds" value="3" min="1" max="10" 
                                                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                                            </div>
                                            <div style="display: flex; align-items: flex-end;">
                                                <button id="save-time" class="btn" style="width: 100%;">
                                                    <i class="fas fa-save"></i> Zapisz czas
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Event Control Buttons -->
                                    <div style="margin-bottom: 25px;">
                                        <h3 style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Sterowanie</h3>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                            <button id="start-event" class="btn" style="background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);">
                                                <i class="fas fa-play"></i> Rozpocznij
                                            </button>
                                            <button id="next-round" class="btn" style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);">
                                                <i class="fas fa-forward"></i> Następna runda
                                            </button>
                                            <button id="end-event" class="btn" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);">
                                                <i class="fas fa-stop"></i> Zakończ
                                            </button>
                                            <button id="regenerate-pairs" class="btn" style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);">
                                                <i class="fas fa-random"></i> Generuj pary
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Timer Control -->
                                    <div style="margin-bottom: 25px;">
                                        <h3 style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Kontrola timera</h3>
                                        <div style="display: flex; gap: 10px;">
                                            <button id="pause-timer" class="btn" style="flex: 1;">
                                                <i class="fas fa-pause"></i> Pauza
                                            </button>
                                            <button id="reset-timer" class="btn" style="flex: 1; background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);">
                                                <i class="fas fa-redo"></i> Resetuj
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Data Management -->
                                    <div>
                                        <h3 style="margin: 0 0 15px 0; color: #666; font-size: 16px;">Zarządzanie danymi</h3>
                                        <div style="display: flex; gap: 10px;">
                                            <button id="export-data" class="btn" style="flex: 1; background: linear-gradient(135deg, #009688 0%, #00796B 100%);">
                                                <i class="fas fa-download"></i> Eksportuj
                                            </button>
                                            <button id="clear-all" class="btn" style="flex: 1; background: linear-gradient(135deg, #795548 0%, #5D4037 100%);">
                                                <i class="fas fa-trash"></i> Wyczyść
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tables Animation and URL -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                            <!-- Tables Animation -->
                            <div style="background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">
                                    <i class="fas fa-chair"></i> Stoliki - Runda <span id="anim-round">1</span>
                                </h2>
                                <div id="tables-animation" style="min-height: 200px;">
                                    <!-- Tables will be loaded here -->
                                </div>
                            </div>
                            
                            <!-- Participant URL -->
                            <div style="background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">
                                    <i class="fas fa-link"></i> Link dla uczestników
                                </h2>
                                <div id="participant-link">
                                    <!-- URL will be loaded here -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Footer Info -->
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
                            <p style="color: #666; font-size: 14px;">
                                Speed Dating Pro v1.0 | Panel administratora
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    initializeAdminPanel();
}

function initializeAdminPanel() {
    // Załaduj ustawienia
    const roundTimeInput = document.getElementById('round-time');
    const ratingTimeInput = document.getElementById('rating-time');
    const totalRoundsInput = document.getElementById('total-rounds');
    
    if (roundTimeInput) roundTimeInput.value = eventData.roundTime || 5;
    if (ratingTimeInput) ratingTimeInput.value = eventData.ratingTime || 2;
    if (totalRoundsInput) totalRoundsInput.value = eventData.totalRounds || 3;
    
    // Aktualizuj wyświetlane rundy
    const currentRoundDisplay = document.getElementById('current-round-display');
    const animRoundDisplay = document.getElementById('anim-round');
    const totalRoundsDisplay = document.getElementById('total-rounds-display');
    
    if (currentRoundDisplay) currentRoundDisplay.textContent = eventData.currentRound || 1;
    if (animRoundDisplay) animRoundDisplay.textContent = eventData.currentRound || 1;
    if (totalRoundsDisplay) totalRoundsDisplay.textContent = eventData.totalRounds || 3;
    
    // Aktualizuj URL dla uczestników
    updateParticipantURL();
    
    // Aktualizuj cały interfejs
    updateAdminInterface();
    
    // Dodaj event listeners
    setupAdminEventListeners();
}

function updateParticipantURL() {
    const participantUrl = window.location.origin + window.location.pathname + '?participant';
    const participantLink = document.getElementById('participant-link');
    if (participantLink) {
        participantLink.innerHTML = `
            <div style="margin-bottom: 15px;">
                <p style="color: #666; margin-bottom: 10px;">Wyślij ten link uczestnikom:</p>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" value="${participantUrl}" readonly 
                           style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa;">
                    <button onclick="copyToClipboard('${participantUrl}')" class="btn" style="white-space: nowrap;">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div style="font-size: 12px; color: #666; background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <i class="fas fa-info-circle"></i> Uczestnicy muszą wejść na ten link, aby się zarejestrować
                </div>
            </div>
        `;
    }
}

function setupAdminEventListeners() {
    // Mapowanie przycisków do funkcji
    const buttonHandlers = {
        'save-time': saveTimeSettings,
        'start-event': startEvent,
        'next-round': nextRound,
        'end-event': endEvent,
        'pause-timer': toggleTimer,
        'reset-timer': resetTimer,
        'export-data': exportData,
        'regenerate-pairs': generateSmartPairings,
        'clear-all': clearAllData
    };
    
    // Przypisz event listeners
    for (const [id, handler] of Object.entries(buttonHandlers)) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    }
    
    // Dodaj globalny event listener dla odświeżania
    const refreshBtn = document.querySelector('[onclick="updateAdminInterface()"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', updateAdminInterface);
    }
}

// ========== FUNKCJE DLA PANELU ADMINA ==========
function updateAdminInterface() {
    console.log('Aktualizacja interfejsu admina...');
    
    try {
        // Pobierz świeże dane
        initializeData();
        
        const activeParticipants = participants.filter(p => p && p.active !== false);
        
        // Aktualizuj liczniki
        updateCounter('participant-count', `${activeParticipants.length}/50`);
        updateCounter('current-round-display', eventData.currentRound || 1);
        updateCounter('anim-round', eventData.currentRound || 1);
        updateCounter('total-rounds-display', eventData.totalRounds || 3);
        
        // Aktualizuj statystyki
        updateStatistics();
        
        // Aktualizuj listę uczestników
        updateParticipantsList(activeParticipants);
        
        // Aktualizuj animację stolików
        updateTablesAnimation();
        
        // Aktualizuj timer
        updateMainTimerDisplay();
        
        console.log('Interfejs admina zaktualizowany');
    } catch (error) {
        console.error('Błąd aktualizacji interfejsu admina:', error);
        showNotification('Błąd aktualizacji interfejsu: ' + error.message, 'error');
    }
}

function updateCounter(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function updateStatistics() {
    const activeParticipants = participants.filter(p => p && p.active !== false);
    
    // Oblicz statystyki
    let pairsCount = 0;
    let breakCount = 0;
    let yesCount = 0;
    let matchesCount = 0;
    
    if (eventData.pairings && eventData.pairings.length > 0) {
        const currentPairings = eventData.pairings[eventData.currentRound - 1];
        if (currentPairings) {
            pairsCount = currentPairings.pairs ? currentPairings.pairs.length : 0;
            breakCount = currentPairings.breakTable ? currentPairings.breakTable.length : 0;
        }
    }
    
    if (eventData.ratings && Array.isArray(eventData.ratings)) {
        yesCount = eventData.ratings.filter(r => r && r.rating === 'yes').length;
        
        // Oblicz wzajemne dopasowania
        const mutualMatches = {};
        eventData.ratings.forEach(rating => {
            if (rating && rating.rating === 'yes') {
                const pairKey = `${Math.min(rating.from, rating.to)}-${Math.max(rating.from, rating.to)}`;
                if (!mutualMatches[pairKey]) {
                    mutualMatches[pairKey] = { count: 0 };
                }
                mutualMatches[pairKey].count++;
            }
        });
        
        matchesCount = Object.values(mutualMatches).filter(match => match.count === 2).length;
    }
    
    // Aktualizuj wyświetlane wartości
    updateCounter('pairs-count', pairsCount);
    updateCounter('break-count', breakCount);
    updateCounter('yes-count', yesCount);
    
    // Jeśli istnieje licznik dopasowań, zaktualizuj go
    const matchesElement = document.getElementById('matches-count');
    if (matchesElement) {
        matchesElement.textContent = matchesCount;
    }
}

function getParticipantStatus(userId) {
    if (!eventData || !userId) return 'Brak danych';
    
    if (eventData.status === 'waiting') return 'Oczekuje';
    if (eventData.status === 'finished') return 'Zakończono';
    
    if (!eventData.pairings || eventData.pairings.length === 0) {
        return 'Oczekuje';
    }
    
    const currentPairings = eventData.pairings[eventData.currentRound - 1];
    if (!currentPairings) return 'Oczekuje';
    
    // Sprawdź czy w parach
    if (currentPairings.pairs) {
        for (const pair of currentPairings.pairs) {
            if (pair && Array.isArray(pair)) {
                const found = pair.find(p => p && p.id === userId);
                if (found) return 'W parze';
            }
        }
    }
    
    // Sprawdź czy na przerwie
    if (currentPairings.breakTable && Array.isArray(currentPairings.breakTable)) {
        const found = currentPairings.breakTable.find(p => p && p.id === userId);
        if (found) return 'Przerwa';
    }
    
    return 'Oczekuje';
}

function updateParticipantsList(activeParticipants) {
    const participantsList = document.getElementById('participants-list');
    if (!participantsList) {
        console.error('Element participants-list nie znaleziony');
        return;
    }
    
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
    
    participantsList.innerHTML = activeParticipants.map(p => {
        if (!p) return '';
        
        const status = getParticipantStatus(p.id);
        const isOnline = isUserOnline(p.lastSeen);
        const genderColor = p.gender === 'male' ? '#4CAF50' : '#E91E63';
        const genderText = p.gender === 'male' ? 'Mężczyzna' : 'Kobieta';
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${genderColor};">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #333;">${p.username || 'Brak nazwy'}</div>
                        <div style="font-size: 12px; color: #666;">
                            ${p.email || 'Brak email'} • ${genderText}
                        </div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                            <i class="fas fa-heart"></i> Szuka: ${Array.isArray(p.interested) ? p.interested.join(', ') : (p.interested || 'Brak danych')}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; padding: 4px 8px; background: ${getStatusColor(p.id)}; color: white; border-radius: 12px; margin-bottom: 4px;">
                        ${status}
                    </div>
                    <div style="font-size: 10px; color: #666;">
                        ${isOnline ? '🟢 Online' : '⚫ Ostatnio widziany'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusColor(userId) {
    if (!eventData || eventData.status !== 'active') return '#666';
    
    if (eventData.pairings && eventData.pairings[eventData.currentRound - 1]) {
        const roundPairings = eventData.pairings[eventData.currentRound - 1];
        
        // Sprawdź czy w parach
        if (roundPairings.pairs && Array.isArray(roundPairings.pairs)) {
            for (const pair of roundPairings.pairs) {
                if (pair && Array.isArray(pair)) {
                    const found = pair.find(p => p && p.id === userId);
                    if (found) return '#4CAF50'; // Zielony - w parze
                }
            }
        }
        
        // Sprawdź czy na przerwie
        if (roundPairings.breakTable && Array.isArray(roundPairings.breakTable)) {
            const found = roundPairings.breakTable.find(p => p && p.id === userId);
            if (found) return '#FF9800'; // Pomarańczowy - przerwa
        }
    }
    
    return '#666'; // Szary - oczekuje
}

function isUserOnline(lastSeen) {
    if (!lastSeen) return false;
    try {
        const lastSeenTime = new Date(lastSeen).getTime();
        const now = Date.now();
        return (now - lastSeenTime) < 300000; // 5 minut
    } catch (error) {
        return false;
    }
}

function updateTablesAnimation() {
    const animationContainer = document.getElementById('tables-animation');
    if (!animationContainer) {
        console.error('Element tables-animation nie znaleziony');
        return;
    }
    
    if (eventData.status !== 'active' || !eventData.pairings || eventData.pairings.length === 0) {
        animationContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-chair" style="font-size: 40px; margin-bottom: 15px;"></i>
                <p>Brak aktywnych stolików</p>
                <p style="font-size: 14px;">Stoliki pojawią się po rozpoczęciu wydarzenia</p>
            </div>
        `;
        return;
    }
    
    const currentPairings = eventData.pairings[eventData.currentRound - 1];
    if (!currentPairings) {
        animationContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>Brak danych dla rundy ${eventData.currentRound}</p>
            </div>
        `;
        return;
    }
    
    let tablesHTML = '';
    
    // Pokaż pary
    if (currentPairings.pairs && Array.isArray(currentPairings.pairs) && currentPairings.pairs.length > 0) {
        currentPairings.pairs.forEach((pair, index) => {
            if (pair && Array.isArray(pair) && pair.length === 2) {
                tablesHTML += `
                    <div style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 15px; border: 2px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #667eea; font-size: 14px;">
                                <i class="fas fa-chair"></i> Stolik ${index + 1}
                            </div>
                            <div style="font-size: 12px; color: #666;">Runda ${eventData.currentRound}</div>
                        </div>
                        <div style="display: flex; justify-content: space-around; gap: 20px;">
                            ${pair.map(person => {
                                if (!person) return '';
                                const genderIcon = person.gender === 'male' ? '♂' : '♀';
                                const genderColor = person.gender === 'male' ? '#4CAF50' : '#E91E63';
                                return `
                                    <div style="text-align: center; flex: 1;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${genderColor}; display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 8px; font-size: 20px;">
                                            ${genderIcon}
                                        </div>
                                        <div style="font-weight: bold; font-size: 14px;">${person.username || 'Brak nazwy'}</div>
                                        <div style="font-size: 12px; color: #666;">
                                            ${person.gender === 'male' ? 'Mężczyzna' : 'Kobieta'}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        });
    }
    
    // Pokaż stolik przerw
    if (currentPairings.breakTable && Array.isArray(currentPairings.breakTable) && currentPairings.breakTable.length > 0) {
        tablesHTML += `
            <div style="background: #FFF3E0; border-radius: 10px; padding: 15px; border: 2px solid #FFE0B2; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: bold; color: #FF9800; font-size: 14px;">
                        <i class="fas fa-coffee"></i> Przerwa
                    </div>
                    <div style="font-size: 12px; color: #666;">${currentPairings.breakTable.length} osoba(y)</div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${currentPairings.breakTable.map(person => {
                        if (!person) return '';
                        return `
                            <div style="padding: 6px 12px; background: white; border-radius: 15px; font-size: 12px; border: 1px solid #FFE0B2; display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-user" style="color: #FF9800;"></i>
                                ${person.username || 'Brak nazwy'}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    if (!tablesHTML) {
        tablesHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>Brak stolików w tej rundzie</p>
            </div>
        `;
    }
    
    animationContainer.innerHTML = tablesHTML;
}

function saveTimeSettings() {
    try {
        eventData.roundTime = parseInt(document.getElementById('round-time').value) || 5;
        eventData.ratingTime = parseInt(document.getElementById('rating-time').value) || 2;
        eventData.totalRounds = parseInt(document.getElementById('total-rounds').value) || 3;
        
        localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
        showNotification('Ustawienia czasu zapisane!', 'success');
    } catch (error) {
        console.error('Błąd zapisywania ustawień:', error);
        showNotification('Błąd zapisywania ustawień!', 'error');
    }
}

function startEvent() {
    const activeParticipants = participants.filter(p => p && p.active !== false);
    
    if (activeParticipants.length < 2) {
        showNotification('Potrzeba co najmniej 2 uczestników!', 'error');
        return;
    }
    
    if (confirm(`Rozpocząć wydarzenie z ${activeParticipants.length} uczestnikami?`)) {
        generateSmartPairings();
        
        eventData.status = 'active';
        eventData.currentRound = 1;
        localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
        
        startMainTimer();
        updateAdminInterface();
        
        showNotification(`Wydarzenie rozpoczęte! ${activeParticipants.length} uczestników.`, 'success');
    }
}

function nextRound() {
    if (eventData.currentRound >= eventData.totalRounds) {
        showNotification('To już ostatnia runda!', 'warning');
        return;
    }
    
    eventData.currentRound++;
    localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
    
    resetTimer();
    updateAdminInterface();
    
    showNotification(`Rozpoczynasz rundę ${eventData.currentRound}`, 'info');
}

function endEvent() {
    if (confirm('Czy na pewno zakończyć wydarzenie?')) {
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
    
    timeLeft = (eventData.roundTime || 5) * 60;
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
        } else {
            timerElement.style.color = '#667eea';
        }
    }
}

function toggleTimer() {
    const pauseBtn = document.getElementById('pause-timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-play"></i> Wznów';
        showNotification('Timer wstrzymany', 'info');
    } else {
        startMainTimer();
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pauza';
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
    try {
        const exportData = {
            event: eventData,
            participants: participants,
            timestamp: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `speed-dating-${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Dane wyeksportowane!', 'success');
    } catch (error) {
        console.error('Błąd eksportu:', error);
        showNotification('Błąd eksportu danych!', 'error');
    }
}

function clearAllData() {
    if (confirm('CZY NA PEWNO? To usunie WSZYSTKIE dane!')) {
        localStorage.removeItem('speedDatingParticipants');
        localStorage.removeItem('speedDatingEvent');
        localStorage.removeItem('userSessionId');
        
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
        showNotification('Wszystkie dane usunięte!', 'warning');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Skopiowano do schowka!', 'success');
    }).catch(err => {
        console.error('Błąd kopiowania:', err);
        showNotification('Błąd kopiowania!', 'error');
    });
}

function showNotification(message, type = 'info') {
    // Utwórz powiadomienie
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
        animation: slideInRight 0.3s ease;
        font-weight: bold;
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
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ========== FUNKCJE POMOCNICZE ==========
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

function showErrorScreen(message) {
    document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; justify-content: center; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
            <div style="background: white; border-radius: 15px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                <div style="font-size: 60px; color: #f44336; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color: #333; margin-bottom: 15px;">Błąd aplikacji</h2>
                <p style="color: #666; margin-bottom: 25px;">${message}</p>
                <button onclick="location.reload()" class="btn" style="padding: 12px 30px;">
                    <i class="fas fa-redo"></i> Odśwież stronę
                </button>
            </div>
        </div>
    `;
}

function addGlobalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .screen {
            display: none;
        }
        
        .screen.active {
            display: block;
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
        
        input, select, textarea {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
        }
        
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ========== URUCHOMIENIE APLIKACJI ==========
// Rozpocznij aplikację
initApp();

// Dodaj globalne funkcje
window.copyToClipboard = copyToClipboard;
window.updateAdminInterface = updateAdminInterface;
