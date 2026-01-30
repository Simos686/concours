// ⚙️ CONFIGURATION SUPABASE - À MODIFIER !
const SUPABASE_CONFIG = {
    url: 'https://jcwobxvtqmiohdqwvugl.supabase.co',      // À remplacer
    anonKey: 'sb_publishable_aJgi8FCYrjAA6p2hiDsKFw_-eh2LrdN'             // À remplacer
};

// Vérifier si la configuration est présente
if (!SUPABASE_CONFIG.url.includes('VOTRE-ID')) {
    console.error('⚠️ Configurez Supabase dans config.js !');
}

// Initialiser Supabase
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
);

// Tables de la base de données
const DB_TABLES = {
    USERS: 'gamemarcus_users',
    CONTESTS: 'gamemarcus_contests',
    PARTICIPATIONS: 'gamemarcus_participations',
    ACTIONS: 'gamemarcus_actions',
    WINNERS: 'gamemarcus_winners',
    TICKETS: 'gamemarcus_tickets'
};

// Initialiser la base de données
async function initSupabaseTables() {
    try {
        // Vérifier la connexion
        const { data, error } = await supabase.from(DB_TABLES.USERS).select('count');
        console.log('✅ Connexion Supabase établie');
    } catch (error) {
        console.error('❌ Erreur Supabase:', error);
    }
}

// Exporter
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.supabase = supabase;
window.DB_TABLES = DB_TABLES;
window.initSupabaseTables = initSupabaseTables;