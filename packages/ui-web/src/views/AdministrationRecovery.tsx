import type { AdministrationRecoveryState } from '../useAdministrationRecovery';
import { Button, Panel } from '../components';

export function AdministrationRecovery({ recovery }: { recovery: AdministrationRecoveryState }) {
  const { pending, committed, storageIssue, error, busy } = recovery;
  if (!pending && !committed && !error && !storageIssue && !busy) return null;
  const operation = pending?.operation;
  return (
    <Panel>
      <h2>
        {pending
          ? committed
            ? 'Administration committed — local cleanup pending'
            : 'Administration confirmation unknown'
          : committed
            ? 'Administration committed'
            : 'Administration recovery'}
      </h2>
      {busy ? <p role="status">Awaiting authority confirmation.</p> : null}
      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}
      {pending && operation ? (
        <>
          <p className="notice">
            Original company: {pending.companyId}. Request: {pending.requestKey}.
          </p>
          <p>
            {operation.command === 'invite_member'
              ? `Invite ${operation.input.email}: ${operation.input.roles.join(', ')}`
              : operation.command === 'create_plant'
                ? `Create ${operation.input.name} / ${operation.input.warehouseName}`
                : `Update access for ${operation.input.email || operation.input.id}: ${operation.input.active ? 'active' : 'revoked'}`}
          </p>
          <p className="muted">
            The original fields and key are retained. A denied retry cannot disprove an earlier
            commit.
          </p>
          <Button
            disabled={busy || storageIssue}
            onClick={() => {
              void recovery.retry().catch(() => undefined);
            }}
          >
            Retry original administration request
          </Button>
        </>
      ) : null}
      {storageIssue ? (
        <Button variant="secondary" disabled={busy} onClick={recovery.recheck}>
          Recheck administration storage
        </Button>
      ) : null}
      {committed ? (
        <div role="status">
          <p>
            Committed {committed.result.value.command.replaceAll('_', ' ')}:{' '}
            {committed.result.value.id}.
          </p>
          {committed.result.value.command === 'invite_member' ? (
            <p>
              Give the intended member this single-use token through an authorized channel:{' '}
              <code>{committed.result.value.token}</code>
            </p>
          ) : null}
          {!committed.result.journalCleared ? (
            <p>Local cleanup failed. Retry the original request before continuing.</p>
          ) : null}
          {!pending && !storageIssue ? (
            <Button variant="secondary" onClick={recovery.dismiss}>
              Dismiss confirmed result
            </Button>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
