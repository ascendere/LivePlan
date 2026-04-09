import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InversionService } from '../../core/services';
import { TipoInversion, InversionGeneral, InversionDetalle } from '../../interfaces';

interface TipoConInversiones extends TipoInversion {
  inversiones: InversionGeneral[];
}

@Component({
  selector: 'app-inversion',
  standalone: false,
  templateUrl: './inversion.html',
  styleUrl: './inversion.css'
})
export class Inversion implements OnInit {
  planId: number = 0;
  isLoading: boolean = true;
  isSidebarCollapsed = false;

  // Tipos de inversión con sus inversiones generales y detalles anidados
  tiposInversion: TipoConInversiones[] = [];

  // Set para rastrear importes modificados de detalles
  detallesModificados: Set<number> = new Set();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Inversión:', this.planId);
      this.cargarDatos();
    });
  }

  /**
   * Carga todos los datos necesarios y construye la estructura jerárquica
   */
  async cargarDatos(): Promise<void> {
    this.isLoading = true;
    try {
      // Cargar catálogo de tipos (siempre los mismos 3)
      const tipos = await this.inversionService.getCatalogosSistema();
      console.log('Tipos de inversión:', tipos);

      // Cargar inversiones generales del plan
      const inversionesGenerales = await this.inversionService.getInversionesGenerales(this.planId);
      console.log('Inversiones generales:', inversionesGenerales);

      // Cargar detalles de inversión del plan
      const detalles = await this.inversionService.getDetallesInversion(this.planId);
      console.log('Detalles de inversión:', detalles);

      // Construir estructura jerárquica
      this.construirEstructura(tipos, inversionesGenerales, detalles);

      this.isLoading = false;
    } catch (error) {
      console.error('Error al cargar datos de inversión:', error);
      this.isLoading = false;
    }
  }

  /**
   * Construye la estructura jerárquica: Tipos → Inversiones Generales → Detalles
   */
  private construirEstructura(
    tipos: TipoInversion[],
    inversionesGenerales: InversionGeneral[],
    detalles: InversionDetalle[]
  ): void {
    this.tiposInversion = tipos.map(tipo => {
      // Filtrar inversiones generales de este tipo
      const inversionesDelTipo = inversionesGenerales
        .filter(inv => inv.tipo_id === tipo.id)
        .map(inv => {
          // Filtrar detalles de esta inversión general
          const detallesDeInversion = detalles.filter(det => det.inversion_id === inv.id);
          return {
            ...inv,
            detalles: detallesDeInversion
          };
        });

      return {
        ...tipo,
        inversiones: inversionesDelTipo
      };
    });

    console.log('Estructura construida:', this.tiposInversion);
  }

  /**
   * Agrega una nueva inversión general (sección) a un tipo - Modo Inline
   */
  agregarInversionGeneral(tipo: TipoConInversiones): void {
    // Crear inversión temporal sin ID
    const nuevaInversion: InversionGeneral = {
      plan_negocio_id: this.planId,
      tipo_id: tipo.id,
      seccion: '',
      importe: 0,
      detalles: []
    };

    // Agregar a la estructura inmediatamente
    tipo.inversiones.push(nuevaInversion);
  }

  /**
   * Guarda una inversión general nueva (cuando el usuario termina de editar)
   */
  async guardarNuevaInversionGeneral(inversion: InversionGeneral, tipo: TipoConInversiones): Promise<void> {
    if (!inversion.seccion || inversion.seccion.trim() === '') {
      console.log('Por favor ingrese un nombre para la sección');
      return;
    }

    try {
      const response = await this.inversionService.addInversionGeneral(
        this.planId,
        tipo.id,
        inversion.seccion,
        0
      );
      console.log('Inversión general creada:', response);

      // Actualizar el objeto temporal con el ID del backend
      inversion.id = response.id;
    } catch (error) {
      console.error('Error al crear inversión general:', error);
      // alert('Error al crear la sección. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Agrega un nuevo detalle a una inversión general - Modo Inline
   */
  agregarDetalle(inversion: InversionGeneral): void {
    if (!inversion.id) {
      console.log('Primero debe guardar la sección antes de agregar elementos');
      return;
    }

    // Crear detalle temporal sin ID
    const nuevoDetalle: InversionDetalle = {
      plan_negocio_id: this.planId,
      inversion_id: inversion.id,
      tipo_id: inversion.tipo_id,
      elemento: '',
      importe: 0,
      vida_util: 0
    };

    // Agregar a la estructura inmediatamente
    if (!inversion.detalles) {
      inversion.detalles = [];
    }
    inversion.detalles.push(nuevoDetalle);
  }

  /**
   * Guarda un detalle nuevo (cuando el usuario termina de editar)
   */
  async guardarNuevoDetalle(detalle: InversionDetalle, inversion: InversionGeneral): Promise<void> {
    if (!detalle.elemento || detalle.elemento.trim() === '') {
      console.log('Por favor ingrese un nombre para el elemento');
      return;
    }

    try {
      const response = await this.inversionService.addDetalleInversion(
        this.planId,
        inversion.id!,
        inversion.tipo_id!,
        detalle.elemento,
        detalle.importe || 0,
        detalle.vida_util || 0
      );
      console.log('Detalle de inversión creado:', response);

      // Actualizar el objeto temporal con el ID del backend
      detalle.id = response.id;
    } catch (error) {
      console.error('Error al crear detalle de inversión:', error);
    }
  }

  /**
   * Marca un detalle como modificado cuando cambia su importe
   */
  onDetalleImporteChange(detalle: InversionDetalle): void {
    if (detalle.id) {
      this.detallesModificados.add(detalle.id);
      console.log('Detalle marcado como modificado:', detalle.id);
    }
  }

  /**
   * Recalcula el importe total de una inversión general sumando sus detalles
   */
  recalcularImporteInversion(inversion: InversionGeneral): number {
    if (!inversion.detalles || inversion.detalles.length === 0) {
      return 0;
    }
    const total = inversion.detalles.reduce((sum, detalle) => sum + (detalle.importe || 0), 0);
    inversion.importe = total;
    return total;
  }

  /**
   * Guarda una inversión general (actualiza solo seccion e importe)
   */
  async guardarInversionGeneral(inversion: InversionGeneral): Promise<void> {
    if (!inversion.id) {
      console.log('Esta inversión aún no tiene ID');
      return;
    }

    try {
      // Recalcular importe antes de guardar
      this.recalcularImporteInversion(inversion);

      const response = await this.inversionService.actualizarInversionGeneral(inversion.id, {
        seccion: inversion.seccion,
        importe: inversion.importe,
        recalc: true
      });
      console.log('Inversión general actualizada:', response);
    } catch (error) {
      console.error('Error al actualizar inversión general:', error);
    }
  }

  /**
   * Guarda todos los detalles modificados de TODAS las inversiones con lógica optimizada de recalc
   */
  async guardarTodasLasInversiones(): Promise<void> {
    // Recopilar todos los detalles modificados de todas las inversiones
    const todosLosDetallesModificados: Array<{ detalle: InversionDetalle; inversion: InversionGeneral }> = [];

    this.tiposInversion.forEach(tipo => {
      tipo.inversiones.forEach(inversion => {
        if (inversion.detalles && inversion.detalles.length > 0) {
          inversion.detalles.forEach(detalle => {
            if (detalle.id && this.detallesModificados.has(detalle.id)) {
              todosLosDetallesModificados.push({ detalle, inversion });
            }
          });
        }
      });
    });

    if (todosLosDetallesModificados.length === 0) {
      console.log('No hay detalles modificados para guardar');
      return;
    }

    console.log(`Guardando ${todosLosDetallesModificados.length} detalle(s) modificado(s) en total`);

    try {
      // Crear promesas con lógica de recalc optimizada
      const promesas = todosLosDetallesModificados.map((item, index) => {
        // Solo el último debe tener recalc: true
        const esUltimo = index === todosLosDetallesModificados.length - 1;
        const recalc = esUltimo;

        console.log(`[${index + 1}/${todosLosDetallesModificados.length}] Elemento: ${item.detalle.elemento}, ID: ${item.detalle.id}, Importe: ${item.detalle.importe}, recalc: ${recalc}`);

        return this.inversionService.actualizarDetalleInversion(item.detalle.id!, {
          elemento: item.detalle.elemento,
          importe: item.detalle.importe,
          vida_util: item.detalle.vida_util,
          recalc: recalc
        });
      });

      const responses = await Promise.all(promesas);
      console.log('✓ Todos los detalles actualizados:', responses);
      console.log(`Optimización: recalc ejecutado 1 vez (último de ${responses.length} actualizaciones)`);

      // Limpiar el set de modificados
      this.detallesModificados.clear();

      // Actualizar importes de todas las inversiones generales afectadas
      const inversionesAfectadas = new Set<InversionGeneral>();
      todosLosDetallesModificados.forEach(item => inversionesAfectadas.add(item.inversion));

      for (const inversion of inversionesAfectadas) {
        await this.guardarInversionGeneral(inversion);
      }

      // Recargar datos para reflejar cambios del backend
      await this.cargarDatos();

      console.log('Cambios guardados correctamente');
    } catch (error) {
      console.error('Error al guardar detalles:', error);
      console.log('Error al guardar los cambios. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Verifica si hay cambios sin guardar
   */
  hayDetallesModificados(): boolean {
    return this.detallesModificados.size > 0;
  }

  /**
   * Guarda todos los detalles modificados de una inversión general con lógica optimizada de recalc
   */
  async guardarDetalles(inversion: InversionGeneral): Promise<void> {
    if (!inversion.detalles || inversion.detalles.length === 0) {
      console.log('No hay detalles para guardar');
      return;
    }

    // Filtrar solo detalles modificados que tienen ID
    const detallesParaActualizar = inversion.detalles.filter(
      detalle => detalle.id && this.detallesModificados.has(detalle.id)
    );

    if (detallesParaActualizar.length === 0) {
      console.log('No hay detalles modificados para guardar');
      return;
    }

    console.log(`Guardando ${detallesParaActualizar.length} detalle(s) modificado(s)`);

    try {
      // Crear promesas con lógica de recalc optimizada
      const promesas = detallesParaActualizar.map((detalle, index) => {
        // Solo el último debe tener recalc: true
        const esUltimo = index === detallesParaActualizar.length - 1;
        const recalc = esUltimo;

        console.log(`[${index + 1}/${detallesParaActualizar.length}] Elemento: ${detalle.elemento}, ID: ${detalle.id}, Importe: ${detalle.importe}, recalc: ${recalc}`);

        return this.inversionService.actualizarDetalleInversion(detalle.id!, {
          elemento: detalle.elemento,
          importe: detalle.importe,
          vida_util: detalle.vida_util,
          recalc: recalc
        });
      });

      const responses = await Promise.all(promesas);
      console.log('✓ Todos los detalles actualizados:', responses);
      console.log(`Optimización: recalc ejecutado 1 vez (último de ${responses.length} actualizaciones)`);

      // Limpiar el set de modificados
      detallesParaActualizar.forEach(det => this.detallesModificados.delete(det.id!));

      // Recalcular y guardar importe total de la inversión general
      await this.guardarInversionGeneral(inversion);

      // Recargar datos para reflejar cambios del backend
      await this.cargarDatos();
    } catch (error) {
      console.error('Error al guardar detalles:', error);
      console.log('Error al guardar los elementos. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Elimina una inversión general completa
   */
  async eliminarInversionGeneral(tipo: TipoConInversiones, index: number): Promise<void> {
    const inversion = tipo.inversiones[index];
    
    if (!inversion.id) {
      // Si no tiene ID, solo remover del array
      tipo.inversiones.splice(index, 1);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la sección "${inversion.seccion}"? Se eliminarán también todos sus elementos.`)) {
      return;
    }

    try {
      await this.inversionService.eliminarInversionGeneral(inversion.id);
      console.log('Inversión general eliminada:', inversion.id);
      tipo.inversiones.splice(index, 1);
    } catch (error) {
      console.error('Error al eliminar inversión general:', error);
      console.log('Error al eliminar la sección. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Elimina un detalle de inversión
   */
  async eliminarDetalle(inversion: InversionGeneral, index: number): Promise<void> {
    if (!inversion.detalles) return;

    const detalle = inversion.detalles[index];

    if (!detalle.id) {
      // Si no tiene ID, solo remover del array
      inversion.detalles.splice(index, 1);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar el elemento "${detalle.elemento}"?`)) {
      return;
    }

    try {
      await this.inversionService.eliminarDetalleInversion(detalle.id);
      console.log('Detalle eliminado:', detalle.id);
      inversion.detalles.splice(index, 1);

      // Remover del set si estaba marcado como modificado
      this.detallesModificados.delete(detalle.id);

      // Recalcular importe de la inversión general
      this.recalcularImporteInversion(inversion);
    } catch (error) {
      console.error('Error al eliminar detalle:', error);
      console.log('Error al eliminar el elemento. Por favor, intenta de nuevo.');
    }
  }

  /**
   * Obtiene el total de inversiones de un tipo
   */
  getTotalTipo(tipo: TipoConInversiones): number {
    return tipo.inversiones.reduce((sum, inv) => sum + (inv.importe || 0), 0);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
