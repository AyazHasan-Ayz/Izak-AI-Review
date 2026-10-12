'use client';
import { useState, type FormEvent } from 'react';
import { LockKeyhole, ArrowRight, LoaderCircle } from 'lucide-react';
import { Brand } from './brand';

export function AdminAuth({ reset = false }: { reset?: boolean }) {
  const [recover, setRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const action = reset ? 'password' : recover ? 'recover' : 'login';
      const body = {
        action,
        ...(reset ? {} : { email: form.get('email') }),
        ...(recover ? {} : { password: form.get('password') }),
      };
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to complete request.');
      if (recover) setMessage('If the account is eligible, a recovery email will arrive shortly.');
      else window.location.assign(reset ? '/admin/login' : '/admin');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-auth">
      <Brand />
      <div className="admin-auth-heading">
        <LockKeyhole size={26} />
        <h1>{reset ? 'Set a new password' : recover ? 'Recover access' : 'Admin sign in'}</h1>
        <p>IZAK business management</p>
      </div>
      <form onSubmit={submit} className="admin-form">
        {!reset && (
          <label className="field">
            <span>Email address</span>
            <input type="email" name="email" autoComplete="username" required maxLength={254} />
          </label>
        )}
        {!recover && (
          <label className="field">
            <span>{reset ? 'New password' : 'Password'}</span>
            <input
              type="password"
              name="password"
              autoComplete={reset ? 'new-password' : 'current-password'}
              minLength={reset ? 12 : 1}
              maxLength={128}
              required
            />
          </label>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button disabled={busy} className="button button-gold">
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
          {reset ? 'Update password' : recover ? 'Send recovery email' : 'Sign in'}
        </button>
        {!reset && (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setRecover(!recover);
              setMessage('');
            }}
          >
            {recover ? 'Back to sign in' : 'Forgot password?'}
          </button>
        )}
      </form>
    </main>
  );
}
