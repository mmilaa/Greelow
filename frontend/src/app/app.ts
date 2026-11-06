import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionRedirect } from './session-redirect';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  // Eagerly instantiate the session-expiry redirect effect at app root.
  private readonly sessionRedirect = inject(SessionRedirect);
}
