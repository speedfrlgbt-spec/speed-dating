// ============================================
// SPEED DATING ONLINE - PLIK GŁÓWNY
// ============================================

// ========== DANE APLIKACJI ==========
let participants = JSON.parse(localStorage.getItem('speedDatingParticipants')) || [];
let matches = JSON.parse(localStorage.getItem('speedDatingMatches')) || [];
let allPairings = JSON.parse(localStorage.getItem('speedDatingPairings')) || [];
let currentRound = 1;
let totalRounds = 0;
let currentUser = null;

// Ustawienia wydarzenia
let eventSettings = JSON.parse(localStorage.getItem('speedDatingSettings')) || {
    roundDuration: 5,
    breakDuration: 2,
    ratingTime: 3,
    enableBreakTable: true,
    allowTriples: true,
    autoRotate: false,
    enableRatings: true,
    autoShareContacts: false,
    requireNotes: false,
    eventStatus: 'pending',
    matchesShared: false
};

// Timery
let timerInterval = null;
let timeLeft = 0;
let isTimerRunning = false;
let ratingTimerInterval = null;

// ========== INICJALIZACJA APLIKACJI ==========
document.addEventListener('DOMContentLoaded', function() {
    // Uruchom aplikację
    initializeApp();
});

function initializeApp() {
    // 1. Wygeneruj kod QR
    generateQRCode();
    
    // 2. Sprawdź czy użytkownik już się logował
    checkExistingSession();
    
    // 3. Załaduj ustawienia
    loadSettings();
    
    // 4. Zaktualizuj informacje
    updateParticipantsList();
    updateEventInfo();
    
    // 5. Ustaw wszystkie przyciski
    setupEventListeners();
}

function checkExistingSession() {
    // Sprawdź czy użytkownik był już zalogowany
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        
        // Upewnij się że użytkownik nadal istnieje na liście
        const userExists = participants.find(p => p.id === currentUser.id);
        if (!userExists) {
            localStorage.removeItem('currentUser');
            currentUser = null;
        }
    }
}

function setupEventListeners() {
    // ===== PRZYCISKI FORMULARZA REJESTRACJI =====
    document.getElementById('participant-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addParticipant();
    });
    
    // ===== PRZYCISKI NAWIGACJI =====
    // Pokazanie panelu admina
    document.getElementById('show-admin-panel').addEventListener('click', showAdminPanel);
    
    // Pokazanie wyników
    document.getElementById('show-results').addEventListener('click', showResultsScreen);
    
    // Powrót do logowania z różnych miejsc
    document.getElementById('back-to-login-from-admin').addEventListener('click', showLoginScreen);
    document.getElementById('back-to-admin').addEventListener('click', showAdminPanel);
    document.getElementById('back-to-main').addEventListener('click', showLoginScreen);
    
    // ===== PRZYCISKI PANELU ADMINA =====
    document.getElementById('start-pairing').addEventListener('click', startEvent);
    document.getElementById('stop-event').addEventListener('click', stopEvent);
    document.getElementById('export-excel').addEventListener('click', exportToExcel);
    document.getElementById('reset-event').addEventListener('click', resetEvent);
    document.getElementById('save-time-settings').addEventListener('click', saveTimeSettings);
    document.getElementById('calculate-matches').addEventListener('click', calculateMatches);
    document.getElementById('view-matches').addEventListener('click', showMatchesModal);
    document.getElementById('approve-matches').addEventListener('click', approveAndSendMatches);
    document.getElementById('refresh-admin').addEventListener('click', refreshAdmin);
    
    // ===== PRZYCISKI ANIMACJI =====
    document.getElementById('prev-round').addEventListener('click', showPrevRound);
    document.getElementById('next-round').addEventListener('click', showNextRound);
    document.getElementById('start-timer').addEventListener('click', toggleTimer);
    document.getElementById('start-rating').addEventListener('click', startRating);
    
    // ===== PRZYCISKI OCENIANIA =====
    document.getElementById('save-rating').addEventListener('click', saveRating);
    document.getElementById('next-rating').addEventListener('click', nextRating);
    document.getElementById('skip-rating').addEventListener('click', skipRating);
    
    // Przyciski TAK/NIE
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Usuń aktywne z innych przycisków
            document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
            // Dodaj aktywny do klikniętego
            this.classList.add('active');
        });
    });
    
    // ===== USTAWIENIA ZAAWANSOWANE =====
    document.getElementById('enable-break-table').addEventListener('change', updateSettings);
    document.getElementById('allow-triples').addEventListener('change', updateSettings);
    document.getElementById('auto-rotate').addEventListener('change', updateSettings);
    document.getElementById('enable-ratings').addEventListener('change', updateSettings);
    document.getElementById('auto-share-contacts').addEventListener('change', updateSettings);
    document.getElementById('require-notes').addEventListener('change', updateSettings);
    
    // ===== MODAL DOPASOWAŃ =====
    document.querySelector('.close-modal').addEventListener('click', hideMatchesModal);
    document.getElementById('export-all-matches').addEventListener('click', exportAllMatches);
    
    // Kliknięcie poza modalem zamyka go
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            hideMatchesModal();
        }
    });
}

