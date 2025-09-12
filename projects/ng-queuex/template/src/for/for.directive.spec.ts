import { Component, computed, Directive, DoCheck, Pipe, PipeTransform, PLATFORM_ID, provideZonelessChangeDetection, Signal, signal } from "@angular/core";
import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { completeIntegrationForTest, isTaskQueueEmpty, Priority, PriorityLevel, PriorityName, provideNgQueuexIntegration, whenIdle } from "@ng-queuex/core";
import { provideQueuexForOfDefaultPriority, QueuexForOf, trackByIndex, trackByItem } from "./for.directive";
import { By } from "@angular/platform-browser";
import { defineGlobalFlag, describePriorityLevel } from "../utils/test_utils";
import { QueuexIf } from "../if/if.directive";

interface TestEnvironmentOptions {
  defaultPriority?: PriorityName | 'undefined';
  serverPlatform?: boolean;
  zoneless?: boolean;
}

const defaultTestEnvConfig: Required<TestEnvironmentOptions> = {
  defaultPriority: 'undefined',
  serverPlatform: false,
  zoneless: false,
}

class Foo {
  toString(): string {
    return 'foo';
  }
}

class Item {
  constructor(public id: any) {}
  copy(): Item { return new Item(this.id) }
  toString(): string {
    return `${this.id}`;
  }
  static createRange(ids: any[]): Item[] {
    return ids.map((id) => new Item(id));
  }
}

class Color {
  constructor(public id: any, public color: string) {}
  copy(color?: string): Color {
    if (typeof color === 'string') {
      return new Color(this.id, color);
    }
    return new Color(this.id, this.color);
  }
  toString(): string {
    return `(${this.id}|${this.color})`;
  }
}

@Component({
  selector: 'test-cmp',
  template: '',
  standalone: false
})
class TestComponent {
  value = signal<any>(undefined);
  items = signal<any[]>([1, 2]);
  priorityLevel: PriorityLevel = Priority.Normal;
  trackBy = 'item';
  equal: Function | null = null;
  renderCb: ((value: any) => void) | null = null;
}

@Directive({ selector: '[test-directive]', standalone: false })
class TestDirective implements DoCheck {

  checkCount = -1

  ngDoCheck(): void {
    this.checkCount++
  }
}

@Pipe({ name: 'isEven' , standalone: false })
class IsEvenPipe implements PipeTransform {
  transform(value: Signal<number>,) {
    return computed(() => value() % 2 === 0);
  }
}

const BASE_TEMPLATE = '<div><span *qxFor="let item of items; trackBy: trackBy">{{item().toString()}};</span></div>';
const TEMPLATE_WITH_PRIORITY = '<div><span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">{{item().toString()}};</span></div>';
const TEMPLATE_WITH_LIST =
  '<ul>' +
    '<li *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">' +
      '{{item()[\'name\']}};' +
    '</li>' +
  '</ul>';
const TEMPLATE_WITH_RENDER_CALLBACK = '<div><span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; renderCallback: renderCb">{{item().toString()}};</span></div>'

const Priorities: PriorityLevel[] = [1, 2, 3, 4, 5];

let fixture: ComponentFixture<TestComponent> = null!;

function setupTestEnvironment(config?: TestEnvironmentOptions): void {
  const localConfig = config ? {...defaultTestEnvConfig, ...config} : defaultTestEnvConfig;

  const providers: any[] = [provideNgQueuexIntegration()]

  if (localConfig.defaultPriority !== 'undefined') {
    providers.push(provideQueuexForOfDefaultPriority(localConfig.defaultPriority))
  }
  if (localConfig.zoneless) {
    providers.push(provideZonelessChangeDetection());
  }
  if (localConfig.serverPlatform) {
    providers.push({ provide: PLATFORM_ID, useValue: 'server' });
  }
  TestBed.configureTestingModule({
    imports: [QueuexForOf, QueuexIf],
    providers: providers,
    declarations: [TestComponent, TestDirective, IsEvenPipe]
  });
}

function resetTestEnvironment(): void {
  TestBed.resetTestingModule();
  fixture = null!;
}

function createTestComponent(template: string = BASE_TEMPLATE) {
  TestBed
    .overrideComponent(TestComponent, { set: { template }})
    .runInInjectionContext(() => completeIntegrationForTest());

  fixture = TestBed.createComponent(TestComponent);
}

function detectChanges(): void {
  fixture.detectChanges();
}
function whenStable(): Promise<any> {
  return fixture.whenStable();
}

