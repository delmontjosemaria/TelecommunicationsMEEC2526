import { Injectable } from '@angular/core';
import { throwError, Observable } from 'rxjs';
import { HttpClient, HttpHeaders, HttpResponse, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { SigninService } from './signin.service';
// Add any models that might be needed
import { Item } from '../models/item';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuctionService {

  private removeItemUrl;

  constructor(private http: HttpClient, private signinService: SigninService) {
    this.removeItemUrl = "/api/removeitem";
  }

  getItems(filters?: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    owner?: string;
    status?: string;
  }): Observable<Item[]> {
    let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.signinService.token.token });
    let params = new HttpParams();
    if (filters?.search)   params = params.set('search',   filters.search);
    if (filters?.minPrice) params = params.set('minPrice', filters.minPrice);
    if (filters?.maxPrice) params = params.set('maxPrice', filters.maxPrice);
    if (filters?.owner)    params = params.set('owner',    filters.owner);
    if (filters?.status)   params = params.set('status',   filters.status);
    return this.http.get<Item[]>('/api/items', { headers, params }).pipe(catchError(this.handleError));
  }

   getUsers() {
        // add authorization header with jwt token
        let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.signinService.token.token }); // insert tokern in the requests
        const options = { headers: headers };

        // get users from api
        return this.http.get<any[]>('/api/users', options)
              .pipe(
                catchError(this.handleError) // handle error function will return an empty Item[] anf log the error
              );
   }

  removeItem (item: any) {
    console.log("auction service removeItem -> Removing an item.");
    let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.signinService.token.token }); // insert tokern in the requests
    let options = { headers: headers };

    return this.http.post<any>(this.removeItemUrl, item, options)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Place a bid on an item
  placeBid(itemId: string, bidAmount: number, username: string) {
    let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.signinService.token.token });
    const options = {headers: headers};
    const bidData = {bidAmount: bidAmount, username: username};

    return this.http.post<any>(`/api/placebid/${itemId}`, bidData, options)
      .pipe(
        catchError(this.handleError)
      );
  }

     /**
   * Handle Http operation that failed.
   */
   private handleError (error: HttpErrorResponse) {
    let errMsg:string;  
    if (error.error instanceof ErrorEvent) {
    // A client-side or network error occurred. Handle it accordingly.
      errMsg = error.error.message ? error.error.message : error.toString()
      console.error(errMsg);
    } else {
    // The backend returned an unsuccessful response code.
    // The response body may contain clues as to what went wrong,
      errMsg = error.status + ' - ' + error.statusText;
      console.error(errMsg);
    }
    return throwError(()=> new Error (errMsg));
    };

}
