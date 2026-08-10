import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatosStateService } from '../../core/services';

export type VariableSensibilidad = 'volumen' | 'precio' | 'costo';

interface VariableActiva {
  etiqueta: string;
  valor: number;
}

const ETIQUETAS: Record<VariableSensibilidad, string> = {
  volumen: 'Volumen',
  precio: 'Precio',
  costo: 'Costo',
};

@Component({
  selector: 'app-aviso-sensibilidad',
  standalone: false,
  templateUrl: './aviso-sensibilidad.html',
  styleUrl: './aviso-sensibilidad.css',
})
export class AvisoSensibilidadComponent implements OnInit, OnDestroy {
  /**
   * Qué variables de sensibilidad afectan realmente los valores mostrados en
   * la pantalla donde se use este componente. Solo esas se evalúan: si
   * "costo" no está en la lista, un Costo% distinto de 0 no se muestra aquí,
   * aunque esté activo en el plan, porque no cambia nada en esta pantalla.
   */
  @Input() variables: VariableSensibilidad[] = ['volumen', 'precio', 'costo'];

  variablesActivas: VariableActiva[] = [];

  private subscription?: Subscription;

  constructor(private readonly datosStateService: DatosStateService) {}

  ngOnInit(): void {
    this.subscription = this.datosStateService.variablesSensibilidad$.subscribe((variables) => {
      if (!variables) {
        this.variablesActivas = [];
        return;
      }
      const valores: Record<VariableSensibilidad, number> = {
        volumen: variables.cantidad_volumen || 0,
        precio: variables.precio || 0,
        costo: variables.costo || 0,
      };
      this.variablesActivas = this.variables
        .filter((v) => valores[v])
        .map((v) => ({ etiqueta: ETIQUETAS[v], valor: valores[v] }));
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
