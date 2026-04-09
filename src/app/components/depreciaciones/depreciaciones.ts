import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { InversionService } from '../../core/services/inversion.service';
import { DatosStateService } from '../../core/services/datos-state.service';
import { DepreciacionAnual } from '../../interfaces/depreciacion.interface';

interface SeccionGrupo {
  seccion: string;
  items: DepreciacionAnual[];
}

interface TipoGrupo {
  tipoId: number;
  tipoNombre: string;
  secciones: SeccionGrupo[];
}

@Component({
  selector: 'app-depreciaciones',
  standalone: false,
  templateUrl: './depreciaciones.html',
  styleUrl: './depreciaciones.css'
})
export class Depreciaciones implements OnInit, OnDestroy {
  planId: number = 0;
  depreciaciones: DepreciacionAnual[] = [];
  depreciacionesAgrupadas: TipoGrupo[] = [];
  vidaUtilModificada: Set<number> = new Set(); // Tracking de detalles modificados
  cargando: boolean = false;
  guardando: boolean = false;
  mensajeGuardado: string = '';
  isSidebarCollapsed = false;
  
  private subscriptions: Subscription[] = [];
  
  // Mapeo de tipos
  private tiposNombres: { [key: number]: string } = {
    1: 'Activos',
    2: 'Gastos Preoperativos y de Constitución',
    3: 'Capital de Trabajo Inicial'
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Depreciaciones:', this.planId);
      if (this.planId) {
        this.cargarDepreciaciones();
        this.suscribirADepreciaciones();
      }
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripciones para evitar memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Suscribirse al estado de depreciaciones para recibir actualizaciones automáticas
   */
  suscribirADepreciaciones(): void {
    const depreciacionesSub = this.datosStateService.depreciaciones$.subscribe(depreciaciones => {
      if (depreciaciones && depreciaciones.length > 0) {
        console.log('Depreciaciones actualizadas desde el state:', depreciaciones);
        this.depreciaciones = depreciaciones;
        this.agruparPorSeccion();
      }
    });
    this.subscriptions.push(depreciacionesSub);
  }

  cargarDepreciaciones(): void {
    this.cargando = true;
    this.inversionService
      .getDepreciacionAnual(this.planId)
      .then((response) => {
        console.log('Depreciaciones cargadas desde backend:', response);
        
        // El backend devuelve un array directamente
        const depreciaciones = Array.isArray(response) ? response : [response];
        
        // Actualizar el estado
        this.datosStateService.setDepreciaciones(depreciaciones);
        
        console.log('Total de depreciaciones:', depreciaciones.length);
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar depreciaciones:', error);
        this.depreciaciones = [];
        this.depreciacionesAgrupadas = [];
        this.cargando = false;
      });
  }

  /**
   * Agrupa las depreciaciones primero por tipo y luego por sección de inversión
   */
  agruparPorSeccion(): void {
    const tiposMap = new Map<number, Map<string, DepreciacionAnual[]>>();
    
    // Agrupar primero por tipo, luego por sección
    for (const dep of this.depreciaciones) {
      const tipoId = dep.detalle_inversion?.inversion?.tipo_id || 0;
      const seccion = dep.detalle_inversion?.inversion?.seccion || 'Sin Sección';
      
      // Si no existe el tipo, crear un nuevo Map para sus secciones
      if (!tiposMap.has(tipoId)) {
        tiposMap.set(tipoId, new Map<string, DepreciacionAnual[]>());
      }
      
      const seccionesMap = tiposMap.get(tipoId)!;
      
      // Si no existe la sección dentro del tipo, crear array
      if (!seccionesMap.has(seccion)) {
        seccionesMap.set(seccion, []);
      }
      
      seccionesMap.get(seccion)!.push(dep);
    }
    
    // Convertir a array de TipoGrupo
    this.depreciacionesAgrupadas = Array.from(tiposMap.entries())
      .map(([tipoId, seccionesMap]) => ({
        tipoId,
        tipoNombre: this.tiposNombres[tipoId] || `Tipo ${tipoId}`,
        secciones: Array.from(seccionesMap.entries()).map(([seccion, items]) => ({
          seccion,
          items
        }))
      }))
      .sort((a, b) => a.tipoId - b.tipoId); // Ordenar por tipo_id
    
    console.log('Depreciaciones agrupadas por tipo y sección:', this.depreciacionesAgrupadas);
  }

  onVidaUtilChange(detalleId: number): void {
    console.log('Vida útil modificada para detalle:', detalleId);
    this.vidaUtilModificada.add(detalleId);
  }

  hayVidaUtilModificada(): boolean {
    return this.vidaUtilModificada.size > 0;
  }

  guardarVidaUtil(): void {
    if (this.vidaUtilModificada.size === 0) {
      console.log('No hay cambios para guardar');
      return;
    }

    this.guardando = true;
    console.log('Guardando vida útil para detalles:', Array.from(this.vidaUtilModificada));

    // Convertir Set a Array para trabajar con índices
    const detallesModificados = Array.from(this.vidaUtilModificada);
    const totalDetalles = detallesModificados.length;

    // Crear array de promesas, solo el último tendrá recalc: true
    const promesas = detallesModificados.map((detalleId, index) => {
      // Encontrar la depreciación correspondiente
      const depreciacion = this.depreciaciones.find(
        (d) => d.detalle_inversion?.id === detalleId
      );

      if (!depreciacion || !depreciacion.detalle_inversion) {
        console.error('No se encontró la depreciación o detalle para ID:', detalleId);
        return Promise.resolve();
      }

      const vidaUtil = depreciacion.detalle_inversion.vida_util;
      const esUltimo = index === totalDetalles - 1;
      
      console.log(`Actualizando detalle ${detalleId} (${index + 1}/${totalDetalles}) con vida_util: ${vidaUtil}, recalc: ${esUltimo}`);

      // Solo el último detalle dispara el recalc
      return this.inversionService.actualizarDetalleInversion(detalleId, {
        vida_util: vidaUtil,
        recalc: esUltimo // Solo true en el último
      });
    });

    // Ejecutar todas las actualizaciones de forma secuencial
    Promise.all(promesas)
      .then(() => {
        console.log('Todas las vidas útiles guardadas exitosamente');
        this.guardando = false;
        this.vidaUtilModificada.clear();
        
        // Mostrar mensaje de éxito
        this.mensajeGuardado = 'Cambios guardados correctamente';
        setTimeout(() => {
          this.mensajeGuardado = '';
        }, 3000);
        
        // Recargar datos para reflejar cálculos del backend
        // Esto actualizará el state y todos los componentes suscritos
        this.cargarDepreciaciones();
      })
      .catch((error) => {
        console.error('Error al guardar vidas útiles:', error);
        this.guardando = false;
        this.mensajeGuardado = 'Error al guardar los cambios';
        setTimeout(() => {
          this.mensajeGuardado = '';
        }, 3000);
      });
  }

  getElementoNombre(depreciacion: DepreciacionAnual): string {
    return depreciacion.detalle_inversion?.elemento || 'N/A';
  }

  getSeccion(depreciacion: DepreciacionAnual): string {
    return depreciacion.detalle_inversion?.inversion?.seccion || 'N/A';
  }

  getElemento(depreciacion: DepreciacionAnual): string {
    return depreciacion.detalle_inversion?.elemento || 'N/A';
  }

  getImporte(depreciacion: DepreciacionAnual): number {
    return depreciacion.detalle_inversion?.importe || 0;
  }

  getVidaUtil(depreciacion: DepreciacionAnual): number {
    return depreciacion.detalle_inversion?.vida_util || 0;
  }

  setVidaUtil(depreciacion: DepreciacionAnual, value: number): void {
    if (depreciacion.detalle_inversion) {
      depreciacion.detalle_inversion.vida_util = value;
    }
  }

  getDetalleId(depreciacion: DepreciacionAnual): number | undefined {
    return depreciacion.detalle_inversion?.id;
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
