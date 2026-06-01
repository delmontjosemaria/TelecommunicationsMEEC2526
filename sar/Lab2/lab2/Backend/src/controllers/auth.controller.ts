import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/config';
import User from '../models/user';
import socketService from '../services/socket.service';

/**
 * Handle user authentication
 */
export const authenticate = async (req: Request, res: Response) => {
  console.log('Authenticate -> Received Authentication POST');

  try{
    const {username, password, latitude, longitude} = req.body;

    if (!username || !password){
      res.status(400).json({error: 'Username and password are required'});
      return;
    }

    const user = await User.findOne({username: username});
    if (!user){
      console.log('Authentication failed: user ${username} not found!');
      res.status(401).json({error: 'Invalid username or password'});
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid){
      console.log('Authentication failed: Invalid password for user ${username}');
      res.status(401).json({error: 'Invalid username or password'});
      return;
    }

    if (user.isActive === false){
      res.status(403).json({error: 'Account disabled, please contact support.'});
      return;
    }

    await User.updateOne({username: username}, {$set: {lastLoginAt: new Date(), latitude: latitude, longitude: longitude}});

    const token = jwt.sign({userId: user._id, username: user.username, role: user.role}, config.jwtSecret, {expiresIn: '24h'});

    // Broadcast user login to all connected clients
    socketService.newLoggedUserBroadcast({
      username: user.username,
      latitude: latitude || 0,
      longitude: longitude || 0
    });

    res.json({success: true, username: user.username, token: token, expiresIn: '24h'});

    console.log('Authentication successful: ${username} logged in');
  }
  catch (error){
    console.error('Authentication error:', error);
    return res.status(500).json({error:"Internal server error during authentication"});
  }

  console.log('Authenticate -> Handled Authentication POST');
};

/**
 * Handle user registration
 */
export const registerUser = async (req: Request, res: Response) => {
  console.log("NewUser -> received form submission new user");
  
  try{
    const {username, password, email} = req.body;
    const existingUser = await User.findOne({$or: [{username}, {email}]});

    if (existingUser){
      res.status(400).json({error: 'Username or email already exists'});
      return;
    }

    const newUser = new User({username, password, email});
    await newUser.save();

    const token = jwt.sign({userId: newUser._id, username: newUser.username}, config.jwtSecret, {expiresIn: '24h'});

    res.status(201).json({success: true, username: newUser.username, token: token, message: 'User registered successfully!'});
  }
  catch(error){
    console.error('Registration error:', error);
    res.status(500).json({error: 'Internal server error while registering user'});
  }
};

/**
 * Get all users
 */
export const getUsers = async (req: Request, res: Response) => {
  // Go to the database and get all users

  try{
    const users = await User.find({}, 'name email username latitude longitude');
    res.status(200).json({success: true, count: users.length, data: users});
  }
  catch(error){
    console.error('Error fetching users:', error);
    res.status(500).json({error: "Internal server error while getting users."});
  }
};