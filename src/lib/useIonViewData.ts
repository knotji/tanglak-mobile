import { useCallback, useEffect, useRef, useState } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

/**
 * Standardizes the load/error/spinner boilerplate that was hand-rolled,
 * nearly identically, on most pages: `useState<T | null>(null)` +
 * `useState('')` for the error message + `useIonViewWillEnter(() => load())`
 * + `{data === null && !error && <Spinner/>}` / `{error && <ErrorText/>}`.
 *
 * Deliberately does NOT clear `data` back to null before a refetch (see
 * TransactionsPage's fixed flash-spinner bug) -- old data stays visible
 * while a background reload runs, so revisiting a tab doesn't flash a
 * spinner over data that's still correct.
 *
 * `deps`, if given, mirrors the old `useIonViewWillEnter(fn, [dep])` pattern:
 * a change in any listed dependency (e.g. a selected month) triggers a
 * `reload(true)` (fresh-loading-state) automatically, on top of the normal
 * view-enter reload. Needed because the loader closure passed in is only
 * read fresh on the next render -- calling `reload()` manually in the same
 * event handler that changes a dependency would still see the previous
 * render's stale closure.
 *
 * Not used by every page: pages with a genuinely different loading shape
 * (multi-step wizards like UploadPage, or pages combining several
 * independently-failable sources like OverviewPage/TodayPage's
 * partialLoadWarning pattern) are left as-is rather than forced into this
 * one shape.
 */
export function useIonViewData<T>(loader: () => Promise<T>, defaultErrorMessage: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const isFirstRun = useRef(true);

  const reload = useCallback(
    async (clearFirst = false, event?: CustomEvent) => {
      if (clearFirst) setData(null);
      try {
        const result = await loaderRef.current();
        setData(result);
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : defaultErrorMessage);
      } finally {
        (event?.target as HTMLIonRefresherElement | undefined)?.complete();
      }
    },
    [defaultErrorMessage],
  );

  useIonViewWillEnter(() => {
    void reload();
  });

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    void reload(true);
    // deps is caller-controlled, matching the old useIonViewWillEnter(fn, deps) pattern this replaces
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, reload, setData };
}
