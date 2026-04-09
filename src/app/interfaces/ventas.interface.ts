
import { Producto } from ".";

export interface VentasDiarias {
    id: number,
    plan_negocio_id: number,
    producto_servicio_id: number,
    venta_dia: number,
    producto_servicio: Producto,
    recalc?: boolean
}