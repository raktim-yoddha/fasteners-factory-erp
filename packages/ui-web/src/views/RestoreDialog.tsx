import { useEffect, useState } from 'react';
import type { RecoveryPreview, Workspace } from '@fasteners/contracts';
import type { RecoveryJournal, SnapshotRecoveryPort } from '@fasteners/application';
import { Button, Dialog, Field, Table } from '../components';

export function RestoreDialog({
  recovery,
  journal,
  checkPending,
  onActivated,
  onPendingChange,
  onClose,
}: {
  recovery: SnapshotRecoveryPort;
  journal: RecoveryJournal;
  checkPending: () => void;
  onActivated: (workspaces: Workspace[]) => Promise<void>;
  onPendingChange: (pending: boolean) => void;
  onClose: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [blocked, setBlocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const pending = journal.read();
      if (pending) {
        setPreview(pending);
        setUnknown(true);
      } else checkPending();
      setBlocked(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recovery storage is unavailable.');
    }
  }, [journal, checkPending]);
  async function review() {
    if (busy || blocked || unknown) return;
    setBusy(true);
    setError('');
    try {
      checkPending();
      setPreview(await recovery.preview(passphrase));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Snapshot review failed.');
    } finally {
      setPassphrase('');
      setBusy(false);
    }
  }
  async function activate() {
    if (!preview || busy || blocked) return;
    setBusy(true);
    setError('');
    let sent = false;
    try {
      if (!unknown) checkPending();
      journal.save(preview);
      onPendingChange(true);
      sent = true;
      const workspaces = await recovery.activate(preview.token);
      journal.clear();
      await onActivated(workspaces);
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Restore activation failed.';
      if (
        sent &&
        /^(BACKUP_INVALID|SCHEMA_INCOMPATIBLE|REVISION_CONFLICT|INVALID_INPUT):/.test(message)
      ) {
        try {
          journal.clear();
          onPendingChange(false);
          setUnknown(false);
          setPreview(null);
        } catch {
          setUnknown(true);
        }
      } else if (sent) setUnknown(true);
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy || unknown) return;
    if (preview) void recovery.cancel(preview.token).catch(() => undefined);
    onClose();
  }
  return (
    <Dialog title="Restore encrypted database snapshot" onClose={close}>
      <p className="notice">
        Restores every local workspace in the snapshot together. The current database is retained
        unchanged for recovery. This database-only format has no attachment archive and does not
        change online companies.
      </p>
      {unknown ? (
        <p role="status" className="notice">
          Confirmation unknown — retry the original restore token to resolve the selected database.
        </p>
      ) : null}
      {preview ? (
        <>
          <p>
            Snapshot created: <strong>{new Date(preview.createdAt).toLocaleString()}</strong>
          </p>
          <p>
            {preview.counts.records} records · {preview.counts.lots} lots · {preview.counts.ledger}{' '}
            stock events · {preview.counts.audit} audit events
          </p>
          <Table headers={['Workspace', 'Currency', 'Timezone']}>
            {preview.workspaces.map((workspace) => (
              <tr key={workspace.id}>
                <td>{workspace.name}</td>
                <td>{workspace.currency}</td>
                <td>{workspace.timezone}</td>
              </tr>
            ))}
          </Table>
          {!preview.workspaces.length ? <p>This snapshot contains no workspaces.</p> : null}
          <p className="muted">
            IDs, original local provenance and committed history are preserved. Current workspaces
            absent from this snapshot remain in the retained previous database.
          </p>
          <div className="form-actions">
            <Button variant="secondary" disabled={busy || unknown} onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy || blocked} onClick={() => void activate()}>
              {busy
                ? 'Verifying activation…'
                : unknown
                  ? 'Retry original restore'
                  : 'Activate reviewed snapshot'}
            </Button>
          </div>
        </>
      ) : (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void review();
          }}
        >
          <Field label="Backup passphrase (at least 12 characters)">
            <input
              type="password"
              required
              minLength={12}
              maxLength={1024}
              autoComplete="off"
              value={passphrase}
              disabled={busy || blocked}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy || blocked || passphrase.length < 12}>
              {busy ? 'Validating snapshot…' : 'Choose snapshot and review'}
            </Button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="feedback error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
