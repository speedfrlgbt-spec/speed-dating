// ============================================
// SPEED DATING PRO - ZAAWANSOWANA APLIKACJA
// ============================================

// ========== KONFIGURACJA I STAŁE ==========
const CONFIG = {
    MAX_PARTICIPANTS: 50,
    MIN_PARTICIPANTS: 2,
    MAX_ROUNDS: 10,
    MIN_ROUND_TIME: 1, // minuty
    MAX_ROUND_TIME: 30,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minut
    HEARTBEAT_INTERVAL: 30000, // 30 sekund
    RECONNECT_ATTEMPTS: 3,
    VERSION: '2.0.0'
};

// ========== GLOBALNE ZMIENNE ==========
let participants = [];
let eventData = {};
let currentUser = null;
let timerInterval = null;
let ratingTimerInterval = null;
let timeLeft = 0;
let ratingTimeLeft = 0;
let currentPartner = null;
let isDemoMode = false;
let connectionStatus = true;
let heartbeatTimer = null;

// ========== KLASY APLIKACJI ==========
class SpeedDatingApp {
    constructor() {
        this.initialize();
    }

    initialize() {
        console.log(`Speed Dating Pro v${CONFIG.VERSION}`);
        
        // Inicjalizacja toastr
        toastr.options = {
            positionClass: 'toast-top-right',
            progressBar: true,
            timeOut: 3000,
            closeButton: true
        };

        this.loadData();
        this.setupEventListeners();
        this.startHeartbeat();
        this.showLoadingScreen();
        
        // Symulacja ładowania
        setTimeout(() => {
            this.detectRole();
        }, 1500);
    }

