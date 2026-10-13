import { orderLabel } from '@fasteners/application';
import { ActionButton } from '../ActionButton';
import { useState } from 'react';
import { Badge, Dialog, EmptyState, Field, PageHeading, Panel, Table } from '../components';
import { useFactory } from '../context';
export function Dispatch() {
  const { snapshot, run, busy } = useFactory();
  const [packing, setPacking] = useState<string | null>(null);
  const [scan, setScan] = useState('');
  const [carrier, setCarrier] = useState('');
  const [shipping, setShipping] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const reservation = snapshot.reservations.find((row) => row.id === packing);
  return (
    <>
      <PageHeading
        eyebrow="PACKING & DISPATCH"
        title="Ready means verified."
        description="Exact lot scans, current QC gates, and bounded order fulfilment."
      />
      <Panel>
        <div className="panel-heading">
          <h2>Active reservations</h2>
          <Badge>{snapshot.reservations.filter((row) => row.state === 'active').length}</Badge>
        </div>
        {snapshot.reservations.filter((row) => row.state === 'active').length ? (
          <Table headers={['Order', 'Lot', 'Quantity', 'Packing']}>
            {snapshot.reservations
              .filter((row) => row.state === 'active')
              .map((row) => (
                <tr key={row.id}>
                  <td>{orderLabel(snapshot, row.orderId)}</td>
                  <td>{snapshot.lots.find((lot) => lot.id === row.lotId)?.code}</td>
                  <td className="mono">{row.quantity}</td>
                  <td>
                    <ActionButton
                      command="verify_packing"
                      variant="secondary"
                      disabled={snapshot.packages.some(
                        (packed) => packed.reservationId === row.id && packed.state === 'verified',
                      )}
                      onClick={() => {
                        setPacking(row.id);
                        setScan('');
                      }}
                    >
                      Verify packing
                    </ActionButton>
                  </td>
                </tr>
              ))}
          </Table>
        ) : (
          <EmptyState
            title="No active reservations"
            description="Release held stock and reserve it against an accepted order first."
          />
        )}
      </Panel>
      <Panel>
        <div className="panel-heading">
          <h2>Packages</h2>
        </div>
        <Table headers={['Package', 'Lot', 'Quantity', 'State', 'Shipment']}>
          {snapshot.packages.map((row) => (
            <tr key={row.id}>
              <td className="mono">{row.code}</td>
              <td>{snapshot.lots.find((lot) => lot.id === row.lotId)?.code}</td>
              <td className="mono">{row.quantity}</td>
              <td>
                <Badge tone={row.state === 'dispatched' ? 'success' : 'neutral'}>{row.state}</Badge>
              </td>
              <td>
                <ActionButton
                  command="confirm_dispatch"
                  variant="secondary"
                  disabled={row.state !== 'verified' || busy}
                  onClick={() => {
                    setShipping(row.id);
                    setCarrier('');
                  }}
                >
                  Confirm dispatch
                </ActionButton>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel>
        <div className="panel-heading">
          <h2>Shipment history</h2>
        </div>
        <Table headers={['Shipment', 'Order', 'Quantity', 'Carrier', 'Return']}>
          {snapshot.shipments.map((row) => (
            <tr key={row.id}>
              <td className="mono">{row.code}</td>
              <td>{orderLabel(snapshot, row.orderId)}</td>
              <td className="mono">{row.quantity}</td>
              <td>{row.carrier}</td>
              <td>
                <ActionButton
                  command="receive_customer_return"
                  variant="ghost"
                  onClick={() => setReturnId(row.id)}
                >
                  Receive customer return
                </ActionButton>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      {packing && reservation ? (
        <Dialog title="Verify exact lot packing" onClose={() => setPacking(null)}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void run('verify_packing', {
                reservationId: reservation.id,
                quantity: reservation.quantity,
                scannedLotCode: scan,
              }).then((ok) => {
                if (ok) setPacking(null);
              });
            }}
          >
            <p>
              Expected lot:{' '}
              <strong>{snapshot.lots.find((lot) => lot.id === reservation.lotId)?.code}</strong> ·{' '}
              {reservation.quantity} units
            </p>
            <Field label="Scan / enter the exact lot code">
              <input
                required
                autoFocus
                value={scan}
                onChange={(event) => setScan(event.target.value)}
              />
            </Field>
            <ActionButton command="verify_packing" disabled={busy} type="submit">
              Verify package
            </ActionButton>
          </form>
        </Dialog>
      ) : null}
      {shipping ? (
        <Dialog title="Confirm physical dispatch" onClose={() => setShipping(null)}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void run('confirm_dispatch', { packageId: shipping, carrier }).then((ok) => {
                if (ok) setShipping(null);
              });
            }}
          >
            <p>
              Confirm only after the physical package leaves custody. Current QC, stock and order
              gates are checked atomically.
            </p>
            <Field label="Carrier / vehicle reference">
              <input
                required
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
              />
            </Field>
            <ActionButton command="confirm_dispatch" disabled={busy} type="submit">
              Confirm dispatch
            </ActionButton>
          </form>
        </Dialog>
      ) : null}
      {returnId ? (
        <Dialog title="Receive customer return — held stock" onClose={() => setReturnId(null)}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void run('receive_customer_return', { shipmentId: returnId, quantity, reason }).then(
                (ok) => {
                  if (ok) setReturnId(null);
                },
              );
            }}
          >
            <Field label="Quantity">
              <input
                required
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Return reason">
              <input
                required
                minLength={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <ActionButton command="receive_customer_return" disabled={busy}>
              Receive held return
            </ActionButton>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
