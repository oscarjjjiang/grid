import { createClient } from '@supabase/supabase-js'

// These come from environment variables (see .env.example).
// If they're not set, the app runs in local-only mode (data stays in this browser).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
