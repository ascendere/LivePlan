import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Producto, Supuestos, VariablesSensibilidad, VentasDiarias, VariacionAnual, Macros, PreciosProducto, Costos, ComposicionFinanciamiento } from '../../interfaces/';
import { DepreciacionAnual } from '../../interfaces/depreciacion.interface';

/**
 * Servicio de estado compartido para gestionar la persistencia de datos
 * entre diferentes componentes y secciones de la aplicación.
 * 
 * Usa RxJS BehaviorSubject para mantener un estado reactivo que notifica
 * automáticamente a todos los suscriptores cuando los datos cambian.
 */
@Injectable({
  providedIn: 'root'
})
export class DatosStateService {
  // ========== SUBJECTS (fuentes de datos) ==========
  private macrosSubject = new BehaviorSubject<Macros | null>(null);
  private productosSubject = new BehaviorSubject<Producto[]>([]);
  private supuestosSubject = new BehaviorSubject<Supuestos | null>(null);
  private ventasDiariasSubject = new BehaviorSubject<VentasDiarias[]>([]);
  private variablesSensibilidadSubject = new BehaviorSubject<VariablesSensibilidad | null>(null);
  private variacionAnualSubject = new BehaviorSubject<VariacionAnual | null>(null);
  private preciosProductoSubject = new BehaviorSubject<PreciosProducto[]>([]);
  private costosProductoSubject = new BehaviorSubject<Costos[]>([]);
  private composicionFinanciamientoSubject = new BehaviorSubject<ComposicionFinanciamiento | null>(null);
  private depreciacionesSubject = new BehaviorSubject<DepreciacionAnual[]>([]);

  // ========== OBSERVABLES (para suscripción) ==========
  public macros$: Observable<Macros | null> = this.macrosSubject.asObservable();
  public productos$: Observable<Producto[]> = this.productosSubject.asObservable();
  public supuestos$: Observable<Supuestos | null> = this.supuestosSubject.asObservable();
  public ventasDiarias$: Observable<VentasDiarias[]> = this.ventasDiariasSubject.asObservable();
  public variablesSensibilidad$: Observable<VariablesSensibilidad | null> = this.variablesSensibilidadSubject.asObservable();
  public variacionAnual$: Observable<VariacionAnual | null> = this.variacionAnualSubject.asObservable();
  public preciosProducto$: Observable<PreciosProducto[]> = this.preciosProductoSubject.asObservable();
  public costosProducto$: Observable<Costos[]> = this.costosProductoSubject.asObservable();
  public composicionFinanciamiento$: Observable<ComposicionFinanciamiento | null> = this.composicionFinanciamientoSubject.asObservable();
  public depreciaciones$: Observable<DepreciacionAnual[]> = this.depreciacionesSubject.asObservable();

  constructor() {
    console.log('DatosStateService inicializado');
  }

  // ========== MÉTODOS PARA PRODUCTOS ==========
  
  /**
   * Actualiza la lista completa de productos
   */
  setProductos(productos: Producto[]): void {
    console.log('Estado actualizado - Productos:', productos);
    this.productosSubject.next(productos);
  }

  /**
   * Obtiene el valor actual de productos (sin suscripción)
   */
  getProductos(): Producto[] {
    return this.productosSubject.value;
  }

  /**
   * Agrega un nuevo producto al estado
   */
  addProducto(producto: Producto): void {
    const productos = [...this.productosSubject.value, producto];
    this.setProductos(productos);
  }

  /**
   * Actualiza un producto existente en el estado
   */
  updateProducto(index: number, producto: Producto): void {
    const productos = [...this.productosSubject.value];
    productos[index] = producto;
    this.setProductos(productos);
  }

  /**
   * Actualiza un producto por su ID
   */
  updateProductoById(id: number, producto: Producto): void {
    const productos = [...this.productosSubject.value];
    const index = productos.findIndex(p => p.id === id);
    if (index !== -1) {
      productos[index] = producto;
      this.setProductos(productos);
    }
  }

  /**
   * Elimina un producto del estado
   */
  removeProducto(index: number): void {
    const productos = [...this.productosSubject.value];
    productos.splice(index, 1);
    this.setProductos(productos);
  }

  // ========== MÉTODOS PARA SUPUESTOS ==========
  
  setSupuestos(supuestos: Supuestos): void {
    console.log('Estado actualizado - Supuestos:', supuestos);
    this.supuestosSubject.next(supuestos);
  }

  getSupuestos(): Supuestos | null {
    return this.supuestosSubject.value;
  }

  // ========== MÉTODOS PARA VENTAS DIARIAS ==========
  
  setVentasDiarias(ventas: VentasDiarias[]): void {
    console.log('Estado actualizado - Ventas Diarias:', ventas);
    this.ventasDiariasSubject.next(ventas);
  }

  getVentasDiarias(): VentasDiarias[] {
    return this.ventasDiariasSubject.value;
  }

