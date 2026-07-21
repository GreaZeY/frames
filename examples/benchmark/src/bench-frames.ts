import { state, effect, insert, renderList, batch, delegateEvent } from 'frames';
import { benchmark, type BenchmarkResult } from './harness';

// ─── Benchmark 1: Create 1,000 rows ──────────────────────────────────────────
export async function framesCreate1000(): Promise<BenchmarkResult> {
    return benchmark('Create 1,000 rows', 'frames', () => {
        const container = document.createElement('div');
        const items = state(
            Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                label: `Item ${i}`
            }))
        );
        renderList(
            container,
            () => items.value,
            item => item.id,
            item => {
                const row = document.createElement('div');
                row.className = 'row';
                const label = document.createElement('span');
                label.textContent = item.label;
                const btn = document.createElement('button');
                btn.textContent = 'X';
                btn.$$click = () => {};
                row.appendChild(label);
                row.appendChild(btn);
                return row;
            }
        );
    });
}

// ─── Benchmark 2: Update every 10th row ──────────────────────────────────────
export async function framesUpdate10th(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    let data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        label: `Item ${i}`
    }));
    const items = state(data);

    renderList(
        container,
        () => items.value,
        item => item.id,
        item => {
            const row = document.createElement('div');
            row.className = 'row';
            const label = document.createElement('span');
            label.textContent = item.label;
            row.appendChild(label);
            return row;
        }
    );

    let round = 0;
    return benchmark('Update every 10th row', 'frames', () => {
        round++;
        const newData = data.map((item, i) =>
            i % 10 === 0 ? { ...item, label: `Item ${item.id} !!!${round}` } : item
        );
        data = newData;
        items.value = newData;
    });
}

// ─── Benchmark 3: Replace all 1,000 rows ─────────────────────────────────────
export async function framesReplace1000(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    let id = 0;
    const items = state(
        Array.from({ length: 1000 }, () => ({
            id: id++,
            label: `Item ${id}`
        }))
    );

    renderList(
        container,
        () => items.value,
        item => item.id,
        item => {
            const row = document.createElement('div');
            row.className = 'row';
            row.textContent = item.label;
            return row;
        }
    );

    return benchmark('Replace 1,000 rows', 'frames', () => {
        items.value = Array.from({ length: 1000 }, () => ({
            id: id++,
            label: `Item ${id}`
        }));
    });
}

// ─── Benchmark 4: Swap two rows ──────────────────────────────────────────────
export async function framesSwapRows(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    let data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        label: `Item ${i}`
    }));
    const items = state(data);

    renderList(
        container,
        () => items.value,
        item => item.id,
        item => {
            const row = document.createElement('div');
            row.textContent = item.label;
            return row;
        }
    );

    return benchmark('Swap rows', 'frames', () => {
        const d = [...data];
        const temp = d[1];
        d[1] = d[998];
        d[998] = temp;
        data = d;
        items.value = d;
    });
}

// ─── Benchmark 5: Remove a row ───────────────────────────────────────────────
export async function framesRemoveRow(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    let nextId = 0;
    let data = Array.from({ length: 1000 }, () => ({
        id: nextId++,
        label: `Item ${nextId}`
    }));
    const items = state(data);

    renderList(
        container,
        () => items.value,
        item => item.id,
        item => {
            const row = document.createElement('div');
            row.textContent = item.label;
            return row;
        }
    );

    let removeIdx = 0;
    return benchmark('Remove row', 'frames', () => {
        // Re-populate if depleted
        if (data.length < 10) {
            data = Array.from({ length: 1000 }, () => ({
                id: nextId++,
                label: `Item ${nextId}`
            }));
            items.value = data;
        }
        const idx = removeIdx++ % data.length;
        data = [...data.slice(0, idx), ...data.slice(idx + 1)];
        items.value = data;
    });
}

// ─── Benchmark 6: Create 10,000 rows ─────────────────────────────────────────
export async function framesCreate10000(): Promise<BenchmarkResult> {
    return benchmark('Create 10,000 rows', 'frames', () => {
        const container = document.createElement('div');
        const items = state(
            Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                label: `Item ${i}`
            }))
        );
        renderList(
            container,
            () => items.value,
            item => item.id,
            item => {
                const row = document.createElement('div');
                row.className = 'row';
                row.textContent = item.label;
                return row;
            }
        );
    }, 10, 2);
}

// ─── Benchmark 7: Signal update propagation ──────────────────────────────────
export async function framesSignalPropagation(): Promise<BenchmarkResult> {
    return benchmark('Signal propagation (10k updates)', 'frames', () => {
        const s = state(0);
        let count = 0;
        const dispose = effect(() => {
            count += s.value;
        });
        for (let i = 0; i < 10000; i++) {
            s.value = i;
        }
        dispose();
    });
}

// ─── Benchmark 8: Batch 1000 updates ─────────────────────────────────────────
export async function framesBatchUpdates(): Promise<BenchmarkResult> {
    return benchmark('Batch 1000 signal writes', 'frames', () => {
        const signals = Array.from({ length: 100 }, (_, i) => state(i));
        let total = 0;
        const dispose = effect(() => {
            total = 0;
            for (const s of signals) total += s.value;
        });

        batch(() => {
            for (const s of signals) {
                s.value = s.value + 1;
            }
        });
        dispose();
    });
}
