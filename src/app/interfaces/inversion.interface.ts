import { PlanNegocio } from ".";

export interface TipoInversion {
    id: number;
    tipo: string;
}

export interface InversionGeneral {
    id?: number;
    plan_negocio_id?: number;
    plan_negocio?: PlanNegocio;
    tipo_id?: number;
    tipo?: TipoInversion;
    seccion?: string;
    importe?: number;
    recalc?: boolean;
    // Para UI: array de detalles anidados
    detalles?: InversionDetalle[];
}

export interface InversionDetalle {
    id?: number;
    plan_negocio_id?: number;
    inversion_id?: number;
    inversion?: InversionGeneral;
    tipo_id?: number;
    tipo?: TipoInversion;
    elemento?: string;
    importe?: number;
    vida_util?: number;
    recalc?: boolean;
}
