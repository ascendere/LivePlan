import { Injectable } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

  generarPlantillaSecciones(): SeccionData[] {
    const fecha = new Date();
    return [
      {
        titulo: 'Resumen Ejecutivo',
        instruccion:
          'En una extensión de dos o tres páginas como máximo, debes resaltar de forma esquemática y atractiva los aspectos más relevantes del plan: Proporciona una descripción concisa, aunque positiva de tu compañía, incluidos los objetivos y los logros. Por ejemplo, si es una compañía establecida, considere la posibilidad de describir a qué se dedica, cómo ha logrado los objetivos hasta la fecha y qué queda por hacer. Si es nueva, resume qué pretendes hacer, cómo y cuándo pretendes hacerlo y cómo crees que puede superar los principales obstáculos (por ejemplo, la competencia).',
        descripcion: '',
        subsecciones: [
          { pregunta: 'Información destacada', descripcion: '' },
          { pregunta: 'Modelo de negocio y objetivos', descripcion: '' },
          {
            pregunta: 'Declaración de Objetivos, Misión y Visión',
            descripcion: '',
          },
          {
            pregunta: 'Elementos diferenciadores y claves para el éxito',
            descripcion: '',
          },
        ],
        nota: 'El resumen ejecutivo debe incluir los puntos clave del proyecto.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Presentación del Proyecto: Origen y Evolución',
        instruccion:
          'Origen y evolución del proyecto. En tu redacción trata de responder a las siguientes cuestiones:',
        descripcion: '',
        subsecciones: [
          {
            pregunta: '¿Cómo se te ocurrió la idea de crear este negocio? ¿Por qué?',
            descripcion: '',
          },
          {
            pregunta: '¿Qué has hecho hasta ahora para ponerlo en marcha?',
            descripcion: '',
          },
          {
            pregunta: '¿Qué pasos has dado y en qué situación se encuentra el proyecto?',
            descripcion: '',
          },
        ],
        nota: 'Incluya detalles sobre la misión y visión del proyecto.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Estudio de Mercado',
        instruccion:
          '¿Cuál es tu mercado de destino? (¿Quién es más probable que compre tus productos o use tus servicios?) ¿Cuáles son los datos demográficos? ¿Cuál es el tamaño de tu posible base de clientes?',
        descripcion: '',
        subsecciones: [
          {
            pregunta:
              'Tamaño: ¿Cuántos clientes componen el total del mercado? ¿Qué facturación total generan?',
            descripcion: '',
          },
          {
            pregunta:
              'Ubicación geográfica: ¿Qué extensión geográfica tiene tu mercado? ¿Cómo es (superficie, densidad de población, características...)?',
            descripcion: '',
          },
          {
            pregunta:
              'Ritmo de crecimiento: El consumo de tu producto o servicio, ¿crece, se mantiene o disminuye? ¿Por qué?',
            descripcion: '',
          },
          {
            pregunta:
              'Estacionalidad: ¿Se concentra el consumo en unos determinados periodos del año?',
            descripcion: '',
          },
          {
            pregunta:
              'Segmentación: ¿se divide el mercado en distintos grupos de clientes, con distintas preferencias y hábitos de consumo, independientes entre sí?',
            descripcion: '',
          },
          {
            pregunta:
              'Novedades: ¿Qué novedades se están introduciendo en el mercado?: ¿tecnologías?, ¿legislación?, ¿preferencias del cliente?, ¿hábitos de consumo?, ¿cambios demográficos o socioculturales? ¿otras?',
            descripcion: '',
          },
          {
            pregunta:
              'Fuerzas competitivas: ¿la rivalidad entre los competidores del mercado es alta o baja?, ¿hay sitio para todos? ¿hay clientes o proveedores con grandes cuotas de mercado y alto poder de negociación?, ¿Hay barreras de entrada que dificultan empezar a ejercer la actividad? ¿Se esperan productos sustitutivos a corto plazo?',
            descripcion: '',
          },
        ],
        nota: 'Podrías incluir un gráfico.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Estrategia Comercial',
        instruccion:
          'Debes exponer las características comerciales y técnicas de tu producto o servicio (calidad, diseño, amplitud de las líneas de producto, servicios complementarios, marcas). En tu redacción trata de responder a las siguientes cuestiones:',
        descripcion: '',
        subsecciones: [
          {
            pregunta:
              '¿Cómo de amplia es tu gama de productos / servicios? ¿Qué líneas de producto/servicio ofreces? ¿Cuántas referencias de producto vas a ofrecer?',
            descripcion: '',
          },
          {
            pregunta:
              '¿Cuál es tu estrategia de calidad? ¿En qué nivel de de calidad/ precio te quieres posicionar?',
            descripcion: '',
          },
          {
            pregunta: '¿Incorporas diseños que te diferencien? ¿Envases o etiquetas?',
            descripcion: '',
          },
          {
            pregunta: '¿Qué características técnicas tienen? ¿Qué tecnologías incorporas?',
            descripcion: '',
          },
          {
            pregunta:
              '¿Qué servicios complementarios ofreces: mantenimiento, instalación, información, reparto a domicilio, ¿otros?',
            descripcion: '',
          },
          {
            pregunta: '¿Qué marca o nombre comercial vas a utilizar? Explica tu elección',
            descripcion: '',
          },
        ],
        nota: 'Si vas a proporcionar solo productos o solo servicios, elimina la parte del título que no corresponda.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Producción y Recursos Humanos',
        instruccion:
          'Indica aquella normativa genérica o específica que debes cumplir para poder desarrollar tu actividad. En tu redacción trata de responder a las siguientes cuestiones:',
        descripcion: '',
        subsecciones: [
          {
            pregunta:
              '¿Existe alguna legislación que debes cumplir para poder desarrollar la actividad?',
            descripcion: '',
          },
          {
            pregunta:
              '¿Debes cumplir con la Ley de protección de datos - LOPD? ¿Y con la Ley de Servicios de la Sociedad de la Información – LSSI?',
            descripcion: '',
          },
          {
            pregunta: '¿Y con alguna normativa en materia de seguridad e higiene?',
            descripcion: '',
          },
        ],
        nota: 'Incluya estrategias de precios, promoción y distribución.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Análisis económico y Financiero',
        instruccion:
          'Una vez hayas completado el cálculo de la viabilidad económico - financiera. Se cargaran automaticamente.',
        descripcion: '',
        subsecciones: [
          {
            pregunta: 'Plan de Inversiones',
            descripcion: '',
          },
          {
            pregunta: 'Plan de financiación',
            descripcion: '',
          },
          {
            pregunta: 'Cuota de resultados',
            descripcion: '',
          },
          {
            pregunta: 'Flujo de efectivo',
            descripcion: '',
          },
        ],
        nota: 'Incluya detalles sobre recursos necesarios y organigrama.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
      {
        titulo: 'Análisis DAFO',
        instruccion:
          'El análisis externo (estudio de mercado) te dirá cuáles son las oportunidades y amenazas que ofrece el entorno. Recuerda al redactarlos que son elementos externos, que no dependen de ti. El análisis interno de tu proyecto y tu negocio (estrategia comercial, producción, organización y recursos, capacidad financiera) te ayudará a determinar tus fortalezas y debilidades ante los retos que plantea el entorno. Aquí sí que debes hablar de ti y de tu proyecto.',
        descripcion: '',
        subsecciones: [
          { pregunta: 'Debilidades', descripcion: '' },
          { pregunta: 'Amenazas', descripcion: '' },
          { pregunta: 'Fortalezas', descripcion: '' },
          { pregunta: 'Oportunidades', descripcion: '' },
        ],
        nota: 'Sea específico al identificar cada elemento del análisis DAFO.',
        mostrarNota: false,
        fechaCreacion: fecha,
        fechaActualizacion: fecha,
      },
    ];
  }

  crearPlanInicial(nombre: string, planLogicoId: string, email: string): Observable<any> {
    const nuevoPlan: PlanNegocio = {
      nombre: nombre,
      planLogicoId: planLogicoId,
      usuarioId: email,
      secciones: this.generarPlantillaSecciones(),
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    };

    return this.guardarPlan(nuevoPlan);
  }


  // Nuevo método para obtener una sección específica por su ID
  obtenerSeccionPorId(planId: string, seccionId: string): Observable<SeccionData | undefined> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccion = plan.secciones.find((s) => s.id === seccionId);
          return of(seccion);
        }
        return of(undefined);
      }),
    );
  }

  obtenerPlanPorAlias(
    planLogicoId: string,
    emailUsuario: string,
  ): Observable<PlanNegocio | undefined> {
    const planesRef = collection(this.firestore, 'planes');
    const q = query(
      planesRef,
      where('planLogicoId', '==', planLogicoId),
      where('usuarioId', '==', emailUsuario), // 👈 valida que solo se consulten los planes del usuario
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
      }),
    );
  }

  // Nuevo método para eliminar una sección específica por ID
  eliminarSeccionPorId(planId: string, seccionId: string): Observable<any> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccionesActualizadas = plan.secciones.filter((s) => s.id !== seccionId);

          const planActualizado: PlanNegocio = {
            ...plan,
            secciones: seccionesActualizadas,
            fechaActualizacion: new Date(),
          };

          return this.guardarPlan(planActualizado);
        }
        throw new Error('Plan no encontrado');
      }),
    );
  }

  // Nuevo método para actualizar una sección específica por ID
  actualizarSeccionPorId(
    planId: string,
    seccionId: string,
    datosSeccion: Partial<SeccionData>,
  ): Observable<any> {
    return this.obtenerPlan(planId).pipe(
      switchMap((plan) => {
        if (plan?.secciones) {
          const seccionIndex = plan.secciones.findIndex((s) => s.id === seccionId);

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
      }),
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
      }),
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
      take(1),
    );
  }

  // Subir imagen a Firebase Storage
  subirImagen(file: File, seccionId: string, planId: string): Observable<string> {
    const timestamp = Date.now();
    const fileName = `planes/${planId}/secciones/${seccionId}_${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, fileName);

    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      catchError((error) => {
        console.error('Error subiendo imagen:', error);

        // Si hay error CORS, intentar con una ruta diferente
        if (error.code === 'storage/unknown' || error.message.includes('CORS')) {
          // console.log('Intentando subida alternativa...');
          return this.subirImagenAlternativo(file, seccionId, planId);
        }

        throw error;
      }),
    );
  }

  // Método alternativo para subir imágenes (fallback)
  subirImagenAlternativo(file: File, seccionId: string, planId: string): Observable<string> {
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
        }),
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
            return from(setDoc(docRef, planData)).pipe(switchMap(() => of({ id: docRef.id })));
          }
        }),
      );
    } else {
      // 🔄 Generar nuevo ID
      const newDocRef = doc(planesCollection);
      planData.id = newDocRef.id;
      planData.fechaCreacion = new Date();

      return from(setDoc(newDocRef, planData)).pipe(switchMap(() => of({ id: newDocRef.id })));
    }
  }

  existePlan(planId: string): Observable<boolean> {
    const docRef = doc(this.firestore, 'planes', planId);
    return from(getDoc(docRef)).pipe(
      switchMap((docSnap) => of(docSnap.exists())),
      catchError(() => of(false)), // en caso de error, asumimos que no existe
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
          // console.log(`El plan con ID ${planId} no existe`);
          return of(undefined);
        }
      }),
      catchError((error) => {
        console.error('Error obteniendo plan:', error);

        // Si es un error de permisos, probablemente el documento no existe
        if (error.code === 'permission-denied') {
          /* console.log(
            'Documento no existe o no tienes permisos para acceder a él'
          ); */
          return of(undefined);
        }

        return of(undefined);
      }),
    );
  }

  // Obtener todos los planes de un usuario
  obtenerPlanesPorUsuario(usuarioId: string): Observable<PlanNegocio[]> {
    const planesRef = collection(this.firestore, 'planes');
    const q = query(
      planesRef,
      where('usuarioId', '==', usuarioId),
      orderBy('fechaActualizacion', 'desc'),
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
      }),
    );
  }

  // Eliminar plan
  eliminarPlan(planId: string): Observable<void> {
    const docRef = doc(this.firestore, 'planes', planId);
    return from(deleteDoc(docRef));
  }

  // Guardar solo una sección específica
  guardarSeccion(planId: string, seccionIndex: number, seccionData: SeccionData): Observable<any> {
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
