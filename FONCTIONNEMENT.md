# 📋 Fonctionnement du Système de Match Actif

## 🎯 Vue d'ensemble

Le système **Scoreboard Pro** implémente une gestion stricte des matchs actifs pour garantir qu'**un seul match peut être en cours à la fois**. Cette approche évite les conflits et assure une expérience utilisateur cohérente.

---

## 🔄 États des Matchs

### 📊 Statuts dans la base de données

| Statut | Description | Comportement |
|--------|-------------|--------------|
| `scheduled` | Match programmé, pas encore démarré | ⏸️ Chronomètre arrêté, sélectionnable |
| `live` | Match en cours, chronomètre actif | 🔴 Chronomètre en marche, **MATCH ACTIF** |
| `finished` | Match terminé | ✅ Match fini, archivable |
| `archived` | Match archivé | 📦 Dans la section archivée |

### 🎮 Logique d'activation

```typescript
// Un match devient ACTIF quand :
- L'utilisateur clique sur "▶ Démarrer"
- Le statut passe de 'scheduled' → 'live'
- Le chronomètre commence à tourner

// Un match redevient INACTIF quand :
- L'utilisateur clique sur "⏸ Arrêter" 
- Le statut passe de 'live' → 'scheduled'
- Le chronomètre s'arrête
```

---

## 🚫 Règles de Protection

### 1. **Un seul match actif**
- ✅ Maximum 1 match avec le statut `live`
- ❌ Impossible de démarrer un 2ème match si un autre est actif
- 🔒 Les autres matchs deviennent non-sélectionnables

### 2. **Persistance de l'état actif**
- 🔄 Le match reste actif même si on navigue vers la liste
- ⏰ Le chronomètre continue de tourner en arrière-plan
- 🎮 Seul le match actif peut être sélectionné depuis la liste

### 3. **Protection de l'interface**
```typescript
// Dans SpacePage.tsx
const handleMatchSelect = (match) => {
  if (activeMatch && activeMatch.id !== match.id) {
    alert(`Impossible de sélectionner un autre match.
           Le match "${activeMatch.name}" est actuellement actif.`);
    return; // Bloque la sélection
  }
  onMatchSelect(match);
};
```

---

## 🎛️ Interface Utilisateur

### 📋 Liste des Matchs (SpacePage)

#### Affichage normal (aucun match actif)
```
┌─────────────────────────────────────┐
│ Match A vs B                        │
│ [Sélectionner] [Modifier] [Suppr]   │
└─────────────────────────────────────┘
│ Match C vs D                        │
│ [Sélectionner] [Modifier] [Suppr]   │
└─────────────────────────────────────┘
```

#### Affichage avec match actif
```
┌─────────────────────────────────────┐
│ Match A vs B  🔴 MATCH ACTIF        │
│ [🎮 Console] [Modifier] [❌ Suppr]   │  ← Seul match sélectionnable
└─────────────────────────────────────┘
│ Match C vs D                        │
│ [❌ Bloqué] [Modifier] [❌ Suppr]    │  ← Autres matchs bloqués
└─────────────────────────────────────┘
```

### 🎮 Console de Match (MatchPage)

#### Indicateurs visuels
- **Badge rouge** : `🔴 MATCH ACTIF` quand le chronomètre tourne
- **Statut** : `🔴 Match actif (temps réel)` vs `⏸️ Match sélectionné (prêt)`
- **Boutons** : 
  - `▶ Démarrer` → Active le match
  - `⏸ Arrêter` → Désactive le match
  - `🔄 Reset` → Disponible seulement si le match a été démarré

---

## 🔄 Flux de Données

### 1. **Démarrage d'un match**
```mermaid
graph TD
    A[Clic "▶ Démarrer"] --> B[Action: clock:start]
    B --> C[État local: clock.running = true]
    C --> D[Base de données: status = 'live']
    D --> E[Rechargement de la liste]
    E --> F[Match devient activeMatch]
    F --> G[Autres matchs bloqués]
```

