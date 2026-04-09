import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcercaDe } from './acerca-de';

describe('AcercaDe', () => {
  let component: AcercaDe;
  let fixture: ComponentFixture<AcercaDe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AcercaDe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcercaDe);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
