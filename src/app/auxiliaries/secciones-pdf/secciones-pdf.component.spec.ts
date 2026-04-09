import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeccionesPDFComponent } from './secciones-pdf.component';

describe('SeccionesPDFComponent', () => {
  let component: SeccionesPDFComponent;
  let fixture: ComponentFixture<SeccionesPDFComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeccionesPDFComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SeccionesPDFComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
