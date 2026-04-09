import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { VariablesSensibilidad } from '../../interfaces';
import { InversionService, DatosStateService } from '../../core/services';

@Component({
  selector: 'app-variables-sensibilidad',
  standalone: false,
  templateUrl: './variables-sensibilidad.html',
  styleUrl: './variables-sensibilidad.css',
})
export class VariablesSensibilidadComponent implements OnInit, OnDestroy {
  @Input() planId: number = 0;
  
  isOpen: boolean = false;
  guardando: boolean = false;
  mensajeGuardado: string = '';
  
  variablesSensibilidad: VariablesSensibilidad = {
    id: 0,
    plan_negocio_id: 0,
    cantidad_volumen: 0,
    precio: 0,
    costo: 0,
  };

  private subscription?: Subscription;

  constructor(
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    // Suscribirse a cambios en el estado compartido
    this.subscription = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables) {
        this.variablesSensibilidad = variables;
        console.log('Variables actualizadas en componente flotante:', variables);
      }
    });

    if (this.planId) {
      this.cargarVariablesSensibilidad();
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  toggleModal(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.planId) {
      // Cargar valores actuales del estado
      const variablesActuales = this.datosStateService.getVariablesSensibilidad();
      if (variablesActuales) {
        this.variablesSensibilidad = variablesActuales;
      } else {
        this.cargarVariablesSensibilidad();
      }
    }
  }

  closeModal(): void {
    this.isOpen = false;
  }

  cargarVariablesSensibilidad(): void {
    this.inversionService
      .getVariablesSensibilidad(this.planId)
      .then((response) => {
        console.log('Variables de sensibilidad cargadas:', response);
        
        const variablesData = Array.isArray(response) ? response[0] : response;
        
        if (variablesData) {
          const variables: VariablesSensibilidad = {
            id: variablesData.id || 0,
            plan_negocio_id: this.planId,
            cantidad_volumen: variablesData.cantidad_volumen || 0,
            precio: variablesData.precio || 0,
            costo: variablesData.costo || 0,
          };
          // Actualizar el estado compartido
          this.datosStateService.setVariablesSensibilidad(variables);
        }
      })
      .catch((error) => {
        console.error('Error al cargar variables de sensibilidad:', error);
      });
  }

  guardarVariablesSensibilidad(): void {
    console.log('Guardando variables de sensibilidad:', this.variablesSensibilidad);

    if (!this.variablesSensibilidad.id) {
      console.log('Error: No se puede actualizar. Primero debe existir un registro.');
      this.mensajeGuardado = 'Error: No existe un registro para actualizar';
      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 3000);
      return;
    }

    this.guardando = true;
    this.mensajeGuardado = '';

    this.inversionService
      .actualizarVariablesSensibilidad(this.variablesSensibilidad.id, this.variablesSensibilidad)
      .then((response) => {
        console.log('Variables de sensibilidad guardadas exitosamente:', response);
        
        // Actualizar el estado compartido con la respuesta
        this.datosStateService.setVariablesSensibilidad(response);
        
        // Recargar todos los datos que dependen del recalc
        this.recargarDatosDependientes();
        
        this.mensajeGuardado = 'Variables guardadas correctamente. Recalculando datos...';
        this.guardando = false;
        
        // Cerrar modal después de 2 segundos
        setTimeout(() => {
          this.mensajeGuardado = '';
          this.closeModal();
        }, 2000);
      })
      .catch((error) => {
        console.error('Error al guardar variables de sensibilidad:', error);
        this.guardando = false;
        this.mensajeGuardado = 'Error al guardar las variables';
        setTimeout(() => {
          this.mensajeGuardado = '';
        }, 3000);
      });
  }

  /**
   * Recarga todos los datos que dependen del recalc de variables de sensibilidad
   */
  private recargarDatosDependientes(): void {
    console.log('Recargando datos dependientes del recalc...');

    // Recargar precios de productos (afectados por precio)
    this.inversionService
      .getPreciosProductoServicio(this.planId)
      .then((precios) => {
        console.log('Precios recargados después del recalc:', precios);
        this.datosStateService.setPreciosProducto(precios);
      })
      .catch((error) => console.error('Error al recargar precios:', error));

    // Recargar costos de productos (afectados por costo)
    this.inversionService
      .getCostosProductoServicio(this.planId)
      .then((costos) => {
        console.log('Costos recargados después del recalc:', costos);
        this.datosStateService.setCostosProducto(costos);
      })
      .catch((error) => console.error('Error al recargar costos:', error));

    // Recargar ventas diarias (afectadas por cantidad_volumen)
    this.inversionService
      .getVentasDiarias(this.planId)
      .then((ventas) => {
        console.log('Ventas diarias recargadas después del recalc:', ventas);
        this.datosStateService.setVentasDiarias(ventas);
      })
      .catch((error) => console.error('Error al recargar ventas diarias:', error));

    // Recargar depreciaciones si existen en el estado
    this.inversionService
      .getDepreciacionAnual(this.planId)
      .then((depreciaciones) => {
        console.log('Depreciaciones recargadas después del recalc:', depreciaciones);
        const deps = Array.isArray(depreciaciones) ? depreciaciones : [depreciaciones];
        this.datosStateService.setDepreciaciones(deps);
      })
      .catch((error) => console.error('Error al recargar depreciaciones:', error));

    console.log('✅ Todos los datos dependientes han sido solicitados para recarga');
  }
}
