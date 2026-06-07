import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import config from '../config/config';
import Item from '../models/item';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private closingSoonNotified: Set<String> = new Set();

  /**
   * Initialize Socket.IO server
   */
  public init(io: Server): void {
    this.io = io;
    
    // JWT authentication for socket.io
    io.use((socket: Socket, next) => {
      // Check for token in query or auth object (supporting both methods)
      const authData = socket.handshake.auth as Record<string, unknown> | undefined;
      const queryToken = socket.handshake.query?.token;
      const token =
        (typeof queryToken === 'string' ? queryToken : undefined) ||
        (typeof authData?.token === 'string' ? authData.token : undefined);
        
      if (token) {
        jwt.verify(token, config.jwtSecret, (err: jwt.VerifyErrors | null, decoded: unknown) => {
          if (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.data.decoded_token = decoded;
          next();
        });
      } else {
        console.error('Socket auth error: No token provided');
        next(new Error('Authentication error: No token provided'));
      }
    });

    console.log('Socket service initialized');
    this.setupSocketEvents();
    this.startAuctionTimer();
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEvents(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const username = socket.data.decoded_token.username;
      console.log(`${username} user connected`);
      
      // Store client in the maps
      this.socketIDbyUsername.set(username, socket.id);
      this.usernamebySocketID.set(socket.id, username);

      // Handle new user event
      socket.on('newUser:username', (data) => {
        console.log("newUser:username -> New user event received: ", data);
      });

      // Handle bid event
      socket.on('send:bid', (data) => {
        console.log("send:bid -> Received event send:bid with data = ", data);
        // Original dummy functionality 
      });

      // Handle message event
      socket.on('send:message', (chat) => {
        console.log("send:message received with -> ", chat);
        // Broadcast message to all connected clients
        if (this.io && this.socketIDbyUsername.has(chat.to)) {
          const receiverSocketID = this.socketIDbyUsername.get(chat.to);
          this.io.to(receiverSocketID!).emit('receive:message', {
            from: username,
            to: chat.to,
            message: chat.message,
            timestamp: new Date()
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log("User disconnected");
        const disconnectedUsername = this.usernamebySocketID.get(socket.id);
        if (disconnectedUsername) {
          // Broadcast logout to all clients
          this.userLoggedOutBroadcast({ username: disconnectedUsername });
          this.socketIDbyUsername.delete(disconnectedUsername);
        }
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  // Start auction timer for item remaining time updates
  private startAuctionTimer(): void {
    this.intervalId = setInterval(async () => {
      try {
        const now = new Date();

        //Find expired items
        const expiredItems = await Item.find({isActive: true, sold: false, endsAt: {$lte: now}});

        for (const item of expiredItems){
          item.isActive = false;

          if (item.wininguser && item.wininguser !== ''){
            item.sold = true;
            await item.save();
            this.itemSoldBroadcast(item);
          }
          else{
            await item.save();
            this.itemExpiredBroadcast(item);
          }
          this.closingSoonNotified.delete((item._id as any).toString());
        }

        const minTimeNotification = 120000; // 2 minutes
        const ratioLimit = 0.10;
        
        const activeItems = await Item.find({isActive: true});
        for (const item of activeItems){
          const itemId = (item._id as any).toString();
          const remainingTime = Math.max(0, item.endsAt.getTime() - Date.now());
          //to avoid weird 'ending soon' notifications, either its 10 per cent of initialTime or the min time for a slow user to insert a bid  
          const notificationThreshold = Math.max(item.initialTime * ratioLimit, minTimeNotification);
          const shouldNotify = remainingTime <= notificationThreshold && remainingTime > 0;

          if (shouldNotify && !this.closingSoonNotified.has(itemId)){
            console.log('Delmont\'s the greatest goat ever, goated levels of goated, dead or alive? Answer: ', shouldNotify);
            this.closingSoonNotified.add(itemId);
            this.auctionClosingSoonBroadcast(item);
          }  
        }
        //broadcast active items with remainingtime calculated through endsAt field
        const itemsWithTime = activeItems.map(item => {
          const obj = item.toObject();
          return{...obj, 
                 id: (obj._id as any).toString(), 
                 remainingtime: Math.max(0, item.endsAt.getTime() - Date.now())};
        });
        this.io?.emit('update:items', itemsWithTime);
      } catch (error) {
        console.error('Error in auction timer:', error);
      }
    }, 5000);
  }

  // Broadcast new logged-in user to all clients
  public newLoggedUserBroadcast(newUser: any): void {
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('user:logged-in', newUser);
      }
    }
  }

  // Broadcast user logged-out event to all clients
  public userLoggedOutBroadcast(loggedOutUser: any): void {
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('user:logged-out', loggedOutUser);
      }
    }
  }

  // Broadcast bid update to all clients
  public bidUpdateBroadcast(item: any): void {
    if (this.io) {
      //so frontend can actually access id as a member of a typescript object
      const data = item.toObject ? item.toObject() : item;
      this.io.emit('bid:updated', {...data, id: data._id.toString()});
    }
  }

  // Broadcast new item creation to all clients
  public newItemBroadcast(item: any): void {
    if (this.io) {
      const data = item.toObject ? item.toObject() : item;
      this.io.emit('item:created', {...data, id: data._id.toString()});
    }
  }

  // Broadcast item sold event to all clients
  public itemSoldBroadcast(item: any): void {
    if (this.io) {
      const data = item.toObject ? item.toObject() : item;
      const itemId = data._id.toString();
      this.io.emit('item:sold', {...data, id: itemId});
      this.closingSoonNotified.delete(itemId);
    }
  }

  // Broadcast outbid notification to specific user
  public outbidNotification(username: string, itemData: any): void {
    if (this.io && this.socketIDbyUsername.has(username)) {
      const socketID = this.socketIDbyUsername.get(username);
      this.io.to(socketID!).emit('user:outbid', itemData);
    }
  }

  // Broadcast items update to all clients
  public itemsUpdateBroadcast(items: any[]): void {
    if (this.io) {
      const data = items.map(item => {
        const obj = item.toObject ? item.toObject() : item;
        return {...obj, id: obj._id.toString()};
      });
      this.io.emit('update:items', data);
    }
  }

  //Broadcast expired items to all clients
  public itemExpiredBroadcast(item: any): void {
    if (this.io) {
      const data = item.toObject ? item.toObject() : item;
      const itemId = data._id.toString();
      this.io.emit('item:expired', {...data, id: itemId});
      this.closingSoonNotified.delete(itemId);
    }
  }

  //Broadcast auction time extension for given item to all clients
  public auctionExtendedBroadcast(item: any, extensionMs: number): void{
    if (this.io){
      const data = item.toObject ? item.toObject() : item;
      this.io.emit('auction:extended', {
        itemId: data._id.toString(),
      itemTitle: data.title,
      newEndsAt: data.endsAt,
      extensionMinutes: Math.round(extensionMs/60000)});
    }
  }

  public auctionClosingSoonBroadcast(item: any): void{
    if (this.io){
      const data = item.toObject ? item.toObject() : item;
      this.io.emit('auction:closing-soon', {
        itemId: data._id.toString(),
        itemTitle: data.title,
        remainingtime: data.remainingtime
      });
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();