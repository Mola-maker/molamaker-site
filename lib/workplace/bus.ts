import { EventEmitter } from 'events';

export type BusMessage = {
  id: string;
  workflow: string;
  text: string;
  level: 'info' | 'warn' | 'error';
  ts: number;
};

class MessageBus extends EventEmitter {
  private history: BusMessage[] = [];
  readonly MAX_HISTORY = 200;

  constructor() {
    super();
    this.setMaxListeners(200);
  }

  publish(msg: Omit<BusMessage, 'id' | 'ts'>): BusMessage {
    const full: BusMessage = {
      ...msg,
      id: Math.random().toString(36).slice(2, 10),
      ts: Date.now(),
    };
    this.history.push(full);
    if (this.history.length > this.MAX_HISTORY) this.history.shift();
    this.emit('message', full);
    return full;
  }

  getHistory(limit = 50): BusMessage[] {
    return this.history.slice(-limit);
  }
}

export const messageBus = new MessageBus();
