import { Producto } from "./productos.interface";

export interface VentaMes {
    id?: number;
    plan_negocio_id?: number;
    producto_id?: number;
    anio?: number;
    mes?: number;     // 1..12 (necesario para mostrar la estacionalidad real)
    mensual?: number; // valor de ESE mes
    anual?: number;
    producto?: Producto;
}

// Valores ya organizados por año para pintar la tabla (12 meses + total).
export interface AnioVentas {
    meses: number[]; // 12 valores, índice = mes-1
    anual: number;
}