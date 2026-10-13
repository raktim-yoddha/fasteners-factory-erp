import { useEffect, useMemo, useState } from 'react';
import {
  CompanySetupController,
  type CompanySetupStore,
  type TeamAuthPort,
} from '@fasteners/application';
import type { CompanySetupRequest } from '@fasteners/contracts';
import { Button, Field } from '../components';

export function CompanySetup({
  auth,
  store,
  actorId,
  onChange,
  onBlockedChange,
}: {
  auth: TeamAuthPort;
  store: CompanySetupStore;
  actorId: string;
  onChange: () => Promise<void>;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const controller = useMemo(() => new CompanySetupController(auth, store), [auth, store]);
  const [pending, setPending] = useState<CompanySetupRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageIssue, setStorageIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmedCompanyId, setConfirmedCompanyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [plantName, setPlantName] = useState('Main plant');
  const [warehouseName, setWarehouseName] = useState('Main warehouse');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  function readOriginal() {
    try {
      setPending(controller.read(actorId));
      setStorageIssue(false);
    } catch (cause) {
      setStorageIssue(true);
      setError(cause instanceof Error ? cause.message : 'Company request storage unavailable.');
    }
  }
  useEffect(() => {
    try {
      setPending(controller.read(actorId));
    } catch (cause) {
      setStorageIssue(true);
      setError(cause instanceof Error ? cause.message : 'Company request storage unavailable.');
    }
    setLoading(false);
  }, [controller, actorId]);
  useEffect(() => {
    onBlockedChange(loading || busy || storageIssue || Boolean(pending));
    return () => onBlockedChange(false);
  }, [loading, busy, storageIssue, pending, onBlockedChange]);

  async function send(retry: boolean) {
    if (busy || loading || storageIssue) return;
    setBusy(true);
    setError('');
    setMessage('Submitting company setup — awaiting authority confirmation.');
    try {
      const result = retry
        ? await controller.retry(actorId)
        : await controller.submit(actorId, { name, plantName, warehouseName, currency, timezone });
      setConfirmedCompanyId(result.companyId);
      setMessage(
        `Company committed: ${result.companyId}.${result.journalCleared ? '' : ' Local request cleanup failed; retry the original confirmation before continuing.'}`,
      );
      if (result.journalCleared) setName('');
      try {
        await onChange();
      } catch {
        setError('Company committed. Company list refresh failed; refresh the list to open it.');
      }
    } catch (cause) {
      setMessage('');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Company confirmation unknown. Preserve the original request.',
      );
    } finally {
      readOriginal();
      setBusy(false);
    }
  }
  return (
    <>
      <h3>Create company</h3>
      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      {pending ? (
        <div className="notice" role="status">
          <strong>
            {confirmedCompanyId
              ? 'Company committed — local request cleanup pending.'
              : 'Confirmation unknown — original company setup retained.'}
          </strong>
          <p>
            {pending.input.name} · {pending.input.plantName} · {pending.input.warehouseName}
          </p>
          <p>
            {pending.input.currency} · {pending.input.timezone}
          </p>
          <p className="muted">
            Request: {pending.requestKey}. Retry with this account to{' '}
            {confirmedCompanyId ? 'finish local cleanup' : 'confirm its outcome'}.
          </p>
          <Button type="button" disabled={busy || storageIssue} onClick={() => void send(true)}>
            Retry original company setup
          </Button>
        </div>
      ) : null}
      {storageIssue ? (
        <Button type="button" variant="secondary" onClick={readOriginal}>
          Recheck company request storage
        </Button>
      ) : null}
      {!pending ? (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void send(false);
          }}
        >
          <Field label="Company name">
            <input
              disabled={loading || busy || storageIssue}
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Initial plant">
            <input
              disabled={loading || busy || storageIssue}
              required
              maxLength={200}
              value={plantName}
              onChange={(event) => setPlantName(event.target.value)}
            />
          </Field>
          <Field label="Initial warehouse">
            <input
              disabled={loading || busy || storageIssue}
              required
              maxLength={200}
              value={warehouseName}
              onChange={(event) => setWarehouseName(event.target.value)}
            />
          </Field>
          <Field label="Currency">
            <input
              disabled={loading || busy || storageIssue}
              required
              pattern="[A-Z]{3}"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Timezone">
            <input
              disabled={loading || busy || storageIssue}
              required
              maxLength={100}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </Field>
          <div className="form-actions">
            <Button disabled={loading || busy || storageIssue}>Create company atomically</Button>
          </div>
        </form>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setError('');
          void onChange().catch(() => setError('Company list refresh failed.'));
        }}
      >
        Refresh company list
      </Button>
    </>
  );
}
