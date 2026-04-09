import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InversionService } from '../../core/services/inversion.service';
import { VentaMes } from '../../interfaces/ventasMes.interface';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


@Component({
  selector: 'app-calculo-ventas',
  standalone: false,
  templateUrl: './calculo-ventas.html',
  styleUrl: './calculo-ventas.css'
})
export class CalculoVentas implements OnInit {
  activeSection = 'calculo-ventas';
  planId: number = 0;
  isSidebarCollapsed = false;
  ventas: VentaMes[] = [];
  ventasAgrupadas: { producto: string; anios: Map<number, VentaMes> }[] = [];
  cargando: boolean = false;
  anioExportar: number = 1;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Cálculo de Ventas:', this.planId);
      if (this.planId) {
        this.cargarVentas();
      }
    });
  }

  cargarVentas(): void {
    this.cargando = true;
    this.inversionService.getVentasPorMes(this.planId)
      .then((response) => {
        this.ventas = Array.isArray(response) ? response : [];
        this.agruparPorProducto();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar ventas:', error);
        this.cargando = false;
      });
  }

  agruparPorProducto(): void {
    const productosMap = new Map<number, { producto: string; anios: Map<number, VentaMes> }>();
    
    for (const venta of this.ventas) {
      const productoId = venta.producto_id || 0;
      const productoNombre = venta.producto?.nombre || 'Sin nombre';
      const anio = venta.anio || 0;
      
      if (!productosMap.has(productoId)) {
        productosMap.set(productoId, {
          producto: productoNombre,
          anios: new Map<number, VentaMes>()
        });
      }
      
      productosMap.get(productoId)!.anios.set(anio, venta);
    }
    
    this.ventasAgrupadas = Array.from(productosMap.values());
  }

  getMeses(mensual: number): number[] {
    return new Array(12).fill(mensual);
  }

  getVentaParaAnio(anios: Map<number, VentaMes>, anio: number): VentaMes | null {
    return anios.get(anio) || null;
  }

  handleSidebarChange(section: string): void {
    this.activeSection = section;
    console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  exportarPdf(): void {
    const element = document.getElementById('pdf-table');
    if (!element) {
      console.error('No se encontró el elemento pdf-table');
      return;
    }

    // Hacer visible temporalmente el elemento para capturarlo
    const hostElement = element.closest('app-ventas-pdf-table') as HTMLElement;
    if (hostElement) {
      hostElement.style.position = 'fixed';
      hostElement.style.left = '0';
      hostElement.style.top = '0';
      hostElement.style.zIndex = '-1';
    }

    html2canvas(element, { 
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      // Restaurar el elemento
      if (hostElement) {
        hostElement.style.position = 'absolute';
        hostElement.style.left = '-9999px';
        hostElement.style.zIndex = '';
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Si la imagen es más alta que la página, ajustar
      if (pdfHeight > pageHeight - 20) {
        const adjustedWidth = (pageHeight - 20) * canvas.width / canvas.height;
        const xOffset = (pdfWidth - adjustedWidth) / 2;
        pdf.addImage(imgData, 'PNG', xOffset, 10, adjustedWidth, pageHeight - 20);
      } else {
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      }

      pdf.save(`proyeccion-ventas-anio-${this.anioExportar}.pdf`);
    }).catch(error => {
      console.error('Error al generar PDF:', error);
      // Restaurar el elemento en caso de error
      if (hostElement) {
        hostElement.style.position = 'absolute';
        hostElement.style.left = '-9999px';
        hostElement.style.zIndex = '';
      }
    });
  }
}
