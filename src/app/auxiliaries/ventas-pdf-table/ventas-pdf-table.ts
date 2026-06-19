import { Component, Input } from '@angular/core';
import { AnioVentas } from '../../interfaces/ventasMes.interface';
 
 
@Component({
  selector: 'app-ventas-pdf-table',
  standalone: false,
  templateUrl: './ventas-pdf-table.html',
  styleUrl: './ventas-pdf-table.css',
})
export class VentasPdfTable {
  @Input() ventasAgrupadas!: { producto: string; anios: Map<number, AnioVentas> }[];
  @Input() anioSeleccionado!: number;
 
  getVenta(grupo: any): AnioVentas | null {
    // Convertir a número porque el select puede pasar string
    const anio = Number(this.anioSeleccionado);
    return grupo.anios.get(anio) || null;
  }
}
 