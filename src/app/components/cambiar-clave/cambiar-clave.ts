import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment.example';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/login.service';

/**
 * Pantalla del primer ingreso (o tras "formatear contraseña"): la cuenta tiene como contraseña provisional
 * la cédula y hay que elegir una propia antes de usar la herramienta. Las reglas son las del backend, que
 * es quien las aplica de verdad.
 */
@Component({
  selector: 'app-cambiar-clave',
  templateUrl: './cambiar-clave.html',
  imports: [ReactiveFormsModule],
  styleUrl: '../login/login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarClave {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);

  readonly mostrar = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');

  readonly form: FormGroup = this.fb.group({
    nueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmar: ['', [Validators.required]],
  });

  alternarVisibilidad(): void {
    this.mostrar.update((v) => !v);
  }

  async guardar(): Promise<void> {
    const { nueva, confirmar } = this.form.value;
    if (this.form.invalid) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (/^\d+$/.test(nueva)) {
      this.error.set('La contraseña no puede ser solo números.');
      return;
    }
    if (nueva !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.error.set('');
    this.enviando.set(true);
    try {
      const respuesta = await this.api.fetch(`${environment.backend.url}/usuarios/yo/clave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nueva }),
      });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        this.error.set(cuerpo?.mensaje ?? 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
        return;
      }
      // Firebase cierra las sesiones al cambiar la contraseña: se vuelve a entrar con la nueva.
      await this.authService.logout('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
    } catch {
      this.error.set('No hay conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }

  cancelar(): void {
    this.authService.logout();
  }
}
