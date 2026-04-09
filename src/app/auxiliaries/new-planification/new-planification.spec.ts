import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewPlanification } from './new-planification';

describe('NewPlanification', () => {
  let component: NewPlanification;
  let fixture: ComponentFixture<NewPlanification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NewPlanification]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewPlanification);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
