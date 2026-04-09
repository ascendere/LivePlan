import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Costos } from '../../interfaces/';
import { InversionService, DatosStateService } from '../../core/services';

interface CostoMensual {
  productoId: number;
  productoNombre: string;
  categoriaNombre: string;
  costo: number;
  meses: number[]; // 12 meses
  totalAnio1: number;
  totalAnio2: number;
  totalAnio3: number;
  totalAnio4: number;
  totalAnio5: number;
}

interface GrupoProducto {
  productoId: number;
  productoNombre: string;
  costosMensuales: CostoMensual[];
  totalesPorMes: number[]; // 12 totales
  totalAnio1: number;
  totalAnio2: number;
  totalAnio3: number;
  totalAnio4: number;
  totalAnio5: number;
}

@Component({
  selector: 'app-costos-unitarios',
  standalone: false,
  templateUrl: './costos-unitarios.html',
  styleUrl: './costos-unitarios.css',
})
export class CostosUnitarios implements OnInit, OnDestroy {
  activeSection = 'dashboard';
  planId: number = 0;
  isSidebarCollapsed = false;
  
  costosProducto: Costos[] = [];
  gruposProductos: GrupoProducto[] = [];
  cargando: boolean = false;
  meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private inversionService: InversionService,
    private datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Costos Unitarios:', this.planId);
      
      if (this.planId > 0) {
        this.suscribirseAlEstado();
        this.cargarCostosProducto();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Se suscribe a los cambios en el estado de costos
   */
  private suscribirseAlEstado(): void {
    // Suscribirse a cambios en costos desde el estado
    const costosSub = this.datosStateService.costosProducto$.subscribe(costos => {
      if (costos && costos.length > 0) {
        console.log('Costos actualizados desde el estado:', costos);
        this.costosProducto = costos;
        this.procesarCostos();
      }
    });

    // Suscribirse a cambios en variables de sensibilidad (afectan costos)
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables) {
        console.log('Variables de sensibilidad actualizadas, recargando costos...');
        this.cargarCostosProducto();
      }
    });

    this.subscriptions.push(costosSub, variablesSub);
  }

  /**
   * Carga los costos de productos desde el servicio y actualiza el estado
   */
  cargarCostosProducto(): void {
    this.cargando = true;
    this.inversionService
      .getCostosProductoServicio(this.planId)
      .then((costos: Costos[]) => {
        console.log('Costos cargados desde API:', costos);
        // Actualizar el estado compartido
        this.datosStateService.setCostosProducto(costos);
        this.costosProducto = costos;
        this.procesarCostos();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error cargando costos:', error);
        this.cargando = false;
      });
  }

  /**
   * Procesa los costos para generar la estructura mensual agrupada por producto
   */
  procesarCostos(): void {
    const productosMap = new Map<number, GrupoProducto>();

    this.costosProducto.forEach((costo) => {
      const productoId = costo.producto_servicio_id;
      const productoNombre = costo.producto_servicio?.nombre || 'Sin nombre';

      if (!productosMap.has(productoId)) {
        productosMap.set(productoId, {
          productoId,
          productoNombre,
          costosMensuales: [],
          totalesPorMes: new Array(12).fill(0),
          totalAnio1: 0,
          totalAnio2: 0,
          totalAnio3: 0,
          totalAnio4: 0,
          totalAnio5: 0,
        });
      }

      const grupo = productosMap.get(productoId)!;
      
      // Crear fila de costo mensual (mismo costo repetido en cada mes)
      const costoMensual: CostoMensual = {
        productoId,
        productoNombre,
        categoriaNombre: costo.categoria_costo?.nombre || 'Sin categoría',
        costo: costo.costo || 0,
        meses: new Array(12).fill(costo.costo || 0),
        totalAnio1: (costo.costo || 0) * 12,
        totalAnio2: (costo.costo || 0) * 12,
        totalAnio3: (costo.costo || 0) * 12,
        totalAnio4: (costo.costo || 0) * 12,
        totalAnio5: (costo.costo || 0) * 12,
      };

      grupo.costosMensuales.push(costoMensual);

      // Acumular en los totales del grupo
      for (let i = 0; i < 12; i++) {
        grupo.totalesPorMes[i] += costo.costo || 0;
      }
      grupo.totalAnio1 += costoMensual.totalAnio1;
      grupo.totalAnio2 += costoMensual.totalAnio2;
      grupo.totalAnio3 += costoMensual.totalAnio3;
      grupo.totalAnio4 += costoMensual.totalAnio4;
      grupo.totalAnio5 += costoMensual.totalAnio5;
    });

    this.gruposProductos = Array.from(productosMap.values());
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
  handleSidebarChange(section: string): void {
    this.activeSection = section;
    console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
