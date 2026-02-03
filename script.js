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
        console.log(`Speed Dating Pro v${CONFIG.VERSION}`);
        this.initialize();
    }

    initialize() {
        // Inicjalizacja toastr
        if (typeof toastr !== 'undefined') {
            toastr.options = {
                positionClass: 'toast-top-right',
                progressBar: true,
                timeOut: 3000,
                closeButton: true
            };
        }

        this.loadData();
        this.setupEventListeners();
        this.startHeartbeat();
        this.showLoadingScreen();
        
        // Symulacja ładowania
        setTimeout(() => {
            this.detectRole();
        }, 1000);
    }

    showLoadingScreen() {
        this.hideAllScreens();
        document.getElementById('loading-screen')?.classList.add('active');
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
        document.getElementById('mode-screen')?.classList.add('active');
    }

    // ========== EKRAN REJESTRACJI ==========
    showRegistrationScreen() {
        this.hideAllScreens();
        document.getElementById('login-screen')?.classList.add('active');
        this.initializeRegistrationForm();
    }

    initializeRegistrationForm() {
        const form = document.getElementById('register-form');
        if (!form) return;

        // Inicjalizacja przycisków płci
        document.querySelectorAll('.gender-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                const genderInput = document.getElementById('reg-gender');
                if (genderInput) genderInput.value = btn.dataset.value;
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
                if (this.validateStep(1)) {
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

        // Ustaw pierwszy krok jako aktywny
        this.showStep(1);
    }

    showStep(stepNumber) {
        const steps = document.querySelectorAll('.form-step');
        const stepperSteps = document.querySelectorAll('.stepper-progress .step');
        
        steps.forEach(step => step.classList.remove('active'));
        stepperSteps.forEach(step => step.classList.remove('active'));
        
        const currentStep = document.querySelector(`.form-step[data-step="${stepNumber}"]`);
        const currentStepperStep = document.querySelector(`.step[data-step="${stepNumber}"]`);
        
        if (currentStep) currentStep.classList.add('active');
        if (currentStepperStep) currentStepperStep.classList.add('active');
        
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
        
        const age = document.getElementById('reg-age')?.value;
        if (age && (age < 18 || age > 100)) {
            this.showError('interests-error', 'Wiek musi być między 18 a 100 lat');
            valid = false;
        }
        
        return valid;
    }

    validateStep3() {
        const termsCheckbox = document.getElementById('reg-terms');
        if (termsCheckbox && !termsCheckbox.checked) {
            this.showError('terms-error', 'Musisz zaakceptować regulamin');
            return false;
        }
        
        this.clearError('terms-error');
        return true;
    }

    validateUsername() {
        const usernameInput = document.getElementById('reg-username');
        if (!usernameInput) return false;
        
        const username = usernameInput.value.trim();
        
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
        const emailInput = document.getElementById('reg-email');
        if (!emailInput) return false;
        
        const email = emailInput.value.trim();
        
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
        const genderInput = document.getElementById('reg-gender');
        if (!genderInput) return false;
        
        if (!genderInput.value) {
            this.showError('gender-error', 'Wybierz swoją płeć');
            return false;
        }
        
        this.clearError('gender-error');
        return true;
    }

    validateInterests() {
        const interestsInput = document.getElementById('reg-interests');
        if (!interestsInput) return false;
        
        const interests = JSON.parse(interestsInput.value || '[]');
        
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
        const interestsInput = document.getElementById('reg-interests');
        if (interestsInput) {
            interestsInput.value = JSON.stringify(selected);
        }
    }

    updateSummary() {
        const username = document.getElementById('reg-username')?.value || '-';
        const email = document.getElementById('reg-email')?.value || '-';
        const gender = document.getElementById('reg-gender')?.value;
        const age = document.getElementById('reg-age')?.value;
        const interests = document.getElementById('reg-interests')?.value || '[]';
        const bio = document.getElementById('reg-bio')?.value;
        
        document.getElementById('summary-username').textContent = username;
        document.getElementById('summary-email').textContent = email;
        
        const genderText = gender === 'male' ? 'Mężczyzna' : 
                          gender === 'female' ? 'Kobieta' : 'Inna';
        document.getElementById('summary-gender').textContent = genderText;
        
        document.getElementById('summary-age').textContent = age || 'Nie podano';
        
        const interestsArray = JSON.parse(interests);
        const interestsText = interestsArray.map(i => 
            i === 'male' ? 'Mężczyzn' : 
            i === 'female' ? 'Kobiet' : 'Innych'
        ).join(', ');
        document.getElementById('summary-interests').textContent = interestsText || '-';
        
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
                username: document.getElementById('reg-username')?.value.trim() || '',
                email: document.getElementById('reg-email')?.value.trim() || '',
                gender: document.getElementById('reg-gender')?.value || '',
                interested: JSON.parse(document.getElementById('reg-interests')?.value || '[]'),
                age: document.getElementById('reg-age')?.value || null,
                bio: document.getElementById('reg-bio')?.value || '',
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
        document.getElementById('user-panel')?.classList.add('active');
        
        if (!currentUser) {
            this.showRegistrationScreen();
            return;
        }

        this.updateUserInterface();
        this.setupUserPanelListeners();
    }

    updateUserInterface() {
        // Aktualizuj nagłówek
        const userNameElement = document.getElementById('user-name');
        const avatarIcon = document.getElementById('user-avatar-icon');
        
        if (userNameElement) userNameElement.textContent = currentUser.username;
        if (avatarIcon) avatarIcon.style.color = currentUser.avatarColor || '#667eea';
        
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
                                <div class="stat-value">${this.calculateMatches().length}</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <h3>Status</h3>
                                <div class="stat-value">${eventData.status === 'active' ? 'Aktywny' : eventData.status === 'waiting' ? 'Oczekuje' : 'Zakończony'}</div>
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
                    <div class="timer-container">
                        <div class="timer-label">Pozostały czas rundy</div>
                        <div class="timer-display">${this.formatTime((eventData.roundTime || 5) * 60)}</div>
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
                        <p>Twoje wyniki zostały zapisane.</p>
                        <div class="final-stats">
                            <p>Rozegrane rundy: <strong>${eventData.currentRound || 0}</strong></p>
                            <p>Twoje oceny: <strong>${Object.keys(currentUser.ratings || {}).length}</strong></p>
                            <p>Dopasowania: <strong>${this.calculateMatches().length}</strong></p>
                        </div>
                    </div>
                </div>
            `;
        }

        content.innerHTML = html;
        
        // Aktualizuj stolik jeśli wydarzenie aktywne
        if (eventData.status === 'active') {
            this.updateCurrentTable();
        }
    }

    updateCurrentTable() {
        const container = document.getElementById('current-table-container');
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
                            <div class="timer-display">${this.formatTime((eventData.roundTime || 5) * 60)}</div>
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
                </div>
            `;
        }
    }

    startTableTimer(seconds, onComplete) {
        let timeLeft = seconds;
        const timerElement = document.querySelector('.table-timer .timer-display');
        
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
                matches.push({
                    partnerId: ratedUserId,
                    score: 100,
                    mutual: true,
                    timestamp: rating.timestamp
                });
            }
        }
        
        return matches;
    }

    renderMatches() {
        const content = document.getElementById('user-content');
        if (!content) return;

        const matches = this.calculateMatches();
        
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
                                            <i class="fas fa-star"></i> Dopasowanie
                                        </span>
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
                
                <div class="profile-form">
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
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" id="save-profile">
                            <i class="fas fa-save"></i> Zapisz zmiany
                        </button>
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;

        // Obsługa zapisywania profilu
        document.getElementById('save-profile')?.addEventListener('click', () => {
            this.saveProfileChanges();
        });
    }

    saveProfileChanges() {
        const emailInput = document.getElementById('profile-email');
        const bioTextarea = document.getElementById('profile-bio');
        
        if (!emailInput || !bioTextarea) return;
        
        const email = emailInput.value.trim();
        const bio = bioTextarea.value.trim();

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
    }

    // ========== PANEL ADMINISTRATORA ==========
    showAdminPanel() {
        this.hideAllScreens();
        document.getElementById('admin-panel')?.classList.add('active');
        this.renderAdminPanel();
    }

    renderAdminPanel() {
        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;

        const activeParticipants = participants.filter(p => p && p.active !== false);
        const ratingsCount = eventData.ratings?.length || 0;
        const yesRatings = eventData.ratings?.filter(r => r.rating === 'yes').length || 0;
        const currentPairings = eventData.pairings?.[eventData.currentRound - 1];
        
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
                                        ${activeParticipants.length > 0 ? '<i class="fas fa-arrow-up"></i> Aktywni' : 'Brak'}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="fas fa-handshake"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Aktywne pary</h3>
                                    <div class="stat-value">${currentPairings?.pairs?.length || 0}</div>
                                    <div class="stat-trend">Bieżąca runda</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="fas fa-coffee"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Na przerwie</h3>
                                    <div class="stat-value">${currentPairings?.breakTable?.length || 0}</div>
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
                                        ${yesRatings > 0 ? '<i class="fas fa-heart"></i> Pozytywne' : 'Brak'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-controls">
                        <div class="control-section">
                            <h3><i class="fas fa-cogs"></i> Sterowanie wydarzeniem</h3>
                            <div class="control-buttons">
                                <button class="btn btn-success" id="start-event-btn" ${eventData.status === 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-play"></i> Rozpocznij
                                </button>
                                <button class="btn btn-warning" id="next-round-btn" ${eventData.status !== 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-forward"></i> Następna runda
                                </button>
                                <button class="btn btn-danger" id="end-event-btn">
                                    <i class="fas fa-stop"></i> Zakończ
                                </button>
                                <button class="btn btn-primary" id="generate-pairs-btn">
                                    <i class="fas fa-random"></i> Generuj pary
                                </button>
                            </div>
                        </div>
                        
                        <div class="control-section">
                            <h3><i class="fas fa-clock"></i> Ustawienia czasu</h3>
                            <div class="time-settings">
                                <div class="time-input">
                                    <label>Czas rundy (min)</label>
                                    <input type="number" id="round-time" value="${eventData.roundTime || 5}" min="1" max="30">
                                </div>
                                <div class="time-input">
                                    <label>Czas oceny (min)</label>
                                    <input type="number" id="rating-time" value="${eventData.ratingTime || 2}" min="1" max="10">
                                </div>
                                <div class="time-input">
                                    <label>Liczba rund</label>
                                    <input type="number" id="total-rounds" value="${eventData.totalRounds || 5}" min="1" max="10">
                                </div>
                                <button class="btn btn-primary" id="save-time-btn">
                                    <i class="fas fa-save"></i> Zapisz
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-tabs">
                        <div class="tab-buttons">
                            <button class="tab-btn active" data-tab="participants">
                                <i class="fas fa-users"></i> Uczestnicy
                            </button>
                            <button class="tab-btn" data-tab="pairings">
                                <i class="fas fa-chair"></i> Stoliki
                            </button>
                            <button class="tab-btn" data-tab="ratings">
                                <i class="fas fa-star"></i> Oceny
                            </button>
                            <button class="tab-btn" data-tab="export">
                                <i class="fas fa-download"></i> Eksport
                            </button>
                        </div>
                        
                        <div class="tab-content">
                            <div class="tab-pane active" id="participants-tab">
                                <div class="participants-list">
                                    <h3>Lista uczestników (${activeParticipants.length})</h3>
                                    ${activeParticipants.length === 0 ? `
                                        <div class="empty-list">
                                            <i class="fas fa-users-slash"></i>
                                            <p>Brak uczestników</p>
                                        </div>
                                    ` : `
                                        <table class="participants-table">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Nazwa</th>
                                                    <th>Email</th>
                                                    <th>Płeć</th>
                                                    <th>Szuka</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${activeParticipants.map(p => `
                                                    <tr>
                                                        <td>${p.id.substring(0, 8)}...</td>
                                                        <td>
                                                            <div class="participant-info">
                                                                <div class="participant-avatar small" style="background: ${p.avatarColor || '#667eea'}">
                                                                    <i class="fas fa-user"></i>
                                                                </div>
                                                                ${p.username}
                                                            </div>
                                                        </td>
                                                        <td>${p.email}</td>
                                                        <td>
                                                            <span class="gender-badge ${p.gender}">
                                                                ${p.gender === 'male' ? 'M' : p.gender === 'female' ? 'K' : 'I'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            ${p.interested?.map(i => 
                                                                `<span class="interest-tag">${
                                                                    i === 'male' ? 'M' : i === 'female' ? 'K' : 'I'
                                                                }</span>`
                                                            ).join('') || '-'}
                                                        </td>
                                                        <td>
                                                            <span class="status-badge ${this.getParticipantStatus(p.id) === 'W parze' ? 'success' : 'warning'}">
                                                                ${this.getParticipantStatus(p.id)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="pairings-tab">
                                <div class="pairings-container">
                                    <h3>Stoliki - Runda ${eventData.currentRound || 1}</h3>
                                    ${currentPairings?.pairs?.length > 0 ? `
                                        <div class="pairings-grid">
                                            ${currentPairings.pairs.map((pair, index) => {
                                                const [user1, user2] = pair;
                                                return `
                                                    <div class="pairing-card">
                                                        <div class="pairing-header">
                                                            <h4><i class="fas fa-chair"></i> Stolik ${index + 1}</h4>
                                                        </div>
                                                        <div class="pairing-participants">
                                                            <div class="participant">
                                                                <div class="participant-avatar small" style="background: ${user1.avatarColor || '#667eea'}">
                                                                    <i class="fas fa-user"></i>
                                                                </div>
                                                                <div class="participant-info">
                                                                    <strong>${user1.username}</strong>
                                                                    <span>${user1.gender === 'male' ? '♂' : user1.gender === 'female' ? '♀' : '⚧'}</span>
                                                                </div>
                                                            </div>
                                                            <div class="pairing-connector">
                                                                <i class="fas fa-heart"></i>
                                                            </div>
                                                            <div class="participant">
                                                                <div class="participant-avatar small" style="background: ${user2.avatarColor || '#ff6b6b'}">
                                                                    <i class="fas fa-user"></i>
                                                                </div>
                                                                <div class="participant-info">
                                                                    <strong>${user2.username}</strong>
                                                                    <span>${user2.gender === 'male' ? '♂' : user2.gender === 'female' ? '♀' : '⚧'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                        ${currentPairings.breakTable?.length > 0 ? `
                                            <div class="break-section">
                                                <h4><i class="fas fa-coffee"></i> Osoby na przerwie (${currentPairings.breakTable.length})</h4>
                                                <div class="break-list">
                                                    ${currentPairings.breakTable.map(user => `
                                                        <span class="break-user">
                                                            <i class="fas fa-user"></i> ${user.username}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    ` : `
                                        <div class="empty-pairings">
                                            <i class="fas fa-random"></i>
                                            <p>Brak wygenerowanych par</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="ratings-tab">
                                <div class="ratings-container">
                                    <h3>Wszystkie oceny (${ratingsCount})</h3>
                                    ${ratingsCount > 0 ? `
                                        <div class="ratings-stats">
                                            <div class="stat-badge success">
                                                <i class="fas fa-thumbs-up"></i>
                                                <span>TAK: ${yesRatings}</span>
                                            </div>
                                            <div class="stat-badge danger">
                                                <i class="fas fa-thumbs-down"></i>
                                                <span>NIE: ${ratingsCount - yesRatings - (eventData.ratings?.filter(r => r.rating === 'maybe').length || 0)}</span>
                                            </div>
                                            <div class="stat-badge warning">
                                                <i class="fas fa-question"></i>
                                                <span>MOŻE: ${eventData.ratings?.filter(r => r.rating === 'maybe').length || 0}</span>
                                            </div>
                                        </div>
                                        <div class="ratings-table-container">
                                            <table class="ratings-table">
                                                <thead>
                                                    <tr>
                                                        <th>Od</th>
                                                        <th>Do</th>
                                                        <th>Ocena</th>
                                                        <th>Runda</th>
                                                        <th>Czas</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${eventData.ratings?.slice(0, 20).map(rating => {
                                                        const fromUser = participants.find(p => p && p.id === rating.from);
                                                        const toUser = participants.find(p => p && p.id === rating.to);
                                                        const ratingDate = new Date(rating.timestamp);
                                                        
                                                        return `
                                                            <tr>
                                                                <td>${fromUser?.username || rating.from.substring(0, 8)}</td>
                                                                <td>${toUser?.username || rating.to.substring(0, 8)}</td>
                                                                <td>
                                                                    <span class="rating-badge ${rating.rating}">
                                                                        ${rating.rating === 'yes' ? 'TAK' : rating.rating === 'no' ? 'NIE' : 'MOŻE'}
                                                                    </span>
                                                                </td>
                                                                <td>${rating.round}</td>
                                                                <td>${ratingDate.toLocaleTimeString()}</td>
                                                            </tr>
                                                        `;
                                                    }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    ` : `
                                        <div class="empty-ratings">
                                            <i class="fas fa-star"></i>
                                            <p>Brak ocen</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="export-tab">
                                <div class="export-container">
                                    <h3><i class="fas fa-download"></i> Eksport danych</h3>
                                    <div class="export-options">
                                        <button class="btn btn-primary" id="export-json">
                                            <i class="fas fa-file-code"></i> Eksportuj JSON
                                        </button>
                                        <button class="btn btn-success" id="export-excel">
                                            <i class="fas fa-file-excel"></i> Eksportuj Excel
                                        </button>
                                        <button class="btn btn-danger" id="clear-data">
                                            <i class="fas fa-trash"></i> Wyczyść dane
                                        </button>
                                    </div>
                                    <div class="export-info">
                                        <p><i class="fas fa-info-circle"></i> Dane są automatycznie zapisywane w localStorage przeglądarki.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-footer">
                        <p>Speed Dating Pro v${CONFIG.VERSION} | Panel administratora</p>
                    </div>
                </div>
            </div>
        `;

        this.setupAdminPanelListeners();
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

        // Zapisywanie czasu
        document.getElementById('save-time-btn')?.addEventListener('click', () => {
            this.saveTimeSettings();
        });

        // Przyciski eksportu
        document.getElementById('export-json')?.addEventListener('click', () => {
            this.exportData('json');
        });

        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.exportData('excel');
        });

        document.getElementById('clear-data')?.addEventListener('click', () => {
            this.clearAllData();
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
        this.renderAdminPanel();
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

        const targetTab = document.getElementById(`${tabId}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    }

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
        if (confirm('Czy na pewno zakończyć wydarzenie?')) {
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

    saveTimeSettings() {
        try {
            const roundTimeInput = document.getElementById('round-time');
            const ratingTimeInput = document.getElementById('rating-time');
            const totalRoundsInput = document.getElementById('total-rounds');
            
            if (roundTimeInput) eventData.roundTime = parseInt(roundTimeInput.value) || 5;
            if (ratingTimeInput) eventData.ratingTime = parseInt(ratingTimeInput.value) || 2;
            if (totalRoundsInput) eventData.totalRounds = parseInt(totalRoundsInput.value) || 5;
            
            this.saveData();
            this.showNotification('Ustawienia czasu zapisane!', 'success');
        } catch (error) {
            console.error('Błąd zapisywania ustawień:', error);
            this.showNotification('Błąd zapisywania ustawień!', 'error');
        }
    }

    startMainTimer() {
        if (timerInterval) clearInterval(timerInterval);
        
        timeLeft = (eventData.roundTime || 5) * 60;
        
        timerInterval = setInterval(() => {
            timeLeft--;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                this.showNotification('Czas rundy minął!', 'warning');
                
                // Automatycznie przejdź do następnej rundy jeśli to nie ostatnia
                if (eventData.currentRound < eventData.totalRounds) {
                    setTimeout(() => {
                        this.nextRound();
                    }, 3000);
                }
            }
        }, 1000);
    }

    resetTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        this.startMainTimer();
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

                // Prosty algorytm dopasowywania
                for (let i = 0; i < shuffled.length; i++) {
                    if (pairedIds.has(shuffled[i].id)) continue;

                    // Znajdź nieparowanego partnera
                    for (let j = i + 1; j < shuffled.length; j++) {
                        if (pairedIds.has(shuffled[j].id)) continue;

                        // Sprawdź czy ta para już się spotkała
                        const pairKey = [shuffled[i].id, shuffled[j].id].sort().join('_');
                        if (usedPairs.has(pairKey) && !eventData.settings?.allowRepeats) {
                            continue;
                        }

                        // Utwórz parę
                        roundPairings.pairs.push([shuffled[i], shuffled[j]]);
                        pairedIds.add(shuffled[i].id);
                        pairedIds.add(shuffled[j].id);
                        usedPairs.add(pairKey);
                        break;
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

    // ========== SYSTEM OCENIANIA ==========
    showRatingScreen(partner) {
        this.hideAllScreens();
        currentPartner = partner;
        
        const ratingScreen = document.getElementById('rating-screen');
        if (ratingScreen) ratingScreen.classList.add('active');
        
        // Aktualizuj UI
        const ratePerson = document.getElementById('rate-person');
        if (ratePerson) ratePerson.textContent = partner.username;
        
        this.initializeRatingScreen();
    }

    initializeRatingScreen() {
        let selectedRating = null;
        
        // Obsługa wyboru oceny
        document.querySelectorAll('.rating-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.rating-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedRating = option.dataset.rating;
                this.updateSubmitButton();
            });
        });
        
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
        const skipBtn = document.getElementById('skip-rating');
        const submitBtn = document.getElementById('submit-rating');
        
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.skipRating();
            });
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitRating(selectedRating);
            });
        }
    }

    updateRatingTimer() {
        const timerElement = document.getElementById('rating-timer');
        if (timerElement) {
            timerElement.textContent = this.formatTime(ratingTimeLeft);
        }
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-rating');
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }

    skipRating() {
        if (confirm('Czy na pewno chcesz pominąć ocenę tej osoby?')) {
            this.showUserPanel();
        }
    }

    autoSubmitRating() {
        // Automatycznie wybierz "MOŻE" jeśli nie wybrano oceny
        const maybeOption = document.querySelector('.rating-option[data-rating="maybe"]');
        if (maybeOption) {
            maybeOption.click();
            setTimeout(() => {
                this.submitRating('maybe');
            }, 500);
        }
    }

    submitRating(rating) {
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
            
            // Zapisz plik
            XLSX.writeFile(wb, `${filename}.xlsx`);
            
            this.showNotification('Dane wyeksportowane jako Excel!', 'success');
            
        } catch (error) {
            console.error('Błąd eksportu Excel:', error);
            this.showNotification('Błąd eksportu do Excel!', 'error');
        }
    }

    // ========== SYSTEM POWIADOMIEŃ ==========
    showNotification(message, type = 'info') {
        // Użyj toastr jeśli dostępny
        if (typeof toastr !== 'undefined') {
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
                default:
                    toastr.info(message);
                    break;
            }
        } else {
            // Fallback do alertu
            alert(`${type.toUpperCase()}: ${message}`);
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
        
        if (icon && statusText) {
            if (connectionStatus) {
                icon.className = 'fas fa-wifi';
                icon.style.color = '#10b981';
                statusText.textContent = 'Połączono';
            } else {
                icon.className = 'fas fa-wifi-slash';
                icon.style.color = '#ef4444';
                statusText.textContent = 'Rozłączono';
            }
        }
    }

    updateUserLastSeen() {
        if (currentUser) {
            currentUser.lastSeen = new Date().toISOString();
            
            const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
            if (userIndex !== -1) {
                participants[userIndex] = currentUser;
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
            <div style="min-height: 100vh; display: flex; justify-content: center; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
                <div style="background: white; border-radius: 15px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div style="font-size: 60px; color: #f44336; margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="color: #333; margin-bottom: 15px;">Błąd aplikacji</h2>
                    <p style="color: #666; margin-bottom: 25px;">${message}</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="app.showModeSelection()" class="btn" style="background: #667eea; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-home"></i> Strona główna
                        </button>
                        <button onclick="location.reload()" class="btn" style="background: #f0f0f0; color: #333; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-redo"></i> Odśwież
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHTML;
    }

    updateFooter() {
        const footerRound = document.getElementById('footer-round');
        const footerTotalRounds = document.getElementById('footer-total-rounds');
        const footerTime = document.getElementById('footer-time');
        
        if (footerRound) footerRound.textContent = eventData.currentRound || 1;
        if (footerTotalRounds) footerTotalRounds.textContent = eventData.totalRounds || 5;
        
        if (footerTime) {
            if (eventData.status === 'active') {
                const totalSeconds = (eventData.roundTime || 5) * 60;
                footerTime.textContent = this.formatTime(totalSeconds);
            } else {
                footerTime.textContent = '--:--';
            }
        }
    }

    setupUserPanelListeners() {
        // Przycisk menu
        const menuBtn = document.getElementById('user-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('user-sidebar');
                if (sidebar) sidebar.classList.add('open');
            });
        }

        // Przycisk zamykania menu
        const closeBtn = document.getElementById('close-sidebar');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('user-sidebar');
                if (sidebar) sidebar.classList.remove('open');
            });
        }

        // Nawigacja w menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Usuń aktywną klasę ze wszystkich elementów
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                
                // Dodaj aktywną klasę do klikniętego elementu
                item.classList.add('active');
                
                // Zamknij menu na mobile
                const sidebar = document.getElementById('user-sidebar');
                if (sidebar) sidebar.classList.remove('open');
                
                // Załaduj odpowiednią sekcję
                this.updateUserContent();
            });
        });

        // Przycisk wylogowania
        const logoutBtn = document.getElementById('user-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
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

    setupEventListeners() {
        // Obsługa wyboru trybu
        document.querySelectorAll('.mode-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.handleModeSelection(mode);
            });
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
            roundTime: 3,
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
        
        this.showNotification('Tryb demo aktywowany!', 'success');
        this.showUserPanel();
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
            }
        ];

        demoUsers.forEach(demoUser => {
            const existing = participants.find(p => 
                p && p.email === demoUser.email
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
            }
        });
        
        this.saveData();
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

// Eksport do globalnego scope
window.app = app;
window.formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};
