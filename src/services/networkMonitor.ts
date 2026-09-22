/**
 * Network Status & Offline-First Monitor
 * Observes online/offline connectivity and triggers sync when connectivity is restored.
 */

type NetworkListener = (isOnline: boolean) => void;

class NetworkMonitor {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<NetworkListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleStatusChange(true));
      window.addEventListener('offline', () => this.handleStatusChange(false));
    }
  }

  private handleStatusChange(isOnline: boolean) {
    this.online = isOnline;
    this.listeners.forEach(fn => fn(isOnline));
  }

  public isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.online);
    return () => this.listeners.delete(listener);
  }

  /**
   * For testing & debugging: Explicitly set online status.
   */
  public setOnline(isOnline: boolean): void {
    this.handleStatusChange(isOnline);
  }

  /**
   * For testing purposes: Allows simulating offline/online toggle in UI.
   */
  public simulateToggle(): boolean {
    this.handleStatusChange(!this.online);
    return this.online;
  }
}

export const networkMonitor = new NetworkMonitor();
