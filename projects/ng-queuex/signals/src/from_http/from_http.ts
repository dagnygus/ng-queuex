import { assertInInjectionContext, inject, Injector, PendingTasks, Signal } from '@angular/core';
import { createContextAwareSignal } from '../context_aware_signal/context_aware_signal';
import { CleanupScope } from '../cleanup_scope/cleanup_scope';
import { NG_DEV_MODE, getDefaultOnErrorHandler } from '../common';


/**
 * Configuration options for {@link fromHttp}.
 * Defines how the HTTP request is performed and how its response is processed.
 */
export interface CreateFromHttpOptions {

  /**
   * HTTP method to use for the request (e.g. `'GET'`, `'POST'`).
   */
  method?: string;

  /**
   * Indicates whether to include cookies or authorization headers in cross-site requests.
   */
  credentials?: RequestCredentials;

  /**
   * Custom HTTP headers to include with the request.
   */
  headers?: Record<string, string>;

  /**
   * Request payload for methods like `POST` or `PUT`.
   */
  body?: object | null | undefined;

  /**
   * Query parameters to append to the request URL.
   */
  params?: Record<string, string | number | boolean>;

  /**
   * Expected response type; affects how the body is parsed (`'json'`, `'text'`, `'blob'`, `'arrayBuffer'`).
   * Default is `'json'`.
   */
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';

  /**
   * Fetch mode for controlling CORS and same-origin behavior.
   */
  mode?: RequestMode;

  /**
   * Determines what is emitted by the signal: only the parsed body or the full `Response` object.
   * Default is `'body'`
   */
  observe?: 'body' | 'response';

  /**
   * Request priority hint for the browser (if supported).
   */
  priority?: RequestPriority;

  /**
   * Redirect behavior (`'follow'`, `'error'`, `'manual'`).
   */
  redirect?: RequestRedirect;

  /**
   * Specifies the referrer URL to include with the request.
   */
  referrer?: string;

  /**
   * Controls how much referrer information should be included with the request.
   */
  referrerPolicy?: ReferrerPolicy;

  /**
   * Number of retry attempts when the request fails (network or server error).
   */
  retryOnError?: number;

  /**
   * An injector to be used when fromHttp() function is used outside injection context.
   */
  injector?: Injector;

  /**
   * Optional name for debugging or logging purposes.
   */
  debugName?: string;

  /**
   *  Callback invoked when an error occurs (network or parsing error).
   */
  onError?: (err: any) => void;
}

/**
 * Represents a structured HTTP response returned by {@link fromHttp}.
 *
 * Mirrors the essential properties of the native `Response` object,
 * but normalized for easier integration within reactive signals.
 */
export interface FromHttpResponse {

  /**
   * Response headers as a key-value record.
   */
  headers: Record<string, string>;

  /**
   * Parsed response body, depending on the requested `responseType`
   */
  body: any

  /**
   * Type of the response as defined by the Fetch API.
   * (`'basic'`, `'cors'`, `'default'`, `'error'`, `'opaque'`, `'opaqueredirect'`).
   */
  type: ResponseType

  /**
   *  Numeric HTTP status code of the response (e.g. `200`, `404`).
   */
  status: number;

  /**
   * Textual status message associated with the status code.
   */
  statusText: string;

  /**
   * Indicates whether the response was the result of a redirect.
   */
  redirected: boolean;

  /**
   *
   */
  url: string
}

/**
 * Represents an HTTP error response produced by {@link fromHttp}.
 *
 * This error is thrown only when the server responds with
 * a non-successful HTTP status code (≥ 400).
 *
 * Unlike network or transport errors (e.g. `TypeError`, `DOMException`),
 * this indicates that the request was completed and a response
 * was received, but the response itself represents a failure.
 */
export class FromHttpResponseError extends Error {
  constructor(
    response: Response
  ) {
    super(`fromHttp('${response.url}') response error with code ${response.status}: ${response.statusText}.`);
  }
}

