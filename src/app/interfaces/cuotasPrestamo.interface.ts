export interface CuotasPrestamo {
  id?: number;
  plan_negocio_id?: number;
  saldo_inicial?: number;
  periodo_mes?: number;
  anio?: number;
  mes?: number;
  interes?: number;
  amortizacion?: number;
  cuota_total?: number;
  saldo_pendiente?: number;
}
