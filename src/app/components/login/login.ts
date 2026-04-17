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
  showPassword = signal<boolean>(false);
  isLoginMode = signal<boolean>(true);
  
  loginForm: FormGroup;

  constructor() {
    this.loginForm = this.fb.group({
      name: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['']
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.authService.user$.subscribe((user) => {
      this.user.set(user);
    });
  }

  passwordMatchValidator = (g: FormGroup) => {
    if (this.isLoginMode()) {
      return null;
    }
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  };

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleMode() {
    this.isLoginMode.update(v => !v);
    this.errorMessage.set('');
    
    // Si pasamos a modo registro, el nombre es requerido
    if (!this.isLoginMode()) {
      this.loginForm.get('name')?.setValidators([Validators.required]);
      this.loginForm.get('confirmPassword')?.setValidators([Validators.required]);
    } else {
      this.loginForm.get('name')?.clearValidators();
      this.loginForm.get('confirmPassword')?.clearValidators();
    }
    this.loginForm.get('name')?.updateValueAndValidity();
    this.loginForm.get('confirmPassword')?.updateValueAndValidity();
    this.loginForm.updateValueAndValidity();
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      if (!this.isLoginMode() && this.loginForm.hasError('mismatch')) {
        this.errorMessage.set('Las contraseñas no coinciden.');
      } else {
        this.errorMessage.set('Por favor, completa todos los campos correctamente.');
      }
      return;
    }

    this.errorMessage.set('');
    const { name, email, password } = this.loginForm.value;

    if (this.isLoginMode()) {
      this.authService
        .login(email, password)
        .then(() => {
          this.router.navigate(['/home']);
        })
        .catch((err) => {
          this.errorMessage.set('Credenciales incorrectas o error en inicio de sesión.');
        });
    } else {
      this.authService
        .register(name, email, password)
        .then(() => {
          this.router.navigate(['/home']);
        })
        .catch((err) => {
          this.errorMessage.set(
            'Error al crear la cuenta. Verifica que el correo sea válido o que no esté en uso.'
          );
        });
    }
  }
}
