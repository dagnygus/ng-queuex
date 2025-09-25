import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

const bootstrap = (ctx: BootstrapContext | undefined) => bootstrapApplication(App, config, ctx);

export default bootstrap;
