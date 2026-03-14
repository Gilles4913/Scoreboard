ALTER TABLE org_display_settings
  ADD COLUMN IF NOT EXISTS show_substitution_banner BOOLEAN NOT NULL DEFAULT TRUE;
