import { Request, Response } from 'express';
import Item from '../models/item';


/**
 * Create a new item
 */
export const createItem = async (req: Request, res: Response) => {
  console.log("NewItem -> received form submission new item");
  //console.log(req.body);

  try{
    const {title, description, reservePrice, remainingtime, buynow, wininguser, sold, owner, id, isActive} = req.body;
    if (!title || reservePrice === undefined || remainingtime === undefined || buynow === undefined || sold === undefined || owner === undefined || id === undefined) {
      res.status(400).json({error: 'Missing required fields'});
      return;
    }

    const newItem = new Item({title: title, description: description || '', currentbid: reservePrice, reservePrice: reservePrice, remainingtime: remainingtime, buynow: buynow, wininguser: wininguser || '', sold: false, owner: owner, id: id, isActive: isActive, lastBidDate: ''});

    const savedItem = await newItem.save();
    
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
  //console.log(req.body);

  try{
    const {id} = req.body;

    if (!id){
      res.status(400).json({error: 'Item ID is required'});
      return;
    }

    const updatedItem = await Item.findOneAndUpdate({id: id}, {isActive: false}, {new: true});

    if (!updatedItem){
      res.status(404).json({error: 'Item not found!'});
      return;
    }

    res.status(200).json({message: 'Item removed successfully', item: updatedItem});
  }
  catch(error){
    res.status(500).json({error: 'Internal error while removing item'});
  }
  
};

/**
 * Get all items
 */
export const getItems = async (req: Request, res: Response) => {
  console.log('received get Items');

  try{
    const items = await Item.find({isActive: true}).sorte({id: 1});
    res.json(items);
    console.log('responded with ${items.length} items');
  }
  catch(error){
    console.error("Error fetching items: ", error);
    res.status(500).json({error: 'Internal error while fetching items'});
  }
};

/**
 * Get item by ID
 */
export const getItemById = async (req: Request, res: Response) => {
  try {
    const {id} = req.params;

    const item = await Item.findOne({id: parseInt(id), isActive: true});

    if (!item){
      res.status(404).json({error: 'Item not found'});
      return;
    }

    res.json(item);
  } 
  catch(error){
    res.status(500).json({error: 'Internal error while fetching item'});
  }
}; 

/**
 * Update an existing item
 */
export const updateItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedItem = await Item.findOneAndUpdate(
      { id: parseInt(id), isActive: true },
      updates,
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
    
    const item = await Item.findOne({ id: parseInt(id), isActive: true });
    
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
    
    //bid deve ser >= reservePrice E > currentbid
    if (bidAmount < item.reservePrice) {
      res.status(400).json({error: `Bid must be at least the reserve price of ${item.reservePrice}`});
      return;
    }
    
    if (bidAmount <= item.currentbid) {
      res.status(400).json({error: `Bid must be higher than current bid of ${item.currentbid}`});
      return;
    }
    
    // Verificação de buynow
    if (item.buynow && bidAmount >= item.buynow) {
      // Se o bid atingir ou ultrapassar buynow, o item é vendido imediatamente
      item.sold = true;
      item.currentbid = item.buynow;
      item.wininguser = username;
      item.isActive = false;
      const soldItem = await item.save();
      res.json({message: 'Item purchased via Buy Now!', item: soldItem});
      return;
    }
    
    // Bid normal
    item.currentbid = bidAmount;
    item.wininguser = username;
    
    const updatedItem = await item.save();
    
    res.json({message: 'Bid placed successfully', item: updatedItem});
  } catch(error) {
    console.error("Error placing bid: ", error);
    res.status(500).json({error: 'Internal error while placing bid'});
  }
};