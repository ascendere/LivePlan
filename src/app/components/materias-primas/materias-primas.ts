import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InversionService } from '../../core/services/inversion.service';
import { MateriaPrima } from '../../interfaces';

interface CostoMensual {
  meses: number[];         // 12 valores mensuales
  totalAnio: number;       // Total del año
}

interface ProductoMateriaPrima {
  productoId: number;
  nombreProducto: string;
  anio1: CostoMensual;
  anio2: CostoMensual;
  anio3: CostoMensual;
  totalAnio4: number;
  totalAnio5: number;
}

@Component({
  selector: 'app-materias-primas',
  standalone: false,
  templateUrl: './materias-primas.html',
  styleUrl: './materias-primas.css',
})
export class MateriasPrimas implements OnInit {
  activeSection = 'dashboard';
  planId: number = 0; // ID del plan capturado de la ruta
  isSidebarCollapsed = false;
  
  // Datos de materia prima
  materiaPrima: MateriaPrima[] = [];
  productosMateriaPrima: ProductoMateriaPrima[] = [];
  cargando: boolean = false;
  meses: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService
  ) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Planificación:', this.planId);
      
      if (this.planId > 0) {
        this.cargarMateriaPrima();
      }
    });
  }

  /**
   * Carga los datos de materia prima desde el backend
   */
  cargarMateriaPrima(): void {
    this.cargando = true;
    this.inversionService.getMateriaPrima(this.planId)
      .then((response: MateriaPrima[]) => {
        // console.log('Materia prima cargada:', response);
        this.materiaPrima = response;
        this.procesarMateriaPrima();
      })
      .catch((error) => {
        console.error('Error al cargar materia prima:', error);
      })
      .finally(() => {
        this.cargando = false;
      });
  }

  /**
   * Procesa los datos de materia prima y los agrupa por producto
   */
  procesarMateriaPrima(): void {
    // Agrupar por producto
    const productosMap = new Map<number, ProductoMateriaPrima>();

    for (const mp of this.materiaPrima) {
      if (!productosMap.has(mp.producto_id)) {
        // Crear entrada inicial para el producto
        productosMap.set(mp.producto_id, {
          productoId: mp.producto_id,
          nombreProducto: mp.producto.nombre,
          anio1: { meses: new Array(12).fill(0), totalAnio: 0 },
          anio2: { meses: new Array(12).fill(0), totalAnio: 0 },
          anio3: { meses: new Array(12).fill(0), totalAnio: 0 },
          totalAnio4: 0,
          totalAnio5: 0
        });
      }

      const producto = productosMap.get(mp.producto_id)!;
      
      // Asignar los valores según el año
      switch (mp.anio) {
        case 1:
          producto.anio1.meses = new Array(12).fill(mp.costo_mensual);
          producto.anio1.totalAnio = mp.costo_anual;
          break;
        case 2:
          producto.anio2.meses = new Array(12).fill(mp.costo_mensual);
          producto.anio2.totalAnio = mp.costo_anual;
          break;
        case 3:
          producto.anio3.meses = new Array(12).fill(mp.costo_mensual);
          producto.anio3.totalAnio = mp.costo_anual;
          break;
        case 4:
          producto.totalAnio4 = mp.costo_anual;
          break;
        case 5:
          producto.totalAnio5 = mp.costo_anual;
          break;
      }
    }

    // Convertir el Map a array
    this.productosMateriaPrima = Array.from(productosMap.values());
    // console.log('Productos procesados:', this.productosMateriaPrima);
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
}