function getComponent(): TestComponent {
  return fixture.componentInstance;
}
function query(predicate: string): HTMLElement {
  return fixture.debugElement.query(By.css(predicate)).nativeElement;
}
function queryAll(predicate: string): HTMLElement[] {
  return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.nativeElement);
}
function getTestDirective(predicate: string): TestDirective {
  return fixture.debugElement.query(By.css(predicate)).injector.get(TestDirective);
}
function getAllTestDirectives(predicate: string): TestDirective[] {
  return fixture.debugElement.queryAll(By.css(predicate)).map((debugEl) => debugEl.injector.get(TestDirective));
}
function getForOfDirective(predicate: string): QueuexForOf<unknown> {
  return fixture.debugElement.query(By.css(predicate)).injector.get(QueuexForOf);
}
function getTextContent(): string {
  return fixture.nativeElement.textContent;
}

describe('QueuexForOf directive.', () => {
  afterEach(() => resetTestEnvironment());

  it('Default priority should be normal!', async () => {
    setupTestEnvironment();
    createTestComponent();
    detectChanges();
    await whenIdle();
    //@ts-expect-error private member
    expect(getForOfDirective('span')._priorityRef.value).toBe(Priority.Normal);
  });

  Priorities.forEach((priorityLevel) => {
    describePriorityLevel(priorityLevel, () => {
      it('Should have default priority provided by injection', async () => {
        setupTestEnvironment({ defaultPriority: Priority[priorityLevel].toLowerCase() as any });
        createTestComponent();
        detectChanges()
        await whenIdle();
        //@ts-expect-error private member
        expect(getForOfDirective('span')._priorityRef.value).toBe(priorityLevel);
      });
    });
  });

  describe('Browser environment.', () => {
    beforeEach(() => setupTestEnvironment());

    Priorities.forEach((priorityLevel) => {
      describePriorityLevel(priorityLevel, () => {
        it('Should reflect initial elements lazily.', async () => {
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(getTextContent()).toBe('1;2;');
        });

        it('Should reflect added elements.', async () => {
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(getTextContent()).toBe('1;2;');
          getComponent().items.update((list) => [...list, 3])
          await whenIdle();
          expect(getTextContent()).toBe('1;2;3;');
        });

        it('Should reflect removed items.', async () => {
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(getTextContent()).toBe('1;2;');
          getComponent().items.set([1]);
          await whenIdle();
          expect(getTextContent()).toBe('1;');
        });

        it('Should reflect moved items.', async () => {
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          detectChanges();
          expect(getTextContent()).toBe('');
          await whenIdle();
          expect(getTextContent()).toBe('1;2;');
          getComponent().items.set([2, 1]);
          await whenIdle();
          expect(getTextContent()).toBe('2;1;');
        })

        it('Should reflect a mix of all changes (additions/removals/moves).', async () => {
          createTestComponent();
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2, 3, 4, 5]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0;1;2;3;4;5;');
          getComponent().items.set([6, 2, 7, 0, 4, 8]);
          await whenIdle();
          expect(getTextContent()).toBe('6;2;7;0;4;8;');
        });

        it('Should iterate over of array of objects.', async () => {
          createTestComponent(TEMPLATE_WITH_LIST);
          getComponent().items.set([ { name:'Dag' }, { name: 'Kruchol' }]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('Dag;Kruchol;')

          getComponent().items.update((it) => [...it, { name: 'Ajciu' }]);
          await whenIdle();
          expect(getTextContent()).toBe('Dag;Kruchol;Ajciu;');

          const items = getComponent().items().slice();
          items.splice(2, 1);
          items.splice(0, 1);
          getComponent().items.set(items);
          await whenIdle();
          expect(getTextContent()).toBe('Kruchol;')
        });

        it('Should gracefully handle nulls.', async () => {
          createTestComponent(TEMPLATE_WITH_LIST);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(null!);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('');
        });

        it('Should gracefully handle ref changing to null and back.', async () => {
          createTestComponent();
          getComponent().priorityLevel = priorityLevel;

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('1;2;');

          getComponent().items.set(null!);
          await whenIdle();
          expect(getTextContent()).toBe('');

          getComponent().items.set([1, 2, 3]);
          await whenIdle();
          expect(getTextContent()).toBe('1;2;3;');
        });
        if (priorityLevel === 1) {
          it('Should throw on non-iterable ref.', fakeAsync(() => {
            createTestComponent();
            getComponent().items.set('hellYeah' as any);
            detectChanges();
            expect(() => {
              flush(10)
            }).toThrowError(
              'Cannot find a differ supporting object \'hellYeah\' of type \'string\'!'
            );
          }));

          it('Should throw on ref changing to string', fakeAsync(() => {
            createTestComponent();
            detectChanges();
            flush(10);
            expect(getTextContent()).toBe('1;2;');

            getComponent().items.set('hellYeah' as any);
            expect(() => flush()).toThrowError(
              "Error trying to diff 'hellYeah' of type 'string'. Only arrays and iterables are allowed."
            );
          }));
        }

        it('Should work with duplicates.', async () => {
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          const a = new Foo();
          getComponent().items.set([a, a]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('foo;foo;')
        });

        it('Should repeat over nested arrays.', async () => {
          const template =
            '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">' +
              '<div *qxFor="let subitem of item(); trackBy: trackBy; priority: priorityLevel">' +
                '<span>{{subitem()}}-{{item()().length}};</span>' +
              '</div>|' +
            '</div>'
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set( [signal(['a']), signal(['b', 'c']) ])

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('a-1;|b-2;c-2;|');

          getComponent().items.set([ signal(['e', 'f']), signal(['g']) ]);
          await whenIdle();
          expect(getTextContent()).toBe('e-2;f-2;|g-1;|');
        });

        it('Should repeat over nested arrays with no intermediate element.', async () => {
          const template =
            '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">' +
              '<div *qxFor="let subitem of item(); trackBy: trackBy; priority: priorityLevel">' +
                '<span>{{subitem()}}-{{item()().length}};</span>' +
              '</div>' +
            '</div>'
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set( [signal(['a']), signal(['b', 'c']) ]);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('a-1;b-2;c-2;');

          getComponent().items.set([ signal(['e', 'f']), signal(['g']) ]);
          await whenIdle();
          expect(getTextContent()).toBe('e-2;f-2;g-1;');
        });

        it('Should repeat over nested qxIf that are the last node in the ngFor template.', async () => {
          const template =
            '<div *qxFor="let item of items; trackBy: trackBy; let i = index; priority: priorityLevel">' +
              '<div>{{i()}}|</div>'+
              '<div *qxIf="i | isEven; priority: priorityLevel">even|</div>' +
            '</div>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;

          getComponent().items.set([1]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0|even|')

          getComponent().items.set([1, 2]);
          await whenIdle();
          expect(getTextContent()).toBe('0|even|1|');

          getComponent().items.set([1, 2, 3]);
          await whenIdle();
          expect(getTextContent()).toBe('0|even|1|2|even|');
        });

        it('should allow of saving the collection', async () => {
          const template =
            '<ul>' +
              '<li *qxFor="let item of items as collection; trackBy: trackBy; priority: priorityLevel; index as i">'+
                '{{i()}}/{{collection().length}} - {{item()}};' +
              '</li>' +
            '</ul>';
          createTestComponent(template);
          detectChanges();

          await whenIdle()
          expect(getTextContent()).toBe('0/2 - 1;1/2 - 2;');

          getComponent().items.set([1, 2, 3]);
          await whenIdle();
          expect('0/3 - 1;0/3 - 2;0/3 - 3;');
        });


        it('Should display indices correctly.', async () => {
          // setupTestEnvironment({ serverPlatform: true })
          const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let i = index">{{i()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0123456789');

          getComponent().items.set([1, 2, 6, 7, 4, 3, 5, 8, 9, 0]);
          await whenIdle()
          expect(getTextContent()).toBe('0123456789');
        });

        it('Should display count correctly', async () => {
          const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let len = count">{{len()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('333');

          getComponent().items.set([4, 3, 2, 1, 0, -1]);
          await whenIdle()
          expect(getTextContent()).toBe('666666');
        });

        it('Should display fist item correctly.', async () => {
          const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isFirst = first">{{isFirst()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('truefalsefalse');

          getComponent().items.set([2, 1]);
          await whenIdle();
          expect(getTextContent()).toBe('truefalse');
        });

        it('Should display fist item correctly.', async () => {
          const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isLast = last">{{isLast()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('falsefalsetrue');

          getComponent().items.set([2, 1]);
          await whenIdle();
          expect(getTextContent()).toBe('falsetrue');
        });

        it('Should display even items correctly', async () => {
           const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isEven = even">{{isEven()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('truefalsetrue');

          getComponent().items.set([2, 1]);
          await whenIdle();
          expect(getTextContent()).toBe('truefalse');
        });

        it('Should display odd items correctly', async () => {
          const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isOdd = odd">{{isOdd()}}</span>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([0, 1, 2]);
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('falsetruefalse');

          getComponent().items.set([2, 1]);
          await whenIdle();
          expect(getTextContent()).toBe('falsetrue');
        });

        it('Should trigger local change detection in embedded view where consumed signal had change.', async () => {
          const template =
            '<span test-directive class="outer-test-dir"></span>' +
            '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let index = index">' +
              '<span test-directive class="inner-test-dir"></span>' +
              '<span>{{item()}}</span>' +
              '@if (index() == 1) { <span>{{value()}}</span> }' +
              '<span>;</span>' +
            '</div>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([1, 2, 3]);
          getComponent().value.set('A');

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('1;2A;3;');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getAllTestDirectives('span.inner-test-dir').map((d) => d.checkCount)).toEqual([0, 0, 0]);

          getComponent().value.set('B');
          await whenIdle();
          expect(getTextContent()).toBe('1;2B;3;');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getAllTestDirectives('span.inner-test-dir').map((d) => d.checkCount)).toEqual([0, 1, 0]);

          getComponent().value.set('C');
          await whenIdle();
          expect(getTextContent()).toBe('1;2C;3;');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getAllTestDirectives('span.inner-test-dir').map((d) => d.checkCount)).toEqual([0, 2, 0]);
        });

        it('Should not trigger local change detection for new set of the same data.', async () => {
          const template =
            '<span test-directive class="outer-test-dir"></span>' +
            '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let index = index">' +
              '<span test-directive class="inner-test-dir"></span>' +
              '<span>{{item()}};</span>' +
            '</div>';
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set([1, 2, 3]);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('1;2;3;');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getAllTestDirectives('span.inner-test-dir').map((d) => d.checkCount)).toEqual([0, 0, 0]);

          getComponent().items.set([1, 2, 3]);
          await whenIdle();
          expect(getTextContent()).toBe('1;2;3;');
          expect(getTestDirective('span.outer-test-dir').checkCount).toBe(0);
          expect(getAllTestDirectives('span.inner-test-dir').map((d) => d.checkCount)).toEqual([0, 0, 0]);
        });

        it('Should not support mutable data by default', async () => {
          const data = [new Color('A', 'red'), new Color('B', 'orange'),  new Color('C', 'violet')];
          const template =
            '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">{{item()}};</span>'
          createTestComponent(template);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(data);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|orange);(C|violet);');

          data[1].color = 'green';
          data.push(new Color('D', 'blue'));
          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|orange);(C|violet);');
        });
      });
    });


    describe('TrackBy input.', () => {
      it('Should track by item if trackBy is set to \'item\'', async () => {
        createTestComponent();
        getComponent().trackBy = 'item';
        detectChanges();
        await whenIdle();
        const qxForOf = getForOfDirective('span');
        //@ts-expect-error private member
        expect(qxForOf._trackBy).toBe(trackByItem);
      });

      it('Should track by index if trackBy is set to \'index\'', async () => {
        createTestComponent();
        getComponent().trackBy = 'index';
        detectChanges();
        await whenIdle();
        const qxForOf = getForOfDirective('span');
        //@ts-expect-error private member
        expect(qxForOf._trackBy).toBe(trackByIndex);
      });

      it('Should throw an error if trackBy is set to string not prefixed with \'item.\'', async () => {
        createTestComponent();
        getComponent().trackBy = 'helloNuts';
        expect(() => detectChanges()).toThrowError(
          '[qxFor][trackBy]: Incorrect value provided to "trackBy" function! It only accepts \'index\', \'item\' ' +
          'or any value of type string prefixed with \'item.\' where it should be a path to property. For example ' +
          'if item is an instance of class Person { id: string, name: string } you should provide \'item.id\'.'
        );
        await whenIdle();
      });

      it('Should throw an error if trackBy will contain \'..\'', async () => {
        createTestComponent();
        getComponent().trackBy = 'item.prop1..prop2';
        expect(() => detectChanges()).toThrowError(
          '[qxFor][trackBy]: Provided value \'item.prop1..prop2\' is incorrect format of property patch because of \'..\'!'
        );
        await whenIdle();
      });

      it('Should throw an error if there is provided and one of items is null', fakeAsync(() => {
        createTestComponent();
        getComponent().trackBy = 'item.id'
        getComponent().items.set([ { id: 0 }, null, { id: 2 }]);
        detectChanges()
        expect(() => flush()).toThrowError(
          '[qxFor][trackBy]: Tracking by property path \'id\' is imposable for null or undefined!'
        )
      }));

      it('Should throw an error if there is provided and one of items is undefined', fakeAsync(() => {
        createTestComponent();
        getComponent().trackBy = 'item.id'
        getComponent().items.set([ { id: 0 }, undefined, { id: 2 }]);
        detectChanges()
        expect(() => flush()).toThrowError(
          '[qxFor][trackBy]: Tracking by property path \'id\' is imposable for null or undefined!'
        )
      }));

      it('Should throw an error if any property before last one in property path provided to trackBy is undefined!', fakeAsync(() => {
        createTestComponent();
        getComponent().trackBy = 'item.prop1.prop2';
        getComponent().items.set([ { prop1: undefined } ]);
        detectChanges();
        expect(() => flush()).toThrowError(
          '[qxFor][trackBy]: Invalid property path \'prop1.prop2\'! Property \'prop1\' is null or undefined.'
        );
      }));

      it('Should throw an error if any property before last one in property path provided to trackBy is null!', fakeAsync(() => {
        createTestComponent();
        getComponent().trackBy = 'item.prop1.prop2';
        getComponent().items.set([ { prop1: null } ]);
        detectChanges();
        expect(() => flush()).toThrowError(
          '[qxFor][trackBy]: Invalid property path \'prop1.prop2\'! Property \'prop1\' is null or undefined.'
        );
      }));

      it('Should console.warn if last property in property path provided to trackBy is undefined.', async () => {
        createTestComponent();
        getComponent().trackBy = 'item.prop1.prop2';
        getComponent().items.set([ { prop1: { prop2: undefined } } ]);
        detectChanges();
        await whenIdle();
        expect(true).toBeTrue()
      });

      it('Should console.warn if last property in property path provided to trackBy is null.', async () => {
        createTestComponent();
        getComponent().trackBy = 'item.prop1.prop2';
        getComponent().items.set([ { prop1: { prop2: null } } ]);
        detectChanges();
        await whenIdle();
        expect(true).toBeTrue();
      });

      Priorities.forEach((priorityLevel) => {
        it('Should not replace views for new set of primitive values if trackBy is set to \'index\'.', async () => {
          let list = [0, 1, 2, 3, 4];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(list);
          getComponent().trackBy = 'index';

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0;1;2;3;4;');

          queryAll('span').forEach((el) => el.classList.add('marker'));
          list = [5, 6, 7, 8, 9];
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('5;6;7;8;9;');
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([...Array(5)].map(() => true));
        });

        it('Should replace views for set of primitives values if trackBy is set to \'item\'.', async () => {
          let list = [0, 1, 2, 3, 4];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(list);
          getComponent().trackBy = 'item';

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0;1;2;3;4;');

          queryAll('span').forEach((el) => el.classList.add('marker'));
          list = [5, 6, 7, 8, 9]
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('5;6;7;8;9;');
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([...Array(5)].map(() => false));
        });

        it('Should not replace views if Should not replace views for new set of objects if trackBy is set to \'index\'.', async () => {
          let list = Item.createRange([0, 1, 2, 3, 4]);
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(list);
          getComponent().trackBy = 'item';

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0;1;2;3;4;');

          queryAll('span').forEach((el) => el.classList.add('marker'));
          list = Item.createRange([5, 6, 7, 8, 9]);
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('5;6;7;8;9;');
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([...Array(5)].map(() => false));
        });

        it('Should replace views for set of primitives values if trackBy is set to \'item\'.', async () => {
          let list = Item.createRange([0, 1, 2, 3, 4]);
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().items.set(list);
          getComponent().trackBy = 'item';

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('0;1;2;3;4;');

          queryAll('span').forEach((el) => el.classList.add('marker'));
          list = Item.createRange([5, 6, 7, 8, 9]);
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('5;6;7;8;9;');
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([...Array(5)].map(() => false));
        });

        it('Should detect value change in one of the embedded view along with data collection change.', async () => {
          const template =
            '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let index = index">' +
              '<span>{{item()}}</span>' +
              '@if (index() == 0) { <span>{{value()}}</span> }' +
              '<span>;</span>' +
            '</div>';
            createTestComponent(template);
            getComponent().priorityLevel = priorityLevel;
            getComponent().value.set('A');
            getComponent().items.set([1, 2, 3]);

            detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('1A;2;3;');

            getComponent().value.set('B');
            getComponent().items.set([1, 2, 3, 4]);
            await whenIdle();
            expect(getTextContent()).toBe('1B;2;3;4;');
        });

        it('Should replace view if structure will change in immutable way and trackBy is set to \'item\'.', async () => {
          let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item';
          getComponent().items.set(list);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);')
          queryAll('span').forEach((el) => el.classList.add('marker'));

          list = list.slice();
          list[1] = list[1].copy('yellow');
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|yellow);(C|blue);')
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([true, false, true]);
        });

        it('Should update view if structure will change in immutable way and if there is provided unique identifier to trackBy property.', async () => {
          let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item.id';
          getComponent().items.set(list);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);')
          queryAll('span').forEach((el) => el.classList.add('marker'));

          list = list.slice();
          list[1] = list[1].copy('yellow');
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|yellow);(C|blue);')
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([true, true, true]);
        });

        it('Should remove and create new view for updated structure in immutable way an if track by is set to \'item\'.', async () => {
          let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item';
          getComponent().items.set(list);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);')
          queryAll('span').forEach((el) => el.classList.add('marker'));

          list = list.slice();
          list.unshift(list.pop()!);
          list[0] = list[0].copy('purple');
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('(C|purple);(A|red);(B|green);')
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([false, true, true]);
        });

        it('Should not remove and create new view for updated structure in immutable way and if there is provided unique id to trackBy property.', async () => {
          let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item.id';
          getComponent().items.set(list);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);');
          queryAll('span').forEach((el) => el.classList.add('marker'));

          list = list.slice();
          list.unshift(list.pop()!);
          list[0] = list[0].copy('purple');
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('(C|purple);(A|red);(B|green);')
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([true, true, true]);
        });

        it('Should detect object identity changed.', async () => {
          let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
          createTestComponent(TEMPLATE_WITH_PRIORITY);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item.id';
          getComponent().items.set(list);

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);');
          queryAll('span').forEach((el) => el.classList.add('marker'));

          list = list.slice();
          list[1] = new Color('B', 'violet');
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('(A|red);(B|violet);(C|blue);');
          expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([true, true, true]);
        });
      });
    });

    describe('Render callback', () => {
      Priorities.forEach((priorityLevel) => {
        describePriorityLevel(priorityLevel, () => {

          it('Should not run render callback for new set of the same data.', async () => {
            let list = Item.createRange(['A', 'B', 'C']);
            let callCount = -1;
            createTestComponent(TEMPLATE_WITH_RENDER_CALLBACK);
            getComponent().priorityLevel = priorityLevel;
            getComponent().trackBy = 'item.id';
            getComponent().renderCb = () => callCount++;
            getComponent().items.set(list);

            detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('A;B;C;');
            expect(callCount).toBe(0);

            list = list.map((it) => it.copy());;
            getComponent().items.set(list);
            await whenIdle();
            expect(getTextContent()).toBe('A;B;C;');
            expect(callCount).toBe(0);
          });

          it('Should run render callback when view gets created', async () => {
            let list = Item.createRange(['A', 'B', 'C']);
            let callCount = -1;
            createTestComponent(TEMPLATE_WITH_RENDER_CALLBACK);
            getComponent().priorityLevel = priorityLevel;
            getComponent().trackBy = 'item.id';
            getComponent().items.set(list);
            getComponent().renderCb = (v) => {
              callCount++;
              expect(v).toBe(list);
            };

            detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('A;B;C;');
            expect(callCount).toBe(0);

            list = list.slice();
            list.splice(2, 0, new Item('D'));
            getComponent().items.set(list);
            await whenIdle();
            expect(getTextContent()).toBe('A;B;D;C;');
            expect(callCount).toBe(1);
          });

          it('Should run render callback when view gets removed', async () => {
            let list = Item.createRange(['A', 'B', 'C']);
            let callCount = -1;
            createTestComponent(TEMPLATE_WITH_RENDER_CALLBACK);
            getComponent().priorityLevel = priorityLevel;
            getComponent().trackBy = 'item.id';
            getComponent().items.set(list);
            getComponent().renderCb = (v) => {
              callCount++;
              expect(v).toBe(list);
            };

            detectChanges();
            await whenIdle();
            expect(getTextContent()).toBe('A;B;C;');
            expect(callCount).toBe(0);

            list = list.slice();
            list.splice(1, 1);
            getComponent().items.set(list);
            await whenIdle();
            expect(getTextContent()).toBe('A;C;');
            expect(callCount).toBe(1);
          });

        });

        it('Should run render callback when view gets moved', async () => {
          let list = Item.createRange(['A', 'B', 'C', 'D', 'E']);
          let callCount = -1;
          createTestComponent(TEMPLATE_WITH_RENDER_CALLBACK);
          getComponent().priorityLevel = priorityLevel;
          getComponent().trackBy = 'item.id';
          getComponent().items.set(list);
          getComponent().renderCb = (v) => {
            callCount++;
            expect(v).toBe(list);
          };

          detectChanges();
          await whenIdle();
          expect(getTextContent()).toBe('A;B;C;D;E;');
          expect(callCount).toBe(0);

          list = list.slice();
          list.splice(1, 0, list.splice(3, 1)[0]);
          getComponent().items.set(list);
          await whenIdle();
          expect(getTextContent()).toBe('A;D;B;C;E;');
          expect(callCount).toBe(1);
        });

      });
    });
  });

  describe('Server environment.', () => {
    beforeEach(() => setupTestEnvironment({ serverPlatform: true }));


    it('Should reflect initial elements.', () => {
        createTestComponent(TEMPLATE_WITH_PRIORITY);
        detectChanges();
        expect(getTextContent()).toBe('1;2;');
      });

    it('Should reflect added elements.', () => {
      createTestComponent(TEMPLATE_WITH_PRIORITY);
      detectChanges();
      expect(getTextContent()).toBe('1;2;');
      getComponent().items.update((list) => [...list, 3])
      detectChanges();
      expect(getTextContent()).toBe('1;2;3;');
    });

    it('Should reflect removed items.', () => {
      createTestComponent(TEMPLATE_WITH_PRIORITY);
      detectChanges();
      expect(getTextContent()).toBe('1;2;');
      getComponent().items.set([1]);
      detectChanges();
      expect(getTextContent()).toBe('1;');
    });

    it('Should reflect moved items.', async () => {
      createTestComponent(TEMPLATE_WITH_PRIORITY);
      detectChanges();
      expect(getTextContent()).toBe('1;2;');
      getComponent().items.set([2, 1]);
      detectChanges();
      expect(getTextContent()).toBe('2;1;');
    })

    it('Should reflect a mix of all changes (additions/removals/moves).', () => {
      createTestComponent();
      getComponent().priorityLevel;
      getComponent().items.set([0, 1, 2, 3, 4, 5]);
      detectChanges();
      expect(getTextContent()).toBe('0;1;2;3;4;5;');
      getComponent().items.set([6, 2, 7, 0, 4, 8]);
      detectChanges();
      expect(getTextContent()).toBe('6;2;7;0;4;8;');
    });

    it('Should iterate over of array of objects.', () => {
      createTestComponent(TEMPLATE_WITH_LIST);
      getComponent().items.set([ { name:'Dag' }, { name: 'Kruchol' }]);
      detectChanges();
      expect(getTextContent()).toBe('Dag;Kruchol;')

      getComponent().items.update((it) => [...it, { name: 'Ajciu' }]);
      detectChanges();
      expect(getTextContent()).toBe('Dag;Kruchol;Ajciu;');

      const items = getComponent().items().slice();
      items.splice(2, 1);
      items.splice(0, 1);
      getComponent().items.set(items);
      detectChanges();
      expect(getTextContent()).toBe('Kruchol;')
    });

    it('Should gracefully handle nulls.', () => {
      createTestComponent(TEMPLATE_WITH_LIST);
      getComponent().items.set(null!);
      detectChanges();
      expect(getTextContent()).toBe('');
    });

    it('Should gracefully handle ref changing to null and back.', () => {
      createTestComponent();

      detectChanges();
      expect(getTextContent()).toBe('1;2;');

      getComponent().items.set(null!);
      detectChanges();
      expect(getTextContent()).toBe('');

      getComponent().items.set([1, 2, 3]);
      detectChanges();
      expect(getTextContent()).toBe('1;2;3;');
    });

    it('Should throw on non-iterable ref.', () => {
      createTestComponent();
      getComponent().items.set('hellYeah' as any);
      expect(() => {
        detectChanges();
      }).toThrowError(
        'Cannot find a differ supporting object \'hellYeah\' of type \'string\'!'
      );
    });

    it('Should throw on ref changing to string', () => {
      createTestComponent();
      detectChanges();
      expect(getTextContent()).toBe('1;2;');

      getComponent().items.set('hellYeah' as any);
      expect(() => detectChanges()).toThrowError(
        "Error trying to diff 'hellYeah' of type 'string'. Only arrays and iterables are allowed."
      );
    });

    it('Should work with duplicates.', () => {
      createTestComponent();
      const a = new Foo();
      getComponent().items.set([a, a]);
      detectChanges();
      expect(getTextContent()).toBe('foo;foo;')
    });

    it('Should repeat over nested arrays.', () => {
      const template =
        '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">' +
          '<div *qxFor="let subitem of item(); trackBy: trackBy; priority: priorityLevel">' +
            '<span>{{subitem()}}-{{item()().length}};</span>' +
          '</div>|' +
        '</div>'
      createTestComponent(template);
      getComponent().items.set( [signal(['a']), signal(['b', 'c']) ])

      detectChanges();
      expect(getTextContent()).toBe('a-1;|b-2;c-2;|');

      getComponent().items.set([ signal(['e', 'f']), signal(['g']) ]);
      detectChanges();
      expect(getTextContent()).toBe('e-2;f-2;|g-1;|');
    });

    it('Should repeat over nested arrays with no intermediate element.', () => {
      const template =
        '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel">' +
          '<div *qxFor="let subitem of item(); trackBy: trackBy; priority: priorityLevel">' +
            '<span>{{subitem()}}-{{item()().length}};</span>' +
          '</div>' +
        '</div>'
      createTestComponent(template);
      getComponent().items.set( [signal(['a']), signal(['b', 'c']) ]);

      detectChanges();
      expect(getTextContent()).toBe('a-1;b-2;c-2;');

      getComponent().items.set([ signal(['e', 'f']), signal(['g']) ]);
      detectChanges();
      expect(getTextContent()).toBe('e-2;f-2;g-1;');
    });

    it('Should repeat over nested qxIf that are the last node in the ngFor template.', () => {
      const template =
        '<div *qxFor="let item of items; trackBy: trackBy; let i = index; priority: priorityLevel">' +
          '<div>{{i()}}|</div>'+
          '<div *qxIf="i | isEven; priority: priorityLevel">even|</div>' +
        '</div>';
      createTestComponent(template);

      getComponent().items.set([1]);
      detectChanges();
      expect(getTextContent()).toBe('0|even|')

      getComponent().items.set([1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('0|even|1|');

      getComponent().items.set([1, 2, 3]);
      detectChanges();
      expect(getTextContent()).toBe('0|even|1|2|even|');
    });

    it('should allow of saving the collection', () => {
      const template =
        '<ul>' +
          '<li *qxFor="let item of items as collection; trackBy: trackBy; priority: priorityLevel; index as i">'+
            '{{i()}}/{{collection().length}} - {{item()}};' +
          '</li>' +
        '</ul>';
      createTestComponent(template);
      detectChanges();

      expect(getTextContent()).toBe('0/2 - 1;1/2 - 2;');

      getComponent().items.set([1, 2, 3]);
      detectChanges();
      expect('0/3 - 1;0/3 - 2;0/3 - 3;');
    });


    it('Should display indices correctly.', () => {
      // setupTestEnvironment({ serverPlatform: true })
      const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let i = index">{{i()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      detectChanges();
      expect(getTextContent()).toBe('0123456789');

      getComponent().items.set([1, 2, 6, 7, 4, 3, 5, 8, 9, 0]);
      detectChanges();
      expect(getTextContent()).toBe('0123456789');
    });

    it('Should display count correctly', () => {
      const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let len = count">{{len()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('333');

      getComponent().items.set([4, 3, 2, 1, 0, -1]);
      detectChanges();
      expect(getTextContent()).toBe('666666');
    });

    it('Should display fist item correctly.', () => {
      const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isFirst = first">{{isFirst()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('truefalsefalse');

      getComponent().items.set([2, 1]);
      detectChanges();
      expect(getTextContent()).toBe('truefalse');
    });

    it('Should display fist item correctly.', () => {
      const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isLast = last">{{isLast()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('falsefalsetrue');

      getComponent().items.set([2, 1]);
      detectChanges();
      expect(getTextContent()).toBe('falsetrue');
    });

    it('Should display even items correctly', () => {
        const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isEven = even">{{isEven()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('truefalsetrue');

      getComponent().items.set([2, 1]);
      detectChanges();
      expect(getTextContent()).toBe('truefalse');
    });

    it('Should display odd items correctly', () => {
      const template = '<span *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let isOdd = odd">{{isOdd()}}</span>';
      createTestComponent(template);
      getComponent().items.set([0, 1, 2]);
      detectChanges();
      expect(getTextContent()).toBe('falsetruefalse');

      getComponent().items.set([2, 1]);
      detectChanges();
      expect(getTextContent()).toBe('falsetrue');
    });

    it('Should detect value change in one of the embedded view along with data collection change.', () => {
      const template =
        '<div *qxFor="let item of items; trackBy: trackBy; priority: priorityLevel; let index = index">' +
          '<span>{{item()}}</span>' +
          '@if (index() == 0) { <span>{{value()}}</span> }' +
          '<span>;</span>' +
        '</div>';
      createTestComponent(template);
      getComponent().value.set('A');
      getComponent().items.set([1, 2, 3]);

      detectChanges();
      expect(getTextContent()).toBe('1A;2;3;');

      getComponent().value.set('B');
      getComponent().items.set([1, 2, 3, 4]);
      detectChanges();
      expect(getTextContent()).toBe('1B;2;3;4;');
    });

    it('Should detect object identity changed.', () => {
      let list = [new Color('A', 'red'), new Color('B', 'green'), new Color('C', 'blue')];
      createTestComponent(TEMPLATE_WITH_PRIORITY);
      getComponent().trackBy = 'item.id';
      getComponent().items.set(list);

      detectChanges();
      expect(getTextContent()).toBe('(A|red);(B|green);(C|blue);');
      queryAll('span').forEach((el) => el.classList.add('marker'));

      list = list.slice();
      list[1] = new Color('B', 'violet');
      getComponent().items.set(list);
      detectChanges();
      expect(getTextContent()).toBe('(A|red);(B|violet);(C|blue);');
      expect(queryAll('span').map((el) => el.classList.contains('marker'))).toEqual([true, true, true]);
    });
  });
});
