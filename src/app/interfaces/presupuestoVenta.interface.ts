import { Producto } from "./productos.interface";
 
export interface PresupuestoVentaMes {
    id?: number;
    presupuesto_venta_id?: number;
    mes?: number;   // 1..12
    valor?: number; // unidades de ese mes (define la forma/estacionalidad)
}
 
export interface PresupuestoVenta {
    id?: number;
    plan_negocio_id?: number;
    producto_id?: number;
    anio?: number;
    crecimiento?: number;
    mensual?: number;
    anual?: number;
    meses?: PresupuestoVentaMes[]; // vacío = distribución uniforme/automática
    producto?: Producto;
}
 