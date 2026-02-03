// ============================================
// SPEED DATING PRO - POPRAWIONA WERSJA
// ============================================

// ========== KONFIGURACJA I STAŁE ==========
const CONFIG = {
    MAX_PARTICIPANTS: 50,
    MIN_PARTICIPANTS: 2,
    MAX_ROUNDS: 10,
    MIN_ROUND_TIME: 1,
    MAX_ROUND_TIME: 30,
    SESSION_TIMEOUT: 30 * 60 * 1000,
    HEARTBEAT_INTERVAL: 30000,
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

// ========== KLASA APLIKACJI ==========
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
        
        // Natychmiast przejdź do wyboru trybu (bez ekranu ładowania)
        setTimeout(() => {
            this.detectRole();
        }, 100);
    }

    showLoadingScreen() {
        this.hideAllScreens();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('active');
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    loadData() {
        try {
            const storedParticipants = localStorage.getItem('speedDatingParticipants');
            participants = storedParticipants ? JSON.parse(storedParticipants) : [];
            
            const storedEvent = localStorage.getItem('speedDatingEvent');
            eventData = storedEvent ? JSON.parse(storedEvent) : this.getDefaultEventData();
            
            this.cleanOldSessions();
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
            return (now - lastSeen) < CONFIG.SESSION_TIMEOUT;
        });
        this.saveData();
    }

    // ========== DETEKCJA ROLI ==========
    detectRole() {
        try {
            this.hideAllScreens();
            
            // Sprawdź URL parametry (priorytet)
            const urlParams = new URLSearchParams(window.location.search);
            const mode = urlParams.get('mode');
            
            if (mode === 'admin') {
                this.showAdminPanel();
                return;
            }
            
            // Sprawdź sesję użytkownika
            const sessionId = localStorage.getItem('currentSessionId');
            if (sessionId) {
                currentUser = participants.find(p => p && p.sessionId === sessionId && p.active !== false);
                
                if (currentUser) {
                    this.updateUserLastSeen();
                    this.showUserPanel();
                    return;
                }
            }
            
            // Domyślnie pokaż wybór trybu
            this.showModeSelection();
            
        } catch (error) {
            console.error('Błąd detectRole:', error);
            this.showModeSelection(); // Fallback do wyboru trybu
        }
    }

    showModeSelection() {
        this.hideAllScreens();
        const modeScreen = document.getElementById('mode-screen');
        if (modeScreen) {
            modeScreen.classList.add('active');
        }
    }

    // ========== EKRAN REJESTRACJI ==========
    showRegistrationScreen() {
        this.hideAllScreens();
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('active');
        this.initializeRegistrationForm();
    }

    initializeRegistrationForm() {
        const form = document.getElementById('register-form');
        if (!form) return;

        // Resetuj formularz
        form.reset();
        
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
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const nextStep = parseInt(btn.dataset.next);
                if (this.validateStep(nextStep - 1)) {
                    this.showStep(nextStep);
                }
            });
        });

        document.querySelectorAll('.btn-back-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const prevStep = parseInt(btn.dataset.prev);
                this.showStep(prevStep);
            });
        });

        // Przycisk powrotu
        const backBtn = document.getElementById('back-to-mode');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showModeSelection();
            });
        }

        // Obsługa formularza
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateStep(3)) {
                this.handleRegistration();
            }
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
        return this.validateInterests();
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
                age: document.getElementById('reg-age')?.value || null,
                bio: document.getElementById('reg-bio')?.value || '',
                joinedAt: new Date().toISOString(),
                ratings: {},
                tags: {},
                status: 'active',
                active: true,
                lastSeen: new Date().toISOString(),
                sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                avatarColor: this.getRandomColor()
            };

            participants.push(userData);
            currentUser = userData;
            this.saveData();

            localStorage.setItem('currentSessionId', userData.sessionId);
            
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
        const userPanel = document.getElementById('user-panel');
        if (userPanel) userPanel.classList.add('active');
        
        if (!currentUser) {
            this.showRegistrationScreen();
            return;
        }

        this.updateUserInterface();
    }

    updateUserInterface() {
        // Aktualizuj nagłówek
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) userNameElement.textContent = currentUser.username;
        
        // Przycisk wylogowania
        const logoutBtn = document.getElementById('user-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
        
        // Renderuj dashboard
        this.renderDashboard();
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
                        <p style="font-size: 14px; color: #666; margin-top: 5px;">Status wydarzenia: <strong>${eventData.status === 'active' ? 'Aktywne' : 'Oczekuje'}</strong></p>
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
                                <h3>Czas rundy</h3>
                                <div class="stat-value">${eventData.roundTime || 5} min</div>
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
                        <h2><i class="fas fa-info-circle"></i> Informacje</h2>
                    </div>
                    <div class="info-box">
                        <p><i class="fas fa-users"></i> Uczestników: <strong>${participants.filter(p => p && p.active !== false).length}</strong></p>
                        <p><i class="fas fa-clock"></i> Czas do końca rundy: <strong>${this.formatTime((eventData.roundTime || 5) * 60)}</strong></p>
                        ${eventData.pairings && eventData.pairings[eventData.currentRound - 1] ? 
                            `<p><i class="fas fa-chair"></i> Aktywnych par: <strong>${eventData.pairings[eventData.currentRound - 1].pairs?.length || 0}</strong></p>` : 
                            ''}
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
                        <div class="waiting-info">
                            <p><i class="fas fa-user-friends"></i> Zarejestrowani uczestnicy: <strong>${participants.filter(p => p && p.active !== false).length}</strong></p>
                            <p><i class="fas fa-bullhorn"></i> Organizator może rozpocząć wydarzenie gdy będzie co najmniej ${CONFIG.MIN_PARTICIPANTS} uczestników</p>
                        </div>
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
                            <p><i class="fas fa-calendar-alt"></i> Rozegrane rundy: <strong>${eventData.currentRound || 0}</strong></p>
                            <p><i class="fas fa-star"></i> Twoje oceny: <strong>${Object.keys(currentUser.ratings || {}).length}</strong></p>
                            <p><i class="fas fa-heart"></i> Dopasowania: <strong>${this.calculateMatches().length}</strong></p>
                        </div>
                    </div>
                </div>
            `;
        }

        content.innerHTML = html;
    }

    calculateMatches() {
        if (!currentUser || !currentUser.ratings) return [];
        
        const matches = [];
        const userRatings = currentUser.ratings;
        
        for (const [ratedUserId, rating] of Object.entries(userRatings)) {
            const ratedUser = participants.find(p => p && p.id === ratedUserId);
            if (!ratedUser || !ratedUser.ratings) continue;
            
            const theirRating = ratedUser.ratings[currentUser.id];
            if (theirRating && theirRating.rating === 'yes' && rating.rating === 'yes') {
                matches.push({
                    partnerId: ratedUserId,
                    partnerName: ratedUser.username,
                    score: 100,
                    mutual: true,
                    timestamp: rating.timestamp
                });
            }
        }
        
        return matches;
    }

    // ========== PANEL ADMINISTRATORA ==========
    showAdminPanel() {
        this.hideAllScreens();
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) adminPanel.classList.add('active');
        this.renderAdminPanel();
    }

    renderAdminPanel() {
        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;

        const activeParticipants = participants.filter(p => p && p.active !== false);
        
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
                                <div class="stat-icon admin" style="background: rgba(102, 126, 234, 0.1); color: #667eea;">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Uczestnicy</h3>
                                    <div class="stat-value">${activeParticipants.length}</div>
                                    <div class="stat-subtitle">z ${CONFIG.MAX_PARTICIPANTS}</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon success" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                                    <i class="fas fa-play-circle"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Status</h3>
                                    <div class="stat-value">${eventData.status === 'active' ? 'Aktywne' : 'Oczekuje'}</div>
                                    <div class="stat-subtitle">${eventData.status === 'active' ? 'Runda ' + eventData.currentRound : 'Gotowe do startu'}</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon warning" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Czas rundy</h3>
                                    <div class="stat-value">${eventData.roundTime || 5} min</div>
                                    <div class="stat-subtitle">Ocena: ${eventData.ratingTime || 2} min</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon info" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                                    <i class="fas fa-star"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Oceny</h3>
                                    <div class="stat-value">${eventData.ratings?.length || 0}</div>
                                    <div class="stat-subtitle">wysłanych ocen</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-controls">
                        <div class="control-section">
                            <h3><i class="fas fa-cogs"></i> Sterowanie wydarzeniem</h3>
                            <div class="control-buttons">
                                <button class="btn btn-success" id="start-event-btn" ${eventData.status === 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-play"></i> Rozpocznij wydarzenie
                                </button>
                                <button class="btn btn-warning" id="next-round-btn" ${eventData.status !== 'active' ? 'disabled' : ''}>
                                    <i class="fas fa-forward"></i> Następna runda
                                </button>
                                <button class="btn btn-danger" id="end-event-btn">
                                    <i class="fas fa-stop"></i> Zakończ wydarzenie
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
                                    <label><i class="fas fa-hourglass"></i> Czas rundy (min)</label>
                                    <input type="number" id="round-time" value="${eventData.roundTime || 5}" min="1" max="30">
                                </div>
                                <div class="time-input">
                                    <label><i class="fas fa-star"></i> Czas oceny (min)</label>
                                    <input type="number" id="rating-time" value="${eventData.ratingTime || 2}" min="1" max="10">
                                </div>
                                <div class="time-input">
                                    <label><i class="fas fa-flag-checkered"></i> Liczba rund</label>
                                    <input type="number" id="total-rounds" value="${eventData.totalRounds || 5}" min="1" max="10">
                                </div>
                                <button class="btn btn-primary" id="save-time-btn">
                                    <i class="fas fa-save"></i> Zapisz ustawienia
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
                                    <div class="section-header">
                                        <h3><i class="fas fa-users"></i> Lista uczestników</h3>
                                        <span class="badge">${activeParticipants.length} osób</span>
                                    </div>
                                    ${activeParticipants.length === 0 ? `
                                        <div class="empty-list">
                                            <i class="fas fa-users-slash"></i>
                                            <p>Brak uczestników</p>
                                            <p class="empty-subtitle">Zachęć uczestników do rejestracji!</p>
                                        </div>
                                    ` : `
                                        <div class="table-container">
                                            <table class="participants-table">
                                                <thead>
                                                    <tr>
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
                                                            <td>
                                                                <div class="participant-info">
                                                                    <div class="participant-avatar small" style="background: ${p.avatarColor || '#667eea'}">
                                                                        <i class="fas fa-user"></i>
                                                                    </div>
                                                                    <div>
                                                                        <strong>${p.username}</strong>
                                                                        ${p.age ? `<div class="participant-age">${p.age} lat</div>` : ''}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>${p.email}</td>
                                                            <td>
                                                                <span class="gender-badge ${p.gender}">
                                                                    <i class="fas fa-${p.gender === 'male' ? 'mars' : p.gender === 'female' ? 'venus' : 'neuter'}"></i>
                                                                    ${p.gender === 'male' ? 'M' : p.gender === 'female' ? 'K' : 'I'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                ${p.interested?.map(i => 
                                                                    `<span class="interest-tag ${i}">
                                                                        <i class="fas fa-${i === 'male' ? 'mars' : i === 'female' ? 'venus' : 'neuter'}"></i>
                                                                        ${i === 'male' ? 'M' : i === 'female' ? 'K' : 'I'}
                                                                    </span>`
                                                                ).join('') || '-'}
                                                            </td>
                                                            <td>
                                                                <span class="status-badge success">
                                                                    <i class="fas fa-check-circle"></i> Aktywny
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="pairings-tab">
                                <div class="pairings-container">
                                    <div class="section-header">
                                        <h3><i class="fas fa-chair"></i> Stoliki - Runda ${eventData.currentRound || 1}</h3>
                                        <div class="header-actions">
                                            <button class="btn btn-sm btn-primary" id="refresh-pairings">
                                                <i class="fas fa-sync"></i> Odśwież
                                            </button>
                                        </div>
                                    </div>
                                    
                                    ${eventData.pairings && eventData.pairings[eventData.currentRound - 1] && eventData.pairings[eventData.currentRound - 1].pairs?.length > 0 ? `
                                        <div class="pairings-stats">
                                            <div class="stat-item">
                                                <i class="fas fa-chair"></i>
                                                <span>Stolików: <strong>${eventData.pairings[eventData.currentRound - 1].pairs.length}</strong></span>
                                            </div>
                                            <div class="stat-item">
                                                <i class="fas fa-users"></i>
                                                <span>Osób w parach: <strong>${eventData.pairings[eventData.currentRound - 1].pairs.length * 2}</strong></span>
                                            </div>
                                            <div class="stat-item">
                                                <i class="fas fa-coffee"></i>
                                                <span>Na przerwie: <strong>${eventData.pairings[eventData.currentRound - 1].breakTable?.length || 0}</strong></span>
                                            </div>
                                        </div>
                                        
                                        <div class="pairings-grid">
                                            ${eventData.pairings[eventData.currentRound - 1].pairs.map((pair, index) => {
                                                const [user1, user2] = pair;
                                                return `
                                                    <div class="pairing-card">
                                                        <div class="pairing-header">
                                                            <h4><i class="fas fa-chair"></i> Stolik ${index + 1}</h4>
                                                            <span class="pairing-round">Runda ${eventData.currentRound}</span>
                                                        </div>
                                                        <div class="pairing-participants">
                                                            <div class="participant">
                                                                <div class="participant-avatar" style="background: ${user1.avatarColor || '#667eea'}">
                                                                    <i class="fas fa-user"></i>
                                                                </div>
                                                                <div class="participant-info">
                                                                    <strong>${user1.username}</strong>
                                                                    <div class="participant-details">
                                                                        <span class="gender">
                                                                            <i class="fas fa-${user1.gender === 'male' ? 'mars' : user1.gender === 'female' ? 'venus' : 'neuter'}"></i>
                                                                            ${user1.gender === 'male' ? 'Mężczyzna' : user1.gender === 'female' ? 'Kobieta' : 'Inna'}
                                                                        </span>
                                                                    </div>
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
                                                                    <div class="participant-details">
                                                                        <span class="gender">
                                                                            <i class="fas fa-${user2.gender === 'male' ? 'mars' : user2.gender === 'female' ? 'venus' : 'neuter'}"></i>
                                                                            ${user2.gender === 'male' ? 'Mężczyzna' : user2.gender === 'female' ? 'Kobieta' : 'Inna'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                        
                                        ${eventData.pairings[eventData.currentRound - 1].breakTable?.length > 0 ? `
                                            <div class="break-section">
                                                <h4><i class="fas fa-coffee"></i> Osoby na przerwie (${eventData.pairings[eventData.currentRound - 1].breakTable.length})</h4>
                                                <div class="break-list">
                                                    ${eventData.pairings[eventData.currentRound - 1].breakTable.map(user => `
                                                        <div class="break-user">
                                                            <div class="break-user-avatar" style="background: ${user.avatarColor || '#94a3b8'}">
                                                                <i class="fas fa-user"></i>
                                                            </div>
                                                            <span>${user.username}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    ` : `
                                        <div class="empty-pairings">
                                            <i class="fas fa-random"></i>
                                            <h4>Brak wygenerowanych par</h4>
                                            <p>Kliknij "Generuj pary" aby utworzyć pary dla uczestników</p>
                                            <button class="btn btn-primary" id="generate-pairs-now">
                                                <i class="fas fa-random"></i> Generuj pary
                                            </button>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="ratings-tab">
                                <div class="ratings-container">
                                    <div class="section-header">
                                        <h3><i class="fas fa-star"></i> Wszystkie oceny</h3>
                                        <span class="badge">${eventData.ratings?.length || 0} ocen</span>
                                    </div>
                                    
                                    ${eventData.ratings?.length > 0 ? `
                                        <div class="ratings-stats">
                                            <div class="stat-badge success">
                                                <i class="fas fa-thumbs-up"></i>
                                                <span>TAK: ${eventData.ratings.filter(r => r.rating === 'yes').length}</span>
                                            </div>
                                            <div class="stat-badge danger">
                                                <i class="fas fa-thumbs-down"></i>
                                                <span>NIE: ${eventData.ratings.filter(r => r.rating === 'no').length}</span>
                                            </div>
                                            <div class="stat-badge warning">
                                                <i class="fas fa-percentage"></i>
                                                <span>Pozytywnych: ${Math.round((eventData.ratings.filter(r => r.rating === 'yes').length / eventData.ratings.length) * 100)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div class="table-container">
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
                                                    ${eventData.ratings.slice(-20).reverse().map(rating => {
                                                        const fromUser = participants.find(p => p && p.id === rating.from);
                                                        const toUser = participants.find(p => p && p.id === rating.to);
                                                        const ratingDate = new Date(rating.timestamp);
                                                        
                                                        return `
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
                                                                        <i class="fas fa-${rating.rating === 'yes' ? 'thumbs-up' : 'thumbs-down'}"></i>
                                                                        ${rating.rating === 'yes' ? 'TAK' : 'NIE'}
                                                                    </span>
                                                                </td>
                                                                <td>${rating.round}</td>
                                                                <td>${ratingDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                            </tr>
                                                        `;
                                                    }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    ` : `
                                        <div class="empty-ratings">
                                            <i class="fas fa-star"></i>
                                            <h4>Brak ocen</h4>
                                            <p>Uczestnicy jeszcze nie oceniali rozmówców</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="export-tab">
                                <div class="export-container">
                                    <div class="section-header">
                                        <h3><i class="fas fa-download"></i> Eksport danych</h3>
                                    </div>
                                    
                                    <div class="export-cards">
                                        <div class="export-card">
                                            <div class="export-icon">
                                                <i class="fas fa-file-code"></i>
                                            </div>
                                            <h4>Eksport JSON</h4>
                                            <p>Pełne dane w formacie JSON</p>
                                            <button class="btn btn-primary" id="export-json">
                                                <i class="fas fa-download"></i> Pobierz JSON
                                            </button>
                                        </div>
                                        
                                        <div class="export-card">
                                            <div class="export-icon">
                                                <i class="fas fa-file-excel"></i>
                                            </div>
                                            <h4>Eksport Excel</h4>
                                            <p>Dane uczestników w Excelu</p>
                                            <button class="btn btn-success" id="export-excel">
                                                <i class="fas fa-download"></i> Pobierz Excel
                                            </button>
                                        </div>
                                        
                                        <div class="export-card">
                                            <div class="export-icon">
                                                <i class="fas fa-trash"></i>
                                            </div>
                                            <h4>Czyszczenie</h4>
                                            <p>Usuń wszystkie dane</p>
                                            <button class="btn btn-danger" id="clear-data">
                                                <i class="fas fa-trash-alt"></i> Wyczyść dane
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="export-info">
                                        <p><i class="fas fa-info-circle"></i> Dane są automatycznie zapisywane w przeglądarce</p>
                                        <p><i class="fas fa-database"></i> Rozmiar danych: ${Math.round((JSON.stringify(participants).length + JSON.stringify(eventData).length) / 1024)} KB</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-footer">
                        <p><i class="fas fa-code"></i> Speed Dating Pro v${CONFIG.VERSION} | Panel administratora</p>
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

        // Generuj pary z pustego ekranu
        document.getElementById('generate-pairs-now')?.addEventListener('click', () => {
            this.generateSmartPairings();
            this.updateAdminPanel();
        });

        // Odśwież pary
        document.getElementById('refresh-pairings')?.addEventListener('click', () => {
            this.updateAdminPanel();
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

    // ========== ZARZĄDZANIE WYDARZENIEM ==========
    startEvent() {
        const activeParticipants = participants.filter(p => p && p.active !== false);
        
        if (activeParticipants.length < CONFIG.MIN_PARTICIPANTS) {
            this.showNotification(`Potrzeba co najmniej ${CONFIG.MIN_PARTICIPANTS} uczestników!`, 'error');
            return;
        }
        
        if (confirm(`Rozpocząć wydarzenie z ${activeParticipants.length} uczestnikami?`)) {
            this.generateSmartPairings();
            
            eventData.status = 'active';
            eventData.currentRound = 1;
            eventData.startedAt = new Date().toISOString();
            
            this.saveData();
            this.startMainTimer();
            
            this.showNotification(`Wydarzenie rozpoczęte! ${activeParticipants.length} uczestników.`, 'success');
            this.updateAdminPanel();
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
            
            // Ogranicz wartości
            eventData.roundTime = Math.max(CONFIG.MIN_ROUND_TIME, Math.min(CONFIG.MAX_ROUND_TIME, eventData.roundTime));
            eventData.totalRounds = Math.min(CONFIG.MAX_ROUNDS, eventData.totalRounds);
            
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
        if (confirm('CZY NA PEWNO CHCESZ USUNĄĆ WSZYSTKIE DANE?\n\nTo usunie wszystkich uczestników, oceny i dane wydarzenia. Tej operacji nie można cofnąć!')) {
            localStorage.removeItem('speedDatingParticipants');
            localStorage.removeItem('speedDatingEvent');
            localStorage.removeItem('currentSessionId');
            
            participants = [];
            eventData = this.getDefaultEventData();
            currentUser = null;
            
            this.showNotification('Wszystkie dane zostały usunięte!', 'warning');
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
            
            for (let round = 1; round <= eventData.totalRounds; round++) {
                const roundPairings = {
                    round: round,
                    pairs: [],
                    breakTable: []
                };

                const shuffled = [...activeParticipants].sort(() => Math.random() - 0.5);
                const pairedIds = new Set();

                for (let i = 0; i < shuffled.length; i++) {
                    if (pairedIds.has(shuffled[i].id)) continue;

                    let foundPartner = false;
                    for (let j = i + 1; j < shuffled.length; j++) {
                        if (pairedIds.has(shuffled[j].id)) continue;

                        const pairKey = [shuffled[i].id, shuffled[j].id].sort().join('_');
                        if (usedPairs.has(pairKey) && !eventData.settings?.allowRepeats) {
                            continue;
                        }

                        roundPairings.pairs.push([shuffled[i], shuffled[j]]);
                        pairedIds.add(shuffled[i].id);
                        pairedIds.add(shuffled[j].id);
                        usedPairs.add(pairKey);
                        foundPartner = true;
                        break;
                    }

                    if (!foundPartner && i < shuffled.length - 1) {
                        for (let j = 0; j < i; j++) {
                            if (!pairedIds.has(shuffled[j].id)) {
                                const pairKey = [shuffled[i].id, shuffled[j].id].sort().join('_');
                                if (usedPairs.has(pairKey) && !eventData.settings?.allowRepeats) {
                                    continue;
                                }
                                
                                roundPairings.pairs.push([shuffled[i], shuffled[j]]);
                                pairedIds.add(shuffled[i].id);
                                pairedIds.add(shuffled[j].id);
                                usedPairs.add(pairKey);
                                break;
                            }
                        }
                    }
                }

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
        
        const ratePerson = document.getElementById('rate-person');
        if (ratePerson) ratePerson.textContent = partner.username;
        
        this.initializeRatingScreen();
    }

    initializeRatingScreen() {
        let selectedRating = null;
        
        document.querySelectorAll('.rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedRating = btn.dataset.rating;
            });
        });
        
        const submitBtn = document.getElementById('submit-rating');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitRating(selectedRating);
            });
        }
    }

    submitRating(rating) {
        if (!rating || !currentPartner || !currentUser) {
            this.showNotification('Wybierz ocenę!', 'error');
            return;
        }

        const note = document.getElementById('rating-note')?.value || '';
        
        if (!currentUser.ratings) currentUser.ratings = {};
        currentUser.ratings[currentPartner.id] = {
            rating: rating,
            note: note,
            round: eventData.currentRound || 1,
            timestamp: new Date().toISOString()
        };

        if (!eventData.ratings) eventData.ratings = [];
        eventData.ratings.push({
            from: currentUser.id,
            to: currentPartner.id,
            rating: rating,
            round: eventData.currentRound || 1,
            timestamp: new Date().toISOString()
        });

        const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
        if (userIndex !== -1) {
            participants[userIndex] = currentUser;
        }

        this.saveData();
        
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
            
            const filename = `speed-dating-${new Date().toISOString().slice(0,10)}-${Date.now()}`;
            
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
            const participantsData = data.participants.map(p => ({
                'ID': p.id,
                'Nazwa użytkownika': p.username,
                'Email': p.email,
                'Płeć': p.gender === 'male' ? 'Mężczyzna' : p.gender === 'female' ? 'Kobieta' : 'Inna',
                'Wiek': p.age || 'Nie podano',
                'Szuka': p.interested?.map(i => 
                    i === 'male' ? 'Mężczyzn' : i === 'female' ? 'Kobiet' : 'Innych'
                ).join(', ') || 'Nie określono',
                'Data dołączenia': new Date(p.joinedAt).toLocaleString(),
                'Status': p.active ? 'Aktywny' : 'Nieaktywny'
            }));
            
            const wb = XLSX.utils.book_new();
            const wsParticipants = XLSX.utils.json_to_sheet(participantsData);
            XLSX.utils.book_append_sheet(wb, wsParticipants, 'Uczestnicy');
            
            XLSX.writeFile(wb, `${filename}.xlsx`);
            
            this.showNotification('Dane wyeksportowane jako Excel!', 'success');
            
        } catch (error) {
            console.error('Błąd eksportu Excel:', error);
            this.showNotification('Błąd eksportu do Excel! Sprawdź czy biblioteka XLSX jest załadowana.', 'error');
        }
    }

    // ========== SYSTEM POWIADOMIEŃ ==========
    showNotification(message, type = 'info') {
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
        heartbeatTimer = setInterval(() => {
            if (currentUser) {
                this.updateUserLastSeen();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);
    }

    updateUserLastSeen() {
        if (currentUser) {
            currentUser.lastSeen = new Date().toISOString();
            
            const userIndex = participants.findIndex(p => p && p.id === currentUser.id);
            if (userIndex !== -1) {
                participants[userIndex] = currentUser;
                this.saveData();
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
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.mode-select-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const mode = btn.dataset.mode;
                    this.handleModeSelection(mode);
                });
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
            sessionId: 'demo_session_' + Date.now(),
            avatarColor: '#667eea'
        };
        
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
            },
            {
                username: 'PiotrWiśniewski',
                email: 'piotr@example.com',
                gender: 'male',
                interested: ['female'],
                age: 32,
                bio: 'Programista, fan górskich wędrówek',
                avatarColor: '#48bb78'
            },
            {
                username: 'MagdalenaLewandowska',
                email: 'magda@example.com',
                gender: 'female',
                interested: ['male'],
                age: 29,
                bio: 'Lekarka, uwielbiam taniec i podróże',
                avatarColor: '#ed8936'
            }
        ];

        demoUsers.forEach(demoUser => {
            const existing = participants.find(p => p && p.email === demoUser.email);
            
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
