import { ArrowUpRight, Box, ClipboardList, ShieldCheck, Truck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, PageHeading, Panel, Stat, Table } from '../components';
import { useFactory } from '../context';
export function Overview() {
  const { snapshot } = useFactory();
  const orders = snapshot.records.filter((row) => row.kind === 'sales_order');
  const openOrders = orders.filter((row) =>
    ['accepted', 'partially_fulfilled'].includes(row.state),
  );
  const held = snapshot.lots.filter((lot) => lot.qcState === 'held');
  const work = snapshot.records.filter(
    (row) => row.kind === 'work_order' && !['closed', 'cancelled'].includes(row.state),
  );
  return (
    <>
      <PageHeading
        eyebrow="FACTORY OVERVIEW"
        title="A clear view of your floor."
        description="Committed records, current blockers, and the next step."
        action={
          <Badge tone="success">
            <Activity size={12} /> Database confirmed
          </Badge>
        }
      />
      <div className="stats">
        <Stat
          label="Open orders"
          value={openOrders.length}
          detail="Accepted demand awaiting fulfilment"
          icon={<ClipboardList size={18} />}
        />
        <Stat
          label="Stock lots"
          value={snapshot.lots.length}
          detail="Separate exact balances by lot and unit"
          icon={<Box size={18} />}
        />
        <Stat
          label="Quality holds"
          value={held.length}
          detail="Issue, packing and dispatch blocked"
          icon={<ShieldCheck size={18} />}
        />
        <Stat
          label="Active work orders"
          value={work.length}
          detail="Recorded work, including blocked work"
          icon={<Activity size={18} />}
        />
      </div>
      <div className="overview-grid">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Order command center</h2>
              <p className="muted">Customer demand, through to dispatch.</p>
            </div>
            <Button asChild variant="ghost">
              <Link to="/app/sales">
                All orders <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          {orders.length ? (
            <Table headers={['Order / customer', 'Due date', 'Quantity', 'State']}>
              {orders.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.code}</strong>
                    <small>
                      {snapshot.records.find((customer) => customer.id === row.fields.customerId)
                        ?.name ?? row.name}
                    </small>
                  </td>
                  <td>{row.fields.dueDate ?? '—'}</td>
                  <td className="mono">
                    {row.fields.quantity}{' '}
                    {snapshot.records.find((item) => item.id === row.fields.itemId)?.fields.unit ??
                      ''}
                  </td>
                  <td>
                    <Badge tone={row.state === 'fulfilled' ? 'success' : 'neutral'}>
                      {row.state.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="Your first order starts here"
              description="Add masters and approved engineering, then accept a quotation-backed sales order."
              action={
                <Button asChild variant="secondary">
                  <Link to="/app/sales">Open sales</Link>
                </Button>
              }
            />
          )}
        </Panel>
        <Panel className="blockers">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p className="muted">Specific blockers. Clear next actions.</p>
            </div>
            <Badge tone="warning">{held.length}</Badge>
          </div>
          {held.length ? (
            held.slice(0, 5).map((lot) => (
              <Link key={lot.id} to="/app/stock" className="blocker">
                <span className="blocker-icon">
                  <ShieldCheck size={18} />
                </span>
                <span>
                  <strong>{lot.code} — QC hold</strong>
                  <small>{lot.itemName}. Inspect and attest release.</small>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <EmptyState
              title="No current QC holds"
              description="New receipts and returns enter held stock automatically."
            />
          )}
        </Panel>
      </div>
      <Panel>
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">Actions recorded by the active authority.</p>
          </div>
          <Truck size={20} />
        </div>
        <div className="activity-list">
          {snapshot.audit.slice(0, 5).map((event) => (
            <div key={event.id}>
              <span className="activity-dot" />
              <strong>{event.command.replaceAll('_', ' ')}</strong>
              <span>{event.reason || event.actor}</span>
              <time>
                {new Date(event.createdAt).toLocaleString('en-IN', {
                  timeZone: snapshot.workspace.timezone,
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          ))}
        </div>
      </Panel>
      <p className="as-of">
        As of{' '}
        {new Date(snapshot.asOf).toLocaleString('en-IN', { timeZone: snapshot.workspace.timezone })}
        . Dashboard counts reflect the bounded current record window.
      </p>
    </>
  );
}
