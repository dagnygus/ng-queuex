import { Signal } from "@angular/core";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";

/**
 * Options passed to the `fromWebsocket()` creation function.
 */
export interface FromWebSocketOptions {

  /** WebSocket protocols to pass to the constructor. */
  protocols?: string | string[];

  /** Automatically reconnect after disconnection (ms). */
  reconnectInterval?: number;

  /** Maximum number of reconnect attempts (default: unlimited). */
  maxReconnectAttempts?: number;

  /**
  * Expected format of incoming messages.
  * Determines how incoming data is parsed.
  *
  * - `'text'` — plain string messages
  * - `'json'` — parsed JSON objects
  * - `'blob'` — binary Blob data
  * - `'arrayBuffer'` — binary ArrayBuffer data
  *
  * @default 'json'
  */
  messageType?: 'text' | 'json' | 'blob' | 'arrayBuffer';

  /** Called when the connection opens. */
  onOpen?: (ws: WebSocket) => void;

  /** Called when the connection closes. */
  onClose?: (event: CloseEvent) => void;

  /** Called when an error occurs. */
  onError?: (err: Event) => void;

  /** Called when a new message arrives. */
  onMessage?: (msg: MessageEvent<any>) => void;

  /** Optional debug label for tracing. */
  debugName?: string;
}

/**
 * Creates a reactive `Signal` that connects to a WebSocket endpoint.
 *
 * The WebSocket connection is lazily initialized: it is only established
 * when the signal is first read by a reactive consumer (e.g. inside an effect
 * or a component template). When the last consumer unsubscribes, the connection
 * is automatically closed. If new consumers appear later, the connection is
 * re-established.
 *
 * Supports automatic reconnection and message type handling.
 *
 * @typeParam T - The inferred message type, depending on the `messageType` option.
 *
 * @param url - The WebSocket endpoint URL to connect to.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @example
 * ```ts
 * const messages = fromWebSocket<{ id: number; text: string }>('wss://api.example.com/chat', {
 *   messageType: 'json',
 *   reconnectInterval: 2000,
 *   onOpen: () => console.log('Connected'),
 *   onError: (e) => console.error('Socket error', e)
 * });
 *
 * effect(() => {
 *   const msg = messages();
 *   if (msg) console.log('New message:', msg.text);
 * });
 * ```
 */
export function fromWebSocket<T>(url: string | URL): Signal<T | undefined>;
/**
 * Creates a reactive `Signal` that connects to a WebSocket endpoint.
 *
 * The WebSocket connection is lazily initialized: it is only established
 * when the signal is first read by a reactive consumer (e.g. inside an effect
 * or a component template). When the last consumer unsubscribes, the connection
 * is automatically closed. If new consumers appear later, the connection is
 * re-established.
 *
 * Supports automatic reconnection and message type handling.
 *
 * @typeParam T - The inferred message type, depending on the `messageType` option.
 *
 * @param url - The WebSocket endpoint URL to connect to.
 *
 * @param options - Optional configuration object:
 * - `protocols` — Optional subprotocol(s) to use when establishing the WebSocket.
 * - `reconnectInterval` — Delay (in ms) between automatic reconnect attempts. Default: `1000`.
 * - `maxReconnectAttempts` — Maximum number of reconnect attempts before giving up. Default: `Infinity`.
 * - `messageType` — The expected type of incoming messages:
 *    - `'json'` → parses `event.data` as JSON and infers type `T`
 *    - `'text'` → passes raw string data
 *    - `'blob'` → passes `Blob` objects
 *    - `'arrayBuffer'` → passes `ArrayBuffer` binary data
 * - `onOpen` — Called when the WebSocket connection opens.
 * - `onClose` — Called when the connection closes.
 * - `onError` — Called when an error event occurs.
 * - `onMessage` — Called for every received message before updating the signal.
 * - `debugName` — Optional label used for debugging or development tooling.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @example
 * ```ts
 * const messages = fromWebSocket<{ id: number; text: string }>('wss://api.example.com/chat', {
 *   messageType: 'json',
 *   reconnectInterval: 2000,
 *   onOpen: () => console.log('Connected'),
 *   onError: (e) => console.error('Socket error', e)
 * });
 *
 * effect(() => {
 *   const msg = messages();
 *   if (msg) console.log('New message:', msg.text);
 * });
 * ```
 */
