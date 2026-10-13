import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  Box,
  Building2,
  ChevronDown,
  ClipboardList,
  Factory,
  FileCheck,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import {
  authorityKey,
  type Authority,
  type CommandName,
  type CommandPayload,
  type CommandRequest,
  type Repository,
  type Workspace,
} from '@fasteners/contracts';
import {
  request,
  capability,
  type PendingCommandStore,
  type TeamAuthPort,
  type TeamAdministrationPort,
  type SnapshotRecoveryPort,
  type RecoveryJournal,
} from '@fasteners/application';
import { Button, EmptyState, PageHeading, Panel } from './components';
import { FactoryProvider } from './context';
import { Overview } from './views/Overview';
import { Records, moduleKinds } from './views/Records';
import { Stock } from './views/Stock';
import { Dispatch } from './views/Dispatch';
import { Reports } from './views/Reports';
import { TeamAdministration } from './views/TeamAdministration';
import { BackupDialog } from './views/BackupDialog';
import { CreateSolo } from './views/CreateSolo';
import { TeamOnboarding } from './views/TeamOnboarding';
import { RestoreDialog } from './views/RestoreDialog';
export interface FactoryAppProps {
  platform: 'web' | 'desktop';
  pendingStore: PendingCommandStore;
  local: () => Promise<Repository>;
  team?: { repository: Repository; auth: TeamAuthPort; administration?: TeamAdministrationPort };
  backup?: {
    export: (passphrase: string) => Promise<void>;
    recovery?: SnapshotRecoveryPort;
    recoveryJournal?: RecoveryJournal;
  };
}
const navigation = [
  {
    group: 'WORKSPACE',
    items: [
      ['overview', 'Overview', LayoutDashboard],
      ['sales', 'Sales & orders', ClipboardList],
      ['engineering', 'Engineering', FileCheck],
      ['procurement', 'Procurement', Truck],
    ],
  },
  {
    group: 'FACTORY FLOOR',
    items: [
      ['stock', 'Stock & stores', Box],
      ['production', 'Production', Factory],
      ['quality', 'Quality control', ShieldCheck],
      ['jobwork', 'Vendor work', Building2],
      ['equipment', 'Equipment', Wrench],
      ['dispatch', 'Packing & dispatch', PackageCheck],
    ],
  },
  {
    group: 'MANAGE',
    items: [
      ['masters', 'Master data', Users],
      ['reports', 'Reports', Activity],
      ['audit', 'Activity & audit', FileCheck],
      ['settings', 'Workspace settings', Settings],
    ],
  },
] as const;
export function FactoryApp(props: FactoryAppProps) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [mode, setMode] = useState<'solo' | 'team' | null>(null);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [authority, setAuthority] = useState<Authority | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userId, setUserId] = useState('local-owner');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState<CommandRequest | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [filter, setFilter] = useState('');
  const [sidebar, setSidebar] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('fasteners-theme') === 'dark';
    } catch {
      return false;
    }
  });
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const generation = useRef(0);
  const checkRecoveryPending = useCallback(() => {
    for (const workspace of workspaces)
      if (props.pendingStore.read('local-owner', { kind: 'solo', workspaceId: workspace.id }))
        throw new Error('Resolve the pending business request in its workspace before restoring.');
  }, [workspaces, props.pendingStore]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('fasteners-theme', dark ? 'dark' : 'light');
    } catch {
      /* Optional appearance persistence cannot block authority selection. */
    }
  }, [dark]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const key = ['factory', userId, authority ? authorityKey(authority) : 'none'];
  const snapshot = useQuery({
    queryKey: key,
    queryFn: () => {
      if (!repository || !authority) throw new Error('Select a workspace.');
      return repository.snapshot(authority);
    },
    enabled: Boolean(repository && authority),
    retry: false,
  });
  async function choose(value: 'solo' | 'team') {
    setError('');
    setBusy(true);
    try {
      const selected = value === 'solo' ? await props.local() : props.team?.repository;
      if (!selected)
        throw new Error(
          'Team mode needs a configured Supabase URL and publishable key. Solo works without them.',
        );
      const pendingRestore = value === 'solo' ? props.backup?.recoveryJournal?.read() : null;
      await queryClient.cancelQueries();
      queryClient.clear();
      generation.current++;
      setRepository(selected);
      setMode(value);
      setAuthority(null);
      if (value === 'solo') {
        setRecoveryPending(Boolean(pendingRestore));
        setRestoreOpen(Boolean(pendingRestore));
        setUserId('local-owner');
        setWorkspaces(await selected.listWorkspaces());
      } else {
        const user = await props.team!.auth.currentUser();
        setUserId(user?.id ?? 'signed-out');
        setWorkspaces(user ? await selected.listWorkspaces() : []);
      }
      navigate('/app');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Storage unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function refreshWorkspaces() {
    if (repository) setWorkspaces(await repository.listWorkspaces());
  }
  async function openAuthority(selected: Authority) {
    const pending = props.pendingStore.read(userId, selected);
    generation.current++;
    await queryClient.cancelQueries();
    queryClient.clear();
    setUnknown(pending);
    setAuthority(selected);
    setFilter('');
    setStatus(pending ? 'Confirmation unknown — restored original request after restart.' : '');
    setError('');
    navigate('/app/overview');
  }
  async function selectWorkspace(id: string) {
    if (busy || unknown || recoveryPending || !repository) return;
    setBusy(true);
    try {
      let selected: Authority =
        mode === 'team' ? { kind: 'team', companyId: id } : { kind: 'solo', workspaceId: id };
      if (selected.kind === 'team') {
        const initial = await repository.snapshot(selected);
        if (!initial.plantId)
          throw new Error('Backend did not confirm an authorized plant. No command can be sent.');
        selected = { ...selected, plantId: initial.plantId };
      }
      await openAuthority(selected);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Authority or pending request storage unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function selectPlant(plantId: string) {
    if (busy || unknown || authority?.kind !== 'team') return;
    setBusy(true);
    try {
      await openAuthority({ ...authority, plantId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Plant selection failed.');
    } finally {
      setBusy(false);
    }
  }
  async function execute(command: CommandRequest): Promise<boolean> {
    if (!repository) return false;
    try {
      props.pendingStore.save(userId, command);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Pending request storage unavailable. No command sent.',
      );
      return false;
    }
    const current = generation.current;
    setBusy(true);
    setError('');
    setStatus('Committing to authority…');
    try {
      const result = await repository.execute(command);
      if (current !== generation.current) return false;
      if (!result.ok) {
        const unresolved = Boolean(unknown) || result.error.code === 'CONFIRMATION_UNKNOWN';
        if (!unresolved) props.pendingStore.clear(userId, command.authority);
        setStatus(
          unresolved ? 'Confirmation unknown — preserve this request.' : 'Command rejected.',
        );
        setError(`${result.error.code}: ${result.error.message}`);
        if (unresolved) setUnknown(command);
        return false;
      }
      props.pendingStore.clear(userId, command.authority);
      setUnknown(null);
      setStatus(`Committed ${new Date(result.committedAt).toLocaleTimeString()}`);
      await queryClient.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      if (current === generation.current) {
        setUnknown(command);
        setStatus('Confirmation unknown — query or retry this request.');
        setError(cause instanceof Error ? cause.message : 'Authority confirmation unavailable.');
      }
      return false;
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function run<K extends CommandName>(
    command: K,
    payload: CommandPayload<K>,
    revision?: string,
  ) {
    if (!authority || busy || unknown || !snapshot.data) return false;
    if (authority.kind === 'team' && !online) {
      setStatus('Unsent — Team is offline.');
      setError('Critical writes require the online authority.');
      return false;
    }
    const access = capability(authority, snapshot.data, command, payload);
    if (!access.allowed) {
      setError(access.reason);
      return false;
    }
    return execute(request(authority, command, payload, revision));
  }
  async function switchMode() {
    if (busy || unknown) return;
    generation.current++;
    await queryClient.cancelQueries();
    queryClient.clear();
    setAuthority(null);
    setMode(null);
    setRepository(null);
    setWorkspaces([]);
    setStatus('');
    setError('');
    navigate('/app');
  }
  const module = location.pathname.split('/').filter(Boolean)[1] ?? 'overview';
  if (!mode)
    return (
      <main className="welcome">
        <Link className="brand" to={props.platform === 'web' ? '/' : '/app'}>
          <span className="brand-mark">
            <Factory size={20} />
          </span>
          <span>
            factory<span className="brand-sub">FASTENERS ERP</span>
          </span>
        </Link>
        <div className="welcome-intro">
          <p className="eyebrow">ONE FACTORY. TWO WAYS TO WORK.</p>
          <h1>
            Your operations,
            <br />
            on your terms.
          </h1>
          <p>Start independently on this device, or collaborate in a company workspace online.</p>
        </div>
        {error ? (
          <div className="feedback error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="mode-grid">
          <Panel>
            <span className="mode-icon">
              <HardDrive size={26} />
            </span>
            <h2>Solo on this device</h2>
            <p>
              Real SQLite storage. Your records stay here. Full applicable operations without an
              account or network.
            </p>
            <ul>
              <li>Independent local workspaces</li>
              <li>Single-owner review and release</li>
              <li>No automatic upload or synchronization</li>
            </ul>
            <Button disabled={busy} onClick={() => void choose('solo')}>
              Start locally <ArrowUpRight size={16} />
            </Button>
          </Panel>
          <Panel>
            <span className="mode-icon">
              <Cloud size={26} />
            </span>
            <h2>Team online</h2>
            <p>
              Shared Supabase workspaces. Create a company, manage plants, and give each person the
              right access.
            </p>
            <ul>
              <li>Verified accounts and memberships</li>
              <li>Server-enforced roles and permissions</li>
              <li>Independent review policies</li>
            </ul>
            <Button variant="secondary" disabled={busy} onClick={() => void choose('team')}>
              Open team workspace <ArrowUpRight size={16} />
            </Button>
          </Panel>
        </div>
        <p className="welcome-note">
          Moving solo records into a company is an explicit, reviewed cutover.
        </p>
      </main>
    );
  if (!authority)
    return (
      <main className="workspace-picker">
        <Button variant="ghost" disabled={recoveryPending} onClick={() => void switchMode()}>
          ← Change mode
        </Button>
        <PageHeading
          eyebrow={mode === 'solo' ? 'DEVICE WORKSPACES' : 'COMPANY WORKSPACES'}
          title={mode === 'solo' ? 'A home for your factory.' : 'Your companies.'}
          description={
            mode === 'solo'
              ? 'Each workspace is independent and saved to local SQLite.'
              : 'Only active company memberships appear here.'
          }
        />
        {error ? (
          <div className="feedback error" role="alert">
            {error}
          </div>
        ) : null}
        {mode === 'team' && props.team ? (
          <TeamOnboarding
            auth={props.team.auth}
            onChange={async () => {
              const user = await props.team!.auth.currentUser();
              generation.current++;
              await queryClient.cancelQueries();
              queryClient.clear();
              setUserId(user?.id ?? 'signed-out');
              if (user) await refreshWorkspaces();
              else setWorkspaces([]);
            }}
          />
        ) : null}
        <div className="workspace-list">
          {workspaces.map((workspace) => (
            <Panel key={workspace.id}>
              <div>
                <span className="workspace-icon">{workspace.name.slice(0, 1).toUpperCase()}</span>
                <h2>{workspace.name}</h2>
                <p className="muted">
                  {workspace.currency} · {workspace.timezone}
                </p>
              </div>
              <Button
                disabled={busy || recoveryPending}
                onClick={() => void selectWorkspace(workspace.id)}
              >
                Open workspace <ArrowUpRight size={16} />
              </Button>
            </Panel>
          ))}
        </div>
        {mode === 'solo' && props.backup?.recovery && props.backup.recoveryJournal ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setRestoreOpen(true)}>
              Restore encrypted snapshot
            </Button>
            {restoreOpen ? (
              <RestoreDialog
                recovery={props.backup.recovery}
                journal={props.backup.recoveryJournal}
                checkPending={checkRecoveryPending}
                onPendingChange={setRecoveryPending}
                onClose={() => setRestoreOpen(false)}
                onActivated={async (restored) => {
                  generation.current++;
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  setWorkspaces(restored);
                  setRecoveryPending(false);
                  setStatus('Restored snapshot committed. Previous database retained.');
                  setError('');
                }}
              />
            ) : null}
          </>
        ) : null}
        {mode === 'solo' && repository && !busy && !recoveryPending ? (
          <CreateSolo
            repository={repository}
            onCreated={async (workspace) => {
              await refreshWorkspaces();
              await selectWorkspace(workspace.id);
            }}
          />
        ) : null}
      </main>
    );
  const data = snapshot.data;
  return (
    <div className={`app-shell ${sidebar ? 'sidebar-open' : ''}`}>
      <aside className="sidebar">
        <Link className="brand" to="/app/overview">
          <span className="brand-mark">
            <Factory size={21} />
          </span>
          <span>
            factory<span className="brand-sub">FASTENERS ERP</span>
          </span>
        </Link>
        <div className="workspace-control">
          <div className="workspace-avatar">{data?.workspace.name.slice(0, 1) ?? 'F'}</div>
          <div>
            <strong>{data?.workspace.name ?? 'Opening…'}</strong>
            <span>{mode === 'solo' ? 'Independent workspace' : 'Company workspace'}</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <label className="sr-only" htmlFor="workspace-select">
          Active workspace
        </label>
        <select
          id="workspace-select"
          value={authority.kind === 'solo' ? authority.workspaceId : authority.companyId}
          disabled={busy || Boolean(unknown)}
          onChange={(event) => void selectWorkspace(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <nav aria-label="Factory modules">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map(([id, label, Icon]) => (
                <NavLink
                  key={id}
                  to={`/app/${id}`}
                  onClick={() => {
                    setFilter('');
                    setSidebar(false);
                  }}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {id === 'quality' && data?.lots.some((lot) => lot.qcState === 'held') ? (
                    <span className="nav-count">
                      {data.lots.filter((lot) => lot.qcState === 'held').length}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="authority-card">
            {mode === 'solo' ? <HardDrive size={17} /> : <Cloud size={17} />}
            <div>
              <strong>{mode === 'solo' ? 'Solo mode' : 'Team mode'}</strong>
              <small>
                {mode === 'solo'
                  ? 'Saved on this device'
                  : online
                    ? 'Company server authority'
                    : 'Offline — cached read'}
              </small>
            </div>
          </div>
          <Button
            variant="ghost"
            disabled={busy || Boolean(unknown)}
            onClick={() => void switchMode()}
          >
            <LogOut size={16} /> Change mode
          </Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            variant="ghost"
            className="mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu size={20} />
          </Button>
          {authority.kind === 'team' && data?.plants ? (
            <label className="plant-select">
              <span className="sr-only">Active plant</span>
              <select
                aria-label="Active plant"
                value={authority.plantId ?? data.plantId ?? ''}
                disabled={busy || Boolean(unknown)}
                onChange={(event) => void selectPlant(event.target.value)}
              >
                {data.plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{module.replaceAll('_', ' ')}</strong>
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Filter loaded records"
              placeholder="Search loaded records…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <kbd>/</kbd>
          </label>
          <Button
            variant="ghost"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <Button
            variant="ghost"
            aria-label="Refresh authority records"
            disabled={busy}
            onClick={() => void snapshot.refetch()}
          >
            <RefreshCw size={17} />
          </Button>
          <div className="profile-avatar">{mode === 'solo' ? 'O' : 'T'}</div>
        </header>
        <div className="save-strip">
          <span className={`save-dot ${unknown ? 'unknown' : ''}`} />
          <span>
            {mode === 'solo' ? 'Solo — saved on this device' : 'Team — saved to company server'}
          </span>
          <span className="save-message" role="status">
            {status || 'Authority-scoped records'}
          </span>
          {unknown ? (
            <Button variant="secondary" disabled={busy} onClick={() => void execute(unknown)}>
              Retry original request
            </Button>
          ) : null}
        </div>
        <main
          className="main-content"
          data-workspace={data?.workspace.name}
          data-sample={data?.workspace.name.startsWith('SAMPLE') ? 'true' : 'false'}
        >
          {error ? (
            <div className="feedback error" role="alert">
              {error}
            </div>
          ) : null}
          {snapshot.error ? (
            <Panel>
              <EmptyState
                title="Authority unavailable"
                description={
                  snapshot.error instanceof Error
                    ? snapshot.error.message
                    : 'Cannot confirm current records.'
                }
                action={<Button onClick={() => void snapshot.refetch()}>Retry read</Button>}
              />
            </Panel>
          ) : snapshot.isPending ? (
            <Panel>
              <EmptyState
                title="Opening the authority"
                description="Reading committed records. No business action has been performed."
              />
            </Panel>
          ) : data && repository ? (
            <FactoryProvider
              value={{
                repository,
                authority,
                snapshot: data,
                busy: busy || Boolean(unknown),
                can: (command, payload) =>
                  authority.kind === 'team' && !online
                    ? { allowed: false, reason: 'Team is offline. Critical writes are blocked.' }
                    : capability(authority, data, command, payload),
                run,
              }}
            >
              {module === 'overview' ? (
                <Overview />
              ) : moduleKinds[module] ? (
                <Records key={module} module={module} filter={filter} />
              ) : module === 'stock' ? (
                <Stock filter={filter} />
              ) : module === 'dispatch' ? (
                <Dispatch />
              ) : module === 'reports' || module === 'audit' ? (
                <Reports audit={module === 'audit'} />
              ) : module === 'settings' &&
                authority.kind === 'team' &&
                props.team?.administration ? (
                <TeamAdministration
                  companyId={authority.companyId}
                  administration={props.team.administration}
                  auth={props.team.auth}
                  onPlantChange={(plantId) => void selectPlant(plantId)}
                />
              ) : module === 'settings' ? (
                <>
                  <PageHeading eyebrow="WORKSPACE" title="Settings & recovery" />
                  <Panel>
                    <h2>{data.workspace.name}</h2>
                    <p>
                      {data.workspace.currency} · {data.workspace.timezone}
                    </p>
                    <p className="notice">
                      Currency and base units cannot rewrite existing events. Advanced
                      effective-date settings and cutover remain pending.
                    </p>
                    <Button
                      disabled={
                        authority.kind !== 'solo' || !props.backup || busy || Boolean(unknown)
                      }
                      onClick={() => setBackupOpen(true)}
                    >
                      Export encrypted database snapshot
                    </Button>
                    <Button
                      variant="secondary"
                      disabled
                      title="Full validated activation and document restore require the recovery milestone."
                    >
                      Restore / cutover — pending
                    </Button>
                  </Panel>
                </>
              ) : (
                <Overview />
              )}
            </FactoryProvider>
          ) : null}
          {backupOpen && props.backup && authority.kind === 'solo' ? (
            <BackupDialog
              onClose={() => setBackupOpen(false)}
              onExport={async (passphrase) => {
                setBusy(true);
                try {
                  await props.backup!.export(passphrase);
                  setStatus('Encrypted database snapshot saved.');
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </main>
        <footer className="app-footer">
          <span>Fasteners Factory ERP · v0.1.0</span>
          <span>
            {data?.workspace.name.startsWith('SAMPLE')
              ? 'SAMPLE DATA — FICTIONAL'
              : 'Manufacturing design proposal; validate factory procedures'}
          </span>
        </footer>
      </div>
    </div>
  );
}
