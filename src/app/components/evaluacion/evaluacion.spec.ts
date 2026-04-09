import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Evaluacion } from './evaluacion';

describe('Evaluacion', () => {
  let component: Evaluacion;
  let fixture: ComponentFixture<Evaluacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Evaluacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Evaluacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
