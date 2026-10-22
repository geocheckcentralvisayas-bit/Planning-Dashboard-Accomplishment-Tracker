import { useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  Info,
  Leaf,
  Loader2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { authenticate, listIssuedAccounts, type AuthUser } from '../lib/auth';
import { DenrLogo } from './DenrLogo';

interface LoginGateProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function LoginGate({ onAuthenticated }: LoginGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const accounts = listIssuedAccounts();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const user = await authenticate(username, password);
      if (!user) {
        setError('Invalid username or password. Check your credentials and try again.');
        setSubmitting(false);
        return;
      }
      onAuthenticated(user);
    } catch {
      setError(
        'Sign-in could not be completed in this browser. Please try again or contact IT Support.',
      );
      setSubmitting(false);
    }
  };

  const updateCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  const useAccount = (accountUsername: string) => {
    setUsername(accountUsername);
    setError('');
  };

  return (
    <div className="login-shell">
      <div className="login-aurora" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
        <span className="login-orb login-orb-4" />
      </div>

      <div className="login-card">
        <section className="login-brand">
          <div className="login-brand-glow" aria-hidden="true" />
          <div className="login-brand-head">
            <DenrLogo size="xl" spin />
            <div>
              <p className="login-brand-name">EMB Region 7</p>
              <p className="login-brand-sub">Planning Command Center</p>
            </div>
          </div>

          <div className="login-brand-body">
            <p className="login-eyebrow">2026 Planning Dashboard</p>
            <h1 className="login-headline">
              One view of every
              <br />
              accomplishment and target.
            </h1>
            <p className="login-lede">
              Read-only planning intelligence for the shared 2026 accomplishment
              workbook — live targets, actuals, delivery rates, and completeness
              checks across all 15 EMB Region 7 units.
            </p>

            <ul className="login-points">
              <li>
                <ShieldCheck size={15} />
                <span>Role-based accounts for authorized staff</span>
              </li>
              <li>
                <Database size={15} />
                <span>Snapshot-backed and read-only by design</span>
              </li>
              <li>
                <Leaf size={15} />
                <span>Internal monitoring for EMB Region 7</span>
              </li>
            </ul>
          </div>

          <p className="login-footnote">
            Authorized personnel only. Contains internal planning and budget
            figures.
          </p>
        </section>

        <section className="login-form-panel">
          <div className="login-mobile-head">
            <DenrLogo size="lg" spin />
            <div>
              <p className="login-brand-name login-brand-name-dark">
                EMB Region 7
              </p>
              <p className="login-brand-sub login-brand-sub-dark">
                Planning Command Center
              </p>
            </div>
          </div>

          <div className="login-form-head">
            <span className="login-chip">
              <ShieldCheck size={12} />
              Authorized access
            </span>
            <h2 className="login-form-title">Sign in to continue</h2>
            <p className="login-form-sub">
              Use the username and password issued by your dashboard
              administrator.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <div className="login-input-wrap">
                <UserRound size={15} aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  maxLength={64}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your username"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrap">
                <LockKeyhole size={15} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                </button>
              </div>
              {capsLock ? (
                <p className="login-caps">Caps Lock is on.</p>
              ) : null}
            </div>

            {error ? (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                className="login-error"
              >
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="login-submit"
              disabled={submitting || !username.trim() || !password}
            >
              {submitting ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <LogIn size={16} />
              )}
              {submitting ? 'Verifying credentials…' : 'Sign in'}
            </button>
          </form>

          <div className="login-accounts">
            <button
              type="button"
              className="login-accounts-toggle"
              onClick={() => setShowAccounts((open) => !open)}
              aria-expanded={showAccounts}
            >
              <span>Issued accounts for this rollout</span>
              <ChevronDown
                size={15}
                className={showAccounts ? 'is-open' : undefined}
              />
            </button>

            {showAccounts ? (
              <ul className="login-account-list">
                {accounts.map((account) => (
                  <li key={account.username}>
                    <button
                      type="button"
                      onClick={() => useAccount(account.username)}
                      title={`Use ${account.username}`}
                    >
                      <span className="login-account-avatar">
                        {account.initials}
                      </span>
                      <span className="login-account-copy">
                        <strong>{account.displayName}</strong>
                        <span>
                          {account.unit} · {account.username}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <p className="login-note">
            <Info size={14} aria-hidden="true" />
            <span>
              Accounts are issued by IT Support. Do not share your credentials.
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
