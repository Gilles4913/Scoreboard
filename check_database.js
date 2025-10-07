import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = 'https://opwjfpybcgtgcvldizar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd2pmcHliY2d0Z2N2bGRpemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTQ5MTksImV4cCI6MjA3MzA3MDkxOX0.8yrYMlhFmjAF5_LG9FtCx8XrJ1sFOz2YejDDupbhgpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log('🔍 Vérification de la base de données...\n');

  try {
    // 1. Compter le nombre de tables
    console.log('📊 NOMBRE DE TABLES:');
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT COUNT(*) as table_count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ` 
      });
    
    if (tablesError) {
      console.log('❌ Erreur lors du comptage des tables:', tablesError.message);
    } else {
      console.log(`   Nombre de tables: ${tables?.[0]?.table_count || 'N/A'}\n`);
    }

    // 2. Lister toutes les tables avec leur nombre d'enregistrements
    console.log('📋 TABLES ET NOMBRE D\'ENREGISTREMENTS:');
    
    const { data: tableInfo, error: tableInfoError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            t.table_name,
            COALESCE(s.n_tup_ins - s.n_tup_del, 0) as row_count
          FROM information_schema.tables t
          LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
          WHERE t.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          ORDER BY t.table_name
        ` 
      });

    if (tableInfoError) {
      console.log('❌ Erreur lors de la récupération des informations des tables:', tableInfoError.message);
    } else {
      tableInfo?.forEach(table => {
        console.log(`   ${table.table_name}: ${table.row_count} enregistrements`);
      });
    }

    // 3. Détail par table (méthode alternative si exec_sql ne fonctionne pas)
    console.log('\n🔍 DÉTAIL PAR TABLE (méthode alternative):');
    
    const tables = ['orgs', 'org_members', 'profiles', 'matches'];
    
    for (const tableName of tables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`   ${tableName}: ❌ Erreur - ${error.message}`);
        } else {
          console.log(`   ${tableName}: ${count || 0} enregistrements`);
        }
      } catch (err) {
        console.log(`   ${tableName}: ❌ Erreur de connexion - ${err.message}`);
      }
    }

    // 4. Vérifier les données spécifiques
    console.log('\n👥 DONNÉES SPÉCIFIQUES:');
    
    // Orgs
    const { data: orgs } = await supabase.from('orgs').select('*');
    console.log(`   Organisations: ${orgs?.length || 0}`);
    orgs?.forEach(org => {
      console.log(`     - ${org.name} (${org.slug})`);
    });

    // Org members
    const { data: members } = await supabase.from('org_members').select('*');
    console.log(`   Membres d'organisations: ${members?.length || 0}`);
    members?.forEach(member => {
      console.log(`     - User ${member.user_id} dans org ${member.org_id} (${member.role})`);
    });

    // Profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    console.log(`   Profils utilisateurs: ${profiles?.length || 0}`);
    profiles?.forEach(profile => {
      console.log(`     - ${profile.email} (${profile.id})`);
    });

    // Matches
    const { data: matches } = await supabase.from('matches').select('*');
    console.log(`   Matchs: ${matches?.length || 0}`);
    matches?.forEach(match => {
      console.log(`     - ${match.name} (${match.sport}) - ${match.home_name} vs ${match.away_name}`);
    });

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
}

checkDatabase();

