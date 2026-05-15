import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config/config';
import User from '../models/user';

/**
 * Handle user authentication
 * Note: Original dummy functionality
 */
export const authenticate = (req: Request, res: Response): void => {
  console.log('Authenticate -> Received Authentication POST');
  
  // Generate JWT token youshould use a real user authentication here check in the database
  User.findOne({ username: req.body.username })
  // For now, we are just signing the request body
  const token = jwt.sign(req.body, config.jwtSecret);
  
  // Send response with token
  res.json({
    username: req.body.username,
    token
  });
  
  console.log('Authenticate -> Received Authentication POST');
};

/**
 * Handle user registration
 * Note: Original dummy functionality
 */
export const registerUser = (req: Request, res: Response): void => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);
  
  // Send dummy response with user data
  // In the  implementation, you have to save the user to the database
  res.json({
    name: "somename",
    email: "some@somemail.com",
    username: "someusername",
    password: "somepassword",
    latitude: 19.09,
    longitude: 34
  });
};

/**
 * Get all users
 * Note: Maintaining original dummy functionality
 */
export const getUsers = (req: Request, res: Response): void => {
  // Go to the database and get all users

//create dummy users for now
  const users = [
    {
      name: "somename",
      email: "some@somemail.com",
      username: "someusername",
      password: "somepassword",
      latitude: 19.09,
      longitude: 34
    }
  ];


  //  For now it just returns a dummy list of users, you should replace it with actual database query results
  res.json(users);
};