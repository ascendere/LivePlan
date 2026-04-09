import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { politicaCompra, PoliticasVenta } from '../../interfaces';
import { InversionService, DatosStateService } from '../../core/services';

interface PoliticasPorAnio<T> {
  anio: number;
  meses: T[];
}

interface PoliticaOriginal {
  porcentaje_credito: number;
  porcentaje_contado: number;
}

type TipoPestaña = 'compra' | 'venta';

@Component({
  selector: 'app-politicas-cv',
  standalone: false,
  templateUrl: './politicas-cv.html',
  styleUrl: './politicas-cv.css',
})
export class PoliticasCV implements OnInit, OnDestroy {
  @Input() planId: number = 0;

  isOpen: boolean = false;
  guardando: boolean = false;
  mensajeGuardado: string = '';
  cargando: boolean = false;

  // Control de pestañas
  pestanaActiva: TipoPestaña = 'compra';

  // Datos de Compra
  politicasCompra: politicaCompra[] = [];
  politicasCompraPorAnio: PoliticasPorAnio<politicaCompra>[] = [];
  private readonly valoresOriginalesCompra: Map<number, PoliticaOriginal> = new Map();
  politicasCompraModificadas: Set<number> = new Set();

  // Datos de Venta
  politicasVenta: PoliticasVenta[] = [];
  politicasVentaPorAnio: PoliticasPorAnio<PoliticasVenta>[] = [];
  private readonly valoresOriginalesVenta: Map<number, PoliticaOriginal> = new Map();
  politicasVentaModificadas: Set<number> = new Set();

  nombresMeses: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Control de colapso por año
  aniosCompraColapsados: Set<number> = new Set();
  aniosVentaColapsados: Set<number> = new Set();

  private readonly subscription?: Subscription;

  constructor(
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    if (this.planId) {
      this.cargarDatos();
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
      this.cargarDatos();
    }
  }

  closeModal(): void {
    this.isOpen = false;
    // Limpiar modificaciones al cerrar
    this.politicasCompraModificadas.clear();
    this.politicasVentaModificadas.clear();
  }

  cambiarPestana(pestaña: TipoPestaña): void {
    this.pestanaActiva = pestaña;
  }

  // ==================== CARGA DE DATOS ====================

  cargarDatos(): void {
    this.cargando = true;
    
    Promise.all([
      this.inversionService.getPoliticaCompra(this.planId),
      this.inversionService.getPoliticaVenta(this.planId)
    ])
      .then(([compraResponse, ventaResponse]) => {
        console.log('Políticas de compra cargadas:', compraResponse);
        console.log('Políticas de venta cargadas:', ventaResponse);
        
        this.politicasCompra = compraResponse;
        this.politicasVenta = ventaResponse;
        
        this.guardarValoresOriginalesCompra();
        this.guardarValoresOriginalesVenta();
        
        this.organizarCompraPorAnio();
        this.organizarVentaPorAnio();
        
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar políticas:', error);
        this.cargando = false;
        this.mensajeGuardado = 'Error al cargar las políticas';
        setTimeout(() => {
          this.mensajeGuardado = '';
        }, 3000);
      });
  }

  // ==================== COMPRA ====================

  private guardarValoresOriginalesCompra(): void {
    this.valoresOriginalesCompra.clear();
    this.politicasCompraModificadas.clear();
    
    this.politicasCompra.forEach((politica) => {
      this.valoresOriginalesCompra.set(politica.id, {
        porcentaje_credito: politica.porcentaje_credito,
        porcentaje_contado: politica.porcentaje_contado,
      });
    });
  }

  private esPoliticaCompraModificada(politica: politicaCompra): boolean {
    const original = this.valoresOriginalesCompra.get(politica.id);
    if (!original) return false;
    
    return (
      original.porcentaje_credito !== politica.porcentaje_credito ||
      original.porcentaje_contado !== politica.porcentaje_contado
    );
  }

  private marcarCompraComoModificada(politica: politicaCompra): void {
    if (this.esPoliticaCompraModificada(politica)) {
      this.politicasCompraModificadas.add(politica.id);
    } else {
      this.politicasCompraModificadas.delete(politica.id);
    }
  }

