import { DestroyableInjector, DestroyRef, Injector, ɵglobal } from '@angular/core';
import { fromWebSocket, FromWebSocketInvalidMessageError, FromWebSocketMessageEvent } from './from_websocket';
import { subscribe } from '../subscribe/subscribe';

const OriginalWebSocket = ɵglobal.WebSocket;

function isFromWebSocketMessageEvent<T>(target: any): target is FromWebSocketMessageEvent<T> {
  return (
    Object.hasOwn(target, 'data') &&
    typeof target.lastEventId === 'string' &&
    typeof target.origin === 'string' &&
    Array.isArray(target.ports) &&
    Object.hasOwn(target, 'source') &&
    (target.source === null || typeof target.source === 'object')
  );
}

const defaultMessageEvent: MessageEvent = {
  data: null,
  lastEventId: '1',
  origin: 'unknown origin',
  ports: [],
  source: null
} as any;

describe('Testing from websocket.', () => {
  let fakeWebSocket: FakeWebSocket = null!;
  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;

  class FakeWebSocket {
    url: string;
    readyState: number = WebSocket.CONNECTING;
    onopen?: Function;
    onmessage?: Function;
    onerror?: Function;
    onclose?: Function;

    constructor(url: string) {
      this.url = url;
      fakeWebSocket = this;
    }

    send(data: any) {}
    close() {
      this.readyState = WebSocket.CLOSED;
      this.onclose?.({ code: 1000, reason: 'closed manually' });
    }


    simulateOpen() {
      this.readyState = WebSocket.OPEN;
      this.onopen?.({});
    }
    simulateMessage(data: any) {
      this.onmessage?.({ ...defaultMessageEvent, data });
    }
    simulateError(err: any) {
      this.onerror?.(err);
    }
    simulateClose(code = 1000) {
      this.readyState = WebSocket.CLOSED;
      this.onclose?.({ code });
    }
  }

  beforeEach(() => {
    ɵglobal.WebSocket = FakeWebSocket;
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    ɵglobal.WebSocket = OriginalWebSocket;
    fakeWebSocket = null!;
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!
    destroyRef = null!

  });

  it('Should update signal with object for not specified expected message type.', () => {
    const log: { foo: string }[] = [];
    const source = fromWebSocket<{ foo: string }>('wss://test');
    subscribe(source, (value) => log.push(value), destroyRef)

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'bar' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'fiz' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'baz' }));

    expect(log).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with object for specified expected message type \'json\'.', () => {
    const log: { foo: string }[] = [];
    const source = fromWebSocket<{ foo: string }>('wss://test', { messageType: 'json' });
    subscribe(source, (value) => log.push(value), destroyRef)

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'bar' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'fiz' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'baz' }));

    expect(log).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with object for specified expected message type \'text\'.', () => {
    const log: string[] = [];
    const source = fromWebSocket('wss://test', { messageType: 'text' });
    subscribe(source, (value) => log.push(value), destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage('A');
    fakeWebSocket.simulateMessage('B');
    fakeWebSocket.simulateMessage('C');

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should update signal with blob instance for specified expected message type \'blob\'.', () => {
    const log: Blob[] = [];
    const source = fromWebSocket('wss://test', { messageType: 'blob' });
    subscribe(source, (value) => log.push(value), destroyRef);
    const blob1 = new Blob();
    const blob2 = new Blob();
    const blob3 = new Blob();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(blob1);
    fakeWebSocket.simulateMessage(blob2);
    fakeWebSocket.simulateMessage(blob3);

    expect(log).toEqual([ blob1, blob2, blob3]);
  });

  it('Should update signal with array buffer instance for specified expected message type \'arrayBuffer\'.', () => {
    const log: ArrayBuffer[] = [];
    const source = fromWebSocket('wss://test', { messageType: 'arrayBuffer' });
    subscribe(source, (value) => log.push(value), destroyRef);
    const arr1 = new ArrayBuffer();
    const arr2 = new ArrayBuffer();
    const arr3 = new ArrayBuffer();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(arr1)
    fakeWebSocket.simulateMessage(arr2)
    fakeWebSocket.simulateMessage(arr3);

    expect(log).toEqual([ arr1, arr2, arr3 ]);
  });

  it('Should update signal with array buffer instance even if blob was received.', (done) => {
    const log: ArrayBuffer[] = []
    const source = fromWebSocket('wss://test',
      { messageType: 'arrayBuffer',
        onMessage: () => {
          expect(log.length).toBe(1);
          expect(log[0] instanceof ArrayBuffer).toBeTrue();
          done();
        }
      });
    subscribe(source, (value) => log.push(value), destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(new Blob);
  });

  it('Should update signal with message event object with data of type object when { observe: \'event\' } is provided to options.', () => {
    const log: FromWebSocketMessageEvent<{ foo: string }>[] = [];
    const source = fromWebSocket<{ foo: string }>('wss://test', { observe: 'event' });
    subscribe(source, (value) => log.push(value), destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'bar' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'fiz' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'baz' }));

    for (const l of log) {
      expect(isFromWebSocketMessageEvent(l));
    }
    expect(log.map((l) => l.data)).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with message event object with data of type object when { observe: \'event\', messageType: \'json\' } is provided to options.', () => {
    const log: FromWebSocketMessageEvent<{ foo: string }>[] = [];
    const source = fromWebSocket<{ foo: string }>('wss://test', { observe: 'event', messageType: 'json' });
    subscribe(source, (value) => log.push(value), destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'bar' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'fiz' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'baz' }));

    for (const l of log) {
      expect(isFromWebSocketMessageEvent(l));
    }

    expect(log.map((l) => l.data)).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should update signal with message event object with data of type string when { observe: \'event\', messageType: \'text\' } is provided to options.', () => {
    const log: FromWebSocketMessageEvent<string>[] = [];
    const source = fromWebSocket('wss://test', { observe: 'event', messageType: 'text' });
    subscribe(source, (value) => log.push(value), destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage('A');
    fakeWebSocket.simulateMessage('B');
    fakeWebSocket.simulateMessage('C');

    for (const l of log) {
      expect(isFromWebSocketMessageEvent(l));
    }
    expect(log.map((l) => l.data)).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should update signal with message event object with data being blob instance when { observe: \'event\', messageType: \'blob\' } is provided to options.', () => {
    const log: FromWebSocketMessageEvent<Blob>[] = [];
    const source = fromWebSocket('wss://test', { observe: 'event', messageType: 'blob' });
    subscribe(source, (value) => log.push(value), destroyRef);

    const blob1 = new Blob();
    const blob2 = new Blob();
    const blob3 = new Blob();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(blob1);
    fakeWebSocket.simulateMessage(blob2);
    fakeWebSocket.simulateMessage(blob3);

    for (const l of log) {
      expect(isFromWebSocketMessageEvent(l));
    }
    expect(log.map((l) => l.data)).toEqual([ blob1, blob2, blob3 ]);
  });

  it('Should update signal with message event object with data being array buffer instance when { observe: \'event\', messageType: \'arrayBuffer\' } is provided to options.', () => {
    const log: FromWebSocketMessageEvent<ArrayBuffer>[] = []
    const source = fromWebSocket('wss://test', { observe: 'event', messageType: 'arrayBuffer' });
    subscribe(source, (value) => log.push(value), destroyRef);

    const arr1 = new ArrayBuffer();
    const arr2 = new ArrayBuffer();
    const arr3 = new ArrayBuffer();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(arr1);
    fakeWebSocket.simulateMessage(arr2);
    fakeWebSocket.simulateMessage(arr3);

    for (const l of log) {
      expect(isFromWebSocketMessageEvent(l));
    }
    expect(log.map((l) => l.data)).toEqual([ arr1, arr2, arr3 ]);
  });

  it('Should update signal with message event object with data being array buffer instance when { observe: \'event\', messageType: \'arrayBuffer\' } is provided to options and blob was received.', (done) => {
    const log: FromWebSocketMessageEvent<ArrayBuffer>[] = []
    const source = fromWebSocket('wss://test', {
      observe: 'event',
      messageType: 'arrayBuffer',
      onMessage: () => {
        expect(isFromWebSocketMessageEvent(log[0])).toBeTrue();
        expect(log[0].data instanceof ArrayBuffer).toBeTrue();
        done();
      }
    });
    subscribe(source, (value) => log.push(value), destroyRef);
    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(new Blob());
  });

  it('Should handle onMessage with expected message type \'json\'.', () => {
    const log: { foo: string }[] = [];
    const source = fromWebSocket<{ foo: string }>('wss://test', {
      messageType: 'json',
      onMessage: (event) => {
        expect(isFromWebSocketMessageEvent(event)).toBeTrue();
        log.push(event.data)
      }
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'bar' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'fiz' }));
    fakeWebSocket.simulateMessage(JSON.stringify({ foo: 'baz' }));

    expect(log).toEqual([
      { foo: 'bar' },
      { foo: 'fiz' },
      { foo: 'baz' },
    ]);
  });

  it('Should handle onMessage with expected message type \'text\'.', () => {
    const log: string[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'text',
      onMessage: (event) => {
        expect(isFromWebSocketMessageEvent(event)).toBeTrue();
        log.push(event.data)
      }
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage('A');
    fakeWebSocket.simulateMessage('B');
    fakeWebSocket.simulateMessage('C');

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should handle onMessage with expected message type \'blob\'.', () => {
    const log: Blob[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'blob',
      onMessage: (event) => {
        expect(isFromWebSocketMessageEvent(event)).toBeTrue();
        log.push(event.data);
      }
    });
    subscribe(source, () => {}, destroyRef);

    const blob1 = new Blob();
    const blob2 = new Blob();
    const blob3 = new Blob();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(blob1);
    fakeWebSocket.simulateMessage(blob2);
    fakeWebSocket.simulateMessage(blob3);

    expect(log).toEqual([ blob1, blob2, blob3 ]);
  });

  it('Should handle onMessage with expected message type \'arrayBuffer\'.', () => {
    const log: ArrayBuffer[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'arrayBuffer',
      onMessage: (event) => {
        expect(isFromWebSocketMessageEvent(event)).toBeTrue();
        log.push(event.data);
      }
    });
    subscribe(source, () => {}, destroyRef);

    const arr1 = new ArrayBuffer();
    const arr2 = new ArrayBuffer();
    const arr3 = new ArrayBuffer();

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(arr1);
    fakeWebSocket.simulateMessage(arr2);
    fakeWebSocket.simulateMessage(arr3);

    expect(log).toEqual([ arr1, arr2, arr3 ]);
  });

  it('Should handle onMessage with expected message type \'arrayBuffer\' for received blob instance.', (done) => {
    const source = fromWebSocket('wss://test', {
      messageType: 'arrayBuffer',
      onMessage: (event) => {
        expect(isFromWebSocketMessageEvent(event)).toBeTrue();
        expect(event.data instanceof ArrayBuffer).toBeTrue();
        done();
      }
    });

    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(new Blob());
  })

  it('Should handle onError.', () => {
    const log: any[] = [];
    const source = fromWebSocket('wss://test', {
      onError: (err) => log.push(err)
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    const err1 = new Event('error');
    const err2 = new Event('error');
    const err3 = new Event('error');
    fakeWebSocket.simulateError(err1);
    fakeWebSocket.simulateError(err2);
    fakeWebSocket.simulateError(err3);

    expect(log).toEqual([ err1, err2, err3 ]);
  });

  it('Should handle onOpen.', () => {
    const log: any[] = [];
    const source = fromWebSocket('wss://test', {
      onOpen: (ws) => log.push(ws)
    });
    subscribe(source, () => {}, destroyRef);
    fakeWebSocket.simulateOpen();
    expect(log[0] instanceof WebSocket).toBeTrue();
  });

  it('Should emit error if received message type is not expected text type.', () => {
    const log: Error[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'text',
      onError: (err) => log.push(err as Error)
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(new Blob());
    fakeWebSocket.simulateMessage(new ArrayBuffer());

    for (const l of log) {
      expect(l instanceof FromWebSocketInvalidMessageError);
    }

    expect(log.map((l) => l.message)).toEqual([
      'Expected message type is \'text\', but received \'Blob\'',
      'Expected message type is \'text\', but received \'ArrayBuffer\'',
    ]);
  });

  it('Should emit error if received message type is not expected json type.', () => {
    const log: Error[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'json',
      onError: (err) => log.push(err as Error)
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage(new Blob());
    fakeWebSocket.simulateMessage(new ArrayBuffer());

    for (const l of log) {
      expect(l instanceof FromWebSocketInvalidMessageError);
    }

    expect(log.map((l) => l.message)).toEqual([
      'Expected message type is \'json\', but received \'Blob\'',
      'Expected message type is \'json\', but received \'ArrayBuffer\'',
    ]);
  });

  it('Should emit error if received message type is not expected blob type.', () => {
    const log: Error[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'blob',
      onError: (err) => log.push(err as Error)
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage('HELLO');
    fakeWebSocket.simulateMessage(new ArrayBuffer());

    for (const l of log) {
      expect(l instanceof FromWebSocketInvalidMessageError);
    }

    expect(log.map((l) => l.message)).toEqual([
      'Expected message type is \'blob\', but received \'string\'',
      'Expected message type is \'blob\', but received \'ArrayBuffer\'',
    ]);
  });

  it('Should emit error if received message type is not expected array buffer type.', () => {
    const log: Error[] = [];
    const source = fromWebSocket('wss://test', {
      messageType: 'arrayBuffer',
      onError: (err) => log.push(err as Error)
    });
    subscribe(source, () => {}, destroyRef);

    fakeWebSocket.simulateOpen();
    fakeWebSocket.simulateMessage('HELLO');

    for (const l of log) {
      expect(l instanceof FromWebSocketInvalidMessageError);
    }

    expect(log.map((l) => l.message)).toEqual([
      'Expected message type is \'arrayBuffer\', but received \'string\'',
    ]);
  });

});
