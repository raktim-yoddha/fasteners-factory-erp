import { useState } from 'react';
import type { Repository, Workspace } from '@fasteners/contracts';
import { createSampleWorkspace } from '@fasteners/test-fixtures';
import { Button, Field, Panel } from '../components';
export function CreateSolo({
  repository,
  onCreated,
}: {
  repository: Repository;
  onCreated: (workspace: Workspace) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(sample = false) {
    setBusy(true);
    setError('');
    try {
      const workspace = sample
        ? await createSampleWorkspace(repository)
        : await repository.createWorkspace({ name, currency, timezone });
      await onCreated(workspace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Workspace creation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel className="create-workspace">
      <h2>Create a new local workspace</h2>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Field label="Workspace name">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your factory name"
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
        <Field label="Plant timezone">
          <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </Field>
        <div className="form-actions">
          <Button type="submit" disabled={busy}>
            Create empty workspace
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void create(true)}
          >
            Load fictional SAMPLE workspace
          </Button>
        </div>
      </form>
      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="muted">
        No stock, people or customers are invented in an empty workspace. SAMPLE is opt-in.
      </p>
    </Panel>
  );
}
