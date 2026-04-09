import { Producto } from "./productos.interface";


export interface VentaMes {
    id?: number;
    plan_negocio_id?: number;
    producto_id?: number;
    anio?: number;
    mensual?: number;
    anual?: number;
    producto?: Producto;
}