    showLoadingScreen() {
        this.hideAllScreens();
        document.getElementById('loading-screen').classList.add('active');
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    loadData() {
        try {
            // Ładowanie uczestników
            const storedParticipants = localStorage.getItem('speedDatingParticipants');
            participants = storedParticipants ? JSON.parse(storedParticipants) : [];
            
            // Czyszczenie nieaktywnych sesji
            this.cleanOldSessions();
            
            // Ładowanie danych wydarzenia
            const storedEvent = localStorage.getItem('speedDatingEvent');
            eventData = storedEvent ? JSON.parse(storedEvent) : this.getDefaultEventData();
            
            console.log(`Załadowano ${participants.length} uczestników`);
        } catch (error) {
            console.error('Błąd ładowania danych:', error);
            participants = [];
            eventData = this.getDefaultEventData();
        }
    }

    getDefaultEventData() {
        return {
            status: 'waiting',
            currentRound: 1,
            totalRounds: 5,
            roundTime: 5,
            ratingTime: 2,
            pairings: [],
            ratings: [],
            settings: {
                allowRepeats: false,
                maxParticipants: CONFIG.MAX_PARTICIPANTS,
                matchingAlgorithm: 'smart',
                notifications: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    saveData() {
        try {
            eventData.updatedAt = new Date().toISOString();
            localStorage.setItem('speedDatingParticipants', JSON.stringify(participants));
            localStorage.setItem('speedDatingEvent', JSON.stringify(eventData));
            this.triggerEvent('dataSaved');
        } catch (error) {
            console.error('Błąd zapisywania danych:', error);
            this.showNotification('Błąd zapisywania danych!', 'error');
        }
    }

    cleanOldSessions() {
        const now = Date.now();
        participants = participants.filter(p => {
            if (!p || !p.lastSeen) return false;
            const lastSeen = new Date(p.lastSeen).getTime();
            return (now - lastSeen) < CONFIG.SESSION_TIMEOUT && p.active !== false;
        });
        this.saveData();
    }

    // ========== SYSTEM SESJI ==========
    getUserSessionId() {
        try {
            return localStorage.getItem('currentSessionId');
        } catch (error) {
            console.error('Błąd pobierania sesji:', error);
            return null;
        }
    }

    setUserSessionId(sessionId) {
        try {
            localStorage.setItem('currentSessionId', sessionId);
            return true;
        } catch (error) {
            console.error('Błąd ustawiania sesji:', error);
            return false;
        }
    }

    createNewSession() {
        try {
            const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.setUserSessionId(sessionId);
            return sessionId;
        } catch (error) {
            console.error('Błąd tworzenia sesji:', error);
            return null;
        }
    }

    // ========== DETEKCJA ROLI ==========
    detectRole() {
        try {
            this.hideAllScreens();
            
            // Sprawdź czy jesteśmy w trybie demo
            if (isDemoMode) {
                this.showUserPanel();
                return;
            }
            
            // Sprawdź sesję użytkownika
            const sessionId = this.getUserSessionId();
            if (sessionId) {
                currentUser = participants.find(p => 
                    p && p.sessionId === sessionId && p.active !== false
                );
                
                if (currentUser) {
                    this.updateUserLastSeen();
                    this.showUserPanel();
                    return;
                }
            }
            
            // Sprawdź URL parametry
            const urlParams = new URLSearchParams(window.location.search);
            const mode = urlParams.get('mode');
            
            if (mode === 'admin') {
                this.showAdminPanel();
            } else {
                this.showModeSelection();
            }
            
        } catch (error) {
            console.error('Błąd detectRole:', error);
            this.showErrorScreen('Błąd ładowania aplikacji');
        }
    }

    showModeSelection() {
        this.hideAllScreens();
        document.getElementById('mode-screen').classList.add('active');
    }

    // ========== EKRAN REJESTRACJI ==========
    showRegistrationScreen() {
        this.hideAllScreens();
        document.getElementById('login-screen').classList.add('active');
        this.initializeRegistrationForm();
    }

    initializeRegistrationForm() {
        const form = document.getElementById('register-form');
        const steps = document.querySelectorAll('.form-step');
        const stepperSteps = document.querySelectorAll('.stepper-progress .step');
        let currentStep = 1;

        // Inicjalizacja przycisków płci
        document.querySelectorAll('.gender-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('reg-gender').value = btn.dataset.value;
                this.clearError('gender-error');
            });
        });

        // Inicjalizacja przycisków zainteresowań
        document.querySelectorAll('.interest-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                this.updateInterests();
            });
        });

        // Licznik znaków w biografii
        const bioTextarea = document.getElementById('reg-bio');
        const bioCounter = document.getElementById('bio-counter');
        
        if (bioTextarea && bioCounter) {
            bioTextarea.addEventListener('input', () => {
                bioCounter.textContent = bioTextarea.value.length;
                if (bioTextarea.value.length > 180) {
                    bioCounter.classList.add('warning');
                } else {
                    bioCounter.classList.remove('warning');
                }
            });
        }

        // Przyciski nawigacji
        document.querySelectorAll('.btn-next').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.validateStep(currentStep)) {
                    this.showStep(parseInt(btn.dataset.next));
                }
            });
        });

        document.querySelectorAll('.btn-back-step').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showStep(parseInt(btn.dataset.prev));
            });
        });

        // Przycisk powrotu
        document.getElementById('back-to-mode')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showModeSelection();
        });

        // Obsługa formularza
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateStep(3)) {
                this.handleRegistration();
            }
        });

        // Walidacja w czasie rzeczywistym
        document.getElementById('reg-username')?.addEventListener('input', () => {
            this.validateUsername();
        });

        document.getElementById('reg-email')?.addEventListener('input', () => {
            this.validateEmail();
        });
    }

    showStep(stepNumber) {
        const steps = document.querySelectorAll('.form-step');
        const stepperSteps = document.querySelectorAll('.stepper-progress .step');
        
        steps.forEach(step => step.classList.remove('active'));
        stepperSteps.forEach(step => step.classList.remove('active'));
        
        document.querySelector(`.form-step[data-step="${stepNumber}"]`).classList.add('active');
        document.querySelector(`.step[data-step="${stepNumber}"]`).classList.add('active');
        
        // Aktualizuj podsumowanie
        if (stepNumber === 3) {
            this.updateSummary();
        }
    }

    validateStep(step) {
        switch(step) {
            case 1:
                return this.validateStep1();
            case 2:
                return this.validateStep2();
            case 3:
                return this.validateStep3();
            default:
                return true;
        }
    }

    validateStep1() {
        let valid = true;
        
        if (!this.validateUsername()) valid = false;
        if (!this.validateEmail()) valid = false;
        if (!this.validateGender()) valid = false;
        
        return valid;
    }

    validateStep2() {
        let valid = true;
        
        if (!this.validateInterests()) valid = false;
        
        const age = document.getElementById('reg-age').value;
        if (age && (age < 18 || age > 100)) {
            this.showError('interests-error', 'Wiek musi być między 18 a 100 lat');
            valid = false;
        }
        
        return valid;
    }

    validateStep3() {
        if (!document.getElementById('reg-terms').checked) {
            this.showError('terms-error', 'Musisz zaakceptować regulamin');
            return false;
        }
        
        this.clearError('terms-error');
        return true;
    }

    validateUsername() {
        const username = document.getElementById('reg-username').value.trim();
        const errorElement = document.getElementById('username-error');
        
        if (!username) {
            this.showError('username-error', 'Nazwa użytkownika jest wymagana');
            return false;
        }
        
        if (username.length < 3 || username.length > 20) {
            this.showError('username-error', 'Nazwa musi mieć 3-20 znaków');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showError('username-error', 'Dozwolone tylko litery, cyfry i podkreślnik');
            return false;
        }
        
        const existingUser = participants.find(p => 
            p && p.username.toLowerCase() === username.toLowerCase() && p.active !== false
        );
        
        if (existingUser) {
            this.showError('username-error', 'Nazwa użytkownika jest już zajęta');
            return false;
        }
        
        this.clearError('username-error');
        return true;
    }

    validateEmail() {
        const email = document.getElementById('reg-email').value.trim();
        const errorElement = document.getElementById('email-error');
        
        if (!email) {
            this.showError('email-error', 'Email jest wymagany');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('email-error', 'Podaj poprawny adres email');
            return false;
        }
        
        const existingEmail = participants.find(p => 
            p && p.email.toLowerCase() === email.toLowerCase() && p.active !== false
        );
        
        if (existingEmail) {
            this.showError('email-error', 'Ten email jest już zarejestrowany');
            return false;
        }
        
        this.clearError('email-error');
        return true;
    }

    validateGender() {
        const gender = document.getElementById('reg-gender').value;
        
        if (!gender) {
            this.showError('gender-error', 'Wybierz swoją płeć');
            return false;
        }
        
        this.clearError('gender-error');
        return true;
    }

    validateInterests() {
        const interests = JSON.parse(document.getElementById('reg-interests').value || '[]');
        
        if (interests.length === 0) {
            this.showError('interests-error', 'Wybierz przynajmniej jedną opcję');
            return false;
        }
        
        this.clearError('interests-error');
        return true;
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    clearError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    updateInterests() {
        const selected = Array.from(document.querySelectorAll('.interest-btn.selected'))
            .map(btn => btn.dataset.value);
        document.getElementById('reg-interests').value = JSON.stringify(selected);
    }

    updateSummary() {
        document.getElementById('summary-username').textContent = 
            document.getElementById('reg-username').value || '-';
        document.getElementById('summary-email').textContent = 
            document.getElementById('reg-email').value || '-';
        
        const gender = document.getElementById('reg-gender').value;
        document.getElementById('summary-gender').textContent = 
            gender === 'male' ? 'Mężczyzna' : 
            gender === 'female' ? 'Kobieta' : 'Inna';
        
        const age = document.getElementById('reg-age').value;
        document.getElementById('summary-age').textContent = age || 'Nie podano';
        
        const interests = JSON.parse(document.getElementById('reg-interests').value || '[]');
        const interestsText = interests.map(i => 
            i === 'male' ? 'Mężczyzn' : 
            i === 'female' ? 'Kobiet' : 'Innych'
        ).join(', ');
        document.getElementById('summary-interests').textContent = interestsText || '-';
        
        const bio = document.getElementById('reg-bio').value;
        document.getElementById('summary-bio').textContent = bio || 'Nie podano';
    }

    async handleRegistration() {
        try {
            // Sprawdź limit uczestników
            const activeParticipants = participants.filter(p => p && p.active !== false);
            if (activeParticipants.length >= CONFIG.MAX_PARTICIPANTS) {
                this.showNotification('Osiągnięto limit uczestników!', 'error');
                return;
            }

            const userData = {
                id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                username: document.getElementById('reg-username').value.trim(),
                email: document.getElementById('reg-email').value.trim(),
                gender: document.getElementById('reg-gender').value,
                interested: JSON.parse(document.getElementById('reg-interests').value || '[]'),
                age: document.getElementById('reg-age').value || null,
                bio: document.getElementById('reg-bio').value || '',
                joinedAt: new Date().toISOString(),
                ratings: {},
                tags: {},
                status: 'active',
                active: true,
                lastSeen: new Date().toISOString(),
                sessionId: this.createNewSession(),
                avatarColor: this.getRandomColor()
            };

            participants.push(userData);
            currentUser = userData;
            this.saveData();

            this.showNotification('Rejestracja zakończona sukcesem!', 'success');
            this.showUserPanel();

        } catch (error) {
            console.error('Błąd rejestracji:', error);
            this.showNotification('Błąd rejestracji!', 'error');
        }
    }

    getRandomColor() {
        const colors = ['#667eea', '#764ba2', '#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ========== PANEL UŻYTKOWNIKA ==========
    showUserPanel() {
        this.hideAllScreens();
        document.getElementById('user-panel').classList.add('active');
        
        if (!currentUser) {
            this.showRegistrationScreen();
            return;
        }

        this.updateUserInterface();
        this.setupUserPanelListeners();
    }

    updateUserInterface() {
        // Aktualizuj nagłówek
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-avatar-icon').style.color = currentUser.avatarColor || '#667eea';
        
        // Aktualizuj status wydarzenia
        this.updateEventStatus();
        
        // Aktualizuj zawartość
        this.updateUserContent();
        
        // Aktualizuj stopkę
        this.updateFooter();
    }

    updateEventStatus() {
        const statusElement = document.getElementById('event-status');
        const participantsElement = document.getElementById('event-participants');
        
        if (statusElement) {
            const statusText = eventData.status === 'waiting' ? 'Oczekiwanie' :
                             eventData.status === 'active' ? 'W trakcie' : 'Zakończone';
            statusElement.textContent = `Status: ${statusText}`;
        }
        
        if (participantsElement) {
            const activeCount = participants.filter(p => p && p.active !== false).length;
            participantsElement.textContent = `Uczestników: ${activeCount}`;
        }
    }

    updateUserContent() {
        const contentElement = document.getElementById('user-content');
        if (!contentElement) return;

        const activeSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        
        switch(activeSection) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'current-round':
                this.renderCurrentRound();
                break;
            case 'matches':
                this.renderMatches();
                break;
            case 'history':
                this.renderHistory();
                break;
            case 'settings':
                this.renderSettings();
                break;
            default:
                this.renderDashboard();
        }
    }

    renderDashboard() {
        const content = document.getElementById('user-content');
        if (!content) return;

        let html = `
            <div class="dashboard-section">
                <div class="section-header">
                    <h2><i class="fas fa-home"></i> Panel główny</h2>
                    <div class="user-welcome">
                        <p>Witaj, <strong>${currentUser.username}</strong>! 👋</p>
                    </div>
                </div>
                
                <div class="dashboard-stats">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: rgba(102, 126, 234, 0.1); color: #667eea;">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Aktualna runda</h3>
                                <div class="stat-value">${eventData.currentRound || 1}/${eventData.totalRounds || 5}</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                                <i class="fas fa-handshake"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Rozmowy</h3>
                                <div class="stat-value">${Object.keys(currentUser.ratings || {}).length}</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                                <i class="fas fa-heart"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Dopasowania</h3>
                                <div class="stat-value" id="matches-count-value">0</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Następna runda</h3>
                                <div class="stat-value" id="next-round-timer">--:--</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (eventData.status === 'active') {
            html += `
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2><i class="fas fa-clock"></i> Aktualny timer</h2>
                    </div>
                    <div class="timer-container" id="main-timer-container">
                        <div class="timer-label">Pozostały czas rundy</div>
                        <div class="timer-display" id="dashboard-timer">${this.formatTime((eventData.roundTime || 5) * 60)}</div>
                        <div class="timer-actions">
                            <button class="btn btn-primary" id="start-timer-btn">
                                <i class="fas fa-play"></i> Start
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2><i class="fas fa-chair"></i> Twój stolik</h2>
                    </div>
                    <div id="current-table-container">
                        <!-- Zawartość stolika zostanie załadowana dynamicznie -->
                    </div>
                </div>
            `;
        } else if (eventData.status === 'waiting') {
            html += `
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2><i class="fas fa-hourglass-half"></i> Oczekiwanie na rozpoczęcie</h2>
                    </div>
                    <div class="waiting-message">
                        <div class="waiting-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <h3>Wydarzenie jeszcze się nie rozpoczęło</h3>
                        <p>Organizator poinformuje Cię, kiedy będziesz mógł dołączyć do rozmów.</p>
                        <p>Liczba zarejestrowanych uczestników: <strong>${participants.filter(p => p && p.active !== false).length}</strong></p>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2><i class="fas fa-flag-checkered"></i> Wydarzenie zakończone</h2>
                    </div>
                    <div class="finished-message">
                        <div class="finished-icon">
                            <i class="fas fa-trophy"></i>
                        </div>
                        <h3>Dziękujemy za udział!</h3>
                        <p>Twoje wyniki zostały zapisane. Organizator prześle Ci podsumowanie.</p>
                        <div class="final-stats">
                            <p>Rozegrane rundy: <strong>${eventData.currentRound || 0}</strong></p>
                            <p>Twoje oceny: <strong>${Object.keys(currentUser.ratings || {}).length}</strong></p>
                            <p>Dopasowania: <strong id="final-matches-count">0</strong></p>
                        </div>
                    </div>
                </div>
            `;
        }

        content.innerHTML = html;
        
        // Inicjalizuj timer na dashboardzie
        if (eventData.status === 'active') {
            this.updateCurrentTable();
            this.startDashboardTimer();
        }
        
        // Oblicz dopasowania
        this.calculateMatches();
    }

    renderCurrentRound() {
        const content = document.getElementById('user-content');
        if (!content) return;

        if (eventData.status !== 'active') {
            content.innerHTML = `
                <div class="dashboard-section">
                    <h2><i class="fas fa-clock"></i> Aktualna runda</h2>
                    <p>Wydarzenie nie jest aktywne.</p>
                </div>
            `;
            return;
        }

        this.updateCurrentTable();
    }

    renderMatches() {
        const content = document.getElementById('user-content');
        if (!content) return;

        const matches = this.calculateMatches();
        const matchesCount = document.getElementById('matches-count');
        if (matchesCount) {
            matchesCount.textContent = matches.length;
        }

        let html = `
            <div class="dashboard-section">
                <div class="section-header">
                    <h2><i class="fas fa-heart"></i> Twoje dopasowania</h2>
                    <div class="matches-summary">
                        <span class="badge success">${matches.length} dopasowań</span>
                    </div>
                </div>
        `;

        if (matches.length === 0) {
            html += `
                <div class="no-matches">
                    <div class="no-matches-icon">
                        <i class="fas fa-heart-broken"></i>
                    </div>
                    <h3>Brak dopasowań</h3>
                    <p>Jeszcze nie masz żadnych wzajemnych dopasowań.</p>
                    <p>Kontynuuj rozmowy i oceniaj uczestników!</p>
                </div>
            `;
        } else {
            html += `
                <div class="matches-grid">
                    ${matches.map(match => {
                        const participant = participants.find(p => p && p.id === match.partnerId);
                        if (!participant) return '';
                        
                        return `
                            <div class="match-card" data-user-id="${participant.id}">
                                <div class="match-avatar" style="background: ${participant.avatarColor || '#667eea'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="match-info">
                                    <h3 class="match-name">${participant.username}</h3>
                                    <div class="match-details">
                                        <span class="match-gender">
                                            <i class="fas fa-${participant.gender === 'male' ? 'mars' : participant.gender === 'female' ? 'venus' : 'genderless'}"></i>
                                            ${participant.gender === 'male' ? 'Mężczyzna' : participant.gender === 'female' ? 'Kobieta' : 'Inna'}
                                        </span>
                                        <span class="match-score">
                                            <i class="fas fa-star"></i>
                                            Dopasowanie: ${match.score}%
                                        </span>
                                    </div>
                                    <div class="match-actions">
                                        <button class="btn btn-sm btn-outline view-profile-btn" data-user-id="${participant.id}">
                                            <i class="fas fa-eye"></i> Profil
                                        </button>
                                        <button class="btn btn-sm btn-primary connect-btn" data-user-id="${participant.id}">
                                            <i class="fas fa-comment"></i> Kontakt
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += `</div>`;
        content.innerHTML = html;

        // Dodaj event listeners do przycisków
        document.querySelectorAll('.view-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('.view-profile-btn').dataset.userId;
                this.showUserProfile(userId);
            });
        });
    }

    renderHistory() {
        const content = document.getElementById('user-content');
        if (!content) return;

        const userRatings = currentUser.ratings || {};
        const ratingEntries = Object.entries(userRatings);

        let html = `
            <div class="dashboard-section">
                <div class="section-header">
                    <h2><i class="fas fa-history"></i> Historia rozmów</h2>
                    <div class="history-summary">
                        <span class="badge">${ratingEntries.length} rozmów</span>
                    </div>
                </div>
        `;

        if (ratingEntries.length === 0) {
            html += `
                <div class="no-history">
                    <div class="no-history-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h3>Brak historii</h3>
                    <p>Jeszcze nie oceniłeś żadnych rozmówców.</p>
                </div>
            `;
        } else {
            html += `
                <div class="history-timeline">
                    ${ratingEntries.map(([partnerId, rating]) => {
                        const partner = participants.find(p => p && p.id === partnerId);
                        if (!partner) return '';
                        
                        const ratingDate = new Date(rating.timestamp);
                        const ratingIcon = rating.rating === 'yes' ? 'fa-thumbs-up text-success' :
                                         rating.rating === 'no' ? 'fa-thumbs-down text-danger' :
                                         'fa-question text-warning';
                        
                        return `
                            <div class="timeline-item">
                                <div class="timeline-date">
                                    ${ratingDate.toLocaleDateString()} ${ratingDate.toLocaleTimeString()}
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-avatar" style="background: ${partner.avatarColor || '#667eea'}">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="timeline-details">
                                        <h4>Rozmowa z ${partner.username}</h4>
                                        <div class="timeline-rating">
                                            <i class="fas ${ratingIcon}"></i>
                                            <span>Ocena: ${rating.rating === 'yes' ? 'TAK' : rating.rating === 'no' ? 'NIE' : 'MOŻE'}</span>
                                        </div>
                                        ${rating.note ? `
                                            <div class="timeline-note">
                                                <i class="fas fa-comment"></i>
                                                <p>${rating.note}</p>
                                            </div>
                                        ` : ''}
                                        ${rating.tags && rating.tags.length > 0 ? `
                                            <div class="timeline-tags">
                                                ${rating.tags.map(tag => `
                                                    <span class="tag">${tag}</span>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += `</div>`;
        content.innerHTML = html;
    }

    renderSettings() {
        const content = document.getElementById('user-content');
        if (!content) return;

        const html = `
            <div class="dashboard-section">
                <div class="section-header">
                    <h2><i class="fas fa-user-edit"></i> Edytuj profil</h2>
                </div>
                
                <form id="profile-form" class="profile-form">
                    <div class="form-group">
                        <label for="profile-username">
                            <i class="fas fa-user"></i> Nazwa użytkownika
                        </label>
                        <input type="text" id="profile-username" value="${currentUser.username}" disabled>
                        <div class="form-hint">Nazwy użytkownika nie można zmienić</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="profile-email">
                            <i class="fas fa-envelope"></i> Email
                        </label>
                        <input type="email" id="profile-email" value="${currentUser.email}">
                    </div>
                    
                    <div class="form-group">
                        <label for="profile-bio">
                            <i class="fas fa-comment-alt"></i> O sobie
                        </label>
                        <textarea id="profile-bio" rows="4">${currentUser.bio || ''}</textarea>
                        <div class="char-counter">
                            <span id="profile-bio-counter">${currentUser.bio?.length || 0}</span>/200
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <i class="fas fa-bell"></i> Powiadomienia
                        </label>
                        <div class="settings-options">
                            <label class="checkbox-label">
                                <input type="checkbox" id="notify-matches" checked>
                                <span class="checkmark"></span>
                                <span>Powiadomienia o dopasowaniach</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="notify-rounds" checked>
                                <span class="checkmark"></span>
                                <span>Powiadomienia o nowych rundach</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" id="cancel-profile">
                            <i class="fas fa-times"></i> Anuluj
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Zapisz zmiany
                        </button>
                    </div>
                </form>
            </div>
        `;

        content.innerHTML = html;

        // Licznik znaków w biografii
        const bioTextarea = document.getElementById('profile-bio');
        const bioCounter = document.getElementById('profile-bio-counter');
        
        if (bioTextarea && bioCounter) {
            bioTextarea.addEventListener('input', () => {
                bioCounter.textContent = bioTextarea.value.length;
            });
        }

        // Obsługa formularza
        document.getElementById('profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfileChanges();
        });

        document.getElementById('cancel-profile')?.addEventListener('click', () => {
            this.updateUserContent();
        });
    }

    saveProfileChanges() {
        const email = document.getElementById('profile-email').value.trim();
        const bio = document.getElementById('profile-bio').value.trim();

        // Walidacja email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('Podaj poprawny adres email', 'error');
            return;
        }

        // Sprawdź czy email nie jest już używany
        const existingEmail = participants.find(p => 
            p && p.id !== currentUser.id && 
            p.email.toLowerCase() === email.toLowerCase() && 
            p.active !== false
        );

        if (existingEmail) {
            this.showNotification('Ten email jest już używany', 'error');
            return;
        }

        // Aktualizuj dane użytkownika
        currentUser.email = email;
        currentUser.bio = bio;

        // Znajdź i zaktualizuj użytkownika w tablicy participants
        const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
        if (userIndex !== -1) {
            participants[userIndex] = currentUser;
            this.saveData();
        }

        this.showNotification('Profil zaktualizowany pomyślnie', 'success');
        this.updateUserContent();
    }

    updateCurrentTable() {
        const container = document.getElementById('current-table-container') || document.getElementById('user-content');
        if (!container) return;

        if (eventData.status !== 'active') {
            container.innerHTML = `
                <div class="no-active-round">
                    <i class="fas fa-clock"></i>
                    <h3>Brak aktywnej rundy</h3>
                </div>
            `;
            return;
        }

        const roundPairings = eventData.pairings?.[eventData.currentRound - 1];
        
        if (!roundPairings || !roundPairings.pairs) {
            container.innerHTML = `
                <div class="table-waiting">
                    <div class="loading-spinner">
                        <i class="fas fa-random"></i>
                    </div>
                    <h3>Losowanie par...</h3>
                    <p>Proszę czekać na przypisanie do stolika</p>
                </div>
            `;
            return;
        }

        // Znajdź parę użytkownika
        let userTable = null;
        let partner = null;
        
        for (const pair of roundPairings.pairs) {
            if (pair && Array.isArray(pair)) {
                const userInPair = pair.find(p => p && p.id === currentUser.id);
                if (userInPair) {
                    partner = pair.find(p => p && p.id !== currentUser.id);
                    userTable = pair;
                    break;
                }
            }
        }

        // Sprawdź czy użytkownik jest na przerwie
        if (!userTable && roundPairings.breakTable) {
            const inBreak = roundPairings.breakTable.find(p => p && p.id === currentUser.id);
            if (inBreak) {
                container.innerHTML = `
                    <div class="break-screen">
                        <div class="break-icon">
                            <i class="fas fa-coffee"></i>
                        </div>
                        <h3>Przerwa - Runda ${eventData.currentRound}</h3>
                        <p>W tej rundzie masz przerwę. Możesz odpocząć lub porozmawiać z innymi osobami.</p>
                        <div class="break-timer">
                            <div class="timer-display">${this.formatTime((eventData.roundTime || 5) * 60)}</div>
                            <p class="timer-label">Pozostały czas rundy</p>
                        </div>
                    </div>
                `;
                return;
            }
        }

        if (userTable && partner) {
            container.innerHTML = `
                <div class="table-display">
                    <div class="table-card active">
                        <div class="table-header">
                            <div class="table-number">
                                <i class="fas fa-chair"></i> Stolik
                            </div>
                            <div class="table-round">
                                Runda ${eventData.currentRound}
                            </div>
                        </div>
                        
                        <div class="table-participants">
                            <div class="participant current-user">
                                <div class="participant-avatar" style="background: ${currentUser.avatarColor || '#667eea'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="participant-name">${currentUser.username}</div>
                                <div class="participant-gender">TY</div>
                            </div>
                            
                            <div class="table-divider">
                                <i class="fas fa-heart"></i>
                            </div>
                            
                            <div class="participant partner-user">
                                <div class="participant-avatar" style="background: ${partner.avatarColor || '#ff6b6b'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="participant-name">${partner.username}</div>
                                <div class="participant-gender">ROZMÓWCA</div>
                            </div>
                        </div>
                        
                        <div class="table-timer">
                            <div class="timer-display" id="table-timer">${this.formatTime((eventData.roundTime || 5) * 60)}</div>
                            <div class="timer-label">Pozostały czas rozmowy</div>
                        </div>
                        
                        <div class="table-actions">
                            <button class="btn btn-primary btn-block" id="start-rating-btn" disabled>
                                <i class="fas fa-hourglass-half"></i> Oceń po zakończeniu czasu
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Rozpocznij timer
            this.startTableTimer((eventData.roundTime || 5) * 60, () => {
                const ratingBtn = document.getElementById('start-rating-btn');
                if (ratingBtn) {
                    ratingBtn.disabled = false;
                    ratingBtn.innerHTML = '<i class="fas fa-star"></i> Oceń rozmówcę TERAZ';
                    ratingBtn.addEventListener('click', () => {
                        this.showRatingScreen(partner);
                    });
                }
            });

        } else {
            container.innerHTML = `
                <div class="no-table-assigned">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Nie znaleziono stolika</h3>
                    <p>Nie znaleziono stolika dla Ciebie w tej rundzie.</p>
                    <button class="btn btn-outline" onclick="app.updateCurrentTable()">
                        <i class="fas fa-redo"></i> Spróbuj ponownie
                    </button>
                </div>
            `;
        }
    }

    startTableTimer(seconds, onComplete) {
        let timeLeft = seconds;
        const timerElement = document.getElementById('table-timer');
        
        if (!timerElement) return;
        
        const interval = setInterval(() => {
            timeLeft--;
            timerElement.textContent = this.formatTime(timeLeft);
            
            if (timeLeft < 60) {
                timerElement.style.color = '#ef4444';
            }
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, 1000);
    }

    startDashboardTimer() {
        const timerElement = document.getElementById('dashboard-timer');
        if (!timerElement) return;
        
        // Symulacja timera na dashboardzie
        let timeLeft = (eventData.roundTime || 5) * 60;
        timerElement.textContent = this.formatTime(timeLeft);
        
        const interval = setInterval(() => {
            timeLeft--;
            timerElement.textContent = this.formatTime(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(interval);
            }
        }, 1000);
    }

    // ========== SYSTEM OCENIANIA ==========
    showRatingScreen(partner) {
        this.hideAllScreens();
        currentPartner = partner;
        
        const ratingScreen = document.getElementById('rating-screen');
        ratingScreen.classList.add('active');
        
        // Aktualizuj UI
        document.getElementById('rate-person').textContent = partner.username;
        document.getElementById('rating-round-num').textContent = eventData.currentRound;
        document.getElementById('rating-avatar-icon').style.color = partner.avatarColor || '#ff6b6b';
        
        this.initializeRatingScreen();
    }

    initializeRatingScreen() {
        let selectedRating = null;
        let selectedTags = [];
        
        // Obsługa wyboru oceny
        document.querySelectorAll('.rating-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.rating-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedRating = option.dataset.rating;
                this.updateSubmitButton();
            });
        });
        
        // Obsługa tagów
        document.querySelectorAll('.tag-btn').forEach(tagBtn => {
            tagBtn.addEventListener('click', () => {
                const tag = tagBtn.dataset.tag;
                const index = selectedTags.indexOf(tag);
                
                if (index > -1) {
                    selectedTags.splice(index, 1);
                    tagBtn.classList.remove('selected');
                } else if (selectedTags.length < 3) {
                    selectedTags.push(tag);
                    tagBtn.classList.add('selected');
                }
                
                document.getElementById('rating-tags').value = JSON.stringify(selectedTags);
            });
        });
        
        // Licznik znaków w uwagach
        const noteTextarea = document.getElementById('rating-note');
        const noteCounter = document.getElementById('note-counter');
        
        if (noteTextarea && noteCounter) {
            noteTextarea.addEventListener('input', () => {
                noteCounter.textContent = noteTextarea.value.length;
                if (noteTextarea.value.length > 450) {
                    noteCounter.classList.add('warning');
                } else {
                    noteCounter.classList.remove('warning');
                }
            });
        }
        
        // Timer oceniania
        ratingTimeLeft = (eventData.ratingTime || 2) * 60;
        this.updateRatingTimer();
        
        ratingTimerInterval = setInterval(() => {
            ratingTimeLeft--;
            this.updateRatingTimer();
            
            if (ratingTimeLeft <= 0) {
                clearInterval(ratingTimerInterval);
                this.autoSubmitRating();
            }
        }, 1000);
        
        // Przyciski akcji
        document.getElementById('skip-rating').addEventListener('click', () => {
            this.skipRating();
        });
        
        document.getElementById('submit-rating').addEventListener('click', () => {
            this.submitRating(selectedRating, selectedTags);
        });
    }

    updateRatingTimer() {
        const timerElement = document.getElementById('rating-timer');
        if (timerElement) {
            timerElement.textContent = this.formatTime(ratingTimeLeft);
            
            if (ratingTimeLeft < 30) {
                timerElement.style.color = '#ef4444';
            }
        }
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-rating');
        const selectedRating = document.querySelector('.rating-option.selected');
        
        if (submitBtn) {
            submitBtn.disabled = !selectedRating;
        }
    }

    skipRating() {
        if (confirm('Czy na pewno chcesz pominąć ocenę tej osoby?')) {
            this.showUserPanel();
        }
    }

    autoSubmitRating() {
        if (!document.querySelector('.rating-option.selected')) {
            // Automatycznie wybierz "MOŻE" jeśli nie wybrano oceny
            const maybeOption = document.querySelector('.rating-option[data-rating="maybe"]');
            if (maybeOption) {
                maybeOption.click();
                setTimeout(() => {
                    this.submitRating('maybe', []);
                }, 500);
            }
        }
    }

    submitRating(rating, tags) {
        if (!rating || !currentPartner || !currentUser) {
            this.showNotification('Wybierz ocenę!', 'error');
            return;
        }

        const note = document.getElementById('rating-note')?.value || '';
        
        // Zapisz ocenę użytkownika
        if (!currentUser.ratings) currentUser.ratings = {};
        currentUser.ratings[currentPartner.id] = {
            rating: rating,
            note: note,
            tags: tags,
            round: eventData.currentRound || 1,
            timestamp: new Date().toISOString()
        };

        // Zapisz ocenę w globalnych danych wydarzenia
        if (!eventData.ratings) eventData.ratings = [];
        eventData.ratings.push({
            from: currentUser.id,
            to: currentPartner.id,
            rating: rating,
            round: eventData.currentRound || 1,
            timestamp: new Date().toISOString()
        });

        // Aktualizuj dane
        const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
        if (userIndex !== -1) {
            participants[userIndex] = currentUser;
        }

        this.saveData();
        
        // Wyczyść timer
        if (ratingTimerInterval) {
            clearInterval(ratingTimerInterval);
        }

        this.showNotification('Ocena zapisana! Dziękujemy!', 'success');
        setTimeout(() => {
            this.showUserPanel();
        }, 1000);
    }

    // ========== ALGORYTM DOBIERANIA PAR ==========
    generateSmartPairings() {
        try {
            const activeParticipants = participants.filter(p => p && p.active !== false);
            
            if (activeParticipants.length < 2) {
                this.showNotification('Potrzeba co najmniej 2 uczestników!', 'error');
                return [];
            }

            const pairings = [];
            const usedPairs = new Set();
            
            // Generuj pary dla każdej rundy
            for (let round = 1; round <= eventData.totalRounds; round++) {
                const roundPairings = {
                    round: round,
                    pairs: [],
                    breakTable: []
                };

                // Kopiuj i przetasuj uczestników
                const shuffled = [...activeParticipants].sort(() => Math.random() - 0.5);
                const pairedIds = new Set();

                // Algorytm dopasowywania z uwzględnieniem preferencji
                for (let i = 0; i < shuffled.length; i++) {
                    if (pairedIds.has(shuffled[i].id)) continue;

                    let bestMatch = null;
                    let bestScore = -1;

                    // Szukaj najlepszego dopasowania
                    for (let j = i + 1; j < shuffled.length; j++) {
                        if (pairedIds.has(shuffled[j].id)) continue;

                        // Sprawdź czy ta para już się spotkała
                        const pairKey = [shuffled[i].id, shuffled[j].id].sort().join('_');
                        if (usedPairs.has(pairKey) && !eventData.settings?.allowRepeats) {
                            continue;
                        }

                        // Oblicz score dopasowania
                        const score = this.calculateMatchScore(shuffled[i], shuffled[j]);
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = shuffled[j];
                        }
                    }

                    if (bestMatch) {
                        roundPairings.pairs.push([shuffled[i], bestMatch]);
                        pairedIds.add(shuffled[i].id);
                        pairedIds.add(bestMatch.id);
                        
                        // Dodaj parę do użytych
                        const pairKey = [shuffled[i].id, bestMatch.id].sort().join('_');
                        usedPairs.add(pairKey);
                    }
                }

                // Dodaj pozostałych do przerwy
                shuffled.forEach(p => {
                    if (!pairedIds.has(p.id)) {
                        roundPairings.breakTable.push(p);
                    }
                });

                pairings.push(roundPairings);
            }

            eventData.pairings = pairings;
            this.saveData();
            
            this.showNotification(`Wygenerowano pary dla ${eventData.totalRounds} rund`, 'success');
            return pairings;

        } catch (error) {
            console.error('Błąd generowania par:', error);
            this.showNotification('Błąd generowania par!', 'error');
            return [];
        }
    }

    calculateMatchScore(user1, user2) {
        let score = 0;
        
        // Dopasowanie preferencji
        if (user1.interested?.includes(user2.gender)) {
            score += 50;
        }
        
        if (user2.interested?.includes(user1.gender)) {
            score += 50;
        }
        
        // Dodaj losowy czynnik dla różnorodności
        score += Math.random() * 20;
        
        return score;
    }

    calculateMatches() {
        if (!currentUser || !currentUser.ratings) return [];
        
        const matches = [];
        const userRatings = currentUser.ratings;
        
        // Znajdź wzajemne dopasowania
        for (const [ratedUserId, rating] of Object.entries(userRatings)) {
            const ratedUser = participants.find(p => p && p.id === ratedUserId);
            if (!ratedUser || !ratedUser.ratings) continue;
            
            // Sprawdź czy ta osoba również Cię oceniła
            const theirRating = ratedUser.ratings[currentUser.id];
            if (theirRating && theirRating.rating === 'yes' && rating.rating === 'yes') {
                // Oblicz score dopasowania
                const score = 100; // Podstawowy score dla wzajemnego dopasowania
                
                matches.push({
                    partnerId: ratedUserId,
                    score: score,
                    mutual: true,
                    timestamp: rating.timestamp
                });
            }
        }
        
        // Posortuj według score
        matches.sort((a, b) => b.score - a.score);
        
        // Aktualizuj licznik w UI
        const matchesCountElement = document.getElementById('matches-count-value');
        if (matchesCountElement) {
            matchesCountElement.textContent = matches.length;
        }
        
        return matches;
    }

    // ========== PANEL ADMINISTRATORA ==========
    showAdminPanel() {
        this.hideAllScreens();
        
        // Sprawdź czy panel już istnieje
        let adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) {
            adminPanel = document.createElement('div');
            adminPanel.id = 'admin-panel';
            adminPanel.className = 'screen';
            document.body.appendChild(adminPanel);
        }
        
        adminPanel.classList.add('active');
        this.renderAdminPanel();
    }

    renderAdminPanel() {
        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;

        const activeParticipants = participants.filter(p => p && p.active !== false);
        const ratingsCount = eventData.ratings?.length || 0;
        const yesRatings = eventData.ratings?.filter(r => r.rating === 'yes').length || 0;
        
        adminPanel.innerHTML = `
            <div class="admin-container">
                <div class="admin-content">
                    <div class="admin-header">
                        <div class="admin-title">
                            <h1><i class="fas fa-crown"></i> Panel Administratora</h1>
                            <p class="admin-subtitle">Zarządzanie wydarzeniem Speed Dating Pro</p>
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-primary" id="refresh-admin">
                                <i class="fas fa-redo"></i> Odśwież
                            </button>
                            <button class="btn btn-outline" id="back-to-mode-admin">
                                <i class="fas fa-home"></i> Strona główna
                            </button>
                        </div>
                    </div>
                    
                    <div class="admin-stats">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon admin">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Uczestnicy</h3>
                                    <div class="stat-value">${activeParticipants.length}/${CONFIG.MAX_PARTICIPANTS}</div>
                                    <div class="stat-trend">
                                        <i class="fas fa-arrow-up"></i> Aktywni
                                    </div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="fas fa-handshake"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Aktywne pary</h3>
                                    <div class="stat-value" id="admin-pairs-count">0</div>
                                    <div class="stat-trend">Bieżąca runda</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="fas fa-coffee"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Na przerwie</h3>
                                    <div class="stat-value" id="admin-break-count">0</div>
                                    <div class="stat-trend">Osoby bez pary</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon info">
                                    <i class="fas fa-star"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Oceny TAK</h3>
                                    <div class="stat-value">${yesRatings}/${ratingsCount}</div>
                                    <div class="stat-trend">
                                        <i class="fas fa-heart"></i> Pozytywne
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-main">
                        <div class="admin-sidebar">
                            <div class="sidebar-section">
                                <h3><i class="fas fa-cogs"></i> Sterowanie</h3>
                                <div class="control-buttons">
                                    <button class="btn btn-success btn-block" id="start-event-btn">
                                        <i class="fas fa-play"></i> Rozpocznij
                                    </button>
                                    <button class="btn btn-warning btn-block" id="next-round-btn">
                                        <i class="fas fa-forward"></i> Następna runda
                                    </button>
                                    <button class="btn btn-danger btn-block" id="end-event-btn">
                                        <i class="fas fa-stop"></i> Zakończ
                                    </button>
                                    <button class="btn btn-primary btn-block" id="generate-pairs-btn">
                                        <i class="fas fa-random"></i> Generuj pary
                                    </button>
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h3><i class="fas fa-clock"></i> Timer</h3>
                                <div class="timer-controls">
                                    <div class="timer-display admin" id="admin-timer">05:00</div>
                                    <div class="timer-buttons">
                                        <button class="btn btn-icon" id="pause-timer-btn">
                                            <i class="fas fa-pause"></i>
                                        </button>
                                        <button class="btn btn-icon" id="reset-timer-btn">
                                            <i class="fas fa-redo"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h3><i class="fas fa-download"></i> Eksport</h3>
                                <div class="export-buttons">
                                    <button class="btn btn-outline btn-block" id="export-json">
                                        <i class="fas fa-file-code"></i> JSON
                                    </button>
                                    <button class="btn btn-outline btn-block" id="export-excel">
                                        <i class="fas fa-file-excel"></i> Excel
                                    </button>
                                    <button class="btn btn-outline btn-block" id="export-pdf">
                                        <i class="fas fa-file-pdf"></i> PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="admin-content-main">
                            <div class="content-tabs">
                                <button class="tab-btn active" data-tab="participants">
                                    <i class="fas fa-users"></i> Uczestnicy
                                </button>
                                <button class="tab-btn" data-tab="pairings">
                                    <i class="fas fa-chair"></i> Stoliki
                                </button>
                                <button class="tab-btn" data-tab="ratings">
                                    <i class="fas fa-star"></i> Oceny
                                </button>
                                <button class="tab-btn" data-tab="settings">
                                    <i class="fas fa-cog"></i> Ustawienia
                                </button>
                            </div>
                            
                            <div class="tab-content">
                                <div class="tab-pane active" id="participants-tab">
                                    <!-- Zawartość zostanie załadowana dynamicznie -->
                                </div>
                                <div class="tab-pane" id="pairings-tab"></div>
                                <div class="tab-pane" id="ratings-tab"></div>
                                <div class="tab-pane" id="settings-tab"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupAdminPanelListeners();
        this.updateAdminPanel();
    }

    setupAdminPanelListeners() {
        // Przyciski nawigacji
        document.getElementById('refresh-admin')?.addEventListener('click', () => {
            this.updateAdminPanel();
        });

        document.getElementById('back-to-mode-admin')?.addEventListener('click', () => {
            this.showModeSelection();
        });

        // Przyciski sterowania
        document.getElementById('start-event-btn')?.addEventListener('click', () => {
            this.startEvent();
        });

        document.getElementById('next-round-btn')?.addEventListener('click', () => {
            this.nextRound();
        });

        document.getElementById('end-event-btn')?.addEventListener('click', () => {
            this.endEvent();
        });

        document.getElementById('generate-pairs-btn')?.addEventListener('click', () => {
            this.generateSmartPairings();
            this.updateAdminPanel();
        });

        // Przyciski timera
        document.getElementById('pause-timer-btn')?.addEventListener('click', () => {
            this.toggleTimer();
        });

        document.getElementById('reset-timer-btn')?.addEventListener('click', () => {
            this.resetTimer();
        });

        // Przyciski eksportu
        document.getElementById('export-json')?.addEventListener('click', () => {
            this.exportData('json');
        });

        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.exportData('excel');
        });

        document.getElementById('export-pdf')?.addEventListener('click', () => {
            this.exportData('pdf');
        });

        // Zakładki
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchAdminTab(tabId);
            });
        });
    }

    updateAdminPanel() {
        this.updateAdminStatistics();
        this.updateParticipantsTab();
        this.updatePairingsTab();
        this.updateRatingsTab();
        this.updateSettingsTab();
    }

    updateAdminStatistics() {
        const activeParticipants = participants.filter(p => p && p.active !== false);
        const currentPairings = eventData.pairings?.[eventData.currentRound - 1];
        
        document.getElementById('admin-pairs-count').textContent = 
            currentPairings?.pairs?.length || 0;
        document.getElementById('admin-break-count').textContent = 
            currentPairings?.breakTable?.length || 0;
        
        // Aktualizuj timer
        this.updateAdminTimer();
    }

    updateAdminTimer() {
        const timerElement = document.getElementById('admin-timer');
        if (timerElement && eventData.status === 'active') {
            const totalSeconds = (eventData.roundTime || 5) * 60;
            timerElement.textContent = this.formatTime(totalSeconds);
        }
    }

    switchAdminTab(tabId) {
        // Aktualizuj aktywne zakładki
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    updateParticipantsTab() {
        const tab = document.getElementById('participants-tab');
        if (!tab) return;

        const activeParticipants = participants.filter(p => p && p.active !== false);
        
        let html = `
            <div class="participants-header">
                <h3><i class="fas fa-list"></i> Lista uczestników (${activeParticipants.length})</h3>
                <div class="participants-actions">
                    <button class="btn btn-sm btn-outline" id="add-demo-users">
                        <i class="fas fa-plus"></i> Dodaj demo
                    </button>
                    <button class="btn btn-sm btn-danger" id="clear-all-users">
                        <i class="fas fa-trash"></i> Wyczyść
                    </button>
                </div>
            </div>
            
            <div class="participants-table-container">
                <table class="participants-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nazwa</th>
                            <th>Email</th>
                            <th>Płeć</th>
                            <th>Szuka</th>
                            <th>Status</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (activeParticipants.length === 0) {
            html += `
                <tr>
                    <td colspan="7" class="empty-table">
                        <i class="fas fa-users-slash"></i>
                        <p>Brak uczestników</p>
                    </td>
                </tr>
            `;
        } else {
            activeParticipants.forEach(participant => {
                const status = this.getParticipantStatus(participant.id);
                const statusClass = status === 'W parze' ? 'success' : 
                                  status === 'Przerwa' ? 'warning' : 'secondary';
                
                html += `
                    <tr>
                        <td>${participant.id.substring(0, 8)}...</td>
                        <td>
                            <div class="participant-info">
                                <div class="participant-avatar small" style="background: ${participant.avatarColor || '#667eea'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                ${participant.username}
                            </div>
                        </td>
                        <td>${participant.email}</td>
                        <td>
                            <span class="gender-badge ${participant.gender}">
                                <i class="fas fa-${participant.gender === 'male' ? 'mars' : participant.gender === 'female' ? 'venus' : 'genderless'}"></i>
                                ${participant.gender === 'male' ? 'M' : participant.gender === 'female' ? 'K' : 'I'}
                            </span>
                        </td>
                        <td>
                            ${participant.interested?.map(i => 
                                `<span class="interest-tag">${
                                    i === 'male' ? 'M' : i === 'female' ? 'K' : 'I'
                                }</span>`
                            ).join('') || '-'}
                        </td>
                        <td>
                            <span class="status-badge ${statusClass}">${status}</span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-icon btn-sm" title="Edytuj" data-user-id="${participant.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-icon btn-sm btn-danger" title="Usuń" data-user-id="${participant.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="participants-summary">
                <div class="summary-item">
                    <span>Łącznie:</span>
                    <strong>${activeParticipants.length} uczestników</strong>
                </div>
                <div class="summary-item">
                    <span>Mężczyźni:</span>
                    <strong>${activeParticipants.filter(p => p.gender === 'male').length}</strong>
                </div>
                <div class="summary-item">
                    <span>Kobiety:</span>
                    <strong>${activeParticipants.filter(p => p.gender === 'female').length}</strong>
                </div>
                <div class="summary-item">
                    <span>Inne:</span>
                    <strong>${activeParticipants.filter(p => p.gender === 'other').length}</strong>
                </div>
            </div>
        `;

        tab.innerHTML = html;

        // Dodaj event listeners
        document.getElementById('add-demo-users')?.addEventListener('click', () => {
            this.addDemoUsers();
        });

        document.getElementById('clear-all-users')?.addEventListener('click', () => {
            this.clearAllParticipants();
        });
    }

    updatePairingsTab() {
        const tab = document.getElementById('pairings-tab');
        if (!tab) return;

        const currentPairings = eventData.pairings?.[eventData.currentRound - 1];
        
        let html = `
            <div class="pairings-header">
                <h3><i class="fas fa-chair"></i> Stoliki - Runda ${eventData.currentRound || 1}</h3>
                <div class="pairings-info">
                    <span class="badge">${currentPairings?.pairs?.length || 0} stolików</span>
                    <span class="badge warning">${currentPairings?.breakTable?.length || 0} na przerwie</span>
                </div>
            </div>
        `;

        if (!currentPairings || !currentPairings.pairs || currentPairings.pairs.length === 0) {
            html += `
                <div class="empty-pairings">
                    <i class="fas fa-random"></i>
                    <p>Brak wygenerowanych par dla tej rundy</p>
                    <button class="btn btn-primary" id="generate-now-btn">
                        <i class="fas fa-magic"></i> Wygeneruj pary
                    </button>
                </div>
            `;
        } else {
            html += `
                <div class="pairings-grid">
                    ${currentPairings.pairs.map((pair, index) => {
                        const [user1, user2] = pair;
                        return `
                            <div class="pairing-card">
                                <div class="pairing-header">
                                    <h4><i class="fas fa-chair"></i> Stolik ${index + 1}</h4>
                                    <span class="pairing-id">ID: ${index + 1}</span>
                                </div>
                                <div class="pairing-participants">
                                    <div class="participant">
                                        <div class="participant-avatar" style="background: ${user1.avatarColor || '#667eea'}">
                                            <i class="fas fa-user"></i>
                                        </div>
                                        <div class="participant-info">
                                            <strong>${user1.username}</strong>
                                            <span class="participant-gender">${user1.gender === 'male' ? '♂ Mężczyzna' : user1.gender === 'female' ? '♀ Kobieta' : '⚧ Inna'}</span>
                                        </div>
                                    </div>
                                    <div class="pairing-connector">
                                        <i class="fas fa-heart"></i>
                                    </div>
                                    <div class="participant">
                                        <div class="participant-avatar" style="background: ${user2.avatarColor || '#ff6b6b'}">
                                            <i class="fas fa-user"></i>
                                        </div>
                                        <div class="participant-info">
                                            <strong>${user2.username}</strong>
                                            <span class="participant-gender">${user2.gender === 'male' ? '♂ Mężczyzna' : user2.gender === 'female' ? '♀ Kobieta' : '⚧ Inna'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="pairing-actions">
                                    <button class="btn btn-sm btn-outline swap-btn" data-pair-index="${index}">
                                        <i class="fas fa-exchange-alt"></i> Zamień
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            if (currentPairings.breakTable && currentPairings.breakTable.length > 0) {
                html += `
                    <div class="break-section">
                        <h4><i class="fas fa-coffee"></i> Osoby na przerwie (${currentPairings.breakTable.length})</h4>
                        <div class="break-list">
                            ${currentPairings.breakTable.map(user => `
                                <span class="break-user" style="border-color: ${user.avatarColor || '#667eea'}">
                                    <i class="fas fa-user"></i> ${user.username}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        tab.innerHTML = html;

        // Dodaj event listener do przycisku generowania
        document.getElementById('generate-now-btn')?.addEventListener('click', () => {
            this.generateSmartPairings();
            this.updateAdminPanel();
        });
    }

    updateRatingsTab() {
        const tab = document.getElementById('ratings-tab');
        if (!tab) return;

        const ratings = eventData.ratings || [];
        const matches = this.calculateAllMatches();
        
        let html = `
            <div class="ratings-header">
                <h3><i class="fas fa-star"></i> Wszystkie oceny (${ratings.length})</h3>
                <div class="ratings-stats">
                    <span class="badge success">${ratings.filter(r => r.rating === 'yes').length} TAK</span>
                    <span class="badge danger">${ratings.filter(r => r.rating === 'no').length} NIE</span>
                    <span class="badge warning">${ratings.filter(r => r.rating === 'maybe').length} MOŻE</span>
                    <span class="badge info">${matches.length} dopasowań</span>
                </div>
            </div>
            
            <div class="ratings-tabs">
                <button class="ratings-tab-btn active" data-view="all">Wszystkie oceny</button>
                <button class="ratings-tab-btn" data-view="matches">Dopasowania</button>
                <button class="ratings-tab-btn" data-view="stats">Statystyki</button>
            </div>
            
            <div class="ratings-content">
                <div class="ratings-view active" id="all-ratings">
                    <div class="ratings-table-container">
                        <table class="ratings-table">
                            <thead>
                                <tr>
                                    <th>Od</th>
                                    <th>Do</th>
                                    <th>Ocena</th>
                                    <th>Runda</th>
                                    <th>Czas</th>
                                    <th>Notatki</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        if (ratings.length === 0) {
            html += `
                <tr>
                    <td colspan="6" class="empty-table">
                        <i class="fas fa-star"></i>
                        <p>Brak ocen</p>
                    </td>
                </tr>
            `;
        } else {
            ratings.forEach(rating => {
                const fromUser = participants.find(p => p && p.id === rating.from);
                const toUser = participants.find(p => p && p.id === rating.to);
                const ratingDate = new Date(rating.timestamp);
                
                html += `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="user-avatar small" style="background: ${fromUser?.avatarColor || '#667eea'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                ${fromUser?.username || 'Nieznany'}
                            </div>
                        </td>
                        <td>
                            <div class="user-cell">
                                <div class="user-avatar small" style="background: ${toUser?.avatarColor || '#ff6b6b'}">
                                    <i class="fas fa-user"></i>
                                </div>
                                ${toUser?.username || 'Nieznany'}
                            </div>
                        </td>
                        <td>
                            <span class="rating-badge ${rating.rating}">
                                <i class="fas fa-${rating.rating === 'yes' ? 'thumbs-up' : rating.rating === 'no' ? 'thumbs-down' : 'question'}"></i>
                                ${rating.rating === 'yes' ? 'TAK' : rating.rating === 'no' ? 'NIE' : 'MOŻE'}
                            </span>
                        </td>
                        <td>${rating.round}</td>
                        <td>${ratingDate.toLocaleTimeString()}</td>
                        <td>${rating.note || '-'}</td>
                    </tr>
                `;
            });
        }

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="ratings-view" id="matches-view">
                    <div class="matches-list">
                        ${matches.length === 0 ? `
                            <div class="empty-matches">
                                <i class="fas fa-heart-broken"></i>
                                <p>Brak wzajemnych dopasowań</p>
                            </div>
                        ` : matches.map(match => {
                            const user1 = participants.find(p => p && p.id === match.user1);
                            const user2 = participants.find(p => p && p.id === match.user2);
                            return `
                                <div class="match-card">
                                    <div class="match-users">
                                        <div class="match-user">
                                            <div class="user-avatar" style="background: ${user1?.avatarColor || '#667eea'}">
                                                <i class="fas fa-user"></i>
                                            </div>
                                            <div class="user-info">
                                                <strong>${user1?.username || 'Nieznany'}</strong>
                                                <span>→ ${user2?.username || 'Nieznany'}</span>
                                            </div>
                                        </div>
                                        <div class="match-icon">
                                            <i class="fas fa-heart"></i>
                                        </div>
                                        <div class="match-user">
                                            <div class="user-avatar" style="background: ${user2?.avatarColor || '#ff6b6b'}">
                                                <i class="fas fa-user"></i>
                                            </div>
                                            <div class="user-info">
                                                <strong>${user2?.username || 'Nieznany'}</strong>
                                                <span>→ ${user1?.username || 'Nieznany'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="match-details">
                                        <span class="match-score">Dopasowanie: ${match.score}%</span>
                                        <span class="match-round">Runda: ${match.round}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="ratings-view" id="stats-view">
                    <div class="stats-cards">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-chart-pie"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Rozkład ocen</h3>
                                <div class="chart-container">
                                    <canvas id="ratings-chart"></canvas>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Top uczestnicy</h3>
                                <div class="top-list">
                                    ${this.getTopParticipants().map((user, index) => `
                                        <div class="top-item">
                                            <span class="top-rank">${index + 1}</span>
                                            <div class="top-user">
                                                <div class="user-avatar small" style="background: ${user.avatarColor || '#667eea'}">
                                                    <i class="fas fa-user"></i>
                                                </div>
                                                <span>${user.username}</span>
                                            </div>
                                            <span class="top-score">${user.score} ocen TAK</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        tab.innerHTML = html;

        // Dodaj event listeners do zakładek
        document.querySelectorAll('.ratings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchRatingsView(view);
            });
        });
    }

    updateSettingsTab() {
        const tab = document.getElementById('settings-tab');
        if (!tab) return;

        const html = `
            <div class="settings-header">
                <h3><i class="fas fa-cog"></i> Ustawienia wydarzenia</h3>
            </div>
            
            <form id="event-settings-form" class="settings-form">
                <div class="settings-section">
                    <h4><i class="fas fa-clock"></i> Ustawienia czasu</h4>
                    <div class="settings-grid">
                        <div class="form-group">
                            <label for="round-time-setting">Czas rundy (minuty)</label>
                            <input type="number" id="round-time-setting" 
                                   value="${eventData.roundTime || 5}" 
                                   min="${CONFIG.MIN_ROUND_TIME}" 
                                   max="${CONFIG.MAX_ROUND_TIME}">
                        </div>
                        
                        <div class="form-group">
                            <label for="rating-time-setting">Czas oceny (minuty)</label>
                            <input type="number" id="rating-time-setting" 
                                   value="${eventData.ratingTime || 2}" 
                                   min="1" max="10">
                        </div>
                        
                        <div class="form-group">
                            <label for="total-rounds-setting">Liczba rund</label>
                            <input type="number" id="total-rounds-setting" 
                                   value="${eventData.totalRounds || 5}" 
                                   min="1" max="${CONFIG.MAX_ROUNDS}">
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4><i class="fas fa-random"></i> Algorytm dopasowań</h4>
                    <div class="settings-options">
                        <div class="form-group">
                            <label for="matching-algorithm">Algorytm</label>
                            <select id="matching-algorithm">
                                <option value="smart" ${eventData.settings?.matchingAlgorithm === 'smart' ? 'selected' : ''}>
                                    Inteligentny (uwzględnia preferencje)
                                </option>
                                <option value="random" ${eventData.settings?.matchingAlgorithm === 'random' ? 'selected' : ''}>
                                    Losowy
                                </option>
                                <option value="round-robin" ${eventData.settings?.matchingAlgorithm === 'round-robin' ? 'selected' : ''}>
                                    Round Robin
                                </option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="allow-repeats" 
                                       ${eventData.settings?.allowRepeats ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                <span>Zezwól na powtórzenia par</span>
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="notifications-enabled" 
                                       ${eventData.settings?.notifications !== false ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                <span>Włącz powiadomienia</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4><i class="fas fa-users"></i> Ograniczenia</h4>
                    <div class="form-group">
                        <label for="max-participants">Maksymalna liczba uczestników</label>
                        <input type="number" id="max-participants" 
                               value="${eventData.settings?.maxParticipants || CONFIG.MAX_PARTICIPANTS}" 
                               min="2" max="100">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4><i class="fas fa-database"></i> Zarządzanie danymi</h4>
                    <div class="danger-zone">
                        <div class="danger-buttons">
                            <button type="button" class="btn btn-danger" id="reset-event-data">
                                <i class="fas fa-trash"></i> Zresetuj dane wydarzenia
                            </button>
                            <button type="button" class="btn btn-danger" id="clear-all-data">
                                <i class="fas fa-bomb"></i> Wyczyść WSZYSTKIE dane
                            </button>
                        </div>
                        <p class="danger-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            Te operacje są nieodwracalne!
                        </p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Zapisz ustawienia
                    </button>
                </div>
            </form>
        `;

        tab.innerHTML = html;

        // Obsługa formularza
        document.getElementById('event-settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEventSettings();
        });

        // Przyciski resetowania
        document.getElementById('reset-event-data')?.addEventListener('click', () => {
            this.resetEventData();
        });

        document.getElementById('clear-all-data')?.addEventListener('click', () => {
            this.clearAllData();
        });
    }

    // ========== FUNKCJE POMOCNICZE ADMINA ==========
    getParticipantStatus(userId) {
        if (eventData.status === 'waiting') return 'Oczekuje';
        if (eventData.status === 'finished') return 'Zakończono';
        
        const currentPairings = eventData.pairings?.[eventData.currentRound - 1];
        if (!currentPairings) return 'Oczekuje';
        
        // Sprawdź czy jest w parze
        if (currentPairings.pairs) {
            for (const pair of currentPairings.pairs) {
                if (pair && Array.isArray(pair)) {
                    const found = pair.find(p => p && p.id === userId);
                    if (found) return 'W parze';
                }
            }
        }
        
        // Sprawdź czy jest na przerwie
        if (currentPairings.breakTable) {
            const found = currentPairings.breakTable.find(p => p && p.id === userId);
            if (found) return 'Przerwa';
        }
        
        return 'Oczekuje';
    }

    calculateAllMatches() {
        const matches = [];
        const ratings = eventData.ratings || [];
        
        // Grupuj oceny według par uczestników
        const pairRatings = {};
        
        ratings.forEach(rating => {
            const pairKey = [rating.from, rating.to].sort().join('_');
            if (!pairRatings[pairKey]) {
                pairRatings[pairKey] = { yes: 0, no: 0, maybe: 0 };
            }
            pairRatings[pairKey][rating.rating]++;
        });
        
        // Znajdź wzajemne dopasowania (oboje dali TAK)
        for (const [pairKey, ratings] of Object.entries(pairRatings)) {
            if (ratings.yes >= 2) { // Oboje dali TAK
                const [userId1, userId2] = pairKey.split('_');
                const user1 = participants.find(p => p && p.id === userId1);
                const user2 = participants.find(p => p && p.id === userId2);
                
                if (user1 && user2) {
                    matches.push({
                        user1: userId1,
                        user2: userId2,
                        score: 100,
                        round: eventData.currentRound || 1
                    });
                }
            }
        }
        
        return matches;
    }

    getTopParticipants(limit = 5) {
        const ratings = eventData.ratings || [];
        const scores = {};
        
        // Policz oceny TAK dla każdego uczestnika
        ratings.forEach(rating => {
            if (rating.rating === 'yes') {
                scores[rating.to] = (scores[rating.to] || 0) + 1;
            }
        });
        
        // Konwertuj na tablicę i posortuj
        return Object.entries(scores)
            .map(([userId, score]) => ({
                ...participants.find(p => p && p.id === userId),
                score
            }))
            .filter(user => user && user.username)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    switchRatingsView(view) {
        // Aktualizuj aktywne przyciski
        document.querySelectorAll('.ratings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });
        
        // Aktualizuj widoki
        document.querySelectorAll('.ratings-view').forEach(viewElement => {
            viewElement.classList.remove('active');
        });
        
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Jeśli to widok statystyk, zainicjuj wykres
        if (view === 'stats') {
            this.initRatingsChart();
        }
    }

    initRatingsChart() {
        const canvas = document.getElementById('ratings-chart');
        if (!canvas) return;
        
        const ratings = eventData.ratings || [];
        const yesCount = ratings.filter(r => r.rating === 'yes').length;
        const noCount = ratings.filter(r => r.rating === 'no').length;
        const maybeCount = ratings.filter(r => r.rating === 'maybe').length;
        
        // Prosty wykres kołowy
        const ctx = canvas.getContext('2d');
        canvas.width = 300;
        canvas.height = 300;
        
        // Rysuj wykres
        const total = yesCount + noCount + maybeCount;
        let startAngle = 0;
        
        // TAK - zielony
        if (yesCount > 0) {
            const sliceAngle = (yesCount / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(150, 150);
            ctx.arc(150, 150, 100, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = '#10b981';
            ctx.fill();
            startAngle += sliceAngle;
        }
        
        // NIE - czerwony
        if (noCount > 0) {
            const sliceAngle = (noCount / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(150, 150);
            ctx.arc(150, 150, 100, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            startAngle += sliceAngle;
        }
        
        // MOŻE - pomarańczowy
        if (maybeCount > 0) {
            const sliceAngle = (maybeCount / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(150, 150);
            ctx.arc(150, 150, 100, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
        }
    }

    // ========== ZARZĄDZANIE WYDARZENIEM ==========
    startEvent() {
        const activeParticipants = participants.filter(p => p && p.active !== false);
        
        if (activeParticipants.length < CONFIG.MIN_PARTICIPANTS) {
            this.showNotification(`Potrzeba co najmniej ${CONFIG.MIN_PARTICIPANTS} uczestników!`, 'error');
            return;
        }
        
        if (confirm(`Rozpocząć wydarzenie z ${activeParticipants.length} uczestnikami?`)) {
            // Wygeneruj pary
            this.generateSmartPairings();
            
            // Ustaw status wydarzenia
            eventData.status = 'active';
            eventData.currentRound = 1;
            eventData.startedAt = new Date().toISOString();
            
            this.saveData();
            this.startMainTimer();
            
            this.showNotification(`Wydarzenie rozpoczęte! ${activeParticipants.length} uczestników.`, 'success');
            this.updateAdminPanel();
            
            // Jeśli jesteśmy w panelu użytkownika, zaktualizuj też tam
            if (currentUser) {
                this.updateUserContent();
            }
        }
    }

    nextRound() {
        if (eventData.currentRound >= eventData.totalRounds) {
            this.showNotification('To już ostatnia runda!', 'warning');
            return;
        }
        
        eventData.currentRound++;
        this.saveData();
        
        this.resetTimer();
        this.updateAdminPanel();
        
        this.showNotification(`Rozpoczynasz rundę ${eventData.currentRound}`, 'info');
        
        // Aktualizuj panel użytkownika jeśli jest aktywny
        if (currentUser) {
            this.updateUserContent();
        }
    }

    endEvent() {
        if (confirm('Czy na pewno zakończyć wydarzenie? Ta akcja jest nieodwracalna.')) {
            eventData.status = 'finished';
            eventData.endedAt = new Date().toISOString();
            
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            
            this.saveData();
            this.updateAdminPanel();
            
            this.showNotification('Wydarzenie zakończone!', 'success');
            
            // Aktualizuj panel użytkownika jeśli jest aktywny
            if (currentUser) {
                this.updateUserContent();
            }
        }
    }

    startMainTimer() {
        if (timerInterval) clearInterval(timerInterval);
        
        timeLeft = (eventData.roundTime || 5) * 60;
        this.updateTimerDisplay();
        
        timerInterval = setInterval(() => {
            timeLeft--;
            this.updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                this.showNotification('Czas rundy minął!', 'warning');
                
                // Automatycznie przejdź do następnej rundy jeśli to nie ostatnia
                if (eventData.currentRound < eventData.totalRounds) {
                    setTimeout(() => {
                        this.nextRound();
                    }, 5000);
                }
            }
        }, 1000);
    }

    updateTimerDisplay() {
        // Aktualizuj timer w panelu admina
        const adminTimer = document.getElementById('admin-timer');
        if (adminTimer) {
            adminTimer.textContent = this.formatTime(timeLeft);
            
            if (timeLeft < 60) {
                adminTimer.style.color = '#ef4444';
            } else {
                adminTimer.style.color = '#667eea';
            }
        }
    }

    toggleTimer() {
        const pauseBtn = document.getElementById('pause-timer-btn');
        
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                pauseBtn.title = 'Wznów';
            }
            this.showNotification('Timer wstrzymany', 'info');
        } else {
            this.startMainTimer();
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Pauza';
            }
            this.showNotification('Timer wznowiony', 'success');
        }
    }

    resetTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        this.startMainTimer();
        
        const pauseBtn = document.getElementById('pause-timer-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            pauseBtn.title = 'Pauza';
        }
        
        this.showNotification('Timer zresetowany', 'info');
    }

    saveEventSettings() {
        try {
            // Pobierz wartości z formularza
            eventData.roundTime = parseInt(document.getElementById('round-time-setting').value) || 5;
            eventData.ratingTime = parseInt(document.getElementById('rating-time-setting').value) || 2;
            eventData.totalRounds = parseInt(document.getElementById('total-rounds-setting').value) || 5;
            
            // Ustawienia zaawansowane
            eventData.settings = {
                allowRepeats: document.getElementById('allow-repeats').checked,
                maxParticipants: parseInt(document.getElementById('max-participants').value) || CONFIG.MAX_PARTICIPANTS,
                matchingAlgorithm: document.getElementById('matching-algorithm').value,
                notifications: document.getElementById('notifications-enabled').checked
            };
            
            this.saveData();
            this.showNotification('Ustawienia zapisane pomyślnie!', 'success');
            
        } catch (error) {
            console.error('Błąd zapisywania ustawień:', error);
            this.showNotification('Błąd zapisywania ustawień!', 'error');
        }
    }

    resetEventData() {
        if (confirm('Czy na pewno zresetować dane wydarzenia? Zachowani uczestnicy, ale resetujemy rundy i oceny.')) {
            eventData = this.getDefaultEventData();
            this.saveData();
            this.showNotification('Dane wydarzenia zresetowane!', 'success');
            this.updateAdminPanel();
        }
    }

    clearAllData() {
        if (confirm('CZY NA PEWNO? To usunie WSZYSTKIE dane (uczestników, wydarzenie, oceny)!')) {
            localStorage.removeItem('speedDatingParticipants');
            localStorage.removeItem('speedDatingEvent');
            localStorage.removeItem('currentSessionId');
            
            participants = [];
            eventData = this.getDefaultEventData();
            currentUser = null;
            
            this.showNotification('Wszystkie dane usunięte!', 'warning');
            this.showModeSelection();
        }
    }

    addDemoUsers() {
        const demoUsers = [
            {
                username: 'JanKowalski',
                email: 'jan@example.com',
                gender: 'male',
                interested: ['female'],
                age: 28,
                bio: 'Lubię podróże i dobrą książkę',
                avatarColor: '#667eea'
            },
            {
                username: 'AnnaNowak',
                email: 'anna@example.com',
                gender: 'female',
                interested: ['male'],
                age: 26,
                bio: 'Fotograf amator, miłośniczka kina',
                avatarColor: '#f56565'
            },
            {
                username: 'PiotrWiśniewski',
                email: 'piotr@example.com',
                gender: 'male',
                interested: ['female'],
                age: 32,
                bio: 'Programista, gracz, fan technologii',
                avatarColor: '#48bb78'
            },
            {
                username: 'KatarzynaLewandowska',
                email: 'kasia@example.com',
                gender: 'female',
                interested: ['male'],
                age: 29,
                bio: 'Lekarka, uwielbiam taniec i sport',
                avatarColor: '#ed8936'
            },
            {
                username: 'MichałWójcik',
                email: 'michal@example.com',
                gender: 'male',
                interested: ['female'],
                age: 30,
                bio: 'Inżynier, żeglarz, podróżnik',
                avatarColor: '#9f7aea'
            },
            {
                username: 'MagdalenaKamińska',
                email: 'magda@example.com',
                gender: 'female',
                interested: ['male'],
                age: 27,
                bio: 'Nauczycielka, miłośniczka teatru',
                avatarColor: '#ed64a6'
            }
        ];

        let added = 0;
        const activeCount = participants.filter(p => p && p.active !== false).length;
        
        demoUsers.forEach(demoUser => {
            if (activeCount + added >= CONFIG.MAX_PARTICIPANTS) {
                return;
            }
            
            const existing = participants.find(p => 
                p && p.email === demoUser.email && p.active !== false
            );
            
            if (!existing) {
                const newUser = {
                    ...demoUser,
                    id: 'demo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    joinedAt: new Date().toISOString(),
                    ratings: {},
                    tags: {},
                    status: 'active',
                    active: true,
                    lastSeen: new Date().toISOString(),
                    sessionId: 'demo_session_' + Math.random().toString(36).substr(2, 9)
                };
                
                participants.push(newUser);
                added++;
            }
        });
        
        this.saveData();
        this.updateAdminPanel();
        
        this.showNotification(`Dodano ${added} użytkowników demo`, 'success');
    }

    clearAllParticipants() {
        if (confirm('Czy na pewno usunąć wszystkich uczestników?')) {
            participants = participants.filter(p => p && p.active === false);
            this.saveData();
            this.updateAdminPanel();
            this.showNotification('Wszyscy uczestnicy usunięci', 'warning');
        }
    }

    // ========== EKSPORT DANYCH ==========
    exportData(format) {
        try {
            const exportData = {
                event: eventData,
                participants: participants.filter(p => p && p.active !== false),
                timestamp: new Date().toISOString(),
                version: CONFIG.VERSION
            };
            
            const filename = `speed-dating-${new Date().toISOString().slice(0,10)}`;
            
            switch(format) {
                case 'json':
                    this.exportJSON(exportData, filename);
                    break;
                case 'excel':
                    this.exportExcel(exportData, filename);
                    break;
                case 'pdf':
                    this.exportPDF(exportData, filename);
                    break;
            }
            
        } catch (error) {
            console.error('Błąd eksportu:', error);
            this.showNotification('Błąd eksportu danych!', 'error');
        }
    }

    exportJSON(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `${filename}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Dane wyeksportowane jako JSON!', 'success');
    }

    exportExcel(data, filename) {
        try {
            // Przygotuj dane uczestników
            const participantsData = data.participants.map(p => ({
                'ID': p.id,
                'Nazwa': p.username,
                'Email': p.email,
                'Płeć': p.gender === 'male' ? 'Mężczyzna' : p.gender === 'female' ? 'Kobieta' : 'Inna',
                'Wiek': p.age || '-',
                'Szuka': p.interested?.map(i => 
                    i === 'male' ? 'Mężczyzn' : i === 'female' ? 'Kobiet' : 'Innych'
                ).join(', ') || '-',
                'Dołączył': new Date(p.joinedAt).toLocaleString(),
                'Status': p.active ? 'Aktywny' : 'Nieaktywny'
            }));
            
            // Przygotuj dane ocen
            const ratingsData = (data.event.ratings || []).map(r => {
                const fromUser = data.participants.find(p => p.id === r.from);
                const toUser = data.participants.find(p => p.id === r.to);
                
                return {
                    'Od': fromUser?.username || r.from,
                    'Do': toUser?.username || r.to,
                    'Ocena': r.rating === 'yes' ? 'TAK' : r.rating === 'no' ? 'NIE' : 'MOŻE',
                    'Runda': r.round,
                    'Czas': new Date(r.timestamp).toLocaleString(),
                    'Notatki': r.note || '-'
                };
            });
            
            // Utwórz skoroszyt
            const wb = XLSX.utils.book_new();
            
            // Arkusz uczestników
            const wsParticipants = XLSX.utils.json_to_sheet(participantsData);
            XLSX.utils.book_append_sheet(wb, wsParticipants, 'Uczestnicy');
            
            // Arkusz ocen
            if (ratingsData.length > 0) {
                const wsRatings = XLSX.utils.json_to_sheet(ratingsData);
                XLSX.utils.book_append_sheet(wb, wsRatings, 'Oceny');
            }
            
            // Arkusz podsumowania
            const summaryData = [{
                'Wydarzenie': 'Speed Dating Pro',
                'Status': data.event.status === 'active' ? 'Aktywne' : 
                         data.event.status === 'waiting' ? 'Oczekujące' : 'Zakończone',
                'Runda': `${data.event.currentRound}/${data.event.totalRounds}`,
                'Uczestnicy': data.participants.length,
                'Oceny': data.event.ratings?.length || 0,
                'Rozpoczęte': data.event.startedAt ? new Date(data.event.startedAt).toLocaleString() : '-',
                'Zakończone': data.event.endedAt ? new Date(data.event.endedAt).toLocaleString() : '-'
            }];
            
            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Podsumowanie');
            
            // Zapisz plik
            XLSX.writeFile(wb, `${filename}.xlsx`);
            
            this.showNotification('Dane wyeksportowane jako Excel!', 'success');
            
        } catch (error) {
            console.error('Błąd eksportu Excel:', error);
            this.showNotification('Błąd eksportu do Excel!', 'error');
        }
    }

    exportPDF(data, filename) {
        // Wersja uproszczona - generujemy prosty PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Nagłówek
        doc.setFontSize(20);
        doc.text('Speed Dating Pro - Raport', 20, 20);
        doc.setFontSize(12);
        doc.text(`Data wygenerowania: ${new Date().toLocaleString()}`, 20, 30);
        
        // Podsumowanie
        doc.setFontSize(16);
        doc.text('Podsumowanie wydarzenia', 20, 50);
        doc.setFontSize(12);
        
        let y = 60;
        doc.text(`Status: ${data.event.status === 'active' ? 'Aktywne' : 
                  data.event.status === 'waiting' ? 'Oczekujące' : 'Zakończone'}`, 20, y);
        y += 10;
        doc.text(`Runda: ${data.event.currentRound}/${data.event.totalRounds}`, 20, y);
        y += 10;
        doc.text(`Uczestnicy: ${data.participants.length}`, 20, y);
        y += 10;
        doc.text(`Oceny: ${data.event.ratings?.length || 0}`, 20, y);
        
        // Uczestnicy
        y += 20;
        doc.setFontSize(16);
        doc.text('Uczestnicy', 20, y);
        doc.setFontSize(10);
        
        data.participants.forEach((participant, index) => {
            y += 10;
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${index + 1}. ${participant.username} (${participant.email})`, 20, y);
        });
        
        // Zapisz PDF
        doc.save(`${filename}.pdf`);
        
        this.showNotification('Dane wyeksportowane jako PDF!', 'success');
    }

    // ========== SYSTEM POWIADOMIEŃ ==========
    showNotification(message, type = 'info') {
        // Użyj toastr dla lepszych powiadomień
        switch(type) {
            case 'success':
                toastr.success(message);
                break;
            case 'error':
                toastr.error(message);
                break;
            case 'warning':
                toastr.warning(message);
                break;
            case 'info':
            default:
                toastr.info(message);
                break;
        }
    }

    // ========== SYSTEM POŁĄCZENIA ==========
    startHeartbeat() {
        // Symulacja połączenia WebSocket
        heartbeatTimer = setInterval(() => {
            this.updateConnectionStatus();
            
            if (currentUser) {
                this.updateUserLastSeen();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);
    }

    updateConnectionStatus() {
        // Symulacja statusu połączenia
        connectionStatus = Math.random() > 0.1; // 90% szans na połączenie
        
        const icon = document.getElementById('connection-icon');
        const statusText = document.getElementById('connection-status');
        const badge = document.getElementById('user-badge');
        
        if (icon && statusText && badge) {
            if (connectionStatus) {
                icon.className = 'fas fa-wifi';
                icon.style.color = '#10b981';
                statusText.textContent = 'Połączono';
                badge.innerHTML = '<i class="fas fa-circle"></i> <span>Połączony</span>';
            } else {
                icon.className = 'fas fa-wifi-slash';
                icon.style.color = '#ef4444';
                statusText.textContent = 'Rozłączono';
                badge.innerHTML = '<i class="fas fa-circle"></i> <span>Rozłączony</span>';
            }
        }
    }

    updateUserLastSeen() {
        if (currentUser) {
            currentUser.lastSeen = new Date().toISOString();
            
            const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
            if (userIndex !== -1) {
                participants[userIndex] = currentUser;
                // Nie zapisujemy za każdym razem dla wydajności
            }
        }
    }

    // ========== UTILITIES ==========
    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    showErrorScreen(message) {
        this.hideAllScreens();
        
        const errorHTML = `
            <div class="error-screen">
                <div class="error-content">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2>Błąd aplikacji</h2>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="app.showModeSelection()">
                            <i class="fas fa-home"></i> Strona główna
                        </button>
                        <button class="btn btn-outline" onclick="location.reload()">
                            <i class="fas fa-redo"></i> Odśwież
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.getElementById('app-container') || document.body;
        container.innerHTML = errorHTML;
    }

    updateFooter() {
        document.getElementById('footer-round').textContent = eventData.currentRound || 1;
        document.getElementById('footer-total-rounds').textContent = eventData.totalRounds || 5;
        
        if (eventData.status === 'active') {
            const totalSeconds = (eventData.roundTime || 5) * 60;
            document.getElementById('footer-time').textContent = this.formatTime(totalSeconds);
        } else {
            document.getElementById('footer-time').textContent = '--:--';
        }
    }

    setupUserPanelListeners() {
        // Przycisk menu
        document.getElementById('user-menu-btn')?.addEventListener('click', () => {
            document.getElementById('user-sidebar').classList.add('open');
        });

        // Przycisk zamykania menu
        document.getElementById('close-sidebar')?.addEventListener('click', () => {
            document.getElementById('user-sidebar').classList.remove('open');
        });

        // Nawigacja w menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Usuń aktywną klasę ze wszystkich elementów
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                
                // Dodaj aktywną klasę do klikniętego elementu
                item.classList.add('active');
                
                // Zamknij menu na mobile
                document.getElementById('user-sidebar').classList.remove('open');
                
                // Załaduj odpowiednią sekcję
                const section = item.dataset.section;
                this.updateUserContent();
            });
        });

        // Przycisk wylogowania
        document.getElementById('user-logout')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // Przycisk pomocy
        document.getElementById('user-help')?.addEventListener('click', () => {
            this.showHelpModal();
        });

        // Przycisk ustawień
        document.getElementById('user-settings')?.addEventListener('click', () => {
            document.querySelector('.nav-item[data-section="settings"]').click();
        });
    }

    handleLogout() {
        if (confirm('Czy na pewno chcesz się wylogować?')) {
            if (currentUser) {
                const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
                if (userIndex !== -1) {
                    participants[userIndex].active = false;
                    participants[userIndex].loggedOutAt = new Date().toISOString();
                    this.saveData();
                }
            }
            
            currentUser = null;
            localStorage.removeItem('currentSessionId');
            
            this.showNotification('Wylogowano pomyślnie', 'success');
            this.showModeSelection();
        }
    }

    showHelpModal() {
        const modal = document.getElementById('help-modal');
        const modalBody = document.querySelector('.modal-body');
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <div class="help-content">
                <h4><i class="fas fa-question-circle"></i> Jak korzystać z aplikacji?</h4>
                
                <div class="help-section">
                    <h5>Dla uczestników:</h5>
                    <ul>
                        <li>Zarejestruj się podając dane i preferencje</li>
                        <li>Dołącz do wydarzenia kiedy organizator je rozpocznie</li>
                        <li>W każdej rundzie rozmawiaj z przypisaną osobą</li>
                        <li>Po zakończeniu czasu oceń rozmówcę (TAK/NIE/MOŻE)</li>
                        <li>Sprawdzaj swoje dopasowania w sekcji "Dopasowania"</li>
                    </ul>
                </div>
                
                <div class="help-section">
                    <h5>Dla organizatorów:</h5>
                    <ul>
                        <li>Ustaw czas rundy i liczbę rund w ustawieniach</li>
                        <li>Rozpocznij wydarzenie kiedy uczestnicy są gotowi</li>
                        <li>System automatycznie dobierze pary na każdą rundę</li>
                        <li>Monitoruj postęp w panelu administratora</li>
                        <li>Eksportuj dane po zakończeniu wydarzenia</li>
                    </ul>
                </div>
                
                <div class="help-section">
                    <h5>Przydatne skróty:</h5>
                    <ul>
                        <li><strong>F5</strong> - Odśwież stronę</li>
                        <li><strong>Esc</strong> - Zamknij modal/powrót</li>
                        <li><strong>Ctrl+S</strong> - Zapisz ustawienia (w panelu admina)</li>
                    </ul>
                </div>
                
                <div class="help-contact">
                    <h5>Potrzebujesz pomocy?</h5>
                    <p>Skontaktuj się z administratorem wydarzenia lub twórcą aplikacji.</p>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        
        // Obsługa zamknięcia modala
        document.querySelector('.btn-close-modal')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Zamknij po kliknięciu poza modalem
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // Zamknij klawiszem Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }

    setupEventListeners() {
        // Obsługa wyboru trybu
        document.querySelectorAll('.mode-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.handleModeSelection(mode);
            });
        });

        // Obsługa klawiszy
        document.addEventListener('keydown', (e) => {
            // Zapisz ustawienia - Ctrl+S
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                const saveBtn = document.querySelector('#event-settings-form button[type="submit"]');
                if (saveBtn) {
                    saveBtn.click();
                }
            }
            
            // Odśwież - F5
            if (e.key === 'F5') {
                e.preventDefault();
                this.updateAdminPanel();
            }
            
            // Zamknij modal - Esc
            if (e.key === 'Escape') {
                const modal = document.getElementById('help-modal');
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            }
        });
    }

    handleModeSelection(mode) {
        switch(mode) {
            case 'participant':
                this.showRegistrationScreen();
                break;
            case 'admin':
                this.showAdminPanel();
                break;
            case 'demo':
                this.startDemoMode();
                break;
        }
    }

    startDemoMode() {
        isDemoMode = true;
        
        // Utwórz demo użytkownika
        currentUser = {
            id: 'demo_user_' + Date.now(),
            username: 'DemoUżytkownik',
            email: 'demo@example.com',
            gender: 'male',
            interested: ['female'],
            age: 30,
            bio: 'To jest konto demo do testowania aplikacji',
            joinedAt: new Date().toISOString(),
            ratings: {},
            tags: {},
            status: 'active',
            active: true,
            lastSeen: new Date().toISOString(),
            sessionId: 'demo_session',
            avatarColor: '#667eea'
        };
        
        // Utwórz demo dane wydarzenia
        eventData = {
            status: 'active',
            currentRound: 1,
            totalRounds: 5,
            roundTime: 3, // Krótszy czas dla demo
            ratingTime: 1,
            pairings: [],
            ratings: [],
            settings: {
                allowRepeats: true,
                maxParticipants: 10,
                matchingAlgorithm: 'smart',
                notifications: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Dodaj kilku demo uczestników
        this.addDemoUsers();
        
        // Wygeneruj pary
        this.generateSmartPairings();
        
        this.showNotification('Tryb demo aktywowany!', 'success');
        this.showUserPanel();
    }

    triggerEvent(eventName, data = null) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// ========== INICJALIZACJA APLIKACJI ==========
let app;

// Start aplikacji kiedy DOM jest gotowy
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new SpeedDatingApp();
    });
} else {
    app = new SpeedDatingApp();
}

// Eksport do globalnego scope dla debugowania
window.app = app;

// ========== GLOBALNE FUNKCJE POMOCNICZE ==========
window.formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        toastr.success('Skopiowano do schowka!');
    }).catch(err => {
        console.error('Błąd kopiowania:', err);
        toastr.error('Błąd kopiowania!');
    });
};

// ========== STYLES DYNAMICZNE ==========
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .toast-success {
            background-color: #10b981 !important;
        }
        
        .toast-error {
            background-color: #ef4444 !important;
        }
        
        .toast-warning {
            background-color: #f59e0b !important;
        }
        
        .toast-info {
            background-color: #3b82f6 !important;
        }
        
        /* Animacje */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});
