// 🗄️ Gestionnaire de base de données Supabase
class SupabaseDatabase {
    constructor() {
        console.log('🔄 Initialisation Supabase Database...');
    }

    // 👤 GESTION DES UTILISATEURS
    async createUser(username, email, password) {
        try {
            // Vérifier si l'email existe déjà
            const { data: existingUser, error: checkError } = await supabase
                .from(DB_TABLES.USERS)
                .select('*')
                .eq('email', email)
                .single();

            if (existingUser) {
                return { success: false, error: 'Cet email est déjà utilisé' };
            }

            // Créer un hash simple du mot de passe
            const passwordHash = this.hashPassword(password);

            // Insérer l'utilisateur
            const { data, error } = await supabase
                .from(DB_TABLES.USERS)
                .insert([{
                    username,
                    email,
                    password_hash: passwordHash,
                    tickets: 10, // Tickets de bienvenue
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    total_tickets_earned: 10,
                    country: this.getUserCountry()
                }])
                .select()
                .single();

            if (error) throw error;

            // Enregistrer la transaction de tickets
            await this.addTicketTransaction(data.id, 10, 'welcome_bonus', 'Bienvenue sur Game-Marcus');

            return { success: true, user: data };
            
        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            return { success: false, error: error.message };
        }
    }

    async loginUser(email, password) {
        try {
            const passwordHash = this.hashPassword(password);
            
            const { data, error } = await supabase
                .from(DB_TABLES.USERS)
                .select('*')
                .eq('email', email)
                .eq('password_hash', passwordHash)
                .single();

            if (error || !data) {
                return { success: false, error: 'Email ou mot de passe incorrect' };
            }

            // Mettre à jour la dernière connexion
            await supabase
                .from(DB_TABLES.USERS)
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            return { success: true, user: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserById(userId) {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.USERS)
                .select('*')
                .eq('id', userId)
                .single();

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    async updateUserTickets(userId, amount, reason = '') {
        try {
            // Récupérer l'utilisateur actuel
            const { data: user, error: userError } = await supabase
                .from(DB_TABLES.USERS)
                .select('tickets')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            const newTicketCount = user.tickets + amount;

            // Mettre à jour les tickets
            const { error: updateError } = await supabase
                .from(DB_TABLES.USERS)
                .update({ 
                    tickets: newTicketCount,
                    total_tickets_earned: amount > 0 ? user.total_tickets_earned + amount : user.total_tickets_earned
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Enregistrer la transaction
            await this.addTicketTransaction(userId, amount, 'ticket_update', reason);

            return { success: true, newTicketCount };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 🎯 GESTION DES CONCOURS
    async getContests() {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.CONTESTS)
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    async getContestById(contestId) {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.CONTESTS)
                .select('*')
                .eq('id', contestId)
                .single();

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    async participate(userId, contestId, ticketsUsed = null) {
        try {
            // Récupérer le concours
            const contestResult = await this.getContestById(contestId);
            if (!contestResult.success || !contestResult.data) {
                return { success: false, error: 'Concours introuvable' };
            }

            const contest = contestResult.data;

            // Récupérer l'utilisateur
            const userResult = await this.getUserById(userId);
            if (!userResult.success || !userResult.data) {
                return { success: false, error: 'Utilisateur introuvable' };
            }

            const user = userResult.data;
            const ticketsToUse = ticketsUsed || contest.tickets_required;

            // Vérifier les tickets
            if (user.tickets < ticketsToUse) {
                return { success: false, error: `Pas assez de tickets. Nécessaire: ${ticketsToUse}, Disponible: ${user.tickets}` };
            }

            // Vérifier si déjà participé
            const { data: existingParticipation, error: checkError } = await supabase
                .from(DB_TABLES.PARTICIPATIONS)
                .select('*')
                .eq('user_id', userId)
                .eq('contest_id', contestId)
                .single();

            let participationId;

            if (existingParticipation) {
                // Mettre à jour la participation existante
                const { data, error } = await supabase
                    .from(DB_TABLES.PARTICIPATIONS)
                    .update({
                        tickets_used: existingParticipation.tickets_used + ticketsToUse,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingParticipation.id)
                    .select()
                    .single();

                if (error) throw error;
                participationId = data.id;
            } else {
                // Créer une nouvelle participation
                const { data, error } = await supabase
                    .from(DB_TABLES.PARTICIPATIONS)
                    .insert([{
                        user_id: userId,
                        contest_id: contestId,
                        tickets_used: ticketsToUse,
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (error) throw error;
                participationId = data.id;

                // Augmenter le compteur de participants
                await supabase
                    .from(DB_TABLES.CONTESTS)
                    .update({ participants: contest.participants + 1 })
                    .eq('id', contestId);
            }

            // Débiter les tickets
            await this.updateUserTickets(userId, -ticketsToUse, `Participation: ${contest.name}`);

            return { 
                success: true, 
                ticketsUsed: ticketsToUse,
                participationId 
            };
            
        } catch (error) {
            console.error('Erreur participation:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserParticipations(userId) {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.PARTICIPATIONS)
                .select(`
                    *,
                    contests (
                        name,
                        prize,
                        description
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    // 🏆 TIRAGE AU SORT
    async drawWinner(contestId) {
        try {
            // Récupérer toutes les participations pour ce concours
            const { data: participations, error: partError } = await supabase
                .from(DB_TABLES.PARTICIPATIONS)
                .select('*')
                .eq('contest_id', contestId);

            if (partError || !participations || participations.length === 0) {
                return { success: false, error: 'Aucun participant pour ce concours' };
            }

            // Créer un tableau pondéré par tickets utilisés
            const weightedParticipants = [];
            participations.forEach(participation => {
                for (let i = 0; i < participation.tickets_used; i++) {
                    weightedParticipants.push(participation.user_id);
                }
            });

            if (weightedParticipants.length === 0) {
                return { success: false, error: 'Aucun ticket utilisé pour ce concours' };
            }

            // Sélection aléatoire pondérée
            const randomIndex = Math.floor(Math.random() * weightedParticipants.length);
            const winnerId = weightedParticipants[randomIndex];

            // Récupérer les infos du gagnant
            const { data: winner, error: winnerError } = await supabase
                .from(DB_TABLES.USERS)
                .select('username, email')
                .eq('id', winnerId)
                .single();

            if (winnerError) throw winnerError;

            // Récupérer le concours
            const contestResult = await this.getContestById(contestId);
            if (!contestResult.success) throw contestResult.error;

            const contest = contestResult.data;

            // Enregistrer le gagnant
            const { data: winnerRecord, error: saveError } = await supabase
                .from(DB_TABLES.WINNERS)
                .insert([{
                    contest_id: contestId,
                    user_id: winnerId,
                    username: winner.username,
                    email: winner.email,
                    prize: contest.prize,
                    tickets_used: participations
                        .filter(p => p.user_id === winnerId)
                        .reduce((sum, p) => sum + p.tickets_used, 0),
                    drawn_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (saveError) throw saveError;

            // Marquer le concours comme terminé
            await supabase
                .from(DB_TABLES.CONTESTS)
                .update({ 
                    status: 'ended',
                    winner_id: winnerId,
                    winner_date: new Date().toISOString()
                })
                .eq('id', contestId);

            // Donner un bonus au gagnant
            await this.updateUserTickets(winnerId, 20, 'Bonus gagnant');

            return { 
                success: true, 
                winner: {
                    id: winnerId,
                    username: winner.username,
                    prize: contest.prize,
                    contest_name: contest.name
                }
            };
            
        } catch (error) {
            console.error('Erreur tirage:', error);
            return { success: false, error: error.message };
        }
    }

    // 📊 STATISTIQUES
    async getStatistics() {
        try {
            const { count: userCount, error: userError } = await supabase
                .from(DB_TABLES.USERS)
                .select('*', { count: 'exact', head: true });

            const { count: contestCount, error: contestError } = await supabase
                .from(DB_TABLES.CONTESTS)
                .select('*', { count: 'exact', head: true });

            const { count: winnerCount, error: winnerError } = await supabase
                .from(DB_TABLES.WINNERS)
                .select('*', { count: 'exact', head: true });

            // Calculer le total des tickets
            const { data: users, error: usersError } = await supabase
                .from(DB_TABLES.USERS)
                .select('tickets');

            const totalTickets = users ? users.reduce((sum, user) => sum + user.tickets, 0) : 0;

            return {
                success: true,
                data: {
                    totalUsers: userCount || 0,
                    totalContests: contestCount || 0,
                    totalWinners: winnerCount || 0,
                    totalTickets: totalTickets
                }
            };
            
        } catch (error) {
            return { success: false, error };
        }
    }

    async getWinners(limit = 6) {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.WINNERS)
                .select('*')
                .order('drawn_at', { ascending: false })
                .limit(limit);

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    // 🛠️ ADMIN
    async addContest(name, description, prize, tickets_required, image_url = '') {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.CONTESTS)
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

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    async getAllUsers() {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.USERS)
                .select('*')
                .order('created_at', { ascending: false });

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    async getAllParticipations() {
        try {
            const { data, error } = await supabase
                .from(DB_TABLES.PARTICIPATIONS)
                .select(`
                    *,
                    users (username, email),
                    contests (name, prize)
                `)
                .order('created_at', { ascending: false });

            return { success: !error, data, error };
        } catch (error) {
            return { success: false, error };
        }
    }

    // 🔧 UTILITAIRES
    hashPassword(password) {
        // Hash simple (en production, utilisez bcrypt)
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    getUserCountry() {
        // Détecter le pays via l'API du navigateur
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timezone.includes('Europe/Paris')) return 'FR';
            if (timezone.includes('America')) return 'US';
            if (timezone.includes('Asia')) return 'AS';
            return 'UNKNOWN';
        } catch (e) {
            return 'UNKNOWN';
        }
    }

    async addTicketTransaction(userId, amount, type, description) {
        try {
            await supabase
                .from(DB_TABLES.TICKETS)
                .insert([{
                    user_id: userId,
                    amount,
                    type,
                    description,
                    created_at: new Date().toISOString()
                }]);

            return { success: true };
        } catch (error) {
            console.error('Erreur transaction tickets:', error);
            return { success: false, error };
        }
    }
}

// Exporter
window.SupabaseDatabase = SupabaseDatabase;