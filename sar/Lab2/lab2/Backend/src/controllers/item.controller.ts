import { Request, Response } from 'express';

/**
 * Create a new item
 * Note: original dummy functionality
 */
export const createItem = (req: Request, res: Response): void => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);
  
  // Send dummy response as in the original code
  res.json({
    description: "somedescription",
    currentbid: "somecurrentbid",
    remainingtime: "someremainingtime",
    wininguser: "somewininguser"
  });
};

/**
 * Remove an existing item
 * Note: original dummy functionality
 */
export const removeItem = (req: Request, res: Response): void => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);
  
  // No response was sent in the original code
  res.status(200).end();
};

/**
 * Get all items
 * Note: original dummy functionality
 */
export const getItems = (req: Request, res: Response): void => {
  // Create dummy items 
  const items = [
    {
      description: 'Smartphone',
      currentbid: 250,
      remainingtime: 120,
      buynow: 1000,
      wininguser: 'dummyuser1',
      sold: false,
      owner: 'dummyowner1',
      id: 1
    },
    {
      description: 'Tablet',
      currentbid: 300,
      remainingtime: 120,
      buynow: 940,
      wininguser: 'dummyuser2',
      sold: false,
      owner: 'dummyowner2',
      id: 2
    },
    {
      description: 'Computer',
      currentbid: 120,
      remainingtime: 120,
      buynow: 880,
      wininguser: 'dummyuser3',
      sold: false,
      owner: 'dummyowner3',
      id: 3
    }
  ];
  
  // Send response
  res.json(items);
  console.log("received get Items call responded with: ", items);
};