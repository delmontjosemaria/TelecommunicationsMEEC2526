import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {Subscription} from 'rxjs';

// Import services from the barrel file
import { AuctionService, SocketService, SigninService, NotificationService } from '../../../../core/services';

// Import models from the barrel file 
import { Item, User, Chat, Marker } from '../../../../core/models';

@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css'],
  standalone: false
})
export class AuctionComponent implements OnInit {
  items: Item[]; //array of items to store the items.
  users: User[];
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination : string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean;  //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item
  bidForm! : FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  private subscriptions: Subscription[];

  constructor( private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
   private signinservice: SigninService, private notificationService: NotificationService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination ="";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.subscriptions = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }

ngOnInit(): void {
  	 this.message= "Hello " + this.userName + "! Welcome to the SAR auction site.";

  	 //create bid form
  	 this.bidForm = this.formBuilder.group({
      bid: ['', Validators.compose([Validators.required,Validators.pattern("^[0-9]*$")])]
  	 });


  	 // Get initial item data from the server api using http call in the auctionservice
     this.auctionservice.getItems()
        .subscribe({next: result => {
          let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
            this.items = receiveddata;
            console.log ("getItems Auction Component -> received the following items: ", receiveddata);
        },
        error: error => this.errorMessage = <any>error });

     // Get initial list of logged in users for googleMaps using http call in the auctionservice
      this.auctionservice.getUsers()
        .subscribe({
          next: result => {
          let receiveddata = result as User[]; // cast the received data as an array of users (must be sent like that from server)
            console.log("getUsers Auction Component -> received the following users: ", receiveddata);
          // do the rest of the needed processing here
          this.users = receiveddata;
          this.markers = receiveddata
          .filter(u=>u.latitude != null && u.longitude != null)
          .map(u => ({ position: { lat: u.latitude!, lng: u.longitude! }, label: u.username }));
        },
        error: error => this.errorMessage = <any>error });

  //subscribe to the incoming websocket events

  //example how to subscribe to the server side regularly (each second) items:update event
      const updateItemsSubscription = this.subscriptions.push(this.socketservice.getEvent("update:items")
                      .subscribe(
                        data =>{
                          let receiveddata = data as Item[];
                            if (this.items){
                              this.items = receiveddata;
                            }
                        }
                      ));

  //subscribe to the new user logged in event that must be sent from the server when a client logs in 

  this.subscriptions.push(this.socketservice.getEvent("user:logged-in")
    .subscribe((data: any) => {
      console.log("New logged-in user:", data.username);
      
      // Adicionar ao array de users para mostrar no mapa
      const newUser: User = {name: '', email: '', password: '', username: data.username, latitude: data.latitude, longitude: data.longitude, islogged: true};
      
      // Adicionar se não existir já
      if (!this.users.find(u => u.username === data.username)) {
        this.users.push(newUser);
        
        // Adicionar marcador no Google Maps
        this.markers.push({position: {lat: data.latitude, lng: data.longitude }, label: data.username});
      }
      
      this.message = `${data.username} just joined the auction!`;
    }));
  //subscribe to the user logged out event that must be sent from the server when a client logs out 

  this.subscriptions.push(this.socketservice.getEvent("user:logged-out")
    .subscribe((data: any) => {
      console.log("Usuário saiu:", data.username);
      
      // Remover do array de users
      this.users = this.users.filter(u => u.username !== data.username);
      
      // Remover marcador do mapa
      this.markers = this.markers.filter(m => m.label !== data.username);
      
      this.message = `${data.username} left the auction.`;
    }));

  //subscribe to a receive:message event to receive message events sent by the server 
  this.subscriptions.push(this.socketservice.getEvent("receive:message")
  .subscribe((data: any) => {
    console.log(`Mensagem recebida de ${data.from}: ${data.message}`);
    
    // Adicionar ao array de chats para mostrar na UI
    this.chats.push({sender: data.from, receiver: data.to, message: data.message, date: new Date(data.timestamp)});
    
    // Opcional: Mostrar notificação
    if (data.from !== this.userName) {
      this.message = `New message from ${data.from}: ${data.message}`;
      
      // Notificação visual (snackbar)
      this.notificationService.showInfo(`Message from ${data.from}: ${data.message}`);
    }
  }));
    
  //subscription to any other events must be performed here inside the ngOnInit function

    // Subscribe to bid updates
  const bidSubscription = this.subscriptions.push(this.socketservice.getEvent("bid:updated")
    .subscribe((data: any) => {
      let updatedItem = data as Item;
      // Update the item in the items array
      const index = this.items.findIndex(item => item.id === updatedItem.id);
      if (index !== -1) {
        this.items[index] = updatedItem;
        // If this is the selected item, update it
        if (this.selectedItem && this.selectedItem.id === updatedItem.id) {
          this.selectedItem = updatedItem;
        }
      }
    }));

  // Subscribe to new items being created
  const newItemSubscription = this.subscriptions.push(this.socketservice.getEvent("item:created")
    .subscribe((data: any) => {
      let newItem = data as Item;
      this.items.push(newItem);
      console.log("New item added:", newItem);
    }));

  //subscribe to the item sold event sent by the server for each item that ends.
  const itemSoldSubscription = this.subscriptions.push(this.socketservice.getEvent("item:sold")
    .subscribe((data: any) => {
      let soldItem = data as Item;
      this.items = this.items.filter(item => item.id !== soldItem.id);
      this.soldHistory.push(`${soldItem.title} sold to ${soldItem.wininguser} for ${soldItem.currentbid}`);
      this.message = `Item ${soldItem.title} sold to ${soldItem.wininguser}!`;
      this.notificationService.showInfo(this.message);
      // Limpar selectedItem se for o vendido:
      if (this.selectedItem?.id === soldItem.id) {
        this.selectedItem = null!;
        this.showBid = false;
        this.showRemove = false;
      }
    }));

  // Subscribe to outbid notifications 
  const outbidSubscription = this.subscriptions.push(this.socketservice.getEvent("user:outbid")
    .subscribe((data: any) => {
      if (data.username === this.userName) {
        this.errorMessage = `You have been outbid on item ${data.itemTitle}! Current bid: ${data.currentBid}`;
        // You could also show a snackbar notification here
      }
    }));

  }
   logout(){
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
  	//perform any needed logout logic here
  	this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item){
  	console.log("Selected item = ", item);
  	this.selectedItem = item;
  	this.showBid = true; // makes the bid form appear
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 
  onMessageSender(ClickedChat: Chat) {
    //destination is now the sender of the selected received message.
    this.destination = ClickedChat.sender; 
    this.showMessage = true;
  }

  // function called when the submit bid button is pressed
   submit(){
    const bidAmount = this.bidForm.value.bid;
    console.log("submitted bid = ", bidAmount);

    if (!bidAmount || bidAmount <= 0) {
      this.errorMessage = "Please enter a valid bid amount";
      return;
    }

    if (!this.selectedItem) {
      this.errorMessage = "No item selected";
      return;
    }

    // Place bid via HTTP
    console.log(this.selectedItem);
    this.auctionservice.placeBid(this.selectedItem.id, bidAmount, this.userName)
      .subscribe({
        next: (response) => {
          this.notificationService.showSuccess("Bid placed successfully!");
          this.bidForm.reset();
          this.errorMessage = "";
          this.message = `Your bid of ${bidAmount} on "${this.selectedItem.title}" was placed!`;
        },
        error: (error) => {
          const errMsg = error?.message || "Failed to place bid";
          this.errorMessage = errMsg;
          this.notificationService.showError(errMsg);
        }
      });
  }
  //function called when the user presses the send message button
  sendMessage(){
    console.log("Message  = ", this.ChatMessage);

    if (!this.ChatMessage || this.ChatMessage.trim() === '') {
      this.message = 'Please enter a message';
      return;
    }

    if (!this.destination) {
      this.message = 'Please select a destination user';
      return;
    }

    // Send message via socket
    this.socketservice.sendEvent('send:message', {
      from: this.userName,
      to: this.destination,
      message: this.ChatMessage,
      timestamp: new Date()
    });

    // Clear message and show confirmation
    this.ChatMessage = '';
    this.message = `Message sent to ${this.destination}`;
  }

  //function called when the cancel bid button is pressed.
   cancelBid(){
   	this.bidForm.reset(); //clears bid value
   }

   //function called when the buy now button is pressed.
   buyNow(){
    if (this.selectedItem?.owner === this.userName) {
      this.errorMessage = "You cannot buy your own item.";
      return;
  }
   	this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
   		bid: this.selectedItem.buynow
   	});
   	this.message= this.userName + " please press the Submit Bid button to procced with the Buy now order.";
   }
