import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, InversionService } from '../../core/services';
import { NewPlanification } from '../../auxiliaries';
import { PlanNegocio } from '../../interfaces/planNegocio.interface';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  standalone: false,
})
export class Home implements OnInit {
  @ViewChild(NewPlanification) newPlanModal!: NewPlanification;

  user: any;
  planesNegocio: PlanNegocio[] = [];
  filteredPlanes: PlanNegocio[] = [];
  searchTerm: string = '';
  // isLoading = true;

  // Nueva bandera para el número de planes mostrados
  mostrarLimite: number = 6;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private inversionService: InversionService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.user = user;
      // console.log('Usuario autenticado:', this.user);

      // Solo llamar a obtenerPlanNegocio cuando hay un usuario
      if (this.user) {
        this.obtenerPlanNegocio();
      }
    });
  }

  obtenerPlanNegocio() {
    // console.log("Obteniendo planes para usuario:", this.user.uid);
    if (this.user?.uid) {
      this.inversionService
        .getPlanNegocioByAutor(this.user.uid)
        .then((planesNegocio: PlanNegocio[]) => {
          this.planesNegocio = planesNegocio;
          this.filteredPlanes = planesNegocio;
          // console.log('Planes de negocio obtenidos:', this.planesNegocio);
        })
        .catch((error) => {
          console.error('Error al obtener planes de negocio:', error);
        });
    } else {
      // console.log("No hay usuario autenticado o no tiene UID");
    }
  }

  filterPlanes() {
    this.filteredPlanes = this.planesNegocio.filter((plan) =>
      plan.problematica.toLowerCase().includes(this.searchTerm.toLowerCase()),
    );
  }

  redirectToPlanificacion(planId: string) {
    // Navega a planificación pasando el ID del plan como parámetro
    this.router.navigate(['planificacion', planId]);
  }

  addEventListeners(): void {
    const mostrarMasButton = document.querySelector('.mostrar-mas') as HTMLButtonElement;
    if (mostrarMasButton) {
      mostrarMasButton.addEventListener('click', this.mostrarMasPlanes);
    }
  }

  mostrarMasPlanes() {
    this.mostrarLimite = this.filteredPlanes.length; // Muestra todos los planes
  }

  /**
   * Abre el modal de nueva planificación
   */
  openNewPlanModal(): void {
    this.newPlanModal.openModal();
  }

  /**
   * Maneja el cierre del modal
   */
  handleModalClose(): void {
    // console.log('Modal cerrado');
  }

  /**
   * Maneja la creación de una nueva planificación
   */
  handleCreatePlan(planData: PlanNegocio): void {
    // console.log('Nueva planificación creada:', planData);

    if (!this.user?.uid) {
      console.error('No hay usuario autenticado');
      return;
    }

    // Crear el objeto del plan con todos los campos requeridos
    const newPlan: PlanNegocio = {
      autor: this.user.uid,
      nombre: planData.problematica,
      problematica: planData.problematica,
      descripcion: planData.descripcion,
    };

    // Llamar al servicio para guardar en el backend
    this.inversionService
      .addPlanNegocio(newPlan)
      .then((response) => {
        // console.log('Plan guardado exitosamente:', response);

        // Agregar el plan a la lista local
        this.planesNegocio.unshift(response);
        this.filterPlanes();

        // Navegar al plan recién creado
        if (response.id) {
          this.router.navigate(['planificacion', response.id]);
        }
      })
      .catch((error) => {
        console.error('Error al guardar el plan:', error);
        alert('Hubo un error al crear el plan. Por favor, intenta de nuevo.');
      });
  }
}
