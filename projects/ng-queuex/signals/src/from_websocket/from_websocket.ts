import { Signal } from '@angular/core';
import { createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { getDefaultOnErrorHandler } from '../common';

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

  /**
   * Determines what is emitted by the signal: only the event data or the full `MessageEvent` object.
   */
  observe?: 'event' | 'data';

  /** Called when the connection opens. */
  onOpen?: (ws: WebSocket) => void;

  /** Called when the connection closes. */
  onClose?: (event: CloseEvent) => void;

  /** Called when an error occurs. */
  onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;

  /** Called when a new message arrives. */
  onMessage?: (msg: FromWebSocketMessageEvent<any>) => void;

  /** Optional debug label for tracing. */
  debugName?: string;
}

/**
 * Represents a message event emitted by {@link fromWebSocket}.
 *
 * This interface mirrors the standard {@link MessageEvent} but
 * provides strong typing for the `data` payload and immutability guarantees.
 *
 */
export interface FromWebSocketMessageEvent<T> {

  /**
   * The message payload received from the WebSocket server.
   *
   * The data type depends on how the server sends the message — usually a string,
   * but can be parsed into a structured type `T` by the {@link fromWebSocket} helper.
   */
  readonly data: T;

  /**
   * A string identifying the last event in a series of messages.
   * Typically empty for WebSocket messages, but included for consistency
   * with the standard {@link MessageEvent} interface.
   */
  readonly lastEventId: string;

  /**
   * The origin (scheme, host, and port) of the WebSocket server that sent the message.
   */
  readonly origin: string;

  /**
   * A frozen array of {@link MessagePort} objects, used with message channels.
   * WebSockets do not use ports, but the field remains for structural compatibility.
   */
  readonly ports: ReadonlyArray<MessagePort>;

  /**
   * A reference to the source window or worker that sent the message,
   * or `null` if the source is not applicable.
   */
  readonly source: MessageEventSource | null;
}

function getMessageType(message: string | Blob | ArrayBuffer): string {
  if (typeof message === 'string') {
    return 'string';
  }
  return (message as any).constructor.name;
}

/**
 * Represents an error that occurs when a message received through
 * a {@link fromWebSocket} stream does not match the expected format
 * for the configured `messageType`.
 *
 * This error indicates that the WebSocket connection is valid,
 * but the message type is inconsistent with what was expected.
 */
export class FromWebSocketInvalidMessageError extends Error {
  constructor(expected: string, received: string) {
    super(`Expected message type is '${expected}', but received '${received}'`);
  }
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
 * @param url The WebSocket endpoint URL to connect to.
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @see {@link FromWebSocketOptions}
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
    observe?: 'data'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<T>) => void;
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @see {@link FromWebSocketOptions}
 * @see {@link FromWebSocketMessageEvent}
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
    observe?: 'event'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<T>) => void;
    debugName?: string;
  }
): Signal<FromWebSocketMessageEvent<T> | undefined> & { send: (data: any) => void };
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @see {@link FromWebSocketOptions}
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
    observe?: 'data'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<string>) => void;
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @see {@link FromWebSocketOptions}
 * @see {@link FromWebSocketMessageEvent}
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
    observe?: 'event'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<string>) => void;
    debugName?: string;
  }
): Signal<FromWebSocketMessageEvent<string> | undefined> & { send: (data: any) => void };
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @see {@link FromWebSocketOptions}
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
    observe?: 'data'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<Blob>) => void;
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
 * @param url The WebSocket endpoint URL to connect to.
 *
 * @param options A signal creation options.
 *
 * @returns A `Signal` that emits the latest message from the WebSocket stream.
 * The signal updates whenever a new message is received.
 *
 * @see {@link FromWebSocketOptions}
 * @see {@link FromWebSocketMessageEvent}
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
    observe?: 'event'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<Blob>) => void;
    debugName?: string;
  }
): Signal<FromWebSocketMessageEvent<Blob> | undefined> & { send: (data: any) => void };
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
    observe?: 'data'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<ArrayBuffer>) => void;
    debugName?: string;
  }
): Signal<ArrayBuffer | undefined> & { send: (data: any) => void };
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
    observe?: 'event'
    onOpen?: (ws: WebSocket) => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (err: Event | FromWebSocketInvalidMessageError | TypeError | DOMException) => void;
    onMessage?: (msg: FromWebSocketMessageEvent<ArrayBuffer>) => void;
    debugName?: string;
  }
): Signal<FromWebSocketMessageEvent<ArrayBuffer> | undefined> & { send: (data: any) => void };
export function fromWebSocket(url: string | URL, options?: FromWebSocketOptions): Signal<any> & { send: (data: any) => void } {
  url = url.toString();
  const protocols = options?.protocols;
  const messageType = options?.messageType ?? 'json';
  const observe = options?.observe ?? 'data';
  const reconnectInterval = options?.reconnectInterval ?? 0;
  const maxReconnectAttempts = options?.maxReconnectAttempts;
  const onOpen = options?.onOpen;
  const onClose = options?.onClose;
  const onError = getDefaultOnErrorHandler(options?.onError);
  const onMessage = options?.onMessage;
  const debugName = options?.debugName;

  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: any;

  function connect(set: (value: any) => void): void {
    function innerSet(msg: MessageEvent<any>, data: any): void {
      const ev: FromWebSocketMessageEvent<any> = Object.freeze({
        data,
        lastEventId: msg.lastEventId,
        origin: msg.origin,
        ports: msg.ports,
        source: msg.source
      });
      if (observe === 'data') {
        set(data);
      } else {
        set(ev);
      }
      onMessage?.(ev)
    }
    if (reconnectTimer != null) {
      clearTimeout(reconnectInterval);
    }
    reconnectTimer = undefined;
    try {
      ws = new WebSocket(url, protocols);
      ws.onopen = function() {
        reconnectAttempts = 0;
        onOpen?.(ws!)
      }
      ws.onmessage = function(msg) {
        switch (messageType) {
        case 'text':
          if (typeof msg.data !== 'string') {
            onError(new FromWebSocketInvalidMessageError('text', getMessageType(msg.data)));
          } else {
            innerSet(msg, msg.data);
          }
          break;

        case 'json':
          if (typeof msg.data !== 'string') {
            onError(new FromWebSocketInvalidMessageError('json', getMessageType(msg.data)));
          } else {
            if (msg.data == null) {
              innerSet(msg.data, null);
            } else {
              try {
                innerSet(msg, JSON.parse(msg.data));
              } catch (err) {
                onError(err);
              }
            }
          }
          break;

        case 'blob':
          if (msg.data instanceof Blob) {
            innerSet(msg, msg.data);
          } else {
            onError(new FromWebSocketInvalidMessageError('blob', getMessageType(msg.data)));
          }
          break;

        case 'arrayBuffer':
          // if the server sends binary frames
          if (msg.data instanceof Blob) {
            msg.data.arrayBuffer().then((value) => innerSet(msg, value));
          } else if (msg.data instanceof ArrayBuffer) {
            innerSet(msg, msg.data);
          } else {
            onError(new FromWebSocketInvalidMessageError('arrayBuffer', getMessageType(msg.data)));
          }
          break;
        }
      }
      ws.onerror = onError;
      ws.onclose = function(event) {
        onClose?.(event);
        ws = null;

        if (event.code !== 1001 && event.code !== 1006 && event.wasClean) { return; }

        if (maxReconnectAttempts == null || reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimer = setTimeout(function() {
            reconnectTimer = undefined;
            connect(set)
          }, reconnectInterval);
        }
      }
    } catch (err: any) {
      onError(err);
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
