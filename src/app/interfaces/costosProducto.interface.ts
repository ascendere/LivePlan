import { Producto } from "./";

export interface CategoriaCosto {
    id: number;
    nombre: string;
}

export interface Costos {
    id: number;
    plan_negocio_id: number;
    producto_servicio_id: number;
    categoria_costo_id: number;
    costo: number;
    costo_calc: number;
    producto_servicio: Producto;
    categoria_costo: CategoriaCosto;
    recalc?: boolean;
}