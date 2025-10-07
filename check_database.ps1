# Script PowerShell pour vérifier la base de données Supabase
$supabaseUrl = "https://opwjfpybcgtgcvldizar.supabase.co"
$supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd2pmcHliY2d0Z2N2bGRpemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTQ5MTksImV4cCI6MjA3MzA3MDkxOX0.8yrYMlhFmjAF5_LG9FtCx8XrJ1sFOz2YejDDupbhgpY"

Write-Host "🔍 Vérification de la base de données Supabase..." -ForegroundColor Cyan
Write-Host ""

# Fonction pour faire des requêtes à l'API Supabase
function Invoke-SupabaseQuery {
    param(
        [string]$Table,
        [string]$Select = "*"
    )
    
    $headers = @{
        "apikey" = $supabaseAnonKey
        "Authorization" = "Bearer $supabaseAnonKey"
        "Content-Type" = "application/json"
    }
    
    $url = "$supabaseUrl/rest/v1/$Table?select=$Select"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        return $response
    }
    catch {
        Write-Host "❌ Erreur lors de la requête sur $Table : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Vérifier les organisations
Write-Host "🏢 Organisations:" -ForegroundColor Yellow
$orgs = Invoke-SupabaseQuery -Table "orgs"
if ($orgs) {
    Write-Host "   Nombre: $($orgs.Count)" -ForegroundColor Green
    foreach ($org in $orgs) {
        Write-Host "   - $($org.name) ($($org.slug)) - ID: $($org.id)" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 2. Vérifier les membres d'organisations
Write-Host "👥 Membres d'organisations:" -ForegroundColor Yellow
$members = Invoke-SupabaseQuery -Table "org_members"
if ($members) {
    Write-Host "   Nombre: $($members.Count)" -ForegroundColor Green
    foreach ($member in $members) {
        Write-Host "   - User $($member.user_id) dans org $($member.org_id) ($($member.role))" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 3. Vérifier les profils
Write-Host "👤 Profils utilisateurs:" -ForegroundColor Yellow
$profiles = Invoke-SupabaseQuery -Table "profiles"
if ($profiles) {
    Write-Host "   Nombre: $($profiles.Count)" -ForegroundColor Green
    foreach ($profile in $profiles) {
        Write-Host "   - $($profile.email) ($($profile.id))" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 4. Vérifier les matchs
Write-Host "⚽ Matchs:" -ForegroundColor Yellow
$matches = Invoke-SupabaseQuery -Table "matches"
if ($matches) {
    Write-Host "   Nombre: $($matches.Count)" -ForegroundColor Green
    foreach ($match in $matches) {
        Write-Host "   - $($match.name) ($($match.sport)) - $($match.home_name) vs $($match.away_name) - Statut: $($match.status)" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 5. Résumé global
$totalRecords = ($orgs?.Count ?? 0) + ($members?.Count ?? 0) + ($profiles?.Count ?? 0) + ($matches?.Count ?? 0)
Write-Host "📊 Résumé Global:" -ForegroundColor Cyan
Write-Host "   Nombre total de tables vérifiées: 4" -ForegroundColor White
Write-Host "   Nombre total d'enregistrements: $totalRecords" -ForegroundColor White
Write-Host "   Détail:" -ForegroundColor White
Write-Host "   - Organisations: $($orgs?.Count ?? 0)" -ForegroundColor White
Write-Host "   - Membres: $($members?.Count ?? 0)" -ForegroundColor White
Write-Host "   - Profils: $($profiles?.Count ?? 0)" -ForegroundColor White
Write-Host "   - Matchs: $($matches?.Count ?? 0)" -ForegroundColor White
Write-Host ""

# 6. Vérifier les super_admins
$superAdmins = $members | Where-Object { $_.role -eq "super_admin" }
if ($superAdmins.Count -eq 0) {
    Write-Host "⚠️ Super Administrateurs: Aucun super_admin trouvé dans la base de données" -ForegroundColor Red
} else {
    Write-Host "👑 Super Administrateurs:" -ForegroundColor Green
    Write-Host "   Nombre: $($superAdmins.Count)" -ForegroundColor Green
    foreach ($admin in $superAdmins) {
        Write-Host "   - User $($admin.user_id) dans org $($admin.org_id)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "✅ Vérification terminée!" -ForegroundColor Green
