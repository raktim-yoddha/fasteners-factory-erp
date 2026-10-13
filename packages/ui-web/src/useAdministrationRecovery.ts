import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdministrationController,
  type AdministrationCommit,
  type AdministrationStore,
  type TeamAdministrationPort,
  type TeamAuthPort,
} from '@fasteners/application';
import {
  DomainError,
  type AdministrationOperation,
  type AdministrationRequest,
} from '@fasteners/contracts';

interface State {
  actorId: string | null;
  pending: AdministrationRequest | null;
  busy: boolean;
  storageIssue: boolean;
  error: string;
  committed: { companyId: string; result: AdministrationCommit } | null;
}
const empty = (actorId: string | null): State => ({
  actorId,
  pending: null,
  busy: false,
  storageIssue: false,
  error: '',
  committed: null,
});
export function useAdministrationRecovery(
  actorId: string | null,
  auth: TeamAuthPort | undefined,
  administration: TeamAdministrationPort | undefined,
  store: AdministrationStore | undefined,
  onCommitted: () => Promise<void>,
) {
  const controller = useMemo(
    () =>
      auth && administration && store
        ? new AdministrationController(auth, administration, store)
        : null,
    [auth, administration, store],
  );
  const [state, setState] = useState<State>(() => empty(null));
  const active = useRef(actorId);
  active.current = actorId;
  useEffect(() => {
    const next = empty(actorId);
    if (controller && actorId) {
      try {
        next.pending = controller.read(actorId);
      } catch (cause) {
        next.storageIssue = true;
        next.error = cause instanceof Error ? cause.message : 'Administration storage unavailable.';
      }
    }
    setState(next);
  }, [actorId, controller]);
  const current = state.actorId === actorId ? state : empty(actorId);
  const blocked = Boolean(
    controller &&
    actorId &&
    (state.actorId !== actorId || current.pending || current.busy || current.storageIssue),
  );
  function recheck() {
    if (!controller || !actorId || current.busy) return;
    try {
      const pending = controller.read(actorId);
      setState((value) => ({ ...value, pending, storageIssue: false, error: '' }));
    } catch (cause) {
      setState((value) => ({
        ...value,
        storageIssue: true,
        error: cause instanceof Error ? cause.message : 'Administration storage unavailable.',
      }));
    }
  }
  async function send(
    companyId?: string,
    operation?: AdministrationOperation,
  ): Promise<AdministrationCommit> {
    if (!controller || !actorId)
      throw new DomainError('AUTH_REQUIRED', 'A verified Team account is required.');
    if (current.busy || current.storageIssue)
      throw new DomainError(
        'WORKSPACE_BUSY',
        'Resolve administration storage or the active request first.',
      );
    const actor = actorId;
    setState((value) => ({ ...value, busy: true, error: '', committed: null }));
    try {
      // Read the request once more under the controller's writer lock before every dispatch.
      const result =
        operation && companyId
          ? await controller.submit(actor, companyId, operation)
          : await controller.retry(actor);
      if (active.current === actor) {
        setState((value) => ({
          ...value,
          committed: { companyId: companyId ?? current.pending!.companyId, result },
        }));
        try {
          await onCommitted();
        } catch {
          if (active.current === actor)
            setState((value) => ({
              ...value,
              error: 'Administration committed. Read refresh failed; retry reading records.',
            }));
        }
      }
      return result;
    } catch (cause) {
      if (active.current === actor)
        setState((value) => ({
          ...value,
          error: cause instanceof Error ? cause.message : 'Administration confirmation unknown.',
          storageIssue:
            value.storageIssue ||
            (cause instanceof DomainError && cause.code === 'STORAGE_UNAVAILABLE'),
        }));
      throw cause;
    } finally {
      if (active.current === actor) {
        try {
          const pending = controller.read(actor);
          setState((value) => ({ ...value, pending, busy: false }));
        } catch (cause) {
          setState((value) => ({
            ...value,
            storageIssue: true,
            busy: false,
            error: cause instanceof Error ? cause.message : 'Administration storage unavailable.',
          }));
        }
      }
    }
  }
  return {
    ...current,
    blocked,
    enabled: Boolean(controller),
    submit: (companyId: string, operation: AdministrationOperation) => send(companyId, operation),
    retry: () => send(),
    recheck,
    dismiss: () => setState((value) => ({ ...value, committed: null, error: '' })),
  };
}
export type AdministrationRecoveryState = ReturnType<typeof useAdministrationRecovery>;