// ========== FUNKCJE REJESTRACJI UCZESTNIKÓW ==========
function addParticipant() {
    // Pobierz dane z formularza
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const gender = document.querySelector('input[name="gender"]:checked');
    const interestedCheckboxes = document.querySelectorAll('input[name="interested"]:checked');
    const privacyConsent = document.getElementById('privacy-consent').checked;
    
    // Sprawdź czy wszystkie pola są wypełnione
    if (!username || !email || !gender || interestedCheckboxes.length === 0) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }
    
    if (!privacyConsent) {
        alert('Musisz wyrazić zgodę na przetwarzanie danych!');
        return;
    }
    
    // Sprawdź czy email jest poprawny
    if (!validateEmail(email)) {
        alert('Podaj poprawny adres email!');
        return;
    }
    
    // Sprawdź czy login już istnieje
    if (participants.some(p => p.username.toLowerCase() === username.toLowerCase())) {
        alert('Ten login jest już zajęty. Wybierz inny.');
        return;
    }
    
    // Sprawdź czy email już istnieje
    if (participants.some(p => p.email.toLowerCase() === email.toLowerCase())) {
        alert('Ten email jest już zarejestrowany!');
        return;
    }
    
    // Przygotuj listę zainteresowań
    const interested = Array.from(interestedCheckboxes).map(cb => cb.value);
    
    // Stwórz nowego uczestnika
    const newParticipant = {
        id: Date.now(), // Unikalny ID
        username: username,
        email: email,
        gender: gender.value,
        interested: interested,
        joinedAt: new Date().toISOString(),
        ratings: {}, // Oceny które dał innym
        notes: {},   // Notatki o innych
        received: { yes: 0, no: 0 }, // Oceny które otrzymał
        given: { yes: 0, no: 0 }     // Oceny które dał
    };
    
    // Dodaj do listy uczestników
    participants.push(newParticipant);
    localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    
    // Zapisz jako aktualnego użytkownika
    currentUser = newParticipant;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Wyczyść formularz
    document.getElementById('participant-form').reset();
    document.getElementById('username').focus();
    
    // Zaktualizuj widok
    updateParticipantsList();
    updateEventInfo();
    
    // Powitaj użytkownika
    alert(`Witaj ${username}! Dołączyłeś do wydarzenia.`);
}

