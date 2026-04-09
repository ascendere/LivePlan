import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostosUnitarios } from './costos-unitarios';

describe('CostosUnitarios', () => {
  let component: CostosUnitarios;
  let fixture: ComponentFixture<CostosUnitarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CostosUnitarios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostosUnitarios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
