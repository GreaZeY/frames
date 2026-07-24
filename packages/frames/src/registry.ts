export class Registry<T> {
    private entries = new Map<string, Array<{ value: T; priority: number }>>();

    register(key: string, value: T, priority = 0) {
        const entries = this.entries.get(key) ?? [];
        const entry = { value, priority };
        entries.push(entry);
        entries.sort((left, right) => right.priority - left.priority);
        this.entries.set(key, entries);
        return () => {
            const next = entries.filter(candidate => candidate !== entry);
            if (next.length) this.entries.set(key, next);
            else this.entries.delete(key);
        };
    }

    resolve(key: string): T | undefined {
        return this.entries.get(key)?.[0]?.value;
    }

    resolveAll(key: string): T[] {
        return this.entries.get(key)?.map(entry => entry.value) ?? [];
    }

    has(key: string) {
        return this.entries.has(key);
    }
}
