import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-planificacion',
  standalone: false,
  templateUrl: './planificacion.html',
  styleUrl: './planificacion.css'
})
export class Planificacion implements OnInit {
  activeSection = 'planificacion';
  planId: number = 0; // ID del plan capturado de la ruta
  isSidebarCollapsed = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Planificación:', this.planId);
    });
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
  handleSidebarChange(section: string): void {
    this.activeSection = section;
    // console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

}
