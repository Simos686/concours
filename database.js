// 🗄️ Gestionnaire de base de données Supabase
class SupabaseDatabase {
    constructor() {
        console.log('🔄 Initialisation Supabase Database...');
        
        // Vérifier si Supabase JS est chargé
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase JS non chargé !');
            this.supabase = null;
            return;
        }
        
        // Vérifier la configuration
        if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
            console.error('❌ Configuration Supabase manquante !');
            this.supabase = null;
            return;
        }
        
        // Initialiser Supabase
        try {
            this.supabase = supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );
            console.log('✅ Supabase initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur initialisation Supabase:', error);
            this.supabase = null;
        }
    }

    // 👤 CRÉATION DE COMPTE
    async createUser(username, email, password) {
        console.log('Tentative création utilisateur:', { username, email });
        
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            // Vérifier si l'email existe déjà
            const { data: existingUser } = await this.supabase
                .from('gamemarcus_users')
                .select('*')
                .eq('email', email)
                .single();

            if (existingUser) {
                return { success: false, error: 'Cet email est déjà utilisé' };
            }

            // Hash du mot de passe
            const passwordHash = this.hashPassword(password);

            // Créer l'utilisateur
            const { data, error } = await this.supabase
                .from('gamemarcus_users')
                .insert([{
                    username,
                    email,
                    password_hash: passwordHash,
                    tickets: 10,
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    total_tickets_earned: 10
                }])
                .select()
                .single();

            if (error) {
                console.error('Erreur création utilisateur Supabase:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ Utilisateur créé avec succès:', data);
            return { success: true, user: data };
            
        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            return { success: false, error: error.message };
        }
    }

    // 🔐 CONNEXION
    async loginUser(email, password) {
        console.log('Tentative connexion:', email);
        
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const passwordHash = this.hashPassword(password);
            
            const { data, error } = await this.supabase
                .from('gamemarcus_users')
                .select('*')
                .eq('email', email)
                .eq('password_hash', passwordHash)
                .single();

            if (error || !data) {
                return { success: false, error: 'Email ou mot de passe incorrect' };
            }

            // Mettre à jour la dernière connexion
            await this.supabase
                .from('gamemarcus_users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            return { success: true, user: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 🎯 PARTICIPATION À UN CONCOURS
    async participate(userId, contestId) {
        console.log(`Participation: user ${userId}, contest ${contestId}`);
        
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            // 1. Récupérer le concours
            const { data: contest, error: contestError } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .eq('id', contestId)
                .single();

            if (contestError || !contest) {
                return { success: false, error: 'Concours introuvable' };
            }

            // 2. Récupérer l'utilisateur
            const { data: user, error: userError } = await this.supabase
                .from('gamemarcus_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return { success: false, error: 'Utilisateur introuvable' };
            }

            // 3. Vérifier si assez de tickets
            if (user.tickets < contest.tickets_required) {
                return { 
                    success: false, 
                    error: `Pas assez de tickets. Nécessaire: ${contest.tickets_required}, Disponible: ${user.tickets}` 
                };
            }

            // 4. Vérifier si déjà participé
            const { data: existingParticipation } = await this.supabase
                .from('gamemarcus_participations')
                .select('*')
                .eq('user_id', userId)
                .eq('contest_id', contestId)
                .single();

            if (existingParticipation) {
                return { success: false, error: 'Vous avez déjà participé à ce concours' };
            }

            // 5. Commencer une transaction
            // a) Diminuer les tickets de l'utilisateur
            const newTicketCount = user.tickets - contest.tickets_required;
            
            const { error: updateError } = await this.supabase
                .from('gamemarcus_users')
                .update({ tickets: newTicketCount })
                .eq('id', userId);

            if (updateError) {
                console.error('Erreur mise à jour tickets:', updateError);
                return { success: false, error: 'Erreur lors de la mise à jour des tickets' };
            }

            // b) Enregistrer la participation
            const { data: participation, error: participationError } = await this.supabase
                .from('gamemarcus_participations')
                .insert([{
                    user_id: userId,
                    contest_id: contestId,
                    tickets_used: contest.tickets_required,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (participationError) {
                console.error('Erreur enregistrement participation:', participationError);
                
                // Rollback: remettre les tickets
                await this.supabase
                    .from('gamemarcus_users')
                    .update({ tickets: user.tickets })
                    .eq('id', userId);
                
                return { success: false, error: 'Erreur lors de l\'enregistrement' };
            }

            // c) Augmenter le compteur de participants du concours
            const { error: contestUpdateError } = await this.supabase
                .from('gamemarcus_contests')
                .update({ participants: contest.participants + 1 })
                .eq('id', contestId);

            if (contestUpdateError) {
                console.error('Erreur mise à jour participants:', contestUpdateError);
            }

            // d) Enregistrer la transaction ticket
            await this.supabase
                .from('gamemarcus_tickets')
                .insert([{
                    user_id: userId,
                    amount: -contest.tickets_required,
                    type: 'participation',
                    description: `Participation au concours: ${contest.name}`,
                    created_at: new Date().toISOString()
                }]);

            console.log('✅ Participation enregistrée avec succès');
            return { 
                success: true, 
                ticketsUsed: contest.tickets_required,
                newTicketCount: newTicketCount,
                participation: participation
            };
            
        } catch (error) {
            console.error('Erreur participation:', error);
            return { success: false, error: error.message };
        }
    }

    // 📋 RÉCUPÉRER LES PARTICIPATIONS D'UN UTILISATEUR
    async getUserParticipations(userId) {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_participations')
                .select(`
                    *,
                    gamemarcus_contests (
                        name,
                        prize,
                        description,
                        tickets_required
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur récupération participations:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data: data || [] };
            
        } catch (error) {
            console.error('Erreur participations:', error);
            return { success: false, error: error.message };
        }
    }

    // 🎁 RÉCUPÉRER LES CONCOURS
    async getContests() {
        if (!this.supabase) {
            return { 
                success: true, 
                data: this.getDemoContests() 
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur récupération concours:', error);
                return { success: true, data: this.getDemoContests() };
            }
            
            const contests = data && data.length > 0 ? data : this.getDemoContests();
            return { success: true, data: contests };
            
        } catch (error) {
            console.error('Erreur concours:', error);
            return { success: true, data: this.getDemoContests() };
        }
    }

    // 🎯 RÉCUPÉRER UN CONCOURS PAR ID
    async getContestById(contestId) {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .eq('id', contestId)
                .single();

            if (error) {
                return { success: false, error: 'Concours introuvable' };
            }

            return { success: true, data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 💰 GAGNER DES TICKETS (ACTIONS)
    async earnTickets(userId, amount, actionName) {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            // Récupérer l'utilisateur actuel
            const { data: user, error: userError } = await this.supabase
                .from('gamemarcus_users')
                .select('tickets, total_tickets_earned')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return { success: false, error: 'Utilisateur introuvable' };
            }

            // Calculer le nouveau total
            const newTicketCount = user.tickets + amount;
            const newTotalEarned = user.total_tickets_earned + amount;

            // Mettre à jour les tickets
            const { error: updateError } = await this.supabase
                .from('gamemarcus_users')
                .update({ 
                    tickets: newTicketCount,
                    total_tickets_earned: newTotalEarned
                })
                .eq('id', userId);

            if (updateError) {
                return { success: false, error: 'Erreur mise à jour tickets' };
            }

            // Enregistrer la transaction
            await this.supabase
                .from('gamemarcus_tickets')
                .insert([{
                    user_id: userId,
                    amount: amount,
                    type: 'action_reward',
                    description: `Action: ${actionName}`,
                    created_at: new Date().toISOString()
                }]);

            return { 
                success: true, 
                newTicketCount: newTicketCount,
                amount: amount
            };
            
        } catch (error) {
            console.error('Erreur gain tickets:', error);
            return { success: false, error: error.message };
        }
    }

    // 📊 STATISTIQUES COMPLÈTES
    async getStatistics() {
        if (!this.supabase) {
            return {
                success: true,
                data: {
                    totalUsers: 0,
                    totalContests: 4,
                    totalWinners: 0,
                    totalTickets: 0,
                    totalParticipations: 0,
                    activeContests: 0,
                    totalTicketsDistributed: 0
                }
            };
        }

        try {
            // Compter les utilisateurs
            const { count: userCount } = await this.supabase
                .from('gamemarcus_users')
                .select('*', { count: 'exact', head: true });

            // Compter les concours
            const { count: contestCount } = await this.supabase
                .from('gamemarcus_contests')
                .select('*', { count: 'exact', head: true });

            // Compter les concours actifs
            const { count: activeContestCount } = await this.supabase
                .from('gamemarcus_contests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active');

            // Compter les gagnants
            const { count: winnerCount } = await this.supabase
                .from('gamemarcus_winners')
                .select('*', { count: 'exact', head: true });

            // Compter les participations
            const { count: participationCount } = await this.supabase
                .from('gamemarcus_participations')
                .select('*', { count: 'exact', head: true });

            // Calculer le total des tickets actuellement
            const { data: users } = await this.supabase
                .from('gamemarcus_users')
                .select('tickets');

            const totalTickets = users ? users.reduce((sum, user) => sum + user.tickets, 0) : 0;

            // Calculer le total des tickets distribués
            const { data: ticketsData } = await this.supabase
                .from('gamemarcus_tickets')
                .select('amount');

            const totalTicketsDistributed = ticketsData ? 
                ticketsData.reduce((sum, ticket) => sum + Math.abs(ticket.amount), 0) : 0;

            return {
                success: true,
                data: {
                    totalUsers: userCount || 0,
                    totalContests: contestCount || 0,
                    totalWinners: winnerCount || 0,
                    totalTickets: totalTickets,
                    totalParticipations: participationCount || 0,
                    activeContests: activeContestCount || 0,
                    totalTicketsDistributed: totalTicketsDistributed
                }
            };
        } catch (error) {
            console.error('Erreur statistiques:', error);
            return {
                success: true,
                data: {
                    totalUsers: 0,
                    totalContests: 4,
                    totalWinners: 0,
                    totalTickets: 0,
                    totalParticipations: 0,
                    activeContests: 4,
                    totalTicketsDistributed: 0
                }
            };
        }
    }

    // 🏆 RÉCUPÉRER LES GAGNANTS
    async getWinners(limit = 6) {
        if (!this.supabase) {
            return { success: true, data: [] };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_winners')
                .select(`
                    *,
                    gamemarcus_contests (
                        name
                    )
                `)
                .order('drawn_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { success: true, data: [] };
            }

            return { success: true, data: data || [] };
        } catch (error) {
            return { success: true, data: [] };
        }
    }

    // 👨‍💼 FONCTIONS ADMIN
    async getAllUsers() {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAllParticipations() {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_participations')
                .select(`
                    *,
                    gamemarcus_users (
                        username,
                        email
                    ),
                    gamemarcus_contests (
                        name,
                        prize
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAllContests() {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 🎲 TIRAGE AU SORT
    async drawWinner(contestId) {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            console.log(`🎲 Début du tirage pour le concours ${contestId}`);

            // 1. Récupérer le concours
            const { data: contest, error: contestError } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .eq('id', contestId)
                .single();

            if (contestError || !contest) {
                return { success: false, error: 'Concours introuvable' };
            }

            // 2. Vérifier si le concours est actif
            if (contest.status !== 'active') {
                return { success: false, error: 'Ce concours est déjà terminé' };
            }

            // 3. Récupérer toutes les participations
            const { data: participations, error: partError } = await this.supabase
                .from('gamemarcus_participations')
                .select('*')
                .eq('contest_id', contestId);

            if (partError) {
                return { success: false, error: 'Erreur récupération participations' };
            }

            if (!participations || participations.length === 0) {
                return { success: false, error: 'Aucun participant pour ce concours' };
            }

            // 4. Créer un tableau pondéré par tickets utilisés
            const weightedParticipants = [];
            participations.forEach(participation => {
                // Chaque ticket utilisé = 1 chance
                for (let i = 0; i < participation.tickets_used; i++) {
                    weightedParticipants.push(participation.user_id);
                }
            });

            if (weightedParticipants.length === 0) {
                return { success: false, error: 'Aucun ticket utilisé pour ce concours' };
            }

            // 5. Sélection aléatoire pondérée
            const randomIndex = Math.floor(Math.random() * weightedParticipants.length);
            const winnerId = weightedParticipants[randomIndex];

            // 6. Récupérer les infos du gagnant
            const { data: winner, error: winnerError } = await this.supabase
                .from('gamemarcus_users')
                .select('username, email')
                .eq('id', winnerId)
                .single();

            if (winnerError || !winner) {
                return { success: false, error: 'Erreur récupération gagnant' };
            }

            // 7. Calculer le nombre total de tickets utilisés par le gagnant
            const winnerParticipations = participations.filter(p => p.user_id === winnerId);
            const totalTicketsUsed = winnerParticipations.reduce((sum, p) => sum + p.tickets_used, 0);

            // 8. Enregistrer le gagnant
            const { data: winnerRecord, error: saveError } = await this.supabase
                .from('gamemarcus_winners')
                .insert([{
                    contest_id: contestId,
                    user_id: winnerId,
                    username: winner.username,
                    prize: contest.prize,
                    tickets_used: totalTicketsUsed,
                    drawn_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (saveError) {
                console.error('Erreur enregistrement gagnant:', saveError);
                return { success: false, error: 'Erreur enregistrement gagnant' };
            }

            // 9. Marquer le concours comme terminé
            const { error: updateError } = await this.supabase
                .from('gamemarcus_contests')
                .update({ 
                    status: 'ended',
                    winner_id: winnerId,
                    winner_date: new Date().toISOString()
                })
                .eq('id', contestId);

            if (updateError) {
                console.error('Erreur mise à jour concours:', updateError);
                // On continue quand même, le gagnant est enregistré
            }

            // 10. Donner un bonus au gagnant (20 tickets)
            await this.supabase
                .from('gamemarcus_users')
                .update({ tickets: winner.tickets + 20 })
                .eq('id', winnerId);

            // 11. Enregistrer la transaction bonus
            await this.supabase
                .from('gamemarcus_tickets')
                .insert([{
                    user_id: winnerId,
                    amount: 20,
                    type: 'winner_bonus',
                    description: `Bonus gagnant: ${contest.name}`,
                    created_at: new Date().toISOString()
                }]);

            console.log('✅ Tirage terminé avec succès:', winnerRecord);
            return { 
                success: true, 
                winner: {
                    id: winnerId,
                    username: winner.username,
                    email: winner.email,
                    prize: contest.prize,
                    contest_name: contest.name,
                    tickets_used: totalTicketsUsed,
                    date: new Date().toLocaleDateString('fr-FR')
                }
            };
            
        } catch (error) {
            console.error('Erreur tirage:', error);
            return { success: false, error: error.message };
        }
    }

    // ➕ AJOUTER UN CONCOURS
    async addContest(name, description, prize, tickets_required, image_url = '') {
        if (!this.supabase) {
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_contests')
                .insert([{
                    name,
                    description,
                    prize,
                    tickets_required: parseInt(tickets_required),
                    image_url,
                    status: 'active',
                    participants: 0,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 🔧 UTILITAIRES
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    // 🎮 CONCOURS DE DÉMONSTRATION
    getDemoContests() {
        return [
            {
                id: 1,
                name: "🎮 PlayStation 5 Slim + 3 jeux",
                description: "PS5 Slim édition 2023 avec FIFA 24, Spider-Man 2 et God of War Ragnarok",
                prize: "Console PS5 + Jeux",
                tickets_required: 1,
                participants: 0,
                status: "active",
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: "📱 iPhone 15 Pro Max 256GB",
                description: "iPhone 15 Pro Max 256GB - Dernier modèle Apple avec Dynamic Island",
                prize: "Smartphone iPhone 15",
                tickets_required: 1,
                participants: 0,
                status: "active",
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                name: "💻 PC Gaming RTX 4070",
                description: "PC Gaming complet avec NVIDIA RTX 4070, Intel i7, 32GB RAM DDR5, SSD 1TB NVMe",
                prize: "PC Gaming Haut de Gamme",
                tickets_required: 2,
                participants: 0,
                status: "active",
                created_at: new Date().toISOString()
            },
            {
                id: 4,
                name: "🎵 AirPods Pro 2 + Apple Watch",
                description: "AirPods Pro 2ème génération avec réduction de bruit + Apple Watch SE",
                prize: "Combo Apple",
                tickets_required: 1,
                participants: 0,
                status: "active",
                created_at: new Date().toISOString()
            }
        ];
    }
}

// Exporter
window.SupabaseDatabase = SupabaseDatabase;