function validateEmail(email) {
    // Prosta walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function updateParticipantsList() {
    const container = document.getElementById('participants-container');
    const countElement = document.getElementById('participant-count');
    
    // Policzymy statystyki płci
    const femaleCount = participants.filter(p => p.gender === 'Kobieta').length;
    const maleCount = participants.filter(p => p.gender === 'Mężczyzna').length;
    const nonbinaryCount = participants.filter(p => p.gender === 'Nonbinary').length;
    
    // Zaktualizuj liczniki
    document.getElementById('female-count').textContent = femaleCount;
    document.getElementById('male-count').textContent = maleCount;
    document.getElementById('nonbinary-count').textContent = nonbinaryCount;
    
    // Zaktualizuj liczbę uczestników
    countElement.textContent = participants.length;
    
    // Jeśli nie ma uczestników
    if (participants.length === 0) {
        container.innerHTML = '<p class="no-participants">Brak uczestników</p>';
        return;
    }
    
    // Wyświetl listę uczestników
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
                <small>TAK: ${p.given?.yes || 0} | OTRZYMANE: ${p.received?.yes || 0}</small>
            </div>
        </div>
    `).join('');
}

function getGenderClass(gender) {
    // Zwraca klasę CSS dla danej płci
    if (gender === 'Kobieta') return 'female';
    if (gender === 'Mężczyzna') return 'male';
    if (gender === 'Nonbinary') return 'nonbinary';
    return '';
}

// ========== FUNKCJE PANELU ADMINISTRACYJNEGO ==========
function showAdminPanel() {
    // Ukryj wszystkie ekrany
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Pokaż panel admina
    document.getElementById('admin-screen').classList.add('active');
    
    // Zaktualizuj informacje
    updateEventInfo();
}

function showLoginScreen() {
    // Wróć do ekranu logowania
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById('login-screen').classList.add('active');
    
    updateParticipantsList();
}

function loadSettings() {
    // Załaduj ustawienia z formularza
    document.getElementById('round-duration').value = eventSettings.roundDuration;
    document.getElementById('break-duration').value = eventSettings.breakDuration;
    document.getElementById('rating-time').value = eventSettings.ratingTime;
    document.getElementById('enable-break-table').checked = eventSettings.enableBreakTable;
    document.getElementById('allow-triples').checked = eventSettings.allowTriples;
    document.getElementById('auto-rotate').checked = eventSettings.autoRotate;
    document.getElementById('enable-ratings').checked = eventSettings.enableRatings;
    document.getElementById('auto-share-contacts').checked = eventSettings.autoShareContacts;
    document.getElementById('require-notes').checked = eventSettings.requireNotes;
    
    // Ustaw początkowy czas timera
    timeLeft = eventSettings.roundDuration * 60;
    updateTimerDisplay();
}

function saveTimeSettings() {
    // Zapisz ustawienia czasu
    eventSettings.roundDuration = parseInt(document.getElementById('round-duration').value);
    eventSettings.breakDuration = parseInt(document.getElementById('break-duration').value);
    eventSettings.ratingTime = parseInt(document.getElementById('rating-time').value);
    
    localStorage.setItem('speedDatingSettings', JSON.stringify(eventSettings));
    
    // Zresetuj timer jeśli nie jest uruchomiony
    if (!isTimerRunning) {
        timeLeft = eventSettings.roundDuration * 60;
        updateTimerDisplay();
    }
    
    updateEventInfo();
    alert('Ustawienia czasu zostały zapisane!');
}

function updateSettings() {
    // Aktualizuj ustawienia zaawansowane
    eventSettings.enableBreakTable = document.getElementById('enable-break-table').checked;
    eventSettings.allowTriples = document.getElementById('allow-triples').checked;
    eventSettings.autoRotate = document.getElementById('auto-rotate').checked;
    eventSettings.enableRatings = document.getElementById('enable-ratings').checked;
    eventSettings.autoShareContacts = document.getElementById('auto-share-contacts').checked;
    eventSettings.requireNotes = document.getElementById('require-notes').checked;
    
    localStorage.setItem('speedDatingSettings', JSON.stringify(eventSettings));
    updateEventInfo();
}

function updateEventInfo() {
    // Zaktualizuj informacje w panelu admina
    
    // Liczba uczestników
    document.getElementById('admin-participant-count').textContent = participants.length;
    
    // Statystyki
    const totalConversations = participants.reduce((sum, p) => 
        sum + (p.given?.yes || 0) + (p.given?.no || 0), 0);
    const positiveRatings = participants.reduce((sum, p) => sum + (p.given?.yes || 0), 0);
    const matchRate = totalConversations > 0 ? Math.round((matches.length / totalConversations) * 100) : 0;
    const emailsSent = matches.filter(m => m.shared).length * 2;
    
    document.getElementById('total-conversations').textContent = totalConversations;
    document.getElementById('positive-ratings').textContent = positiveRatings;
    document.getElementById('match-rate').textContent = `${matchRate}%`;
    document.getElementById('emails-sent').textContent = emailsSent;
    document.getElementById('active-ratings').textContent = 
        participants.reduce((sum, p) => sum + Object.keys(p.ratings || {}).length, 0);
    
    // Przewidywana liczba rund
    const predictedRounds = calculateOptimalRounds(participants);
    document.getElementById('predicted-rounds').textContent = predictedRounds;
    
    // Szacowany czas trwania
    const totalTime = (predictedRounds * eventSettings.roundDuration) + 
                     ((predictedRounds - 1) * eventSettings.breakDuration);
    document.getElementById('estimated-duration').textContent = `${totalTime} minut`;
    
    // Status wydarzenia
    const statusElement = document.getElementById('event-status');
    let statusText = 'Nie rozpoczęte';
    let statusClass = 'status-pending';
    
    if (eventSettings.eventStatus === 'active') {
        statusText = 'W trakcie';
        statusClass = 'status-active';
    } else if (eventSettings.eventStatus === 'completed') {
        statusText = 'Zakończone';
        statusClass = 'status-completed';
    }
    
    statusElement.textContent = statusText;
    statusElement.className = `status-badge ${statusClass}`;
    
    // Aktualizuj informacje o dopasowaniach
    updateMatchesInfo();
}

function updateMatchesInfo() {
    // Zaktualizuj informacje o dopasowaniach
    const mutualMatches = matches.filter(m => m.mutual);
    const pendingMatches = mutualMatches.filter(m => !m.shared);
    
    document.getElementById('potential-matches').textContent = matches.length;
    document.getElementById('mutual-yes').textContent = mutualMatches.length;
    document.getElementById('pending-matches').textContent = pendingMatches.length;
    
    // Wyświetl ostatnie dopasowania
    const matchesList = document.getElementById('matches-list');
    const recentMatches = mutualMatches.slice(-5).reverse();
    
    matchesList.innerHTML = recentMatches.map(match => `
        <div class="match-item ${match.mutual ? 'match-mutual' : 'match-pending'}">
            <div>
                <strong>${match.person1.username}</strong> ↔ 
                <strong>${match.person2.username}</strong>
                <br>
                <small>${match.person1.gender} + ${match.person2.gender}</small>
            </div>
            <div>
                <span class="match-status ${match.mutual ? 'status-mutual' : 'status-pending'}">
                    ${match.mutual ? 'WZAJEMNE' : 'OCZEKUJE'}
                </span>
            </div>
        </div>
    `).join('') || '<p>Brak dopasowań</p>';
}

function refreshAdmin() {
    // Odśwież panel admina
    updateEventInfo();
    updateParticipantsList();
}

// ========== FUNKCJE GENEROWANIA PAR ==========
function startEvent() {
    // Rozpocznij wydarzenie
    
    if (participants.length < 2) {
        alert('Potrzeba co najmniej 2 uczestników!');
        return;
    }
    
    const confirmed = confirm(`Rozpocząć dobieranie par dla ${participants.length} uczestników?`);
    if (!confirmed) return;
    
    // Zmień status wydarzenia
    eventSettings.eventStatus = 'active';
    localStorage.setItem('speedDatingSettings', JSON.stringify(eventSettings));
    
    // Wygeneruj wszystkie rundy
    generateAllRounds();
    
    // Przejdź do pierwszej rundy
    currentRound = 1;
    showAnimationScreen();
    updateEventInfo();
    
    // Ustaw timer
    timeLeft = eventSettings.roundDuration * 60;
    updateTimerDisplay();
    
    alert(`Rozpoczęto wydarzenie! Wygenerowano ${totalRounds} rund.`);
}

function generateAllRounds() {
    // Generuj wszystkie rundy wydarzenia
    allPairings = [];
    const usedPairs = new Set();
    
    // Oblicz ile rund będzie potrzebnych
    totalRounds = calculateOptimalRounds(participants);
    
    // Generuj każdą rundę
    for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
        const roundData = generateSingleRound(roundNum, usedPairs);
        allPairings.push(roundData);
    }
    
    // Zapisz w pamięci przeglądarki
    localStorage.setItem('speedDatingPairings', JSON.stringify(allPairings));
}

function generateSingleRound(roundNum, usedPairs) {
    // Generuj pojedynczą rundę
    const roundParticipants = [...participants];
    const roundResult = {
        round: roundNum,
        pairs: [],
        breakTable: [],
        triples: []
    };
    
    // Pomieszaj uczestników
    shuffleArray(roundParticipants);
    
    const paired = new Set();
    const enableBreakTable = eventSettings.enableBreakTable;
    const allowTriples = eventSettings.allowTriples;
    
    // Krok 1: Znajdź najlepsze pary
    for (let i = 0; i < roundParticipants.length; i++) {
        if (paired.has(roundParticipants[i].id)) continue;
        
        let bestMatch = null;
        let bestScore = -1;
        
        for (let j = i + 1; j < roundParticipants.length; j++) {
            if (paired.has(roundParticipants[j].id)) continue;
            
            // Sprawdź czy ta para już nie rozmawiała
            const pairKey = getPairKey(roundParticipants[i].id, roundParticipants[j].id);
            if (usedPairs.has(pairKey)) continue;
            
            // Sprawdź wzajemne zainteresowanie
            if (checkMutualInterest(roundParticipants[i], roundParticipants[j])) {
                const score = calculateMatchScore(roundParticipants[i], roundParticipants[j]);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = j;
                }
            }
        }
        
        if (bestMatch !== null) {
            const pairKey = getPairKey(roundParticipants[i].id, roundParticipants[bestMatch].id);
            usedPairs.add(pairKey);
            
            roundResult.pairs.push([
                roundParticipants[i], 
                roundParticipants[bestMatch]
            ]);
            
            paired.add(roundParticipants[i].id);
            paired.add(roundParticipants[bestMatch].id);
        }
    }
    
    // Krok 2: Obsłuż osoby bez pary
    const unpaired = roundParticipants.filter(p => !paired.has(p.id));
    
    if (unpaired.length > 0) {
        if (allowTriples && unpaired.length >= 3) {
            // Twórz trójki
            for (let i = 0; i < unpaired.length; i += 3) {
                if (i + 2 < unpaired.length) {
                    roundResult.triples.push([
                        unpaired[i], 
                        unpaired[i + 1], 
                        unpaired[i + 2]
                    ]);
                    paired.add(unpaired[i].id);
                    paired.add(unpaired[i + 1].id);
                    paired.add(unpaired[i + 2].id);
                }
            }
            
            // Pozostałe osoby idą na przerwę
            const stillUnpaired = unpaired.filter(p => !paired.has(p.id));
            if (stillUnpaired.length > 0 && enableBreakTable) {
                roundResult.breakTable = [...stillUnpaired];
            }
        } else if (enableBreakTable) {
            // Wszyscy idą na przerwę
            roundResult.breakTable = [...unpaired];
        } else {
            // Twórz wymuszone pary
            for (let i = 0; i < unpaired.length; i += 2) {
                if (i + 1 < unpaired.length) {
                    roundResult.pairs.push([unpaired[i], unpaired[i + 1]]);
                } else {
                    // Ostatnia osoba bez pary
                    if (roundResult.pairs.length > 0) {
                        roundResult.pairs[roundResult.pairs.length - 1].push(unpaired[i]);
                        const triple = roundResult.pairs.pop();
                        roundResult.triples.push(triple);
                    }
                }
            }
        }
    }
    
    return roundResult;
}

function checkMutualInterest(person1, person2) {
    // Sprawdź czy osoby są wzajemnie zainteresowane
    return person1.interested.includes(person2.gender) &&
           person2.interested.includes(person1.gender);
}

function calculateMatchScore(person1, person2) {
    // Oblicz wynik dopasowania (im wyższy, tym lepiej)
    let score = 0;
    
    // Wzajemne zainteresowanie (najważniejsze)
    if (checkMutualInterest(person1, person2)) {
        score += 10;
    }
    
    // Dodatkowe punkty za szerokie zainteresowania
    score += person1.interested.length + person2.interested.length;
    
    // Trochę losowości dla różnorodności
    score += Math.random() * 3;
    
    return score;
}

function getPairKey(id1, id2) {
    // Tworzy unikalny klucz dla pary
    return `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
}

