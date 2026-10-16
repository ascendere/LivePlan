import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import jsPDF from 'jspdf';
import { FirebaseService, SeccionData, PlanNegocio, ImagenSeccion, CLAVE_SECCION_ECONOMICA } from '../../core/services/firebase.service';
import { InversionService } from '../../core/services/inversion.service';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AnexosFinancierosService, AnexosFinancieros, TablaAnexo, FilaAnexo } from '../../core/services/anexos-financieros.service';
import { GeneradorPdfPlanificacion, nombreArchivoPdf } from './generador-pdf';
import {
  esSeccionEconomica as esSeccionEconomicaUtil,
  esSeccionPropia as esSeccionPropiaUtil,
  normalizarSecciones,
  normalizarTexto as normalizarTextoUtil,
  usaTextoGeneral as usaTextoGeneralUtil,
} from './secciones-util';
import { reducirImagen } from '../../core/utils/imagen';
import { ResumenFinancieroService, ResumenFinanciero, ResumenGrafica, TipoGrafica, EvaluacionFinanciera } from '../../core/services/resumen-financiero.service';

/** Estado del popup de descripción/fuente de una imagen. */
class PopupImagen {
  visible = false;
  modo: 'nueva' | 'reemplazar' | 'editar' = 'nueva';
  seccionIndex = 0;
  subIndex: number | null = null;
  imgIndex: number | null = null;
  archivo: File | null = null;
  previewUrl = '';
  descripcion = '';
  fuente = '';
  subiendo = false;
  error = '';

  static cerrado(): PopupImagen {
    return new PopupImagen();
  }
}

@Component({
  selector: 'app-secciones-pdf',
  templateUrl: './secciones-pdf.component.html',
  standalone: false,
  styleUrl: './secciones-pdf.component.css',
})
export class SeccionesPDFComponent implements OnInit {
  loadingPDF = false;
  planId: string = '';
  usuarioId: string = '';
  secciones: SeccionData[] = [];
  guardandoSeccion = false;
  mensajeGuardado = '';
  notaVisible = false;
  notaContenido = '';
  notaPosX = 0;
  notaPosY = 0;
  planLogicoId = '';
  editandoTitulo: number | null = null;
  nombrePlan: string = 'Plan sin título';
  // Edición de los datos del proyecto (nombre + portada del PDF), todo en un mismo panel con Guardar / Cancelar
  editandoNombre = false;
  nombreEdicion = '';
  guardandoNombre = false;
  errorNombre = '';

  // Portada del PDF: texto opcional bajo "Plan de Negocio" y logo opcional
  periodoPortada = '';
  logoPortadaUrl = '';
  periodoEdicion = '';
  /** Logo que se ve en el panel: el guardado, el recién elegido (sin subir aún) o vacío si se quitó. */
  logoVistaPrevia = '';
  private logoPendiente: File | null = null;
  private logoPendienteObjetoUrl = '';
  private logoQuitado = false;
  readonly maxCaracteresPeriodo = 40;

