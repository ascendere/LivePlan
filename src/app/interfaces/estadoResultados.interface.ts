
export interface Items {
    id:      number;
    plan_negocio_id: number;
    anio:   number;
    mes:    number;
    ventas: number;
    costos_ventas: number;
    utilidad_bruta: number;
    gastos_venta_adm: number;
    depreciacion: number;
    amortizacion: number;
    utilidad_previo_int_imp: number;
    gastos_financieros: number;
    utilidad_antes_ptu: number;
    ptu: number;
    utilidad_antes_impuestos: number;
    isr: number;
    utilidad_neta: number;
}

export interface SumasAnuales {
    anio: number;
    ventas: number;
    costos_ventas: number;
    utilidad_bruta: number;
    gastos_venta_adm: number;
    depreciacion: number;
    amortizacion: number;
    utilidad_previo_int_imp: number;
    gastos_financieros: number;
    utilidad_antes_ptu: number;
    ptu: number;
    utilidad_antes_impuestos: number;
    isr: number;
    utilidad_neta: number;
}

export interface EstadoResultados {
    items:         Items[];
    sumas_anuales: SumasAnuales[];
}
