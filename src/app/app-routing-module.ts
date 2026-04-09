import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
  Login,
  Home,
  Planificacion,
  CalculoVentas,
  CostosUnitarios,
  DatosIniciales,
  EstadosFinancieros,
  Evaluacion,
  GastosOperacion,
  Graficas,
  Inversion,
  MateriasPrimas,
  Prestamo,
  PresupuestoVentaComponent,
  AcercaDe,
  CostoVentas,
} from './components';
import { AuthGuard } from './core/guard/auth.guard';
import { Depreciaciones } from './components/depreciaciones/depreciaciones';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'acerca-de', component: AcercaDe },

  { path: 'home', component: Home, canActivate: [AuthGuard] },
  { path: 'planificacion/:id', component: Planificacion, canActivate: [AuthGuard] },
  { path: 'calculo-ventas/:id', component: CalculoVentas, canActivate: [AuthGuard] },
  { path: 'costos-unitarios/:id', component: CostosUnitarios, canActivate: [AuthGuard] },
  { path: 'datos-iniciales/:id', component: DatosIniciales, canActivate: [AuthGuard] },
  { path: 'depreciaciones/:id', component: Depreciaciones, canActivate: [AuthGuard] },
  { path: 'estados-financieros/:id', component: EstadosFinancieros, canActivate: [AuthGuard] },
  { path: 'evaluacion/:id', component: Evaluacion, canActivate: [AuthGuard] },
  { path: 'gastos-operacion/:id', component: GastosOperacion, canActivate: [AuthGuard] },
  { path: 'graficas/:id', component: Graficas, canActivate: [AuthGuard] },
  { path: 'inversion/:id', component: Inversion, canActivate: [AuthGuard] },
  { path: 'materias-primas/:id', component: MateriasPrimas, canActivate: [AuthGuard] },
  { path: 'prestamo/:id', component: Prestamo, canActivate: [AuthGuard] },
  { path: 'presupuesto-venta/:id', component: PresupuestoVentaComponent, canActivate: [AuthGuard] },
  { path: 'costo-ventas/:id', component: CostoVentas, canActivate: [AuthGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
