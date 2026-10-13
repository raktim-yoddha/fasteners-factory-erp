import { useEffect, useRef, useState } from 'react';
import type { TeamAuthPort } from '@fasteners/application';
import { Badge, Button, Field, Panel } from '../components';
import { AuthSecurity } from './AuthSecurity';
export function TeamOnboarding({
  auth,
  onChange,
}: {
  auth: TeamAuthPort;
  onChange: () => Promise<void>;
}) {
  const [user, setUser] = useState<Awaited<ReturnType<TeamAuthPort['currentUser']>>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [plantName, setPlantName] = useState('Main plant');
  const [warehouseName, setWarehouseName] = useState('Main warehouse');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const companyKey = useRef(crypto.randomUUID());
  useEffect(() => {
    void auth
      .currentUser()
      .then(async (current) => {
        setUser(current);
      })
      .catch((cause) =>
        setMessage(cause instanceof Error ? cause.message : 'Authentication unavailable.'),
      );
  }, [auth]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      const current = await auth.currentUser();
      setUser(current);

      await onChange();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Cloud request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel className="create-workspace">
      {!user ? (
        <>
          <h2>Sign in to Team online</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void action(() => auth.signIn(email, password));
            }}
          >
            <Field label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                autoComplete="current-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <div className="form-actions">
              <Button disabled={busy}>Sign in</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await auth.signUp(email, password);
                    setMessage(
                      'Check your email to verify registration. Local development uses mail capture.',
                    );
                  })
                }
              >
                Register
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !email}
                onClick={() =>
                  void action(async () => {
                    await auth.recover(email);
                    setMessage('Recovery requested. Check the configured mail delivery.');
                  })
                }
              >
                Recover password
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="panel-heading">
            <div>
              <h2>{user.email}</h2>
              <Badge tone={user.verified ? 'success' : 'warning'}>
                {user.verified ? 'Verified account' : 'Email verification required'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void action(() => auth.signOut())}
            >
              Sign out
            </Button>
          </div>
          {user.verified ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  await auth.createCompany(
                    { name, plantName, warehouseName, currency, timezone },
                    companyKey.current,
                  );
                  companyKey.current = crypto.randomUUID();
                  setName('');
                });
              }}
            >
              <h3>Create company</h3>
              <Field label="Company name">
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Initial plant">
                <input
                  required
                  value={plantName}
                  onChange={(event) => setPlantName(event.target.value)}
                />
              </Field>
              <Field label="Initial warehouse">
                <input
                  required
                  value={warehouseName}
                  onChange={(event) => setWarehouseName(event.target.value)}
                />
              </Field>
              <Field label="Currency">
                <input
                  required
                  pattern="[A-Z]{3}"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Timezone">
                <input
                  required
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                />
              </Field>
              <Button disabled={busy}>Create company atomically</Button>
            </form>
          ) : null}
          {user.verified ? (
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  await auth.acceptInvitation(token);
                  setToken('');
                  setMessage('Invitation accepted under current verified identity.');
                });
              }}
            >
              <Field label="Invitation token">
                <input
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Button disabled={busy}>Accept invitation</Button>
            </form>
          ) : null}
          {user.verified ? <AuthSecurity auth={auth} /> : null}
        </>
      )}
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
    </Panel>
  );
}
