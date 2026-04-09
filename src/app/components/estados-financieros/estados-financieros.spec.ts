import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstadosFinancieros } from './estados-financieros';

describe('EstadosFinancieros', () => {
  let component: EstadosFinancieros;
  let fixture: ComponentFixture<EstadosFinancieros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EstadosFinancieros]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EstadosFinancieros);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
