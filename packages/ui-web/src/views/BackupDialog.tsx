import { useState } from 'react';
import { Button, Dialog, Field } from '../components';

export function BackupDialog({
  onExport,
  onClose,
}: {
  onExport: (passphrase: string) => Promise<void>;
  onClose: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="Export encrypted database snapshot"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || passphrase.length < 12 || passphrase !== confirmation) return;
          setBusy(true);
          setError('');
          void onExport(passphrase)
            .then(() => {
              setPassphrase('');
              setConfirmation('');
              onClose();
            })
            .catch((cause) =>
              setError(cause instanceof Error ? cause.message : 'Snapshot export failed.'),
            )
            .finally(() => setBusy(false));
        }}
      >
        <p className="notice">
          Includes every solo workspace on this device. This is a database-only encrypted snapshot;
          portable files remain pending. Desktop restore is available from the local workspace
          selector. Keep the passphrase separately. There is no account-based password recovery.
        </p>
        <Field label="Snapshot passphrase (at least 12 characters)">
          <input
            required
            type="password"
            minLength={12}
            maxLength={1024}
            autoComplete="new-password"
            disabled={busy}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </Field>
        <Field label="Confirm passphrase">
          <input
            required
            type="password"
            autoComplete="new-password"
            disabled={busy}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="feedback error">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || passphrase.length < 12 || passphrase !== confirmation}>
            {busy ? 'Encrypting and saving…' : 'Choose destination and export'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
