import assert from "node:assert/strict";
import test from "node:test";
import {
  REFRESH_NAV_LABEL,
  REFRESH_QUERY_PARAM,
  SKIP_WAITING_MESSAGE,
  applyFreshLoad,
  freshLoadTarget,
  hrefWithoutRefreshParam,
  prepareFreshLoad,
  refreshInstalledApp,
  type RefreshRegistration,
} from "./refresh-app";

const PAGE = "https://owner.chilakil.test/dashboard?tab=today#sales";

function registration(overrides: Partial<RefreshRegistration> = {}): RefreshRegistration & {
  updateCalls: number;
  unregisterCalls: number;
  messages: unknown[];
} {
  const state = {
    updateCalls: 0,
    unregisterCalls: 0,
    messages: [] as unknown[],
  };
  return {
    ...state,
    waiting: overrides.waiting === undefined ? { postMessage: (message) => state.messages.push(message) } : overrides.waiting,
    update:
      overrides.update ??
      (async () => {
        state.updateCalls += 1;
      }),
    unregister:
      overrides.unregister ??
      (async () => {
        state.unregisterCalls += 1;
        return true;
      }),
    get updateCalls() {
      return state.updateCalls;
    },
    get unregisterCalls() {
      return state.unregisterCalls;
    },
    get messages() {
      return state.messages;
    },
  };
}

test("nav label matches the English labels already in the bar", () => {
  assert.equal(REFRESH_NAV_LABEL, "Refresh");
});

test("a normal browser tab reloads when there is no service worker", async () => {
  const report = await prepareFreshLoad(
    {
      registrations: async () => [],
      cacheNames: async () => [],
      deleteCache: async () => false,
    },
    PAGE,
    100,
    false,
  );

  assert.equal(report.load.kind, "reload");
  assert.deepEqual(report.cachesCleared, []);
});

test("iOS standalone mode cache-busts instead of location.reload", () => {
  const load = freshLoadTarget(PAGE, 1700000000000, true);
  assert.equal(load.kind, "navigate");
  if (load.kind !== "navigate") return;
  const url = new URL(load.href);
  assert.equal(url.pathname, "/dashboard");
  assert.equal(url.searchParams.get("tab"), "today");
  assert.equal(url.searchParams.get(REFRESH_QUERY_PARAM), "1700000000000");
  assert.equal(url.hash, "#sales");
});

test("a second refresh replaces the cache-bust param", () => {
  const first = freshLoadTarget(PAGE, 10, true);
  assert.equal(first.kind, "navigate");
  if (first.kind !== "navigate") return;
  const second = freshLoadTarget(first.href, 11, true);
  assert.equal(second.kind, "navigate");
  if (second.kind !== "navigate") return;
  const url = new URL(second.href);
  assert.equal(url.searchParams.get(REFRESH_QUERY_PARAM), "11");
  assert.equal([...url.searchParams.keys()].filter((key) => key === REFRESH_QUERY_PARAM).length, 1);
});

test("hrefWithoutRefreshParam strips only the bust param", () => {
  assert.equal(hrefWithoutRefreshParam(PAGE), null);
  assert.equal(
    hrefWithoutRefreshParam("https://owner.chilakil.test/sales?tab=week&_refresh=9#top"),
    "/sales?tab=week#top",
  );
});

test("service worker update, skipWaiting, unregister, and app caches run before a cache-busting load", async () => {
  const worker = registration();
  const deleted: string[] = [];
  const report = await prepareFreshLoad(
    {
      registrations: async () => [worker],
      cacheNames: async () => ["pages", "next-static", "other"],
      deleteCache: async (name) => {
        deleted.push(name);
        return name !== "other";
      },
    },
    PAGE,
    42,
    false,
  );

  assert.equal(worker.updateCalls, 1);
  assert.deepEqual(worker.messages, [SKIP_WAITING_MESSAGE]);
  assert.equal(worker.unregisterCalls, 1);
  assert.deepEqual(deleted, ["pages", "next-static", "other"]);
  assert.deepEqual(report.cachesCleared, ["pages", "next-static"]);
  assert.equal(report.updated, 1);
  assert.equal(report.skipWaiting, 1);
  assert.equal(report.unregistered, 1);
  assert.equal(report.load.kind, "navigate");
});

test("a missing waiting worker still unregisters", async () => {
  const worker = registration({ waiting: null });
  const report = await prepareFreshLoad(
    {
      registrations: async () => [worker],
      cacheNames: async () => [],
      deleteCache: async () => false,
    },
    PAGE,
    1,
    false,
  );
  assert.equal(report.skipWaiting, 0);
  assert.equal(worker.unregisterCalls, 1);
  assert.equal(report.load.kind, "navigate");
});

test("update and unregister failures still clear caches and navigate", async () => {
  const worker = registration({
    update: async () => {
      throw new Error("offline");
    },
    unregister: async () => {
      throw new Error("busy");
    },
  });
  const report = await prepareFreshLoad(
    {
      registrations: async () => [worker],
      cacheNames: async () => ["app-shell"],
      deleteCache: async () => true,
    },
    PAGE,
    7,
    true,
  );
  assert.equal(report.updated, 0);
  assert.equal(report.unregistered, 0);
  assert.equal(report.skipWaiting, 1);
  assert.deepEqual(report.cachesCleared, ["app-shell"]);
  assert.equal(report.load.kind, "navigate");
});

test("cache deletion failures do not throw", async () => {
  const report = await prepareFreshLoad(
    {
      registrations: async () => {
        throw new Error("no sw");
      },
      cacheNames: async () => ["app-shell"],
      deleteCache: async () => {
        throw new Error("quota");
      },
    },
    PAGE,
    3,
    false,
  );
  assert.deepEqual(report.cachesCleared, []);
  assert.equal(report.load.kind, "reload");
});

test("applyFreshLoad reloads or replaces to match the plan", () => {
  const calls: string[] = [];
  const location = {
    reload: () => calls.push("reload"),
    replace: (url: string) => calls.push(url),
  };
  applyFreshLoad({ kind: "reload" }, location);
  applyFreshLoad({ kind: "navigate", href: "https://owner.chilakil.test/dashboard?_refresh=1" }, location);
  assert.deepEqual(calls, ["reload", "https://owner.chilakil.test/dashboard?_refresh=1"]);
});

test("refreshInstalledApp shows a spin delay then reloads", async () => {
  const calls: string[] = [];
  const started = Date.now();
  const report = await refreshInstalledApp({
    client: {
      registrations: async () => [],
      cacheNames: async () => [],
      deleteCache: async () => false,
    },
    href: () => PAGE,
    now: () => Date.now(),
    standalone: () => false,
    location: {
      reload: () => calls.push("reload"),
      replace: () => calls.push("replace"),
    },
    spinMs: 40,
    workTimeoutMs: 500,
  });
  assert.ok(Date.now() - started >= 35);
  assert.deepEqual(calls, ["reload"]);
  assert.equal(report.load.kind, "reload");
});

test("a hung service worker update still reloads", async () => {
  const calls: string[] = [];
  await refreshInstalledApp({
    client: {
      registrations: () => new Promise(() => {}),
      cacheNames: async () => [],
      deleteCache: async () => false,
    },
    href: () => PAGE,
    now: () => 50,
    standalone: () => true,
    location: {
      reload: () => calls.push("reload"),
      replace: (url) => calls.push(url),
    },
    spinMs: 0,
    workTimeoutMs: 30,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /_refresh=50/);
});
