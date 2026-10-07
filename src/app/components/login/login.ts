import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../core/services/login.service';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [ReactiveFormsModule],
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  user = signal<any>(null);
  errorMessage = signal<string>('');
  /** Mensaje informativo (p. ej. "contraseña actualizada, vuelve a ingresar"). */
  aviso = signal<string>('');
  showPassword = signal<boolean>(false);
  enviando = signal<boolean>(false);

  loginForm: FormGroup;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
    // El aviso llega por el estado de la navegación (lo manda logout()).
    const aviso = this.router.getCurrentNavigation()?.extras?.state?.['aviso'];
    if (typeof aviso === 'string') this.aviso.set(aviso);
  }

  ngOnInit() {
    this.authService.user$.subscribe((user) => {
      this.user.set(user);
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage.set('Por favor, completa el correo y la contraseña.');
      return;
    }
    this.errorMessage.set('');
    this.aviso.set('');
    this.enviando.set(true);
    const { email, password } = this.loginForm.value;
    try {
      await this.authService.login(String(email).trim(), password);
      // token recién emitido: trae el rol y la marca de contraseña provisional
      const perfil = await this.authService.obtenerPerfilDeAcceso(true);
      this.router.navigate([perfil?.debeCambiarClave ? '/cambiar-clave' : '/home']);
    } catch (err: any) {
      this.errorMessage.set(this.mensajeDeError(err?.code));
    } finally {
      this.enviando.set(false);
    }
  }

  private mensajeDeError(codigo?: string): string {
    switch (codigo) {
      case 'auth/user-disabled':
        return 'Tu cuenta está deshabilitada. Contacta al administrador.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'No hay conexión con el servidor. Revisa tu internet.';
      default:
        return 'Correo o contraseña incorrectos.';
    }
  }
}
