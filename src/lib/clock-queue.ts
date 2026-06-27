// Offline stamp queue (§6.2) — browser-only. A stamp MUST never be lost when
// the network drops (cellars, bad wifi). We store it in IndexedDB with its
// client-generated id and local timestamp, show the staff a calm "we'll sync"
// message, and replay it on reconnect. `clientId` makes the server write
// idempotent, so a replay can never create a duplicate.

export type QueuedStamp = {
  clientId: string;
  token: string;
  timestamp: string; // ISO, the local time the stamp was actually made
  pin?: string;
  direction?: "IN" | "OUT";
  deviceLabel?: string | null;
};

const DB_NAME = "skifta-clock";
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = run(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function enqueue(stamp: QueuedStamp): Promise<void> {
  await tx("readwrite", (s) => s.put(stamp));
}

export async function pending(): Promise<QueuedStamp[]> {
  return tx<QueuedStamp[]>("readonly", (s) => s.getAll());
}

export async function pendingCount(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

async function remove(clientId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(clientId));
}

/** POST one queued stamp. A 2xx (incl. idempotent duplicate) clears it; a 4xx
 *  means it will never succeed (e.g. wrong PIN) so we also clear it rather than
 *  retry forever; a network error leaves it queued for the next flush. */
async function send(stamp: QueuedStamp): Promise<"sent" | "rejected" | "retry"> {
  try {
    const res = await fetch("/api/clock/stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stamp),
    });
    if (res.ok) return "sent";
    if (res.status >= 400 && res.status < 500) return "rejected";
    return "retry";
  } catch {
    return "retry";
  }
}

/** Flush the whole queue; returns how many remain unsynced afterwards. */
export async function flush(): Promise<number> {
  const items = await pending();
  for (const item of items) {
    const result = await send(item);
    if (result !== "retry") await remove(item.clientId);
  }
  return pendingCount();
}
