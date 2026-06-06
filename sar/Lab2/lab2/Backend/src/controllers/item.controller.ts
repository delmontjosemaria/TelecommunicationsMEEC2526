import { Request, Response } from 'express';
import Item from '../models/item';
import User from '../models/user';
import socketService from '../services/socket.service';
import { sendOutbidEmail, sendWinEmail } from '../services/email.service';


/**
 * Create a new item
 */
export const createItem = async (req: Request, res: Response) => {
  console.log("NewItem -> received form submission new item");

  try{
    const {title, description, reservePrice, initialTime, buynow, owner} = req.body;
    if (!title || reservePrice === undefined || initialTime === undefined || buynow === undefined || owner === undefined) {
      res.status(400).json({error: 'Missing required fields'});
      return;
    }

    const creator = await User.findOne({username: owner});
    if (creator && !creator.isActive){
      res.status(403).json({error: 'User is blocked and cannot create items'});
      return;
    }

    const newItem = new Item({
      title: title,
      description: description || '',
      currentbid: reservePrice,
      reservePrice: reservePrice,
      initialTime: initialTime * 1000, //ms
      remainingtime: initialTime * 1000, //ms
      buynow: buynow,
      wininguser: '',
      sold: false,
      owner: owner,
      isActive: true,
      lastBidDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      endsAt: new Date(Date.now() + initialTime*1000)
    });

    console.log(newItem);

    const savedItem = await newItem.save();

    // Broadcast new item to all clients
    socketService.newItemBroadcast(savedItem);

    res.status(201).json(savedItem);
  }
  catch(error){
    console.error("Error creating item: ", error);
    res.status(500).json({error: 'Internal error while creating item'});
  }
};

/**
 * Remove an existing item
 */
export const removeItem = async (req: Request, res: Response) => {
  console.log("RemoveItem -> received form submission remove item");

  try{
    const {id} = req.params;

    if (!id){
      res.status(400).json({error: 'Item ID is required'});
      return;
    }

    // Update item to mark as inactive
    const updatedItem = await Item.findOneAndUpdate({_id: id}, {isActive: false}, {new: true});

    if (!updatedItem){
      res.status(404).json({error: 'Item not found!'});
      return;
    }

    res.status(200).json({message: 'Item removed successfully', item: updatedItem});
  }
  catch(error){
    console.error('Error removing item:', error);
    res.status(500).json({error: 'Internal error while removing item'});
  }
};

/**
 * Get all items with optional filtering
 */
export const getItems = async (req: Request, res: Response) => {
  console.log('received get Items');

  try{
    // Build filter object from query params
    const filter: any = { isActive: true };

    // Filter by price range
    if (req.query.minPrice) {
      filter.currentbid = { $gte: Number(req.query.minPrice) };
    }
    if (req.query.maxPrice) {
      filter.currentbid = filter.currentbid || {};
      filter.currentbid.$lte = Number(req.query.maxPrice);
    }

    // Filter by owner
    if (req.query.owner) {
      filter.owner = req.query.owner;
    }

    // Filter by status (active, sold, ended)
    if (req.query.status) {
      if (req.query.status === 'sold') {
        filter.sold = true;
      } else if (req.query.status === 'ended') {
        filter.remainingtime = { $lte: 0 };
      } else if (req.query.status === 'active') {
        filter.sold = false;
        filter.remainingtime = { $gt: 0 };
      }
    }

    // Text search on title/description
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const items = await Item.find(filter).sort({createdAt: -1});
    const itemsWithTime = items.map(item => ({
      ...item.toObject(),
      remainingtime: Math.max(0, item.endsAt.getTime() - Date.now())
    }));

    res.json(itemsWithTime);
    console.log(`responded with ${items.length} items`);
  }
  catch(error){
    console.error("Error fetching items: ", error);
    res.status(500).json({error: 'Internal error while fetching items'});
  }
};

/**
 * Update an existing item
 */