/**
 * Creates a signal that performs an HTTP GRT request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @returns A `Signal<T | undefined>` representing the body of current state of the HTTP response.
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp<T>(url: string | URL): Signal<T>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<T | undefined>` representing the body of current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp<T>(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'json';
    mode?: RequestMode;
    observe?: 'body';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<T | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<(FromHttpResponse & { body: T })  | undefined>` representing the current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 * @see {@link FromHttpResponse}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp<T>(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'json';
    mode?: RequestMode;
    observe?: 'response';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<(FromHttpResponse & { body: T }) | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<string | undefined>` representing the body of current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'text';
    mode?: RequestMode;
    observe?: 'body';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<string | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<(FromHttpResponse & { body: string })  | undefined>` representing the current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 * @see {@link FromHttpResponse}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'text';
    mode?: RequestMode;
    observe?: 'response';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<(FromHttpResponse & { body: string }) | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<Blob | undefined>` representing the body of current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'blob';
    mode?: RequestMode;
    observe?: 'body';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<Blob | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<(FromHttpResponse & { body: Blob })  | undefined>` representing the current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 * @see {@link FromHttpResponse}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'blob';
    mode?: RequestMode;
    observe?: 'response';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<(FromHttpResponse & { body: Blob }) | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<ArrayBuffer | undefined>` representing the body of current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'arrayBuffer';
    mode?: RequestMode;
    observe?: 'body';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<ArrayBuffer | undefined>;
/**
 * Creates a signal that performs an HTTP request using the Fetch API
 * and emits its result as a reactive value.
 *
 * The request is **lazy** — it is dispatched only when the signal is first read
 * within a reactive context (e.g. inside `effect()` or a component template).
 *
 * - If the request resolves successfully, the response is **captured once** and
 *   remains stable for the lifetime of the signal.
 * - If all reactive consumers are destroyed **before** the request completes,
 *   the pending request is **canceled** (via `AbortController`).
 * - When new consumers appear later, a **new request** will be issued.
 * - The signal emits `undefined` while awaiting the response.
 * - Supports automatic retries (`retryOnError`) and error handling via `onError`.
 *
 * @param url - The target URL of the HTTP request.
 * @param options - Optional configuration that defines the request method, headers,
 *   body, response handling, and retry behavior. See {@link CreateFromHttpOptions}.
 * @returns A `Signal<(FromHttpResponse & { body: ArrayBuffer })  | undefined>` representing the current state of the HTTP response.
 *
 * @see {@link CreateFromHttpOptions}
 * @see {@link FromHttpResponse}
 *
 * @example
 * ```ts
 * // Basic GET request
 * const userData = fromHttp('/api/user');
 *
 * effect(() => {
 *   console.log(userData()); // undefined → { id: 1, name: 'Alice' }
 * });
 *
 * // POST request with JSON body
 * const createUser = fromHttp('/api/user', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   headers: { 'Content-Type': 'application/json' },
 * });
 *
 * // Observing full response metadata
 * const response = fromHttp('/api/data', { observe: 'response' });
 * effect(() => {
 *   const r = response();
 *   if (r) console.log(r.status, r.headers, r.body);
 * });
 * ```
 */
export function fromHttp(
  url: string | URL,
  options: {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: object | null | undefined;
    params?: Record<string, string | number | boolean>;
    responseType?: 'arrayBuffer';
    mode?: RequestMode;
    observe?: 'response';
    priority?: RequestPriority;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    retryOnError?: number;
    injector?: Injector;
    debugName?: string;
    onError?: (err: any) => void;
  }
): Signal<(FromHttpResponse & { body: ArrayBuffer }) | undefined>;
export function fromHttp(url: string | URL, options?: CreateFromHttpOptions): Signal<any> {

  NG_DEV_MODE && !CleanupScope.current() && !options?.injector && assertInInjectionContext(fromHttp);

  const injector = CleanupScope.current()?.injector ?? options?.injector ?? inject(Injector);
  const pendingTasks = injector.get(PendingTasks);
  const method = options?.method ?? 'GET'
  const credentials = options?.credentials;
  const headers = options?.headers ? { ...options.headers } : undefined;
  const body = options?.body ? { ...options.body } : undefined
  const params = options?.params ? { ...options.params } : undefined;
  const responseType = options?.responseType ?? 'json';
  const mode = options?.mode;
  const priority = options?.priority;
  const redirect = options?.redirect;
  const referrer = options?.referrer;
  const referrerPolicy = options?.referrerPolicy;
  const observe = options?.observe ?? 'body';
  const debugName = options?.debugName;
  const onError = getDefaultOnErrorHandler(options?.onError);
  let retriesLeft = options?.retryOnError ?? 0;
  let abortController: AbortController | null = new AbortController();

  function buildUrl(): URL {
    const u = new URL(url.toString());
    if (params) {
      for (const key in params) {
        u.searchParams.set(key, String(params[key]))
      }
    }
    return u;
  }

  async function fetchData(set: (arg: any) => void): Promise<void> {
    let lastError: any;
    const pendingTask = pendingTasks.add();
    while (true) {
      try {
        const response = await fetch(buildUrl(), {
          method,
          credentials,
          headers,
          body: JSON.stringify(body),
          mode,
          priority,
          redirect,
          referrer,
          referrerPolicy,
          signal: abortController!.signal,
        });

        if (response.status >= 400) {
          throw new FromHttpResponseError(response);
        }

        let data: any;

        switch (responseType) {
          case 'json':
            if (response.body) {
              data = await response.json();
            } else {
              data = null;
            }
            break;
          case 'text':
            data = await response.text();
            break;
          case 'blob':
            data = await response.blob();
            break;
          case 'arrayBuffer':
            data = await response.arrayBuffer();
            break;
        }

        abortController = null;

        if (observe === 'body') {
          set(data)
        } else {
          const resHeaders: Record<string, string> = {}
          for (const [key, value] of response.headers) {
            resHeaders[key] = value;
          }

          const responseData: FromHttpResponse = {
            headers: resHeaders,
            body: data,
            status: response.status,
            statusText: response.statusText,
            redirected: response.redirected,
            type: response.type,
            url: response.url
          }

          set(responseData);
        }

        break;

      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          break;
        }
        if (err instanceof SyntaxError) {
          retriesLeft = 0;
        }
        lastError = err;

        if (--retriesLeft > 0) {
          continue;
        }

        onError(lastError);
        break;

      }
    }
    pendingTask();
  }

  return createContextAwareSignal(
    undefined,
    function (set) {
      if (abortController) {
        fetchData(set);
      }
    },
    function () {
      if (abortController) {
        abortController.abort();
        abortController = new AbortController();
      }
    },
    fromHttp,
    debugName
  );
}
