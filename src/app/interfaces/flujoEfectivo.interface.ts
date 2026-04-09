
export interface ItemFlujo {
    id: number;
    plan_negocio_id: number;
    anio: number;
    mes: number;
    ingresos_venta_contado: number;
    ingresos_cobros_ventas_credito: number;
    ingresos_otros_ingresos: number;
    ingresos_prestamos: number;
    ingresos_aportes_capital: number;
    ingresos: number;
    egresos_compras_costos_contado: number;
    egresos_compras_costos_credito: number;
    egresos_gastos_operacion: number;
    egresos_intereses: number;
    egresos_pagos_prestamos: number;
    egresos_pagos_sri: number;
    egresos_pago_ptu: number;
    egresos: number;
    aumento_inventarios: number;
    flujo_caja: number;
    efectivo_inicial: number;
    efectivo_final: number;
}

export interface SumaAnualFlujo {
    anio: number;
    ingresos_venta_contado: number;
    ingresos_cobros_ventas_credito: number;
    ingresos_otros_ingresos: number;
    ingresos_prestamos: number;
    ingresos_aportes_capital: number;
    ingresos: number;
    egresos_compras_costos_contado: number;
    egresos_compras_costos_credito: number;
    egresos_gastos_operacion: number;
    egresos_intereses: number;
    egresos_pagos_prestamos: number;
    egresos_pagos_sri: number;
    egresos_pago_ptu: number;
    egresos: number;
    flujo_caja: number;
    efectivo_inicial: number;
    efectivo_final: number;
}

export interface FlujoEfectivo {
    items:         ItemFlujo[];
    sumas_anuales: SumaAnualFlujo[];
}