export const updateItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {id} = req.params;

    const allowed = ['title', 'description', 'buynow'];
    const safeUpdates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    // Update item by MongoDB _id
    const updatedItem = await Item.findOneAndUpdate(
      { _id: id, isActive: true },
      safeUpdates,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      res.status(404).json({error: 'Item not found'});
      return;
    }

    res.json(updatedItem);
  } catch(error) {
    console.error("Error updating item: ", error);
    res.status(500).json({error: 'Internal error while updating item'});
  }
};

/**
 * Place a bid on an item
 */
export const placeBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const {id} = req.params;
    const {bidAmount, username} = req.body;

    if (!bidAmount || !username) {
      res.status(400).json({error: 'Bid amount and username are required'});
      return;
    }

    const bidder = await User.findOne({username});
    if (bidder && !bidder.isActive) {
      res.status(403).json({error: 'Your account has been blocked'});
      return;
    }


    // Find item by MongoDB _id
    const item = await Item.findOne({_id: id, isActive: true});

    if (!item) {
      res.status(404).json({error: 'Item not found'});
      return;
    }

    if (item.sold) {
      res.status(400).json({error: 'Item already sold'});
      return;
    }

    if (item.remainingtime <= 0) {
      res.status(400).json({error: 'Auction has ended'});
      return;
    }

    // Check bid >= reserve AND > current bid
    if (bidAmount < item.reservePrice) {
      res.status(400).json({error: `Bid must be at least the reserve price of ${item.reservePrice}`});
      return;
    }

    if (bidAmount <= item.currentbid) {
      res.status(400).json({error: `Bid must be higher than current bid of ${item.currentbid}`});
      return;
    }

    if (item.owner === username) {
      res.status(403).json({ error: 'You cannot bid on your own item' });
      return;
    }

    // Store previous bidder for outbid notification
    const previousBidder = item.wininguser;

    // Handle Buy Now
    if (item.buynow && bidAmount >= item.buynow) {
      item.sold = true;
      item.currentbid = item.buynow;
      const winner = await User.findOne({username});
      //winner notification via email
      if (winner?.notificationPreferences?.emailOnWin) {
        await sendWinEmail(winner.email, {
          username: winner.username,
          itemTitle: item.title,
          finalBid: item.currentbid,
          itemId: String(item._id)
        });
      }

      item.currentbid = item.buynow;
      item.wininguser = username;
      item.isActive = false;
      const soldItem = await item.save();
      socketService.itemSoldBroadcast(soldItem);
      res.json({message: 'Item purchased via Buy Now!', item: soldItem});
      return;
    }

    // Update bid
    item.currentbid = bidAmount;
    item.wininguser = username;
    item.lastBidDate = new Date();

    // Soft-close extension: if bid in final 5 minutes, extend by 5 minutes
    const fiveMinutesInMs = 300000;
    if (item.remainingtime < fiveMinutesInMs) {
      item.remainingtime = fiveMinutesInMs;
    }

    const updatedItem = await item.save();

    // Broadcast bid update to all clients
    socketService.bidUpdateBroadcast(updatedItem);
    res.json({message: 'Bid placed successfully', item: updatedItem});

    setImmediate(async () => {
      try{
        // Notify previous bidder that they were outbid
        if (previousBidder && previousBidder !== username) {
          socketService.outbidNotification(previousBidder, {
            username: previousBidder,
            itemId: item._id,
            itemTitle: item.title,
            currentBid: bidAmount,
            newBidder: username
          });
          // Send outbid email if user has preference enabled
          const outbidUser = await User.findOne({username: previousBidder});
          if (outbidUser?.notificationPreferences?.emailOnOutbid) {
            await sendOutbidEmail(outbidUser.email, {
              username: outbidUser.username,
              itemTitle: item.title,
              currentBid: bidAmount,
              itemId: String(item._id)
            });
          }
        }
      }catch(err){console.error('Notification error (non-critical): ', err);}

    })
  } catch(error) {
    console.error("Error placing bid: ", error);
    res.status(500).json({error: 'Internal error while placing bid'});
  }
};