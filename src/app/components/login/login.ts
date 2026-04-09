import {Component, OnInit} from '@angular/core';
import {AuthService} from "../../core/services/login.service";
import {Router} from "@angular/router";


@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  standalone: false,
  styleUrl: './login.css'
})
export class Login implements OnInit{
  user: any;
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;

  
  constructor(private authService: AuthService, private router: Router) {

  }

  ngOnInit() {
    this.authService.user$.subscribe( user => {
      this.user = user;
      console.log(this.user)
    })
  }
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.authService.login(this.email, this.password).then(() => {
      this.router.navigate(['/home']);
    });
  }
}

