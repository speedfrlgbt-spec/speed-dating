// ============================================
// SPEED DATING PRO - JEDNA APLIKACJA, DWIE ROLE
// ============================================

// ========== KONFIGURACJA ==========
let participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
let matches = JSON.parse(localStorage.getItem('speedDatingMatches')) || [];
let allPairings = JSON.parse(localStorage.getItem('speedDatingPairings')) || [];
let currentRound = 1;
let totalRounds = 0;
let currentUser = null;
let eventSettings = JSON.parse(localStorage.getItem('speedDatingSettings')) || {
    roundDuration: 5,
    breakDuration: 2,
    ratingTime: 3,
    enableBreakTable: true,
    allowTriples: false,
    autoRotate: false,
    enableRatings: true,
    eventStatus: 'pending',
    matchesShared: false
};

// ========== ROZPOZNANIE ROLI - NAJWAŻNIEJSZA FUNKCJA ==========
function detectUserRoleAndShowView() {
    const urlParams = new URLSearchParams(window.location.search);
    const savedUser = localStorage.getItem('currentUser');
    
    // 1. SPRAWDŹ CZY TO ZALOGOWANY UCZESTNIK
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        const exists = participants.find(p => p.id === currentUser.id);
        if (!exists) {
            localStorage.removeItem('currentUser');
            currentUser = null;
        } else {
            // UCZESTNIK JEST ZALOGOWANY - pokaż JEGO panel
            showParticipantDashboard();
            return;
        }
    }
    
    // 2. SPRAWDŹ CZY TO NOWY UCZESTNIK (?participant w URL)
    if (urlParams.has('participant')) {
        showRegistrationScreen(); // POKAŻ TYLKO FORMULARZ REJESTRACJI
        return;
    }
    
    // 3. TO JEST ADMINISTRATOR - pokaż pełną aplikację
    showAdminApplication();
}

// ========== WIDOKI DLA UCZESTNIKÓW ==========
function showRegistrationScreen() {
    // UKRYJ WSZYSTKO, POKAŻ TYLKO FORMULARZ
    hideAllScreens();
    document.getElementById('login-screen').classList.add('active');
    
    // UKRYJ elementy admina
    document.querySelector('.qr-section').style.display = 'none';
    document.querySelector('.participants-card').style.display = 'none';
    
    // Zmień nagłówek
    document.querySelector('.logo h1').textContent = 'Rejestracja - Speed Dating';
    document.querySelector('.subtitle').textContent = 'Dołącz do wydarzenia!';
    
    // Ukryj przyciski admina w formularzu
    const adminButtons = document.querySelector('.admin-buttons');
    if (adminButtons) adminButtons.style.display = 'none';
}

function showParticipantDashboard() {
    hideAllScreens();
    
    if (eventSettings.eventStatus === 'pending') {
        // Wydarzenie jeszcze się nie zaczęło
        showWaitingScreen();
    } else if (eventSettings.eventStatus === 'active') {
        // Wydarzenie trwa - pokaż stolik uczestnika
        showMyTable();
    } else {
        // Wydarzenie zakończone
        showParticipantResults();
    }
}

function showWaitingScreen() {
    // Ekran oczekiwania dla uczestnika
    const screen = createParticipantScreen('waiting');
    
    screen.innerHTML = `
        <div class="logo">
            <i class="fas fa-clock" style="color:#6a11cb; font-size:48px;"></i>
            <h1>Witaj ${currentUser.username}!</h1>
            <p class="subtitle">Czekamy na rozpoczęcie wydarzenia</p>
        </div>
        
        <div class="participant-card">
            <h3><i class="fas fa-info-circle"></i> Twoje dane rejestracyjne</h3>
            <div class="user-data">
                <p><strong>Login:</strong> ${currentUser.username}</p>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>Płeć:</strong> ${currentUser.gender}</p>
                <p><strong>Zainteresowania:</strong> ${currentUser.interested.join(', ')}</p>
            </div>
            <p class="info-text">Organizator poinformuje Cię, kiedy wydarzenie się rozpocznie. 
            Wtedy zobaczysz swój stolik i będziesz mógł oceniać rozmowy.</p>
            
            <button id="participant-logout" class="participant-btn">
                <i class="fas fa-sign-out-alt"></i> Wyloguj się
            </button>
        </div>
    `;
    
    document.getElementById('participant-logout').addEventListener('click', logoutParticipant);
}

