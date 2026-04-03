import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Eliminamos el import del ChatWidgetComponent

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // Eliminamos el ChatWidgetComponent de aquí
  templateUrl: './app.component.html', // 👉 ¡Volvemos a apuntar al archivo HTML!
  styles: [], 
})
export class AppComponent { 
  title = 'web';
}