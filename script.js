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
    allowTriples: false, // ZMIENIONE: max 2 osoby przy stoliku
    autoRotate: false,
    enableRatings: true,
    eventStatus: 'pending',
    matchesShared: false
};

// Timery
let timerInterval = null;
let timeLeft = 0;
let isTimerRunning = false;
let ratingTimerInterval = null;

// ========== ROZPOZNANIE ROLI UŻYTKOWNIKA ==========
function detectUserRole() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Sprawdź czy użytkownik jest zalogowanym uczestnikiem
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        const exists = participants.find(p => p.id === currentUser.id);
        if (!exists) {
            localStorage.removeItem('currentUser');
            currentUser = null;
        } else {
            // Zalogowany uczestnik - pokaż jego panel
            showParticipantDashboard();
            return 'participant';
        }
    }
    
    // Sprawdź czy to nowy uczestnik przez parametr URL
    if (urlParams.has('participant')) {
        if (!currentUser) {
            showRegistrationScreen();
        }
        return 'new_participant';
    }
    
    // Jeśli nie ma parametru i nie jest zalogowany - to administrator
    return 'admin';
}

// ========== WIDOKI DLA UCZESTNIKÓW ==========
function showRegistrationScreen() {
    // Ukryj wszystkie ekrany
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Pokazuj tylko formularz rejestracji
    document.getElementById('login-screen').classList.add('active');
    
    // Ukryj przyciski admina i wyniki dla uczestników
    document.querySelector('.admin-buttons').style.display = 'none';
    document.querySelector('.participants-card').style.display = 'none';
    
    // Zmień nagłówek dla uczestników
    document.querySelector('.logo h1').textContent = 'Rejestracja - Speed Dating';
    document.querySelector('.subtitle').textContent = 'Dołącz do wydarzenia w 30 sekund!';
}

function showParticipantDashboard() {
    // Ukryj wszystkie ekrany
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Sprawdź czy wydarzenie jest aktywne
    if (eventSettings.eventStatus === 'active' && allPairings.length > 0) {
        // Pokazuj widok stolika uczestnika
        showMyTable();
    } else if (eventSettings.eventStatus === 'completed') {
        // Pokazuj wyniki jeśli wydarzenie zakończone
        showParticipantResults();
    } else {
        // Pokazuj ekran oczekiwania
        showWaitingScreen();
    }
}