  // Popup para pedir descripción y fuente (APA) al subir/reemplazar/editar una imagen.
  popupImagen: PopupImagen = PopupImagen.cerrado();

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly resumenService: ResumenFinancieroService,
    private readonly anexosService: AnexosFinancierosService,
    private readonly inversionService: InversionService,
  ) {}

  ngOnInit() {
    this.firebaseService.getCurrentUserEmail().subscribe((email) => {
      if (email) {
        this.usuarioId = email;
        this.route.paramMap.subscribe((params) => {
          this.planLogicoId = params.get('id') || '';

          if (this.planLogicoId) {
            this.firebaseService
              .obtenerPlanPorAlias(this.planLogicoId, this.usuarioId)
              .subscribe((plan) => {
                if (plan) {
                  this.planId = plan.id!;
                  this.nombrePlan = plan.nombre || 'Plan sin título';
                  this.periodoPortada = plan.periodo || '';
                  this.logoPortadaUrl = plan.logoUrl || '';
                  this.secciones = normalizarSecciones(plan.secciones);
                  this.sincronizarNombreConBackend();
                } else {
                  const nuevoPlan: PlanNegocio = {
                    nombre: 'Plan sin título',
                    planLogicoId: this.planLogicoId,
                    usuarioId: email,
                    secciones: this.generarPlantillaSecciones(),
                    fechaCreacion: new Date(),
                    fechaActualizacion: new Date(),
                  };

                  this.firebaseService.guardarPlan(nuevoPlan).subscribe((res) => {
                    this.planId = res.id;
                    this.secciones = this.generarPlantillaSecciones();
                    this.sincronizarNombreConBackend();
                  });
                }
              });
          } else {
            console.error('No hay ID lógico en la ruta');
          }
        });
      } else {
        console.error('Usuario no autenticado');
        // Redirigir al login si no está autenticado
      }
    });
  }

  // ============================================================
  //  NOMBRE DEL PROYECTO
  // ============================================================

  /**
   * El nombre del proyecto vive en el backend (es lo que muestra el Home);
   * Firebase guarda una copia para el título del PDF. Al abrir el plan se
   * toma el del backend, así ambos coinciden.
   */
  private sincronizarNombreConBackend(): void {
    const id = Number(this.planLogicoId);
    if (!Number.isFinite(id) || id <= 0) return;
    this.inversionService
      .getPlanNegocio(id)
      .then((plan) => {
        const nombre = (plan?.problematica || '').trim();
        if (nombre && nombre !== this.nombrePlan && !this.editandoNombre) {
          this.nombrePlan = nombre;
        }
      })
      .catch(() => {
        /* sin conexión con el backend: se queda el nombre guardado en Firebase */
      });
  }

  iniciarEdicionNombre(): void {
    this.nombreEdicion = this.nombrePlan;
    this.periodoEdicion = this.periodoPortada;
    this.descartarLogoPendiente();
    this.logoQuitado = false;
    this.logoVistaPrevia = this.logoPortadaUrl;
    this.errorNombre = '';
    this.editandoNombre = true;
    setTimeout(() => (document.getElementById('input-nombre-proyecto') as HTMLInputElement | null)?.select(), 0);
  }

  cancelarEdicionNombre(): void {
    if (this.guardandoNombre) return;
    this.descartarLogoPendiente();
    this.editandoNombre = false;
    this.errorNombre = '';
  }

  private descartarLogoPendiente(): void {
    if (this.logoPendienteObjetoUrl) URL.revokeObjectURL(this.logoPendienteObjetoUrl);
    this.logoPendiente = null;
    this.logoPendienteObjetoUrl = '';
  }

  /** Elige un logo nuevo: se reduce y se muestra de inmediato, pero no se sube hasta pulsar "Guardar cambios". */
  async alElegirLogo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    this.errorNombre = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      this.errorNombre = 'El logo debe ser una imagen PNG, JPG o WebP.';
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      this.errorNombre = 'La imagen es demasiado grande (máximo 10 MB).';
      return;
    }
    try {
      // Se reduce antes de subirla: sobra para la portada y pesa poco en Firebase y en el PDF.
      const reducida = await reducirImagen(archivo);
      this.descartarLogoPendiente();
      this.logoPendiente = reducida;
      this.logoPendienteObjetoUrl = URL.createObjectURL(reducida);
      this.logoVistaPrevia = this.logoPendienteObjetoUrl;
      this.logoQuitado = false;
    } catch (error) {
      console.error('Error al preparar el logo:', error);
      this.errorNombre = 'No se pudo leer la imagen. Prueba con otra.';
    }
  }

  quitarLogoEdicion(): void {
    this.descartarLogoPendiente();
    this.logoVistaPrevia = '';
    this.logoQuitado = true;
  }

  /** Guarda nombre, texto y logo del proyecto juntos. */
  async guardarNombre(): Promise<void> {
    if (!this.editandoNombre || this.guardandoNombre) return;

    const nombre = this.nombreEdicion.trim();
    const periodo = this.periodoEdicion.trim().slice(0, this.maxCaracteresPeriodo);
    if (!nombre) {
      this.errorNombre = 'El nombre del proyecto no puede estar vacío.';
      return;
    }

    const cambioNombre = nombre !== this.nombrePlan;
    const cambioPeriodo = periodo !== this.periodoPortada;
    const cambioLogo = !!this.logoPendiente || (this.logoQuitado && !!this.logoPortadaUrl);
    if (!cambioNombre && !cambioPeriodo && !cambioLogo) {
      this.cancelarEdicionNombre();
      return;
    }

    this.guardandoNombre = true;
    this.errorNombre = '';
    try {
      // 1) el nombre vive en el backend (es lo que muestra el Home)
      if (cambioNombre) {
        await this.inversionService.actualizarNombrePlan(Number(this.planLogicoId), nombre);
        this.nombrePlan = nombre;
      }

      // 2) logo y texto de la portada, junto con la copia del nombre, en un solo guardado de Firebase
      const datos: { nombre?: string; periodo?: string; logoUrl?: string } = {};
      if (cambioNombre) datos.nombre = nombre;
      if (cambioPeriodo) datos.periodo = periodo;
      let logoAnterior = '';
      if (this.logoPendiente) {
        datos.logoUrl = await firstValueFrom(this.firebaseService.subirImagen(this.logoPendiente, 'portada-logo', this.planId));
        logoAnterior = this.logoPortadaUrl;
      } else if (this.logoQuitado && this.logoPortadaUrl) {
        datos.logoUrl = '';
        logoAnterior = this.logoPortadaUrl;
      }
      if (Object.keys(datos).length > 0 && this.planId) {
        await firstValueFrom(this.firebaseService.actualizarDatosProyecto(this.planId, datos));
      }

      if (cambioPeriodo) this.periodoPortada = periodo;
      if (datos.logoUrl !== undefined) this.logoPortadaUrl = datos.logoUrl;
      if (logoAnterior && !logoAnterior.startsWith('data:')) {
        this.firebaseService.eliminarImagen(logoAnterior).subscribe(); // el logo anterior ya no se usa
      }

      this.descartarLogoPendiente();
      this.editandoNombre = false;
      this.mensajeGuardado = 'Cambios del proyecto guardados';
      setTimeout(() => (this.mensajeGuardado = ''), 3000);
    } catch (error) {
      console.error('Error al guardar los datos del proyecto:', error);
      this.errorNombre = 'No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.';
    } finally {
      this.guardandoNombre = false;
    }
  }

  mostrarNota(index: number, event: MouseEvent, btn: HTMLElement) {
    const rect = btn.getBoundingClientRect();

    this.notaContenido = this.secciones[index]?.nota || 'Nota no disponible';
    this.notaPosX = rect.right + 10 + window.scrollX;
    this.notaPosY = rect.top + window.scrollY;
    this.notaVisible = true;
  }

  ocultarNota() {
    this.notaVisible = false;
  }

  async crearNuevoPlan(planLogicoId: string): Promise<string> {
    const nuevoPlan: PlanNegocio = {
      planLogicoId,
      nombre: `Plan de Negocio - ${new Date().toLocaleDateString()}`,
      usuarioId: this.usuarioId,
      secciones: this.secciones.map((seccion, index) => ({
        id: seccion.id || this.generarIdSeccion('temp', index),
        ...(seccion.clave ? { clave: seccion.clave } : {}),
        titulo: seccion.titulo,
        instruccion: seccion.instruccion,
        descripcion: seccion.descripcion,
        subsecciones: seccion.subsecciones.map((sub) => ({
          pregunta: sub.pregunta,
          descripcion: sub.descripcion,
          ...(sub.imagenes?.length ? { imagenes: sub.imagenes } : {}),
        })),
        imagenUrl: seccion.imagenPreview || '',
      })),
      fechaCreacion: new Date(),
    };

    try {
      const result = await firstValueFrom(this.firebaseService.guardarPlan(nuevoPlan));
      const realId = result.id;
      this.planId = realId;

      // Actualizar IDs de secciones con planId real
      this.secciones.forEach((seccion, index) => {
        seccion.id = this.generarIdSeccion(this.planId, index);
      });

      // Guardar nuevamente con IDs de secciones bien formados
      await firstValueFrom(
        this.firebaseService.guardarPlan({
          ...nuevoPlan,
          id: this.planId,
          secciones: this.secciones.map((seccion) => ({
            ...seccion,
            imagenUrl: seccion.imagenPreview || '',
          })),
        }),
      );

      // console.log('✅ Plan creado correctamente con ID:', this.planId);
      return this.planId;
    } catch (error) {
      console.error('❌ Error creando plan:', error);
      throw error;
    }
  }

  guardarSeccion(index: number): void {
    this.secciones[index].fechaActualizacion = new Date();

    const planActualizado: PlanNegocio = {
      id: this.planId,
      usuarioId: this.usuarioId,
      planLogicoId: this.planLogicoId,
      nombre: this.nombrePlan,
      secciones: this.secciones,
      fechaActualizacion: new Date(),
    };

    this.firebaseService.guardarPlan(planActualizado).subscribe({
      next: () => {
        this.mensajeGuardado = 'Sección guardada correctamente';
        this.guardandoSeccion = false;
        setTimeout(() => (this.mensajeGuardado = ''), 3000);
      },
      error: (error) => {
        console.error('Error al guardar sección:', error);
        this.guardandoSeccion = false;
      },
    });
  }

  private generarIdSeccion(planId: string, index: number): string {
    return `${planId}-sec-${index}-${Date.now()}`;
  }

  agregarSeccion(): void {
    const nuevaSeccion: SeccionData = {
      titulo: '',
      instruccion: '',
      descripcion: '',
      subsecciones: [],
      fechaCreacion: new Date(),
    };

    this.secciones.push(nuevaSeccion);
    const newIndex = this.secciones.length - 1;
    // Iniciar edición del título automáticamente
    setTimeout(() => {
      this.editandoTitulo = newIndex;
    }, 100);
    this.guardarSeccion(newIndex);
  }

  /**
   * "Análisis económico y Financiero" no se puede eliminar: es la sección donde
   * se cargan solas las tablas y gráficas del plan.
   */
  permiteEliminarSeccion(seccion: SeccionData): boolean {
    return !this.esSeccionEconomica(seccion);
  }

  // ============================================================
  //  SECCIONES PROPIAS Y SUS ETIQUETAS
  // ============================================================

  /** Sección creada por el usuario (no es una de las precargadas con instrucciones). */
  esSeccionPropia(seccion: SeccionData): boolean {
    return esSeccionPropiaUtil(seccion);
  }

  /**
   * ¿Se muestra el cuadro de texto general de la sección? Solo en secciones
   * propias sin etiquetas (o con texto ya escrito, para no esconderlo). En las
   * precargadas el campo "Descripción General" ya no se usa.
   */
  usaTextoGeneral(seccion: SeccionData): boolean {
    return usaTextoGeneralUtil(seccion);
  }

  /** Agrega una etiqueta nueva (con su campo de texto) a una sección propia. */
  agregarEtiqueta(seccionIndex: number): void {
    const seccion = this.secciones[seccionIndex];
    if (!seccion || !this.esSeccionPropia(seccion)) return;
    seccion.subsecciones = seccion.subsecciones || [];
    seccion.subsecciones.push({ pregunta: '', descripcion: '' });
    const j = seccion.subsecciones.length - 1;
    setTimeout(() => (document.getElementById(`etiqueta-${seccionIndex}-${j}`) as HTMLInputElement | null)?.focus(), 50);
    this.guardarSeccion(seccionIndex);
  }

  /** Al salir del nombre de una etiqueta: si quedó vacío se le pone uno por defecto. */
  finalizarEtiqueta(seccionIndex: number, subIndex: number): void {
    const sub = this.secciones[seccionIndex]?.subsecciones?.[subIndex];
    if (!sub) return;
    if (!sub.pregunta || sub.pregunta.trim() === '') {
      sub.pregunta = 'Nueva etiqueta';
    }
    this.guardarSeccion(seccionIndex);
  }

  /** Borra de Firebase Storage las imágenes indicadas (no deja archivos huérfanos). */
  private borrarImagenesDeStorage(imagenes: ImagenSeccion[] | undefined): void {
    for (const img of imagenes ?? []) {
      if (img?.url) this.firebaseService.eliminarImagen(img.url).subscribe();
    }
  }

  // Confirmación antes de eliminar una sección o una etiqueta
  eliminacionPendiente: { si: number; sj: number | null } | null = null;

  get tituloEliminacion(): string {
    const e = this.eliminacionPendiente;
    if (!e) return '';
    const seccion = this.secciones[e.si];
    const texto = e.sj === null ? seccion?.titulo : seccion?.subsecciones?.[e.sj]?.pregunta;
    return (texto || '').trim() || 'Sin título';
  }

  get esEliminacionDeEtiqueta(): boolean {
    return this.eliminacionPendiente?.sj != null;
  }

  pedirConfirmacionEliminar(index: number): void {
    const seccion = this.secciones[index];
    if (!seccion || !this.permiteEliminarSeccion(seccion)) return;
    this.eliminacionPendiente = { si: index, sj: null };
  }

  pedirConfirmacionEliminarEtiqueta(si: number, sj: number): void {
    const seccion = this.secciones[si];
    const sub = seccion?.subsecciones?.[sj];
    if (!seccion || !sub || !this.esSeccionPropia(seccion)) return;
    // Una etiqueta vacía (sin texto ni imágenes) se quita directo; si tiene contenido, se pregunta.
    if (!sub.descripcion?.trim() && !(sub.imagenes?.length)) {
      this.eliminarEtiqueta(si, sj);
      return;
    }
    this.eliminacionPendiente = { si, sj };
  }

  cancelarEliminacion(): void {
    this.eliminacionPendiente = null;
  }

  confirmarEliminacion(): void {
    const e = this.eliminacionPendiente;
    this.eliminacionPendiente = null;
    if (!e) return;
    if (e.sj === null) this.eliminarSeccion(e.si);
    else this.eliminarEtiqueta(e.si, e.sj);
  }

  eliminarEtiqueta(seccionIndex: number, subIndex: number): void {
    const seccion = this.secciones[seccionIndex];
    if (!seccion || !this.esSeccionPropia(seccion) || !seccion.subsecciones?.[subIndex]) return;
    const [quitada] = seccion.subsecciones.splice(subIndex, 1);
    this.borrarImagenesDeStorage(quitada?.imagenes);
    this.guardarSeccion(seccionIndex);
  }

  eliminarSeccion(index: number): void {
    const seccion = this.secciones[index];
    if (!seccion || !this.permiteEliminarSeccion(seccion)) return;
    const [quitada] = this.secciones.splice(index, 1); // quitar del array
    this.borrarImagenesDeStorage(quitada?.imagenes);
    quitada?.subsecciones?.forEach((sub) => this.borrarImagenesDeStorage(sub.imagenes));

    const planActualizado: PlanNegocio = {
      id: this.planId,
      usuarioId: this.usuarioId,
      nombre: this.nombrePlan, // Preservar nombre original
      secciones: this.secciones,
      fechaActualizacion: new Date(),
    };

    this.firebaseService.guardarPlan(planActualizado).subscribe({
      next: () => {
        this.mensajeGuardado = 'Sección guardada correctamente ';
        this.guardandoSeccion = false;
        setTimeout(() => (this.mensajeGuardado = ''), 3000);
      },
      error: (error) => {
        console.error('Error al guardar sección:', error);
        this.guardandoSeccion = false;
      },
    });
  }

  // ============================================================
  //  IMÁGENES (por pregunta; por sección solo donde no hay preguntas)
  // ============================================================

  /**
   * Las imágenes se suben por cada pregunta, en todas las secciones menos
   * "Análisis económico y Financiero" (que se resolverá aparte) y las
   * secciones propias sin preguntas, que conservan la subida a nivel sección.
   */
  permiteImagenPorPregunta(seccion: SeccionData): boolean {
    return !this.esSeccionEconomica(seccion) && (seccion.subsecciones?.length ?? 0) > 0;
  }

  /** Minúsculas y sin acentos, para comparar nombres de preguntas. */
  private normalizarTexto(texto: unknown): string {
    return normalizarTextoUtil(texto);
  }

  /** Se reconoce por su clave guardada, no por el título (que el usuario puede cambiar o repetir). */
  esSeccionEconomica(seccion: SeccionData): boolean {
    return esSeccionEconomicaUtil(seccion);
  }

  /** Lista de imágenes de una pregunta (subIndex) o de la sección (subIndex null). */
  private listaImagenes(seccionIndex: number, subIndex: number | null): ImagenSeccion[] {
    const seccion = this.secciones[seccionIndex];
    if (subIndex === null) {
      return (seccion.imagenes ??= []);
    }
    return (seccion.subsecciones[subIndex].imagenes ??= []);
  }

  onImagenSeleccionada(event: any, seccionIndex: number, subIndex: number | null): void {
    const file: File | undefined = event.target.files?.[0];
    event.target.value = '';
    if (!file || !this.planId) return;
    this.abrirPopupImagen({ modo: 'nueva', seccionIndex, subIndex, archivo: file });
  }

  reemplazarImagen(event: any, seccionIndex: number, subIndex: number | null, imgIndex: number): void {
    const file: File | undefined = event.target.files?.[0];
    event.target.value = '';
    if (!file || !this.planId) return;
    const actual = this.listaImagenes(seccionIndex, subIndex)[imgIndex];
    this.abrirPopupImagen({
      modo: 'reemplazar',
      seccionIndex,
      subIndex,
      imgIndex,
      archivo: file,
      descripcion: actual?.descripcion,
      fuente: actual?.fuente,
    });
  }

  editarDatosImagen(seccionIndex: number, subIndex: number | null, imgIndex: number): void {
    const actual = this.listaImagenes(seccionIndex, subIndex)[imgIndex];
    if (!actual) return;
    this.abrirPopupImagen({
      modo: 'editar',
      seccionIndex,
      subIndex,
      imgIndex,
      descripcion: actual.descripcion,
      fuente: actual.fuente,
      previewUrl: actual.url,
    });
  }

  eliminarImagen(seccionIndex: number, subIndex: number | null, imgIndex: number): void {
    const [removida] = this.listaImagenes(seccionIndex, subIndex).splice(imgIndex, 1);
    if (removida?.url) {
      this.firebaseService.eliminarImagen(removida.url).subscribe();
    }
    this.guardarSeccion(seccionIndex);
  }

  private abrirPopupImagen(datos: {
    modo: 'nueva' | 'reemplazar' | 'editar';
    seccionIndex: number;
    subIndex: number | null;
    imgIndex?: number;
    archivo?: File;
    descripcion?: string;
    fuente?: string;
    previewUrl?: string;
  }): void {
    this.liberarPreviewPopup();
    this.popupImagen = {
      visible: true,
      modo: datos.modo,
      seccionIndex: datos.seccionIndex,
      subIndex: datos.subIndex,
      imgIndex: datos.imgIndex ?? null,
      archivo: datos.archivo ?? null,
      previewUrl: datos.archivo ? URL.createObjectURL(datos.archivo) : datos.previewUrl || '',
      descripcion: datos.descripcion || '',
      fuente: datos.fuente || '',
      subiendo: false,
      error: '',
    };
  }

  cancelarPopupImagen(): void {
    if (this.popupImagen.subiendo) return;
    this.cerrarPopupImagen();
  }

  private cerrarPopupImagen(): void {
    this.liberarPreviewPopup();
    this.popupImagen = PopupImagen.cerrado();
  }

  private liberarPreviewPopup(): void {
    if (this.popupImagen.archivo && this.popupImagen.previewUrl) {
      URL.revokeObjectURL(this.popupImagen.previewUrl);
    }
  }

  usarElaboracionPropia(): void {
    this.popupImagen.fuente = 'Elaboración propia';
  }

  async confirmarPopupImagen(): Promise<void> {
    const p = this.popupImagen;
    if (!p.visible || p.subiendo) return;

    const descripcion = p.descripcion.trim();
    const fuente = p.fuente.trim();
    if (!descripcion || !fuente) {
      p.error = 'Completa la descripción y la fuente de la imagen.';
      return;
    }

    const lista = this.listaImagenes(p.seccionIndex, p.subIndex);

    if (p.modo === 'editar') {
      const img = lista[p.imgIndex!];
      if (img) {
        img.descripcion = descripcion;
        img.fuente = fuente;
      }
      this.cerrarPopupImagen();
      this.guardarSeccion(p.seccionIndex);
      return;
    }

    const seccion = this.secciones[p.seccionIndex];
    const idBase = seccion.id || `temp-${Date.now()}`;
    const contenedorId = p.subIndex === null ? idBase : `${idBase}-p${p.subIndex}`;

    p.subiendo = true;
    p.error = '';
    try {
      const url = await firstValueFrom(
        this.firebaseService.subirImagen(p.archivo!, contenedorId, this.planId),
      );
      const nueva: ImagenSeccion = { url, nombre: p.archivo!.name, descripcion, fuente };
      if (p.modo === 'nueva') {
        lista.push(nueva);
      } else {
        const anterior = lista[p.imgIndex!];
        lista[p.imgIndex!] = nueva;
        if (anterior?.url) {
          this.firebaseService.eliminarImagen(anterior.url).subscribe();
        }
      }
      this.cerrarPopupImagen();
      this.guardarSeccion(p.seccionIndex);
    } catch (error) {
      console.error('Error al subir imagen:', error);
      p.error = 'No se pudo subir la imagen. Intenta de nuevo.';
      p.subiendo = false;
    }
  }

  onSeccionChange(index: number) {
    // Guardar automáticamente después de 2 segundos de inactividad
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      if (this.planId) {
        this.guardarSeccion(index);
      }
    }, 2000);
  }

  private autoSaveTimeout: any;

  // Drag and Drop
  onDrop(event: CdkDragDrop<SeccionData[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.secciones, event.previousIndex, event.currentIndex);
      this.guardarTodasLasSecciones();
    }
  }

  guardarTodasLasSecciones(): void {
    const planActualizado: PlanNegocio = {
      id: this.planId,
      usuarioId: this.usuarioId,
      planLogicoId: this.planLogicoId,
      nombre: this.nombrePlan,
      secciones: this.secciones,
      fechaActualizacion: new Date(),
    };

    this.firebaseService.guardarPlan(planActualizado).subscribe({
      next: () => {
        this.mensajeGuardado = 'Orden actualizado';
        setTimeout(() => (this.mensajeGuardado = ''), 2000);
      },
      error: (error) => {
        console.error('Error al guardar orden:', error);
      },
    });
  }

  // Edición de título
  iniciarEdicionTitulo(index: number): void {
    this.editandoTitulo = index;
  }

  finalizarEdicionTitulo(index: number): void {
    this.editandoTitulo = null;
    if (this.secciones[index].titulo.trim() === '') {
      this.secciones[index].titulo = 'Sin título';
    }
    this.guardarSeccion(index);
  }

  onTituloKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finalizarEdicionTitulo(index);
    }
  }

  // Verifica si es una sección precargada (con instrucciones del sistema)
  esSeccionPrecargada(seccion: SeccionData): boolean {
    const titulosPrecargados = [
      'Resumen Ejecutivo',
      'Presentación del Proyecto: Origen y Evolución',
      'Estudio de Mercado',
      'Estrategia Comercial',
      'Producción y Recursos Humanos',
      'Análisis económico y Financiero',
      'Análisis DAFO',
    ];
    return titulosPrecargados.includes(seccion.titulo) && !!seccion.instruccion;
  }

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
              '¿Cuál es tu estrategia de calidad? ¿En qué nivel de calidad/ precio te quieres posicionar?',
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
        clave: CLAVE_SECCION_ECONOMICA,
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
            pregunta: 'Estado de resultados',
            descripcion: '',
          },
          {
            pregunta: 'Flujo de efectivo',
            descripcion: '',
          },
          {
            pregunta: 'Evaluación Financiera',
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

  async exportarPDF() {
    this.loadingPDF = true;
    try {
      const generador = new GeneradorPdfPlanificacion(
        {
          nombrePlan: this.nombrePlan,
          periodoPortada: this.periodoPortada,
          logoPortadaUrl: this.logoPortadaUrl,
          secciones: this.secciones,
          planLogicoId: this.planLogicoId,
        },
        this.resumenService,
        this.anexosService,
      );
      const pdf = await generador.generar();
      pdf.save(nombreArchivoPdf(this.nombrePlan));
    } catch (err) {
      console.error('Error exportando PDF:', err);
    } finally {
      this.loadingPDF = false;
    }
  }

}
