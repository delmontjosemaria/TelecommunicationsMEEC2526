import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

// Import the components from their new locations
import { AdminComponent } from './components/admin/admin.component';

@NgModule({
  declarations: [
    AdminComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,   
    SharedModule,
  ],
  exports: [
    AdminComponent
  ]
})
export class AdminModule { }