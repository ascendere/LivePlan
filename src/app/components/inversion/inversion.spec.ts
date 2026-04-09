import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Inversion } from './inversion';

describe('Inversion', () => {
  let component: Inversion;
  let fixture: ComponentFixture<Inversion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Inversion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Inversion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
