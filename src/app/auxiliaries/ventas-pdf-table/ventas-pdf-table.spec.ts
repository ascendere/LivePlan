import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasPdfTable } from './ventas-pdf-table';

describe('VentasPdfTable', () => {
  let component: VentasPdfTable;
  let fixture: ComponentFixture<VentasPdfTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VentasPdfTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasPdfTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
