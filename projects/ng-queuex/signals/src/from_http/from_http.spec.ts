import { DestroyableInjector, DestroyRef, Injector, PendingTasks, runInInjectionContext, ɵglobal } from '@angular/core';
import { fromHttp, FromHttpResponse } from './from_http';
import { subscribe } from '../subscribe/subscribe';
import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { createTestCleanupScope } from '../signals';

const originalFetch = ɵglobal.fetch;

interface ResponseDefaults {
  body: {} | null;
  headers: Headers;
  ok: boolean;
  redirected: boolean;
  status: number;
  statusText: string;
  type: ResponseType;
  url: string;
}

const TEST_URL = 'https://api.test/data'

const defaultResponse: ResponseDefaults = {
  body: {},
  headers: new Headers(),
  ok: true,
  redirected: false,
  status: 200,
  statusText: 'OK',
  type: 'default',
  url: TEST_URL
}

function isFromHttpResponse(target: any): target is FromHttpResponse {
  return target != null &&
    typeof target === 'object' &&
    typeof target.headers === 'object' &&
    Object.hasOwn(target, 'body') &&
    typeof target.type === 'string' &&
    typeof target.status === 'number' &&
    typeof target.statusText === 'string' &&
    typeof target.redirected === 'boolean' &&
    typeof target.url === 'string';
}