export function fromWebSocket<T>(
  url: string | URL,
  options: {
    protocols?: string | string[];
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    messageType?: 'json';
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event) => void;
    onMessage?: (msg: MessageEvent<any>) => void;
    debugName?: string;
  }
): Signal<T | undefined> & { send: (data: any) => void };
/**
 * Creates a reactive `Signal` that connects to a WebSocket endpoint.
 *
 * The WebSocket connection is lazily initialized: it is only established
 * when the signal is first read by a reactive consumer (e.g. inside an effect
 * or a component template). When the last consumer unsubscribes, the connection
 * is automatically closed. If new consumers appear later, the connection is
 * re-established.
 *
 * Supports automatic reconnection and message type handling.
 *
 * @typeParam T - The inferred message type, depending on the `messageType` option.
 *
 * @param url - The WebSocket endpoint URL to connect to.
 *
 * @param options - Optional configuration object:
 * - `protocols` — Optional subprotocol(s) to use when establishing the WebSocket.
 * - `reconnectInterval` — Delay (in ms) between automatic reconnect attempts. Default: `1000`.
 * - `maxReconnectAttempts` — Maximum number of reconnect attempts before giving up. Default: `Infinity`.
 * - `messageType` — The expected type of incoming messages:
 *    - `'json'` → parses `event.data` as JSON and infers type `T`
 *    - `'text'` → passes raw string data
 *    - `'blob'` → passes `Blob` objects
 *    - `'arrayBuffer'` → passes `ArrayBuffer` binary data
 * - `onOpen` — Called when the WebSocket connection opens.
 * - `onClose` — Called when the connection closes.
 * - `onError` — Called when an error event occurs.
 * - `onMessage` — Called for every received message before updating the signal.
 * - `debugName` — Optional label used for debugging or development tooling.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @example
 * ```ts
 * const messages = fromWebSocket<{ id: number; text: string }>('wss://api.example.com/chat', {
 *   messageType: 'json',
 *   reconnectInterval: 2000,
 *   onOpen: () => console.log('Connected'),
 *   onError: (e) => console.error('Socket error', e)
 * });
 *
 * effect(() => {
 *   const msg = messages();
 *   if (msg) console.log('New message:', msg.text);
 * });
 * ```
 */
export function fromWebSocket(
  url: string | URL,
  options: {
    protocols?: string | string[];
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    messageType?: 'text';
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event) => void;
    onMessage?: (msg: MessageEvent<any>) => void;
    debugName?: string;
  }
): Signal<string | undefined> & { send: (data: any) => void };
/**
 * Creates a reactive `Signal` that connects to a WebSocket endpoint.
 *
 * The WebSocket connection is lazily initialized: it is only established
 * when the signal is first read by a reactive consumer (e.g. inside an effect
 * or a component template). When the last consumer unsubscribes, the connection
 * is automatically closed. If new consumers appear later, the connection is
 * re-established.
 *
 * Supports automatic reconnection and message type handling.
 *
 * @typeParam T - The inferred message type, depending on the `messageType` option.
 *
 * @param url - The WebSocket endpoint URL to connect to.
 *
 * @param options - Optional configuration object:
 * - `protocols` — Optional subprotocol(s) to use when establishing the WebSocket.
 * - `reconnectInterval` — Delay (in ms) between automatic reconnect attempts. Default: `1000`.
 * - `maxReconnectAttempts` — Maximum number of reconnect attempts before giving up. Default: `Infinity`.
 * - `messageType` — The expected type of incoming messages:
 *    - `'json'` → parses `event.data` as JSON and infers type `T`
 *    - `'text'` → passes raw string data
 *    - `'blob'` → passes `Blob` objects
 *    - `'arrayBuffer'` → passes `ArrayBuffer` binary data
 * - `onOpen` — Called when the WebSocket connection opens.
 * - `onClose` — Called when the connection closes.
 * - `onError` — Called when an error event occurs.
 * - `onMessage` — Called for every received message before updating the signal.
 * - `debugName` — Optional label used for debugging or development tooling.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @example
 * ```ts
 * const messages = fromWebSocket<{ id: number; text: string }>('wss://api.example.com/chat', {
 *   messageType: 'json',
 *   reconnectInterval: 2000,
 *   onOpen: () => console.log('Connected'),
 *   onError: (e) => console.error('Socket error', e)
 * });
 *
 * effect(() => {
 *   const msg = messages();
 *   if (msg) console.log('New message:', msg.text);
 * });
 * ```
 */
