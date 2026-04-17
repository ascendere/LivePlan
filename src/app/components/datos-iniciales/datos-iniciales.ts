import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  Producto,
  Supuestos,
  VariablesSensibilidad,
  VentasDiarias,
  VariacionAnual,
  Macros,
  PreciosProducto,
  Costos,
  ComposicionFinanciamiento,
} from '../../interfaces/';
import { AuthService, InversionService, DatosStateService } from '../../core/services';

@Component({
  selector: 'app-datos-iniciales',
  standalone: false,
  templateUrl: './datos-iniciales.html',
  styleUrl: './datos-iniciales.css',
})
export class DatosIniciales implements OnInit, OnDestroy {
  planId: number = 0;
  seccionActual: number = 0;
  isSidebarCollapsed = false;

  // Suscripciones para limpiar en OnDestroy
  private subscriptions: Subscription[] = [];

  // Secciones disponibles
  secciones = [
    { id: 1, titulo: 'Indicadores Macro Económicos', tipo: 'formulario' },
    { id: 2, titulo: 'Composición del Financiamiento de las Inversiones', tipo: 'formulario' },
    { id: 3, titulo: 'Productos / Servicios', tipo: 'tabla' },
    { id: 4, titulo: 'Supuestos', tipo: 'formulario' },
    { id: 5, titulo: 'Ventas por Día', tipo: 'tabla' },
    // { id: 6, titulo: 'Variables de Sensibilidad', tipo: 'formulario' },
    { id: 6, titulo: 'Variación Anual', tipo: 'tabla' },
    { id: 7, titulo: 'Precio base y precio sensibilizado', tipo: 'tabla' },
    { id: 8, titulo: 'Costos de Productos/Servicios', tipo: 'tabla' },
  ];

  // ========== ESTADOS DE GUARDADO ==========
  estadoGuardadoMacros: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorMacros: string = '';

  estadoGuardadoComposicion: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorComposicion: string = '';

  estadoGuardadoProductos: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorProductos: string = '';

  estadoGuardadoSupuestos: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorSupuestos: string = '';

  estadoGuardadoVentas: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorVentas: string = '';

  estadoGuardadoVariables: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorVariables: string = '';

  estadoGuardadoVariacion: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorVariacion: string = '';

  estadoGuardadoPrecios: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorPrecios: string = '';

  estadoGuardadoCostos: 'idle' | 'guardando' | 'exito' | 'error' = 'idle';
  mensajeErrorCostos: string = '';

  // ========== MACROS ==========
  macros: Macros = {
    plan_negocio_id: 0,
    tipo_cambio: 0,
    inflacion: 0,
    tasa_deuda: 0,
    tasa_interes: 0,
    tasa_impuesto: 0,
    ptu: 0,
    diasxmes: 0,
    recalc: true,
  };
  camposMacrosModificados: Set<string> = new Set(); // Campos modificados

  // ========== COMPOSICIÓN DEL FINANCIAMIENTO DE LAS INVERSIONES ==========
  composicionFinanciamiento: ComposicionFinanciamiento = {
    capital_porcentaje: 0,
    deuda_porcentaje: 0,
    total_porcentaje: 0,
  };
  composicionModificada: boolean = false; // Flag para detectar cambios

  // ========== PRODUCTOS ==========
  productos: Producto[] = [];
  nuevoProducto: Producto = this.resetProducto();
  productoEnEdicion: { index: number; producto: Producto } | null = null;

  // ========== Supuestos ==========
  supuestos: Supuestos = {
    plan_negocio_id: 0,
    porcen_ventas: 0,
    variacion_porcen_ventas: 0,
    ptu: 0,
    isr: 0,
    recalc: true,
  };

  // ========== VENTAS DIARIAS ==========
  ventasDiarias: VentasDiarias[] = [];
  ventasDiariasModificadas: Set<number> = new Set(); // IDs de productos modificados

  // ========== Variables de sensibilidad ==========
  variablesSensibilidad: VariablesSensibilidad = {
    id: 0,
    plan_negocio_id: 0,
    cantidad_volumen: 0,
    precio: 0,
    costo: 0,
    recalc: true,
  };

  // ========== Variación Anual ==========
  variacionAnual: VariacionAnual = {
    id: 0,
    plan_negocio_id: 0,
    anio1: 0,
    anio2: 0,
    anio3: 0,
    anio4: 0,
    anio5: 0,
    recalc: true,
  };

  // ========== Precios de Productos/Servicios ==========
  preciosProducto: PreciosProducto[] = [];
  preciosModificados: Set<number> = new Set(); // IDs de precios modificados

  // ========== Costos de Productos/Servicios ==========
  costosProducto: Costos[] = [];
  costosModificados: Set<number> = new Set(); // IDs de costos modificados
  productosConCostosCache: Array<{ productoId: number; producto: string; costos: Costos[] }> = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inversionService: InversionService,
    private authService: AuthService,
    private datosStateService: DatosStateService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Datos Iniciales:', this.planId);

      // Limpiar estado anterior al cambiar de plan
      this.datosStateService.clearState();

      // Cargar datos desde backend
      this.cargarDatos();

