# Script PowerShell pour vérifier les rôles utilisateurs après mise à jour
$supabaseUrl = "https://opwjfpybcgtgcvldizar.supabase.co"
$supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wd2pmcHliY2d0Z2N2bGRpemFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTQ5MTksImV4cCI6MjA3MzA3MDkxOX0.8yrYMlhFmjAF5_LG9FtCx8XrJ1sFOz2YejDDupbhgpY"

Write-Host "🔍 Vérification des rôles utilisateurs après mise à jour..." -ForegroundColor Cyan
Write-Host ""

# Fonction pour faire des requêtes à l'API Supabase
function Invoke-SupabaseQuery {
    param(
        [string]$Table,
        [string]$Select = "*",
        [string]$Filter = ""
    )
    
    $headers = @{
        "apikey" = $supabaseAnonKey
        "Authorization" = "Bearer $supabaseAnonKey"
        "Content-Type" = "application/json"
    }
    
    $url = "$supabaseUrl/rest/v1/$Table?select=$Select"
    if ($Filter) {
        $url += "&" + $Filter
    }
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        return $response
    }
    catch {
        Write-Host "❌ Erreur lors de la requête sur $Table : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Récupérer tous les profils
Write-Host "👤 Profils utilisateurs:" -ForegroundColor Yellow
$profiles = Invoke-SupabaseQuery -Table "profiles"
if ($profiles) {
    Write-Host "   Nombre: $($profiles.Count)" -ForegroundColor Green
    foreach ($profile in $profiles) {
        Write-Host "   - $($profile.email) (ID: $($profile.id))" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 2. Récupérer les organisations
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

# 3. Récupérer les membres avec leurs profils
Write-Host "Membres d'organisations avec roles:" -ForegroundColor Yellow
$members = Invoke-SupabaseQuery -Table "org_members"
if ($members) {
    Write-Host "   Nombre: $($members.Count)" -ForegroundColor Green
    
    foreach ($member in $members) {
        $profile = $profiles | Where-Object { $_.id -eq $member.user_id }
        $org = $orgs | Where-Object { $_.id -eq $member.org_id }
        
        $email = if ($profile) { $profile.email } else { "Unknown" }
        $orgName = if ($org) { $org.name } else { "Unknown" }
        
        $color = if ($member.role -eq "super_admin") { "Red" } else { "White" }
        Write-Host "   - $email dans $orgName ($($member.role))" -ForegroundColor $color
    }
} else {
    Write-Host "   ❌ Aucune donnée récupérée" -ForegroundColor Red
}
Write-Host ""

# 4. Vérification spécifique des utilisateurs cibles
Write-Host "🎯 Vérification des utilisateurs cibles:" -ForegroundColor Cyan

$superAdminEmail = "gilles.guerrin@a2display.fr"
$operatorEmail = "gilles.guerrin49@gmail.com"

$superAdminProfile = $profiles | Where-Object { $_.email -eq $superAdminEmail }
$operatorProfile = $profiles | Where-Object { $_.email -eq $operatorEmail }

if ($superAdminProfile) {
    $superAdminMembers = $members | Where-Object { $_.user_id -eq $superAdminProfile.id }
    Write-Host "   Super Admin ($superAdminEmail):" -ForegroundColor Yellow
    if ($superAdminMembers) {
        foreach ($member in $superAdminMembers) {
            $org = $orgs | Where-Object { $_.id -eq $member.org_id }
            Write-Host "     ✅ $($org.name) - $($member.role)" -ForegroundColor Green
        }
    } else {
        Write-Host "     ❌ Aucun rôle trouvé" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Super Admin ($superAdminEmail) non trouvé" -ForegroundColor Red
}

if ($operatorProfile) {
    $operatorMembers = $members | Where-Object { $_.user_id -eq $operatorProfile.id }
    Write-Host "   Operator ($operatorEmail):" -ForegroundColor Yellow
    if ($operatorMembers) {
        foreach ($member in $operatorMembers) {
            $org = $orgs | Where-Object { $_.id -eq $member.org_id }
            Write-Host "     ✅ $($org.name) - $($member.role)" -ForegroundColor Green
        }
    } else {
        Write-Host "     ❌ Aucun rôle trouvé" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Operator ($operatorEmail) non trouvé" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Vérification terminée!" -ForegroundColor Green
