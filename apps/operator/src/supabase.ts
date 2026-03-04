import { createClient } from "@supabase/supabase-js";

// Operator a le droit d'écrire en DB (RLS authenticated + policies)
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url) throw new Error("VITE_SUPABASE_URL manquant");
if (!anon) throw new Error("VITE_SUPABASE_ANON_KEY manquant");

export const supa = createClient(url, anon);