      // Suscribirse a cambios en el estado
      this.setupSubscriptions();
    });
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Configura las suscripciones a los observables del estado
   */
  private setupSubscriptions(): void {
    // Suscribirse a cambios en macros
    const macrosSub = this.datosStateService.macros$.subscribe((macros) => {
      if (macros) {
        this.macros = macros;
        // console.log('Macros actualizados desde estado:', macros);
      }
    });

    // Suscribirse a cambios en productos
    const productosSub = this.datosStateService.productos$.subscribe((productos) => {
      this.productos = productos;
      // console.log('Productos actualizados desde estado:', productos);
    });

    // Suscribirse a cambios en supuestos
    const supuestosSub = this.datosStateService.supuestos$.subscribe((supuestos) => {
      if (supuestos) {
        this.supuestos = supuestos;
        // console.log('Supuestos actualizados desde estado:', supuestos);
      }
    });

    // Suscribirse a cambios en ventas diarias
    const ventasSub = this.datosStateService.ventasDiarias$.subscribe((ventas) => {
      this.ventasDiarias = ventas;
      // console.log('Ventas diarias actualizadas desde estado:', ventas);
    });

    // Suscribirse a cambios en variables de sensibilidad
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe((variables) => {
      if (variables) {
        this.variablesSensibilidad = variables;
        // console.log('Variables de sensibilidad actualizadas desde estado:', variables);
      }
    });

    // Suscribirse a cambios en variación anual
    const variacionSub = this.datosStateService.variacionAnual$.subscribe((variacion) => {
      if (variacion) {
        this.variacionAnual = variacion;
        // console.log('Variación anual actualizada desde estado:', variacion);
      }
    });

    // Suscribirse a cambios en precios de productos
    const preciosSub = this.datosStateService.preciosProducto$.subscribe((precios) => {
      this.preciosProducto = precios;
      // console.log('Precios de productos actualizados desde estado:', precios);
    });

    // Suscribirse a cambios en costos de productos
    const costosSub = this.datosStateService.costosProducto$.subscribe((costos) => {
      this.costosProducto = costos;
      this.actualizarCacheCostos();
      // console.log('Costos de productos actualizados desde estado:', costos);
    });

    // Suscribirse a cambios en composición de financiamiento
    const composicionSub = this.datosStateService.composicionFinanciamiento$.subscribe(
      (composicion) => {
        if (composicion) {
          this.composicionFinanciamiento = composicion;
          // console.log('Composición de financiamiento actualizada desde estado:', composicion);
        }
      },
    );

    // Guardar suscripciones para limpiar después
    this.subscriptions.push(
      macrosSub,
      productosSub,
      supuestosSub,
      ventasSub,
      variablesSub,
      variacionSub,
      preciosSub,
      costosSub,
      composicionSub,
    );
  }

  // ========== MÉTODOS PARA MACROS ==========

  /**
   * Marca un campo de macros como modificado
   */
  onMacroFieldChange(fieldName: string): void {
    this.camposMacrosModificados.add(fieldName);
    // console.log('Campo macro modificado:', fieldName, 'Total modificados:', this.camposMacrosModificados.size);
  }

  /**
   * Verifica si hay campos de macros modificados
   */
  hayMacrosModificados(): boolean {
    return this.camposMacrosModificados.size > 0;
  }

  // ========== MÉTODOS HELPER PARA ESTADOS DE GUARDADO ==========

  /**
   * Resetea todos los estados de una sección
   */
  private resetearEstado(seccion: string): void {
    switch (seccion) {
      case 'macros':
        this.estadoGuardadoMacros = 'idle';
        this.mensajeErrorMacros = '';
        break;
      case 'composicion':
        this.estadoGuardadoComposicion = 'idle';
        this.mensajeErrorComposicion = '';
        break;
      case 'productos':
        this.estadoGuardadoProductos = 'idle';
        this.mensajeErrorProductos = '';
        break;
      case 'supuestos':
        this.estadoGuardadoSupuestos = 'idle';
        this.mensajeErrorSupuestos = '';
        break;
      case 'ventas':
        this.estadoGuardadoVentas = 'idle';
        this.mensajeErrorVentas = '';
        break;
      case 'variables':
        this.estadoGuardadoVariables = 'idle';
        this.mensajeErrorVariables = '';
        break;
      case 'variacion':
        this.estadoGuardadoVariacion = 'idle';
        this.mensajeErrorVariacion = '';
        break;
      case 'precios':
        this.estadoGuardadoPrecios = 'idle';
        this.mensajeErrorPrecios = '';
        break;
    }
  }

  /**
   * Muestra mensaje de éxito y lo oculta después de 3 segundos
   */
  private mostrarExito(seccion: string): void {
    switch (seccion) {
      case 'macros':
        this.estadoGuardadoMacros = 'exito';
        setTimeout(() => (this.estadoGuardadoMacros = 'idle'), 3000);
        break;
      case 'composicion':
        this.estadoGuardadoComposicion = 'exito';
        setTimeout(() => (this.estadoGuardadoComposicion = 'idle'), 3000);
        break;
      case 'productos':
        this.estadoGuardadoProductos = 'exito';
        setTimeout(() => (this.estadoGuardadoProductos = 'idle'), 3000);
        break;
      case 'supuestos':
        this.estadoGuardadoSupuestos = 'exito';
        setTimeout(() => (this.estadoGuardadoSupuestos = 'idle'), 3000);
        break;
      case 'ventas':
        this.estadoGuardadoVentas = 'exito';
        setTimeout(() => (this.estadoGuardadoVentas = 'idle'), 3000);
        break;
      case 'variables':
        this.estadoGuardadoVariables = 'exito';
        setTimeout(() => (this.estadoGuardadoVariables = 'idle'), 3000);
        break;
      case 'variacion':
        this.estadoGuardadoVariacion = 'exito';
        setTimeout(() => (this.estadoGuardadoVariacion = 'idle'), 3000);
        break;
      case 'precios':
        this.estadoGuardadoPrecios = 'exito';
        setTimeout(() => (this.estadoGuardadoPrecios = 'idle'), 3000);
        break;
      case 'costos':
        this.estadoGuardadoCostos = 'exito';
        setTimeout(() => (this.estadoGuardadoCostos = 'idle'), 3000);
        break;
    }
  }

  /**
   * Muestra mensaje de error y lo oculta después de 5 segundos
   */
  private mostrarError(seccion: string, mensaje: string): void {
    switch (seccion) {
      case 'macros':
        this.estadoGuardadoMacros = 'error';
        this.mensajeErrorMacros = mensaje;
        setTimeout(() => {
          this.estadoGuardadoMacros = 'idle';
          this.mensajeErrorMacros = '';
        }, 5000);
        break;
      case 'composicion':
        this.estadoGuardadoComposicion = 'error';
        this.mensajeErrorComposicion = mensaje;
        setTimeout(() => {
          this.estadoGuardadoComposicion = 'idle';
          this.mensajeErrorComposicion = '';
        }, 5000);
        break;
      case 'productos':
        this.estadoGuardadoProductos = 'error';
        this.mensajeErrorProductos = mensaje;
        setTimeout(() => {
          this.estadoGuardadoProductos = 'idle';
          this.mensajeErrorProductos = '';
        }, 5000);
        break;
      case 'supuestos':
        this.estadoGuardadoSupuestos = 'error';
        this.mensajeErrorSupuestos = mensaje;
        setTimeout(() => {
          this.estadoGuardadoSupuestos = 'idle';
          this.mensajeErrorSupuestos = '';
        }, 5000);
        break;
      case 'ventas':
        this.estadoGuardadoVentas = 'error';
        this.mensajeErrorVentas = mensaje;
        setTimeout(() => {
          this.estadoGuardadoVentas = 'idle';
          this.mensajeErrorVentas = '';
        }, 5000);
        break;
      case 'variables':
        this.estadoGuardadoVariables = 'error';
        this.mensajeErrorVariables = mensaje;
        setTimeout(() => {
          this.estadoGuardadoVariables = 'idle';
          this.mensajeErrorVariables = '';
        }, 5000);
        break;
      case 'variacion':
        this.estadoGuardadoVariacion = 'error';
        this.mensajeErrorVariacion = mensaje;
        setTimeout(() => {
          this.estadoGuardadoVariacion = 'idle';
          this.mensajeErrorVariacion = '';
        }, 5000);
        break;
      case 'precios':
        this.estadoGuardadoPrecios = 'error';
        this.mensajeErrorPrecios = mensaje;
        setTimeout(() => {
          this.estadoGuardadoPrecios = 'idle';
          this.mensajeErrorPrecios = '';
        }, 5000);
        break;
      case 'costos':
        this.estadoGuardadoCostos = 'error';
        this.mensajeErrorCostos = mensaje;
        setTimeout(() => {
          this.estadoGuardadoCostos = 'idle';
          this.mensajeErrorCostos = '';
        }, 5000);
        break;
    }
  }

  /**
   * Guarda los indicadores macroeconómicos
   */
  guardarMacros(): void {
    // console.log('Guardando indicadores macroeconómicos:', this.macros);

    // Validar que tenga ID antes de actualizar
    if (!this.macros.id) {
      this.mostrarError(
        'macros',
        'No se puede actualizar. Primero debe existir un registro de macros.',
      );
      console.error('Error: No se puede actualizar. Primero debe existir un registro de macros.');
      return;
    }

    // Construir objeto con solo los campos modificados
    const macrosParaActualizar: Partial<Macros> = { recalc: true };

    this.camposMacrosModificados.forEach((campo) => {
      if (campo in this.macros) {
        (macrosParaActualizar as any)[campo] = (this.macros as any)[campo];
      }
    });

    // console.log('Campos a actualizar:', macrosParaActualizar);

    // Marcar como guardando
    this.estadoGuardadoMacros = 'guardando';

    this.inversionService
      .actualizarMacros(this.macros.id, macrosParaActualizar as Macros)
      .then((response) => {
        // console.log('Indicadores macroeconómicos guardados exitosamente:', response);
        // Actualizar el estado compartido
        this.datosStateService.setMacros(response);
        // Limpiar el Set de campos modificados
        this.camposMacrosModificados.clear();
        // console.log('Set de campos modificados limpiado');
        // Mostrar éxito
        this.mostrarExito('macros');
      })
      .catch((error) => {
        console.error('Error al guardar indicadores macroeconómicos:', error);
        this.mostrarError('macros', error.message || 'Error al guardar');
      });
  }

  // ========== MÉTODOS DE NAVEGACIÓN ==========
  get seccionActiva() {
    return this.secciones[this.seccionActual];
  }

  siguiente(): void {
    if (this.seccionActual < this.secciones.length - 1) {
      this.seccionActual++;
    }
  }

  anterior(): void {
    if (this.seccionActual > 0) {
      this.seccionActual--;
    }
  }

  haySiguiente(): boolean {
    return this.seccionActual < this.secciones.length - 1;
  }

  hayAnterior(): boolean {
    return this.seccionActual > 0;
  }

  // Método para verificar si hay productos nuevos sin guardar
  hayProductosNuevos(): boolean {
    return this.productos.some((p) => !p.id);
  }

  // Método para contar productos nuevos
  contarProductosNuevos(): number {
    return this.productos.filter((p) => !p.id).length;
  }

  // ========== MÉTODOS PARA VENTAS DIARIAS ==========

  /**
   * Marca una venta como modificada cuando el usuario edita el valor
   */
  onVentaDiariaChange(productoServicioId: number): void {
    this.ventasDiariasModificadas.add(productoServicioId);
    // console.log('Venta marcada como modificada:', productoServicioId, 'Total modificadas:', this.ventasDiariasModificadas.size);
  }

  /**
   * Verifica si hay ventas diarias modificadas
   */
  hayVentasDiariasModificadas(): boolean {
    return this.ventasDiariasModificadas.size > 0;
  }

  guardarVentasDiarias(): void {
    // console.log('Guardando ventas diarias...');
    // console.log('Total de ventas modificadas:', this.ventasDiariasModificadas.size);

    // Filtrar solo las ventas que fueron realmente modificadas
    const ventasParaActualizar = this.ventasDiarias
      .map((venta, index) => ({ venta, index }))
      .filter(
        ({ venta }) =>
          this.ventasDiariasModificadas.has(venta.producto_servicio_id) &&
          venta.venta_dia !== null &&
          venta.venta_dia !== undefined,
      );

    if (ventasParaActualizar.length === 0) {
      // console.log('No hay ventas modificadas para actualizar');
      return;
    }

    // console.log(`Actualizando ${ventasParaActualizar.length} venta(s) modificada(s)`);

    // Marcar como guardando
    this.estadoGuardadoVentas = 'guardando';

    // Crear promesas con lógica de recalc optimizada
    const promesas = ventasParaActualizar.map(({ venta, index }, arrayIndex) => {
      // Solo el último elemento debe tener recalc: true
      const esUltimo = arrayIndex === ventasParaActualizar.length - 1;
      const recalc = esUltimo;

      // console.log(`[${arrayIndex + 1}/${ventasParaActualizar.length}] Producto: ${venta.producto_servicio?.nombre || 'Sin nombre'}, ID: ${venta.producto_servicio_id}, Valor: ${venta.venta_dia}, recalc: ${recalc}`);

      return this.inversionService
        .actualizarVentaDiaria(venta.id, venta.venta_dia, recalc)
        .then((response) => {
          // console.log('✓ Venta actualizada:', response);
          // Actualizar solo el campo venta_dia, manteniendo el resto de la información
          this.ventasDiarias[index] = {
            ...this.ventasDiarias[index],
            venta_dia: response.venta_dia,
            // Preservar el objeto producto_servicio con el nombre
          };
          return response;
        });
    });

    Promise.all(promesas)
      .then((responses) => {
        // console.log('✓ Todas las ventas actualizadas exitosamente:', responses.length);
        // console.log(`Optimización: recalc ejecutado 1 vez (último de ${responses.length} actualizaciones)`);

        // Limpiar el Set de modificadas después de guardar
        this.ventasDiariasModificadas.clear();
        // console.log('Set de ventas modificadas limpiado');

        // Recargar costos después de actualizar ventas (el backend puede recalcular)
        this.recargarCostosProducto();

        // Mostrar éxito
        this.mostrarExito('ventas');
      })
      .catch((error) => {
        console.error('✗ Error al guardar ventas diarias:', error);
        this.mostrarError('ventas', error.message || 'Error al guardar');
      });
  }

  // ========== MÉTODOS PARA PRODUCTOS ==========
  resetProducto(): Producto {
    return {
      nombre: '',
      recalc: false,
    };
  }

  // ========== MÉTODOS PARA SUPUESTOS ==========
  guardarSupuestos(): void {
    // console.log('Guardando supuestos:', this.supuestos);

    // Validar que tenga ID antes de actualizar
    if (!this.supuestos.id) {
      this.mostrarError(
        'supuestos',
        'No se puede actualizar. Primero debe existir un registro de supuestos.',
      );
      // console.log('Error: No se puede actualizar. Primero debe existir un registro de supuestos.');
      return;
    }

    // Marcar como guardando
    this.estadoGuardadoSupuestos = 'guardando';

    this.inversionService
      .actualizarSupuestos(this.supuestos.id, this.supuestos)
      .then((response) => {
        // console.log('Supuestos guardados exitosamente:', response);
        // Actualizar el estado compartido
        this.datosStateService.setSupuestos(response);
        // Mostrar éxito
        this.mostrarExito('supuestos');
      })
      .catch((error) => {
        console.error('Error al guardar supuestos:', error);
        this.mostrarError('supuestos', error.message || 'Error al guardar');
      });
  }

  // ========== MÉTODOS PARA PRODUCTOS (continuación) ==========

  agregarProducto(): void {
    if (this.validarProducto()) {
      const nuevoProducto = { ...this.nuevoProducto };
      // Agregar al estado compartido
      this.datosStateService.addProducto(nuevoProducto);
      this.nuevoProducto = this.resetProducto();
      // console.log('Producto agregado a la lista');
    } else {
      // console.log('Por favor completa el nombre del producto');
    }
  }

  editarProducto(index: number): void {
    this.productoEnEdicion = {
      index: index,
      producto: { ...this.productos[index] },
    };
  }

  guardarEdicion(): void {
    if (this.productoEnEdicion?.producto.nombre) {
      const productoEditado = this.productoEnEdicion.producto;
      const index = this.productoEnEdicion.index;

      // Si el producto tiene ID (ya existe en backend), actualizar en backend
      if (productoEditado.id) {
        this.inversionService
          .actualizarProductoServicio(productoEditado.id, productoEditado.nombre)
          .then((response) => {
            // console.log('Producto actualizado en backend:', response);
            // Actualizar en el estado compartido
            this.datosStateService.updateProducto(index, response);

            // Recargar ventas diarias para reflejar el cambio de nombre
            this.recargarVentasDiarias();

            // Recargar precios para reflejar el cambio de nombre
            this.recargarPreciosProducto();

            this.cancelarEdicion();
          })
          .catch((error) => {
            console.error('Error al actualizar producto:', error);
            // console.log('Error al actualizar el producto. Por favor, intenta de nuevo.');
          });
      } else {
        // Si no tiene ID, solo actualizar en el estado
        this.datosStateService.updateProducto(index, productoEditado);
        this.cancelarEdicion();
      }
    } else {
      // console.log('Por favor completa el nombre del producto');
    }
  }

  cancelarEdicion(): void {
    this.productoEnEdicion = null;
  }

  eliminarProducto(index: number): void {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      const producto = this.productos[index];

      // Si el producto tiene ID (existe en backend), eliminarlo del backend
      if (producto.id) {
        this.inversionService
          .eliminarProductoServicio(producto.id)
          .then((response) => {
            // console.log('Producto eliminado del backend:', response);
            // Actualizar el estado compartido
            this.datosStateService.removeProducto(index);

            // Recargar ventas diarias para eliminar la fila del producto eliminado
            this.recargarVentasDiarias();

            // Recargar precios para eliminar el precio del producto eliminado
            this.recargarPreciosProducto();

            // Recargar la página para limpiar todos los estados y asegurar consistencia visual
            window.location.reload();
          })
          .catch((error) => {
            console.error('Error al eliminar producto:', error);
          });
      } else {
        // Si no tiene ID, solo eliminar del estado
        this.datosStateService.removeProducto(index);
      }
    }
  }

  validarProducto(): boolean {
    return !!this.nuevoProducto.nombre;
  }

  guardarProductos(): void {
    if (this.productos.length === 0) {
      return;
    }

    // console.log('Guardando productos:', this.productos);

    // Filtrar solo productos sin ID (nuevos productos que no están en el backend)
    const productosNuevos = this.productos.filter((p) => !p.id);

    if (productosNuevos.length === 0) {
      return;
    }

    // Marcar como guardando
    this.estadoGuardadoProductos = 'guardando';

    // Guardar cada producto nuevo individualmente
    const promesas = productosNuevos.map((producto) =>
      this.inversionService.addProductoServicio(this.planId, producto.nombre),
    );

    Promise.all(promesas)
      .then((responses) => {
        // console.log('Productos guardados exitosamente:', responses);

        // Actualizar los productos en el estado con los IDs devueltos
        const productosActualizados = [...this.productos];
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const productoNuevo = productosNuevos[i];

          if (response.id) {
            const productoIndex = productosActualizados.findIndex(
              (p) => p.nombre === productoNuevo.nombre && !p.id,
            );
            if (productoIndex !== -1) {
              productosActualizados[productoIndex] = response;
            }
          }
        }

        // Actualizar el estado compartido con los productos que ahora tienen ID
        this.datosStateService.setProductos(productosActualizados);

        // Recargar ventas diarias para incluir los nuevos productos
        this.recargarVentasDiarias();

        // Recargar precios para incluir los nuevos productos
        this.recargarPreciosProducto();

        // Recargar costos para incluir los nuevos productos
        this.recargarCostosProducto();

        // console.log('Recargando ventas, precios y costos para incluir nuevos productos...');

        // Mostrar éxito
        this.mostrarExito('productos');
      })
      .catch((error) => {
        console.error('Error al guardar productos:', error);
        this.mostrarError('productos', error.message || 'Error al guardar');
      });
  }

  /**
   * Recarga las ventas diarias desde el backend y actualiza el estado
   */
  private recargarVentasDiarias(): void {
    this.inversionService
      .getVentasDiarias(this.planId)
      .then((ventas) => {
        // console.log('Ventas diarias recargadas:', ventas);
        this.datosStateService.setVentasDiarias(ventas);
        // Limpiar el set de modificadas al recargar datos frescos
        this.ventasDiariasModificadas.clear();
      })
      .catch((error) => {
        console.error('Error al recargar ventas diarias:', error);
      });
  }

  /**
   * Recarga los precios de productos desde el backend y actualiza el estado
   */
  private recargarPreciosProducto(): void {
    this.inversionService
      .getPreciosProductoServicio(this.planId)
      .then((precios) => {
        // console.log('Precios de productos recargados:', precios);
        this.datosStateService.setPreciosProducto(precios);
        // Limpiar el set de modificados al recargar datos frescos
        this.preciosModificados.clear();
      })
      .catch((error) => {
        console.error('Error al recargar precios de productos:', error);
      });
  }

  // ========== MÉTODOS PARA DATOS FINANCIEROS ==========
  guardarDatosFinancieros(): void {
    // TODO: Llamar al endpoint POST /api/datos-financieros
    // this.inversionService.guardarDatosFinancieros(this.planId, this.datosFinancieros)
    //   .then(response => console.log('Datos financieros guardados:', response))
    //   .catch(error => console.error('Error:', error));
  }

  // ========== CARGAR DATOS EXISTENTES ==========
  cargarDatos(): void {
    // Cargar indicadores macroeconómicos desde el backend
    this.inversionService
      .getMacros(this.planId)
      .then((response) => {
        // console.log('Indicadores macroeconómicos cargados desde backend:', response);

        // Manejar si la respuesta es un array (tomar el primer elemento)
        const macrosData = Array.isArray(response) ? response[0] : response;

        if (macrosData) {
          const macros: Macros = {
            id: macrosData.id || 0,
            plan_negocio_id: macrosData.plan_negocio_id || this.planId,
            tipo_cambio: macrosData.tipo_cambio ?? 0,
            inflacion: macrosData.inflacion ?? 0,
            tasa_deuda: macrosData.tasa_deuda ?? 0,
            tasa_interes: macrosData.tasa_interes ?? 0,
            tasa_impuesto: macrosData.tasa_impuesto ?? 0,
            ptu: macrosData.ptu ?? 0,
            diasxmes: macrosData.diasxmes ?? 0,
          };
          // console.log('Macros procesados:', macros);
          // Actualizar el estado compartido
          this.datosStateService.setMacros(macros);
          // Limpiar el set de modificados al cargar datos frescos
          this.camposMacrosModificados.clear();
        }
      })
      .catch((error) => {
        console.error('Error al cargar indicadores macroeconómicos:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar los indicadores macroeconómicos');
        }
      });

    // Cargar productos existentes desde el backend
    this.inversionService
      .getProductosServicios(this.planId)
      .then((productos) => {
        // console.log('Productos cargados:', productos);
        // Actualizar el estado compartido
        this.datosStateService.setProductos(productos);
      })
      .catch((error) => {
        console.error('Error al cargar productos:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar los productos existentes');
        }
      });

    // Cargar supuestos existentes desde el backend
    this.inversionService
      .getSupuestos(this.planId)
      .then((response) => {
        // console.log('Supuestos cargados:', response);

        const supuestosData = Array.isArray(response) ? response[0] : response;

        if (supuestosData) {
          const supuestos: Supuestos = {
            id: supuestosData.id || 0,
            plan_negocio_id: this.planId,
            porcen_ventas: supuestosData.porcen_ventas || 0,
            variacion_porcen_ventas: supuestosData.variacion_porcen_ventas || 0,
            ptu: supuestosData.ptu || 0,
            isr: supuestosData.isr || 0,
          };
          // Actualizar el estado compartido
          this.datosStateService.setSupuestos(supuestos);
        }
      })
      .catch((error) => {
        console.error('Error al cargar supuestos:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar los supuestos existentes');
        }
      });

    // Cargar ventas diarias desde el backend
    this.inversionService
      .getVentasDiarias(this.planId)
      .then((ventas) => {
        // console.log('Ventas diarias cargadas:', ventas);
        // Actualizar el estado compartido
        this.datosStateService.setVentasDiarias(ventas);
        // Limpiar el set de modificadas al cargar datos frescos
        this.ventasDiariasModificadas.clear();
      })
      .catch((error) => {
        console.error('Error al cargar ventas diarias:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar las ventas diarias');
        }
      });

    // Cargar variables de sensibilidad desde el backend
    this.inversionService
      .getVariablesSensibilidad(this.planId)
      .then((response) => {
        // console.log('Variables de sensibilidad cargadas:', response);

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
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar las variables de sensibilidad');
        }
      });

    // Cargar variación anual desde el backend
    this.inversionService
      .getVariacionAnual(this.planId)
      .then((response) => {
        // console.log('Variación anual cargada:', response);

        const variacionData = Array.isArray(response) ? response[0] : response;

        if (variacionData) {
          const variacion: VariacionAnual = {
            id: variacionData.id || 0,
            plan_negocio_id: this.planId,
            anio1: variacionData.anio1 || 0,
            anio2: variacionData.anio2 || 0,
            anio3: variacionData.anio3 || 0,
            anio4: variacionData.anio4 || 0,
            anio5: variacionData.anio5 || 0,
          };
          // Actualizar el estado compartido
          this.datosStateService.setVariacionAnual(variacion);
        }
      })
      .catch((error) => {
        console.error('Error al cargar variación anual:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudo cargar la variación anual');
        }
      });

    // Cargar precios de productos desde el backend
    this.inversionService
      .getPreciosProductoServicio(this.planId)
      .then((precios) => {
        // console.log('Precios de productos cargados desde backend:', precios);
        // Actualizar el estado compartido
        this.datosStateService.setPreciosProducto(precios);
        // Limpiar el set de modificados al cargar datos frescos
        this.preciosModificados.clear();
      })
      .catch((error) => {
        console.error('Error al cargar precios de productos:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar los precios de productos');
        }
      });

    // Cargar costos de productos desde el backend
    this.inversionService
      .getCostosProductoServicio(this.planId)
      .then((costos) => {
        // console.log('Costos de productos cargados desde backend:', costos);
        // Actualizar el estado compartido
        this.datosStateService.setCostosProducto(costos);
        // Limpiar modificados
        this.costosModificados.clear();
      })
      .catch((error) => {
        console.error('Error al cargar costos de productos:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudieron cargar los costos de productos');
        }
      });

    // Cargar composición de financiamiento desde el backend
    this.inversionService
      .getComposicionFinanciamiento(this.planId)
      .then((response) => {
        // console.log('Composición de financiamiento cargada desde backend:', response);

        // Manejar si la respuesta es un array (tomar el primer elemento)
        const composicionData = Array.isArray(response) ? response[0] : response;

        if (composicionData) {
          const composicionCompleta: ComposicionFinanciamiento = {
            id: composicionData.id,
            plan_negocio_id: composicionData.plan_negocio_id || this.planId,
            capital_porcentaje: composicionData.capital_porcentaje ?? 0,
            deuda_porcentaje: composicionData.deuda_porcentaje ?? 0,
            total_porcentaje: composicionData.total_porcentaje ?? 0,
            total_inversion: composicionData.total_inversion ?? 0,
          };

          // console.log('Composición procesada:', composicionCompleta);

          // Actualizar el estado compartido
          this.datosStateService.setComposicionFinanciamiento(composicionCompleta);

          // Limpiar flag de modificado
          this.composicionModificada = false;
        }
      })
      .catch((error) => {
        console.error('Error al cargar composición de financiamiento:', error);
        if (!error.message.includes('404')) {
          console.warn('No se pudo cargar la composición de financiamiento');
        }
      });
  }

  // ========== MÉTODOS PARA VARIABLES DE SENSIBILIDAD ==========
  guardarVariablesSensibilidad(): void {
    // console.log('Guardando variables de sensibilidad:', this.variablesSensibilidad);

    // Validar que tenga ID antes de actualizar
    if (!this.variablesSensibilidad.id) {
      this.mostrarError('variables', 'No se puede actualizar. Primero debe existir un registro.');
      // console.log('Error: No se puede actualizar. Primero debe existir un registro.');
      return;
    }

    // Marcar como guardando
    this.estadoGuardadoVariables = 'guardando';

    this.inversionService
      .actualizarVariablesSensibilidad(this.variablesSensibilidad.id, this.variablesSensibilidad)
      .then((response) => {
        // console.log('Variables de sensibilidad guardadas exitosamente:', response);
        // Actualizar el objeto local con la respuesta
        this.variablesSensibilidad = response;
        // Mostrar éxito
        this.mostrarExito('variables');
      })
      .catch((error) => {
        console.error('Error al guardar variables de sensibilidad:', error);
        this.mostrarError('variables', error.message || 'Error al guardar');
      });
  }

  // ========== MÉTODOS PARA VARIACIÓN ANUAL ==========
  guardarVariacionAnual(): void {
    // console.log('Guardando variación anual:', this.variacionAnual);

    // Validar que tenga ID antes de actualizar
    if (!this.variacionAnual.id) {
      this.mostrarError('variacion', 'No se puede actualizar. Primero debe existir un registro.');
      // console.log('Error: No se puede actualizar. Primero debe existir un registro.');
      return;
    }

    // Marcar como guardando
    this.estadoGuardadoVariacion = 'guardando';

    this.inversionService
      .actualizarVariacionAnual(this.variacionAnual.id, this.variacionAnual)
      .then((response) => {
        // console.log('Variación anual guardada exitosamente:', response);
        // Actualizar el objeto local con la respuesta
        this.variacionAnual = response;
        // Mostrar éxito
        this.mostrarExito('variacion');
      })
      .catch((error) => {
        console.error('Error al guardar variación anual:', error);
        this.mostrarError('variacion', error.message || 'Error al guardar');
      });
  }

  // ========== MÉTODOS PARA PRECIOS DE PRODUCTOS ==========

  /**
   * Marca un precio como modificado cuando el usuario edita el valor
   */
  onPrecioChange(precioId: number): void {
    this.preciosModificados.add(precioId);
    // console.log('Precio marcado como modificado:', precioId, 'Total modificados:', this.preciosModificados.size);
  }

  /**
   * Verifica si hay precios modificados
   */
  hayPreciosModificados(): boolean {
    return this.preciosModificados.size > 0;
  }

  // ========== MÉTODOS PARA COSTOS DE PRODUCTOS ==========

  /**
   * Marca un costo como modificado cuando el usuario edita el valor
   */
  onCostoChange(costoId: number): void {
    this.costosModificados.add(costoId);
  }

  /**
   * Verifica si hay costos modificados
   */
  hayCostosModificados(): boolean {
    return this.costosModificados.size > 0;
  }

  /**
   * Agrupa los costos por producto/servicio
   * Retorna un mapa donde la clave es el producto_servicio_id
   */
  getCostosPorProducto(): Map<number, { producto: string; costos: Costos[] }> {
    const costosAgrupados = new Map<number, { producto: string; costos: Costos[] }>();

    this.costosProducto.forEach((costo) => {
      const productoId = costo.producto_servicio_id;

      if (!costosAgrupados.has(productoId)) {
        costosAgrupados.set(productoId, {
          producto: costo.producto_servicio?.nombre || 'Sin nombre',
          costos: [],
        });
      }

      costosAgrupados.get(productoId)!.costos.push(costo);
    });

    // Ordenar costos por categoría dentro de cada producto
    costosAgrupados.forEach((grupo) => {
      grupo.costos.sort((a, b) => a.categoria_costo_id - b.categoria_costo_id);
    });

    return costosAgrupados;
  }

  /**
   * Obtiene un array de productos con sus costos agrupados
   * Para usar con *ngFor en el template
   */
  getProductosConCostos(): Array<{ productoId: number; producto: string; costos: Costos[] }> {
    return this.productosConCostosCache;
  }

  private actualizarCacheCostos(): void {
    const costosAgrupados = this.getCostosPorProducto();
    this.productosConCostosCache = Array.from(costosAgrupados.entries()).map(([productoId, data]) => ({
      productoId,
      producto: data.producto,
      costos: data.costos,
    }));
  }

  /**
   * Calcula el total de costos para un producto
   */
  getTotalCostosProducto(costos: Costos[]): number {
    return costos.reduce((total, costo) => total + (costo.costo || 0), 0);
  }

  /**
   * Calcula el total de costos calculados para un producto
   */
  getTotalCostosCalcProducto(costos: Costos[]): number {
    return costos.reduce((total, costo) => total + (costo.costo_calc || 0), 0);
  }

  /**
   * Guarda los precios de productos modificados
   */
  guardarPreciosProducto(): void {
    // console.log('Guardando precios de productos...');
    // console.log('Total de precios modificados:', this.preciosModificados.size);

    // Filtrar solo los precios que fueron realmente modificados
    const preciosParaActualizar = this.preciosProducto
      .map((precio, index) => ({ precio, index }))
      .filter(
        ({ precio }) =>
          precio.id &&
          this.preciosModificados.has(precio.id) &&
          precio.precio !== null &&
          precio.precio !== undefined,
      );

    if (preciosParaActualizar.length === 0) {
      // console.log('No hay precios modificados para actualizar');
      return;
    }

    // console.log(`Actualizando ${preciosParaActualizar.length} precio(s) modificado(s)`);

    // Marcar como guardando
    this.estadoGuardadoPrecios = 'guardando';

    // Crear promesas con lógica de recalc optimizada (solo el último con true)
    const promesas = preciosParaActualizar.map(({ precio, index }, arrayIndex) => {
      // Solo el último elemento debe tener recalc: true
      const esUltimo = arrayIndex === preciosParaActualizar.length - 1;
      const recalc = esUltimo;

      const precioParaEnviar: Partial<PreciosProducto> = {
        precio: precio.precio,
        recalc: recalc,
      };

      // console.log(`[${arrayIndex + 1}/${preciosParaActualizar.length}] Producto: ${precio.producto_servicio?.nombre || 'Sin nombre'}, ID: ${precio.id}, Precio: ${precio.precio}, recalc: ${recalc}`);

      return this.inversionService
        .actualizarPreciosProductoServicio(precio.id!, precioParaEnviar)
        .then((response) => {
          // console.log('Precio actualizado:', response);
          // Actualizar el precio en el estado manteniendo la información completa
          this.preciosProducto[index] = {
            ...this.preciosProducto[index],
            precio: response.precio,
            precio_calc: response.precio_calc,
          };
          return response;
        });
    });

    Promise.all(promesas)
      .then((responses) => {
        // console.log('Todos los precios actualizados exitosamente:', responses.length);
        // console.log(`Optimización: recalc ejecutado 1 vez (último de ${responses.length} actualizaciones)`);

        // Recargar precios y costos para obtener valores calculados
        this.recargarPreciosProducto();
        this.recargarCostosProducto();

        // console.log('Recargando precios y costos desde backend para obtener valores calculados...');

        // Mostrar éxito
        this.mostrarExito('precios');
      })
      .catch((error) => {
        console.error('Error al guardar precios:', error);
        this.mostrarError('precios', error.message || 'Error al guardar');
      });
  }

  /**
   * Guarda los costos de productos modificados
   */
  guardarCostosProducto(): void {
    // Filtrar solo los costos que fueron realmente modificados
    const costosParaActualizar = this.costosProducto
      .map((costo, index) => ({ costo, index }))
      .filter(
        ({ costo }) =>
          costo.id &&
          this.costosModificados.has(costo.id) &&
          costo.costo !== null &&
          costo.costo !== undefined,
      );

    if (costosParaActualizar.length === 0) {
      return;
    }

    // Marcar como guardando
    this.estadoGuardadoCostos = 'guardando';

    // Crear promesas con lógica de recalc optimizada
    const promesas = costosParaActualizar.map(({ costo, index }, arrayIndex) => {
      // Solo el último elemento debe tener recalc: true
      const esUltimo = arrayIndex === costosParaActualizar.length - 1;
      const recalc = esUltimo;

      const costoParaEnviar: Partial<Costos> = {
        costo: costo.costo,
        recalc: recalc,
      };

      return this.inversionService
        .actualizarCostosProductoServicio(costo.id!, costoParaEnviar)
        .then((response) => {
          // Actualizar el costo en el estado
          this.costosProducto[index] = {
            ...this.costosProducto[index],
            costo: response.costo,
            costo_calc: response.costo_calc,
          };
          return response;
        });
    });

    Promise.all(promesas)
      .then(() => {
        // Recargar precios y costos
        this.recargarPreciosProducto();
        this.recargarCostosProducto();

        // Mostrar éxito
        this.mostrarExito('costos');
      })
      .catch((error) => {
        console.error('Error al guardar costos:', error);
        this.mostrarError('costos', error.message || 'Error al guardar');
      });
  }

  /**
   * Recarga los costos de productos desde el backend y actualiza el estado
   */
  private recargarCostosProducto(): void {
    this.inversionService
      .getCostosProductoServicio(this.planId)
      .then((costos) => {
        // console.log('Costos de productos recargados:', costos);
        this.datosStateService.setCostosProducto(costos);
        this.costosModificados.clear();
      })
      .catch((error) => {
        console.error('Error al recargar costos de productos:', error);
      });
  }

  // ========== MÉTODOS PARA COMPOSICIÓN DE FINANCIAMIENTO ==========

  /**
   * Se ejecuta cuando cambia el porcentaje de capital
   * Calcula automáticamente el porcentaje de deuda y el total
   */
  onCapitalPorcentajeChange(): void {
    // Asegurar que el valor está entre 0 y 100
    if (this.composicionFinanciamiento.capital_porcentaje! < 0) {
      this.composicionFinanciamiento.capital_porcentaje = 0;
    }
    if (this.composicionFinanciamiento.capital_porcentaje! > 100) {
      this.composicionFinanciamiento.capital_porcentaje = 100;
    }

    // Calcular automáticamente el porcentaje de deuda (complemento de capital)
    this.composicionFinanciamiento.deuda_porcentaje =
      100 - (this.composicionFinanciamiento.capital_porcentaje || 0);

    // Calcular el total basado en el total_inversion del backend
    this.calcularTotalComposicion();

    // Marcar como modificado
    this.composicionModificada = true;

    // console.log('Capital modificado:', this.composicionFinanciamiento.capital_porcentaje);
    // console.log('Deuda calculada:', this.composicionFinanciamiento.deuda_porcentaje);
  }

  /**
   * Calcula el total de la composición
   */
  private calcularTotalComposicion(): void {
    // Este método no es necesario si total_porcentaje siempre es 100
    // Pero lo dejamos por si se necesita calcular el total en términos monetarios
    this.composicionFinanciamiento.total_porcentaje =
      (this.composicionFinanciamiento.capital_porcentaje || 0) +
      (this.composicionFinanciamiento.deuda_porcentaje || 0);
  }

  /**
   * Calcula el monto de capital en términos monetarios
   */
  getMontoCapital(): number {
    const totalInversion = this.composicionFinanciamiento.total_inversion || 0;
    const porcentajeCapital = this.composicionFinanciamiento.capital_porcentaje || 0;
    return (totalInversion * porcentajeCapital) / 100;
  }

  /**
   * Calcula el monto de deuda en términos monetarios
   */
  getMontoDeuda(): number {
    const totalInversion = this.composicionFinanciamiento.total_inversion || 0;
    const porcentajeDeuda = this.composicionFinanciamiento.deuda_porcentaje || 0;
    return (totalInversion * porcentajeDeuda) / 100;
  }

  /**
   * Verifica si hay cambios pendientes en la composición
   */
  hayComposicionModificada(): boolean {
    return this.composicionModificada;
  }

  /**
   * Guarda la composición de financiamiento
   */
  guardarComposicionFinanciamiento(): void {
    // console.log('Guardando composición de financiamiento:', this.composicionFinanciamiento);

    // Validar que tenga ID antes de actualizar
    if (!this.composicionFinanciamiento.id) {
      this.mostrarError('composicion', 'No se puede actualizar. Primero debe existir un registro.');
      // console.log('Error: No se puede actualizar. Primero debe existir un registro.');
      return;
    }

    // Preparar datos para enviar (solo porcentajes, no el total)
    const composicionParaEnviar: Partial<ComposicionFinanciamiento> = {
      capital_porcentaje: this.composicionFinanciamiento.capital_porcentaje,
      deuda_porcentaje: this.composicionFinanciamiento.deuda_porcentaje,
      recalc: true,
    };

    // Marcar como guardando
    this.estadoGuardadoComposicion = 'guardando';

    this.inversionService
      .actualizarComposicionFinanciamiento(this.composicionFinanciamiento.id, composicionParaEnviar)
      .then((response) => {
        // console.log('Composición de financiamiento guardada exitosamente:', response);

        // Actualizar el estado con la respuesta del backend
        this.datosStateService.setComposicionFinanciamiento(response);

        // Limpiar flag de modificado
        this.composicionModificada = false;

        // Mostrar éxito
        this.mostrarExito('composicion');
      })
      .catch((error) => {
        console.error('Error al guardar composición de financiamiento:', error);
        this.mostrarError('composicion', error.message || 'Error al guardar');
      });
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
