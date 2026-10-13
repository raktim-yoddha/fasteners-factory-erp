import { useEffect, useState } from 'react';
import type { TeamAuthPort } from '@fasteners/application';
import { Button, Field, Panel } from '../components';

export function AuthSecurity({ auth }: { auth: TeamAuthPort }) {
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);
  const [enrollment, setEnrollment] = useState<{ id: string; secret: string } | null>(null);
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void auth
      .mfaFactors()
      .then((value) => {
        if (active) setFactors(value);
      })
      .catch(() => {
        if (active) setMessage('Authenticator state unavailable. Retry when online.');
      });
    return () => {
      active = false;
    };
  }, [auth]);
  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await operation();
      setFactors(await auth.mfaFactors());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Authentication operation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel className="account-security">
      <h3>Authenticator security</h3>
      <p className="muted">
        Enroll or verify from your account even when company mutations require MFA. Company
        permissions remain independent.
      </p>
      <Button
        variant="secondary"
        disabled={busy || Boolean(enrollment)}
        onClick={() =>
          void perform(async () => {
            setEnrollment(await auth.enrollMfa());
            setCode('');
          })
        }
      >
        Enroll authenticator
      </Button>
      {enrollment || factors.length ? (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              await auth.verifyMfa(enrollment?.id ?? factor, code);
              setEnrollment(null);
              setCode('');
              setMessage('Authenticator verified. This session now has AAL2 assurance.');
            });
          }}
        >
          {enrollment ? (
            <p className="notice">
              Add this secret to your authenticator and keep it private:{' '}
              <code>{enrollment.secret}</code>
            </p>
          ) : (
            <Field label="Verified authenticator">
              <select required value={factor} onChange={(event) => setFactor(event.target.value)}>
                <option value="">Choose authenticator</option>
                {factors.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Six-digit authenticator code">
            <input
              required
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Button disabled={busy}>Verify MFA session</Button>
        </form>
      ) : null}
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
    </Panel>
  );
}
