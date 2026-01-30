// 🚀 APPLICATION PRINCIPALE GAME-MARCUS
class GameMarcusApp {
    constructor() {
        console.log('🎮 Initialisation Game-Marcus...');
        this.db = new SupabaseDatabase();
        this.currentUser = null;
        this.init();
    }

    init() {
        console.log('🔧 Initialisation application...');
        this.checkAutoLogin();
        this.setupEventListeners();
        this.loadBasicData();
        this.updateUI();
    }

    checkAutoLogin() {
        try {
            const savedUser = localStorage.getItem('current_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                console.log('✅ Utilisateur auto-connecté:', this.currentUser.username);
            }
        } catch (e) {
            console.error('Erreur auto-login:', e);
            localStorage.removeItem('current_user');
        }
    }

    setupEventListeners() {
        console.log('🔧 Configuration des écouteurs...');
        
        // Fonction pour attacher les écouteurs
        const attachListeners = () => {
            // Inscription
            const registerForm = document.getElementById('registerForm');
            if (registerForm) {
                registerForm.onsubmit = null; // Supprimer les anciens
                registerForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📝 Formulaire inscription soumis');
                    this.register();
                    return false;
                });
            }

            // Connexion
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.onsubmit = null; // Supprimer les anciens
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔑 Formulaire connexion soumis');
                    this.login();
                    return false;
                });
            }
        };

        // Attendre que le DOM soit prêt
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachListeners);
        } else {
            attachListeners();
        }
    }

    async register() {
        console.log('🔄 Début inscription...');
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        console.log('Données saisies:', { username, email, password });

        if (!username || !email || !password) {
            this.showNotification('❌ Tous les champs sont requis', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('❌ Le mot de passe doit faire au moins 6 caractères', 'error');
            return;
        }

        this.showNotification('🔄 Création du compte en cours...', 'info');

        const result = await this.db.createUser(username, email, password);

        console.log('Résultat création:', result);

        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            this.showNotification(`✅ Bienvenue ${username} ! 10 tickets offerts 🎉`, 'success');
            this.updateUI();
            this.loadBasicData();
            
            // Réinitialiser le formulaire
            document.getElementById('registerForm').reset();
            
            // Basculer vers connexion
            setTimeout(() => {
                this.switchToLoginTab();
            }, 1500);
            
        } else {
            this.showNotification(`❌ ${result.error}`, 'error');
        }
    }

    switchToLoginTab() {
        const loginTabBtn = document.querySelector('.tab-btn:nth-child(2)');
        const loginTab = document.getElementById('loginTab');
        const registerTabBtn = document.querySelector('.tab-btn:nth-child(1)');
        const registerTab = document.getElementById('registerTab');
        
        if (loginTabBtn && loginTab && registerTabBtn && registerTab) {
            registerTabBtn.classList.remove('active');
            registerTab.classList.remove('active');
            loginTabBtn.classList.add('active');
            loginTab.classList.add('active');
        }
    }

    async login() {
        console.log('🔄 Début connexion...');
        
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('❌ Email et mot de passe requis', 'error');
            return;
        }

        this.showNotification('🔄 Connexion en cours...', 'info');

        const result = await this.db.loginUser(email, password);

        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            this.showNotification(`✅ Bon retour ${result.user.username} !`, 'success');
            this.updateUI();
            this.loadBasicData();
            
            document.getElementById('loginForm').reset();
        } else {
            this.showNotification(`❌ ${result.error}`, 'error');
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('current_user');
        this.showNotification('👋 À bientôt !', 'info');
        this.updateUI();
        this.loadBasicData(); // Recharger pour montrer mode non connecté
    }

    async loadBasicData() {
        try {
            // Charger les concours
            const contestsResult = await this.db.getContests();
            if (contestsResult.success) {
                this.renderContests(contestsResult.data);
            }

            // Charger les stats
            const statsResult = await this.db.getStatistics();
            if (statsResult.success) {
                this.updateStats(statsResult.data);
            }
        } catch (error) {
            console.error('Erreur chargement données:', error);
        }
    }

    updateUI() {
        console.log('🔄 Mise à jour interface...');
        
        const userSection = document.getElementById('userSection');
        const authBox = document.getElementById('authBox');
        const participationsSection = document.getElementById('myParticipations');

        if (this.currentUser) {
            console.log('Mode connecté pour:', this.currentUser.username);
            
            userSection.innerHTML = `
                <div class="user-info">
                    <i class="fas fa-user"></i>
                    <span>${this.currentUser.username}</span>
                    <div class="ticket-count">
                        <i class="fas fa-ticket-alt"></i>
                        ${this.currentUser.tickets || 10} tickets
                    </div>
                </div>
                <button class="btn-logout" onclick="app.logout()">
                    <i class="fas fa-sign-out-alt"></i> Déconnexion
                </button>
            `;
            
            if (authBox) authBox.style.display = 'none';
            if (participationsSection) {
                participationsSection.style.display = 'block';
            }
        } else {
            console.log('Mode non connecté');
            if (userSection) userSection.innerHTML = '';
            if (authBox) authBox.style.display = 'block';
            if (participationsSection) {
                participationsSection.style.display = 'none';
            }
        }
    }

    renderContests(contests) {
        const container = document.getElementById('contestsGrid');
        if (!container) return;

        if (!contests || contests.length === 0) {
            container.innerHTML = '<p class="empty">Aucun concours disponible</p>';
            return;
        }

        container.innerHTML = contests.map(contest => {
            const canParticipate = this.currentUser && (this.currentUser.tickets >= contest.tickets_required);
            const userTickets = this.currentUser ? this.currentUser.tickets : 0;

            return `
                <div class="contest-card">
                    <h3><i class="fas fa-gift"></i> ${contest.name}</h3>
                    <p class="contest-description">${contest.description}</p>
                    <div class="prize-badge">🎁 ${contest.prize}</div>
                    <div class="contest-stats">
                        <span><i class="fas fa-users"></i> ${contest.participants || 0} participants</span>
                        <span><i class="fas fa-ticket-alt"></i> ${contest.tickets_required} ticket(s)</span>
                    </div>
                    <button class="participate-btn" 
                            onclick="${this.currentUser ? `app.participate(${contest.id})` : `app.showLoginMessage()`}"
                            ${this.currentUser && !canParticipate ? 'disabled' : ''}>
                        <i class="fas fa-ticket-alt"></i>
                        ${this.currentUser ? 
                            (canParticipate ? 
                                `Participer (${contest.tickets_required} ticket(s))` : 
                                `Pas assez de tickets (${userTickets}/${contest.tickets_required})`) : 
                            'Connectez-vous pour participer'}
                    </button>
                </div>
            `;
        }).join('');
    }

    updateStats(stats) {
        if (document.getElementById('totalUsers')) {
            document.getElementById('totalUsers').textContent = stats.totalUsers;
        }
        if (document.getElementById('totalPrizes')) {
            document.getElementById('totalPrizes').textContent = stats.totalContests;
        }
        if (document.getElementById('totalWinners')) {
            document.getElementById('totalWinners').textContent = stats.totalWinners;
        }
    }

    showLoginMessage() {
        this.showNotification('🔑 Connectez-vous pour participer aux concours', 'info');
    }

    async participate(contestId) {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous pour participer', 'error');
            return;
        }

        this.showNotification('🔄 Participation en cours...', 'info');
        
        // Simuler une participation
        setTimeout(() => {
            this.showNotification('🎫 Participation enregistrée ! Bonne chance !', 'success');
        }, 1000);
    }

    // 🔔 NOTIFICATIONS
    showNotification(message, type = 'info') {
        console.log('Notification:', { message, type });
        
        const notification = document.getElementById('notification');
        if (!notification) {
            console.error('Élément notification non trouvé');
            // Créer une notification temporaire
            alert(message);
            return;
        }

        let icon = '💡';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'info') icon = 'ℹ️';

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">${icon}</span>
                <span>${message}</span>
            </div>
        `;

        notification.style.background = type === 'success' 
            ? 'linear-gradient(135deg, #00b09b, #96c93d)' 
            : type === 'error'
            ? 'linear-gradient(135deg, #ff416c, #ff4b2b)'
            : 'linear-gradient(135deg, #00dbde, #fc00ff)';

        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 4000);
    }
}

// ==================== INITIALISATION ====================
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM chargé, démarrage application...');
    app = new GameMarcusApp();
    window.app = app;
    console.log('✅ Application initialisée');
});

// ==================== FONCTIONS GLOBALES ====================
function showTab(tabName) {
    if (event) event.preventDefault();
    
    // Désactiver tous les onglets
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activer l'onglet cliqué
    const targetTab = event.target;
    if (targetTab && targetTab.classList.contains('tab-btn')) {
        targetTab.classList.add('active');
    }
    
    const activeTabContent = document.getElementById(tabName + 'Tab');
    if (activeTabContent) activeTabContent.classList.add('active');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showTerms() {
    showModal('termsModal');
}
