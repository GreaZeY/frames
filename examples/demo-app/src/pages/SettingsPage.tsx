import { store } from 'frames';

export default function SettingsPage() {
    const config = store({
        user: {
            name: 'Alice',
            preferences: {
                notifications: true,
                theme: 'System Default'
            }
        }
    });

    return (
        <div>
            <h2>Deep Proxy Store</h2>
            <p class="subtitle">Mutate deeply nested objects and trigger surgical updates automatically.</p>
            <div class="card" style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label style="font-weight: 500; min-width: 120px;">Display Name</label>
                    <input 
                        type="text" 
                        value={() => config.user.name} 
                        onInput={(e: Event) => config.user.name = (e.target as HTMLInputElement).value}
                        class="todo-input"
                    />
                </div>
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label style="font-weight: 500; min-width: 120px;">Notifications</label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input 
                            type="checkbox" 
                            style="width: 18px; height: 18px; accent-color: #6366f1;"
                            checked={() => config.user.preferences.notifications}
                            onChange={(e: Event) => config.user.preferences.notifications = (e.target as HTMLInputElement).checked}
                        />
                        Enable Push Alerts
                    </label>
                </div>
                
                <div class="json-preview">
                    {() => JSON.stringify(config, null, 2)}
                </div>
                
            </div>
        </div>
    );
}
