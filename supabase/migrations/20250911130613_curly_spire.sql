/*
  # Ajout des champs logos pour les matchs

  1. Nouvelles colonnes
    - `home_logo` (text, optionnel) - Logo de l'équipe à domicile
    - `away_logo` (text, optionnel) - Logo de l'équipe à l'extérieur
  
  2. Modifications
    - Ajout de deux colonnes optionnelles à la table matches
    - Les logos peuvent être des URLs ou des données base64
*/

-- Ajouter les colonnes pour les logos des équipes
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS home_logo text,
ADD COLUMN IF NOT EXISTS away_logo text;

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('home_logo', 'away_logo');