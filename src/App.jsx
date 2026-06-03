import { useState, useEffect, useRef, useCallback } from 'react'
import Planner from './Planner.jsx'
import { supabase } from './supabase.js'

/* full-viewport centered message (for sign-in / loading screens) */
function FullCenter({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e1014' }}>
      {children}
    </div>
  )
}

/* entry: cloud mode if configured, else local-only — both fill the page */
export default function App() {
  return supabase ? <CloudApp /> : <Planner />
}

/* ---------- cloud-synced app ---------- */
function CloudApp() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase.from('plans').select('data').eq('user_id', session.user.id).maybeSingle()
      .then(({ data: row }) => {
        if (cancelled) return
        setData(row?.data ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [session])

  const handleChange = useCallback((plan) => {
    if (!session) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      supabase.from('plans').upsert({
        user_id: session.user.id,
        data: plan,
        updated_at: new Date().toISOString(),
      })
    }, 800)
  }, [session])

  if (!authReady) return <FullCenter><Msg>Starting up…</Msg></FullCenter>
  if (!session) return <FullCenter><SignIn /></FullCenter>
  if (loading) return <FullCenter><Msg>Loading your plans…</Msg></FullCenter>

  return (
    <Planner
      key={session.user.id}
      initialData={data}
      onChange={handleChange}
      accountSlot={<AccountChip email={session.user.email} />}
    />
  )
}

/* ---------- small UI bits ---------- */
function Msg({ children }) {
  return <div style={{ color: '#8b94a3', fontFamily: 'system-ui', fontSize: 14 }}>{children}</div>
}

function AccountChip({ email }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4, fontFamily: 'system-ui' }}>
      <span style={{ color: '#8b94a3', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
      <button onClick={() => supabase.auth.signOut()}
        style={{ background: '#1a1e26', border: '1px solid #2e343d', borderRadius: 7, color: '#e7eaef', cursor: 'pointer', padding: '6px 11px', fontSize: 12 }}>
        Sign out
      </button>
    </div>
  )
}

/* ---------- email + password sign-in (no link, no code) ---------- */
function SignIn() {
  const [mode, setMode] = useState('signin')   // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!email || !password) { setErr('Enter your email and password.'); return }
    setBusy(true); setErr('')
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      setBusy(false)
      if (error) { setErr(error.message); return }
      if (!data.session) {
        setErr('Account made, but email confirmation is still ON in Supabase. Turn it off (Authentication → Providers → Email → uncheck "Confirm email") so you can sign in with just a password.')
      }
      // if a session came back, onAuthStateChange signs you straight in
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setErr(error.message)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: '#0e1014', border: '1px solid #2e343d',
    borderRadius: 8, color: '#e7eaef', padding: '11px 12px', fontSize: 14, marginBottom: 10,
  }

  return (
    <div style={{ width: 360, maxWidth: '90vw', textAlign: 'center', fontFamily: 'system-ui', color: '#e7eaef' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: '.22em', marginBottom: 6 }}>GRID</div>
      <div style={{ color: '#8b94a3', fontSize: 13, marginBottom: 26 }}>
        {mode === 'signup' ? 'Create your account' : 'Sign in to your planner'}
      </div>

      <input type="email" value={email} placeholder="you@email.com" autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={inputStyle} />
      <input type="password" value={password} placeholder="password"
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={inputStyle} />

      <button onClick={submit} disabled={busy}
        style={{ width: '100%', background: '#2dd4bf', border: 'none', borderRadius: 8, color: '#04201c', fontWeight: 600, cursor: 'pointer', padding: '11px', fontSize: 14, opacity: busy ? 0.6 : 1, marginTop: 2 }}>
        {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>

      {err && <div style={{ color: '#fb7185', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{err}</div>}

      <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr('') }}
        style={{ background: 'none', border: 'none', color: '#8b94a3', cursor: 'pointer', fontSize: 12, marginTop: 16, textDecoration: 'underline' }}>
        {mode === 'signup' ? 'Already have an account? Sign in' : "First time? Create an account"}
      </button>

      <div style={{ color: '#5b6472', fontSize: 11, marginTop: 14 }}>
        Stays signed in on this device. Use the same email + password on your other devices.
      </div>
    </div>
  )
}