export function fromWebSocket(
  url: string | URL,
  options: {
    protocols?: string | string[];
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    messageType?: 'blob';
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event) => void;
    onMessage?: (msg: MessageEvent<any>) => void;
    debugName?: string;
  }
): Signal<Blob | undefined> & { send: (data: any) => void };
/**
 * Creates a reactive `Signal` that connects to a WebSocket endpoint.
 *
 * The WebSocket connection is lazily initialized: it is only established
 * when the signal is first read by a reactive consumer (e.g. inside an effect
 * or a component template). When the last consumer unsubscribes, the connection
 * is automatically closed. If new consumers appear later, the connection is
 * re-established.
 *
 * Supports automatic reconnection and message type handling.
 *
 * @typeParam T - The inferred message type, depending on the `messageType` option.
 *
 * @param url - The WebSocket endpoint URL to connect to.
 *
 * @param options - Optional configuration object:
 * - `protocols` — Optional subprotocol(s) to use when establishing the WebSocket.
 * - `reconnectInterval` — Delay (in ms) between automatic reconnect attempts. Default: `1000`.
 * - `maxReconnectAttempts` — Maximum number of reconnect attempts before giving up. Default: `Infinity`.
 * - `messageType` — The expected type of incoming messages:
 *    - `'json'` → parses `event.data` as JSON and infers type `T`
 *    - `'text'` → passes raw string data
 *    - `'blob'` → passes `Blob` objects
 *    - `'arrayBuffer'` → passes `ArrayBuffer` binary data
 * - `onOpen` — Called when the WebSocket connection opens.
 * - `onClose` — Called when the connection closes.
 * - `onError` — Called when an error event occurs.
 * - `onMessage` — Called for every received message before updating the signal.
 * - `debugName` — Optional label used for debugging or development tooling.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @example
 * ```ts
 * const messages = fromWebSocket<{ id: number; text: string }>('wss://api.example.com/chat', {
 *   messageType: 'json',
 *   reconnectInterval: 2000,
 *   onOpen: () => console.log('Connected'),
 *   onError: (e) => console.error('Socket error', e)
 * });
 *
 * effect(() => {
 *   const msg = messages();
 *   if (msg) console.log('New message:', msg.text);
 * });
 * ```
 */
export function fromWebSocket(
  url: string | URL,
  options: {
    protocols?: string | string[];
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    messageType?: 'arrayBuffer';
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event) => void;
    onMessage?: (msg: MessageEvent<any>) => void;
    debugName?: string;
  }
): Signal<ArrayBuffer | undefined> & { send: (data: any) => void };
export function fromWebSocket(url: string | URL, options?: FromWebSocketOptions): Signal<any> & { send: (data: any) => void } {
  url = url.toString();
  const protocols = options?.protocols;
  const messageType = options?.messageType ?? 'json';
  const reconnectInterval = options?.reconnectInterval ?? 0;
  const maxReconnectAttempts = options?.maxReconnectAttempts;
  const onOpen = options?.onOpen;
  const onClose = options?.onClose;
  const onError = options?.onError;
  const onMessage = options?.onMessage;
  const debugName = options?.debugName;

  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: any;

  function connect(set: (value: any) => void): void {
    function innerSet(value: any): void {
      set(value);
      onMessage?.(value)
    }
    if (reconnectTimer != null) {
      clearTimeout(reconnectInterval);
    }
    reconnectTimer = undefined;
    ws = new WebSocket(url, protocols);
    ws.onopen = function() {
      reconnectAttempts = 0;
      onOpen?.(ws!)
    }
    ws.onmessage = function(msg) {
      switch (messageType) {
      case 'text':
        innerSet(msg.data as string);
        break;

      case 'json':
        if (msg.data == null) {
          innerSet(null);
        } else {
          innerSet(JSON.parse(msg.data));
        }
        break;

      case 'blob':
        innerSet(msg.data as Blob);
        break;

      case 'arrayBuffer':
        // if the server sends binary frames
        if (msg.data instanceof Blob) {
          msg.data.arrayBuffer().then(innerSet);
        } else {
          innerSet(msg.data as ArrayBuffer);
        }
        break;
      }
    }

    if (onError) {
      ws.onerror = onError;
    }

    ws.onclose = function(event) {
      onClose?.(event);
      ws = null;
      if (maxReconnectAttempts == null || reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(function() {
          reconnectTimer = undefined;
          connect(set)
        }, reconnectInterval);
      }
    }
  }

  const source = createContextAwareSignal<any>(
    undefined,
    connect,
    function() {
      ws?.close();
      ws = null;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    },
    fromWebSocket,
    debugName
  ) as Signal<any> & { send: (data: any) => void };

  source.send = function(data: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  return source;
}
