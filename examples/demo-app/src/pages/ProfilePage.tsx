async function UserProfile({ id }: { id: number }) {
    // Simulate a network waterfall
    await new Promise(r => setTimeout(r, 1200));
    return (
        <div class="user-profile">
            <div class="avatar">U</div>
            <div class="user-info">
                <h3>User ID: {id}</h3>
                <p>Status: Authenticated</p>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <div>
            <h2>Async Components</h2>
            <p class="subtitle">First-class support for async functions and automatic Suspense boundaries.</p>
            <div class="card">
                <div class="card-title">Network Request Simulation</div>
                <UserProfile id={1042} />
            </div>
        </div>
    );
}
