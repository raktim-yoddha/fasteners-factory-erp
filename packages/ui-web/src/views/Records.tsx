import { useState } from 'react';
import { Plus, ArrowUpRight, FileText } from 'lucide-react';
import { recordFields, type BusinessRecord, type EntityKind } from '@fasteners/contracts';
import { isImmutable, multiply, transitions } from '@fasteners/domain';
import { Badge, Button, Dialog, EmptyState, Field, PageHeading, Panel, Table } from '../components';
import { useFactory } from '../context';
import { ActionButton } from '../ActionButton';
export const moduleKinds: Record<string, EntityKind[]> = {
  masters: ['customer', 'supplier', 'item'],
  engineering: ['engineering'],
  sales: ['rfq', 'quotation', 'sales_order'],
  procurement: ['purchase_order'],
  production: ['work_order'],
  equipment: ['equipment'],
  quality: ['ncr'],
  jobwork: ['jobwork'],
};
export function Records({ module, filter }: { module: string; filter: string }) {
  const { snapshot, run, busy } = useFactory();
  const kinds = moduleKinds[module] ?? ['item'];
  const [kind, setKind] = useState<EntityKind>(kinds[0]!);
  const [editing, setEditing] = useState<BusinessRecord | null | undefined>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<BusinessRecord | null>(null);
  const rows = snapshot.records.filter(
    (row) =>
      row.kind === kind &&
      `${row.code} ${row.name} ${row.state}`.toLowerCase().includes(filter.toLowerCase()),
  );
  function open(record: BusinessRecord | null) {
    setEditing(record);
    setCode(record?.code ?? '');
    setName(record?.name ?? '');
    setFields(
      record?.fields ??
        Object.fromEntries(
          recordFields[kind]
            .filter((field) => field.default)
            .map((field) => [field.key, field.default!]),
        ),
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (
      await run(
        'save_record',
        { kind, code, name, fields, ...(editing ? { id: editing.id } : {}) },
        editing?.revision,
      )
    )
      setEditing(undefined);
  }
  const selected = detail ? (snapshot.records.find((row) => row.id === detail.id) ?? null) : null;
  return (
    <>
      <PageHeading
        eyebrow={module.toUpperCase()}
        title={
          module === 'masters' ? 'The foundations of your factory' : module.replaceAll('_', ' ')
        }
        description="Authority-scoped records. Approved revisions retain their history."
        action={
          <ActionButton
            command="save_record"
            payload={{ kind, code, name, fields }}
            onClick={() => open(null)}
          >
            <Plus size={16} /> New {kind.replaceAll('_', ' ')}
          </ActionButton>
        }
      />
      <div className="tabs">
        {kinds.map((value) => (
          <button
            key={value}
            className={kind === value ? 'selected' : ''}
            onClick={() => {
              setKind(value);
              setDetail(null);
            }}
          >
            {value.replaceAll('_', ' ')}{' '}
            <span>{snapshot.records.filter((row) => row.kind === value).length}</span>
          </button>
        ))}
      </div>
      <Panel>
        {rows.length ? (
          <Table headers={['Reference', 'Name', 'Status', 'Revision', 'Details']}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">{row.code}</td>
                <td>
                  <strong>{row.name}</strong>
                  {row.fields.quantity ? (
                    <small>
                      {row.fields.quantity}{' '}
                      {snapshot.records.find((item) => item.id === row.fields.itemId)?.fields
                        .unit ?? ''}
                    </small>
                  ) : null}
                </td>
                <td>
                  <Badge
                    tone={
                      ['approved', 'active', 'ready', 'fulfilled', 'closed'].includes(row.state)
                        ? 'success'
                        : row.state === 'blocked'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {row.state.replaceAll('_', ' ')}
                  </Badge>
                </td>
                <td className="mono">r{row.revision}</td>
                <td>
                  <Button
                    variant="ghost"
                    aria-label={`Open ${row.code}`}
                    onClick={() => setDetail(row)}
                  >
                    <ArrowUpRight size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title={`No ${kind.replaceAll('_', ' ')} records`}
            description="Create real records or explicitly load a fictional SAMPLE workspace."
            action={
              <ActionButton
                command="save_record"
                payload={{ kind, code: '', name: '', fields: {} }}
                variant="secondary"
                onClick={() => open(null)}
              >
                Create first record
              </ActionButton>
            }
          />
        )}
      </Panel>
      {selected ? (
        <Panel className="detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {selected.code} / REVISION {selected.revision}
              </p>
              <h2>{selected.name}</h2>
            </div>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
          <dl className="details">
            {Object.entries(selected.fields).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {recordFields[selected.kind].find((field) => field.key === key)?.label ?? key}
                </dt>
                <dd>{snapshot.records.find((row) => row.id === value)?.code ?? value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {selected.fields.unitPrice && selected.fields.quantity ? (
            <p className="total">
              Calculated line value: {multiply(selected.fields.unitPrice, selected.fields.quantity)}{' '}
              {snapshot.workspace.currency}
            </p>
          ) : null}
          <div className="action-row">
            {!isImmutable(selected.kind, selected.state) ? (
              <ActionButton
                command="save_record"
                payload={{
                  kind: selected.kind,
                  id: selected.id,
                  code: selected.code,
                  name: selected.name,
                  fields: selected.fields,
                }}
                variant="secondary"
                onClick={() => open(selected)}
              >
                Edit draft / master
              </ActionButton>
            ) : null}
            {(transitions[selected.kind][selected.state] ?? []).map((next) => (
              <ActionButton
                command="transition_record"
                payload={{ id: selected.id, state: next }}
                key={next}
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    'transition_record',
                    { id: selected.id, state: next, reason: 'Owner requested state transition' },
                    selected.revision,
                  )
                }
              >
                {next.replaceAll('_', ' ')}
              </ActionButton>
            ))}
            <Button variant="ghost" onClick={() => window.print()}>
              <FileText size={16} /> Print current record
            </Button>
          </div>
          {selected.kind === 'engineering' ? (
            <p className="notice">
              Initial engineering revision stores an operation sequence and drawing reference.
              Immutable file versions and multi-component BOM/routing approval remain pending.
            </p>
          ) : null}
        </Panel>
      ) : null}
      {editing !== undefined ? (
        <Dialog
          title={`${editing ? 'Edit' : 'New'} ${kind.replaceAll('_', ' ')}`}
          onClose={() => setEditing(undefined)}
        >
          <form onSubmit={(event) => void save(event)} className="form-grid">
            <Field label="Reference code">
              <input
                required
                maxLength={80}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Display name">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            {recordFields[kind].map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                {['text', 'date', 'decimal'].includes(field.type) ? (
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    inputMode={field.type === 'decimal' ? 'decimal' : undefined}
                    required={field.required}
                    value={fields[field.key] ?? ''}
                    onChange={(event) =>
                      setFields((previous) => ({ ...previous, [field.key]: event.target.value }))
                    }
                  />
                ) : (
                  <select
                    required={field.required}
                    value={fields[field.key] ?? ''}
                    onChange={(event) =>
                      setFields((previous) => ({ ...previous, [field.key]: event.target.value }))
                    }
                  >
                    <option value="">Choose {field.label.toLowerCase()}</option>
                    {(field.type === 'lot'
                      ? snapshot.lots.map((lot) => ({
                          id: lot.id,
                          code: lot.code,
                          name: lot.itemName,
                        }))
                      : snapshot.records.filter((row) => row.kind === field.type)
                    ).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} — {option.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ))}
            <div className="form-actions">
              <Button variant="secondary" type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <ActionButton
                command="save_record"
                payload={{ kind, code, name, fields }}
                type="submit"
                disabled={busy}
              >
                {busy ? 'Committing…' : 'Save to authority'}
              </ActionButton>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
