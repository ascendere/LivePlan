

export interface DatosPrestamo {
    id?: number;
    plan_negocio_id?: number;
    monto?: number;
    tasa_anual?: number;
    periodos_capitalizacion?: number;
    tasa_mensual?: number;
    cuota?: number;
    periodos_amortizacion?: number;
    recalc?: boolean;
}