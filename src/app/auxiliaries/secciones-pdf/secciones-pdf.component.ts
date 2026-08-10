import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import jsPDF from 'jspdf';
import { FirebaseService, SeccionData, PlanNegocio } from '../../core/services/firebase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Paleta institucional (misma que usa el resto de la app: header, sidebar, login).
const COLOR_PRIMARIO: [number, number, number] = [0, 66, 113]; // #004271
const COLOR_PRIMARIO_OSCURO: [number, number, number] = [0, 49, 85]; // #003155
const COLOR_CLARO: [number, number, number] = [216, 220, 230]; // #d8dce6
const COLOR_GRIS_AZUL: [number, number, number] = [177, 187, 206]; // #B1BBCE

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

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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
                  this.secciones = this.normalizarSecciones(plan.secciones);
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
        titulo: seccion.titulo,
        instruccion: seccion.instruccion,
        descripcion: seccion.descripcion,
        subsecciones: seccion.subsecciones.map((sub) => ({
          pregunta: sub.pregunta,
          descripcion: sub.descripcion,
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

  eliminarSeccion(index: number): void {
    this.secciones.splice(index, 1); // quitar del array

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

  onImagenSeleccionada(event: any, index: number): void {
    const files: FileList = event.target.files;
    const seccion = this.secciones[index];
    if (!files || files.length === 0 || !seccion || !this.planId) return;

    if (!seccion.imagenes) {
      seccion.imagenes = [];
    }

    const seccionId = seccion.id || `temp-${Date.now()}`;
    const subidas = Array.from(files).map((file) =>
      firstValueFrom(this.firebaseService.subirImagen(file, seccionId, this.planId))
        .then((url) => ({ url, nombre: file.name }))
        .catch((error) => {
          console.error('Error al subir imagen:', error);
          return null;
        }),
    );

    Promise.all(subidas).then((resultados) => {
      for (const resultado of resultados) {
        if (resultado) {
          seccion.imagenes!.push(resultado);
        }
      }
      event.target.value = '';
      this.guardarSeccion(index);
    });
  }

  reemplazarImagenSeccion(event: any, seccionIndex: number, imgIndex: number): void {
    const file: File = event.target.files[0];
    const seccion = this.secciones[seccionIndex];
    if (!file || !seccion || !seccion.imagenes || !this.planId) return;

    const anterior = seccion.imagenes[imgIndex];
    const seccionId = seccion.id || `temp-${Date.now()}`;

    this.firebaseService.subirImagen(file, seccionId, this.planId).subscribe({
      next: (url) => {
        seccion.imagenes![imgIndex] = { url, nombre: file.name };
        if (anterior?.url) {
          this.firebaseService.eliminarImagen(anterior.url).subscribe();
        }
        event.target.value = '';
        this.guardarSeccion(seccionIndex);
      },
      error: (error) => {
        console.error('Error al reemplazar imagen:', error);
      },
    });
  }

  eliminarImagenDeSeccion(seccionIndex: number, imgIndex: number): void {
    const seccion = this.secciones[seccionIndex];
    if (!seccion?.imagenes) return;

    const [removida] = seccion.imagenes.splice(imgIndex, 1);
    if (removida?.url) {
      this.firebaseService.eliminarImagen(removida.url).subscribe();
    }
    this.guardarSeccion(seccionIndex);
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

  async exportarPDF() {
    this.loadingPDF = true;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 16;
      const footerHeight = 14;
      const contentTop = headerHeight + 10;
      const contentBottom = pageHeight - footerHeight;
      const lineHeight = 6.5;
      const maxTextWidth = pageWidth - margin * 2;
      let y = contentTop;

      this.dibujarPortada(pdf, pageWidth, pageHeight);
      pdf.addPage();
      y = contentTop;

      // Función PURA: no muta nada por fuera, devuelve la Y que corresponde
      // usar a partir de ahora (la misma si cabe, o el tope de una página
      // nueva si no). Todo el código de abajo reasigna "y = checkPageBreak(...)"
      // — así, cualquier función auxiliar (como dibujarImagenesSeccion, que
      // lleva su propia variable local "y") se entera de inmediato si hubo
      // salto de página, en vez de seguir dibujando en una posición vieja.
      const checkPageBreak = (yActual: number, requiredSpace: number = 20): number => {
        if (yActual + requiredSpace > contentBottom) {
          pdf.addPage();
          return contentTop;
        }
        return yActual;
      };

      for (const [idx, seccion] of this.secciones.entries()) {
        // Saltar secciones sin título
        if (!seccion.titulo || seccion.titulo.trim() === '') continue;

        y = checkPageBreak(y, 20);

        // Banda de título de sección. El tamaño/peso de letra debe fijarse
        // ANTES de splitTextToSize: esa función mide con la fuente activa en
        // ese momento, así que si se mide con la de la sección anterior (más
        // chica) el texto calza mal en la banda y se sale al dibujarlo grande.
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        const tituloLines = pdf.splitTextToSize(seccion.titulo, maxTextWidth - 6);
        const bandaAltura = tituloLines.length * 6 + 6;
        y = checkPageBreak(y, bandaAltura + 10);
        pdf.setFillColor(...COLOR_PRIMARIO);
        pdf.rect(margin, y, maxTextWidth, bandaAltura, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(tituloLines, margin + 4, y + 6.5);
        pdf.setFont('helvetica', 'normal');
        y += bandaAltura + 6;

        // NO incluir instrucción de secciones precargadas en el PDF

        // Subsecciones
        for (const sub of seccion.subsecciones) {
          pdf.setFontSize(11.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_PRIMARIO_OSCURO);
          const preguntaLines = pdf.splitTextToSize(sub.pregunta, maxTextWidth);
          y = checkPageBreak(y, preguntaLines.length * lineHeight + 10);
          pdf.text(preguntaLines, margin, y);
          y += preguntaLines.length * lineHeight + 1.5;
          pdf.setFont('helvetica', 'normal');

          if (sub.descripcion && sub.descripcion.trim() !== '') {
            pdf.setFontSize(10.5);
            pdf.setTextColor(60, 60, 60);
            const descLines = pdf.splitTextToSize(sub.descripcion, maxTextWidth - 6);
            y = checkPageBreak(y, descLines.length * lineHeight + 5);
            pdf.text(descLines, margin + 4, y);
            y += descLines.length * lineHeight + 4;
          }
        }

        // Descripción general
        if (
          seccion.titulo !== 'Análisis DAFO' &&
          seccion.descripcion &&
          seccion.descripcion.trim() !== ''
        ) {
          y = checkPageBreak(y, lineHeight + 15);
          pdf.setFontSize(11.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLOR_PRIMARIO_OSCURO);
          pdf.text('Descripción General', margin, y);
          y += lineHeight + 1.5;
          pdf.setFont('helvetica', 'normal');

          pdf.setFontSize(10.5);
          pdf.setTextColor(60, 60, 60);
          const descLines = pdf.splitTextToSize(seccion.descripcion, maxTextWidth - 6);
          y = checkPageBreak(y, descLines.length * lineHeight + 5);
          pdf.text(descLines, margin + 4, y);
          y += descLines.length * lineHeight + 5;
        }

        // Imágenes: proporción real (sin deformar), en cuadrícula de 2
        // columnas cuando hay más de una.
        const imagenes = seccion.imagenes || [];
        if (imagenes.length > 0) {
          y = await this.dibujarImagenesSeccion(pdf, imagenes, margin, y, maxTextWidth, checkPageBreak);
        }

        // Espacio entre secciones
        if (idx < this.secciones.length - 1) {
          y += 10;
          y = checkPageBreak(y, 20);
        }
      }

      this.dibujarEncabezadoPie(pdf, pageWidth, pageHeight, margin, headerHeight, footerHeight);

      pdf.save(`${(this.nombrePlan || 'plan').replace(/[^\w\-]+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error exportando PDF:', err);
    } finally {
      this.loadingPDF = false;
    }
  }

  /**
   * Portada institucional: banda superior con el nombre de la universidad,
   * título del plan centrado y fecha de generación. Página 1, separada del
   * contenido (que arranca en la página 2 con su propio encabezado/pie).
   */
  private dibujarPortada(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
    pdf.setFillColor(...COLOR_PRIMARIO);
    pdf.rect(0, 0, pageWidth, 55, 'F');
    pdf.setFillColor(...COLOR_PRIMARIO_OSCURO);
    pdf.rect(0, 50, pageWidth, 5, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('UNIVERSIDAD TÉCNICA PARTICULAR DE LOJA', pageWidth / 2, 24, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Colaborador Interactivo de Planes de Negocio', pageWidth / 2, 34, { align: 'center' });

    pdf.setTextColor(...COLOR_PRIMARIO_OSCURO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    const tituloLines = pdf.splitTextToSize(this.nombrePlan || 'Plan de Negocio', pageWidth - 50);
    pdf.text(tituloLines, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

    pdf.setDrawColor(...COLOR_GRIS_AZUL);
    pdf.setLineWidth(0.5);
    pdf.line(pageWidth / 2 - 30, pageHeight / 2 + 5, pageWidth / 2 + 30, pageHeight / 2 + 5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(90, 90, 90);
    pdf.text('Plan de Negocio', pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });

    const fecha = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.setFontSize(10);
    pdf.text(`Generado el ${fecha}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  }

  /**
   * Encabezado y pie de página institucionales en todas las páginas de
   * contenido (todas menos la portada, página 1). Se dibuja al final, cuando
   * ya se conoce el total de páginas, para poder mostrar "Página X de Y".
   */
  private dibujarEncabezadoPie(pdf: jsPDF, pageWidth: number, pageHeight: number, margin: number, headerHeight: number, footerHeight: number): void {
    const totalPaginas = pdf.getNumberOfPages();
    for (let i = 2; i <= totalPaginas; i++) {
      pdf.setPage(i);

      pdf.setFillColor(...COLOR_PRIMARIO);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('UTPL', margin, headerHeight / 2 + 2.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const tituloCorto = pdf.splitTextToSize(this.nombrePlan || 'Plan de Negocio', pageWidth - margin * 2 - 20)[0] || '';
      pdf.text(tituloCorto, pageWidth - margin, headerHeight / 2 + 2.5, { align: 'right' });

      pdf.setDrawColor(...COLOR_GRIS_AZUL);
      pdf.setLineWidth(0.3);
      pdf.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
      pdf.setTextColor(120, 120, 120);
      pdf.setFontSize(8.5);
      pdf.text(`Página ${i - 1} de ${totalPaginas - 1}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }
  }

  /**
   * Dibuja las imágenes de una sección en cuadrícula (2 columnas si hay más
   * de una), respetando la proporción real de cada imagen para que no salga
   * estirada ni aplastada. Devuelve la nueva posición Y.
   */
  private async dibujarImagenesSeccion(
    pdf: jsPDF,
    imagenes: { url: string; nombre?: string }[],
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
  ): Promise<number> {
    let y = yInicial;
    const gap = 4;
    const columnas = imagenes.length > 1 ? 2 : 1;
    const anchoColumna = (anchoDisponible - gap * (columnas - 1)) / columnas;
    const alturaMaxima = 70;

    for (let i = 0; i < imagenes.length; i += columnas) {
      const fila = imagenes.slice(i, i + columnas);
      const dimensiones = await Promise.all(
        fila.map(async (img) => {
          try {
            const base64 = await this.convertirImagenUrlABase64(img.url);
            const { width, height } = await this.obtenerDimensionesImagen(base64);
            let w = anchoColumna;
            let h = (height / width) * w;
            if (h > alturaMaxima) {
              h = alturaMaxima;
              w = (width / height) * h;
            }
            return { base64, w, h, formato: this.formatoImagen(base64) };
          } catch (error) {
            console.warn('Error al convertir o agregar imagen:', error);
            return null;
          }
        }),
      );

      const alturaFila = Math.max(0, ...dimensiones.map((d) => d?.h ?? 0));
      if (alturaFila === 0) continue;
      // Reasignar "y" con lo que devuelva checkPageBreak: si esta fila no
      // cabe, ya movió el cursor a la página nueva y hay que dibujar ahí,
      // no en la posición vieja (esto era justo el bug: antes se ignoraba
      // el resultado y las imágenes seguían cayendo al fondo de la página).
      y = checkPageBreak(y, alturaFila + gap);

      let x = margin;
      for (const d of dimensiones) {
        if (d) {
          // centrado horizontal dentro de su columna
          const offsetX = x + (anchoColumna - d.w) / 2;
          pdf.addImage(d.base64, d.formato, offsetX, y, d.w, d.h, undefined, 'FAST');
        }
        x += anchoColumna + gap;
      }
      y += alturaFila + gap;
    }

    return y + 4;
  }

  /** Formato real de una imagen a partir de su data URL (para addImage). */
  private formatoImagen(base64: string): 'PNG' | 'JPEG' | 'WEBP' {
    const match = /^data:image\/(png|jpe?g|webp)/i.exec(base64);
    const tipo = match?.[1]?.toLowerCase();
    if (tipo === 'png') return 'PNG';
    if (tipo === 'webp') return 'WEBP';
    return 'JPEG';
  }

  /** Dimensiones reales (px) de una imagen a partir de su data URL. */
  private obtenerDimensionesImagen(base64: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      img.onerror = reject;
      img.src = base64;
    });
  }

  private normalizarSecciones(seccionesData: any): SeccionData[] {
    const raw = Array.isArray(seccionesData)
      ? seccionesData
      : typeof seccionesData === 'object' && seccionesData !== null
        ? Object.values(seccionesData)
        : [];

    return raw.map((seccion: any) => {
      // Migrar el campo antiguo de una sola imagen al arreglo nuevo
      const imagenes = Array.isArray(seccion.imagenes)
        ? seccion.imagenes
        : seccion.imagenUrl
          ? [{ url: seccion.imagenUrl, nombre: seccion.imagenNombre }]
          : [];

      return {
        ...seccion,
        subsecciones: Array.isArray(seccion.subsecciones) ? seccion.subsecciones : [],
        imagenes,
        fechaCreacion: seccion.fechaCreacion || new Date(),
        fechaActualizacion: seccion.fechaActualizacion || new Date(),
      };
    });
  }

  private async convertirImagenUrlABase64(url: string): Promise<string> {
    // 'no-store' evita reutilizar una respuesta "opaca" que el navegador
    // haya cacheado al mostrar esta misma URL en un <img> (modo no-cors),
    // que de reusarse hace fallar este fetch (modo cors) con un falso error
    // de CORS aunque el servidor sí envíe los headers correctos.
    const response = await fetch(url, { cache: 'no-store' });
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