function showMyTable() {
    // Znajdź stolik uczestnika w aktualnej rundzie
    const roundData = allPairings[currentRound - 1];
    if (!roundData) {
        showWaitingScreen();
        return;
    }
    
    let myTableInfo = null;
    
    // Szukaj w parach
    roundData.pairs.forEach((pair, tableIndex) => {
        const userIndex = pair.findIndex(p => p.id === currentUser.id);
        if (userIndex !== -1) {
            myTableInfo = {
                type: 'pair',
                tableNumber: tableIndex + 1,
                partner: pair[userIndex === 0 ? 1 : 0],
                mySeat: userIndex + 1
            };
        }
    });
    
    // Jeśli nie w parach, sprawdź stolik przerw
    if (!myTableInfo && roundData.breakTable) {
        const breakIndex = roundData.breakTable.findIndex(p => p.id === currentUser.id);
        if (breakIndex !== -1) {
            myTableInfo = {
                type: 'break',
                tableNumber: 0,
                partner: null,
                breakPeople: roundData.breakTable
            };
        }
    }
    
    const screen = createParticipantScreen('table');
    
    if (myTableInfo && myTableInfo.type === 'pair') {
        // POKAŻ STOLIK Z ROZMÓWCĄ
        screen.innerHTML = `
            <div class="logo">
                <i class="fas fa-chair" style="color:#4CAF50; font-size:48px;"></i>
                <h1>Runda ${currentRound}</h1>
                <p class="subtitle">Czas na rozmowę!</p>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <h3><i class="fas fa-table"></i> Stolik ${myTableInfo.tableNumber}</h3>
                    <p class="timer">Czas: <span id="conversation-timer">${eventSettings.roundDuration}:00</span></p>
                </div>
                
                <div class="seats-container">
                    <div class="seat your-seat">
                        <div class="seat-label">Ty (Miejsce ${myTableInfo.mySeat})</div>
                        <div class="seat-content">
                            <i class="fas fa-user"></i>
                            <h4>${currentUser.username}</h4>
                            <small>${currentUser.gender}</small>
                        </div>
                    </div>
                    
                    <div class="vs-circle">
                        <i class="fas fa-heart"></i>
                    </div>
                    
                    <div class="seat partner-seat">
                        <div class="seat-label">Rozmówca (Miejsce ${myTableInfo.mySeat === 1 ? 2 : 1})</div>
                        <div class="seat-content">
                            <i class="fas fa-user"></i>
                            <h4>${myTableInfo.partner.username}</h4>
                            <small>${myTableInfo.partner.gender}</small>
                        </div>
                    </div>
                </div>
                
                <div class="table-instructions">
                    <p><i class="fas fa-clock"></i> Masz ${eventSettings.roundDuration} minut na rozmowę.</p>
                    <p><i class="fas fa-star"></i> Po sygnale ocenisz tę osobę.</p>
                </div>
                
                <div class="action-buttons">
                    <button id="rate-now-btn" class="participant-btn primary-btn" disabled>
                        <i class="fas fa-hourglass-half"></i> Oceń rozmówcę (dostępne po czasie)
                    </button>
                    <button id="view-instructions" class="participant-btn secondary-btn">
                        <i class="fas fa-question-circle"></i> Instrukcja
                    </button>
                </div>
            </div>
            
            <button id="table-logout" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i> Wyloguj się
            </button>
        `;
        
        // Timer rozmowy
        let timeLeft = eventSettings.roundDuration * 60;
        const timerElement = document.getElementById('conversation-timer');
        const rateButton = document.getElementById('rate-now-btn');
        
        const timerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                rateButton.disabled = false;
                rateButton.innerHTML = '<i class="fas fa-star"></i> Oceń rozmówcę TERAZ!';
                rateButton.classList.add('active-btn');
            }
            timeLeft--;
        }, 1000);
        
        // Event listener do oceny
        rateButton.addEventListener('click', () => {
            showRatingScreen(myTableInfo.partner);
        });
        
    } else if (myTableInfo && myTableInfo.type === 'break') {
        // POKAŻ STOLIK PRZERWY
        screen.innerHTML = `
            <div class="logo">
                <i class="fas fa-coffee" style="color:#ff9800; font-size:48px;"></i>
                <h1>Runda ${currentRound}</h1>
                <p class="subtitle">Masz przerwę w tej rundzie</p>
            </div>
            
            <div class="break-container">
                <h3><i class="fas fa-coffee"></i> Stolik przerw</h3>
                <p>W tej rundzie nie masz przypisanego rozmówcy. Możesz odpocząć lub porozmawiać z innymi osobami na przerwie:</p>
                
                <div class="break-people">
                    ${myTableInfo.breakPeople.map(p => `
                        <div class="break-person ${p.id === currentUser.id ? 'you' : ''}">
                            <i class="fas fa-user"></i>
                            <div>
                                <strong>${p.username}</strong>
                                <small>${p.gender}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <p class="next-round-info">Następna runda za: <span id="break-timer">05:00</span></p>
            </div>
            
            <button id="break-logout" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i> Wyloguj się
            </button>
        `;
    } else {
        // NIE ZNALEZIONO STOLIKA
        screen.innerHTML = `
            <div class="logo">
                <i class="fas fa-exclamation-triangle" style="color:#ff9800; font-size:48px;"></i>
                <h1>Nie znaleziono stolika</h1>
                <p class="subtitle">Skontaktuj się z organizatorem</p>
            </div>
            
            <div class="error-container">
                <p>Nie masz przypisanego stolika w tej rundzie. Możliwe przyczyny:</p>
                <ul>
                    <li>Wydarzenie jeszcze się nie rozpoczęło</li>
                    <li>Administrator nie wygenerował jeszcze par</li>
                    <li>Wystąpił błąd w przypisaniu</li>
                </ul>
                <button id="refresh-assignment" class="participant-btn">
                    <i class="fas fa-sync-alt"></i> Sprawdź ponownie
                </button>
            </div>
        `;
        
        document.getElementById('refresh-assignment').addEventListener('click', showParticipantDashboard);
    }
    
    // Dodaj listener do wylogowania
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutParticipant);
    }
}

function showRatingScreen(partner) {
    const screen = createParticipantScreen('rating');
    
    screen.innerHTML = `
        <div class="logo">
            <i class="fas fa-star" style="color:#FFD700; font-size:48px;"></i>
            <h1>Oceń rozmowę</h1>
            <p class="subtitle">Jak oceniasz rozmowę z ${partner.username}?</p>
        </div>
        
        <div class="rating-container">
            <div class="person-to-rate">
                <div class="person-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="person-details">
                    <h3>${partner.username}</h3>
                    <p class="person-gender">${partner.gender}</p>
                </div>
            </div>
            
            <div class="rating-options">
                <button class="rating-option yes-option" data-rating="yes">
                    <div class="rating-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="rating-text">
                        <h4>TAK</h4>
                        <p>Chcę kontynuować kontakt</p>
                    </div>
                </button>
                
                <button class="rating-option no-option" data-rating="no">
                    <div class="rating-icon">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <div class="rating-text">
                        <h4>NIE</h4>
                        <p>Dziękuję, nie tym razem</p>
                    </div>
                </button>
            </div>
            
            <div class="notes-section">
                <label for="rating-notes">
                    <i class="fas fa-sticky-note"></i> Twoje notatki (tylko dla Ciebie):
                </label>
                <textarea id="rating-notes" placeholder="Zapisz swoje wrażenia z rozmowy..."></textarea>
            </div>
            
            <div class="rating-actions">
                <button id="submit-rating" class="participant-btn primary-btn">
                    <i class="fas fa-paper-plane"></i> Zapisz ocenę
                </button>
                <button id="skip-rating" class="participant-btn secondary-btn">
                    <i class="fas fa-forward"></i> Pomiń ocenę
                </button>
            </div>
        </div>
    `;
    
    // Event listeners dla ocen
    let selectedRating = null;
    document.querySelectorAll('.rating-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.rating-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedRating = this.dataset.rating;
        });
    });
    
    // Zapisz ocenę
    document.getElementById('submit-rating').addEventListener('click', () => {
        if (!selectedRating) {
            alert('Wybierz ocenę (TAK lub NIE) przed zapisaniem!');
            return;
        }
        
        const notes = document.getElementById('rating-notes').value || "Brak notatki";
        
        // Zapisz ocenę
        if (!currentUser.ratings) currentUser.ratings = {};
        currentUser.ratings[partner.id] = {
            value: selectedRating,
            notes: notes,
            round: currentRound,
            timestamp: new Date().toISOString()
        };
        
        // Aktualizuj statystyki
        if (selectedRating === 'yes') {
            currentUser.given.yes = (currentUser.given.yes || 0) + 1;
        } else {
            currentUser.given.no = (currentUser.given.no || 0) + 1;
        }
        
        // Zapisz zmiany
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Znajdź i zaktualizuj w głównej liście
        const userIndex = participants.findIndex(p => p.id === currentUser.id);
        if (userIndex !== -1) {
            participants[userIndex] = { ...currentUser };
            localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
        }
        
        alert(`Dziękujemy za ocenę! ${selectedRating === 'yes' ? 'Super, że się podobało!' : 'Następna rozmowa będzie lepsza!'}`);
        showParticipantDashboard();
    });
    
    // Pomiń ocenę
    document.getElementById('skip-rating').addEventListener('click', () => {
        showParticipantDashboard();
    });
}

function showParticipantResults() {
    const screen = createParticipantScreen('results');
    
    // Oblicz statystyki
    const givenYes = currentUser.given?.yes || 0;
    const givenNo = currentUser.given?.no || 0;
    const receivedYes = currentUser.received?.yes || 0;
    const totalConversations = givenYes + givenNo;
    
    screen.innerHTML = `
        <div class="logo">
            <i class="fas fa-trophy" style="color:#FFD700; font-size:48px;"></i>
            <h1>Twoje wyniki</h1>
            <p class="subtitle">Wydarzenie zakończone!</p>
        </div>
        
        <div class="results-container">
            <div class="stats-grid">
                <div class="stat-card">
                    <i class="fas fa-handshake"></i>
                    <h3>${totalConversations}</h3>
                    <p>Rozegrane rozmowy</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-thumbs-up"></i>
                    <h3>${givenYes}</h3>
                    <p>Twoje "TAK"</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-user-check"></i>
                    <h3>${receivedYes}</h3>
                    <p>Otrzymane "TAK"</p>
                </div>
            </div>
            
            <div class="matches-section">
                <h3><i class="fas fa-heart"></i> Twoje dopasowania</h3>
                <div class="matches-list">
                    <p class="no-matches">Dopasowania zostaną udostępnione po zatwierdzeniu przez organizatora.</p>
                </div>
            </div>
            
            <button id="results-logout" class="participant-btn primary-btn">
                <i class="fas fa-sign-out-alt"></i> Zakończ i wyloguj się
            </button>
        </div>
    `;
    
    document.getElementById('results-logout').addEventListener('click', logoutParticipant);
}

// ========== FUNKCJE POMOCNICZE DLA UCZESTNIKÓW ==========
function createParticipantScreen(type) {
    hideAllScreens();
    
    // Utwórz nowy ekran dla uczestnika
    const screen = document.createElement('div');
    screen.className = `screen active participant-screen participant-${type}`;
    screen.id = `participant-${type}-screen`;
    
    document.querySelector('.container').appendChild(screen);
    return screen;
}

function hideAllScreens() {
    // Ukryj wszystkie ekrany
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Usuń ekrany uczestnika jeśli istnieją
    document.querySelectorAll('.participant-screen').forEach(screen => {
        screen.remove();
    });
}

function logoutParticipant() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    // Przekieruj z powrotem do rejestracji
    window.location.href = window.location.pathname + '?participant';
}

// ========== PANEL ADMINISTRATORA ==========
function showAdminApplication() {
    // Pokaż normalną aplikację z panelem admina
    hideAllScreens();
    document.getElementById('login-screen').classList.add('active');
    
    // Przywróć elementy admina
    document.querySelector('.qr-section').style.display = 'block';
    document.querySelector('.participants-card').style.display = 'block';
    
    // Przywróć oryginalny nagłówek
    document.querySelector('.logo h1').textContent = 'Speed Dating Online Pro';
    document.querySelector('.subtitle').textContent = 'System dopasowań z ocenianiem';
    
    // Pokaż przyciski admina
    const adminButtons = document.querySelector('.admin-buttons');
    if (adminButtons) adminButtons.style.display = 'flex';
    
    // Inicjalizuj pozostałe funkcje admina
    generateQRCode();
    updateParticipantsList();
    loadSettings();
    updateEventInfo();
    setupEventListeners();
}

// ========== INICJALIZACJA ==========
function initializeApp() {
    detectUserRoleAndShowView();
}

// ========== POZOSTAŁE FUNKCJE (muszą być w script.js) ==========
function generateQRCode() {
    const participantUrl = window.location.origin + window.location.pathname + '?participant';
    const qrElement = document.getElementById('qr-code');
    if (qrElement) {
        qrElement.innerHTML = '';
        QRCode.toCanvas(qrElement, participantUrl, { width: 200 }, function(error) {
            if (error) console.error(error);
        });
    }
}

function checkMutualInterest(person1, person2) {
    return person1.interested.includes(person2.gender) &&
           person2.interested.includes(person1.gender);
}

function getPairKey(id1, id2) {
    return `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function calculateOptimalRounds(participantsList) {
    const n = participantsList.length;
    if (n <= 4) return 3;
    if (n <= 8) return 4;
    if (n <= 12) return 5;
    if (n <= 16) return 6;
    return Math.min(7, Math.floor(n/2));
}

// ========== URUCHOMIENIE ==========
document.addEventListener('DOMContentLoaded', initializeApp);

// ========== TE FUNKCJE MUSZĄ BYĆ W script.js ==========
// (Dodaj je z poprzedniego kodu jeśli nie ma)
function updateParticipantsList() {
    const container = document.getElementById('participants-container');
    const countElement = document.getElementById('participant-count');
    
    if (!container || !countElement) return;
    
    // Statystyki płci
    const femaleCount = participants.filter(p => p.gender === 'Kobieta').length;
    const maleCount = participants.filter(p => p.gender === 'Mężczyzna').length;
    const nonbinaryCount = participants.filter(p => p.gender === 'Nonbinary').length;
    
    document.getElementById('female-count').textContent = femaleCount;
    document.getElementById('male-count').textContent = maleCount;
    document.getElementById('nonbinary-count').textContent = nonbinaryCount;
    
    countElement.textContent = participants.length;
    
    if (participants.length === 0) {
        container.innerHTML = '<p class="no-participants">Brak uczestników</p>';
        return;
    }
    
    container.innerHTML = participants.map(p => `
        <div class="participant-item">
            <div>
                <strong>${p.username}</strong>
                <span class="participant-gender gender-${getGenderClass(p.gender)}">
                    ${p.gender}
                </span>
                <br>
                <small><i class="fas fa-envelope"></i> ${p.email}</small>
            </div>
            <div class="participant-stats">
                <small>TAK: ${p.given?.yes || 0}</small>
            </div>
        </div>
    `).join('');
}

function getGenderClass(gender) {
    if (gender === 'Kobieta') return 'female';
    if (gender === 'Mężczyzna') return 'male';
    if (gender === 'Nonbinary') return 'nonbinary';
    return '';
}

function loadSettings() {
    // Implementuj ładowanie ustawień
}

function updateEventInfo() {
    // Implementuj aktualizację informacji
}

function setupEventListeners() {
    // Implementuj event listeners z poprzedniego kodu
    const form = document.getElementById('participant-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const gender = document.querySelector('input[name="gender"]:checked');
            const interestedCheckboxes = document.querySelectorAll('input[name="interested"]:checked');
            const privacyConsent = document.getElementById('privacy-consent').checked;
            
            if (!username || !email || !gender || interestedCheckboxes.length === 0) {
                alert('Proszę wypełnić wszystkie pola!');
                return;
            }
            
            if (!privacyConsent) {
                alert('Musisz wyrazić zgodę na przetwarzanie danych!');
                return;
            }
            
            const interested = Array.from(interestedCheckboxes).map(cb => cb.value);
            const newParticipant = {
                id: Date.now(),
                username: username,
                email: email,
                gender: gender.value,
                interested: interested,
                joinedAt: new Date().toISOString(),
                ratings: {},
                notes: {},
                received: { yes: 0, no: 0 },
                given: { yes: 0, no: 0 }
            };
            
            participants.push(newParticipant);
            localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
            
            // Zapisz jako aktualnego użytkownika
            currentUser = newParticipant;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            alert(`Witaj ${username}! Rejestracja zakończona sukcesem.`);
            form.reset();
            
            // Po rejestracji pokaż ekran oczekiwania
            showParticipantDashboard();
        });
    }
}
