import { Injectable } from '@angular/core';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, from, of } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';

export interface SeccionData {
  id?: string;
  titulo: string;
  instruccion: string;
  descripcion: string;
  subsecciones: {
    pregunta: string;
    descripcion: string;
  }[];
  imagenUrl?: string;
  imagenNombre?: string;
  imagenPreview?: string;
  fechaCreacion?: any;
  fechaActualizacion?: any;
  nota?: string;
  mostrarNota?: boolean;
}

export interface PlanNegocio {
  id?: string;
  planLogicoId?: string;
  nombre: string;
  usuarioId: string;
  secciones: SeccionData[];
  fechaCreacion?: any;
  fechaActualizacion?: any;
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private readonly storage = getStorage();
  private readonly firestore = getFirestore();

  constructor(private afAuth: AngularFireAuth) {}

  // Nuevo método para obtener una sección específica por su ID
  obtenerSeccionPorId(
    planId: string,
    seccionId: string
  ): Observable<SeccionData | undefined> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccion = plan.secciones.find((s) => s.id === seccionId);
          return of(seccion);
        }
        return of(undefined);
      })
    );
  }

  obtenerPlanPorAlias(planLogicoId: string, emailUsuario: string): Observable<PlanNegocio | undefined> {
    const planesRef = collection(this.firestore, 'planes');
    const q = query(
      planesRef,
      where('planLogicoId', '==', planLogicoId),
      where('usuarioId', '==', emailUsuario) // 👈 valida que solo se consulten los planes del usuario
    );

    return from(getDocs(q)).pipe(
      switchMap((querySnapshot) => {
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          return of({ id: docSnap.id, ...docSnap.data() } as PlanNegocio);
        } else {
          return of(undefined);
        }
      }),
      catchError((error) => {
        console.error('Error obteniendo plan por alias:', error);
        return of(undefined);
      })
    );
  }


  // Nuevo método para eliminar una sección específica por ID
  eliminarSeccionPorId(planId: string, seccionId: string): Observable<any> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccionesActualizadas = plan.secciones.filter(
            (s) => s.id !== seccionId
          );

          const planActualizado: PlanNegocio = {
            ...plan,
            secciones: seccionesActualizadas,
            fechaActualizacion: new Date(),
          };

          return this.guardarPlan(planActualizado);
        }
        throw new Error('Plan no encontrado');
      })
    );
  }

  // Nuevo método para actualizar una sección específica por ID
  actualizarSeccionPorId(
    planId: string,
    seccionId: string,
    datosSeccion: Partial<SeccionData>
  ): Observable<any> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccionIndex = plan.secciones.findIndex(
            (s) => s.id === seccionId
          );

          if (seccionIndex !== -1) {
            plan.secciones[seccionIndex] = {
              ...plan.secciones[seccionIndex],
              ...datosSeccion,
              fechaActualizacion: new Date(),
            };

            const planActualizado: PlanNegocio = {
              ...plan,
              fechaActualizacion: new Date(),
            };

            return this.guardarPlan(planActualizado);
          }
        }
        throw new Error('Sección no encontrada');
      })
    );
  }

  // Nuevo método para obtener todas las secciones de un plan con sus IDs
  obtenerSeccionesConIds(planId: string): Observable<SeccionData[]> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          return of(plan.secciones);
        }
        return of([]);
      })
    );
  }

  // Obtener el usuario actual
  getCurrentUserEmail(): Observable<string | null> {
    return this.afAuth.authState.pipe(
      switchMap((user) => {
        if (user?.email) {
          return of(user.email);
        } else {
          return of(null);
        }
      }),
      take(1)
    );
  }

  // Subir imagen a Firebase Storage
  subirImagen(
    file: File,
    seccionId: string,
    planId: string
  ): Observable<string> {
    const timestamp = Date.now();
    const fileName = `planes/${planId}/secciones/${seccionId}_${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, fileName);

    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      catchError((error) => {
        console.error('Error subiendo imagen:', error);

        // Si hay error CORS, intentar con una ruta diferente
        if (
          error.code === 'storage/unknown' ||
          error.message.includes('CORS')
        ) {
          console.log('Intentando subida alternativa...');
          return this.subirImagenAlternativo(file, seccionId, planId);
        }

        throw error;
      })
    );
  }

  // Método alternativo para subir imágenes (fallback)
  subirImagenAlternativo(
    file: File,
    seccionId: string,
    planId: string
  ): Observable<string> {
    // Convertir a base64 como fallback temporal
    return new Observable((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Guardar base64 directamente en Firestore como solución temporal
        observer.next(base64);
        observer.complete();
      };
      reader.onerror = (error) => observer.error(error);
      reader.readAsDataURL(file);
    });
  }

  // Eliminar imagen de Firebase Storage
  eliminarImagen(imagenUrl: string): Observable<void> {
    if (!imagenUrl) {
      return of(undefined);
    }
    try {
      const storageRef = ref(this.storage, imagenUrl);
      return from(deleteObject(storageRef)).pipe(
        catchError((error) => {
          console.error('Error eliminando imagen:', error);
          return of(undefined);
        })
      );
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      return of(undefined);
    }
  }

  // Guardar plan completo en Firestore
  guardarPlan(plan: PlanNegocio): Observable<any> {
    const planData = {
      ...plan,
      fechaActualizacion: new Date(),
    };

    const planesCollection = collection(this.firestore, 'planes');

    if (plan.id) {
      const docRef = doc(this.firestore, 'planes', plan.id);

      return from(getDoc(docRef)).pipe(
        switchMap((docSnap) => {
          if (docSnap.exists()) {
            // ✅ Documento ya existe: actualizar
            return from(updateDoc(docRef, planData));
          } else {
            // ❌ Documento no existe: crearlo con el ID indicado
            planData.fechaCreacion = new Date();
            return from(setDoc(docRef, planData)).pipe(
              switchMap(() => of({ id: docRef.id }))
            );
          }
        })
      );
    } else {
      // 🔄 Generar nuevo ID
      const newDocRef = doc(planesCollection);
      planData.id = newDocRef.id;
      planData.fechaCreacion = new Date();

      return from(setDoc(newDocRef, planData)).pipe(
        switchMap(() => of({ id: newDocRef.id }))
      );
    }
  }

  existePlan(planId: string): Observable<boolean> {
    const docRef = doc(this.firestore, 'planes', planId);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => of(docSnap.exists())),
      catchError(() => of(false)) // en caso de error, asumimos que no existe
    );
  }

  // Obtener plan por ID
  obtenerPlan(planId: string): Observable<PlanNegocio | undefined> {
    const docRef = doc(this.firestore, 'planes', planId);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return of({ id: docSnap.id, ...data } as PlanNegocio);
        } else {
          console.log(`El plan con ID ${planId} no existe`);
          return of(undefined);
        }
      }),
      catchError((error) => {
        console.error('Error obteniendo plan:', error);

        // Si es un error de permisos, probablemente el documento no existe
        if (error.code === 'permission-denied') {
          console.log(
            'Documento no existe o no tienes permisos para acceder a él'
          );
          return of(undefined);
        }

        return of(undefined);
      })
    );
  }

  // Obtener todos los planes de un usuario
  obtenerPlanesPorUsuario(usuarioId: string): Observable<PlanNegocio[]> {
    const planesRef = collection(this.firestore, 'planes');
    const q = query(
      planesRef,
      where('usuarioId', '==', usuarioId),
      orderBy('fechaActualizacion', 'desc')
    );

    return from(getDocs(q)).pipe(
      switchMap((querySnapshot) => {
        const planes: PlanNegocio[] = [];
        querySnapshot.forEach((doc) => {
          planes.push({ id: doc.id, ...doc.data() } as PlanNegocio);
        });
        return of(planes);
      }),
      catchError((error) => {
        console.error('Error obteniendo planes:', error);
        return of([]);
      })
    );
  }

  // Eliminar plan
  eliminarPlan(planId: string): Observable<void> {
    const docRef = doc(this.firestore, 'planes', planId);
    return from(deleteDoc(docRef));
  }

  // Guardar solo una sección específica
  guardarSeccion(
    planId: string,
    seccionIndex: number,
    seccionData: SeccionData
  ): Observable<any> {
    const docRef = doc(this.firestore, 'planes', planId);
    const updateData = {
      [`secciones.${seccionIndex}`]: {
        ...seccionData,
        fechaActualizacion: new Date(),
      },
      fechaActualizacion: new Date(),
    };

    return from(updateDoc(docRef, updateData));
  }
}
