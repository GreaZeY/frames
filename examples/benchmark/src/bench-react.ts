import React from 'react';
import ReactDOM from 'react-dom/client';
import { benchmark, type BenchmarkResult } from './harness';

// Helper: render a React component into a fresh container, return root for cleanup
function renderFresh(element: React.ReactElement): { container: HTMLDivElement; root: ReturnType<typeof ReactDOM.createRoot> } {
    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return { container, root };
}

// Force React to flush synchronous updates via flushSync
const { flushSync } = ReactDOM;

// ─── Benchmark 1: Create 1,000 rows ──────────────────────────────────────────
export async function reactCreate1000(): Promise<BenchmarkResult> {
    return benchmark('Create 1,000 rows', 'react', () => {
        const data = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            label: `Item ${i}`
        }));

        const container = document.createElement('div');
        const root = ReactDOM.createRoot(container);

        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id, className: 'row' },
                            React.createElement('span', null, item.label),
                            React.createElement('button', { onClick: () => {} }, 'X')
                        )
                    )
                )
            );
        });

        return {
            validate: () => {
                if (container.firstElementChild?.children.length !== 1000) {
                    throw new Error('React created an invalid row count');
                }
            },
            cleanup: () => root.unmount(),
        };
    });
}

// ─── Benchmark 2: Update every 10th row ──────────────────────────────────────
export async function reactUpdate10th(): Promise<BenchmarkResult> {
    let data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        label: `Item ${i}`
    }));

    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);

    // Initial render
    flushSync(() => {
        root.render(
            React.createElement('div', null,
                data.map(item =>
                    React.createElement('div', { key: item.id },
                        React.createElement('span', null, item.label)
                    )
                )
            )
        );
    });

    let round = 0;
    const result = await benchmark('Update every 10th row', 'react', () => {
        round++;
        data = data.map((item, i) =>
            i % 10 === 0 ? { ...item, label: `Item ${item.id} !!!${round}` } : item
        );
        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id },
                            React.createElement('span', null, item.label)
                        )
                    )
                )
            );
        });
        return {
            validate: () => {
                if (container.firstElementChild?.firstElementChild?.textContent !== data[0].label) {
                    throw new Error('React did not update row content');
                }
            },
        };
    });

    root.unmount();
    return result;
}

// ─── Benchmark 3: Replace all 1,000 rows ─────────────────────────────────────
export async function reactReplace1000(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    let id = 0;

    // Initial render
    let data = Array.from({ length: 1000 }, () => ({ id: id++, label: `Item ${id}` }));
    flushSync(() => {
        root.render(
            React.createElement('div', null,
                data.map(item =>
                    React.createElement('div', { key: item.id }, item.label)
                )
            )
        );
    });

    const result = await benchmark('Replace 1,000 rows', 'react', () => {
        data = Array.from({ length: 1000 }, () => ({ id: id++, label: `Item ${id}` }));
        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id }, item.label)
                    )
                )
            );
        });
        return {
            validate: () => {
                if (container.firstElementChild?.children.length !== 1000) {
                    throw new Error('React replacement lost rows');
                }
            },
        };
    });

    root.unmount();
    return result;
}

// ─── Benchmark 4: Swap two rows ──────────────────────────────────────────────
export async function reactSwapRows(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);

    let data = Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `Item ${i}` }));

    flushSync(() => {
        root.render(
            React.createElement('div', null,
                data.map(item =>
                    React.createElement('div', { key: item.id }, item.label)
                )
            )
        );
    });

    const result = await benchmark('Swap rows', 'react', () => {
        const d = [...data];
        const temp = d[1];
        d[1] = d[998];
        d[998] = temp;
        data = d;
        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id }, item.label)
                    )
                )
            );
        });
        return {
            validate: () => {
                if (container.firstElementChild?.children[1]?.textContent !== data[1].label) {
                    throw new Error('React rendered the wrong row order');
                }
            },
        };
    });

    root.unmount();
    return result;
}

