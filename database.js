// 🗄️ Gestionnaire de base de données Supabase
class SupabaseDatabase {
    constructor() {
        console.log('🔄 Initialisation Supabase Database...');
        
        // Vérifier si les clés sont configurées
        if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
            console.error('❌ Configuration Supabase manquante !');
            return;
        }
        
        // Initialiser Supabase UNE SEULE FOIS
        if (!window.supabase) {
            window.supabase = window.supabase.createClient(
                window.SUPABASE_URL,
                window.SUPABASE_ANON_KEY
            );
        }
        
        this.supabase = window.supabase;
        this.tables = window.DB_TABLES;
        
        console.log('✅ Supabase initialisé');
    }

    // 👤 CRÉATION DE COMPTE - SIMPLIFIÉE
    async createUser(username, email, password) {
        console.log('Tentative création utilisateur:', { username, email });
        
        try {
            // Vérifier si Supabase est disponible
            if (!this.supabase) {
                return { success: false, error: 'Supabase non configuré' };
            }

            // Vérifier si l'email existe déjà
            const { data: existingUser } = await this.supabase
                .from(this.tables.USERS)
                .select('*')
                .eq('email', email)
                .single();

            if (existingUser) {
                return { success: false, error: 'Cet email est déjà utilisé' };
            }

            // Hash simple du mot de passe
            const passwordHash = this.hashPassword(password);

            // Créer l'utilisateur
            const { data, error } = await this.supabase
                .from(this.tables.USERS)
                .insert([{
                    username,
                    email,
                    password_hash: passwordHash,
                    tickets: 10,
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                console.error('Erreur Supabase:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ Utilisateur créé:', data);
            return { success: true, user: data };
            
        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            return { success: false, error: error.message };
        }
    }

    // 🔐 CONNEXION
    async loginUser(email, password) {
        console.log('Tentative connexion:', email);
        
        try {
            const passwordHash = this.hashPassword(password);
            
            const { data, error } = await this.supabase
                .from(this.tables.USERS)
                .select('*')
                .eq('email', email)
                .eq('password_hash', passwordHash)
                .single();

            if (error || !data) {
                return { success: false, error: 'Email ou mot de passe incorrect' };
            }

            // Mettre à jour la dernière connexion
            await this.supabase
                .from(this.tables.USERS)
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            return { success: true, user: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 🎯 RÉCUPÉRER LES CONCOURS
    async getContests() {
        try {
            const { data, error } = await this.supabase
                .from(this.tables.CONTESTS)
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur récupération concours:', error);
            return { success: false, error };
        }
    }

    // 📊 STATISTIQUES
    async getStatistics() {
        try {
            const { count: userCount } = await this.supabase
                .from(this.tables.USERS)
                .select('*', { count: 'exact', head: true });

            const { count: contestCount } = await this.supabase
                .from(this.tables.CONTESTS)
                .select('*', { count: 'exact', head: true });

            const { count: winnerCount } = await this.supabase
                .from(this.tables.WINNERS)
                .select('*', { count: 'exact', head: true });

            return {
                success: true,
                data: {
                    totalUsers: userCount || 0,
                    totalContests: contestCount || 0,
                    totalWinners: winnerCount || 0,
                    totalTickets: 0 // À implémenter
                }
            };
        } catch (error) {
            return { success: false, error };
        }
    }

    // 🔧 UTILITAIRES
    hashPassword(password) {
        // Hash simple pour la démo
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
}

// Exporter
window.SupabaseDatabase = SupabaseDatabase;
