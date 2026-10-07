import {AngularFireAuth} from '@angular/fire/compat/auth';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {combineLatest, firstValueFrom, map, Observable, of, switchMap} from 'rxjs';
import {Router} from '@angular/router';
import {Injectable, EnvironmentInjector, runInInjectionContext} from '@angular/core';
import firebase from 'firebase/compat/app'; // Importa firebase
import { environment } from '../../../environments/environment.example';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<any>;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private injector: EnvironmentInjector
  ) {
    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return of(user); // Retorna el objeto completo del usuario con uid, email, etc.
        } else {
          return of(null);
        }
      })
    );
  }

  async login(email: string, password: string) {
    try {
      await this.afAuth.signInWithEmailAndPassword(email, password);
      // console.log("autenticacion satisfactoria",this.user$);
    } catch (error) {
      console.error("Hubo un error durante el inicio de sesión:", error);
      throw error;
    }
  }

  /** Cierra la sesión y lleva al login; `aviso` se muestra allí (por ejemplo, tras cambiar la contraseña). */
  async logout(aviso?: string) {
    try {
      await this.afAuth.signOut();
      this.adminCache = undefined;
      this.router.navigate(['/login'], aviso ? { state: { aviso } } : undefined);
    } catch (error) {
      console.error("Hubo un error durante la desconexión:", error);
    }
  }

  /** Último resultado de "¿soy administrador?" (lo decide el backend); se reutiliza un minuto. */
  private adminCache?: { uid: string; esAdmin: boolean; hasta: number };

  /**
   * Rol y marca de contraseña provisional del usuario actual (null si no hay sesión). La marca viene del ID token;
   * si es administrador lo dice el backend (GET /usuarios/yo), porque puede serlo por la colección "admin" de
   * Firestore y eso el token no lo refleja. Sirve para decidir qué pantallas mostrar; la seguridad la aplica el backend.
   */
  async obtenerPerfilDeAcceso(renovar = false): Promise<{ esAdmin: boolean; debeCambiarClave: boolean } | null> {
    const usuario = await firstValueFrom(this.afAuth.authState);
    if (!usuario) return null;
    const { claims, token } = await usuario.getIdTokenResult(renovar);
    const esAdmin = claims['rol'] === 'admin' || (await this.consultarSiEsAdmin(usuario.uid, token, renovar));
    return { esAdmin, debeCambiarClave: claims['debe_cambiar_clave'] === true };
  }

  private async consultarSiEsAdmin(uid: string, token: string, ignorarCache: boolean): Promise<boolean> {
    const c = this.adminCache;
    if (!ignorarCache && c && c.uid === uid && c.hasta > Date.now()) return c.esAdmin;
    try {
      const respuesta = await fetch(`${environment.backend.url}/usuarios/yo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!respuesta.ok) return false;
      const esAdmin = (await respuesta.json())?.es_admin === true;
      this.adminCache = { uid, esAdmin, hasta: Date.now() + 60_000 };
      return esAdmin;
    } catch {
      return false; // sin conexión con el backend: no se muestra la administración
    }
  }

  /**
   * ID token de Firebase del usuario actual para autenticarse ante el backend (null si no hay sesión).
   * Espera a que Firebase termine de restaurar la sesión al cargar la página; el SDK renueva el token
   * solo cuando va a vencer, y `renovar` fuerza uno nuevo.
   */
  async obtenerToken(renovar = false): Promise<string | null> {
    const usuario = await firstValueFrom(this.afAuth.authState);
    return usuario ? usuario.getIdToken(renovar) : null;
  }

  // Método para obtener el estado de autenticación
  getAuthState() : Observable<any> {
    return this.afAuth.authState;
  }
}
