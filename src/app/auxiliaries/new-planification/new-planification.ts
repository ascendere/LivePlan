import { Component, EventEmitter, Output } from '@angular/core';

import {PlanNegocio} from '../../interfaces';

@Component({
  selector: 'app-new-planification',
  standalone: false,
  templateUrl: './new-planification.html',
  styleUrl: './new-planification.css'
})
export class NewPlanification {
  @Output() onClose = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<PlanNegocio>();

  isOpen = false;
  isSubmitting = false;

  formData: PlanNegocio = {
    problematica: '',
    descripcion: ''
  };

  /**
   * Abre el modal
   */
  openModal(): void {
    this.isOpen = true;
    this.resetForm();
  }

  /**
   * Cierra el modal
   */
  closeModal(): void {
    this.isOpen = false;
    this.resetForm();
    this.onClose.emit();
  }

  /**
   * Reinicia el formulario
   */
  private resetForm(): void {
    this.formData = {
      problematica: '',
      descripcion: ''
    };
    this.isSubmitting = false;
  }

  /**
   * Maneja el envío del formulario
   */
  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    // Emitir los datos al componente padre
    this.onCreate.emit({ ...this.formData });

    // Cerrar modal después de un breve delay para mostrar feedback
    setTimeout(() => {
      this.closeModal();
    }, 300);
  }
}
