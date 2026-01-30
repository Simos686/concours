// 🚀 APPLICATION PRINCIPALE GAME-MARCUS
class GameMarcusApp {
    constructor() {
        console.log('🎮 Initialisation Game-Marcus...');
        this.db = new SupabaseDatabase();
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Vérifier la connexion Supabase
        await initSupabaseTables();
        
        this.checkAutoLogin();
        this.setupEventListeners();
        await this.loadGlobalStats();
        await this.loadContests();
        await this.loadActions();
        await this.loadWinners();
        this.updateUI();
    }

    checkAutoLogin() {
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('✅ Utilisateur auto-connecté:', this.currentUser.username);
            } catch (e) {
                localStorage.removeItem('current_user');
            }
        }
    }

    setupEventListeners() {
        // Inscription
        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.register();
        });
        
        // Connexion
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });
        
        // Formulaire admin
        document.getElementById('adminContestForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addNewContest();
        });
    }

    async register() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        if (!username || !email || !password) {
            this.showNotification('❌ Tous les champs sont requis');
            return;
        }

        if (password.length < 6) {
            this.showNotification('❌ Le mot de passe doit faire au moins 6 caractères');
            return;
        }

        this.showNotification('🔄 Création du compte en cours...', 'info');

        const result = await this.db.createUser(username, email, password);

        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            this.showNotification(`✅ Bienvenue ${username} ! 10 tickets offerts 🎉`, 'success');
            this.updateUI();
            await this.loadGlobalStats();
            await this.loadContests();
            
            document.getElementById('registerForm').reset();
            showTab('login');
        } else {
            this.showNotification(`❌ ${result.error}`, 'error');
        }
    }

    async login() {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('❌ Email et mot de passe requis');
            return;
        }

        this.showNotification('🔄 Connexion en cours...', 'info');

        const result = await this.db.loginUser(email, password);

        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            this.showNotification(`✅ Bon retour ${result.user.username} !`, 'success');
            this.updateUI();
            await this.loadGlobalStats();
            await this.loadContests();
            await this.loadUserParticipations();
            
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
    }

    async updateUI() {
        const userSection = document.getElementById('userSection');
        const authBox = document.getElementById('authBox');
        const participationsSection = document.getElementById('myParticipations');

        if (this.currentUser) {
            // Mode connecté
            userSection.innerHTML = `
                <div class="user-info">
                    <i class="fas fa-user"></i>
                    <span>${this.currentUser.username}</span>
                    <div class="ticket-count">
                        <i class="fas fa-ticket-alt"></i>
                        ${this.currentUser.tickets} tickets
                    </div>
                </div>
                <button class="btn-logout" onclick="app.logout()">
                    <i class="fas fa-sign-out-alt"></i> Déconnexion
                </button>
            `;
            
            authBox.style.display = 'none';
            participationsSection.style.display = 'block';
            
            await this.updateUserStats();
            await this.loadUserParticipations();
        } else {
            // Mode non connecté
            userSection.innerHTML = '';
            authBox.style.display = 'block';
            participationsSection.style.display = 'none';
        }
    }

    async updateUserStats() {
        if (!this.currentUser) return;

        const participations = await this.db.getUserParticipations(this.currentUser.id);
        const participationCount = participations.success ? participations.data.length : 0;
        
        // Calculer les chances de gagner
        let winChance = 0;
        if (participationCount > 0) {
            // Simulation simple
            winChance = Math.min(participationCount * 2, 50);
        }

        document.getElementById('userTickets').textContent = this.currentUser.tickets;
        document.getElementById('userParticipations').textContent = participationCount;
        document.getElementById('userWinChance').textContent = `${winChance}%`;
    }

    async loadGlobalStats() {
        const stats = await this.db.getStatistics();
        
        if (stats.success) {
            document.getElementById('totalUsers').textContent = stats.data.totalUsers;
            document.getElementById('totalPrizes').textContent = stats.data.totalContests;
            document.getElementById('totalWinners').textContent = stats.data.totalWinners;
        }
    }

    async loadContests() {
        const result = await this.db.getContests();
        
        if (result.success && result.data) {
            this.renderContests(result.data);
        } else {
            // Fallback aux concours par défaut
            const defaultContests = [
                {
                    id: 1,
                    name: "🎮 PlayStation 5 Slim + 3 jeux",
                    description: "PS5 Slim édition 2023 avec FIFA 24, Spider-Man 2 et God of War Ragnarok",
                    prize: "Console PS5 + Jeux",
                    tickets_required: 1,
                    participants: 0,
                    status: "active"
                },
                {
                    id: 2,
                    name: "📱 iPhone 15 Pro Max 256GB",
                    description: "iPhone 15 Pro Max 256GB - Dernier modèle Apple avec Dynamic Island",
                    prize: "Smartphone iPhone 15",
                    tickets_required: 1,
                    participants: 0,
                    status: "active"
                }
            ];
            this.renderContests(defaultContests);
        }
    }

    renderContests(contests) {
        const container = document.getElementById('contestsGrid');
        if (!container) return;

        container.innerHTML = contests.map(contest => {
            const canParticipate = this.currentUser && this.currentUser.tickets >= contest.tickets_required;
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
                            onclick="app.participate('${contest.id}')"
                            ${canParticipate ? '' : 'disabled'}>
                        <i class="fas fa-ticket-alt"></i>
                        ${canParticipate ? 
                            `Participer (${contest.tickets_required} ticket(s))` : 
                            `Pas assez de tickets (${userTickets}/${contest.tickets_required})`}
                    </button>
                </div>
            `;
        }).join('');
    }

    async participate(contestId) {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous pour participer', 'error');
            return;
        }

        const contestResult = await this.db.getContestById(contestId);
        if (!contestResult.success) {
            this.showNotification('❌ Concours introuvable', 'error');
            return;
        }

        const contest = contestResult.data;

        if (contest.status !== 'active') {
            this.showNotification('❌ Ce concours est terminé', 'error');
            return;
        }

        // Demander confirmation
        if (!confirm(`Participer avec ${contest.tickets_required} ticket(s) ?`)) {
            return;
        }

        this.showNotification('🔄 Participation en cours...', 'info');

        const result = await this.db.participate(this.currentUser.id, contestId);

        if (result.success) {
            // Mettre à jour l'utilisateur local
            const userResult = await this.db.getUserById(this.currentUser.id);
            if (userResult.success) {
                this.currentUser = userResult.data;
                localStorage.setItem('current_user', JSON.stringify(userResult.data));
            }

            this.showNotification(
                `🎫 Participation enregistrée ! ${result.ticketsUsed} ticket(s) utilisés. Bonne chance ! 🍀`,
                'success'
            );

            this.updateUI();
            await this.loadContests();
            await this.loadUserParticipations();
            await this.loadGlobalStats();
        } else {
            this.showNotification(`❌ ${result.error}`, 'error');
        }
    }

    async loadActions() {
        // Actions prédéfinies (pourrait aussi venir de Supabase)
        const actions = [
            { id: 1, name: "Regarder une vidéo", tickets: 2, daily_limit: 3, icon: "fas fa-video" },
            { id: 2, name: "Suivre Instagram", tickets: 3, daily_limit: 1, icon: "fab fa-instagram" },
            { id: 3, name: "Suivre TikTok", tickets: 3, daily_limit: 1, icon: "fab fa-tiktok" },
            { id: 4, name: "Parrainer un ami", tickets: 5, daily_limit: 10, icon: "fas fa-user-friends" }
        ];

        this.renderActions(actions);
    }

    renderActions(actions) {
        const container = document.getElementById('actionsGrid');
        if (!container) return;

        container.innerHTML = actions.map(action => {
            const canComplete = this.currentUser !== null;

            return `
                <div class="action-card">
                    <div class="action-icon">
                        <i class="${action.icon}"></i>
                    </div>
                    <h4>${action.name}</h4>
                    <p class="action-description">Gagnez des tickets facilement</p>
                    <div class="ticket-reward">
                        <i class="fas fa-plus"></i>${action.tickets}
                    </div>
                    <button class="earn-btn" 
                            onclick="app.earnTickets(${action.id}, ${action.tickets}, '${action.name}')"
                            ${canComplete ? '' : 'disabled'}>
                        <i class="fas fa-coins"></i>
                        ${canComplete ? `Gagner (+${action.tickets})` : `Connectez-vous`}
                    </button>
                </div>
            `;
        }).join('');
    }

    async earnTickets(actionId, tickets, actionName) {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous pour gagner des tickets', 'error');
            return;
        }

        this.showNotification('🔄 Ajout des tickets...', 'info');

        const result = await this.db.updateUserTickets(
            this.currentUser.id, 
            tickets, 
            `Action: ${actionName}`
        );

        if (result.success) {
            // Mettre à jour l'utilisateur local
            this.currentUser.tickets = result.newTicketCount;
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));

            this.showNotification(`✅ +${tickets} tickets ! Total: ${result.newTicketCount} 🎫`, 'success');
            this.updateUI();
            await this.loadContests();
            await this.loadGlobalStats();
        } else {
            this.showNotification(`❌ Erreur: ${result.error}`, 'error');
        }
    }

    async loadUserParticipations() {
        if (!this.currentUser) return;

        const result = await this.db.getUserParticipations(this.currentUser.id);
        
        if (result.success && result.data) {
            this.renderParticipations(result.data);
        }
    }

    renderParticipations(participations) {
        const container = document.getElementById('participationsList');
        if (!container) return;

        if (!participations || participations.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; opacity: 0.7;">
                    <i class="fas fa-calendar-plus fa-3x"></i>
                    <h4 style="margin: 15px 0 10px;">Aucune participation</h4>
                    <p>Participez à votre premier concours !</p>
                </div>
            `;
            return;
        }

        container.innerHTML = participations.map(p => `
            <div class="participation-item">
                <div class="participation-details">
                    <h4>${p.contests?.name || 'Concours'}</h4>
                    <p style="font-size: 0.9em; margin: 5px 0; color: #ccc;">
                        ${p.contests?.description || ''}
                    </p>
                    <small style="opacity: 0.7;">
                        ${new Date(p.created_at).toLocaleDateString('fr-FR')} • 
                        Prix: ${p.contests?.prize || 'N/A'}
                    </small>
                </div>
                <div class="participation-stats">
                    <div class="participation-tickets" style="background: rgba(0, 219, 222, 0.2); padding: 5px 15px; border-radius: 20px;">
                        ${p.tickets_used} ticket(s)
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadWinners() {
        const result = await this.db.getWinners(6);
        
        if (result.success && result.data) {
            this.renderWinners(result.data);
        }
    }

    renderWinners(winners) {
        const container = document.getElementById('winnersGrid');
        if (!container) return;

        if (!winners || winners.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <i class="fas fa-trophy fa-3x"></i>
                    <h4 style="margin: 15px 0 10px;">Aucun gagnant pour l'instant</h4>
                    <p>Soyez le premier à gagner !</p>
                </div>
            `;
            return;
        }

        container.innerHTML = winners.map(winner => `
            <div class="winner-card">
                <div class="winner-avatar" style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 2rem; color: white;">
                    <i class="fas fa-crown"></i>
                </div>
                <h4 class="winner-name">${winner.username}</h4>
                <p class="winner-prize" style="color: var(--accent);">${winner.prize}</p>
                <p class="winner-date" style="font-size: 0.9em; opacity: 0.7;">
                    ${new Date(winner.drawn_at).toLocaleDateString('fr-FR')}
                </p>
                <small style="font-size: 0.8em; opacity: 0.6;">${winner.tickets_used} ticket(s) utilisés</small>
            </div>
        `).join('');
    }

    // 🏆 TIRAGE DES GAGNANTS (ADMIN)
    async drawWinnersForAllContests() {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous', 'error');
            return;
        }

        // Vérifier si c'est l'admin (simple vérification)
        const isAdmin = this.currentUser.email === 'admin@gamemarcus.com';
        
        if (!isAdmin) {
            this.showNotification('❌ Accès réservé aux administrateurs', 'error');
            return;
        }

        if (!confirm('⚠️ Tirer les gagnants pour tous les concours actifs ?')) {
            return;
        }

        this.showNotification('🎲 Tirage en cours...', 'info');

        // Récupérer tous les concours actifs
        const contestsResult = await this.db.getContests();
        
        if (!contestsResult.success || !contestsResult.data) {
            this.showNotification('❌ Aucun concours actif', 'error');
            return;
        }

        const activeContests = contestsResult.data;
        let winners = [];

        for (const contest of activeContests) {
            const result = await this.db.drawWinner(contest.id);
            
            if (result.success) {
                winners.push(result.winner);
                this.showNotification(`✅ ${contest.name}: ${result.winner.username} a gagné !`, 'success');
            } else {
                this.showNotification(`❌ ${contest.name}: ${result.error}`, 'error');
            }
            
            // Pause pour éviter les requêtes trop rapides
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (winners.length > 0) {
            this.showNotification(`🎉 ${winners.length} gagnant(s) tiré(s) avec succès !`, 'success');
            await this.loadContests();
            await this.loadWinners();
            await this.loadGlobalStats();
        }
    }

    // 👨‍💼 PANEL ADMIN
    async showAdminPanel() {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous', 'error');
            return;
        }

        // Vérifier si c'est l'admin
        const isAdmin = this.currentUser.email === 'admin@gamemarcus.com';
        
        if (!isAdmin) {
            this.showNotification('❌ Accès réservé aux administrateurs', 'error');
            return;
        }

        // Charger les stats admin
        await this.loadAdminStats();
        showModal('adminModal');
    }

    async loadAdminStats() {
        const stats = await this.db.getStatistics();
        
        if (stats.success) {
            document.getElementById('adminUserCount').textContent = stats.data.totalUsers;
            document.getElementById('adminContestCount').textContent = stats.data.totalContests;
            
            // Récupérer le nombre de participations
            const allPartResult = await this.db.getAllParticipations();
            const participationCount = allPartResult.success ? allPartResult.data.length : 0;
            
            document.getElementById('adminParticipationCount').textContent = participationCount;
            document.getElementById('adminTicketCount').textContent = stats.data.totalTickets;
        }
    }

    async addNewContest() {
        if (!this.currentUser) return;

        const name = document.getElementById('contestName').value;
        const description = document.getElementById('contestDescription').value;
        const prize = document.getElementById('contestPrize').value;
        const tickets = document.getElementById('contestTickets').value;

        if (!name || !description || !prize || !tickets) {
            this.showNotification('❌ Tous les champs sont requis');
            return;
        }

        const result = await this.db.addContest(name, description, prize, tickets);

        if (result.success) {
            this.showNotification('✅ Concours ajouté avec succès !', 'success');
            document.getElementById('adminContestForm').reset();
            await this.loadContests();
            await this.loadAdminStats();
            closeModal('adminModal');
        } else {
            this.showNotification(`❌ Erreur: ${result.error}`, 'error');
        }
    }

    // 🔔 NOTIFICATIONS
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        // Icône selon le type
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

        // Couleur selon le type
        notification.style.background = type === 'success' 
            ? 'linear-gradient(135deg, #00b09b, #96c93d)' 
            : type === 'error'
            ? 'linear-gradient(135deg, #ff416c, #ff4b2b)'
            : 'linear-gradient(135deg, #00dbde, #fc00ff)';

        notification.style.display = 'block';

        // Cacher après 4 secondes
        setTimeout(() => {
            notification.style.display = 'none';
        }, 4000);
    }
}

// ==================== INITIALISATION ====================
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new GameMarcusApp();
    window.app = app;
});

// ==================== FONCTIONS GLOBALES ====================
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showTerms() {
    showModal('termsModal');
}

function showForgotPassword() {
    app.showNotification('ℹ️ Contactez l\'administrateur pour réinitialiser votre mot de passe', 'info');
}

// Pour la sauvegarde/export (facultatif)
function exportData() {
    app.showNotification('💾 Les données sont déjà sauvegardées en ligne !', 'info');
}

function importData() {
    app.showNotification('📂 Les données sont synchronisées automatiquement', 'info');
}

function resetData() {
    if (confirm('⚠️ Voulez-vous vraiment réinitialiser vos données locales ?')) {
        localStorage.removeItem('current_user');
        location.reload();
    }
}