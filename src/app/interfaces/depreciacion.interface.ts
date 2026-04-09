import { InversionDetalle } from ".";


export interface DepreciacionAnual {
    id?: number;
    plan_negocio_id?: number;
    detalle_inversion_id?: number;
    depreciacion_mensual?: number;
    depreciacion_anio1?: number;
    depreciacion_anio2?: number;
    depreciacion_anio3?: number;
    depreciacion_anio4?: number;
    depreciacion_anio5?: number;
    valor_rescate?: number;
    detalle_inversion?: InversionDetalle;

    recalc?: boolean;
}