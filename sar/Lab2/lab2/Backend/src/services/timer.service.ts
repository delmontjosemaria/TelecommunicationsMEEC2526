// services/timer.service.ts
import Item from '../models/item';
import { Server } from 'socket.io';

export function startExpiryTimer(io: Server) {
  setInterval(async () => {
    const now = new Date();
    const expiredItems = await Item.find({isActive: true, endsAt: {$lte: now}});

    for (const item of expiredItems) {
      item.isActive = false;
      await item.save();
      io.emit('item:expired', {...item.toObject(), id: (item._id as any)});
    }
  }, 10000);
}