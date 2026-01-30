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
        
        // Vérifier si c'est l'admin pour afficher/masquer le bouton
        this.checkAdminStatus();
    }

    checkAdminStatus() {
        if (this.currentUser && this.currentUser.email === 'admin@gamemarcus.com') {
            document.getElementById('drawWinnersBtn').style.display = 'block';
        } else {
            document.getElementById('drawWinnersBtn').style.display = 'none';
        }
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
        
        // Inscription
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.register();
                return false;
            });
        }

        // Connexion
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.login();
                return false;
            });
        }

        // Formulaire admin
        const adminContestForm = document.getElementById('adminContestForm');
        if (adminContestForm) {
            adminContestForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.addNewContest();
                return false;
            });
        }
    }

    async register() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

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

        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            this.showNotification(`✅ Bienvenue ${username} ! 10 tickets offerts 🎉`, 'success');
            this.updateUI();
            this.loadBasicData();
            
            document.getElementById('registerForm').reset();
            
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
            this.loadUserParticipations();
            
            // Vérifier si admin
            this.checkAdminStatus();
            
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
        this.loadBasicData();
    }

    async loadBasicData() {
        try {
            // Charger les concours
            const contestsResult = await this.db.getContests();
            if (contestsResult.success) {
                this.renderContests(contestsResult.data);
            }

            // Charger les stats DÉTAILLÉES
            const statsResult = await this.db.getStatistics();
            if (statsResult.success) {
                this.updateStats(statsResult.data);
                this.updateAdminStats(statsResult.data);
            }

            // Charger les gagnants
            const winnersResult = await this.db.getWinners();
            if (winnersResult.success) {
                this.renderWinners(winnersResult.data);
            }

            // Charger les actions
            this.loadActions();
        } catch (error) {
            console.error('Erreur chargement données:', error);
        }
    }

    async loadUserParticipations() {
        if (!this.currentUser) return;

        try {
            const result = await this.db.getUserParticipations(this.currentUser.id);
            
            if (result.success) {
                this.renderParticipations(result.data);
                this.updateUserStats(result.data);
            }
        } catch (error) {
            console.error('Erreur chargement participations:', error);
        }
    }

    updateUI() {
        const userSection = document.getElementById('userSection');
        const authBox = document.getElementById('authBox');
        const participationsSection = document.getElementById('myParticipations');

        if (this.currentUser) {
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
                this.loadUserParticipations();
            }
        } else {
            if (userSection) userSection.innerHTML = '';
            if (authBox) authBox.style.display = 'block';
            if (participationsSection) {
                participationsSection.style.display = 'none';
            }
        }
    }

    updateUserStats(participations) {
        if (!this.currentUser) return;

        const participationCount = participations ? participations.length : 0;
        let winChance = 0;
        
        if (participationCount > 0) {
            // Calcul plus réaliste basé sur les tickets utilisés
            const totalTicketsUsed = participations.reduce((sum, p) => sum + p.tickets_used, 0);
            winChance = Math.min(totalTicketsUsed * 5, 80); // 5% par ticket utilisé
        }

        document.getElementById('userTickets').textContent = this.currentUser.tickets;
        document.getElementById('userParticipations').textContent = participationCount;
        document.getElementById('userWinChance').textContent = `${winChance}%`;
    }

    updateStats(stats) {
        // Mettre à jour les statistiques principales
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalPrizes').textContent = stats.totalContests;
        document.getElementById('totalWinners').textContent = stats.totalWinners;
        
        // Mettre à jour les statistiques supplémentaires si elles existent
        if (stats.totalParticipations) {
            const participationElement = document.getElementById('totalParticipations');
            if (participationElement) {
                participationElement.textContent = stats.totalParticipations;
            }
        }
        
        if (stats.totalTicketsDistributed) {
            const ticketsElement = document.getElementById('totalTicketsDistributed');
            if (ticketsElement) {
                ticketsElement.textContent = stats.totalTicketsDistributed;
            }
        }
    }

    updateAdminStats(stats) {
        // Mettre à jour les stats dans le panel admin
        document.getElementById('adminUserCount').textContent = stats.totalUsers;
        document.getElementById('adminParticipationCount').textContent = stats.totalParticipations || 0;
        document.getElementById('adminTicketCount').textContent = stats.totalTicketsDistributed || 0;
        document.getElementById('adminContestCount').textContent = stats.activeContests || 0;
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
            const isActive = contest.status === 'active';

            return `
                <div class="contest-card ${!isActive ? 'contest-ended' : ''}">
                    <h3><i class="fas fa-gift"></i> ${contest.name}</h3>
                    <p class="contest-description">${contest.description}</p>
                    <div class="prize-badge">🎁 ${contest.prize}</div>
                    <div class="contest-stats">
                        <span><i class="fas fa-users"></i> ${contest.participants || 0} participants</span>
                        <span><i class="fas fa-ticket-alt"></i> ${contest.tickets_required} ticket(s)</span>
                        <span><i class="fas fa-info-circle"></i> ${isActive ? 'Actif' : 'Terminé'}</span>
                    </div>
                    ${isActive ? `
                        <button class="participate-btn" 
                                onclick="app.participate(${contest.id})"
                                ${this.currentUser && !canParticipate ? 'disabled' : ''}>
                            <i class="fas fa-ticket-alt"></i>
                            ${this.currentUser ? 
                                (canParticipate ? 
                                    `Participer (${contest.tickets_required} ticket(s))` : 
                                    `Pas assez de tickets (${userTickets}/${contest.tickets_required})`) : 
                                'Connectez-vous pour participer'}
                        </button>
                    ` : `
                        <button class="participate-btn" disabled style="background: #666;">
                            <i class="fas fa-flag-checkered"></i> Concours terminé
                        </button>
                        ${contest.winner_id ? `<p style="text-align:center; margin-top:10px; color:#00ff88;">🏆 Gagnant annoncé</p>` : ''}
                    `}
                </div>
            `;
        }).join('');
    }

    async participate(contestId) {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous pour participer', 'error');
            return;
        }

        // Demander confirmation
        const contestResult = await this.db.getContestById(contestId);
        if (contestResult.success) {
            const contest = contestResult.data;
            
            if (contest.status !== 'active') {
                this.showNotification('❌ Ce concours est terminé', 'error');
                return;
            }
            
            if (!confirm(`Participer au concours "${contest.name}" avec ${contest.tickets_required} ticket(s) ?`)) {
                return;
            }

            this.showNotification('🔄 Participation en cours...', 'info');

            const result = await this.db.participate(this.currentUser.id, contestId);

            if (result.success) {
                // Mettre à jour l'utilisateur local
                this.currentUser.tickets = result.newTicketCount;
                localStorage.setItem('current_user', JSON.stringify(this.currentUser));
                
                this.showNotification(
                    `🎫 Participation enregistrée ! ${result.ticketsUsed} ticket(s) utilisés. Bonne chance ! 🍀`,
                    'success'
                );

                this.updateUI();
                this.loadBasicData();
                this.loadUserParticipations();
                
            } else {
                this.showNotification(`❌ ${result.error}`, 'error');
            }
        }
    }

    async earnTickets(actionId, tickets, actionName) {
        if (!this.currentUser) {
            this.showNotification('❌ Connectez-vous pour gagner des tickets', 'error');
            return;
        }

        this.showNotification('🔄 Ajout des tickets...', 'info');

        const result = await this.db.earnTickets(this.currentUser.id, tickets, actionName);

        if (result.success) {
            // Mettre à jour l'utilisateur local
            this.currentUser.tickets = result.newTicketCount;
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));

            this.showNotification(`✅ +${tickets} tickets ! Total: ${result.newTicketCount} 🎫`, 'success');
            this.updateUI();
            this.loadBasicData();
        } else {
            this.showNotification(`❌ ${result.error}`, 'error');
        }
    }

    loadActions() {
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

        container.innerHTML = participations.map(p => {
            const contest = p.gamemarcus_contests;
            return `
                <div class="participation-item">
                    <div class="participation-details">
                        <h4>${contest?.name || 'Concours'}</h4>
                        <p style="font-size: 0.9em; margin: 5px 0; color: #ccc;">
                            ${contest?.description || ''}
                        </p>
                        <small style="opacity: 0.7;">
                            ${new Date(p.created_at).toLocaleDateString('fr-FR')} • 
                            Prix: ${contest?.prize || 'N/A'} •
                            Tickets: ${p.tickets_used}
                        </small>
                    </div>
                    <div class="participation-stats">
                        <div class="participation-tickets" style="background: rgba(0, 219, 222, 0.2); padding: 5px 15px; border-radius: 20px;">
                            ${p.tickets_used} ticket(s)
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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

        container.innerHTML = winners.map(winner => {
            const contestName = winner.gamemarcus_contests?.name || 'Concours';
            return `
                <div class="winner-card">
                    <div class="winner-avatar">
                        <i class="fas fa-crown"></i>
                    </div>
                    <h4 class="winner-name">${winner.username}</h4>
                    <p class="winner-prize">${winner.prize}</p>
                    <p class="contest-name">${contestName}</p>
                    <p class="winner-date">
                        ${new Date(winner.drawn_at).toLocaleDateString('fr-FR')}
                    </p>
                    <small>${winner.tickets_used || 1} ticket(s) utilisés</small>
                </div>
            `;
        }).join('');
    }

    // 🏆 TIRAGE DES GAGNANTS (ADMIN)
    async drawWinnersForAllContests() {
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

        if (!confirm('⚠️ Tirer les gagnants pour tous les concours actifs ? Cette action est irréversible.')) {
            return;
        }

        this.showNotification('🎲 Tirage en cours...', 'info');

        // Récupérer tous les concours
        const contestsResult = await this.db.getAllContests();
        
        if (!contestsResult.success || !contestsResult.data) {
            this.showNotification('❌ Aucun concours trouvé', 'error');
            return;
        }

        const activeContests = contestsResult.data.filter(c => c.status === 'active');
        
        if (activeContests.length === 0) {
            this.showNotification('ℹ️ Aucun concours actif à tirer', 'info');
            return;
        }

        let winnersCount = 0;
        let errors = [];

        for (const contest of activeContests) {
            try {
                this.showNotification(`🎲 Tirage pour: ${contest.name}...`, 'info');
                
                const result = await this.db.drawWinner(contest.id);
                
                if (result.success) {
                    winnersCount++;
                    this.showNotification(`✅ ${contest.name}: ${result.winner.username} a gagné !`, 'success');
                } else {
                    errors.push(`${contest.name}: ${result.error}`);
                    this.showNotification(`❌ ${contest.name}: ${result.error}`, 'error');
                }
                
                // Pause entre chaque tirage
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error('Erreur tirage:', error);
                errors.push(`${contest.name}: Erreur technique`);
            }
        }

        // Résumé final
        let message = `🎉 ${winnersCount} gagnant(s) tiré(s) avec succès !`;
        if (errors.length > 0) {
            message += `\n\nErreurs (${errors.length}):\n${errors.join('\n')}`;
        }
        
        this.showNotification(message, winnersCount > 0 ? 'success' : 'error');
        
        // Recharger les données
        await this.loadBasicData();
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
            this.updateAdminStats(stats.data);
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
            await this.loadBasicData();
            await this.loadAdminStats();
            closeModal('adminModal');
        } else {
            this.showNotification(`❌ Erreur: ${result.error}`, 'error');
        }
    }

    // 🔔 NOTIFICATIONS
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) {
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
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
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
