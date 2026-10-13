import { PendingJournal } from '@fasteners/client-storage';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FactoryApp, Landing } from '@fasteners/ui-web';
import { BrowserRepository } from '@fasteners/sqlite-web';
import {
  createCloudClient,
  CloudRepository,
  CloudAuth,
  CloudAdministration,
} from '@fasteners/cloud-repository';
import '@fasteners/ui-web/styles.css';
let local: BrowserRepository | undefined;
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const cloud = url && key && !key.startsWith('replace-') ? createCloudClient(url, key) : null;
const query = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 1000 }, mutations: { retry: false } },
});
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={query}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app/*"
          element={
            <FactoryApp
              pendingStore={new PendingJournal(() => localStorage)}
              platform="web"
              local={async () => {
                local ??= new BrowserRepository();
                return local;
              }}
              team={
                cloud
                  ? {
                      repository: new CloudRepository(cloud),
                      auth: new CloudAuth(cloud),
                      administration: new CloudAdministration(cloud),
                    }
                  : undefined
              }
            />
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
);
