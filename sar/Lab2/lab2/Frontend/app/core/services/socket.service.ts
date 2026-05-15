import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Socket } from 'ngx-socket-io';
import { SigninService } from './signin.service';

// Import models from their new location
import { Chat } from '../models/chat';
import { Item } from '../models/item';
import { Useronline } from '../models/useronline';

@Injectable({
  providedIn: 'root'
})
export class SocketService {  
 
  private url = window.location.origin;
  
  constructor(private signInService: SigninService, private socket: Socket) { }
 
  /**
   * Connect to WebSocket with proper authentication
   * Uses query params since that's what the backend expects
   */
  connect() {
    // Disconnect first to ensure clean reconnection
    if (this.socket.ioSocket.connected) {
      this.socket.disconnect();
    }
    
    // Set authentication token in query parameters to match backend expectations
    this.socket.ioSocket.io.opts.query = { token: this.signInService.token.token };
    
    // Set reconnection settings
    this.socket.ioSocket.io.opts.reconnectionAttempts = 5;
    this.socket.ioSocket.io.opts.reconnectionDelay = 1000;
    this.socket.ioSocket.io.opts.timeout = 10000;
    
    // Connect with new options
    this.socket.connect();
    console.log('Websocket connected with token', this.signInService.token.token);
    
    // Setup reconnection error handler
    this.socket.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error);
    });
  }

  /**
   * Safely disconnect from the socket server
   */
  disconnect() {
    this.socket.disconnect();
  }

  /**
   * Send an event to the WebSocket server
   * @param EventName The name of the event
   * @param Data The data to send with the event
   */
  sendEvent(EventName: string, Data: any) {
    this.socket.emit(EventName, Data);
  }

  /**
   * Create an observable for a WebSocket event
   * @param Eventname The name of the event to listen for
   * @returns Observable that emits when the event occurs
   */
  getEvent(Eventname: string): Observable<any> {
    return new Observable(observer => {
      this.socket.on(Eventname, (data: any) => {
        observer.next(data);
      });
    });
  }
}
