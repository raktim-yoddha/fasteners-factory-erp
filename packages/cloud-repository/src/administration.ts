import {
  administrationRequestSchema,
  administrationSnapshotSchema,
  DomainError,
  identifierSchema,
  invitationResultSchema,
  type AdministrationRequest,
  type AdministrationResult,
} from '@fasteners/contracts';
import type { TeamAdministrationPort, TeamAdministrationSnapshot } from '@fasteners/application';
import type { CloudClient } from './index';
import { checkRpcConfirmation, verifiedToken } from './rpc-confirmation';

export class CloudAdministration implements TeamAdministrationPort {
  constructor(
    private readonly client: CloudClient,
    private readonly connected: () => boolean = () =>
      typeof navigator === 'undefined' || navigator.onLine !== false,
  ) {}
  async snapshot(companyId: string): Promise<TeamAdministrationSnapshot> {
    const { data, error } = await this.client.rpc('member_admin_snapshot', { company: companyId });
    if (error) throw new Error('Member administration requires current company permission.');
    return administrationSnapshotSchema.parse(data);
  }
  async execute(input: AdministrationRequest): Promise<AdministrationResult> {
    if (!this.connected())
      throw new DomainError(
        'OFFLINE_TEAM_WRITE_BLOCKED',
        'Team is offline. No administration request was sent.',
      );
    const parsed = administrationRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new DomainError('INVALID_INPUT', 'Check the administration request.');
    const request = parsed.data;
    const token = await verifiedToken(this.client, request.actorId);
    const { operation, companyId: company, requestKey: request_key } = request;
    try {
      if (operation.command === 'invite_member') {
        const value = operation.input;
        const response = await this.client
          .rpc('invite_member', {
            company,
            email: value.email,
            desired_roles: value.roles,
            desired_plants: value.plantIds,
            all_plants: value.allPlants,
            request_key,
          })
          .setHeader('Authorization', `Bearer ${token}`);
        checkRpcConfirmation(response, 'Invitation');
        return { command: operation.command, ...invitationResultSchema.parse(response.data) };
      }
      if (operation.command === 'create_plant') {
        const response = await this.client
          .rpc('create_plant', {
            company,
            name: operation.input.name,
            warehouse_name: operation.input.warehouseName,
            request_key,
          })
          .setHeader('Authorization', `Bearer ${token}`);
        checkRpcConfirmation(response, 'Plant creation');
        return { command: operation.command, id: identifierSchema.parse(response.data) };
      }
      const value = operation.input;
      const response = await this.client
        .rpc('update_member_access', {
          company,
          member: value.id,
          desired_roles: value.roles,
          desired_plants: value.plantIds,
          all_plants: value.allPlants,
          active: value.active,
          grants: value.grants,
          request_key,
        })
        .setHeader('Authorization', `Bearer ${token}`);
      checkRpcConfirmation(response, 'Member access');
      if (response.data !== null) throw new Error('Malformed void confirmation');
      return { command: operation.command, id: value.id };
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError(
        'CONFIRMATION_UNKNOWN',
        'Administration confirmation unknown. Preserve the original request key.',
      );
    }
  }
  async manage(
    companyId: string,
    action:
      'request_transfer' | 'accept_transfer' | 'archive' | 'independent_review' | 'require_mfa',
    input: { target?: string; enabled?: boolean },
  ): Promise<void> {
    if (!this.connected())
      throw new DomainError(
        'OFFLINE_TEAM_WRITE_BLOCKED',
        'Team is offline. No company policy request was sent.',
      );
    const { error } = await this.client.rpc('manage_company', {
      company: companyId,
      action,
      target: input.target,
      enabled: input.enabled,
    });
    if (error) throw new Error(error.message);
  }
}