//function called when the remove item button is pressed.
  removeItem() {
    if (!this.selectedItem) return;
    this.auctionservice.removeItem(this.selectedItem.id).subscribe({
      next: () => {
        this.items = this.items.filter(i => i.id !== this.selectedItem.id);
        this.showBid = false;
        this.showRemove = false;
        this.notificationService.showSuccess('Item removed successfully');
      },
      error: (err) => this.errorMessage = err?.message || 'Failed to remove item'
    });
  }

  /**
   * Calculate the time progress percentage for the auction item
   * @param item The auction item
   * @returns A number between 0-100 representing progress percentage
   */
  getTimeProgress(item: Item): number {
    if (!item || !item.remainingtime) {
      return 0;
    }

    const maxTime = item.initialTime; 
    const remainingTime = item.remainingtime;
    
    // Calculate elapsed time as a percentage
    const elapsedPercentage = ((maxTime - remainingTime) / maxTime) * 100;
    
    // Return a percentage value between 0-100
    return Math.min(Math.max(elapsedPercentage, 0), 100);
  }

  formatTime(ms: number): string {
    if (!ms || ms <= 0) return '00:00';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  /**
   * Determine the color of the progress bar based on remaining time
   * @param item The auction item
   * @returns Material color for the progress bar
   */
  getTimeProgressColor(item: Item): string {
    if (!item || !item.remainingtime) {
      return 'warn'; // Red when no time or item data
    }

    // More than 50% time remaining - show green
    if (item.remainingtime > 1800000) {
      return 'primary'; // Blue
    } 
    // Between 25% and 50% time remaining - show accent (amber)
    else if (item.remainingtime > 900000) {
      return 'accent';
    } 
    // Less than 25% time remaining - show red
    else {
      return 'warn'; // Red
    }
  }

  ngOnDestroy(){
    this.subscriptions.forEach(s=>s.unsubscribe());
  }

}
