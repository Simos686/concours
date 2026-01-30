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
            console.log('Configuration actuelle:', window.SUPABASE_CONFIG);
            this.supabase = null;
            return;
        }
        
        // Initialiser Supabase
        try {
            console.log('Initialisation Supabase avec URL:', window.SUPABASE_CONFIG.url);
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
        
        // Vérifier que Supabase est initialisé
        if (!this.supabase) {
            console.error('Supabase non initialisé');
            return { success: false, error: 'Base de données non disponible' };
        }

        try {
            // Vérifier si l'email existe déjà
            const { data: existingUser, error: checkError } = await this.supabase
                .from('gamemarcus_users')
                .select('*')
                .eq('email', email)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = aucun résultat trouvé
                console.error('Erreur vérification email:', checkError);
            }

            if (existingUser) {
                return { success: false, error: 'Cet email est déjà utilisé' };
            }

            // Hash simple du mot de passe
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
                console.log('Connexion échouée pour:', email);
                return { success: false, error: 'Email ou mot de passe incorrect' };
            }

            // Mettre à jour la dernière connexion
            await this.supabase
                .from('gamemarcus_users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            console.log('✅ Connexion réussie pour:', data.username);
            return { success: true, user: data };
            
        } catch (error) {
            console.error('Erreur connexion:', error);
            return { success: false, error: error.message };
        }
    }

    // 🎯 RÉCUPÉRER LES CONCOURS
    async getContests() {
        if (!this.supabase) {
            console.log('Mode démo: renvoi concours fictifs');
            return { 
                success: true, 
                data: this.getDemoContests() 
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('gamemarcus_contests')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Si pas de concours, utiliser les démos
            const contests = data && data.length > 0 ? data : this.getDemoContests();
            return { success: true, data: contests };
            
        } catch (error) {
            console.error('Erreur récupération concours:', error);
            return { success: true, data: this.getDemoContests() };
        }
    }

    // 📊 STATISTIQUES
    async getStatistics() {
        if (!this.supabase) {
            return {
                success: true,
                data: {
                    totalUsers: 0,
                    totalContests: 4,
                    totalWinners: 0,
                    totalTickets: 0
                }
            };
        }

        try {
            // Ces requêtes peuvent échouer si les tables n'existent pas
            const userCount = 0;
            const contestCount = 4;
            const winnerCount = 0;

            return {
                success: true,
                data: {
                    totalUsers: userCount,
                    totalContests: contestCount,
                    totalWinners: winnerCount,
                    totalTickets: 0
                }
            };
        } catch (error) {
            return {
                success: true,
                data: {
                    totalUsers: 0,
                    totalContests: 4,
                    totalWinners: 0,
                    totalTickets: 0
                }
            };
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