function showWaitingScreen() {
    // Utwórz ekran oczekiwania dla uczestników
    document.getElementById('login-screen').classList.add('active');
    
    // Zmień zawartość ekranu logowania na oczekiwanie
    const loginScreen = document.getElementById('login-screen');
    loginScreen.innerHTML = `
        <div class="logo">
            <i class="fas fa-clock" style="color:#6a11cb; font-size:48px;"></i>
            <h1>Witaj ${currentUser.username}!</h1>
            <p class="subtitle">Czekamy na rozpoczęcie wydarzenia</p>
        </div>
        
        <div class="waiting-info" style="text-align:center; padding:40px;">
            <div style="background:#f8f9fa; padding:30px; border-radius:15px; max-width:500px; margin:0 auto;">
                <h3><i class="fas fa-info-circle"></i> Informacja</h3>
                <p>Wydarzenie jeszcze się nie rozpoczęło. Organizator poinformuje Cię, kiedy będziesz mógł dołączyć do rozmów.</p>
                <p><strong>Twoje dane:</strong></p>
                <ul style="text-align:left; margin:20px 0;">
                    <li>Login: <strong>${currentUser.username}</strong></li>
                    <li>Email: <strong>${currentUser.email}</strong></li>
                    <li>Płeć: <strong>${currentUser.gender}</strong></li>
                    <li>Zainteresowania: <strong>${currentUser.interested.join(', ')}</strong></li>
                </ul>
                <button id="logout-participant" class="btn" style="margin-top:20px;">
                    <i class="fas fa-sign-out-alt"></i> Wyloguj się
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('logout-participant').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        currentUser = null;
        location.href = location.pathname + '?participant';
    });
}

function showMyTable() {
    // Znajdź stolik uczestnika w aktualnej rundzie
    const roundData = allPairings[currentRound - 1];
    let myTable = null;
    let seatNumber = 0;
    
    // Szukaj w parach
    roundData.pairs.forEach((pair, tableIndex) => {
        const participantIndex = pair.findIndex(p => p.id === currentUser.id);
        if (participantIndex !== -1) {
            myTable = {
                type: 'pair',
                tableNumber: tableIndex + 1,
                people: pair,
                myIndex: participantIndex
            };
            seatNumber = participantIndex + 1;
        }
    });
    
    // Jeśli nie znaleziono w parach, sprawdź stolik przerw
    if (!myTable && roundData.breakTable) {
        const breakIndex = roundData.breakTable.findIndex(p => p.id === currentUser.id);
        if (breakIndex !== -1) {
            myTable = {
                type: 'break',
                tableNumber: 0,
                people: roundData.breakTable,
                myIndex: breakIndex
            };
        }
    }
    
    // Utwórz ekran widoku stolika
    const screen = document.createElement('div');
    screen.className = 'screen active';
    screen.id = 'participant-table-screen';
    screen.style.padding = '20px';
    
    let tableHTML = '';
    
    if (myTable) {
        if (myTable.type === 'break') {
            // Stolik przerw
            tableHTML = `
                <div class="logo" style="text-align:center;">
                    <i class="fas fa-coffee" style="color:#ff9800; font-size:48px;"></i>
                    <h1>Runda ${currentRound}</h1>
                    <p class="subtitle">Masz przerwę w tej rundzie</p>
                </div>
                
                <div style="background:#fff8e1; border:2px dashed #ffc107; border-radius:15px; padding:30px; margin:30px auto; max-width:600px; text-align:center;">
                    <h3><i class="fas fa-coffee"></i> Stolik przerw</h3>
                    <p>W tej rundzie nie masz przypisanego rozmówcy. Możesz odpocząć lub porozmawiać z innymi osobami na przerwie:</p>
                    <div style="margin:20px 0;">
                        ${roundData.breakTable.map(p => `
                            <div style="background:white; padding:15px; margin:10px; border-radius:10px; display:inline-block;">
                                <strong>${p.username}</strong> (${p.gender})
                            </div>
                        `).join('')}
                    </div>
                    <p style="color:#666; font-style:italic;">Następna runda za: <span id="round-timer">05:00</span></p>
                </div>
            `;
        } else {
            // Normalny stolik
            const otherPerson = myTable.people[myTable.myIndex === 0 ? 1 : 0];
            
            tableHTML = `
                <div class="logo" style="text-align:center;">
                    <i class="fas fa-chair" style="color:#4CAF50; font-size:48px;"></i>
                    <h1>Runda ${currentRound}</h1>
                    <p class="subtitle">Czas na rozmowę!</p>
                </div>
                
                <div style="max-width:600px; margin:0 auto;">
                    <div style="background:#4CAF50; color:white; padding:20px; border-radius:15px 15px 0 0; text-align:center;">
                        <h3><i class="fas fa-table"></i> Stolik ${myTable.tableNumber}</h3>
                        <p>Czas rozmowy: ${eventSettings.roundDuration} minut</p>
                    </div>
                    
                    <div style="display:flex; justify-content:space-around; padding:40px 20px; background:#f8f9fa; border-radius:0 0 15px 15px;">
                        <div style="text-align:center;">
                            <div style="width:100px; height:100px; background:#6a11cb; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px; color:white; font-size:36px;">
                                <i class="fas fa-user"></i>
                            </div>
                            <h4>Ty</h4>
                            <p><strong>${currentUser.username}</strong></p>
                            <small>${currentUser.gender}</small>
                            <div style="margin-top:10px; padding:5px 10px; background:#e9ecef; border-radius:10px;">
                                Miejsce ${seatNumber}
                            </div>
                        </div>
                        
                        <div style="text-align:center; align-self:center;">
                            <i class="fas fa-heart" style="font-size:24px; color:#e91e63;"></i>
                            <p style="margin-top:10px; font-size:14px;">Rozmawiajcie!</p>
                        </div>
                        
                        <div style="text-align:center;">
                            <div style="width:100px; height:100px; background:#2575fc; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px; color:white; font-size:36px;">
                                <i class="fas fa-user"></i>
                            </div>
                            <h4>Twój rozmówca</h4>
                            <p><strong>${otherPerson.username}</strong></p>
                            <small>${otherPerson.gender}</small>
                            <div style="margin-top:10px; padding:5px 10px; background:#e9ecef; border-radius:10px;">
                                Miejsce ${seatNumber === 1 ? 2 : 1}
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <div style="display:inline-block; background:#e3f2fd; padding:15px 30px; border-radius:10px;">
                            <i class="fas fa-clock"></i>
                            <span style="font-size:24px; font-weight:bold; margin-left:10px;" id="conversation-timer">${eventSettings.roundDuration}:00</span>
                            <p style="margin-top:5px; color:#666;">Pozostały czas rozmowy</p>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:40px;">
                        <button id="start-rating-btn" class="btn btn-primary" style="padding:15px 40px; font-size:18px;">
                            <i class="fas fa-star"></i> Oceń rozmowę (dostępne po sygnale)
                        </button>
                        <p style="margin-top:10px; color:#666; font-size:14px;">Przycisk będzie aktywny po zakończeniu czasu rozmowy</p>
                    </div>
                </div>
            `;
            
            // Timer rozmowy
            let conversationTimeLeft = eventSettings.roundDuration * 60;
            const timerElement = document.getElementById('conversation-timer');
            const updateTimer = () => {
                const minutes = Math.floor(conversationTimeLeft / 60);
                const seconds = conversationTimeLeft % 60;
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                if (conversationTimeLeft <= 0) {
                    clearInterval(timerInterval);
                    document.getElementById('start-rating-btn').disabled = false;
                    document.getElementById('start-rating-btn').innerHTML = '<i class="fas fa-star"></i> Oceń rozmowę TERAZ';
                    document.getElementById('start-rating-btn').style.background = '#28a745';
                }
                conversationTimeLeft--;
            };
            
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();
        }
        
        // Przycisk wylogowania
        tableHTML += `
            <div style="text-align:center; margin-top:40px;">
                <button id="participant-logout" class="btn">
                    <i class="fas fa-sign-out-alt"></i> Wyloguj się
                </button>
            </div>
        `;
        
    } else {
        // Błąd - użytkownik nie ma przypisanego stolika
        tableHTML = `
            <div style="text-align:center; padding:50px;">
                <i class="fas fa-exclamation-triangle" style="font-size:48px; color:#ff9800;"></i>
                <h2>Nie znaleziono przypisania</h2>
                <p>Nie masz przypisanego stolika w tej rundzie. Skontaktuj się z organizatorem.</p>
                <button id="go-back-participant" class="btn" style="margin-top:20px;">
                    <i class="fas fa-arrow-left"></i> Powrót
                </button>
            </div>
        `;
    }
    
    screen.innerHTML = tableHTML;
    
    // Dodaj ekran do body
    document.querySelector('.container').appendChild(screen);
    
    // Dodaj event listeners
    if (document.getElementById('participant-logout')) {
        document.getElementById('participant-logout').addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            location.href = location.pathname + '?participant';
        });
    }
    
    if (document.getElementById('go-back-participant')) {
        document.getElementById('go-back-participant').addEventListener('click', function() {
            showParticipantDashboard();
        });
    }
    
    if (document.getElementById('start-rating-btn')) {
        document.getElementById('start-rating-btn').addEventListener('click', function() {
            startRatingForParticipant(otherPerson);
        });
    }
}

function startRatingForParticipant(otherPerson) {
    // Przenieś uczestnika do ekranu oceniania
    const screen = document.getElementById('participant-table-screen');
    if (screen) screen.remove();
    
    // Pokaż ekran oceniania (uproszczona wersja)
    document.getElementById('rating-screen').classList.add('active');
    
    // Ustaw osobę do oceny
    document.getElementById('rate-person-name').textContent = otherPerson.username;
    document.getElementById('rate-person-gender').textContent = otherPerson.gender;
    
    // Dostosuj ekran oceniania dla uczestnika
    document.querySelector('.rating-header h3').textContent = 'Oceń swojego rozmówcę';
    document.getElementById('next-rating').style.display = 'none';
    document.getElementById('skip-rating').style.display = 'none';
    
    // Zmień akcję zapisu oceny
    const saveButton = document.getElementById('save-rating');
    saveButton.innerHTML = '<i class="fas fa-check"></i> Zapisz ocenę i zakończ';
    saveButton.onclick = function() {
        saveParticipantRating(otherPerson);
    };
}

function saveParticipantRating(otherPerson) {
    const selectedBtn = document.querySelector('.rating-btn.active');
    if (!selectedBtn && eventSettings.requireNotes) {
        alert('Wybierz ocenę (TAK lub NIE) przed zapisaniem!');
        return;
    }
    
    const ratingValue = selectedBtn ? selectedBtn.dataset.rating : 'no';
    const notes = document.getElementById('rating-notes').value || "Brak notatki";
    
    // Zapisz ocenę
    if (!currentUser.ratings) currentUser.ratings = {};
    currentUser.ratings[otherPerson.id] = {
        value: ratingValue,
        notes: notes,
        round: currentRound,
        timestamp: new Date().toISOString()
    };
    
    // Aktualizuj statystyki
    if (ratingValue === 'yes') {
        currentUser.given.yes = (currentUser.given.yes || 0) + 1;
        // Znajdź osobę w głównej liście i zaktualizuj
        const targetPerson = participants.find(p => p.id === otherPerson.id);
        if (targetPerson) {
            targetPerson.received.yes = (targetPerson.received.yes || 0) + 1;
        }
    } else {
        currentUser.given.no = (currentUser.given.no || 0) + 1;
        const targetPerson = participants.find(p => p.id === otherPerson.id);
        if (targetPerson) {
            targetPerson.received.no = (targetPerson.received.no || 0) + 1;
        }
    }
    
    // Zapisz zmiany
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Zaktualizuj główną listę uczestników
    const participantIndex = participants.findIndex(p => p.id === currentUser.id);
    if (participantIndex !== -1) {
        participants[participantIndex] = { ...currentUser };
        localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
    }
    
    // Powrót do dashboardu uczestnika
    alert(`Dziękujemy za ocenę! ${ratingValue === 'yes' ? 'Super, że się podobało!' : 'Następna rozmowa będzie lepsza!'}`);
    showParticipantDashboard();
}

function showParticipantResults() {
    // Pokazuje wyniki dla uczestnika po zakończeniu wydarzenia
    document.getElementById('results-screen').classList.add('active');
    
    // Dostosuj wyniki dla uczestnika
    document.getElementById('back-to-main').style.display = 'none';
    
    // Dodaj przycisk wylogowania w wynikach
    const resultsContainer = document.querySelector('.results-container');
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Wyloguj się';
    logoutBtn.style.margin = '20px auto';
    logoutBtn.style.display = 'block';
    logoutBtn.onclick = function() {
        localStorage.removeItem('currentUser');
        location.href = location.pathname + '?participant';
    };
    resultsContainer.appendChild(logoutBtn);
}

// ========== ZAWAŃSOWANY ALGORYTM DOBIERANIA PAR ==========
function generateSmartPairings() {
    allPairings = [];
    const usedPairs = new Set();
    
    totalRounds = calculateOptimalRounds(participants);
    const enableBreakTable = eventSettings.enableBreakTable;
    
    for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
        const roundResult = {
            round: roundNum,
            pairs: [],
            breakTable: []
        };
        
        const roundParticipants = [...participants];
        shuffleArray(roundParticipants);
        
        const paired = new Set();
        
        // KROK 1: Znajdź IDEALNE pary (wzajemne zainteresowanie + nie rozmawiali wcześniej)
        for (let i = 0; i < roundParticipants.length; i++) {
            if (paired.has(roundParticipants[i].id)) continue;
            
            let bestMatch = null;
            let bestScore = -1;
            
            for (let j = i + 1; j < roundParticipants.length; j++) {
                if (paired.has(roundParticipants[j].id)) continue;
                
                const pairKey = getPairKey(roundParticipants[i].id, roundParticipants[j].id);
                if (usedPairs.has(pairKey)) continue;
                
                // WARUNEK 1: Czy osoby są wzajemnie zainteresowane?
                const mutualInterest = checkMutualInterest(roundParticipants[i], roundParticipants[j]);
                if (!mutualInterest) continue;
                
                // WARUNEK 2: Czy pasują do swoich preferencji?
                const compatibilityScore = calculateCompatibility(roundParticipants[i], roundParticipants[j]);
                
                if (compatibilityScore > bestScore) {
                    bestScore = compatibilityScore;
                    bestMatch = j;
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
        
        // KROK 2: Dla pozostałych osób spróbuj znaleźć CHOCIAŻ JEDNOSTRONNE dopasowanie
        const remaining = roundParticipants.filter(p => !paired.has(p.id));
        
        for (let i = 0; i < remaining.length; i++) {
            if (paired.has(remaining[i].id)) continue;
            
            for (let j = i + 1; j < remaining.length; j++) {
                if (paired.has(remaining[j].id)) continue;
                
                // Sprawdź czy przynajmniej jedna osoba jest zainteresowana drugą
                if (checkOneWayInterest(remaining[i], remaining[j]) || 
                    checkOneWayInterest(remaining[j], remaining[i])) {
                    
                    roundResult.pairs.push([remaining[i], remaining[j]]);
                    paired.add(remaining[i].id);
                    paired.add(remaining[j].id);
                    break;
                }
            }
        }
        
        // KROK 3: Osoby bez pary idą na przerwę
        const stillUnpaired = roundParticipants.filter(p => !paired.has(p.id));
        if (stillUnpaired.length > 0 && enableBreakTable) {
            roundResult.breakTable = [...stillUnpaired];
        }
        
        allPairings.push(roundResult);
    }
    
    localStorage.setItem('speedDatingPairings', JSON.stringify(allPairings));
    return allPairings;
}

function checkOneWayInterest(person1, person2) {
    // Sprawdza czy person1 jest zainteresowany person2
    return person1.interested.includes(person2.gender);
}

function calculateCompatibility(person1, person2) {
    let score = 0;
    
    // Wzajemne zainteresowanie = najwyższy wynik
    if (checkMutualInterest(person1, person2)) {
        score += 100;
    }
    
    // Unikaj łączenia tych samych osób
    score += Math.random() * 10; // Losowy element dla różnorodności
    
    return score;
}

// ========== INICJALIZACJA APLIKACJI ==========
function initializeApp() {
    const userRole = detectUserRole();
    
    if (userRole === 'admin' || userRole === 'new_participant') {
        // Załaduj podstawowe elementy dla admina/rejestracji
        generateQRCode();
        updateParticipantsList();
        loadSettings();
        updateEventInfo();
        
        if (userRole === 'admin') {
            setupEventListeners();
        }
    }
}

// ========== FUNKCJE POMOCNICZE (muszą być w script.js) ==========
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

// ========== URUCHOMIENIE APLIKACJI ==========
document.addEventListener('DOMContentLoaded', initializeApp);
