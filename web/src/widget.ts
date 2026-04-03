import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { WidgetElementComponent } from './app/widget/widget-element.component';

(async () => {
  const app = await createApplication({
    providers: [provideHttpClient(withFetch())],
  });

  const WidgetElement = createCustomElement(WidgetElementComponent, {
    injector: app.injector,
  });

  customElements.define('ai-chat-widget', WidgetElement);
})();
