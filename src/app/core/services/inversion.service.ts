import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment.example';
import { PlanNegocio } from '../../interfaces/planNegocio.interface';
import { FirebaseService } from './firebase.service';
import { AuthService } from './login.service';
import {
  Supuestos,
  Producto,
  VentasDiarias,
  VariablesSensibilidad,
  VariacionAnual,
  InversionGeneral,
  InversionDetalle,
  TipoInversion,
  Macros,
  PreciosProducto,
  Costos,
  DepreciacionAnual,
  ComposicionFinanciamiento,
  PresupuestoVenta,
  VentaMes,
  DatosPrestamo,
  CuotasPrestamo,
  MateriaPrima,
  CostosVentas,
  EstadoResultados,
  GastosOperacion,
  FlujoEfectivo,
  politicaCompra,
  PoliticasVenta,
} from '../../interfaces';

@Injectable({
  providedIn: 'root',
})
export class InversionService {
  private readonly apiUrl = environment.backend.url;
  private readonly firebaseService = inject(FirebaseService);
  private readonly authService = inject(AuthService);

  constructor() {}

  // Metodos Post

  addInversionGeneral(
    planNegocioId: number,
    tipoId: number,
    seccion: string,
    importe: number,
  ): Promise<InversionGeneral> {
    const url = `${this.apiUrl}/inversiones`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_negocio_id: planNegocioId,
        tipo_id: tipoId,
        seccion: seccion,
        importe: importe,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error('Error al crear la inversión general');
      }
      return response.json();
    });
  }

  addDetalleInversion(
    planNegocioId: number,
    inversionId: number,
    tipoId: number,
    elemento: string,
    importe: number,
    vidaUtil: number,
  ): Promise<InversionDetalle> {
    const url = `${this.apiUrl}/detalles_inversion`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_negocio_id: planNegocioId,
        inversion_id: inversionId,
        tipo_id: tipoId,
        elemento: elemento,
        importe: importe,
        vida_util: vidaUtil,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error('Error al crear el detalle de inversión');
      }
      return response.json();
    });
  }

  addPlanNegocio(planNegocio: PlanNegocio): Promise<PlanNegocio> {
    const url = `${this.apiUrl}/plan`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planNegocio),
    }).then((response) => {
      if (!response.ok) {
        throw new Error('Error al crear el plan de negocio');
      }
      return response.json();
    }).then((newPlan: PlanNegocio) => {
      // Sincronizar con Firebase si tenemos el nombre y el usuario autenticado
      if (newPlan.id && planNegocio.nombre) {
        this.authService.user$.subscribe((user: any) => {
          if (user?.email) {
            this.firebaseService.crearPlanInicial(
              planNegocio.nombre!, 
              newPlan.id!.toString(), 
              user.email
            ).subscribe({
              next: () => console.log('✅ Plan inicializado en Firebase'),
              error: (err: any) => console.error('❌ Error al inicializar plan en Firebase:', err)
            });
          }
        });
      }
      return newPlan;
    });
  }

  addProductoServicio(planNegocioId: number, nombre: string): Promise<Producto> {
    const url = `${this.apiUrl}/producto_servicio`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: nombre,
        plan_negocio_id: planNegocioId,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error('Error al agregar producto o servicio');
      }
      return response.json();
    });
  }

  // Metodos Get

  getCatalogosSistema(): Promise<TipoInversion[]> {
    const url = `${this.apiUrl}/tipos_inversion`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener catálogos del sistema');
      }
      return response.json();
    });
  }

  getInversionesGenerales(planNegocioId: number): Promise<InversionGeneral[]> {
    const url = `${this.apiUrl}/inversiones/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener inversiones generales');
      }
      return response.json();
    });
  }

  getDetallesInversion(planNegocioId: number): Promise<InversionDetalle[]> {
    const url = `${this.apiUrl}/detalles_inversion/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener detalles de inversión');
      }
      return response.json();
    });
  }

  getPlanNegocioByAutor(authorUuid: number): Promise<PlanNegocio[]> {
    const url = `${this.apiUrl}/plan/${encodeURIComponent(authorUuid)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    });
  }

  getProductosServicios(planNegocioId: number): Promise<Producto[]> {
    const url = `${this.apiUrl}/producto_servicio/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener productos y servicios');
      }
      return response.json();
    });
  }

  getSupuestos(planNegocioId: number): Promise<Supuestos[]> {
    const url = `${this.apiUrl}/supuestos/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener supuestos');
      }
      return response.json();
    });
  }

  getVentasDiarias(planNegocioId: number): Promise<VentasDiarias[]> {
    const url = `${this.apiUrl}/ventas_diarias/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener ventas diarias');
      }
      return response.json();
    });
  }

  getVariablesSensibilidad(planNegocioId: number): Promise<VariablesSensibilidad[]> {
    const url = `${this.apiUrl}/variables_sensibilidad/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener variables de sensibilidad');
      }
      return response.json();
    });
  }

  getVariacionAnual(planNegocioId: number): Promise<VariacionAnual[]> {
    const url = `${this.apiUrl}/variacion_anual/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener variación anual');
      }
      return response.json();
    });
  }

  getMacros(plan_negocio_id: number): Promise<Macros> {
    const url = `${this.apiUrl}/indicadores_macro/${encodeURIComponent(plan_negocio_id)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener macros');
      }
      return response.json();
    });
  }

  getPreciosProductoServicio(planNegocioId: number): Promise<PreciosProducto[]> {
    const url = `${this.apiUrl}/precios_prodserv/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener precios de productos/servicios');
      }
      return response.json();
    });
  }

  getCostosProductoServicio(planNegocioId: number): Promise<Costos[]> {
    const url = `${this.apiUrl}/costos_prodserv/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener costos de productos/servicios');
      }
      return response.json();
    });
  }

  getDepreciacionAnual(planNegocioId: number): Promise<DepreciacionAnual[]> {
    const url = `${this.apiUrl}/depreciaciones/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener depreciación anual');
      }
      return response.json();
    });
  }

  getComposicionFinanciamiento(planNegocioId: number): Promise<ComposicionFinanciamiento> {
    const url = `${this.apiUrl}/composicion_financiamiento/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener composición del financiamiento');
      }
      return response.json();
    });
  }

  patchPresupuestoVenta(id: number, body: Partial<PresupuestoVenta>): Promise<PresupuestoVenta> {
    const url = `${this.apiUrl}/presupuestos_venta/item/${encodeURIComponent(id)}`;
    return fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((response) => {
      if (!response.ok) throw new Error(`Error al actualizar presupuesto de venta: ${response.status} ${response.statusText}`);
      return response.json();
    });
  }

  getPresupuestoVenta(planNegocioId: number): Promise<PresupuestoVenta[]> {
    const url = `${this.apiUrl}/presupuestos_venta/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener presupuesto de venta');
      }
      return response.json();
    });
  }

  getVentasPorMes(planNegocioId: number): Promise<VentaMes[]> {
    const url = `${this.apiUrl}/ventas_dinero/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener ventas por mes');
      }
      return response.json();
    });
  }

  getDatosPrestamo(planNegocioId: number): Promise<DatosPrestamo[]> {
    const url = `${this.apiUrl}/prestamos/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener datos de préstamo');
      }
      return response.json();
    });
  }

  getCuotasPrestamo(planNegocioId: number): Promise<CuotasPrestamo[]> {
    const url = `${this.apiUrl}/datos_prestamos/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener cuotas de préstamo');
      }
      return response.json();
    });
  }

  getMateriaPrima(planNegocioId: number): Promise<MateriaPrima[]> {
    const url = `${this.apiUrl}/costo_materias_primas/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener materia prima');
      }
      return response.json();
    });
  }

  getCostosVenta(planNegocioId: number): Promise<CostosVentas[]> {
    const url = `${this.apiUrl}/costos_ventas/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener costos de venta');
      }
      return response.json();
    });
  }

  getEstadoResultados(planNegocioId: number): Promise<EstadoResultados> {
    const url = `${this.apiUrl}/estado_resultados/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener estado de resultados');
      }
      return response.json();
    });
  }

  getGastosOperacion(planNegocioId: number): Promise<GastosOperacion> {
    const url = `${this.apiUrl}/gastos_operacion/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener gastos de operación');
      }
      return response.json();
    });
  }

  getFlujoEfectivo(planNegocioId: number): Promise<FlujoEfectivo> {
    const url = `${this.apiUrl}/flujo_efectivo/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener flujo de efectivo');
      }
      return response.json();
    });
  }

  /**
   * Obtiene los conceptos usados en la evaluación (VPN, flujos, etc.)
   */
  getConceptosEvaluacion(planNegocioId: number): Promise<any> {
    const url = `${this.apiUrl}/conceptos_evaluacion/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener conceptos de evaluación');
      }
      return response.json();
    });
  }

  /**
   * Obtiene la evaluación del proyecto (VAN, TIR, TREMA) para un plan
   */
  getEvaluacionProyecto(planNegocioId: number): Promise<any> {
    const url = `${this.apiUrl}/evaluacion_proyecto/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener evaluación del proyecto');
      }
      return response.json();
    });
  }

  /**
   * Obtiene el análisis de sensibilidad (matriz volumen x costo)
   */
  getAnalisisSensibilidad(planNegocioId: number): Promise<any> {
    const url = `${this.apiUrl}/analisis_sensibilidad/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener análisis de sensibilidad');
      }
      return response.json();
    });
  }

  getBalanceGeneral(planNegocioId: number): Promise<any> {
    const url = `${this.apiUrl}/balance_general/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener balance general');
      }
      return response.json();
    });
  }

  getPoliticaCompra(planNegocioId: number): Promise<politicaCompra[]> {
    const url = `${this.apiUrl}/politicas_compra/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener política de compra');
      }
      return response.json();
    });
  }

  getPoliticaVenta(planNegocioId: number): Promise<PoliticasVenta[]> {
    const url = `${this.apiUrl}/politicas_venta/${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener política de venta');
      }
      return response.json();
    });
  }

  // Metodos Patch

  actualizarInversionGeneral(
    inversionId: number,
    inversion: Partial<InversionGeneral>,
  ): Promise<InversionGeneral> {
    const url = `${this.apiUrl}/inversiones/item/${encodeURIComponent(inversionId)}`;
    // console.log('Actualizando inversión general con ID:', inversionId, 'con datos:', inversion);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seccion: inversion.seccion,
        importe: inversion.importe,
        recalc: inversion.recalc ?? true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar inversión general: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarDetalleInversion(
    detalleId: number,
    detalle: Partial<InversionDetalle>,
  ): Promise<InversionDetalle> {
    const url = `${this.apiUrl}/detalles_inversion/item/${encodeURIComponent(detalleId)}`;
    // console.log('Actualizando detalle de inversión con ID:', detalleId, 'con datos:', detalle);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elemento: detalle.elemento,
        importe: detalle.importe,
        vida_util: detalle.vida_util,
        recalc: detalle.recalc ?? true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar detalle de inversión: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarProductoServicio(productoServicioId: number, nombre: string): Promise<Producto> {
    const url = `${this.apiUrl}/producto_servicio/item/${encodeURIComponent(productoServicioId)}`;
    // console.log('Actualizando producto con ID:', productoServicioId, 'nuevo nombre:', nombre);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: nombre,
        recalc: false,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error al actualizar producto: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });
  }

  actualizarSupuestos(supuestosId: number, supuestos: Partial<Supuestos>): Promise<Supuestos> {
    const url = `${this.apiUrl}/supuestos/item/${encodeURIComponent(supuestosId)}`;
    // console.log('Actualizando supuestos con ID:', supuestosId, 'con datos:', supuestos);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        porcen_ventas: supuestos.porcen_ventas,
        variacion_porcen_ventas: supuestos.variacion_porcen_ventas,
        ptu: supuestos.ptu,
        isr: supuestos.isr,
        recalc: true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error al actualizar supuestos: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });
  }

  actualizarVentaDiaria(
    ventaDiariaId: number,
    ventaDia: number,
    recalc: boolean = true,
  ): Promise<VentasDiarias> {
    const url = `${this.apiUrl}/ventas_diarias/item/${encodeURIComponent(ventaDiariaId)}`;
    /* console.log(
      'Actualizando venta diaria para producto:',
      ventaDiariaId,
      'con valor:',
      ventaDia,
      'recalc:',
      recalc
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        venta_dia: ventaDia,
        recalc: recalc,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar venta diaria: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarVariablesSensibilidad(
    variablesSenId: number,
    variables: VariablesSensibilidad,
  ): Promise<VariablesSensibilidad> {
    const url = `${this.apiUrl}/variables_sensibilidad/item/${encodeURIComponent(variablesSenId)}`;
    /* console.log(
      'Actualizando variables de sensibilidad con ID:',
      variablesSenId,
      'con datos:',
      variables
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cantidad_volumen: variables.cantidad_volumen,
        precio: variables.precio,
        costo: variables.costo,
        recalc: true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar variables de sensibilidad: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarVariacionAnual(
    variacionId: number,
    variacionAnual: VariacionAnual,
  ): Promise<VariacionAnual> {
    const url = `${this.apiUrl}/variacion_anual/item/${encodeURIComponent(variacionId)}`;
    // console.log('Actualizando variación anual con ID:', variacionId, 'con datos:', variacionAnual);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anio1: variacionAnual.anio1,
        anio2: variacionAnual.anio2,
        anio3: variacionAnual.anio3,
        anio4: variacionAnual.anio4,
        anio5: variacionAnual.anio5,
        recalc: true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar variación anual: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarMacros(macrosId: number, macros: Partial<Macros>): Promise<Macros> {
    const url = `${this.apiUrl}/indicadores_macro/item/${encodeURIComponent(macrosId)}`;
    // console.log('Actualizando macros con ID:', macrosId, 'con datos:', macros);

    // Construir objeto con solo los campos presentes en el parámetro
    const body: any = { recalc: macros.recalc ?? true };

    if (macros.tipo_cambio !== undefined) body.tipo_cambio = macros.tipo_cambio;
    if (macros.inflacion !== undefined) body.inflacion = macros.inflacion;
    if (macros.tasa_deuda !== undefined) body.tasa_deuda = macros.tasa_deuda;
    if (macros.tasa_interes !== undefined) body.tasa_interes = macros.tasa_interes;
    if (macros.tasa_impuesto !== undefined) body.tasa_impuesto = macros.tasa_impuesto;
    if (macros.ptu !== undefined) body.ptu = macros.ptu;
    if (macros.diasxmes !== undefined) body.diasxmes = macros.diasxmes;

    // console.log('Body a enviar:', body);

    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error al actualizar macros: ${response.status} ${response.statusText}`);
      }
      return response.json().then((data) => {
        // console.log('Macros actualizados en backend:', data);
        return data;
      });
    });
  }

  actualizarPreciosProductoServicio(
    precioId: number,
    precio: Partial<PreciosProducto>,
  ): Promise<PreciosProducto> {
    const url = `${this.apiUrl}/precios_prodserv/item/${encodeURIComponent(precioId)}`;
    // console.log(
    //   'Actualizando precios de producto/servicio con ID:',
    //   precioId,
    //   'con datos:',
    //   precio,
    // );
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        precio: precio.precio,
        recalc: precio.recalc ?? true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar precios de producto/servicio: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarCostosProductoServicio(
    costoId: number,
    costo: Partial<Costos>,
  ): Promise<Costos> {
    const url = `${this.apiUrl}/costos_prodserv/item/${encodeURIComponent(costoId)}`;
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        costo: costo.costo,
        recalc: costo.recalc ?? true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar costos de producto/servicio: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  getCostosMensuales(planNegocioId: number): Promise<any[]> {
    const url = `${this.apiUrl}/costos_mensuales?plan_id=${encodeURIComponent(planNegocioId)}`;
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error('Error al obtener costos mensuales');
      }
      return response.json();
    });
  }

  actualizarCostosMensualesLote(planNegocioId: number, updates: {id: number, costo: number}[]): Promise<any> {
    const url = `${this.apiUrl}/costos_mensuales`;
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_negocio_id: planNegocioId,
        updates: updates
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar costos mensuales en lote: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarComposicionFinanciamiento(
    composicionId: number,
    composicion: Partial<ComposicionFinanciamiento>,
  ): Promise<ComposicionFinanciamiento> {
    const url = `${this.apiUrl}/composicion_financiamiento/item/${encodeURIComponent(
      composicionId,
    )}`;
    /* console.log(
      'Actualizando composición de financiamiento con ID:',
      composicionId,
      'con datos:',
      composicion
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        capital_porcentaje: composicion.capital_porcentaje,
        deuda_porcentaje: composicion.deuda_porcentaje,

        recalc: composicion.recalc ?? true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar composición de financiamiento: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarDatosPrestamo(
    prestamoId: number,
    prestamo: Partial<DatosPrestamo>,
  ): Promise<DatosPrestamo> {
    const url = `${this.apiUrl}/prestamos/item/${encodeURIComponent(prestamoId)}`;
    // console.log('Actualizando datos de préstamo con ID:', prestamoId, 'con datos:', prestamo);
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        periodos_capitalizacion: prestamo.periodos_capitalizacion,
        periodos_amortizacion: prestamo.periodos_amortizacion,
        recalc: true,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar datos de préstamo: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarGastosOperacion(
    gastosOperacionId: number,
    mensual: number,
    recalc: boolean,
  ): Promise<any> {
    const url = `${this.apiUrl}/gastos_operacion/item/${encodeURIComponent(gastosOperacionId)}`;
    /* console.log(
      'Actualizando gastos de operación con ID:',
      gastosOperacionId,
      'mensual:',
      mensual,
      'recalc:',
      recalc
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mensual: mensual,
        recalc: recalc,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar gastos de operación: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarPoliticaCompra(
    politicaCompra: Partial<politicaCompra>,
    recalc: boolean,
  ): Promise<politicaCompra> {
    const url = `${this.apiUrl}/politicas_compra/item/${encodeURIComponent(politicaCompra.id!)}`;
    /* console.log(
      'Actualizando política de compra con ID:',
      politicaCompra.id,
      'con datos:',
      politicaCompra,
      'recalc:',
      recalc
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        porcentaje_credito: politicaCompra.porcentaje_credito,
        porcentaje_contado: politicaCompra.porcentaje_contado,
        recalc: recalc,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar política de compra: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  actualizarPoliticaVenta(
    politicaVenta: Partial<PoliticasVenta>,
    recalc: boolean,
  ): Promise<PoliticasVenta> {
    const url = `${this.apiUrl}/politicas_venta/item/${encodeURIComponent(politicaVenta.id!)}`;
    /* console.log(
      'Actualizando política de venta con ID:',
      politicaVenta.id,
      'con datos:',
      politicaVenta,
      'recalc:',
      recalc
    ); */
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        porcentaje_credito: politicaVenta.porcentaje_credito,
        porcentaje_contado: politicaVenta.porcentaje_contado,
        recalc: recalc,
      }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar política de venta: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  // Metodos Del

  eliminarInversionGeneral(inversionId: number): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/inversiones/item/${encodeURIComponent(inversionId)}`;
    // console.log('Eliminando inversión general con ID:', inversionId);
    return fetch(url, {
      method: 'DELETE',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Error al eliminar inversión general: ${response.status} ${response.statusText}`,
        );
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    });
  }

  eliminarDetalleInversion(detalleId: number): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/detalles_inversion/item/${encodeURIComponent(detalleId)}`;
    // console.log('Eliminando detalle de inversión con ID:', detalleId);
    return fetch(url, {
      method: 'DELETE',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Error al eliminar detalle de inversión: ${response.status} ${response.statusText}`,
        );
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    });
  }

  eliminarProductoServicio(productoServicioId: number): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/producto_servicio/item/${encodeURIComponent(productoServicioId)}`;
    // console.log('Eliminando producto con ID:', productoServicioId);
    return fetch(url, {
      method: 'DELETE',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Error al eliminar producto: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    });
  }

  // Métodos para Análisis de Sensibilidad

  getAnalisisSensibilidadStatus(
    planId: number,
  ): Promise<{ id: number; plan_negocio_id: number; status: boolean }> {
    const url = `${this.apiUrl}/analisis_sensibilidad_status/${encodeURIComponent(planId)}`;
    // console.log('Obteniendo status de análisis de sensibilidad para plan:', planId);
    return fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Error al obtener status de análisis de sensibilidad: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }

  ejecutarRecalcular2(planId: number): Promise<{ message: string }> {
    const url = `${this.apiUrl}/recalcular2/${encodeURIComponent(planId)}`;
    // console.log('Ejecutando recalcular2 para plan:', planId);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Error al ejecutar recalcular2: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });
  }
  /**
   * Reemplaza los 12 meses (estacionalidad) de una fila de presupuesto.
   * recalc=false: solo guarda. El recálculo se dispara aparte con
   * ejecutarRecalcular2() una sola vez para todas las filas modificadas.
   */
  actualizarPresupuestoVentaMeses(
    presupuestoId: number,
    meses: { mes: number; valor: number }[],
    recalc: boolean = false,
  ): Promise<any> {
    const url = `${this.apiUrl}/presupuestos_venta/meses/${encodeURIComponent(presupuestoId)}`;
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meses, recalc }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al actualizar meses del presupuesto: ${response.status} ${response.statusText}`,
        );
      }
      return response.json();
    });
  }
 
  /** Vuelve una fila a distribución automática (borra sus meses) y recalcula. */
  limpiarPresupuestoVentaMeses(presupuestoId: number): Promise<void> {
    const url = `${this.apiUrl}/presupuestos_venta/meses/${encodeURIComponent(presupuestoId)}`;
    return fetch(url, { method: 'DELETE' }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error al limpiar meses del presupuesto: ${response.status} ${response.statusText}`,
        );
      }
    });
  }
   /** Estacionalidad (12 meses) de un producto. Vacío = uniforme. */
  getEstacionalidadProducto(
    productoId: number,
  ): Promise<{ mes: number; valor: number }[]> {
    const url = `${this.apiUrl}/estacionalidad/${encodeURIComponent(productoId)}`;
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error('Error al obtener estacionalidad');
      return r.json();
    });
  }

   /** Reemplaza los 12 meses de estacionalidad de un producto y recalcula. */
  actualizarEstacionalidadProducto(
    productoId: number,
    meses: { mes: number; valor: number }[],
    recalc: boolean = true,
  ): Promise<any> {
    const url = `${this.apiUrl}/estacionalidad/${encodeURIComponent(productoId)}`;
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meses, recalc }),
    }).then((r) => {
      if (!r.ok) throw new Error(`Error al guardar estacionalidad: ${r.status}`);
      return r.json();
    });
  }
 
  /** Quita la estacionalidad de un producto (vuelve a uniforme) y recalcula. */
  limpiarEstacionalidadProducto(productoId: number): Promise<void> {
    const url = `${this.apiUrl}/estacionalidad/${encodeURIComponent(productoId)}`;
    return fetch(url, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error(`Error al quitar estacionalidad: ${r.status}`);
    });
  }
}
