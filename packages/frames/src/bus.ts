export type EventListener<T> = (payload: T) => void;

export class EventBus {
    private listeners = new Map<string, Set<EventListener<unknown>>>();

    on<T>(event: string, listener: EventListener<T>) {
        const listeners = this.listeners.get(event) ?? new Set();
        listeners.add(listener as EventListener<unknown>);
        this.listeners.set(event, listeners);
        return () => {
            listeners.delete(listener as EventListener<unknown>);
            if (listeners.size === 0) this.listeners.delete(event);
        };
    }

    emit<T>(event: string, payload: T) {
        for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload);
    }
}

export interface Command<T = unknown> {
    type: string;
    payload: T;
    metadata?: Record<string, unknown>;
}

export type CommandHandler<T = unknown, R = unknown> =
    (command: Command<T>) => R | Promise<R>;

export class CommandBus {
    private handlers = new Map<string, CommandHandler>();

    register<T, R>(type: string, handler: CommandHandler<T, R>) {
        this.handlers.set(type, handler as CommandHandler);
        return () => {
            if (this.handlers.get(type) === handler) this.handlers.delete(type);
        };
    }

    has(type: string) {
        return this.handlers.has(type);
    }

    async dispatch<T, R>(command: Command<T>): Promise<R> {
        const handler = this.handlers.get(command.type);
        if (!handler) throw new Error(`No handler registered for command: ${command.type}`);
        return handler(command as Command) as Promise<R>;
    }
}
