import { Producto } from "./productos.interface";


export interface PresupuestoVenta {
    id?: number;
    plan_negocio_id?: number;
    producto_id?: number;
    anio?: number;
    crecimiento?: number;
    mensual?: number;
    anual?: number;
    producto?: Producto;
    manual_override?: boolean;
    mes1?: number | null;
    mes2?: number | null;
    mes3?: number | null;
    mes4?: number | null;
    mes5?: number | null;
    mes6?: number | null;
    mes7?: number | null;
    mes8?: number | null;
    mes9?: number | null;
    mes10?: number | null;
    mes11?: number | null;
    mes12?: number | null;
}