function shuffleArray(array) {
    // Pomieszaj tablicę
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function calculateOptimalRounds(participantsList) {
    // Oblicza optymalną liczbę rund
    const n = participantsList.length;
    if (n <= 4) return 3;
    if (n <= 8) return 4;
    if (n <= 12) return 5;
    if (n <= 16) return 6;
    return 7;
}

// ========== FUNKCJE ANIMACJI STOLIKÓW ==========
function showAnimationScreen() {
    // Pokaż ekran animacji
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById('animation-screen').classList.add('active');
    
    // Zaktualizuj animację
    updateAnimation();
}

function updateAnimation() {
    if (allPairings.length === 0 || currentRound > allPairings.length) {
        document.getElementById('tables-container').innerHTML = '<p>Brak danych do wyświetlenia</p>';
        return;
    }
    
    const currentRoundData = allPairings[currentRound - 1];
    const tablesContainer = document.getElementById('tables-container');
    const breakTableContainer = document.getElementById('break-table');
    const pairsContainer = document.getElementById('pairs-container');
    
    // Zaktualizuj informacje o rundzie
    document.getElementById('current-round').textContent = currentRound;
    document.getElementById('total-rounds').textContent = totalRounds;
    document.getElementById('summary-round').textContent = currentRound;
    
    // Statystyki rundy
    document.getElementById('pair-count').textContent = currentRoundData.pairs.length;
    document.getElementById('triple-count').textContent = currentRoundData.triples.length;
    document.getElementById('break-count').textContent = currentRoundData.breakTable.length;
    
    // Wyczyść kontenery
    tablesContainer.innerHTML = '';
    breakTableContainer.innerHTML = '';
    
    // Wyświetl pary przy stolikach
    let tableNumber = 1;
    
    // Wyświetl pary (2 osoby)
    currentRoundData.pairs.forEach(pair => {
        const table = createTableElement(tableNumber, pair, false);
        tablesContainer.appendChild(table);
        tableNumber++;
    });
    
    // Wyświetl trójki (3 osoby)
    currentRoundData.triples.forEach(triple => {
        const table = createTableElement(tableNumber, triple, true);
        tablesContainer.appendChild(table);
        tableNumber++;
    });
    
    // Wyświetl stolik przerw
    if (currentRoundData.breakTable.length > 0 && eventSettings.enableBreakTable) {
        currentRoundData.breakTable.forEach(person => {
            const breakPerson = document.createElement('div');
            breakPerson.className = 'break-participant';
            breakPerson.innerHTML = `
                <span class="participant-gender gender-${getGenderClass(person.gender)}">
                    ${person.gender.charAt(0)}
                </span>
                <strong>${person.username}</strong>
            `;
            breakTableContainer.appendChild(breakPerson);
        });
        
        // Pokaż sekcję przerw
        document.getElementById('break-table-container').style.display = 'block';
    } else {
        document.getElementById('break-table-container').style.display = 'none';
    }
    
    // Wyświetl podsumowanie
    displayRoundSummary(currentRoundData, pairsContainer);
}

function createTableElement(number, people, isTriple = false) {
    // Tworzy element stolika
    const table = document.createElement('div');
    table.className = `table ${isTriple ? 'table-triple' : ''}`;
    
    const headerText = isTriple ? `Stolik ${number} (trójka)` : `Stolik ${number}`;
    
    table.innerHTML = `
        <div class="table-header">${headerText}</div>
        ${people.map(person => `
            <div class="table-seat">
                <strong>${person.username}</strong><br>
                <small>(${person.gender})</small>
            </div>
        `).join('')}
    `;
    
    return table;
}

function displayRoundSummary(roundData, container) {
    // Wyświetla podsumowanie rundy
    container.innerHTML = '';
    
    // Pary
    if (roundData.pairs.length > 0) {
        const pairsSection = document.createElement('div');
        pairsSection.className = 'summary-section';
        pairsSection.innerHTML = `<h4>Pary (${roundData.pairs.length}):</h4>`;
        container.appendChild(pairsSection);
        
        roundData.pairs.forEach((pair, index) => {
            const pairElement = document.createElement('div');
            pairElement.className = 'pair-item';
            pairElement.innerHTML = `
                <div><strong>Stolik ${index + 1}:</strong></div>
                <div>${pair[0].username} ↔ ${pair[1].username}</div>
            `;
            container.appendChild(pairElement);
        });
    }
    
    // Trójki
    if (roundData.triples.length > 0) {
        const triplesSection = document.createElement('div');
        triplesSection.className = 'summary-section';
        triplesSection.innerHTML = `<h4>Trójki (${roundData.triples.length}):</h4>`;
        container.appendChild(triplesSection);
        
        roundData.triples.forEach((triple, index) => {
            const tripleElement = document.createElement('div');
            tripleElement.className = 'pair-item';
            tripleElement.innerHTML = `
                <div><strong>Stolik ${roundData.pairs.length + index + 1}:</strong></div>
                <div>${triple.map(p => p.username).join(' ↔ ')}</div>
            `;
            container.appendChild(tripleElement);
        });
    }
    
    // Stolik przerw
    if (roundData.breakTable.length > 0 && eventSettings.enableBreakTable) {
        const breakSection = document.createElement('div');
        breakSection.className = 'summary-section';
        breakSection.innerHTML = `<h4>Na przerwie (${roundData.breakTable.length}):</h4>`;
        container.appendChild(breakSection);
        
        const breakElement = document.createElement('div');
        breakElement.className = 'pair-item';
        breakElement.innerHTML = `
            <div><strong><i class="fas fa-coffee"></i> Stolik przerw:</strong></div>
            <div>${roundData.breakTable.map(p => p.username).join(', ')}</div>
        `;
        container.appendChild(breakElement);
    }
}

function showPrevRound() {
    // Przejdź do poprzedniej rundy
    if (currentRound > 1) {
        currentRound--;
        updateAnimation();
        
        // Resetuj timer
        if (!isTimerRunning) {
            timeLeft = eventSettings.roundDuration * 60;
            updateTimerDisplay();
        }
    }
}

function showNextRound() {
    // Przejdź do następnej rundy
    if (currentRound < totalRounds) {
        currentRound++;
        updateAnimation();
        
        // Resetuj timer
        if (!isTimerRunning) {
            timeLeft = eventSettings.roundDuration * 60;
            updateTimerDisplay();
        }
    }
}

// ========== FUNKCJE TIMERA ==========
function toggleTimer() {
    // Włącz/wyłącz timer
    if (!isTimerRunning) {
        startTimer();
    } else {
        pauseTimer();
    }
}

function startTimer() {
    // Uruchom timer
    if (timeLeft <= 0) {
        timeLeft = eventSettings.roundDuration * 60;
    }
    
    isTimerRunning = true;
    document.getElementById('start-timer').innerHTML = '<i class="fas fa-pause"></i> Pauza';
    document.getElementById('start-timer').classList.remove('btn-success');
    document.getElementById('start-timer').classList.add('btn-warning');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            timerFinished();
        }
    }, 1000);
}

