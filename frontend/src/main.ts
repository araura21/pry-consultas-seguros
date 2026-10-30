import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEsEc from '@angular/common/locales/es-EC';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeEsEc);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