  private obtenerPoliticasCompraModificadas(): politicaCompra[] {
    return this.politicasCompra.filter((p) => this.politicasCompraModificadas.has(p.id));
  }

  organizarCompraPorAnio(): void {
    const agrupado = new Map<number, politicaCompra[]>();

    this.politicasCompra.forEach((politica) => {
      const anio = politica.anio;
      if (!agrupado.has(anio)) {
        agrupado.set(anio, []);
      }
      agrupado.get(anio)!.push(politica);
    });

    this.politicasCompraPorAnio = Array.from(agrupado.entries())
      .map(([anio, meses]) => ({
        anio,
        meses: [...meses].sort((a, b) => a.mes - b.mes),
      }))
      .sort((a, b) => a.anio - b.anio);
  }

  estaPoliticaCompraModificada(politicaId: number): boolean {
    return this.politicasCompraModificadas.has(politicaId);
  }

  onCreditoCompraChange(politica: politicaCompra): void {
    politica.porcentaje_contado = 100 - politica.porcentaje_credito;
    this.marcarCompraComoModificada(politica);
  }

  onContadoCompraChange(politica: politicaCompra): void {
    politica.porcentaje_credito = 100 - politica.porcentaje_contado;
    this.marcarCompraComoModificada(politica);
  }

  async guardarTodasCompra(): Promise<void> {
    const modificadas = this.obtenerPoliticasCompraModificadas();
    
    if (modificadas.length === 0) {
      this.mensajeGuardado = 'No hay cambios de compra para guardar';
      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 2000);
      return;
    }

    console.log(`Guardando ${modificadas.length} políticas de compra modificadas...`);
    this.guardando = true;
    this.mensajeGuardado = '';

