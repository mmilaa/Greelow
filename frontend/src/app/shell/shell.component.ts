import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { SessionStore } from '../features/auth/application/session.store';
import { APP_NAME } from '../shared/app-name';
import type { ThemePreference } from '../theme/theme';
import { ThemeService } from '../theme/theme.service';

/**
 * App shell: top toolbar with navigation and a user menu, plus the outlet for
 * the private pages. Reads the session only to show the user name and to log
 * out; contains no business logic.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly session = inject(SessionStore);

  readonly appName = APP_NAME;
  readonly userName = this.session.user;

  protected readonly theme = inject(ThemeService);
  protected readonly themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'system', label: 'Sistema', icon: 'brightness_auto' },
    { value: 'light', label: 'Claro', icon: 'light_mode' },
    { value: 'dark', label: 'Oscuro', icon: 'dark_mode' },
  ];
  protected readonly currentTheme = computed(
    () => this.themeOptions.find((o) => o.value === this.theme.preference()) ?? this.themeOptions[0],
  );

  readonly links = [
    { path: '/accounts', label: 'Cuentas' },
    { path: '/transactions', label: 'Movimientos' },
    { path: '/transfers', label: 'Transferencias' },
    { path: '/expenses', label: 'Gastos' },
  ];

  logout(): void {
    this.session.logout();
  }
}
