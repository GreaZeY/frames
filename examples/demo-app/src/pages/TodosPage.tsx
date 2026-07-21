import { state, renderList, Portal } from 'frames';

const isModalOpen = state(false);

export default function TodosPage() {
    let nextId = 4;
    const todos = state([
        { id: 1, text: 'Design the reactive primitives' },
        { id: 2, text: 'Build the custom Babel compiler' },
        { id: 3, text: 'Implement surgical DOM reconciliation' },
    ]);

    function addTodo() {
        const input = document.getElementById('todo-input') as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;
        todos.value = [...todos.value, { id: nextId++, text }];
        input.value = '';
    }

    function removeTodo(id: number) {
        todos.value = todos.value.filter(t => t.id !== id);
    }

    const el = (
        <div>
            <h2>List Reconciliation</h2>
            <p class="subtitle">Highly optimized array diffing using Longest Increasing Subsequence.</p>

            <div class="card">
                <div class="todo-input-row">
                    <input id="todo-input" class="todo-input" placeholder="What needs to be done?" onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(); }} />
                    <button class="btn-primary" onClick={addTodo}>Add Task</button>
                    <button class="btn-secondary" onClick={() => {
                        const newTodos = [];
                        for(let i = 0; i < 500; i++) {
                            newTodos.push({ id: nextId++, text: `Stress Test Item ${i}` });
                        }
                        todos.value = [...todos.value, ...newTodos];
                    }}>Add 500 (Stress Test)</button>
                    <button class="btn-secondary" onClick={() => isModalOpen.value = true}>Open Portal Modal</button>
                </div>
                <div id="todo-list-container"></div>
                {() => isModalOpen.value ? (
                    <Portal>
                        <div class="modal-overlay" onClick={() => isModalOpen.value = false}>
                            <div class="modal-content" onClick={(e: MouseEvent) => e.stopPropagation()}>
                                <h2>I'm in a Portal!</h2>
                                <p>This modal is rendered directly into <code>document.body</code> instead of the app root. It maintains full reactivity!</p>
                                <button class="btn-primary" onClick={() => isModalOpen.value = false}>Close Modal</button>
                            </div>
                        </div>
                    </Portal>
                ) : null}
            </div>
        </div>
    );

    // Mount keyed list manually 
    setTimeout(() => {
        const container = document.getElementById('todo-list-container');
        if (container) {
            renderList(container, () => todos.value, t => t.id, t => {
                const item = (
                    <div class="todo-item">
                        <span class="text">{t.text}</span>
                        <button class="remove-btn" onClick={() => removeTodo(t.id)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                );
                return item as Node;
            });
        }
    }, 0);

    return el;
}
