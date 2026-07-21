import './style.css';
import type { BenchmarkResult } from './harness';

import {
    framesCreate1000, framesUpdate10th, framesReplace1000,
    framesSwapRows, framesRemoveRow, framesCreate10000,
    framesSignalPropagation, framesBatchUpdates,
} from './bench-frames';

import {
    reactCreate1000, reactUpdate10th, reactReplace1000,
    reactSwapRows, reactRemoveRow, reactCreate10000,
    reactStatePropagation, reactBatchUpdates,
} from './bench-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchPair {
    name: string;
    frames: (() => Promise<BenchmarkResult>);
    react: (() => Promise<BenchmarkResult>);
}

const BENCHMARKS: BenchPair[] = [
    { name: 'Create 1,000 rows',          frames: framesCreate1000,         react: reactCreate1000 },
    { name: 'Replace 1,000 rows',         frames: framesReplace1000,        react: reactReplace1000 },
    { name: 'Update every 10th row',      frames: framesUpdate10th,         react: reactUpdate10th },
    { name: 'Swap rows',                  frames: framesSwapRows,           react: reactSwapRows },
    { name: 'Remove row',                 frames: framesRemoveRow,          react: reactRemoveRow },
    { name: 'Create 10,000 rows',         frames: framesCreate10000,        react: reactCreate10000 },
    { name: 'Signal propagation (10k)',   frames: framesSignalPropagation,  react: reactStatePropagation },
    { name: 'Batch 1000 state writes',    frames: framesBatchUpdates,       react: reactBatchUpdates },
];

// ─── DOM Setup ───────────────────────────────────────────────────────────────

const app = document.getElementById('app')!;

app.innerHTML = `
    <div class="bench-header">
        <h1><span class="frames">Frames</span><span class="vs">vs</span><span class="react">React</span></h1>
        <p>Real DOM benchmark — ${BENCHMARKS.length} operations, 20 iterations each, median time reported</p>
    </div>

    <div class="bench-controls">
        <button id="run-btn" class="bench-btn bench-btn-primary">Run All Benchmarks</button>
    </div>

    <div id="status" class="bench-status"></div>

    <div class="legend">
        <div class="legend-item"><div class="legend-dot frames"></div>Frames</div>
        <div class="legend-item"><div class="legend-dot react"></div>React</div>
    </div>

    <table class="results-table">
        <thead>
            <tr>
                <th>Benchmark</th>
                <th>Frames (ms)</th>
                <th>React (ms)</th>
                <th>Difference</th>
            </tr>
        </thead>
        <tbody id="results-body">
            <tr class="placeholder-row">
                <td colspan="4">Click "Run All Benchmarks" to start</td>
            </tr>
        </tbody>
    </table>

    <div class="bench-footer">
        Measured with <code>performance.now()</code> &middot; 5 warmup runs + 20 timed runs &middot; median reported<br/>
        Lower is better &middot; React ${(window as any).React?.version || '19'} &middot; Synchronous rendering via flushSync
    </div>
`;

// ─── Runner ──────────────────────────────────────────────────────────────────

const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;
const tbody = document.getElementById('results-body')!;

function setStatus(html: string) {
    statusEl.innerHTML = html;
}

function formatMs(ms: number): string {
    return ms < 1 ? ms.toFixed(3) : ms.toFixed(2);
}

function renderRow(name: string, framesMs: number, reactMs: number): string {
    const diff = reactMs / framesMs;
    const pct = ((diff - 1) * 100);
    const isFaster = framesMs < reactMs;
    const diffClass = isFaster ? 'faster' : 'slower';
    const diffLabel = isFaster
        ? `${diff.toFixed(1)}x faster`
        : `${(1/diff).toFixed(1)}x slower`;

    // Visual bar widths
    const maxMs = Math.max(framesMs, reactMs);
    const framesWidth = Math.max(2, (framesMs / maxMs) * 200);
    const reactWidth = Math.max(2, (reactMs / maxMs) * 200);

    return `
        <tr>
            <td>
                <div class="bench-name">${name}</div>
                <div class="bar-row">
                    <div class="bar frames-bar" style="width: ${framesWidth}px"></div>
                    <div class="bar react-bar" style="width: ${reactWidth}px"></div>
                </div>
            </td>
            <td class="col-frames">${formatMs(framesMs)}</td>
            <td class="col-react">${formatMs(reactMs)}</td>
            <td class="col-diff ${diffClass}">${diffLabel}</td>
        </tr>
    `;
}

async function runAll() {
    runBtn.disabled = true;
    tbody.innerHTML = '';

    const allResults: { name: string; frames: number; react: number }[] = [];

    for (let i = 0; i < BENCHMARKS.length; i++) {
        const bench = BENCHMARKS[i];
        setStatus(`<span class="spinner"></span>Running ${i + 1}/${BENCHMARKS.length}: ${bench.name} (Frames)...`);

        // Run Frames version
        await new Promise(r => setTimeout(r, 50)); // Let the UI repaint
        const framesResult = await bench.frames();

        setStatus(`<span class="spinner"></span>Running ${i + 1}/${BENCHMARKS.length}: ${bench.name} (React)...`);

        await new Promise(r => setTimeout(r, 50));
        const reactResult = await bench.react();

        allResults.push({
            name: bench.name,
            frames: framesResult.median,
            react: reactResult.median,
        });

        // Render results incrementally
        tbody.innerHTML = allResults.map(r => renderRow(r.name, r.frames, r.react)).join('');
    }

    // Summary
    const totalFrames = allResults.reduce((s, r) => s + r.frames, 0);
    const totalReact = allResults.reduce((s, r) => s + r.react, 0);
    const overallRatio = totalReact / totalFrames;

    setStatus(`Done! Frames is <strong>${overallRatio.toFixed(1)}x</strong> faster overall (${formatMs(totalFrames)}ms vs ${formatMs(totalReact)}ms total).`);
    runBtn.disabled = false;
}

runBtn.addEventListener('click', runAll);