### 2. **Arrêt d'un match**
```mermaid
graph TD
    A[Clic "⏸ Arrêter"] --> B[Action: clock:stop]
    B --> C[État local: clock.running = false]
    C --> D[Base de données: status = 'scheduled']
    D --> E[Rechargement de la liste]
    E --> F[Plus d'activeMatch]
    F --> G[Tous les matchs sélectionnables]
```

### 3. **Navigation avec match actif**
```mermaid
graph TD
    A[Match actif en cours] --> B[Clic "← Retour"]
    B --> C[Affichage de la liste]
    C --> D[Match actif reste visible]
    D --> E[Seul le match actif est sélectionnable]
    E --> F[Clic "🎮 Console"]
    F --> G[Retour à la console du match actif]
```

---

## 🛡️ Sécurités Implémentées

### 1. **Validation côté client**
```typescript
// Empêche la sélection multiple
if (activeMatch && activeMatch.id !== match.id) {
  alert("Impossible de sélectionner un autre match");
  return;
}
```

### 2. **Synchronisation base de données**
```typescript
// Mise à jour automatique du statut
await supa.from('matches').update({ 
  status: 'live',  // ou 'scheduled'
  updated_at: new Date().toISOString()
}).eq('id', match.id);
```

### 3. **Interface adaptative**
```typescript
// Boutons conditionnels
<button 
  disabled={activeMatch && activeMatch.id !== match.id}
  title={activeMatch ? "Match actif en cours" : "Sélectionner ce match"}
>
  {activeMatch?.id === match.id ? '🎮 Console' : 'Sélectionner'}
</button>
```

---

## 🎯 Avantages de cette Approche

### ✅ **Cohérence**
- Un seul match actif à la fois
- État synchronisé entre interface et base de données
- Pas de conflits entre plusieurs matchs

### ✅ **Sécurité**
- Impossible de perdre un match en cours
- Protection contre les manipulations accidentelles
- Persistance de l'état lors de la navigation

### ✅ **Expérience utilisateur**
- Feedback visuel clair (badges, couleurs)
- Messages d'erreur explicites
- Navigation intuitive

### ✅ **Fiabilité technique**
- Synchronisation temps réel avec Supabase
- Gestion d'état React optimisée
- Pas de fuites mémoire ou de timers orphelins

---

## 🔧 Points Techniques Clés

### 1. **Détection du match actif**
```typescript
const activeMatch = matches.find(m => m.status === 'live') || null;
```

### 2. **Gestion du chronomètre**
```typescript
useEffect(() => { 
  if (!state?.matchId) return; 
  const id = setInterval(() => setState(prev => applyTick(prev)), 100); 
  return () => clearInterval(id); 
}, [state?.matchId]);
```

### 3. **Mise à jour de la liste**
```typescript
const { data: updatedMatches } = await supa
  .from('matches')
  .select('*')
  .eq('org_id', match.org_id)
  .order('scheduled_at', { ascending: true });
onMatchesUpdate(updatedMatches);
```

---

## 🎮 Scénarios d'Usage

### Scénario 1 : Démarrage normal
1. Utilisateur sélectionne "Match A vs B"
2. Clique sur "▶ Démarrer"
3. Match devient actif, chronomètre démarre
4. Retour à la liste → Seul "Match A vs B" est sélectionnable

### Scénario 2 : Tentative de sélection multiple
1. "Match A vs B" est actif
2. Utilisateur essaie de sélectionner "Match C vs D"
3. Alert : "Impossible de sélectionner un autre match"
4. Seul "🎮 Console" fonctionne pour le match actif

### Scénario 3 : Arrêt et changement
1. "Match A vs B" est actif
2. Utilisateur clique "⏸ Arrêter"
3. Match redevient inactif
4. Tous les matchs redeviennent sélectionnables
5. Peut maintenant sélectionner "Match C vs D"

---

Cette architecture garantit une gestion robuste et intuitive des matchs actifs, respectant le principe fondamental : **un seul match en cours à la fois**. 🚀