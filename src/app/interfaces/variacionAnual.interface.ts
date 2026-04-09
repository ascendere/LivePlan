import { PlanNegocio } from ".";


export interface VariacionAnual {
    id? : number;
    plan_negocio_id? : number;
    anio1? : number;
    anio2? : number;
    anio3? : number;
    anio4? : number;
    anio5? : number;
    plan_negocio? : PlanNegocio;
    recalc? : boolean;
}