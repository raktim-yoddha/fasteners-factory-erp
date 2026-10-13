import { administrationRequestSchema, type AdministrationRequest } from '@fasteners/contracts';
import { DurableJournal, type StoragePort } from './durable-journal';

export class AdministrationJournal extends DurableJournal<AdministrationRequest> {
  constructor(
    source: StoragePort | (() => StoragePort),
    backendUrl: string,
    locks?: () => Pick<LockManager, 'request'>,
  ) {
    super(
      source,
      backendUrl,
      'fasteners-administration:v1',
      'Administration',
      (value) => administrationRequestSchema.parse(value),
      65536,
      locks,
    );
  }
}
