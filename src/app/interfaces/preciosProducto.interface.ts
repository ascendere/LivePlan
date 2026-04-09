import { Producto } from "./";


export interface PreciosProducto {
    id?: number;
    plan_negocio_id?: number;
    precio?: number;
    precio_calc?: number;

    producto_servicio?: Producto;
    recalc?: boolean;
}