function pauseTimer() {
    // Zatrzymaj timer
    isTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('start-timer').innerHTML = '<i class="fas fa-play"></i> Start';
    document.getElementById('start-timer').classList.remove('btn-warning');
    document.getElementById('start-timer').classList.add('btn-success');
}

function updateTimerDisplay() {
    // Aktualizuj wyświetlacz timera
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerElement = document.getElementById('timer');
    
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Zmiana koloru przy małej ilości czasu
    timerElement.classList.remove('timer-warning', 'timer-danger');
    
    if (timeLeft <= 60) {
        timerElement.classList.add('timer-danger');
    } else if (timeLeft <= 180) {
        timerElement.classList.add('timer-warning');
    }
}

function timerFinished() {
    // Zakończenie timera
    clearInterval(timerInterval);
    isTimerRunning = false;
    
    // Zagraj dźwięk
    playNotificationSound();
    
    // Jeśli auto-rotate włączone, przejdź do następnej rundy
    if (eventSettings.autoRotate && currentRound < totalRounds) {
        setTimeout(() => {
            showNextRound();
            timeLeft = eventSettings.roundDuration * 60;
            updateTimerDisplay();
            if (eventSettings.autoRotate) {
                startTimer();
            }
        }, 2000);
    }
    
    alert('Czas rundy minął!');
}

function playNotificationSound() {
    // Prosty dźwięk powiadomienia
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
    } catch (e) {
        console.log('Audio context not supported');
    }
}

// ========== FUNKCJE OCENIANIA ==========
function startRating() {
    // Rozpocznij ocenianie
    if (!currentUser) {
        alert('Musisz być zalogowany jako uczestnik!');
        showLoginScreen();
        return;
    }
    
    const roundData = allPairings[currentRound - 1];
    if (!roundData) {
        alert('Brak danych dla tej rundy!');
        return;
    }
    
    // Znajdź osoby, z którymi użytkownik rozmawiał
    const peopleToRate = getPeopleToRate(currentUser.id, roundData);
    
    if (peopleToRate.length === 0) {
        alert('Nie masz nikogo do oceny w tej rundzie.');
        return;
    }
    
    // Zapisz listę osób do oceny
    currentUser.peopleToRate = peopleToRate;
    currentUser.currentRatingIndex = 0;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Pokaż ekran oceniania
    showRatingScreen();
    loadNextPersonToRate();
}

function getPeopleToRate(userId, roundData) {
    // Znajdź osoby do oceny w rundzie
    const peopleToRate = [];
    
    // Sprawdź pary
    roundData.pairs.forEach(pair => {
        if (pair.some(p => p.id === userId)) {
            const otherPerson = pair.find(p => p.id !== userId);
            if (otherPerson) peopleToRate.push(otherPerson);
        }
    });
    
    // Sprawdź trójki
    roundData.triples.forEach(triple => {
        if (triple.some(p => p.id === userId)) {
            const otherPeople = triple.filter(p => p.id !== userId);
            peopleToRate.push(...otherPeople);
        }
    });
    
    return peopleToRate;
}

function showRatingScreen() {
    // Pokaż ekran oceniania
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById('rating-screen').classList.add('active');
    
    // Ustaw timer oceniania
    timeLeft = eventSettings.ratingTime * 60;
    updateRatingTimer();
    
    // Uruchom timer
    if (ratingTimerInterval) clearInterval(ratingTimerInterval);
    ratingTimerInterval = setInterval(() => {
        timeLeft--;
        updateRatingTimer();
        
        if (timeLeft <= 0) {
            clearInterval(ratingTimerInterval);
            alert('Czas na ocenę minął!');
            // Automatycznie zapisz jako "NIE" jeśli nie wybrano
            if (!document.querySelector('.rating-btn.active')) {
                autoSaveNoRating();
            }
        }
    }, 1000);
}

