import { Signal } from "@angular/core";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";
import { getDefaultOnErrorHandler } from "../common";


/**
 * Options passed to the `fromSse()` creation function.
 */
export interface FromSseOptions {

  /**
   * Automatically reconnect after disconnection (in milliseconds).
   * If not provided there will be no reconnection.
   * */
  reconnectInterval?: number;

  /**
   * Expected format of incoming messages. Determines how incoming data is parsed.
   * Default is json.
   */
  responseType?: 'json' | 'text'

  /** Called when a connection error occurs. */
  onError?: (error: Event | TypeError | DOMException) => void;

  /** For debugging — displayed in dev tools or logs. */
  debugName?: string;
}

/**
 * Creates a reactive {@link Signal} that streams data from a Server-Sent Events (SSE) endpoint.
 *
 * Establishes a persistent connection to the specified SSE `url` and emits each incoming
 * message as plain text or parsed JSON, depending on the generic type `T`.
 *
 * This basic overload uses default configuration and automatically reconnects
 * after unexpected disconnects.
 *
 * @param url - The SSE endpoint URL.
 * @returns A signal emitting the latest received value, or `undefined` before the first message arrives.
 */
export function fromSse<T>(url: string | URL): Signal<T | undefined>;
/**
 * Creates a reactive {@link Signal} that streams and parses JSON messages from a Server-Sent Events (SSE) endpoint.
 *
 * Each incoming SSE message is automatically parsed as JSON. If parsing fails,
 * the error is passed to the `onError` handler (if defined) and logged to the console.
 *
 * Automatically reconnects when the connection closes unexpectedly, unless the user
 * explicitly aborts or disables reconnection through options.
 *
 * @param  url - The SSE endpoint URL.
 * @param options - Optional configuration controlling reconnect behavior, response type, and error handling.
 * @returns  A signal emitting parsed JSON data, or `undefined` before any messages are received.
 *
 * @see {@link FromSseOptions}
 */
export function fromSse<T>(
  url: string | URL,
  options: {
    reconnectInterval?: number,
    responseType?: 'json',
    onError?: (error: Event | TypeError | DOMException) => void,
    debugName?: string;
  }
): Signal<T | undefined>;
/**
 * Creates a reactive {@link Signal} that streams plain text messages from a Server-Sent Events (SSE) endpoint.
 *
 * This overload configures the stream to treat all incoming messages as text,
 * without attempting to parse them as JSON.
 *
 * Automatically reconnects when the connection closes unexpectedly and propagates
 * recoverable and unrecoverable errors through the `onError` callback if provided.
 *
 * @param url - The SSE endpoint URL.
 * @param options - Optional configuration controlling reconnect behavior, response type, and error handling.
 * @returns A signal emitting the latest text message, or `undefined` before any messages are received.
 *
 * @see {@link FromSseOptions}
 */
export function fromSse(
  url: string | URL,
  options: {
    reconnectInterval?: number,
    responseType?: 'text',
    onError?: (error: Event | TypeError | DOMException) => void,
    debugName?: string;
  }
): Signal<string | undefined>;
export function fromSse(url: string | URL, options?: FromSseOptions): Signal<any> {
  url = url.toString();
  const reconnectInterval = options?.reconnectInterval;
  const responseType = options?.responseType ?? 'json';
  const onError = getDefaultOnErrorHandler(options?.onError);
  const debugName = options?.debugName;

  let es: EventSource | null = null;
  let retryTimer: any;

  function connect(set: (value: any) => void): void {
    if (retryTimer != null) {
      clearTimeout(retryTimer);
    }
    retryTimer = undefined;

    try {
      es = new EventSource(url, { withCredentials: false });
      if (!es) { return; }
      es.onmessage = function(event) {
        if (responseType === 'json') {
          try {
            set(JSON.parse(event.data));
          } catch (err) {
            onError(err as any);
          }
        } else {
          set(event.data);
        }
      }

      es.onerror = function(err) {
        onError(err);
        es?.close();
        es = null;

        if (reconnectInterval == null) { return; }

        retryTimer = setTimeout(function() {
          retryTimer = undefined;
          connect(set);
        }, reconnectInterval);
      }
    } catch (err) {
      onError(err as any);
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
