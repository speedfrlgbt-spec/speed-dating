// ============================================
// SPEED DATING PRO - ZAAWANSOWANA APLIKACJA
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
        toastr.options = {
            positionClass: 'toast-top-right',
            progressBar: true,
            timeOut: 3000,
            closeButton: true
        };

        this.loadData();
        this.setupEventListeners();
        this.startHeartbeat();
        
        // Pokaż ekran ładowania
        this.showLoadingScreen();
        
        // Symulacja ładowania
        setTimeout(() => {
            this.detectRole();
        }, 1000);
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
            
            // Sprawdź sesję użytkownika
            const sessionId = localStorage.getItem('currentSessionId');
            if (sessionId) {
                currentUser = participants.find(p => p && p.sessionId === sessionId);
                
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

        // Obsługa przycisków nawigacji
        document.querySelectorAll('.btn-next').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextStep = parseInt(btn.dataset.next);
                if (this.validateStep(nextStep - 1)) {
                    this.showStep(nextStep);
                }
            });
        });

        document.querySelectorAll('.btn-back-step').forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.prev);
                this.showStep(prevStep);
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
            p && p.username.toLowerCase() === username.toLowerCase()
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
                sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                avatarColor: this.getRandomColor()
            };

            participants.push(userData);
            currentUser = userData;
            this.saveData();

            this.showNotification('Rejestracja zakończona sukcesem!', 'success');
            localStorage.setItem('currentSessionId', userData.sessionId);
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
    }

    updateUserInterface() {
        // Aktualizuj nagłówek
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) userNameElement.textContent = currentUser.username;
        
        // Przycisk wylogowania
        document.getElementById('user-logout').addEventListener('click', () => {
            this.handleLogout();
        });
        
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
        document.getElementById('admin-panel').classList.add('active');
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
                                <div class="stat-icon admin">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Uczestnicy</h3>
                                    <div class="stat-value">${activeParticipants.length}/${CONFIG.MAX_PARTICIPANTS}</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="fas fa-handshake"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Status</h3>
                                    <div class="stat-value">${eventData.status === 'active' ? 'Aktywny' : 'Oczekuje'}</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="fas fa-coffee"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Aktualna runda</h3>
                                    <div class="stat-value">${eventData.currentRound || 1}</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon info">
                                    <i class="fas fa-star"></i>
                                </div>
                                <div class="stat-content">
                                    <h3>Oceny</h3>
                                    <div class="stat-value">${eventData.ratings?.length || 0}</div>
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
                    </div>
                    
                    <div class="admin-tabs">
                        <div class="tab-buttons">
                            <button class="tab-btn active" data-tab="participants">
                                <i class="fas fa-users"></i> Uczestnicy
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
                                                            <span class="status-badge success">
                                                                Aktywny
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
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
                                </div>
                            </div>
                        </div>
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

                    for (let j = i + 1; j < shuffled.length; j++) {
                        if (pairedIds.has(shuffled[j].id)) continue;

                        roundPairings.pairs.push([shuffled[i], shuffled[j]]);
                        pairedIds.add(shuffled[i].id);
                        pairedIds.add(shuffled[j].id);
                        break;
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
        
        document.getElementById('rating-screen').classList.add('active');
        
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
        
        document.getElementById('submit-rating').addEventListener('click', () => {
            this.submitRating(selectedRating);
        });
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
            
            const filename = `speed-dating-${new Date().toISOString().slice(0,10)}`;
            
            if (format === 'json') {
                this.exportJSON(exportData, filename);
            } else if (format === 'excel') {
                this.exportExcel(exportData, filename);
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
            
            const wb = XLSX.utils.book_new();
            const wsParticipants = XLSX.utils.json_to_sheet(participantsData);
            XLSX.utils.book_append_sheet(wb, wsParticipants, 'Uczestnicy');
            
            XLSX.writeFile(wb, `${filename}.xlsx`);
            
            this.showNotification('Dane wyeksportowane jako Excel!', 'success');
            
        } catch (error) {
            console.error('Błąd eksportu Excel:', error);
            this.showNotification('Błąd eksportu do Excel!', 'error');
        }
    }

    // ========== SYSTEM POWIADOMIEŃ ==========
    showNotification(message, type = 'info') {
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
    }

    // ========== SYSTEM POŁĄCZENIA ==========
    startHeartbeat() {
        heartbeatTimer = setInterval(() => {
            this.updateConnectionStatus();
            
            if (currentUser) {
                this.updateUserLastSeen();
            }
        }, CONFIG.HEARTBEAT_INTERVAL);
    }

    updateConnectionStatus() {
        connectionStatus = Math.random() > 0.1;
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
            sessionId: 'demo_session',
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
