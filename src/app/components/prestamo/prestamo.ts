import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InversionService } from '../../core/services/inversion.service';
import { DatosPrestamo, CuotasPrestamo } from '../../interfaces';

@Component({
  selector: 'app-prestamo',
  standalone: false,
  templateUrl: './prestamo.html',
  styleUrl: './prestamo.css',
})
export class Prestamo implements OnInit {
  activeSection = 'prestamo';
  planId: number = 0;
  isSidebarCollapsed = false;
  
  datosPrestamo: DatosPrestamo = {};
  datosOriginales: DatosPrestamo = {};
  cuotasPrestamo: CuotasPrestamo[] = [];
  cuotasAgrupadas: { anio: number; cuotas: CuotasPrestamo[] }[] = [];
  cargando: boolean = false;
  cargandoCuotas: boolean = false;
  guardando: boolean = false;
  mensajeGuardado: string = '';
  hayChangios: boolean = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Préstamo:', this.planId);
      if (this.planId > 0) {
        this.cargarDatosPrestamo();
        this.cargarCuotasPrestamo();
      }
    });
  }

  cargarDatosPrestamo(): void {
    this.cargando = true;
    this.inversionService.getDatosPrestamo(this.planId)
      .then((response: any) => {
        // La API devuelve un array, tomamos el primer elemento
        this.datosPrestamo = Array.isArray(response) && response.length > 0 
          ? response[0] 
          : (response || {});
        // Guardamos una copia de los datos originales
        this.datosOriginales = { ...this.datosPrestamo };
        // console.log('Datos de préstamo cargados:', this.datosPrestamo);
        this.cargando = false;
        this.hayChangios = false;
      })
      .catch((error) => {
        console.error('Error al cargar datos de préstamo:', error);
        this.cargando = false;
      });
  }

  cargarCuotasPrestamo(): void {
    this.cargandoCuotas = true;
    this.inversionService.getCuotasPrestamo(this.planId)
      .then((response: any) => {
        this.cuotasPrestamo = Array.isArray(response) ? response : [];
        this.agruparPorAnio();
        // console.log('Cuotas de préstamo cargadas:', this.cuotasPrestamo);
        this.cargandoCuotas = false;
      })
      .catch((error) => {
        console.error('Error al cargar cuotas de préstamo:', error);
        this.cargandoCuotas = false;
      });
  }

  agruparPorAnio(): void {
    const aniosMap = new Map<number, CuotasPrestamo[]>();
    
    for (const cuota of this.cuotasPrestamo) {
      const anio = cuota.anio || 0;
      
      if (!aniosMap.has(anio)) {
        aniosMap.set(anio, []);
      }
      
      aniosMap.get(anio)!.push(cuota);
    }
    
    // Convertir el Map a array y ordenar por año
    this.cuotasAgrupadas = Array.from(aniosMap.entries())
      .map(([anio, cuotas]) => {
        const cuotasOrdenadas = [...cuotas].sort((a, b) => (a.mes || 0) - (b.mes || 0));
        return { anio, cuotas: cuotasOrdenadas };
      })
      .sort((a, b) => a.anio - b.anio);
  }

  getCuotaParaMes(cuotas: CuotasPrestamo[], mes: number): CuotasPrestamo | null {
    return cuotas.find(c => c.mes === mes) || null;
  }

  onCampoEditado(): void {
    // Verificar si hay cambios comparando con los datos originales
    this.hayChangios = 
      this.datosPrestamo.periodos_capitalizacion !== this.datosOriginales.periodos_capitalizacion ||
      this.datosPrestamo.periodos_amortizacion !== this.datosOriginales.periodos_amortizacion;
  }

  actualizarDatosPrestamo(): void {
    if (!this.datosPrestamo.id) {
      console.error('No hay ID de préstamo para actualizar');
      return;
    }

    if (!this.hayChangios) {
      // console.log('No hay cambios para guardar');
      return;
    }

    this.guardando = true;
    this.mensajeGuardado = '';

    this.inversionService.actualizarDatosPrestamo(this.datosPrestamo.id, {
      periodos_capitalizacion: this.datosPrestamo.periodos_capitalizacion,
      periodos_amortizacion: this.datosPrestamo.periodos_amortizacion,
      recalc: true
    })
      .then((response) => {
        // console.log('Préstamo actualizado, respuesta del backend:', response);
        
        // Actualizar datos del préstamo con la respuesta
        this.datosPrestamo = response;
        this.datosOriginales = { ...response };
        this.hayChangios = false;
        
        // Mostrar mensaje de éxito
        this.mensajeGuardado = 'Datos guardados correctamente. Recalculando amortización...';
        
        // Recargar los datos completos del préstamo desde el backend
        // para asegurar que todos los campos calculados estén actualizados
        this.cargarDatosPrestamo();
        
        // Recargar las cuotas después de actualizar (recalc generó nuevas cuotas)
        this.cargarCuotasPrestamo();
        
        // Esperar a que terminen las recargas antes de ocultar el estado de guardado
        Promise.all([
          new Promise(resolve => setTimeout(resolve, 500))
        ]).then(() => {
          this.guardando = false;
          this.mensajeGuardado = 'Datos actualizados correctamente';
          setTimeout(() => {
            this.mensajeGuardado = '';
          }, 2000);
        });
      })
      .catch((error) => {
        console.error('Error al actualizar datos de préstamo:', error);
        this.guardando = false;
        this.mensajeGuardado = 'Error al guardar los datos';
        setTimeout(() => {
          this.mensajeGuardado = '';
        }, 3000);
      });
  }

  handleSidebarChange(section: string): void {
    this.activeSection = section;
    // console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
