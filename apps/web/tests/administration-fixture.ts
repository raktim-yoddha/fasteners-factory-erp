// Fictional transport only. Real RPC replay/authorization is proved by the backend suites.
import type {
  TeamAdministrationPort,
  TeamAdministrationSnapshot,
} from '../../../packages/application/src';
import {
  DomainError,
  rolePermissions,
  type AdministrationRequest,
  type AdministrationResult,
  type Snapshot,
  type Workspace,
} from '@fasteners/contracts';

type Commit = { request: AdministrationRequest; id: string };
const commits = (): Commit[] =>
  JSON.parse(localStorage.getItem('sample-admin-commits') ?? '[]') as Commit[];
export function administrationFixture(workspace: Workspace, actor: () => string) {
  const plant = { id: '10000000-0000-4000-8000-000000000004', name: 'SAMPLE Main plant' };
  const revoked = () => localStorage.getItem('sample-admin-revoked') === 'true';
  const result = (commit: Commit): AdministrationResult => {
    const command = commit.request.operation.command;
    return command === 'invite_member'
      ? { command, id: commit.id, token: `SAMPLE-invitation-${commit.id}` }
      : { command, id: commit.id };
  };
  const administration: TeamAdministrationPort = {
    snapshot: async (): Promise<TeamAdministrationSnapshot> => {
      if (revoked()) throw new DomainError('PERMISSION_DENIED', 'SAMPLE membership revoked.');
      const changed = [...commits()]
        .reverse()
        .find((entry) => entry.request.operation.command === 'update_member_access')
        ?.request.operation;
      return {
        actorId: actor(),
        members: [
          {
            id: actor(),
            email: 'sample-owner@example.invalid',
            active: true,
            allPlants: true,
            roles: ['Owner'],
            plantIds: [],
            grants: [],
          },
          changed?.command === 'update_member_access'
            ? changed.input
            : {
                id: '10000000-0000-4000-8000-000000000002',
                email: 'sample-member@example.invalid',
                active: true,
                allPlants: false,
                roles: ['Stores'],
                plantIds: [plant.id],
                grants: [],
              },
        ],
        plants: [
          plant,
          ...commits()
            .filter((entry) => entry.request.operation.command === 'create_plant')
            .map((entry) => ({
              id: entry.id,
              name:
                entry.request.operation.command === 'create_plant'
                  ? entry.request.operation.input.name
                  : '',
            })),
        ],
        roles: Object.entries(rolePermissions).map(([name, permissions]) => ({
          name,
          permissions: [...permissions],
          delegable: name !== 'Owner',
        })),
        settings: { independentReview: true, requireMfa: false, state: 'active' },
      };
    },
    execute: async (request) => {
      const attempts = JSON.parse(
        localStorage.getItem('sample-admin-attempts') ?? '[]',
      ) as AdministrationRequest[];
      localStorage.setItem('sample-admin-attempts', JSON.stringify([...attempts, request]));
      if (revoked())
        throw new DomainError('PERMISSION_DENIED', 'SAMPLE current membership revoked.');
      const previous = commits().find(
        (entry) =>
          entry.request.requestKey === request.requestKey &&
          entry.request.actorId === request.actorId,
      );
      if (previous) return result(previous);
      const commit = {
        request,
        id:
          request.operation.command === 'update_member_access'
            ? request.operation.input.id
            : crypto.randomUUID(),
      };
      localStorage.setItem('sample-admin-commits', JSON.stringify([...commits(), commit]));
      throw new DomainError(
        'CONFIRMATION_UNKNOWN',
        'SAMPLE response lost after administration commit.',
      );
    },
    manage: async () => {
      throw new Error('SAMPLE transport fixture does not implement ownership policy.');
    },
  };
  const snapshot = async (): Promise<Snapshot> => {
    if (revoked()) throw new DomainError('PERMISSION_DENIED', 'SAMPLE membership revoked.');
    return {
      workspace,
      plantId: plant.id,
      plants: (await administration.snapshot(workspace.id)).plants,
      capabilities: [...(rolePermissions.Owner ?? [])],
      records: [],
      lots: [],
      reservations: [],
      packages: [],
      shipments: [],
      audit: [],
      asOf: new Date().toISOString(),
    };
  };
  return { administration, snapshot, revoked };
}
