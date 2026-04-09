import { Producto } from "./";

export interface MateriaPrima {
    id:              number;
    plan_negocio_id: number;
    producto_id:     number;
    anio:            number;
    costo_mensual:   number;
    costo_anual:     number;
    producto:        Producto;
}
