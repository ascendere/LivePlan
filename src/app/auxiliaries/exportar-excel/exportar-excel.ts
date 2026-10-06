import { Component, Input } from '@angular/core';
import { ExcelExportService, HojaExcel } from '../../core/services/excel-export.service';

/**
 * Botón "Exportar a Excel" para los módulos con tablas. Por defecto exporta
 * las tablas que se ven en pantalla (una hoja por tabla); si el módulo
 * necesita otra cosa (p. ej. tablas que no están todas cargadas) puede pasar
 * `generarHojas`.
 */
@Component({
  selector: 'app-exportar-excel',
  standalone: false,
  templateUrl: './exportar-excel.html',
  styleUrl: './exportar-excel.css',
})
export class ExportarExcelComponent {
  /** Nombre del módulo: va en el nombre del archivo. */
  @Input() nombre = 'Exportación';
  /** Identificador del plan (opcional) para el nombre del archivo. */
  @Input() planId: number | null = null;
  /** Arma las hojas a mano en lugar de leer las tablas de la pantalla. */
  @Input() generarHojas?: () => HojaExcel[] | Promise<HojaExcel[]>;

  exportando = false;

  constructor(private readonly excel: ExcelExportService) {}

  async exportar(): Promise<void> {
    if (this.exportando) return;
    this.exportando = true;
    try {
      const hojas = this.generarHojas
        ? await this.generarHojas()
        : this.excel.hojasDesdeDom(document.querySelector('main'));

      if (!hojas || hojas.length === 0) {
        alert('No hay tablas con datos para exportar todavía.');
        return;
      }

      const fecha = new Date().toISOString().slice(0, 10);
      const plan = this.planId ? ` - Plan ${this.planId}` : '';
      this.excel.descargar(`${this.nombre}${plan} (${fecha}).xlsx`, hojas);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('No se pudo exportar a Excel. Intenta de nuevo.');
    } finally {
      this.exportando = false;
    }
  }
}
