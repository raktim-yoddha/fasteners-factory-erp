import { Badge, Button, PageHeading, Panel, Table } from '../components';
import { useFactory } from '../context';
export function Reports({ audit = false }: { audit?: boolean }) {
  const { snapshot } = useFactory();
  return (
    <>
      <PageHeading
        eyebrow={audit ? 'AUDIT HISTORY' : 'REPORTS'}
        title={audit ? 'Recorded. Never overwritten.' : 'Facts you can act on.'}
        description={`Bounded current snapshot · ${snapshot.asOf}`}
        action={
          !audit ? (
            <Button
              variant="secondary"
              disabled
              title="Exports await separate permission enforcement, an exact approved snapshot and a committed export audit."
            >
              Export visible stock CSV
            </Button>
          ) : undefined
        }
      />
      {audit ? (
        <Panel>
          <Table headers={['Time', 'Command', 'Actor / provenance', 'Reason']}>
            {snapshot.audit.map((event) => (
              <tr key={event.id}>
                <td>
                  {new Date(event.createdAt).toLocaleString('en-IN', {
                    timeZone: snapshot.workspace.timezone,
                  })}
                </td>
                <td>{event.command.replaceAll('_', ' ')}</td>
                <td>{event.actor}</td>
                <td>{event.reason || '—'}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : (
        <>
          <div className="notice">
            Export is unavailable until permission and audit gates are implemented. This table
            contains the visible stock read snapshot. Approved accounting exports, audit-logged
            cloud exports and complete paginated reports remain pending. Quantities are never
            totalled across unlike units.
          </div>
          <Panel>
            <Table
              headers={[
                'Lot',
                'Item',
                'Unit',
                'Stores',
                'Reserved',
                'Available',
                'WIP',
                'Vendor',
                'QC',
              ]}
            >
              {snapshot.lots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.code}</td>
                  <td>{lot.itemName}</td>
                  <td>{lot.unit}</td>
                  <td className="mono">{lot.onHand}</td>
                  <td className="mono">{lot.reserved}</td>
                  <td className="mono">{lot.available}</td>
                  <td className="mono">{lot.wip}</td>
                  <td className="mono">{lot.vendor}</td>
                  <td>
                    <Badge tone={lot.qcState === 'held' ? 'warning' : 'success'}>
                      {lot.qcState}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        </>
      )}
    </>
  );
}
