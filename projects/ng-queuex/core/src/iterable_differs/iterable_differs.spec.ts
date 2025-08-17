import { Injector, NgModule, TrackByFunction } from "@angular/core";
import { QueuexIterableDiffer, QueuexIterableDifferFactory, QueuexIterableDiffers } from "./iterable_differs";
import { TestBed } from "@angular/core/testing";

function getFactory(): any {
  return jasmine.createSpyObj('IterableDifferFactory', ['supports'])
}

describe('IterableDiffers', () => {
  let factory1: jasmine.SpyObj<QueuexIterableDifferFactory>;
  let factory2: jasmine.SpyObj<QueuexIterableDifferFactory>;
  let factory3: jasmine.SpyObj<QueuexIterableDifferFactory>;

  beforeEach(() => {
    factory1 = getFactory();
    factory2 = getFactory();
    factory3 = getFactory();
  });

  it('should throw when no suitable implementation found', () => {
     const differs = new QueuexIterableDiffers([]);
      expect(() => differs.find('some object')).toThrowError(
      'Cannot find a differ supporting object \'some object\' of type \'string\'!',
    );
  });

  it('should return the first suitable implementation', () => {
    factory1.supports.and.returnValue(false);
    factory2.supports.and.returnValue(true);
    factory3.supports.and.returnValue(true);

    // @ts-expect-error private member
    const differs = QueuexIterableDiffers._create([factory1, factory2, factory3]);
    expect(differs.find('some object')).toBe(factory2);
  });

  it('should copy over differs from the parent repo', () => {
    factory1.supports.and.returnValue(true);
    factory2.supports.and.returnValue(false);

    // @ts-expect-error private member
    const parent = QueuexIterableDiffers._create([factory1]);
    // @ts-expect-error private member
    const child = QueuexIterableDiffers._create([factory2], parent);

    // @ts-expect-error private member
    expect(child._factories).toEqual([factory2, factory1]);
  });

  describe('.extends', () => {
    it('Should extends di inherited differs', () => {
      const differs = new QueuexIterableDiffers([factory1]);
      const injector = Injector.create({ providers: [{ provide: QueuexIterableDiffers, useValue: differs }] });
      const childInjector = Injector.create({
        providers:[QueuexIterableDiffers.extend([factory2])],
        parent: injector
      });

      // @ts-expect-error factories is a private member
      expect(injector.get<QueuexIterableDiffers>(QueuexIterableDiffers)._factories).toEqual([factory1]);
      // @ts-expect-error factories is a private member
      expect(childInjector.get<QueuexIterableDiffers>(QueuexIterableDiffers)._factories).toEqual([factory2, factory1]);
    });

    it('should support .extend in root NgModule', () => {
      const DIFFER: QueuexIterableDiffer<any> = {} as any;
      const log: string[] = [];

      class MyIterableDifferFactory implements QueuexIterableDifferFactory {
        supports(object: any): boolean {
          log.push('supports', object);
          return true;
        }
        create<T>(trackByFn: TrackByFunction<T>): QueuexIterableDiffer<T> {
          log.push('create');
          return DIFFER;
        }
      }

      @NgModule({providers: [QueuexIterableDiffers.extend([new MyIterableDifferFactory])]})
      class MyModule {}

      TestBed.configureTestingModule({imports: [MyModule]});
      const differs = TestBed.inject(QueuexIterableDiffers);
      const differ = differs.find('value').create(null!);
      expect(differ).toBe(DIFFER);
      expect(log).toEqual(['supports', 'value', 'create']);
    })
  })
})
