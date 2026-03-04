import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url) throw new Error("VITE_SUPABASE_URL is required");
if (!anon) throw new Error("VITE_SUPABASE_ANON_KEY is required");

export const supabase = createClient(url, anon);
