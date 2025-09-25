import { isPlatformServer } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { scheduleTask } from '@ng-queuex/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('@ng-queuex. See the logs in console.');

  constructor() {

    if (isPlatformServer(inject(PLATFORM_ID))) { return; }

    scheduleTask(() => {
      const start = performance.now();
      while (true) {
        if (performance.now() - start > 10) { break; }
      }
      console.log('First concurrent task runs!');
    });
    scheduleTask(() => {
      const start = performance.now();
      while (true) {
        if (performance.now() - start > 10) { break; }
      }
      console.log('Second concurrent task runs!');
    });
    scheduleTask(() => {
      const start = performance.now();
      while (true) {
        if (performance.now() - start > 10) { break; }
      }
      console.log('Third concurrent task runs!');
    });
  }
}
