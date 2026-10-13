import { createContext, useContext, type PropsWithChildren } from 'react';
import type {
  Authority,
  CommandName,
  CommandPayload,
  Repository,
  Snapshot,
} from '@fasteners/contracts';
interface FactoryContext {
  repository: Repository;
  authority: Authority;
  snapshot: Snapshot;
  busy: boolean;
  can: (
    command: CommandName,
    payload?: CommandPayload<CommandName>,
  ) => { allowed: boolean; reason: string };
  run: <K extends CommandName>(
    command: K,
    payload: CommandPayload<K>,
    revision?: string,
  ) => Promise<boolean>;
}
const Context = createContext<FactoryContext | null>(null);
export function FactoryProvider({ value, children }: PropsWithChildren<{ value: FactoryContext }>) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFactory() {
  const context = useContext(Context);
  if (!context) throw new Error('FactoryProvider is required.');
  return context;
}