function updateRatingTimer() {
    // Aktualizuj timer oceniania
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('rating-timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function loadNextPersonToRate() {
    // Załaduj następną osobę do oceny
    if (!currentUser || !currentUser.peopleToRate || 
        currentUser.currentRatingIndex >= currentUser.peopleToRate.length) {
        finishRating();
        return;
    }
    
    const person = currentUser.peopleToRate[currentUser.currentRatingIndex];
    
    // Aktualizuj UI
    document.getElementById('rate-person-name').textContent = person.username;
    document.getElementById('rate-person-gender').textContent = person.gender;
    document.getElementById('rating-round').textContent = currentRound;
    
    // Resetuj przyciski
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('rating-notes').value = '';
    
    // Aktualizuj progress
    const progress = ((currentUser.currentRatingIndex) / currentUser.peopleToRate.length) * 100;
    document.getElementById('rating-progress').style.width = `${progress}%`;
    document.getElementById('rated-count').textContent = currentUser.currentRatingIndex;
    document.getElementById('total-to-rate').textContent = currentUser.peopleToRate.length;
    
    // Sprawdź czy już oceniono tę osobę
    if (currentUser.ratings && currentUser.ratings[person.id]) {
        const existingRating = currentUser.ratings[person.id];
        const btn = document.querySelector(`.rating-btn[data-rating="${existingRating.value}"]`);
        if (btn) btn.classList.add('active');
        if (existingRating.notes) {
            document.getElementById('rating-notes').value = existingRating.notes;
        }
    }
    
    // Załaduj historię ocen
    loadRatingsHistory();
}

function loadRatingsHistory() {
    // Załaduj historię ocen użytkownika
    const container = document.getElementById('ratings-history');
    if (!currentUser || !currentUser.ratings) {
        container.innerHTML = '<p>Brak historii ocen</p>';
        return;
    }
    
    const ratingsList = Object.entries(currentUser.ratings)
        .map(([personId, rating]) => {
            const person = participants.find(p => p.id === parseInt(personId));
            if (!person) return '';
            
            return `
                <div class="rating-item rating-${rating.value}-item">
                    <div>
                        <strong>${person.username}</strong>
                        <small>(${person.gender})</small>
                        <br>
                        <small>Runda ${rating.round}</small>
                    </div>
                    <div>
                        <span class="rating-value">${rating.value === 'yes' ? 'TAK ✓' : 'NIE ✗'}</span>
                    </div>
                </div>
            `;
        })
        .join('');
    
    container.innerHTML = ratingsList || '<p>Brak historii ocen</p>';
}

function saveRating() {
    // Zapisz ocenę
    if (!currentUser || !currentUser.peopleToRate) return;
    
    const selectedBtn = document.querySelector('.rating-btn.active');
    if (!selectedBtn && eventSettings.requireNotes) {
        alert('Wybierz ocenę (TAK lub NIE)!');
        return;
    }
    
    const person = currentUser.peopleToRate[currentUser.currentRatingIndex];
    const ratingValue = selectedBtn ? selectedBtn.dataset.rating : 'no';
    const notes = document.getElementById('rating-notes').value;
    
    // Zapisz ocenę
    if (!currentUser.ratings) currentUser.ratings = {};
    currentUser.ratings[person.id] = {
        value: ratingValue,
        notes: notes,
        round: currentRound,
        timestamp: new Date().toISOString()
    };
    
    // Zapisz notatkę
    if (!currentUser.notes) currentUser.notes = {};
    currentUser.notes[person.id] = notes;
    
    // Aktualizuj statystyki
    if (ratingValue === 'yes') {
        currentUser.given.yes = (currentUser.given.yes || 0) + 1;
        
        // Aktualizuj statystyki odbieranej osoby
        const targetPerson = participants.find(p => p.id === person.id);
        if (targetPerson) {
            targetPerson.received.yes = (targetPerson.received.yes || 0) + 1;
        }
    } else {
        currentUser.given.no = (currentUser.given.no || 0) + 1;
        
        const targetPerson = participants.find(p => p.id === person.id);
        if (targetPerson) {
            targetPerson.received.no = (targetPerson.received.no || 0) + 1;
        }
    }
    
    // Zapisz zmiany
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Znajdź i zaktualizuj uczestnika w głównej liście
    const participantIndex = participants.findIndex(p => p.id === currentUser.id);
    if (participantIndex !== -1) {
        participants[participantIndex] = { ...currentUser };
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    }
    
    // Przejdź do następnej osoby
    currentUser.currentRatingIndex++;
    loadNextPersonToRate();
}

function autoSaveNoRating() {
    // Automatycznie zapisz jako NIE gdy skończy się czas
    if (!currentUser || !currentUser.peopleToRate) return;
    
    const person = currentUser.peopleToRate[currentUser.currentRatingIndex];
    const notes = "Automatycznie zapisane - brak odpowiedzi w czasie";
    
    if (!currentUser.ratings) currentUser.ratings = {};
    currentUser.ratings[person.id] = {
        value: 'no',
        notes: notes,
        round: currentRound,
        timestamp: new Date().toISOString()
    };
    
    if (!currentUser.notes) currentUser.notes = {};
    currentUser.notes[person.id] = notes;
    
    currentUser.given.no = (currentUser.given.no || 0) + 1;
    
    const targetPerson = participants.find(p => p.id === person.id);
    if (targetPerson) {
        targetPerson.received.no = (targetPerson.received.no || 0) + 1;
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    const participantIndex = participants.findIndex(p => p.id === currentUser.id);
    if (participantIndex !== -1) {
        participants[participantIndex] = { ...currentUser };
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    }
    
    currentUser.currentRatingIndex++;
    loadNextPersonToRate();
}

function skipRating() {
    // Pomijanie oceny
    currentUser.currentRatingIndex++;
    loadNextPersonToRate();
}

function nextRating() {
    // To samo co skipRating
    skipRating();
}

function finishRating() {
    // Zakończ ocenianie
    clearInterval(ratingTimerInterval);
    alert('Ocenianie zakończone! Dziękujemy za Twoje oceny.');
    showAnimationScreen();
}

// ========== FUNKCJE DOPASOWAŃ ==========
function calculateMatches() {
    // Oblicz wzajemne dopasowania
    matches = [];
    
    // Dla każdego uczestnika sprawdź wzajemne "TAK"
    participants.forEach(person1 => {
        participants.forEach(person2 => {
            if (person1.id >= person2.id) return; // Unikaj duplikatów
            
            // Sprawdź czy mają wzajemne "TAK"
            const person1Rating = person1.ratings && person1.ratings[person2.id];
            const person2Rating = person2.ratings && person2.ratings[person1.id];
            
            if (person1Rating && person2Rating && 
                person1Rating.value === 'yes' && person2Rating.value === 'yes') {
                
                const match = {
                    person1: {
                        id: person1.id,
                        username: person1.username,
                        email: person1.email,
                        gender: person1.gender
                    },
                    person2: {
                        id: person2.id,
                        username: person2.username,
                        email: person2.email,
                        gender: person2.gender
                    },
                    mutual: true,
                    round: Math.max(person1Rating.round || 0, person2Rating.round || 0),
                    timestamp: new Date().toISOString(),
                    shared: false,
                    notes: {
                        person1: person1Rating.notes,
                        person2: person2Rating.notes
                    }
                };
                
                matches.push(match);
            }
        });
    });
    
    localStorage.setItem('speedDatingMatches', JSON.stringify(matches));
    updateMatchesInfo();
    alert(`Znaleziono ${matches.length} wzajemnych dopasowań!`);
}

function showMatchesModal() {
    // Pokaż modal ze wszystkimi dopasowaniami
    const modal = document.getElementById('matches-modal');
    const container = document.getElementById('all-matches-container');
    
    container.innerHTML = matches.map((match, index) => `
        <div class="match-item ${match.mutual ? 'match-mutual' : 'match-pending'}">
            <div>
                <h4>Para #${index + 1}</h4>
                <p>
                    <strong>${match.person1.username}</strong> 
                    (${match.person1.gender}) 
                    ↔ 
                    <strong>${match.person2.username}</strong>
                    (${match.person2.gender})
                </p>
                <p>
                    <small>
                        <i class="fas fa-envelope"></i> ${match.person1.email}<br>
                        <i class="fas fa-envelope"></i> ${match.person2.email}
                    </small>
                </p>
                ${match.notes.person1 || match.notes.person2 ? `
                    <div class="match-notes">
                        <strong>Notatki:</strong><br>
                        ${match.notes.person1 ? `${match.person1.username}: "${match.notes.person1}"<br>` : ''}
                        ${match.notes.person2 ? `${match.person2.username}: "${match.notes.person2}"` : ''}
                    </div>
                ` : ''}
            </div>
            <div>
                <span class="match-status ${match.mutual ? 'status-mutual' : 'status-pending'}">
                    ${match.mutual ? 'WZAJEMNE' : 'OCZEKUJE'}
                </span>
                <br>
                <small>Runda ${match.round}</small>
                <br>
                <small>${match.shared ? 'Wysłano ✓' : 'Oczekuje'}</small>
            </div>
        </div>
    `).join('') || '<p>Brak dopasowań</p>';
    
    modal.classList.add('active');
}

function hideMatchesModal() {
    // Ukryj modal
    document.getElementById('matches-modal').classList.remove('active');
}

function approveAndSendMatches() {
    // Zatwierdź i wyślij dopasowania
    if (matches.length === 0) {
        alert('Najpierw oblicz dopasowania!');
        return;
    }
    
    const confirmed = confirm(`Czy na pewno chcesz wysłać ${matches.length} dopasowań do uczestników?`);
    if (!confirmed) return;
    
    // Oznacz jako udostępnione i wyślij emaile
    const mutualMatches = matches.filter(m => m.mutual && !m.shared);
    
    mutualMatches.forEach(match => {
        match.shared = true;
        match.sharedAt = new Date().toISOString();
        
        // Tutaj w rzeczywistej aplikacji wyślij email
        // sendMatchEmail(match);
    });
    
    // Zapisz zmiany
    localStorage.setItem('speedDatingMatches', JSON.stringify(matches));
    
    // Oznacz w ustawieniach
    eventSettings.matchesShared = true;
    localStorage.setItem('speedDatingSettings', JSON.stringify(eventSettings));
    
    updateMatchesInfo();
    alert(`Wysłano ${mutualMatches.length} dopasowań do uczestników!`);
}

// ========== FUNKCJE EKSPORTU DO EXCEL ==========
function exportToExcel() {
    // Eksportuj wszystkie dane do Excel
    const wsData = [];
    
    // Nagłówki
    wsData.push([
        'ID', 'Login', 'Email', 'Płeć', 'Zainteresowania', 
        'Data dołączenia', 'TAK (dał)', 'NIE (dał)', 
        'TAK (otrzymał)', 'NIE (otrzymał)', 'Liczba ocen'
    ]);
    
    // Dane uczestników
    participants.forEach(p => {
        wsData.push([
            p.id,
            p.username,
            p.email,
            p.gender,
            p.interested.join(', '),
            new Date(p.joinedAt).toLocaleDateString(),
            p.given?.yes || 0,
            p.given?.no || 0,
            p.received?.yes || 0,
            p.received?.no || 0,
            Object.keys(p.ratings || {}).length
        ]);
    });
    
    // Dopasowania
    wsData.push([], ['DOPASOWANIA']);
    wsData.push(['Osoba 1', 'Email 1', 'Osoba 2', 'Email 2', 'Wzajemne', 'Runda', 'Wysłano']);
    
    matches.forEach(m => {
        wsData.push([
            m.person1.username,
            m.person1.email,
            m.person2.username,
            m.person2.email,
            m.mutual ? 'TAK' : 'NIE',
            m.round,
            m.shared ? new Date(m.sharedAt || m.timestamp).toLocaleDateString() : 'NIE'
        ]);
    });
    
    // Utwórz plik Excel
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SpeedDating');
    
    // Pobierz plik
    const fileName = `speed-dating-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function exportAllMatches() {
    // Eksportuj tylko dopasowania
    const wsData = [];
    
    wsData.push(['WZAJEMNE DOPASOWANIA - SZYBKIE RANDKI']);
    wsData.push(['Wygenerowano:', new Date().toLocaleString()]);
    wsData.push([]);
    
    wsData.push(['Osoba 1', 'Email 1', 'Osoba 2', 'Email 2', 'Notatki osoby 1', 'Notatki osoby 2', 'Runda', 'Data dopasowania']);
    
    matches.filter(m => m.mutual).forEach(m => {
        wsData.push([
            m.person1.username,
            m.person1.email,
            m.person2.username,
            m.person2.email,
            m.notes.person1 || '',
            m.notes.person2 || '',
            m.round,
            new Date(m.timestamp).toLocaleDateString()
        ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dopasowania');
    
    const fileName = `dopasowania-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ========== FUNKCJE EKRANU WYNIKÓW ==========
function showResultsScreen() {
    // Pokaż ekran wyników
    if (!currentUser) {
        alert('Musisz być zalogowany aby zobaczyć wyniki!');
        return;
    }
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById('results-screen').classList.add('active');
    
    loadUserResults();
}

function loadUserResults() {
    // Załaduj wyniki użytkownika
    if (!currentUser) return;
    
    // Statystyki użytkownika
    const givenYes = currentUser.given?.yes || 0;
    const givenNo = currentUser.given?.no || 0;
    const receivedYes = currentUser.received?.yes || 0;
    const totalConversations = givenYes + givenNo;
    const mutualityRate = totalConversations > 0 ? Math.round((receivedYes / totalConversations) * 100) : 0;
    
    document.getElementById('your-conversations').textContent = totalConversations;
    document.getElementById('your-yes').textContent = givenYes;
    document.getElementById('received-yes').textContent = receivedYes;
    document.getElementById('mutuality-rate').textContent = `${mutualityRate}%`;
    
    // Dopasowania użytkownika
    const userMatches = matches.filter(m => 
        m.mutual && m.shared && 
        (m.person1.id === currentUser.id || m.person2.id === currentUser.id)
    );
    
    const matchesContainer = document.getElementById('matches-results');
    
    if (userMatches.length === 0) {
        matchesContainer.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-search"></i>
                <p>Jeszcze nie masz dopasowań</p>
                <small>Dopasowania pojawią się po zakończeniu wydarzenia i akceptacji administratora</small>
            </div>
        `;
    } else {
        matchesContainer.innerHTML = userMatches.map(match => {
            const otherPerson = match.person1.id === currentUser.id ? match.person2 : match.person1;
            const otherNotes = match.person1.id === currentUser.id ? match.notes.person2 : match.notes.person1;
            const myNotes = match.person1.id === currentUser.id ? match.notes.person1 : match.notes.person2;
            
            return `
                <div class="match-result">
                    <div class="match-header">
                        <h4><i class="fas fa-heart"></i> Dopasowanie z ${otherPerson.username}</h4>
                        <span class="match-date">${new Date(match.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div class="match-details">
                        <p><strong>Email:</strong> ${otherPerson.email}</p>
                        <p><strong>Płeć:</strong> ${otherPerson.gender}</p>
                        ${myNotes ? `<p><strong>Twoja notatka:</strong> "${myNotes}"</p>` : ''}
                        ${otherNotes ? `<p><strong>Notatka ${otherPerson.username}:</strong> "${otherNotes}"</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Notatki użytkownika
    const notesContainer = document.getElementById('your-notes');
    if (!currentUser.notes || Object.keys(currentUser.notes).length === 0) {
        notesContainer.innerHTML = '<p>Brak notatek</p>';
    } else {
        const notesList = Object.entries(currentUser.notes)
            .map(([personId, note]) => {
                const person = participants.find(p => p.id === parseInt(personId));
                if (!person || !note) return '';
                
                return `
                    <div class="note-item">
                        <div class="note-person">${person.username} (${person.gender})</div>
                        <div class="note-content">${note}</div>
                    </div>
                `;
            })
            .filter(note => note !== '')
            .join('');
        
        notesContainer.innerHTML = notesList || '<p>Brak notatek</p>';
    }
}

// ========== FUNKCJE POMOCNICZE ==========
function generateQRCode() {
    // Generuj kod QR z aktualnym adresem strony
    const currentUrl = window.location.href;
    const qrElement = document.getElementById('qr-code');
    qrElement.innerHTML = '';
    
    QRCode.toCanvas(qrElement, currentUrl, { width: 200 }, function(error) {
        if (error) {
            qrElement.innerHTML = '<p>Błąd generowania kodu QR</p>';
            console.error(error);
        }
    });
}

function stopEvent() {
    // Zatrzymaj wydarzenie
    const confirmed = confirm('Czy na pewno chcesz zakończyć wydarzenie? Uczestnicy nie będą mogli dalej oceniać.');
    
    if (confirmed) {
        eventSettings.eventStatus = 'completed';
        localStorage.setItem('speedDatingSettings', JSON.stringify(eventSettings));
        
        // Zatrzymaj timery
        if (isTimerRunning) {
            pauseTimer();
        }
        
        // Oblicz dopasowania
        calculateMatches();
        
        alert('Wydarzenie zakończone. Możesz teraz obliczyć i wysłać dopasowania.');
    }
}

function resetEvent() {
    // Resetuj całe wydarzenie
    const confirmed = confirm('Czy na pewno chcesz zresetować całe wydarzenie? Wszystkie dane zostaną usunięte.');
    
    if (confirmed) {
        participants = [];
        matches = [];
        allPairings = [];
        currentUser = null;
        currentRound = 1;
        
        localStorage.removeItem('speedDatingParticipants');
        localStorage.removeItem('speedDatingMatches');
        localStorage.removeItem('speedDatingPairings');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('speedDatingSettings');
        
        eventSettings = {
            roundDuration: 5,
            breakDuration: 2,
            ratingTime: 3,
            enableBreakTable: true,
            allowTriples: true,
            autoRotate: false,
            enableRatings: true,
            autoShareContacts: false,
            requireNotes: false,
            eventStatus: 'pending',
            matchesShared: false
        };
        
        updateParticipantsList();
        updateEventInfo();
        showLoginScreen();
        
        alert('Wydarzenie zostało zresetowane.');
    }
}