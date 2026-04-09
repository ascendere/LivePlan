import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculoVentas } from './calculo-ventas';

describe('CalculoVentas', () => {
  let component: CalculoVentas;
  let fixture: ComponentFixture<CalculoVentas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CalculoVentas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalculoVentas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