    try {
      for (let i = 0; i < modificadas.length; i++) {
        const politica = modificadas[i];
        const esUltima = i === modificadas.length - 1;
        
        console.log(`Guardando política compra ${i + 1}/${modificadas.length}, recalc: ${esUltima}`);
        
        await this.inversionService.actualizarPoliticaCompra(politica, esUltima);
        
        this.valoresOriginalesCompra.set(politica.id, {
          porcentaje_credito: politica.porcentaje_credito,
          porcentaje_contado: politica.porcentaje_contado,
        });
        this.politicasCompraModificadas.delete(politica.id);
      }

      console.log('Todas las políticas de compra guardadas');
      this.mensajeGuardado = `${modificadas.length} política(s) de compra guardada(s)`;
      this.guardando = false;

      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 2000);
    } catch (error) {
      console.error('Error al guardar políticas de compra:', error);
      this.guardando = false;
      this.mensajeGuardado = 'Error al guardar las políticas de compra';
      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 3000);
    }
  }

  get cantidadCompraModificadas(): number {
    return this.politicasCompraModificadas.size;
  }

  // ==================== VENTA ====================

  private guardarValoresOriginalesVenta(): void {
    this.valoresOriginalesVenta.clear();
    this.politicasVentaModificadas.clear();
    
    this.politicasVenta.forEach((politica) => {
      this.valoresOriginalesVenta.set(politica.id, {
        porcentaje_credito: politica.porcentaje_credito,
        porcentaje_contado: politica.porcentaje_contado,
      });
    });
  }

  private esPoliticaVentaModificada(politica: PoliticasVenta): boolean {
    const original = this.valoresOriginalesVenta.get(politica.id);
    if (!original) return false;
    
    return (
      original.porcentaje_credito !== politica.porcentaje_credito ||
      original.porcentaje_contado !== politica.porcentaje_contado
    );
  }

  private marcarVentaComoModificada(politica: PoliticasVenta): void {
    if (this.esPoliticaVentaModificada(politica)) {
      this.politicasVentaModificadas.add(politica.id);
    } else {
      this.politicasVentaModificadas.delete(politica.id);
    }
  }

  private obtenerPoliticasVentaModificadas(): PoliticasVenta[] {
    return this.politicasVenta.filter((p) => this.politicasVentaModificadas.has(p.id));
  }

  organizarVentaPorAnio(): void {
    const agrupado = new Map<number, PoliticasVenta[]>();

    this.politicasVenta.forEach((politica) => {
      const anio = politica.anio;
      if (!agrupado.has(anio)) {
        agrupado.set(anio, []);
      }
      agrupado.get(anio)!.push(politica);
    });

    this.politicasVentaPorAnio = Array.from(agrupado.entries())
      .map(([anio, meses]) => ({
        anio,
        meses: [...meses].sort((a, b) => a.mes - b.mes),
      }))
      .sort((a, b) => a.anio - b.anio);
  }

  estaPoliticaVentaModificada(politicaId: number): boolean {
    return this.politicasVentaModificadas.has(politicaId);
  }

  onCreditoVentaChange(politica: PoliticasVenta): void {
    politica.porcentaje_contado = 100 - politica.porcentaje_credito;
    this.marcarVentaComoModificada(politica);
  }

  onContadoVentaChange(politica: PoliticasVenta): void {
    politica.porcentaje_credito = 100 - politica.porcentaje_contado;
    this.marcarVentaComoModificada(politica);
  }

  async guardarTodasVenta(): Promise<void> {
    const modificadas = this.obtenerPoliticasVentaModificadas();
    
    if (modificadas.length === 0) {
      this.mensajeGuardado = 'No hay cambios de venta para guardar';
      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 2000);
      return;
    }

    console.log(`Guardando ${modificadas.length} políticas de venta modificadas...`);
    this.guardando = true;
    this.mensajeGuardado = '';

    try {
      for (let i = 0; i < modificadas.length; i++) {
        const politica = modificadas[i];
        const esUltima = i === modificadas.length - 1;
        
        console.log(`Guardando política venta ${i + 1}/${modificadas.length}, recalc: ${esUltima}`);
        
        await this.inversionService.actualizarPoliticaVenta(politica, esUltima);
        
        this.valoresOriginalesVenta.set(politica.id, {
          porcentaje_credito: politica.porcentaje_credito,
          porcentaje_contado: politica.porcentaje_contado,
        });
        this.politicasVentaModificadas.delete(politica.id);
      }

      console.log('Todas las políticas de venta guardadas');
      this.mensajeGuardado = `${modificadas.length} política(s) de venta guardada(s)`;
      this.guardando = false;

      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 2000);
    } catch (error) {
      console.error('Error al guardar políticas de venta:', error);
      this.guardando = false;
      this.mensajeGuardado = 'Error al guardar las políticas de venta';
      setTimeout(() => {
        this.mensajeGuardado = '';
      }, 3000);
    }
  }

  get cantidadVentaModificadas(): number {
    return this.politicasVentaModificadas.size;
  }

  // ==================== UTILIDADES ====================

  getNombreMes(mes: number): string {
    return this.nombresMeses[mes - 1] || `Mes ${mes}`;
  }

  get cantidadModificadasActual(): number {
    return this.pestanaActiva === 'compra' 
      ? this.cantidadCompraModificadas 
      : this.cantidadVentaModificadas;
  }

  guardarTodasActual(): void {
    if (this.pestanaActiva === 'compra') {
      this.guardarTodasCompra();
    } else {
      this.guardarTodasVenta();
    }
  }

  // ==================== CONTROL DE COLAPSO ====================

  toggleAnioCompra(anio: number): void {
    if (this.aniosCompraColapsados.has(anio)) {
      this.aniosCompraColapsados.delete(anio);
    } else {
      this.aniosCompraColapsados.add(anio);
    }
  }

  toggleAnioVenta(anio: number): void {
    if (this.aniosVentaColapsados.has(anio)) {
      this.aniosVentaColapsados.delete(anio);
    } else {
      this.aniosVentaColapsados.add(anio);
    }
  }

  isAnioCompraCollapsed(anio: number): boolean {
    return this.aniosCompraColapsados.has(anio);
  }

  isAnioVentaCollapsed(anio: number): boolean {
    return this.aniosVentaColapsados.has(anio);
  }
}
