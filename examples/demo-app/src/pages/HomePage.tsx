import { state, derived } from 'frames';

export default function HomePage() {
    const count = state(0);
    const doubled = derived(() => count.value * 2);

    return (
        <div>
            <h2>Lightning Fast Reactivity</h2>
            <p class="subtitle">Powered by fine-grained signals and a custom JSX compiler. No Virtual DOM.</p>

            <div class="card">
                <div class="card-title">Signal Counter</div>
                <div class="counter-display">{() => count.value}</div>
                <div class="counter-derived">
                    Computed (x2) = {() => doubled.value}
                </div>
                <div class="btn-row">
                    <button class="btn-primary" onClick={() => count.value++}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Increment
                    </button>
                    <button class="btn-secondary" onClick={() => count.value--}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Decrement
                    </button>
                </div>
            </div>
            <div style="margin-top: 2rem; color: var(--text-secondary-dark); font-size: 0.85rem; text-align: center;">
                <em>This entire UI only renders once. Only the changing text nodes update directly in the DOM.</em>
            </div>
        </div>
    );
}
