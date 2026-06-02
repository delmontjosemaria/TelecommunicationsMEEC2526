import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import zxcvbn from 'zxcvbn';

// Import services and models from barrel files
import { RegisterService } from '../../../../core/services';
import { User } from '../../../../core/models';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: false
})
export class RegisterComponent implements OnInit {
   errorMessage : string; // string to store error messages	
   userForm!: FormGroup;
   minPassSize : number;
   minPassScore : number;

   //pass the relevant services in to the component
  constructor( 
  	private registerservice: RegisterService, private router: Router
  ) { 
      this.errorMessage = "";
      this.minPassScore = 3;
      this.minPassSize = 8;
    }

  //atualizei o regex para validar melhor os emails 
  ngOnInit(): void {
  	 this.userForm = new FormGroup({
      name: new FormControl ('', [Validators.required]),
      username: new FormControl ('', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]{3,30}$/), this.forbiddenUsernameValidator(['admin', 'root', 'support'])]),
      email: new FormControl ('', [Validators.required,Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)]),
      password: new FormControl ('', [Validators.required, Validators.minLength(this.minPassSize), this.passwordStrengthValidator()])
  	 });
  }

  forbiddenUsernameValidator(forbiddenNames: string[]){
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value)
        return null;
      const isForbidden = forbiddenNames.some(name => control.value.toLowerCase() === name.toLowerCase());
      return isForbidden ? {forbiddenName: {value: control.value}} : null;
    };
  }

  //faz a verificacao da palavra-passe, por questoes de seguranca
  passwordStrengthValidator():(control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.value;

      if (!password || password.length < this.minPassSize){
        return {minLength:true};
      }

      const result = zxcvbn(password);
      if (result.score < this.minPassScore) {
        return { weakPassword: {score: result.score, warning: result.feedback.warning, suggestions:result.feedback.suggestions}};
      }
      return null;
    }
  }

  //verificação da força da palavra-passe com zxcvbn, retorna null se a password for vazia ou tiver menos de minPassSize caracteres
  /*
  getPasswordStrength():any{
    const password = this.userForm.get('password')?.value || '';
    if (!password || password.length < this.minPassSize)
      return null;
    return zxcvbn(password);
  }
  */
  
  get f(){
    return this.userForm.controls;
  }

  submit(){
     console.log ('registration succcessfull',this.userForm.value);
  	 this.registerservice.submitNewUser(this.userForm.value)
   	   .subscribe({
   	   	  next: user => {
   	   	  	 	console.log ('registration succcessfull',user);
   	   	  	 	//registration successfull navigate to login page
   	   	  	 	this.router.navigate(['/signin']); 
   	   	  }, //callback to cath errors thrown bby the Observable in the service
   	   	  error: error => {
   	   	  	this.errorMessage = <any>error;
   	   	  }
        });
  }

  clearForm() {
  	//clears what is appering in the form
  	this.userForm.reset(); 

  }

}
