import { Signal } from "@angular/core";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";

/**
 * Options passed to the `fromSse()` creation function.
 */
export interface FromSSEOptions {

  /** Automatically reconnect after disconnection (in milliseconds). Default is 0. */
  reconnectInterval?: number;

  /**
   * Expected format of incoming messages. Determines how incoming data is parsed.
   * Default is json.
   */
  responseType?: 'json' | 'json'

  /** Called when a connection error occurs. */
  onError?: (error: any) => void;

  /** For debugging — displayed in dev tools or logs. */
  debugName?: string;
}

export function fromSse(url: string | URL, options?: FromSSEOptions): Signal<any> {
  url = url.toString();
  const reconnectInterval = options?.reconnectInterval ?? 0;
  const responseType = options?.responseType ?? 'json';
  const onError = options?.onError;
  const debugName = options?.debugName;

  let es: EventSource | null = null;
  let retryTimer: any;

  function connect(set: (value: any) => void): void {
    if (retryTimer != null) {
      clearTimeout(retryTimer);
    }
    retryTimer = undefined;
    es = new EventSource(url, { withCredentials: false });
    es.onmessage = function(event) {
      if (responseType === 'json') {
        set(JSON.parse(event.data))
      } else {
        set(event.data);
      }
    }

    es.onerror = function(err) {
      onError?.(err);
      es?.close();
      es = null;

      retryTimer = setTimeout(function() {
        retryTimer = undefined;
        connect(set);
      }, reconnectInterval);
    }
  }

  return createContextAwareSignal<any>(
    undefined,
    connect,
    function() {
      es?.close();
      es = null;
      if (retryTimer != null) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    },
    fromSse,
    debugName
  )
}
