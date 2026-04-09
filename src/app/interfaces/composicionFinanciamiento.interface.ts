

export interface ComposicionFinanciamiento {
    id?: number;
    plan_negocio_id?: number;
    capital_porcentaje?: number;
    deuda_porcentaje?: number;
    total_porcentaje?: number;
    total_inversion?: number; // Total de inversión en términos monetarios

    recalc?: boolean;
}