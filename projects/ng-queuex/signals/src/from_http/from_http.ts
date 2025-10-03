import { Signal } from "@angular/core";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";



export interface CreateFromHttpOptions {
  method?: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
  body?: object | null | undefined;
  params?: Record<string, string | number | boolean>;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
  mode?: RequestMode;
  observe?: 'body' | 'response';
  priority?: RequestPriority;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  retryOnError?: number;
  debugName?: string;
  onError?: (err: any) => void;
}

export interface FromHttpResponse {
  headers: Record<string, string>;
  body: any
  type: ResponseType
  status: number;
  statusText: string;
  redirected: boolean;
  url: string
}

export class FromHttpResponseError extends Error {
  constructor(
    public status: number,
    public statusTest: string
  ) {
    super(`fromHttp() response error  ${status}: ${statusTest}.`);
  }
}

export function fromHttp<T>(url: string | URL): T;
export function fromHttp<T>(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'json' }) | undefined): Signal<T | undefined>;
export function fromHttp<T>(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'json', observe: 'response' }) | undefined): Signal<(FromHttpResponse & { body: T })  | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'text' }) | undefined): Signal<string | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'text', observe: 'response' }) | undefined): Signal<(FromHttpResponse & { body: string }) | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'blob' }) | undefined): Signal<Blob | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'blob', observe: 'response' }) | undefined): Signal<(FromHttpResponse & { body: Blob }) | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'arrayBuffer' }) | undefined): Signal<Uint8Array<ArrayBuffer> | undefined>;
export function fromHttp(url: string | URL, options: (CreateFromHttpOptions & { responseType: 'arrayBuffer', observe: 'response' }) | undefined): Signal<(FromHttpResponse & { body: Uint8Array<ArrayBuffer> }) | undefined>;
export function fromHttp(url: string | URL, options?: CreateFromHttpOptions): Signal<any> {
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
  const onError = options?.onError;
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

        abortController = null;

        if (response.status >= 400) {
          throw new FromHttpResponseError(response.status, response.statusText);
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
            data = response.blob();
            break;
          case 'arrayBuffer':
            data = await response.arrayBuffer();
            break;
        }

        if (observe === 'body') {
          set(data)
        } else {
          const resHeaders: Record<string, string> = {}
          for (const [key, value] of response.headers) {
            resHeaders[key] = value;
          }

          const responseData: FromHttpResponse = {
            headers: resHeaders,
            body,
            status: response.status,
            statusText: response.statusText,
            redirected: response.redirected,
            type: response.type,
            url: response.url
          }

          set(responseData);
        }

        return;

      } catch (err) {
        lastError = err;
        if (--retriesLeft > 0) {
          continue;
        }
        if (onError) {
          onError(lastError);
          return;
        }
        console.error('fromHttp() error:', lastError);
        return;
      }
    }
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
