// Development-only acceptance entry. Not imported by the application or emitted by its build.
// These fictional ports simulate transport faults; they do not prove PostgreSQL authorization.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FactoryApp } from '@fasteners/ui-web';
import {
  AdministrationJournal,
  CompanySetupJournal,
  PendingJournal,
} from '@fasteners/client-storage';
import type { TeamAuthPort } from '../../../packages/application/src';
import {
  DomainError,
  type CompanySetupRequest,
  type Repository,
  type Workspace,
} from '@fasteners/contracts';
import '@fasteners/ui-web/styles.css';
import { administrationFixture } from './administration-fixture';

const actorA = '10000000-0000-4000-8000-000000000001';
const actor = () => localStorage.getItem('sample-fixture-actor') ?? actorA;
const existing: Workspace = {
  id: '10000000-0000-4000-8000-000000000003',
  name: 'SAMPLE Existing Company',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  createdAt: new Date().toISOString(),
};
type Commit = CompanySetupRequest & { companyId: string };
const commits = (): Commit[] =>
  JSON.parse(localStorage.getItem('sample-fixture-commits') ?? '[]') as Commit[];
const unavailable = async (): Promise<never> => {
  throw new Error('SAMPLE fixture only exercises company setup.');
};
const auth: TeamAuthPort = {
  currentUser: async () =>
    actor() === 'signed-out'
      ? null
      : { id: actor(), email: `sample-${actor()}@example.invalid`, verified: true },
  signIn: async () => {
    localStorage.setItem('sample-fixture-actor', actorA);
  },
  signOut: async () => {
    localStorage.setItem('sample-fixture-actor', 'signed-out');
  },
  createCompany: async (input, requestKey, actorId) => {
    const history = JSON.parse(
      localStorage.getItem('sample-fixture-attempts') ?? '[]',
    ) as unknown[];
    history.push({ input, requestKey, actorId });
    localStorage.setItem('sample-fixture-attempts', JSON.stringify(history));
    const previous = commits().find(
      (entry) => entry.actorId === actorId && entry.requestKey === requestKey,
    );
    if (previous) return previous.companyId;
    const companyId = crypto.randomUUID();
    localStorage.setItem(
      'sample-fixture-commits',
      JSON.stringify([...commits(), { contractVersion: 1, actorId, requestKey, input, companyId }]),
    );
    throw new DomainError(
      'CONFIRMATION_UNKNOWN',
      'Company confirmation unknown. SAMPLE response lost after commit.',
    );
  },
  mfaFactors: async () => [],
  signUp: unavailable,
  recover: unavailable,
  acceptInvitation: unavailable,
  changePassword: unavailable,
  enrollMfa: unavailable,
  verifyMfa: unavailable,
};
const adminFixture = new URLSearchParams(location.search).has('administration')
  ? administrationFixture(existing, actor)
  : null;
const repository: Repository = {
  listWorkspaces: async () => {
    if (localStorage.getItem('sample-fixture-refresh-fail') === 'true')
      throw new Error('SAMPLE refresh failed');
    if (adminFixture?.revoked()) return [];
    return [
      existing,
      ...commits()
        .filter((entry) => entry.actorId === actor())
        .map((entry) => ({
          id: entry.companyId,
          name: entry.input.name,
          currency: entry.input.currency,
          timezone: entry.input.timezone,
          createdAt: existing.createdAt,
        })),
    ];
  },
  createWorkspace: unavailable,
  snapshot: adminFixture?.snapshot ?? unavailable,
  execute: unavailable,
  close: async () => undefined,
};
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/app']}>
      <FactoryApp
        platform="web"
        pendingStore={new PendingJournal(() => localStorage)}
        local={async () => repository}
        team={{
          auth,
          repository,
          administration: adminFixture?.administration,
          administrationStore: adminFixture
            ? new AdministrationJournal(
                () => ({
                  getItem: (key) => localStorage.getItem(key),
                  setItem: (key, value) => {
                    if (localStorage.getItem('sample-admin-quota') === 'true')
                      throw new Error('SAMPLE quota');
                    localStorage.setItem(key, value);
                  },
                  removeItem: (key) => localStorage.removeItem(key),
                }),
                'https://sample-backend.invalid',
              )
            : undefined,
          companySetupStore: new CompanySetupJournal(
            () => localStorage,
            'https://sample-backend.invalid',
          ),
        }}
      />
    </MemoryRouter>
  </QueryClientProvider>,
);
