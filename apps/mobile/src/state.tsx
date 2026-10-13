import { createContext,useContext,useEffect,useState,type PropsWithChildren } from 'react';
import { initialize,LocalRepository } from '@fasteners/local-domain';
import { openMobileDriver } from '@fasteners/sqlite-mobile';
import type { Authority,Repository,Snapshot,Workspace } from '@fasteners/contracts';
interface MobileState{repository:Repository|null;authority:Authority|null;workspaces:Workspace[];snapshot:Snapshot|null;error:string;setAuthority:(authority:Authority|null)=>void;reload:()=>Promise<void>;}
const Context=createContext<MobileState|null>(null);
let localPromise:Promise<Repository>|undefined;
function local():Promise<Repository>{localPromise??=openMobileDriver().then(async driver=>{await initialize(driver);return new LocalRepository(driver,'local-owner:android');});return localPromise;}
export function MobileProvider({children}:PropsWithChildren){const[repository,setRepository]=useState<Repository|null>(null);const[authority,setAuthority]=useState<Authority|null>(null);const[workspaces,setWorkspaces]=useState<Workspace[]>([]);const[snapshot,setSnapshot]=useState<Snapshot|null>(null);const[error,setError]=useState('');
  async function reload(){if(!repository)return;try{setWorkspaces(await repository.listWorkspaces());if(authority)setSnapshot(await repository.snapshot(authority));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Storage unavailable.');}}
  useEffect(()=>{let active=true;void local().then(async value=>{if(active){setRepository(value);setWorkspaces(await value.listWorkspaces());}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Storage unavailable.');});return()=>{active=false;};},[]);
  useEffect(()=>{setSnapshot(null);if(!repository||!authority)return;let active=true;void repository.snapshot(authority).then(value=>{if(active)setSnapshot(value);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Storage unavailable.');});return()=>{active=false;};},[repository,authority]);
  return <Context.Provider value={{repository,authority,workspaces,snapshot,error,setAuthority,reload}}>{children}</Context.Provider>;}
export function useMobile(){const value=useContext(Context);if(!value)throw new Error('MobileProvider is required.');return value;}
