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
  CambiarClave,
  AdminUsuarios,
} from './components';
import { AdminGuard, AuthGuard, SesionGuard } from './core/guard/auth.guard';
import { PlanGuard } from './core/guard/plan.guard';
import { Depreciaciones } from './components/depreciaciones/depreciaciones';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'acerca-de', component: AcercaDe },
  { path: 'cambiar-clave', component: CambiarClave, canActivate: [SesionGuard] },
  { path: 'admin/usuarios', component: AdminUsuarios, canActivate: [AdminGuard] },

  { path: 'home', component: Home, canActivate: [AuthGuard] },
  { path: 'planificacion/:id', component: Planificacion, canActivate: [AuthGuard, PlanGuard] },
  { path: 'calculo-ventas/:id', component: CalculoVentas, canActivate: [AuthGuard, PlanGuard] },
  { path: 'costos-unitarios/:id', component: CostosUnitarios, canActivate: [AuthGuard, PlanGuard] },
  { path: 'datos-iniciales/:id', component: DatosIniciales, canActivate: [AuthGuard, PlanGuard] },
  { path: 'depreciaciones/:id', component: Depreciaciones, canActivate: [AuthGuard, PlanGuard] },
  { path: 'estados-financieros/:id', component: EstadosFinancieros, canActivate: [AuthGuard, PlanGuard] },
  { path: 'evaluacion/:id', component: Evaluacion, canActivate: [AuthGuard, PlanGuard] },
  { path: 'gastos-operacion/:id', component: GastosOperacion, canActivate: [AuthGuard, PlanGuard] },
  { path: 'graficas/:id', component: Graficas, canActivate: [AuthGuard, PlanGuard] },
  { path: 'inversion/:id', component: Inversion, canActivate: [AuthGuard, PlanGuard] },
  { path: 'materias-primas/:id', component: MateriasPrimas, canActivate: [AuthGuard, PlanGuard] },
  { path: 'prestamo/:id', component: Prestamo, canActivate: [AuthGuard, PlanGuard] },
  { path: 'presupuesto-venta/:id', component: PresupuestoVentaComponent, canActivate: [AuthGuard, PlanGuard] },
  { path: 'costo-ventas/:id', component: CostoVentas, canActivate: [AuthGuard, PlanGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