describe('Testing fromHttp() function.', () => {

  let injector: DestroyableInjector;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    ɵglobal.fetch = jasmine.createSpy('fetch');
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });
  afterEach(() => {
    ɵglobal.fetch = originalFetch;
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  });

  function getFetchSpy(): jasmine.Spy {
    return ɵglobal.fetch;
  }

  it('Should throw error if signal is created outside injection context.', () => {
    expect(() => fromHttp(TEST_URL)).toThrowError();
  });

  it('Should not throw error if injector is provided to options.', () => {
    expect(() => fromHttp(TEST_URL, { injector: TestBed.inject(Injector)  })).not.toThrowError();
  });

  it('Should not throw error if signal is created in cleanup scope.', () => {
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    expect(() => {
      scope.run(() => fromHttp(TEST_URL))
    }).not.toThrowError();
  })

  it('Should abort request before resolve when last reactive consumer is destroyed', () => {
    TestBed.runInInjectionContext(() => {
      const log: string[] = [];

      getFetchSpy().and.callFake((_url, { signal }) => {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', function() {
            log.push('A')
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
      });

      const source = fromHttp<null>(TEST_URL);
      const unsubscribe = subscribe(source, () => {}, destroyRef);
      unsubscribe();
      expect(log).toEqual(['A'])
    });
  });

  it('Should register angular\'s pending task and unregister when fetch resolves.', (done) => {
    const log: string[] = [];
    const fakePendingTasks = {
      add() {
        log.push('A');
        return function() {
          log.push('B');
        }
      }
    }

    const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: fakePendingTasks }] });

    runInInjectionContext(injector, () => {
       getFetchSpy().and.resolveTo({
        ...defaultResponse,
        body: null
      });

      const source = fromHttp<null>(TEST_URL);
      subscribe(source, () => {
        queueMicrotask(() => {
          expect(log).toEqual([ 'A', 'B' ])
          injector.destroy();
          done();
        })
      });
    })
  });

  it('Should register angular\'s pending task and unregister when request is aborted.', (done) => {
    const log: string[] = [];
    const fakePendingTasks = {
      add() {
        log.push('A');
        return function() {
          log.push('B');
        }
      }
    }

    const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: fakePendingTasks }] });

    runInInjectionContext(injector, () => {
      getFetchSpy().and.callFake((_url, { signal }) => {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', function() {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
      });

      const source = fromHttp<null>(TEST_URL);
      const unsubscribe = subscribe(source, () => {}, destroyRef);
      unsubscribe();
      queueMicrotask(() => {
        expect(log).toEqual([ 'A', 'B' ]);
        done();
      })
    })
  })

  it('Should resolve signal with null value when fetch succeeds with no content', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        body: null
      });

      const source = fromHttp<null>(TEST_URL);
      subscribe(source, (value) => {
        expect(value).toBe(null)
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal when fetch succeeds', (done) => {
    TestBed.runInInjectionContext(() => {
      const data = { foo: 'bar' };

      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        json: () => Promise.resolve(data)

      });

      const source = fromHttp<{ foo: string }>(TEST_URL);
      subscribe(source, (value) => {
        expect(value).toBe(data);
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal when fetch succeeds and { observe: \'body\' } was provided to options.', (done) => {
    TestBed.runInInjectionContext(() => {
      const data = { foo: 'bar' };

      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        json: () => Promise.resolve(data)

      });

      const source = fromHttp<{ foo: string }>(TEST_URL, { observe: 'body' });
      subscribe(source, (value) => {
        expect(value).toBe(data);
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with response object when fetch succeeds and { observe: \'response\' } was provided to options.', (done) => {
    TestBed.runInInjectionContext(() => {
      const data = { foo: 'bar' };

      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        json: () => Promise.resolve(data)
      });

      const source = fromHttp<{ foo: string }>(TEST_URL, { observe: 'response'});
      subscribe(source, (value) => {
        expect(isFromHttpResponse(value)).toBeTrue();
        expect(value.body).toBe(data);
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with value of type string when fetch succeeds and { responseType: \'text\' } was provided to options.', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        text: () => Promise.resolve('Hello')
      });

      const source = fromHttp(TEST_URL, { responseType: 'text' });
      subscribe(source, (value) => {
        expect(typeof value).toBe('string');
        expect(value).toBe('Hello');
        done();
      }, destroyRef);
    });
  });

   it('Should resolve signal with value of type string when fetch succeeds and { responseType: \'text\', observe: \'body\' } was provided to options.', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        text: () => Promise.resolve('Hello')
      });

      const source = fromHttp(TEST_URL, { responseType: 'text' });
      subscribe(source, (value) => {
        expect(typeof value).toBe('string');
        expect(value).toBe('Hello');
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with response object were body is of type string when fetch succeeds and { responseType: \'text\', observe: \'response\' } was provided to options.', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        text: () => Promise.resolve('Hello')
      });

      const source = fromHttp(TEST_URL, { responseType: 'text', observe: 'response' });
      subscribe(source, (value) => {
        expect(isFromHttpResponse(value)).toBeTrue();
        expect(typeof value.body).toBe('string');
        expect(value.body).toBe('Hello');
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with value being Blob instance when fetch succeeds and { responseType: \'blob\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const blob = new Blob()
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        blob: () => Promise.resolve(blob)
      });

      const source = fromHttp(TEST_URL, { responseType: 'blob' })
      subscribe(source, (value) => {
        expect(value instanceof Blob).toBeTrue();
        expect(value).toBe(blob);
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with value being Blob instance when fetch succeeds and { responseType: \'blob\', observe: \'body\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const blob = new Blob()
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        blob: () => Promise.resolve(blob)
      });

      const source = fromHttp(TEST_URL, { responseType: 'blob', observe: 'body' })
      subscribe(source, (value) => {
        expect(value instanceof Blob).toBeTrue();
        expect(value).toBe(blob);
        done();
      }, destroyRef);
    })
  });

  it('Should resolve signal with response object were body is Blob instance when fetch succeeds and { responseType: \'blob\', observe: \'response\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const blob = new Blob()
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        blob: () => Promise.resolve(blob)
      });

      const source = fromHttp(TEST_URL, { responseType: 'blob', observe: 'response' })
      subscribe(source, (value) => {
        expect(isFromHttpResponse(value)).toBeTrue();
        expect(value.body instanceof Blob).toBeTrue();
        expect(value.body).toBe(blob);
        done();
      }, destroyRef);
    });
  });

  it('Should resolve signal with value being ArrayBuffer instance when fetch succeeds and { responseType: \'arrayBuffer\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const buffer = new ArrayBuffer();
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        arrayBuffer: () => Promise.resolve(buffer)
      });

      const source = fromHttp(TEST_URL, { responseType: 'arrayBuffer' });
      subscribe(source, (value) => {
        expect(value instanceof ArrayBuffer);
        expect(value).toBe(buffer);
        done()
      }, destroyRef);
    });
  });

  it('Should resolve signal with value being ArrayBuffer instance when fetch succeeds and { responseType: \'arrayBuffer\', observe \'body\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const buffer = new ArrayBuffer();
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        arrayBuffer: () => Promise.resolve(buffer)
      });

      const source = fromHttp(TEST_URL, { responseType: 'arrayBuffer', observe: 'body' });
      subscribe(source, (value) => {
        expect(value instanceof ArrayBuffer);
        expect(value).toBe(buffer);
        done()
      }, destroyRef);
    });
  });

  it('Should resolve signal with response object were body is ArrayBuffer instance when fetch succeeds and { responseType: \'arrayBuffer\', observe \'response\' } was provided to option.', (done) => {
    TestBed.runInInjectionContext(() => {
      const buffer = new ArrayBuffer();
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        arrayBuffer: () => Promise.resolve(buffer)
      });

      const source = fromHttp(TEST_URL, { responseType: 'arrayBuffer', observe: 'response' });
      subscribe(source, (value) => {
        expect(isFromHttpResponse(value)).toBeTrue()
        expect(value.body instanceof ArrayBuffer);
        expect(value.body).toBe(buffer);
        done();
      }, destroyRef);
    });
  });

  it('Should log error in console on non-ok response.', fakeAsync(() => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        ok: false,
        status: 500,
        statusText: 'Internal server error'
      });

      const source = fromHttp(TEST_URL);
      subscribe(source, () => {}, destroyRef);
      flush();
      expect(true).toBeTrue();
    });
  }));

  it('Should handel fetch rejection if onError is provided to options', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        ok: false,
        status: 500,
        statusText: 'Internal server error'
      });

      const source = fromHttp(TEST_URL, {
        onError: (err) => {
          expect(err.message).toBe(`fromHttp('${TEST_URL}') response error with code 500: Internal server error.`)
          done();
        }
      });
      subscribe(source, () => {}, destroyRef);
    });
  });

  it('Should retry on error if is provided in options', (done) => {
    TestBed.runInInjectionContext(() => {
      getFetchSpy().and.returnValues(
        Promise.resolve({ ...defaultResponse, ok: false, status: 400, statusText: 'Bad Request' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 401, statusText: 'Unauthorized' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 402, statusText: 'Payment Required' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 403, statusText: 'Forbidden' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 404, statusText: 'Not Found' }),
      )

      const source = fromHttp(TEST_URL, {
        retryOnError: 5,
        onError: (err) => {
          expect(err.message).toBe(`fromHttp('${TEST_URL}') response error with code 404: Not Found.`)
          done();
        }
      });
      subscribe(source, () => {}, destroyRef);
    });
  });

  it('Should not retry on error if is provided in options and syntax error will be thrown', (done) => {
    TestBed.runInInjectionContext(() => {
      const error = new SyntaxError()
      getFetchSpy().and.returnValues(
        Promise.resolve({ ...defaultResponse, ok: true, status: 200, statusText: 'OK', json: () => { throw error; } }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 401, statusText: 'Unauthorized' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 402, statusText: 'Payment Required' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 403, statusText: 'Forbidden' }),
        Promise.resolve({ ...defaultResponse, ok: false, status: 404, statusText: 'Not Found' }),
      )

      const source = fromHttp(TEST_URL, {
        retryOnError: 5,
        onError: (err) => {
          expect(err).toBe(error)
          done();
        }
      });
      subscribe(source, () => {}, destroyRef);
    });
  });

  it('Should register angular\'s pending task and unregister when fetch rejects with error response.', (done) => {
    const log: string[] = [];
    const fakePendingTasks = {
      add() {
        log.push('A');
        return function() {
          log.push('B');
        }
      }
    }

    const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: fakePendingTasks }] });

    runInInjectionContext(injector, () => {
      getFetchSpy().and.resolveTo({
        ...defaultResponse,
        ok: false,
        status: 500,
        statusText: 'Internal server error'
      });

      const source = fromHttp(TEST_URL);
      subscribe(source, () => {});
      queueMicrotask(() => {
        expect(log).toEqual(['A', 'B'])
        injector.destroy();
        done()
      })
    })
  });

});
