import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

const bootstrap = (ctx: any) => bootstrapApplication(App, config, context);

export default bootstrap;
