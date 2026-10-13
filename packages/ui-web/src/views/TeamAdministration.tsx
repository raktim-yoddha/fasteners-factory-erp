import { AuthSecurity } from './AuthSecurity';
import { useEffect, useRef, useState } from 'react';
import type {
  MemberAccess,
  TeamAdministrationPort,
  TeamAdministrationSnapshot,
  TeamAuthPort,
} from '@fasteners/application';
import { Badge, Button, Dialog, Field, PageHeading, Panel, Table } from '../components';
export function TeamAdministration({
  companyId,
  administration,
  auth,
  onPlantChange,
}: {
  companyId: string;
  administration: TeamAdministrationPort;
  auth: TeamAuthPort;
  onPlantChange: (plantId: string) => void;
}) {
  const [data, setData] = useState<TeamAdministrationSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [allPlants, setAllPlants] = useState(false);
  const [editing, setEditing] = useState<MemberAccess | null>(null);
  const [name, setName] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [target, setTarget] = useState('');
  const inviteKey = useRef(crypto.randomUUID());
  const editKey = useRef(crypto.randomUUID());
  const plantKey = useRef(crypto.randomUUID());
  async function load() {
    setData(await administration.snapshot(companyId));
  }
  useEffect(() => {
    let active = true;
    void administration
      .snapshot(companyId)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Administration unavailable.');
      });
    return () => {
      active = false;
    };
  }, [administration, companyId]);
  async function action(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await operation();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Company command failed. Preserve its request key when confirmation is unknown.',
      );
    } finally {
      setBusy(false);
    }
  }
  const toggle = (values: string[], value: string) =>
    values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const currentIsOwner =
    data?.members.find((member) => member.id === data.actorId)?.roles.includes('Owner') ?? false;
  return (
    <>
      <PageHeading
        eyebrow="COMPANY ACCESS"
        title="The right people. The right access."
        description="Current memberships, multiple roles, explicit grants and plant scope. Server rules remain authoritative."
      />
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
      <AuthSecurity auth={auth} />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void action(() => administration.manage(companyId, 'accept_transfer', {}))}
      >
        Accept ownership transfer addressed to me
      </Button>
      {data ? (
        <>
          <Panel>
            <div className="panel-heading">
              <h2>Members</h2>
              <Badge>{data.members.filter((member) => member.active).length} active</Badge>
            </div>
            <Table headers={['Member', 'Roles', 'Plant scope', 'State', 'Access']}>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td>{member.email}</td>
                  <td>
                    {member.roles.join(', ')}
                    {member.grants.length ? (
                      <small>Explicit: {member.grants.join(', ')}</small>
                    ) : null}
                  </td>
                  <td>
                    {member.allPlants
                      ? 'All plants'
                      : member.plantIds
                          .map((id) => data.plants.find((plant) => plant.id === id)?.name ?? id)
                          .join(', ')}
                  </td>
                  <td>
                    <Badge tone={member.active ? 'success' : 'neutral'}>
                      {member.active ? 'Active' : 'Revoked'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      disabled={busy || member.roles.includes('Owner')}
                      title={
                        member.roles.includes('Owner')
                          ? 'Ownership changes require accepted transfer.'
                          : undefined
                      }
                      onClick={() => {
                        setEditing({
                          ...member,
                          roles: [...member.roles],
                          plantIds: [...member.plantIds],
                          grants: [...member.grants],
                        });
                        editKey.current = crypto.randomUUID();
                      }}
                    >
                      Edit access
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel className="create-workspace">
            <h2>Create invitation</h2>
            <p className="muted">
              Bound to verified matching email. No external message is sent automatically.
            </p>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  const result = await administration.invite(
                    companyId,
                    { email, roles, plantIds, allPlants },
                    inviteKey.current,
                  );
                  setMessage(
                    `Invitation created. Give the intended member this single-use token through an authorized channel: ${result.token}`,
                  );
                  inviteKey.current = crypto.randomUUID();
                });
              }}
            >
              <Field label="Intended email">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <fieldset className="choice-group">
                <legend>Roles (multiple allowed)</legend>
                {data.roles
                  .filter((role) => role.name !== 'Owner')
                  .map((role) => (
                    <label className="check-row" key={role.name}>
                      <input
                        type="checkbox"
                        checked={roles.includes(role.name)}
                        disabled={!role.delegable}
                        onChange={() => setRoles(toggle(roles, role.name))}
                      />
                      {role.name}
                      {!role.delegable ? ' — cannot delegate' : ''}
                    </label>
                  ))}
              </fieldset>
              <fieldset className="choice-group">
                <legend>Plant scope</legend>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={allPlants}
                    onChange={(event) => setAllPlants(event.target.checked)}
                  />
                  All plants
                </label>
                {data.plants.map((plant) => (
                  <label className="check-row" key={plant.id}>
                    <input
                      type="checkbox"
                      checked={plantIds.includes(plant.id)}
                      disabled={allPlants}
                      onChange={() => setPlantIds(toggle(plantIds, plant.id))}
                    />
                    {plant.name}
                  </label>
                ))}
              </fieldset>
              <div className="form-actions">
                <Button disabled={busy || !roles.length || (!allPlants && !plantIds.length)}>
                  Create verified-email invitation
                </Button>
              </div>
            </form>
          </Panel>
          <Panel className="create-workspace">
            <h2>Plants and warehouses</h2>
            <div className="action-row">
              {data.plants.map((plant) => (
                <Button variant="secondary" key={plant.id} onClick={() => onPlantChange(plant.id)}>
                  Open {plant.name}
                </Button>
              ))}
            </div>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  await administration.createPlant(
                    companyId,
                    { name, warehouseName: warehouse },
                    plantKey.current,
                  );
                  plantKey.current = crypto.randomUUID();
                  setName('');
                  setWarehouse('');
                });
              }}
            >
              <Field label="New plant name">
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Initial warehouse">
                <input
                  required
                  value={warehouse}
                  onChange={(event) => setWarehouse(event.target.value)}
                />
              </Field>
              <div className="form-actions">
                <Button disabled={busy}>Create plant atomically</Button>
              </div>
            </form>
          </Panel>
          <Panel className="create-workspace">
            <h2>Review and ownership policy</h2>
            <p className="notice">
              Independent review checks actor identity even when a member holds multiple roles.
              Owner access does not bypass QC.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={data.settings.independentReview}
                disabled={busy || !currentIsOwner}
                onChange={(event) =>
                  void action(() =>
                    administration.manage(companyId, 'independent_review', {
                      enabled: event.target.checked,
                    }),
                  )
                }
              />
              Require a reviewer distinct from the inspector
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={data.settings.requireMfa}
                disabled={busy || !currentIsOwner}
                onChange={(event) =>
                  void action(() =>
                    administration.manage(companyId, 'require_mfa', {
                      enabled: event.target.checked,
                    }),
                  )
                }
              />
              Require AAL2 MFA for company mutations
            </label>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void action(() => administration.manage(companyId, 'request_transfer', { target }));
              }}
            >
              <Field label="Receiving active member">
                <select required value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="">Choose verified active member</option>
                  {data.members
                    .filter((member) => member.active && member.id !== data.actorId)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.email}
                      </option>
                    ))}
                </select>
              </Field>
              <Button disabled={busy || !currentIsOwner}>Request ownership transfer</Button>
            </form>
            <div className="action-row">
              <Button
                variant="danger"
                disabled={busy || !currentIsOwner}
                onClick={() => {
                  if (
                    window.confirm(
                      'Archive this company? New business commands will be blocked; authorized history remains readable.',
                    )
                  )
                    void action(() => administration.manage(companyId, 'archive', {}));
                }}
              >
                Archive company
              </Button>
            </div>
          </Panel>
        </>
      ) : null}
      {editing && data ? (
        <Dialog title={`Edit access — ${editing.email}`} onClose={() => setEditing(null)}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await administration.updateAccess(companyId, editing, editKey.current);
                editKey.current = crypto.randomUUID();
                setEditing(null);
              });
            }}
          >
            <fieldset className="choice-group">
              <legend>Roles</legend>
              {data.roles
                .filter((role) => role.name !== 'Owner')
                .map((role) => (
                  <label className="check-row" key={role.name}>
                    <input
                      type="checkbox"
                      checked={editing.roles.includes(role.name)}
                      disabled={!role.delegable}
                      onChange={() =>
                        setEditing({ ...editing, roles: toggle(editing.roles, role.name) })
                      }
                    />
                    {role.name}
                  </label>
                ))}
            </fieldset>
            <fieldset className="choice-group">
              <legend>Plant scope</legend>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={editing.allPlants}
                  onChange={(event) => setEditing({ ...editing, allPlants: event.target.checked })}
                />
                All plants
              </label>
              {data.plants.map((plant) => (
                <label className="check-row" key={plant.id}>
                  <input
                    type="checkbox"
                    checked={editing.plantIds.includes(plant.id)}
                    disabled={editing.allPlants}
                    onChange={() =>
                      setEditing({ ...editing, plantIds: toggle(editing.plantIds, plant.id) })
                    }
                  />
                  {plant.name}
                </label>
              ))}
            </fieldset>
            <Field
              label="Explicit approval grants (comma-separated permission keys)"
              hint="Only permissions you currently hold can be delegated. Ownership permissions cannot be granted this way."
            >
              <input
                value={editing.grants.join(', ')}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    grants: event.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
              />
              Membership active
            </label>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button disabled={busy || !editing.roles.length}>Apply current access</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
