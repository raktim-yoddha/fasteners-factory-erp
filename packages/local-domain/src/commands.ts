import { DomainError, type CommandRequest } from '@fasteners/contracts';
import { positive, scaled } from '@fasteners/domain';
import type { SqlExecutor } from '@fasteners/sqlite-schema';
import {
  assertAvailable,
  balance,
  bumpLot,
  checkRevision,
  event,
  getLot,
  getRecord,
  insertLot,
  move,
  now,
  one,
  text,
  uuid,
} from './database';
import { saveRecord, transitionRecord } from './records';

export async function executeLocal(
  db: SqlExecutor,
  scope: string,
  actor: string,
  request: CommandRequest,
): Promise<string> {
  if (request.command === 'save_record') return saveRecord(db, scope, request);
  if (request.command === 'transition_record') return transitionRecord(db, scope, request);
  const payload = request.payload;
  if ('quantity' in payload) positive(payload.quantity);
  if ('lotId' in payload) {
    const lot = await getLot(db, scope, payload.lotId);
    checkRevision(text(lot, 'revision'), request.expectedRevision);
  }
  switch (request.command) {
    case 'receive_goods': {
      const p = request.payload;
      const item = await getRecord(db, scope, p.itemId, 'item');
      if (item.state !== 'active')
        throw new DomainError('INVALID_INPUT', 'An active item is required.');
      if (p.purchaseOrderId) {
        const po = await getRecord(db, scope, p.purchaseOrderId, 'purchase_order');
        checkRevision(po.revision);
        if (!['open', 'partial_receipt'].includes(po.state) || po.fields.itemId !== item.id)
          throw new DomainError(
            'INVALID_TRANSITION',
            'Select an approved open purchase order for this item.',
          );
        const receipts = await db.all(
          "SELECT quantity FROM ledger WHERE workspace_id=? AND reference_id=? AND event='goods_receipt'",
          [scope, po.id],
        );
        const received =
          receipts.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n) +
          scaled(p.quantity);
        if (received > scaled(po.fields.quantity ?? '0'))
          throw new DomainError('INVALID_INPUT', 'Receipt exceeds the remaining PO obligation.');
        await db.run(
          'UPDATE records SET state=?,revision=revision+1 WHERE workspace_id=? AND id=?',
          [
            received === scaled(po.fields.quantity ?? '0') ? 'received' : 'partial_receipt',
            scope,
            po.id,
          ],
        );
      }
      const lot = await insertLot(db, scope, p.itemId, p.location);
      await event(
        db,
        scope,
        lot.id,
        scaled(p.quantity),
        'stores',
        p.purchaseOrderId ?? lot.id,
        'goods_receipt',
      );
      return lot.id;
    }
    case 'record_inspection': {
      const p = request.payload;
      const lot = await getLot(db, scope, p.lotId);
      const item = await getRecord(db, scope, text(lot, 'item_id'), 'item');
      if (item.fields.unit !== p.unit)
        throw new DomainError(
          'UNIT_MISMATCH',
          'Readings must use the item base unit for this initial inspection model.',
        );
      if (scaled(p.lower) > scaled(p.upper))
        throw new DomainError('INVALID_INPUT', 'Lower limit must not exceed upper limit.');
      const passed = p.readings.every(
        (value) => scaled(value) >= scaled(p.lower) && scaled(value) <= scaled(p.upper),
      );
      await db.run(
        'INSERT INTO inspections(id,workspace_id,lot_id,lot_revision,lower_limit,upper_limit,readings,unit,passed,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          uuid(),
          scope,
          p.lotId,
          (BigInt(text(lot, 'revision')) + 1n).toString(),
          p.lower,
          p.upper,
          JSON.stringify(p.readings),
          p.unit,
          passed ? 1 : 0,
          actor,
          now(),
        ],
      );
      await db.run(
        "UPDATE lots SET qc_state='held',revision=revision+1 WHERE workspace_id=? AND id=?",
        [scope, p.lotId],
      );
      return p.lotId;
    }
    case 'release_lot': {
      const lot = await getLot(db, scope, request.payload.lotId);
      const inspection = (
        await db.all(
          'SELECT * FROM inspections WHERE workspace_id=? AND lot_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',
          [scope, request.payload.lotId],
        )
      )[0];
      if (
        !inspection ||
        Number(inspection.passed) !== 1 ||
        String(inspection.lot_revision) !== text(lot, 'revision')
      )
        throw new DomainError(
          'INSPECTION_REQUIRED',
          'A current passed inspection is required for owner attestation.',
        );
      const ncr = await db.all(
        "SELECT id FROM records WHERE workspace_id=? AND kind='ncr' AND state<>'closed' AND json_extract(fields,'$.lotId')=?",
        [scope, request.payload.lotId],
      );
      if (ncr.length)
        throw new DomainError('LOT_QC_HOLD', 'Resolve the blocking NCR before release.');
      await db.run(
        "UPDATE lots SET qc_state='released',revision=revision+1 WHERE workspace_id=? AND id=?",
        [scope, request.payload.lotId],
      );
      return request.payload.lotId;
    }
    case 'hold_lot':
      await db.run(
        "UPDATE lots SET qc_state='held',revision=revision+1 WHERE workspace_id=? AND id=?",
        [scope, request.payload.lotId],
      );
      return request.payload.lotId;
    case 'reserve_stock': {
      const p = request.payload;
      await assertAvailable(db, scope, p.lotId, p.quantity);
      const order = await getRecord(db, scope, p.orderId, 'sales_order');
      const lot = await getLot(db, scope, p.lotId);
      if (
        !['accepted', 'partially_fulfilled'].includes(order.state) ||
        order.fields.itemId !== text(lot, 'item_id')
      )
        throw new DomainError(
          'INVALID_TRANSITION',
          'Reserve against an accepted matching sales order.',
        );
      const allocations = await db.all(
        "SELECT quantity FROM reservations WHERE workspace_id=? AND order_id=? AND state IN ('active','dispatched')",
        [scope, order.id],
      );
      if (
        allocations.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n) +
          scaled(p.quantity) >
        scaled(order.fields.quantity ?? '0')
      )
        throw new DomainError(
          'INVALID_INPUT',
          'Allocation exceeds the unfulfilled order quantity.',
        );
      const id = uuid();
      await db.run(
        "INSERT INTO reservations(id,workspace_id,lot_id,order_id,quantity,state) VALUES(?,?,?,?,?,'active')",
        [id, scope, p.lotId, p.orderId, p.quantity],
      );
      await bumpLot(db, scope, p.lotId);
      return id;
    }
    case 'release_reservation': {
      const p = request.payload;
      const reservation = await one(
        db,
        'SELECT * FROM reservations WHERE workspace_id=? AND id=?',
        [scope, p.reservationId],
      );
      if (
        text(reservation, 'state') !== 'active' ||
        (
          await db.all(
            "SELECT id FROM packages WHERE workspace_id=? AND reservation_id=? AND state='verified'",
            [scope, p.reservationId],
          )
        ).length
      )
        throw new DomainError(
          'INVALID_TRANSITION',
          'Packed or completed reservations cannot be released.',
        );
      await db.run("UPDATE reservations SET state='released' WHERE workspace_id=? AND id=?", [
        scope,
        p.reservationId,
      ]);
      await bumpLot(db, scope, text(reservation, 'lot_id'));
      return p.reservationId;
    }
    case 'issue_material': {
      const p = request.payload;
      await assertAvailable(db, scope, p.lotId, p.quantity);
      const wo = await getRecord(db, scope, p.workOrderId, 'work_order');
      if (!['released', 'in_progress'].includes(wo.state))
        throw new DomainError(
          'INVALID_TRANSITION',
          'Release the work order before issuing material.',
        );
      await move(db, scope, p.lotId, scaled(p.quantity), 'stores', 'wip', wo.id, 'material_issue');
      await bumpLot(db, scope, p.lotId);
      return wo.id;
    }
    case 'consume_material':
      throw new DomainError(
        'INVALID_TRANSITION',
        'Material consumption awaits the complete approved production output and scrap reconciliation slice.',
      );
    case 'return_material': {
      const p = request.payload;
      const wo = await getRecord(db, scope, p.workOrderId, 'work_order');
      if (!['released', 'in_progress', 'blocked'].includes(wo.state))
        throw new DomainError('INVALID_TRANSITION', 'Work is not open for material events.');
      if (scaled(p.quantity) > (await balance(db, scope, p.lotId, 'wip', wo.id)))
        throw new DomainError(
          'INSUFFICIENT_AVAILABLE_STOCK',
          'Quantity exceeds actual unconsumed work custody.',
        );
      const source = await getLot(db, scope, p.lotId);
      const returned = await insertLot(
        db,
        scope,
        text(source, 'item_id'),
        text(source, 'location'),
      );
      await event(db, scope, p.lotId, -scaled(p.quantity), 'wip', wo.id, 'material_return');
      await event(db, scope, returned.id, scaled(p.quantity), 'stores', wo.id, 'material_return');
      await db.run('INSERT INTO genealogy VALUES(?,?,?,?,?,?)', [
        uuid(),
        scope,
        p.lotId,
        returned.id,
        wo.id,
        p.quantity,
      ]);
      await bumpLot(db, scope, p.lotId);
      return wo.id;
    }
    case 'record_production_output':
      throw new DomainError(
        'INVALID_TRANSITION',
        'Production output awaits approved component consumption, output/scrap reconciliation and allocated genealogy.',
      );
    case 'transfer_stock': {
      const p = request.payload;
      await assertAvailable(db, scope, p.lotId, p.quantity);
      const source = await getLot(db, scope, p.lotId);
      if (text(source, 'location') === p.location)
        throw new DomainError('INVALID_INPUT', 'Choose a different destination.');
      const target = await insertLot(db, scope, text(source, 'item_id'), p.location);
      await event(db, scope, p.lotId, -scaled(p.quantity), 'stores', target.id, 'transfer_out');
      await event(db, scope, target.id, scaled(p.quantity), 'stores', p.lotId, 'transfer_in');
      await db.run('INSERT INTO genealogy VALUES(?,?,?,?,?,?)', [
        uuid(),
        scope,
        p.lotId,
        target.id,
        target.id,
        p.quantity,
      ]);
      await bumpLot(db, scope, p.lotId);
      return target.id;
    }
    case 'send_jobwork': {
      const p = request.payload;
      await getRecord(db, scope, p.supplierId, 'supplier');
      await assertAvailable(db, scope, p.lotId, p.quantity);
      await move(
        db,
        scope,
        p.lotId,
        scaled(p.quantity),
        'stores',
        'vendor',
        p.supplierId,
        'vendor_outward',
      );
      await bumpLot(db, scope, p.lotId);
      return p.lotId;
    }
    case 'receive_jobwork': {
      const p = request.payload;
      await getRecord(db, scope, p.supplierId, 'supplier');
      if (
        scaled(p.quantity) + scaled(p.loss) >
        (await balance(db, scope, p.lotId, 'vendor', p.supplierId))
      )
        throw new DomainError(
          'INSUFFICIENT_AVAILABLE_STOCK',
          'Return and loss exceed recorded vendor custody.',
        );
      if (scaled(p.loss) > 0n && p.reason.trim().length < 3)
        throw new DomainError('INVALID_INPUT', 'Vendor loss needs an explicit reason.');
      const source = await getLot(db, scope, p.lotId);
      const lot = await insertLot(db, scope, text(source, 'item_id'), text(source, 'location'));
      await event(db, scope, p.lotId, -scaled(p.quantity), 'vendor', p.supplierId, 'vendor_return');
      await event(db, scope, lot.id, scaled(p.quantity), 'stores', p.supplierId, 'vendor_return');
      if (scaled(p.loss) > 0n)
        await move(
          db,
          scope,
          p.lotId,
          scaled(p.loss),
          'vendor',
          'loss',
          p.supplierId,
          'vendor_loss',
        );
      await db.run('INSERT INTO genealogy VALUES(?,?,?,?,?,?)', [
        uuid(),
        scope,
        p.lotId,
        lot.id,
        p.supplierId,
        p.quantity,
      ]);
      await bumpLot(db, scope, p.lotId);
      return lot.id;
    }
    case 'verify_packing': {
      const p = request.payload;
      const reservation = await one(
        db,
        'SELECT * FROM reservations WHERE workspace_id=? AND id=?',
        [scope, p.reservationId],
      );
      const lot = await getLot(db, scope, text(reservation, 'lot_id'));
      if (text(reservation, 'state') !== 'active' || text(lot, 'qc_state') !== 'released')
        throw new DomainError(
          'LOT_QC_HOLD',
          'Packing needs an active reservation and currently released stock.',
        );
      if (p.scannedLotCode !== text(lot, 'code'))
        throw new DomainError('INVALID_INPUT', 'Scanned lot does not match the reserved lot.');
      if (scaled(p.quantity) !== scaled(text(reservation, 'quantity')))
        throw new DomainError(
          'INVALID_INPUT',
          'This packing slice requires the exact reservation quantity; create separate reservations for partial packages.',
        );
      if (
        (
          await db.all('SELECT id FROM packages WHERE workspace_id=? AND reservation_id=?', [
            scope,
            p.reservationId,
          ])
        ).length
      )
        throw new DomainError('INVALID_TRANSITION', 'This reservation already has a package.');
      const id = uuid();
      await db.run(
        "INSERT INTO packages(id,workspace_id,code,reservation_id,lot_id,order_id,quantity,state) VALUES(?,?,?,?,?,?,?,'verified')",
        [
          id,
          scope,
          `PKG-${id.slice(0, 8).toUpperCase()}`,
          p.reservationId,
          text(reservation, 'lot_id'),
          text(reservation, 'order_id'),
          p.quantity,
        ],
      );
      return id;
    }
    case 'confirm_dispatch': {
      const p = request.payload;
      const packed = await one(db, 'SELECT * FROM packages WHERE workspace_id=? AND id=?', [
        scope,
        p.packageId,
      ]);
      const lot = await getLot(db, scope, text(packed, 'lot_id'));
      const reservation = await one(
        db,
        'SELECT * FROM reservations WHERE workspace_id=? AND id=?',
        [scope, text(packed, 'reservation_id')],
      );
      const order = await getRecord(db, scope, text(packed, 'order_id'), 'sales_order');
      checkRevision(order.revision);
      if (text(lot, 'qc_state') !== 'released')
        throw new DomainError('LOT_QC_HOLD', 'A changed QC hold blocks dispatch.');
      if (
        text(packed, 'state') !== 'verified' ||
        text(reservation, 'state') !== 'active' ||
        !['accepted', 'partially_fulfilled'].includes(order.state)
      )
        throw new DomainError(
          'INVALID_TRANSITION',
          'Package, reservation and order are not ready for dispatch.',
        );
      const q = scaled(text(packed, 'quantity'));
      if (q > (await balance(db, scope, text(lot, 'id'))))
        throw new DomainError(
          'INSUFFICIENT_AVAILABLE_STOCK',
          'Packed quantity exceeds current physical stock.',
        );
      const previous = await db.all(
        'SELECT quantity FROM shipments WHERE workspace_id=? AND order_id=?',
        [scope, order.id],
      );
      const fulfilled = previous.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n) + q;
      if (fulfilled > scaled(order.fields.quantity ?? '0'))
        throw new DomainError('INVALID_INPUT', 'Shipment exceeds remaining accepted demand.');
      const id = uuid();
      await move(db, scope, text(lot, 'id'), q, 'stores', 'shipped', id, 'dispatch');
      await db.run(
        'INSERT INTO shipments(id,workspace_id,code,package_id,lot_id,order_id,quantity,carrier,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          id,
          scope,
          `SHIP-${id.slice(0, 8).toUpperCase()}`,
          text(packed, 'id'),
          text(lot, 'id'),
          order.id,
          text(packed, 'quantity'),
          p.carrier,
          now(),
        ],
      );
      await db.run("UPDATE packages SET state='dispatched' WHERE workspace_id=? AND id=?", [
        scope,
        text(packed, 'id'),
      ]);
      await db.run("UPDATE reservations SET state='dispatched' WHERE workspace_id=? AND id=?", [
        scope,
        text(reservation, 'id'),
      ]);
      await db.run('UPDATE records SET state=?,revision=revision+1 WHERE workspace_id=? AND id=?', [
        fulfilled === scaled(order.fields.quantity ?? '0') ? 'fulfilled' : 'partially_fulfilled',
        scope,
        order.id,
      ]);
      await bumpLot(db, scope, text(lot, 'id'));
      return id;
    }
    case 'receive_customer_return': {
      const p = request.payload;
      const shipment = await one(db, 'SELECT * FROM shipments WHERE workspace_id=? AND id=?', [
        scope,
        p.shipmentId,
      ]);
      const previous = await db.all(
        "SELECT quantity FROM ledger WHERE workspace_id=? AND reference_id=? AND event='customer_return'",
        [scope, p.shipmentId],
      );
      if (
        previous.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n) +
          scaled(p.quantity) >
        scaled(text(shipment, 'quantity'))
      )
        throw new DomainError(
          'INVALID_INPUT',
          'Return exceeds shipped quantity minus prior returns.',
        );
      const source = await getLot(db, scope, text(shipment, 'lot_id'));
      const lot = await insertLot(db, scope, text(source, 'item_id'), text(source, 'location'));
      await event(db, scope, lot.id, scaled(p.quantity), 'stores', p.shipmentId, 'customer_return');
      await event(
        db,
        scope,
        text(source, 'id'),
        -scaled(p.quantity),
        'shipped',
        p.shipmentId,
        'customer_return_custody',
      );
      await db.run('INSERT INTO genealogy VALUES(?,?,?,?,?,?)', [
        uuid(),
        scope,
        text(source, 'id'),
        lot.id,
        p.shipmentId,
        p.quantity,
      ]);
      return lot.id;
    }
    default: {
      const impossible: never = request;
      throw new DomainError('INVALID_INPUT', `Unsupported command: ${String(impossible)}`);
    }
  }
}
