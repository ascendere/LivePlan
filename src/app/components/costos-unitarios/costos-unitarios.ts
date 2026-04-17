import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Costos } from '../../interfaces/';
import { InversionService, DatosStateService } from '../../core/services';

interface CostoMensualCelda {
  id: number;
  mes: number;
  valor: number;
}

interface CostoMensual {
  productoId: number;
  productoNombre: string;
  categoriaId: number;
  categoriaNombre: string;
  
  anio1: CostoMensualCelda[]; // Length 12
  anio2: CostoMensualCelda[];
  anio3: CostoMensualCelda[];
  anio4: CostoMensualCelda[]; // Length 12, UI binds to [0]
  anio5: CostoMensualCelda[]; // Length 12, UI binds to [0]
  
  totalAnio1: number;
  totalAnio2: number;
  totalAnio3: number;
}

interface GrupoProducto {
  productoId: number;
  productoNombre: string;
  costosMensuales: CostoMensual[];
  totalesAnio1: number[]; // Length 12
  totalesAnio2: number[]; // Length 12
  totalesAnio3: number[]; // Length 12
  totalGralAnio1: number;
  totalGralAnio2: number;
  totalGralAnio3: number;
  totalGralAnio4: number;
  totalGralAnio5: number;
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
  costosMensualesRaw: any[] = [];
  gruposProductos: GrupoProducto[] = [];
  cargando: boolean = false;
  guardando: boolean = false;
  meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  cambiosPendientes: Set<number> = new Set(); // IDs de celdas modificadas

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private inversionService: InversionService,
    private datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      if (this.planId > 0) {
        this.suscribirseAlEstado();
        this.cargarDatos();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private suscribirseAlEstado(): void {
    const costosSub = this.datosStateService.costosProducto$.subscribe(costos => {
      if (costos && costos.length > 0) {
        this.costosProducto = costos;
        if (this.costosMensualesRaw.length > 0) {
            this.procesarCostos();
        }
      }
    });

    // Solo reprocesar los costos ya cargados cuando cambien las variables de sensibilidad.
    // No volver a llamar al backend, pues la carga inicial ya se realiza en ngOnInit.
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables && this.costosMensualesRaw.length > 0) {
        this.procesarCostos();
      }
    });

    this.subscriptions.push(costosSub, variablesSub);
  }

  cargarDatos(): void {
    this.cargando = true;
    // Cargar costos base y costos mensuales en paralelo.
    // Si los costos mensuales fallan (ej. primera carga sin datos), se continúa con array vacío.
    Promise.all([
      this.inversionService.getCostosProductoServicio(this.planId),
      this.inversionService.getCostosMensuales(this.planId).catch(() => [] as any[])
    ])
    .then(([costosBase, costosMensuales]) => {
      this.datosStateService.setCostosProducto(costosBase);
      this.costosProducto = costosBase;
      this.costosMensualesRaw = costosMensuales;
      this.procesarCostos();
      this.cargando = false;
      this.cambiosPendientes.clear();
    })
    .catch(err => {
      console.error('Error cargando costos base', err);
      this.cargando = false;
    });
  }

  procesarCostos(): void {
    const productosMap = new Map<number, GrupoProducto>();
    
    // Indexar los costos mensuales raw por Producto -> Categoria -> Anio -> Mes
    const indexMensuales = new Map<number, Map<number, any>>();
    this.costosMensualesRaw.forEach(cm => {
        if (!indexMensuales.has(cm.producto_servicio_id)) {
            indexMensuales.set(cm.producto_servicio_id, new Map());
        }
        const prodMap = indexMensuales.get(cm.producto_servicio_id)!;
        if (!prodMap.has(cm.categoria_costo_id)) {
            prodMap.set(cm.categoria_costo_id, []);
        }
        prodMap.get(cm.categoria_costo_id).push(cm);
    });

    this.costosProducto.forEach((costoBase) => {
      const pId = costoBase.producto_servicio_id;
      const cId = costoBase.categoria_costo_id;

      if (!productosMap.has(pId)) {
        productosMap.set(pId, {
          productoId: pId,
          productoNombre: costoBase.producto_servicio?.nombre || 'Sin nombre',
          costosMensuales: [],
          totalesAnio1: new Array(12).fill(0),
          totalesAnio2: new Array(12).fill(0),
          totalesAnio3: new Array(12).fill(0),
          totalGralAnio1: 0,
          totalGralAnio2: 0,
          totalGralAnio3: 0,
          totalGralAnio4: 0,
          totalGralAnio5: 0,
        });
      }

      const grupo = productosMap.get(pId)!;
      const mensuales = indexMensuales.get(pId)?.get(cId) || [];
      
      const anio1 = new Array(12);
      const anio2 = new Array(12);
      const anio3 = new Array(12);
      const anio4 = new Array(12);
      const anio5 = new Array(12);

      mensuales.forEach((m: any) => {
          const celda = { id: m.id, mes: m.mes, valor: m.costo || 0 };
          const idx = m.mes - 1;
          if (m.anio === 1) anio1[idx] = celda;
          if (m.anio === 2) anio2[idx] = celda;
          if (m.anio === 3) anio3[idx] = celda;
          if (m.anio === 4) anio4[idx] = celda;
          if (m.anio === 5) anio5[idx] = celda;
      });

      // Llenar faltantes si la bd está incompleta
      const fake = () => ({ id: 0, mes: 1, valor: 0 });
      for (let i = 0; i < 12; i++) {
          if (!anio1[i]) anio1[i] = fake();
          if (!anio2[i]) anio2[i] = fake();
          if (!anio3[i]) anio3[i] = fake();
          if (!anio4[i]) anio4[i] = fake();
          if (!anio5[i]) anio5[i] = fake();
      }

      const fila: CostoMensual = {
          productoId: pId,
          productoNombre: grupo.productoNombre,
          categoriaId: cId,
          categoriaNombre: costoBase.categoria_costo?.nombre || 'Sin categoría',
          anio1, anio2, anio3, anio4, anio5,
          totalAnio1: anio1.reduce((sum, c) => sum + c.valor, 0),
          totalAnio2: anio2.reduce((sum, c) => sum + c.valor, 0),
          totalAnio3: anio3.reduce((sum, c) => sum + c.valor, 0)
      };

      grupo.costosMensuales.push(fila);
      this.recalcularTotales(grupo, null);
    });

    this.gruposProductos = Array.from(productosMap.values());
  }

  onCellValueChange(celda: CostoMensualCelda, grupo: GrupoProducto, fila: CostoMensual) {
      if (celda.id > 0) {
          this.cambiosPendientes.add(celda.id);
      }
      this.recalcularTotales(grupo, fila);
  }

  onAnioUnicoValueChange(celdas: CostoMensualCelda[], newValue: number, grupo: GrupoProducto, fila: CostoMensual) {
      // Replicar a todos los 12 meses
      for (const celda of celdas) {
          celda.valor = newValue;
          if (celda.id > 0) this.cambiosPendientes.add(celda.id);
      }
      this.recalcularTotales(grupo, fila);
  }

  recalcularTotales(grupo: GrupoProducto, filaLocal: CostoMensual | null) {
      if (filaLocal) {
          filaLocal.totalAnio1 = filaLocal.anio1.reduce((sum, c) => sum + c.valor, 0);
          filaLocal.totalAnio2 = filaLocal.anio2.reduce((sum, c) => sum + c.valor, 0);
          filaLocal.totalAnio3 = filaLocal.anio3.reduce((sum, c) => sum + c.valor, 0);
      }

      grupo.totalesAnio1.fill(0);
      grupo.totalesAnio2.fill(0);
      grupo.totalesAnio3.fill(0);
      grupo.totalGralAnio1 = 0;
      grupo.totalGralAnio2 = 0;
      grupo.totalGralAnio3 = 0;
      grupo.totalGralAnio4 = 0;
      grupo.totalGralAnio5 = 0;

      for (const f of grupo.costosMensuales) {
          for (let i = 0; i < 12; i++) {
              grupo.totalesAnio1[i] += f.anio1[i].valor;
              grupo.totalesAnio2[i] += f.anio2[i].valor;
              grupo.totalesAnio3[i] += f.anio3[i].valor;
          }
          grupo.totalGralAnio1 += f.totalAnio1;
          grupo.totalGralAnio2 += f.totalAnio2;
          grupo.totalGralAnio3 += f.totalAnio3;
          grupo.totalGralAnio4 += f.anio4.reduce((s,c)=>s+c.valor, 0);
          grupo.totalGralAnio5 += f.anio5.reduce((s,c)=>s+c.valor, 0);
      }
  }

  guardarCambios(): void {
      if (this.cambiosPendientes.size === 0) return;

      this.guardando = true;
      const updates: {id: number, costo: number}[] = [];
      
      this.gruposProductos.forEach(g => {
          g.costosMensuales.forEach(f => {
              [f.anio1, f.anio2, f.anio3, f.anio4, f.anio5].forEach(arr => {
                  arr.forEach(celda => {
                      if (this.cambiosPendientes.has(celda.id)) {
                          updates.push({ id: celda.id, costo: celda.valor });
                      }
                  });
              });
          });
      });

      this.inversionService.actualizarCostosMensualesLote(this.planId, updates).then(() => {
          this.guardando = false;
          this.cambiosPendientes.clear();
      }).catch(err => {
          console.error("Error guardando lote", err);
          this.guardando = false;
      });
  }

  handleSidebarChange(section: string): void {
    this.activeSection = section;
  }

  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}

