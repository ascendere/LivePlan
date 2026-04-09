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
}