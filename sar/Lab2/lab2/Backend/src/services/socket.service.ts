import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import config from '../config/config';
import Item from '../models/item';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

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
        // Get all active items
        const items = await Item.find({ isActive: true, sold: false });

        for (const item of items) {
          // Decrement remaining time by 1000ms (1 second)
          const newRemainingTime = Math.max(0, item.remainingtime - 1000);
          item.remainingtime = newRemainingTime;

          // If auction ended, mark as sold
          if (newRemainingTime <= 0 && !item.sold) {
            item.sold = true;
            item.isActive = false;
            await item.save();
            // Broadcast item sold event
            this.itemSoldBroadcast(item);
          } else {
            await item.save();
          }
        }

        // Broadcast updated items list to all clients
        const updatedItems = await Item.find({ isActive: true });
        this.itemsUpdateBroadcast(updatedItems);
      } catch (error) {
        console.error('Error in auction timer:', error);
      }
    }, 1000);
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
      this.io.emit('bid:updated', item);
    }
  }

  // Broadcast new item creation to all clients
  public newItemBroadcast(item: any): void {
    if (this.io) {
      this.io.emit('item:created', item);
    }
  }

  // Broadcast item sold event to all clients
  public itemSoldBroadcast(item: any): void {
    if (this.io) {
      this.io.emit('item:sold', item);
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
      this.io.emit('update:items', items);
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