import { companySetupRequestSchema, type CompanySetupRequest } from '@fasteners/contracts';
import { DurableJournal, type StoragePort } from './durable-journal';

export class CompanySetupJournal extends DurableJournal<CompanySetupRequest> {
  constructor(
    source: StoragePort | (() => StoragePort),
    backendUrl: string,
    locks?: () => Pick<LockManager, 'request'>,
  ) {
    super(
      source,
      backendUrl,
      'fasteners-company-setup:v1',
      'Company',
      (value) => companySetupRequestSchema.parse(value),
      4096,
      locks,
    );
  }
}
