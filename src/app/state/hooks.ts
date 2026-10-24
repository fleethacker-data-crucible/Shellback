import { useCallback } from 'react';
import { useStore } from './store';
import { ActionError } from './actions';
import type { Workspace } from '../../core/schema';

/** Run a mutator; an ActionError becomes a flash message instead of an exception. */
export function useAction() {
  const { update, flash } = useStore();
  return useCallback(<T,>(fn: (draft: Workspace) => T): T | undefined => {
    let out: T | undefined;
    try {
      update((draft) => {
        out = fn(draft);
        return typeof out === 'string' ? out : undefined;
      });
    } catch (err) {
      if (err instanceof ActionError) { flash(err.message); return undefined; }
      throw err;
    }
    return out;
  }, [update, flash]);
}
