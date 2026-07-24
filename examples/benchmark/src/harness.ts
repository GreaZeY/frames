export interface BenchmarkResult {
    name: string;
    framework: 'frames' | 'react';
    runs: number[];
    median: number;
    mean: number;
    min: number;
    max: number;
}

export interface BenchmarkSample {
    validate?: () => void;
    cleanup?: () => void;
}

export function median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(name: string, framework: 'frames' | 'react', runs: number[]): BenchmarkResult {
    return {
        name,
        framework,
        runs,
        median: median(runs),
        mean: runs.reduce((a, b) => a + b, 0) / runs.length,
        min: Math.min(...runs),
        max: Math.max(...runs),
    };
}

export async function runTimed(
    fn: () => void | BenchmarkSample | Promise<void | BenchmarkSample>
): Promise<[number, void | BenchmarkSample]> {
    const start = performance.now();
    const sample = await fn();
    return [performance.now() - start, sample];
}

export async function benchmark(
    name: string,
    framework: 'frames' | 'react',
    fn: () => void | BenchmarkSample | Promise<void | BenchmarkSample>,
    iterations: number = 20,
    warmup: number = 5,
): Promise<BenchmarkResult> {
    // Warmup runs (discarded)
    for (let i = 0; i < warmup; i++) {
        const sample = await fn();
        sample?.validate?.();
        sample?.cleanup?.();
    }

    const runs: number[] = [];
    for (let i = 0; i < iterations; i++) {
        // Force GC if available
        if ((globalThis as any).gc) (globalThis as any).gc();
        const [elapsed, sample] = await runTimed(fn);
        sample?.validate?.();
        sample?.cleanup?.();
        runs.push(elapsed);
    }

    return summarize(name, framework, runs);
}
