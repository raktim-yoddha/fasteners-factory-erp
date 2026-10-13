import { useCallback, useEffect, useState } from 'react';
import type { CompanySetupStore, TeamAuthPort } from '@fasteners/application';
import { Badge, Button, Field, Panel } from '../components';
import { AuthSecurity } from './AuthSecurity';
import { CompanySetup } from './CompanySetup';
export function TeamOnboarding({
  auth,
  onChange,
  companySetupStore,
  onBlockedChange,
}: {
  auth: TeamAuthPort;
  onChange: () => Promise<void>;
  companySetupStore: CompanySetupStore;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const [user, setUser] = useState<Awaited<ReturnType<TeamAuthPort['currentUser']>>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [setupBlocked, setSetupBlocked] = useState(false);
  const updateSetupBlocked = useCallback(
    (blocked: boolean) => {
      setSetupBlocked(blocked);
      onBlockedChange(blocked);
    },
    [onBlockedChange],
  );
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
            <CompanySetup
              key={user.id}
              actorId={user.id}
              auth={auth}
              store={companySetupStore}
              onChange={onChange}
              onBlockedChange={updateSetupBlocked}
            />
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
              <Button disabled={busy || setupBlocked}>Accept invitation</Button>
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
