import {AngularFireAuth} from '@angular/fire/compat/auth';
import {AngularFirestore} from '@angular/fire/compat/firestore';
import {combineLatest, map, Observable, of, switchMap} from 'rxjs';
import {Router} from '@angular/router';
import {Injectable, EnvironmentInjector, runInInjectionContext} from '@angular/core';
import firebase from 'firebase/compat/app'; // Importa firebase

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

  async register(name: string, email: string, password: string) {
    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      
      if (userCredential.user) {
        // Ejecutamos la obtención de colección/documento dentro del contexto de inyección
        const promise = runInInjectionContext(this.injector, () => {
          return this.afs.collection('users').doc(userCredential.user!.uid).set({
            name: name,
            email: email
          }, { merge: true });
        });
        
        await promise;
        // console.log("Usuario registrado de forma satisfactoria");
      }
    } catch (error) {
      console.error("Hubo un error durante el registro:", error);
      throw error;
    }
  }

  async logout() {
    try {
      await this.afAuth.signOut();
      // console.log("Usuario desconectado");
      this.router.navigate(['/login']);
    } catch (error) {
      console.error("Hubo un error durante la desconexión:", error);
    }
  }

  // Método para obtener el estado de autenticación
  getAuthState() : Observable<any> {
    return this.afAuth.authState;
  }
}
