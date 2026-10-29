import "fake-indexeddb/auto";
if (!globalThis.CustomEvent)
  globalThis.CustomEvent = class extends Event {
    detail: unknown;
    constructor(type: string, options?: CustomEventInit) {
      super(type, options);
      this.detail = options?.detail;
    }
  } as typeof CustomEvent;