// ─── Benchmark 5: Remove a row ───────────────────────────────────────────────
export async function reactRemoveRow(): Promise<BenchmarkResult> {
    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    let nextId = 0;

    let data = Array.from({ length: 1000 }, () => ({ id: nextId++, label: `Item ${nextId}` }));

    flushSync(() => {
        root.render(
            React.createElement('div', null,
                data.map(item =>
                    React.createElement('div', { key: item.id }, item.label)
                )
            )
        );
    });

    let removeIdx = 0;
    const result = await benchmark('Remove row', 'react', () => {
        if (data.length < 10) {
            data = Array.from({ length: 1000 }, () => ({ id: nextId++, label: `Item ${nextId}` }));
            flushSync(() => {
                root.render(
                    React.createElement('div', null,
                        data.map(item =>
                            React.createElement('div', { key: item.id }, item.label)
                        )
                    )
                );
            });
        }
        const idx = removeIdx++ % data.length;
        data = [...data.slice(0, idx), ...data.slice(idx + 1)];
        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id }, item.label)
                    )
                )
            );
        });
        return {
            validate: () => {
                if (container.firstElementChild?.children.length !== data.length) {
                    throw new Error('React removed the wrong row count');
                }
            },
        };
    });

    root.unmount();
    return result;
}

// ─── Benchmark 6: Create 10,000 rows ─────────────────────────────────────────
export async function reactCreate10000(): Promise<BenchmarkResult> {
    return benchmark('Create 10,000 rows', 'react', () => {
        const data = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            label: `Item ${i}`
        }));

        const container = document.createElement('div');
        const root = ReactDOM.createRoot(container);

        flushSync(() => {
            root.render(
                React.createElement('div', null,
                    data.map(item =>
                        React.createElement('div', { key: item.id, className: 'row' }, item.label)
                    )
                )
            );
        });

        return {
            validate: () => {
                if (container.firstElementChild?.children.length !== 10000) {
                    throw new Error('React created an invalid row count');
                }
            },
            cleanup: () => root.unmount(),
        };
    }, 10, 2);
}

// ─── Benchmark 7: useState propagation (comparable to signal propagation) ────
export async function reactStatePropagation(): Promise<BenchmarkResult> {
    // React doesn't have standalone signals, so we simulate with setState + flushSync
    // This measures the overhead of React's reconciler for simple state changes
    return benchmark('State propagation (10k updates)', 'react', () => {
        const container = document.createElement('div');
        const root = ReactDOM.createRoot(container);

        let setter: ((v: number) => void) | null = null;

        function App() {
            const [val, setVal] = React.useState(0);
            setter = setVal;
            return React.createElement('span', null, val);
        }

        flushSync(() => {
            root.render(React.createElement(App));
        });

        for (let i = 0; i < 10000; i++) {
            flushSync(() => {
                setter!(i);
            });
        }

        root.unmount();
    }, 5, 2);
}

// ─── Benchmark 8: Batch updates (comparable to Frames batch) ─────────────────
export async function reactBatchUpdates(): Promise<BenchmarkResult> {
    return benchmark('Batch 1000 state writes', 'react', () => {
        const container = document.createElement('div');
        const root = ReactDOM.createRoot(container);

        let setters: ((fn: (v: number) => number) => void)[] = [];

        function App() {
            const states: number[] = [];
            setters = [];
            for (let i = 0; i < 100; i++) {
                const [val, setVal] = React.useState(i);
                states.push(val);
                setters.push(setVal);
            }
            const total = states.reduce((a, b) => a + b, 0);
            return React.createElement('span', null, total);
        }

        flushSync(() => {
            root.render(React.createElement(App));
        });

        // React 18+ auto-batches inside flushSync
        flushSync(() => {
            for (const set of setters) {
                set(v => v + 1);
            }
        });

        root.unmount();
    });
}
