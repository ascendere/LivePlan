import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-acerca-de',
  standalone: false,
  templateUrl: './acerca-de.html',
  styleUrl: './acerca-de.css',
})
export class AcercaDe {
  constructor(private router: Router) {}

  slides = [
    {
      title: 'Planificación',
      description: 'Realiza los primeros pasos de tu plan de negocio fácilmente.',
      image: '/inversion_inicial_slide.svg',
    },
    {
      title: 'Datos Iniciales',
      description: 'Carga datos y precisos para tus ventas.',
      image: '/datos_iniciales_slide.svg',
    },
    {
      title: 'Inversión Inicial',
      description: 'Administra tus inversiones de manera eficiente.',
      image: '/inversion_inicial_slide.svg',
    },
  ];

  currentIndex = 0;

  nextSlide() {
    if (this.currentIndex < this.slides.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0;
    }
    this.updateSliderPosition();
  }

  prevSlide() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.slides.length - 1;
    }
    this.updateSliderPosition();
  }

  updateSliderPosition() {
    const slider = document.getElementById('slider')!;
    const offset = -this.currentIndex * 100;
    slider.style.transform = `translateX(${offset}%)`;
  }

  redirectToHome() {
    this.router.navigate(['/home']);
  }
}
