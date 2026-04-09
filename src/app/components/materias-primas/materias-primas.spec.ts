import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MateriasPrimas } from './materias-primas';

describe('MateriasPrimas', () => {
  let component: MateriasPrimas;
  let fixture: ComponentFixture<MateriasPrimas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MateriasPrimas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MateriasPrimas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
