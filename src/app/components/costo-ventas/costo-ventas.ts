import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CostosVentas, Producto } from '../../interfaces';
import { InversionService } from '../../core/services/inversion.service';

interface CostoMensual {
  meses: number[];
  totalAnio: number;
}

interface ProductoCostoVentas {
  productoId: number;
  nombreProducto: string;
  anio1: CostoMensual;
  anio2: CostoMensual;
  anio3: CostoMensual;
  totalAnio4: number;
  totalAnio5: number;
}

@Component({
  selector: 'app-costo-ventas',
  standalone: false,
  templateUrl: './costo-ventas.html',
  styleUrl: './costo-ventas.css'
})
export class CostoVentas implements OnInit {
  activeSection = 'planificacion';
  planId: number = 0;
  isSidebarCollapsed = false;
  cargando: boolean = false;
  costosVentas: CostosVentas[] = [];
  productosCostos: ProductoCostoVentas[] = [];
  productos: Producto[] = [];
  meses: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService
  ) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Costos de Ventas:', this.planId);
      if (this.planId) {
        this.cargarCostosVentas();
      }
    });
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
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

  cargarCostosVentas(): void {
    this.cargando = true;
    
    // Cargar productos primero
    this.inversionService.getProductosServicios(this.planId)
      .then((productos) => {
        this.productos = Array.isArray(productos) ? productos : [];
        
        // Luego cargar costos de ventas
        return this.inversionService.getCostosVenta(this.planId);
      })
      .then((response) => {
        this.costosVentas = Array.isArray(response) ? response : [];
        this.procesarCostosVentas();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar costos de ventas:', error);
        this.cargando = false;
      });
  }

  procesarCostosVentas(): void {
    const productosMap = new Map<number, ProductoCostoVentas>();
    
    // Inicializar estructura para cada producto
    for (const producto of this.productos) {
      if (!producto.id) continue;
      
      productosMap.set(producto.id, {
        productoId: producto.id,
        nombreProducto: producto.nombre,
        anio1: { meses: new Array(12).fill(0), totalAnio: 0 },
        anio2: { meses: new Array(12).fill(0), totalAnio: 0 },
        anio3: { meses: new Array(12).fill(0), totalAnio: 0 },
        totalAnio4: 0,
        totalAnio5: 0
      });
    }

    // Procesar los costos y asignarlos por año
    for (const costo of this.costosVentas) {
      const producto = productosMap.get(costo.producto_id);
      if (!producto) continue;

      this.asignarCostoPorAnio(producto, costo);
    }

    this.productosCostos = Array.from(productosMap.values());
  }

  private asignarCostoPorAnio(producto: ProductoCostoVentas, costo: CostosVentas): void {
    const mesIndex = costo.mes - 1;
    const valorMensual = costo.mensual || 0;

    if (costo.anio === 1) {
      if (mesIndex >= 0 && mesIndex < 12) {
        producto.anio1.meses[mesIndex] = valorMensual;
      }
      producto.anio1.totalAnio += valorMensual;
    } else if (costo.anio === 2) {
      if (mesIndex >= 0 && mesIndex < 12) {
        producto.anio2.meses[mesIndex] = valorMensual;
      }
      producto.anio2.totalAnio += valorMensual;
    } else if (costo.anio === 3) {
      if (mesIndex >= 0 && mesIndex < 12) {
        producto.anio3.meses[mesIndex] = valorMensual;
      }
      producto.anio3.totalAnio += valorMensual;
    } else if (costo.anio === 4) {
      producto.totalAnio4 += valorMensual;
    } else if (costo.anio === 5) {
      producto.totalAnio5 += valorMensual;
    }
  }
}
