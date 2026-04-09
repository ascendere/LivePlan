import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresupuestoVenta } from './presupuesto-venta';

describe('PresupuestoVenta', () => {
  let component: PresupuestoVenta;
  let fixture: ComponentFixture<PresupuestoVenta>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PresupuestoVenta]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PresupuestoVenta);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
