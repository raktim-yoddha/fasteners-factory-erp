import { LocalRecoveryJournal, PendingJournal } from '@fasteners/client-storage';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Repository } from '@fasteners/contracts';
import { FactoryApp } from '@fasteners/ui-web';
import {
  createCloudClient,
  CloudRepository,
  CloudAuth,
  CloudAdministration,
} from '@fasteners/cloud-repository';
import '@fasteners/ui-web/styles.css';
import '../shared/bridge';
const local: Repository = {
  listWorkspaces: () => window.factory.listWorkspaces(),
  createWorkspace: (input) => window.factory.createWorkspace(input),
  snapshot: (authority) => window.factory.snapshot(authority),
  execute: (command) => window.factory.execute(command),
  close: async () => undefined,
};
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const client =
  url && key && !key.startsWith('replace-')
    ? createCloudClient(url, key, {
        getItem: (name) => window.factory.authGet(name),
        setItem: (name, value) => window.factory.authSet(name, value),
        removeItem: (name) => window.factory.authRemove(name),
      })
    : null;
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 1000 }, mutations: { retry: false } },
});
const recoveryJournal = new LocalRecoveryJournal(() => localStorage);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <FactoryApp
        pendingStore={new PendingJournal(() => localStorage)}
        platform="desktop"
        local={async () => local}
        team={
          client
            ? {
                repository: new CloudRepository(client),
                auth: new CloudAuth(client),
                administration: new CloudAdministration(client),
              }
            : undefined
        }
        backup={{
          export: (passphrase) => window.factory.exportEncryptedDatabase(passphrase),
          recovery: {
            preview: (passphrase) => window.factory.previewRestore(passphrase),
            activate: (token) => window.factory.activateRestore(token),
            cancel: (token) => window.factory.cancelRestore(token),
          },
          recoveryJournal,
        }}
      />
    </HashRouter>
  </QueryClientProvider>,
);
