import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostoVentas } from './costo-ventas';

describe('CostoVentas', () => {
  let component: CostoVentas;
  let fixture: ComponentFixture<CostoVentas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CostoVentas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostoVentas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
