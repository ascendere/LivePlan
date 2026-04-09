export interface GastosOperacion {
    anuales:   Anuales[];
    gastos:    Gasto[];
    mensuales: Mensuales[];
}

export interface Anuales {
    anio:                     number;
    gastos_operacion_anual:   number;
    intereses_prestamo_anual: number;
    depreciacion_anual:       number;
    amortizacion_anual:       number;
    total_anual:              number;
}

export interface Gasto {
    id:              number;
    plan_negocio_id: number;
    descripcion:     string;
    mensual:         number;
    anual:           number;
}

export interface Mensuales {
    anio:                       number;
    mes:                        number;
    gastos_operacion_mensual:   number;
    intereses_prestamo_mensual: number;
    depreciacion_mensual:       number;
    amortizacion_mensual:       number;
    total_mensual:              number;
}
