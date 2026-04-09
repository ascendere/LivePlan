import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Prestamo } from './prestamo';

describe('Prestamo', () => {
  let component: Prestamo;
  let fixture: ComponentFixture<Prestamo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Prestamo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Prestamo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
