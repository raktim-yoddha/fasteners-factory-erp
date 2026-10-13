import type { EntityKind } from './index';
export interface RecordField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'decimal'
    | 'date'
    | 'customer'
    | 'supplier'
    | 'item'
    | 'engineering'
    | 'quotation'
    | 'sales_order'
    | 'equipment'
    | 'lot';
  required?: boolean;
  default?: string;
}
export const recordFields: Record<EntityKind, readonly RecordField[]> = {
  customer: [{ key: 'reference', label: 'Customer reference', type: 'text' }],
  supplier: [{ key: 'reference', label: 'Supplier reference', type: 'text' }],
  item: [
    { key: 'unit', label: 'Base unit', type: 'text', required: true, default: 'pcs' },
    { key: 'grade', label: 'Material / grade', type: 'text' },
    { key: 'finish', label: 'Finish', type: 'text' },
  ],
  engineering: [
    { key: 'itemId', label: 'Output item', type: 'item', required: true },
    { key: 'drawingReference', label: 'Drawing revision reference', type: 'text', required: true },
    { key: 'route', label: 'Operation sequence', type: 'text', required: true },
    { key: 'outputBasis', label: 'Output basis', type: 'decimal', required: true, default: '1' },
  ],
  rfq: [
    { key: 'customerId', label: 'Customer', type: 'customer', required: true },
    { key: 'itemId', label: 'Requested item', type: 'item', required: true },
    { key: 'quantity', label: 'Requested quantity', type: 'decimal', required: true },
    { key: 'dueDate', label: 'Required date', type: 'date', required: true },
  ],
  quotation: [
    { key: 'customerId', label: 'Customer', type: 'customer', required: true },
    { key: 'engineeringId', label: 'Engineering revision', type: 'engineering', required: true },
    { key: 'quantity', label: 'Quantity', type: 'decimal', required: true },
    { key: 'unitPrice', label: 'Unit price', type: 'decimal', required: true },
    { key: 'materialCost', label: 'Material cost', type: 'decimal', default: '0' },
    { key: 'processCost', label: 'Process cost', type: 'decimal', default: '0' },
  ],
  sales_order: [
    { key: 'customerId', label: 'Customer', type: 'customer', required: true },
    { key: 'quotationId', label: 'Approved quotation', type: 'quotation', required: true },
    { key: 'engineeringId', label: 'Engineering revision', type: 'engineering', required: true },
    { key: 'itemId', label: 'Item', type: 'item', required: true },
    { key: 'quantity', label: 'Ordered quantity', type: 'decimal', required: true },
    { key: 'dueDate', label: 'Delivery date', type: 'date', required: true },
    { key: 'poReference', label: 'Customer PO reference', type: 'text', required: true },
    { key: 'poDiscrepancies', label: 'Unresolved PO discrepancies', type: 'text' },
  ],
  purchase_order: [
    { key: 'supplierId', label: 'Supplier', type: 'supplier', required: true },
    { key: 'itemId', label: 'Item', type: 'item', required: true },
    { key: 'quantity', label: 'Ordered quantity', type: 'decimal', required: true },
    { key: 'unitPrice', label: 'Unit price', type: 'decimal', required: true },
    { key: 'dueDate', label: 'Expected date', type: 'date', required: true },
  ],
  work_order: [
    { key: 'orderId', label: 'Sales order', type: 'sales_order', required: true },
    { key: 'engineeringId', label: 'Approved engineering', type: 'engineering', required: true },
    { key: 'itemId', label: 'Output item', type: 'item', required: true },
    { key: 'quantity', label: 'Planned output', type: 'decimal', required: true },
    { key: 'equipmentId', label: 'Required equipment', type: 'equipment', required: true },
  ],
  equipment: [
    { key: 'calibrationDue', label: 'Calibration valid until', type: 'date', required: true },
  ],
  ncr: [
    { key: 'lotId', label: 'Affected lot', type: 'lot', required: true },
    { key: 'quantity', label: 'Affected quantity', type: 'decimal', required: true },
    { key: 'defect', label: 'Defect / containment', type: 'text', required: true },
    { key: 'disposition', label: 'Disposition / execution evidence', type: 'text' },
  ],
  jobwork: [
    { key: 'supplierId', label: 'Supplier', type: 'supplier', required: true },
    { key: 'itemId', label: 'Item', type: 'item', required: true },
    { key: 'quantity', label: 'Planned quantity', type: 'decimal', required: true },
    { key: 'dueDate', label: 'Expected return', type: 'date', required: true },
  ],
};
