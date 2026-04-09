import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GastosOperacion } from './gastos-operacion';

describe('GastosOperacion', () => {
  let component: GastosOperacion;
  let fixture: ComponentFixture<GastosOperacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GastosOperacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GastosOperacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
