import { DestroyableInjector, DestroyRef, Injector, ɵglobal } from "@angular/core";
import { fromSse } from "./from_sse";
import { subscribe } from "../signals";

const OriginalEventSource = ɵglobal.EventSource;
const TEST_URL = 'https://api.test/data';
const INVALID_URL = 'invalid_url'


describe('Testing fromSse() function.', () => {
  let fakeEventSource: FakeEventSource = null!
  let injector: DestroyableInjector;
  let destroyRef: DestroyRef;

  class FakeEventSource {
  url: string;
  readyState = 0;
  onmessage?: (ev: MessageEvent) => void;
  onerror?: (ev: Event) => void;
  onopen?: () => void;

  constructor(url: string) {
    if (url === INVALID_URL) {
      throw new TypeError('Failed to construct \'EventSource\': Invalid URL');
    }
    this.url = url;
    fakeEventSource = this;
  }

  emitMessage(data: any) {
    this.onmessage?.({ data } as MessageEvent);
  }

  emitError(error: any) {
    this.onerror?.(error as Event);
  }

  emitOpen() {
    this.onopen?.();
  }

  close() {
    this.readyState = 2;
  }
}


  beforeEach(() => {
    ɵglobal.EventSource = FakeEventSource;
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    ɵglobal.EventSource = OriginalEventSource;
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
    fakeEventSource = null!;
  });

  it('Should update signal with object type when message is received and options was not provided.', () => {
    const log: { foo: string }[] = [];
    const source = fromSse<{ foo: string }>(TEST_URL);

    subscribe(source, (value) => log.push(value), destroyRef);

    fakeEventSource.emitMessage(JSON.stringify({ foo: 'bar' }));
    fakeEventSource.emitMessage(JSON.stringify({ foo: 'fiz' }));
    fakeEventSource.emitMessage(JSON.stringify({ foo: 'baz' }));

    expect(log).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with object type when message is received and { responseType: \'json\' } was provided to options', () => {
    const log: { foo: string }[] = [];
    const source = fromSse<{ foo: string }>(TEST_URL, { responseType: 'json' });

    subscribe(source, (value) => log.push(value), destroyRef);

    fakeEventSource.emitMessage(JSON.stringify({ foo: 'bar' }));
    fakeEventSource.emitMessage(JSON.stringify({ foo: 'fiz' }));
    fakeEventSource.emitMessage(JSON.stringify({ foo: 'baz' }));

    expect(log).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with raw text when message is received and { responseType: \'text\' } was provided to options', () => {
    const log: string[] = [];
    const source = fromSse(TEST_URL, { responseType: 'text' });

    subscribe(source, (value) => log.push(value), destroyRef);

    fakeEventSource.emitMessage('A');
    fakeEventSource.emitMessage('B');
    fakeEventSource.emitMessage('C');

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should handle error if onError is provided to options', () => {
    const log: any[] = [];
    const source = fromSse(TEST_URL, { onError: (err) => log.push(err) });
    subscribe(source, () => {}, destroyRef);

    const error = new Error();
    fakeEventSource.emitError(error);
    expect(log[0]).toBe(error);
  });

});
