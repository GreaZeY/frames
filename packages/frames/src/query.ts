import { resource } from './resource';
import type { Resource } from './resource';

export type QueryKey = readonly unknown[];

export interface QueryOptions<T> {
    key: () => QueryKey | false;
    fetcher: (key: QueryKey, signal: AbortSignal) => Promise<T>;
    cache?: boolean;
    staleTime?: number;
    initialValue?: T;
}

type CacheEntry = { data: unknown; updatedAt: number };
type PendingEntry = {
    controller: AbortController;
    promise: Promise<unknown>;
    subscribers: number;
};

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, PendingEntry>();
const serialize = (key: QueryKey) => JSON.stringify(key);

function fresh(entry: CacheEntry | undefined, staleTime: number) {
    return entry !== undefined &&
        (staleTime === Infinity || Date.now() - entry.updatedAt <= staleTime);
}

function acquire<T>(
    id: string,
    key: QueryKey,
    fetcher: QueryOptions<T>['fetcher'],
    signal: AbortSignal,
) {
    let entry = pending.get(id) as PendingEntry | undefined;
    if (!entry) {
        const controller = new AbortController();
        entry = { controller, promise: Promise.resolve(), subscribers: 0 };
        entry.promise = fetcher(key, controller.signal).finally(() => {
            if (pending.get(id) === entry) pending.delete(id);
        });
        pending.set(id, entry);
    }

    entry.subscribers++;
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        entry!.subscribers--;
        if (entry!.subscribers === 0 && pending.get(id) === entry) entry!.controller.abort();
    };
    signal.addEventListener('abort', release, { once: true });
    return (entry.promise as Promise<T>).finally(release);
}

export function query<T>(options: QueryOptions<T>): Resource<T> {
    const staleTime = options.staleTime ?? 0;
    const initialKey = options.key();
    const initialCache = initialKey === false ? undefined : cache.get(serialize(initialKey));
    const request = resource(
        () => {
            const key = options.key();
            return key === false ? false : { id: serialize(key), key };
        },
        async ({ id, key }, signal) => {
            const cached = options.cache === false ? undefined : cache.get(id);
            if (fresh(cached, staleTime)) return cached!.data as T;
            const data = await acquire(id, key, options.fetcher, signal);
            if (options.cache !== false) cache.set(id, { data, updatedAt: Date.now() });
            return data;
        },
        (initialCache?.data as T | undefined) ?? options.initialValue,
    );
    const refetch = request.refetch;

    return {
        ...request,
        refetch: () => {
            const key = options.key();
            if (key !== false) cache.delete(serialize(key));
            return refetch();
        },
    };
}

export function invalidateQuery(key?: QueryKey) {
    if (key) cache.delete(serialize(key));
    else cache.clear();
}
