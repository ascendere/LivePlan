import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Graficas } from './graficas';

describe('Graficas', () => {
  let component: Graficas;
  let fixture: ComponentFixture<Graficas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Graficas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Graficas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
