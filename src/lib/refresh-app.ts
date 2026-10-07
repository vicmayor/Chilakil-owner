/**
 * Force a fresh load of the deployed Chilakil Owner app.
 *
 * Installed iOS Home Screen PWAs have no browser reload. `location.reload()`
 * also keeps serving the last cached document there, and a controlling
 * service worker can answer a plain reload from Cache Storage. This module
 * checks for an update, asks a waiting worker to skip waiting, unregisters
 * registrations, deletes this origin's Cache Storage (all of it belongs to
 * the app), then reloads — or navigates with a cache-busting query when a
 * plain reload would stay stale.
 */

export const REFRESH_NAV_LABEL = "Refresh";

/** Query param that makes an iOS standalone navigation a new network load. */
export const REFRESH_QUERY_PARAM = "_refresh";

/** Long enough that the nav icon spin is visible before the document unloads. */
export const REFRESH_SPIN_MS = 700;

/** Cap worker/cache work so a stuck `registration.update()` still reloads. */
export const REFRESH_WORK_TIMEOUT_MS = 2500;

export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

export type RefreshWorker = {
  postMessage: (message: unknown) => void;
};

export type RefreshRegistration = {
  update: () => Promise<void>;
  unregister: () => Promise<boolean>;
  waiting: RefreshWorker | null;
};

export type RefreshClient = {
  registrations: () => Promise<RefreshRegistration[]>;
  cacheNames: () => Promise<string[]>;
  deleteCache: (name: string) => Promise<boolean>;
};

export type FreshLoad = { kind: "reload" } | { kind: "navigate"; href: string };

export type FreshLoadReport = {
  updated: number;
  skipWaiting: number;
  unregistered: number;
  cachesCleared: string[];
  load: FreshLoad;
};

export type LocationLike = {
  reload: () => void;
  replace: (url: string) => void;
};

export type RefreshDeps = {
  client: RefreshClient;
  href: () => string;
  now: () => number;
  standalone: () => boolean;
  location: LocationLike;
  spinMs?: number;
  workTimeoutMs?: number;
};

export function freshLoadTarget(href: string, now: number, cacheBust: boolean): FreshLoad {
  if (!cacheBust) return { kind: "reload" };
  try {
    const url = new URL(href);
    url.searchParams.set(REFRESH_QUERY_PARAM, String(now));
    return { kind: "navigate", href: url.toString() };
  } catch {
    return { kind: "reload" };
  }
}

export function hrefWithoutRefreshParam(href: string): string | null {
  try {
    const url = new URL(href);
    if (!url.searchParams.has(REFRESH_QUERY_PARAM)) return null;
    url.searchParams.delete(REFRESH_QUERY_PARAM);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayStandalone;
}

export async function prepareFreshLoad(
  client: RefreshClient,
  href: string,
  now: number,
  standalone: boolean,
): Promise<FreshLoadReport> {
  const empty = (): FreshLoadReport => ({
    updated: 0,
    skipWaiting: 0,
    unregistered: 0,
    cachesCleared: [],
    load: freshLoadTarget(href, now, standalone),
  });

  try {
    let registrations: RefreshRegistration[] = [];
    try {
      registrations = await client.registrations();
    } catch {
      registrations = [];
    }

    let updated = 0;
    let skipWaiting = 0;
    let unregistered = 0;

    for (const registration of registrations) {
      try {
        await registration.update();
        updated += 1;
      } catch {
        // A failed update check must not block the fresh load.
      }

      if (registration.waiting) {
        try {
          registration.waiting.postMessage(SKIP_WAITING_MESSAGE);
          skipWaiting += 1;
        } catch {
          // The worker may already be gone.
        }
      }

      try {
        if (await registration.unregister()) unregistered += 1;
      } catch {
        // Unregister can fail mid-update; the navigation below still runs.
      }
    }

    let names: string[] = [];
    try {
      names = await client.cacheNames();
    } catch {
      names = [];
    }

    const cachesCleared: string[] = [];
    for (const name of names) {
      try {
        if (await client.deleteCache(name)) cachesCleared.push(name);
      } catch {
        // One bad cache entry should not block the reload.
      }
    }

    // A controlling worker can still answer location.reload() until the
    // document navigates. Treat that the same as iOS standalone.
    const cacheBust = standalone || registrations.length > 0;

    return {
      updated,
      skipWaiting,
      unregistered,
      cachesCleared,
      load: freshLoadTarget(href, now, cacheBust),
    };
  } catch {
    return empty();
  }
}

export function applyFreshLoad(load: FreshLoad, location: LocationLike) {
  if (load.kind === "reload") {
    location.reload();
    return;
  }
  location.replace(load.href);
}

function delay(ms: number): { promise: Promise<void>; cancel: () => void } {
  let id: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    id = setTimeout(resolve, ms);
  });
  return {
    promise,
    cancel: () => {
      if (id !== undefined) clearTimeout(id);
    },
  };
}

function browserRefreshClient(): RefreshClient {
  return {
    async registrations() {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return [];
      try {
        const list = await navigator.serviceWorker.getRegistrations();
        return list.map((registration) => ({
          update: () => registration.update().then(() => undefined),
          unregister: () => registration.unregister(),
          waiting: registration.waiting,
        }));
      } catch {
        return [];
      }
    },
    async cacheNames() {
      if (typeof caches === "undefined") return [];
      try {
        return await caches.keys();
      } catch {
        return [];
      }
    },
    async deleteCache(name: string) {
      if (typeof caches === "undefined") return false;
      try {
        return await caches.delete(name);
      } catch {
        return false;
      }
    },
  };
}

export async function refreshInstalledApp(deps?: Partial<RefreshDeps>): Promise<FreshLoadReport> {
  const client = deps?.client ?? browserRefreshClient();
  const href = deps?.href?.() ?? window.location.href;
  const now = deps?.now ?? (() => Date.now());
  const standalone = deps?.standalone?.() ?? readStandalone();
  const location = deps?.location ?? window.location;
  const spinMs = deps?.spinMs ?? REFRESH_SPIN_MS;
  const workTimeoutMs = deps?.workTimeoutMs ?? REFRESH_WORK_TIMEOUT_MS;
  const started = now();

  const timeout = delay(workTimeoutMs);
  let report: FreshLoadReport | undefined;
  try {
    report = await Promise.race([
      prepareFreshLoad(client, href, now(), standalone),
      timeout.promise.then(() => undefined),
    ]);
  } catch {
    report = undefined;
  } finally {
    timeout.cancel();
  }

  const elapsed = now() - started;
  if (elapsed < spinMs) {
    await delay(spinMs - elapsed).promise;
  }

  const load = report?.load ?? freshLoadTarget(href, now(), standalone);
  applyFreshLoad(load, location);
  return (
    report ?? {
      updated: 0,
      skipWaiting: 0,
      unregistered: 0,
      cachesCleared: [],
      load,
    }
  );
}
