import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import jsPDF from 'jspdf';
import { FirebaseService, SeccionData, PlanNegocio } from '../../core/services/firebase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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
    const file: File = event.target.files[0];
    if (!file || !this.secciones[index] || !this.planId) return;

    const seccionId = this.secciones[index].id || `temp-${Date.now()}`;
    this.firebaseService.subirImagenAlternativo(file, seccionId, this.planId).subscribe((url) => {
      this.secciones[index].imagenUrl = url;
      this.secciones[index].imagenNombre = file.name;
      this.guardarSeccion(index);
    });
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
      let y = 20;
      const margin = 15;
      const lineHeight = 7;
      const maxImgWidth = pageWidth - margin * 2;
      const maxImgHeight = 80;
      const maxTextWidth = pageWidth - margin * 2;

      const checkPageBreak = (requiredSpace: number = 20) => {
        if (y + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      for (const [idx, seccion] of this.secciones.entries()) {
        // Saltar secciones sin título
        if (!seccion.titulo || seccion.titulo.trim() === '') continue;

        checkPageBreak(30);

        // Título
        pdf.setFontSize(16);
        pdf.setTextColor(0, 66, 113);
        const tituloLines = pdf.splitTextToSize(seccion.titulo, maxTextWidth);
        pdf.text(tituloLines, margin, y);
        y += tituloLines.length * lineHeight + 3;

        // NO incluir instrucción de secciones precargadas en el PDF

        // Subsecciones
        for (const sub of seccion.subsecciones) {
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          const preguntaLines = pdf.splitTextToSize(`• ${sub.pregunta}`, maxTextWidth);
          checkPageBreak(preguntaLines.length * lineHeight + 10);
          pdf.text(preguntaLines, margin, y);
          y += preguntaLines.length * lineHeight + 2;

          if (sub.descripcion && sub.descripcion.trim() !== '') {
            pdf.setFontSize(11);
            pdf.setTextColor(60, 60, 60);
            const descLines = pdf.splitTextToSize(sub.descripcion, maxTextWidth - 10);
            checkPageBreak(descLines.length * lineHeight + 5);
            pdf.text(descLines, margin + 5, y);
            y += descLines.length * lineHeight + 3;
          }
        }

        // Descripción general
        if (
          seccion.titulo !== 'Análisis DAFO' &&
          seccion.descripcion &&
          seccion.descripcion.trim() !== ''
        ) {
          pdf.setFontSize(11);
          pdf.setTextColor(60, 60, 60);
          const descLines = pdf.splitTextToSize(seccion.descripcion, maxTextWidth);
          checkPageBreak(descLines.length * lineHeight + 5);
          pdf.text(descLines, margin, y);
          y += descLines.length * lineHeight + 5;
        }

        // Imagen (convertir url a base64 antes de agregar)
        if (seccion.imagenUrl) {
          try {
            checkPageBreak(maxImgHeight + 10);
            const base64 = await this.convertirImagenUrlABase64(seccion.imagenUrl);

            pdf.addImage(
              base64,
              'JPEG', // o 'PNG', puedes ajustarlo según formato real
              margin,
              y,
              maxImgWidth,
              maxImgHeight,
              undefined,
              'FAST',
            );
            y += maxImgHeight + 10;
          } catch (error) {
            console.warn('Error al convertir o agregar imagen:', error);
          }
        }

        // Espacio entre secciones
        if (idx < this.secciones.length - 1) {
          y += 15;
          checkPageBreak(30);
        }
      }

      pdf.save('plan.pdf');
    } catch (err) {
      console.error('Error exportando PDF:', err);
    } finally {
      this.loadingPDF = false;
    }
  }

  private normalizarSecciones(seccionesData: any): SeccionData[] {
    const raw = Array.isArray(seccionesData)
      ? seccionesData
      : typeof seccionesData === 'object' && seccionesData !== null
        ? Object.values(seccionesData)
        : [];

    return raw.map((seccion: any) => ({
      ...seccion,
      subsecciones: Array.isArray(seccion.subsecciones) ? seccion.subsecciones : [],
      fechaCreacion: seccion.fechaCreacion || new Date(),
      fechaActualizacion: seccion.fechaActualizacion || new Date(),
    }));
  }

  private async convertirImagenUrlABase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
