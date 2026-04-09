import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatosIniciales } from './datos-iniciales';

describe('DatosIniciales', () => {
  let component: DatosIniciales;
  let fixture: ComponentFixture<DatosIniciales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DatosIniciales]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatosIniciales);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