  /**
   * Actualiza una venta diaria específica
   */
  updateVentaDiaria(index: number, venta: VentasDiarias): void {
    const ventas = [...this.ventasDiariasSubject.value];
    ventas[index] = venta;
    this.setVentasDiarias(ventas);
  }

  // ========== MÉTODOS PARA VARIABLES DE SENSIBILIDAD ==========
  
  setVariablesSensibilidad(variables: VariablesSensibilidad): void {
    console.log('Estado actualizado - Variables de Sensibilidad:', variables);
    this.variablesSensibilidadSubject.next(variables);
  }

  getVariablesSensibilidad(): VariablesSensibilidad | null {
    return this.variablesSensibilidadSubject.value;
  }

  // ========== MÉTODOS PARA VARIACIÓN ANUAL ==========
  
  setVariacionAnual(variacion: VariacionAnual): void {
    console.log('Estado actualizado - Variación Anual:', variacion);
    this.variacionAnualSubject.next(variacion);
  }

  getVariacionAnual(): VariacionAnual | null {
    return this.variacionAnualSubject.value;
  }

  // ========== MÉTODOS PARA MACROS ==========
  
  setMacros(macros: Macros): void {
    console.log('Estado actualizado - Indicadores Macroeconómicos:', macros);
    this.macrosSubject.next(macros);
  }

  getMacros(): Macros | null {
    return this.macrosSubject.value;
  }

  // ========== MÉTODOS PARA PRECIOS DE PRODUCTOS ==========
  
  setPreciosProducto(precios: PreciosProducto[]): void {
    console.log('Estado actualizado - Precios de Productos:', precios);
    this.preciosProductoSubject.next(precios);
  }

  getPreciosProducto(): PreciosProducto[] {
    return this.preciosProductoSubject.value;
  }

  /**
   * Actualiza un precio específico en el estado
   */
  updatePrecioProducto(index: number, precio: PreciosProducto): void {
    const precios = [...this.preciosProductoSubject.value];
    precios[index] = precio;
    this.setPreciosProducto(precios);
  }

  // ========== MÉTODOS PARA COSTOS DE PRODUCTOS ==========
  
  setCostosProducto(costos: Costos[]): void {
    console.log('Estado actualizado - Costos de Productos:', costos);
    this.costosProductoSubject.next(costos);
  }

  getCostosProducto(): Costos[] {
    return this.costosProductoSubject.value;
  }

  // ========== MÉTODOS PARA DEPRECIACIONES ==========
  
  setDepreciaciones(depreciaciones: DepreciacionAnual[]): void {
    console.log('Estado actualizado - Depreciaciones:', depreciaciones);
    this.depreciacionesSubject.next(depreciaciones);
  }

  getDepreciaciones(): DepreciacionAnual[] {
    return this.depreciacionesSubject.value;
  }

  // ========== MÉTODOS PARA COMPOSICIÓN FINANCIAMIENTO ==========

  /**
   * Actualiza la composición de financiamiento
   */
  setComposicionFinanciamiento(composicion: ComposicionFinanciamiento): void {
    console.log('Estado actualizado - Composición Financiamiento:', composicion);
    this.composicionFinanciamientoSubject.next(composicion);
  }

  /**
   * Obtiene el valor actual de composición financiamiento (sin suscripción)
   */
  getComposicionFinanciamiento(): ComposicionFinanciamiento | null {
    return this.composicionFinanciamientoSubject.value;
  }

  // ========== MÉTODOS UTILITARIOS ==========
  
  /**
   * Limpia todo el estado (útil al cambiar de plan)
   */
  clearState(): void {
    console.log('Estado limpiado');
    this.macrosSubject.next(null);
    this.productosSubject.next([]);
    this.supuestosSubject.next(null);
    this.ventasDiariasSubject.next([]);
    this.variablesSensibilidadSubject.next(null);
    this.variacionAnualSubject.next(null);
    this.preciosProductoSubject.next([]);
    this.costosProductoSubject.next([]);
    this.composicionFinanciamientoSubject.next(null);
    this.depreciacionesSubject.next([]);
  }

  /**
   * Recarga todos los datos desde el estado actual
   */
  reloadState(): void {
    console.log('Estado recargado');
    // Forzar emisión de los valores actuales
    this.macrosSubject.next(this.macrosSubject.value);
    this.productosSubject.next(this.productosSubject.value);
    this.supuestosSubject.next(this.supuestosSubject.value);
    this.ventasDiariasSubject.next(this.ventasDiariasSubject.value);
    this.variablesSensibilidadSubject.next(this.variablesSensibilidadSubject.value);
    this.variacionAnualSubject.next(this.variacionAnualSubject.value);
    this.preciosProductoSubject.next(this.preciosProductoSubject.value);
    this.costosProductoSubject.next(this.costosProductoSubject.value);
    this.composicionFinanciamientoSubject.next(this.composicionFinanciamientoSubject.value);
    this.depreciacionesSubject.next(this.depreciacionesSubject.value);
  }
}
