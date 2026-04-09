import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Depreciaciones } from './depreciaciones';

describe('Depreciaciones', () => {
  let component: Depreciaciones;
  let fixture: ComponentFixture<Depreciaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Depreciaciones]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Depreciaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
