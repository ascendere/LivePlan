import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
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
} from './components';
import {
  Header,
  Sidebar,
  CardHome,
  NewPlanification,
  VariablesSensibilidadComponent,
  SeccionesPDFComponent
} from './auxiliaries';

import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { environment } from '../environments/environment.example';
import { Depreciaciones } from './components/depreciaciones/depreciaciones';
import { CommonModule } from '@angular/common';
import { CostoVentas } from './components/costo-ventas/costo-ventas';
import { VentasPdfTable } from './auxiliaries/ventas-pdf-table/ventas-pdf-table';
import { PoliticasCV } from './auxiliaries/politicas-cv/politicas-cv';

@NgModule({
  declarations: [
    App,
    Header,
    Home,
    Sidebar,
    CardHome,
    Planificacion,
    NewPlanification,
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
    VariablesSensibilidadComponent,
    AcercaDe,
    Depreciaciones,
    SeccionesPDFComponent,
    CostoVentas,
    VentasPdfTable,
    PoliticasCV
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    FormsModule,
    DragDropModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
