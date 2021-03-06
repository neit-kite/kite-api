const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const { saltRounds } = require('../../config/config');

/**
 * Function which takes a Mongoose response and formats it for GrahpQL
 * @param {*} mongooseData - Data returned from a Mongoose call
 * @returns {Object} - Formatted response
 */
const formatMongooseResponse = mongooseData => {
  if(Array.isArray(mongooseData)) {
    return mongooseData.map(obj => {
      return formatMongooseResponse(obj);
    });
  } else {
    const formattedContainers = mongooseData.containers.map(container => ({
      ...container.toObject(),
      _id: container._id.toString(),
    }));
    return {
      ...mongooseData.toObject(),
      containers: formattedContainers,
      _id: mongooseData._id.toString(),
    }
  }
}

/**
 * @version 1.0
 * @namespace UserResolvers
 */
const UserResolvers = {
  Query: {
    /**
     * Resolver which takes a userid and searches the database for a matching userid
     * @async
     * @memberof UserResolvers
     * @method getAnyUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} args - Arguments pass in by the user
     * @param {string} args.userid - User ID to search by
     * @param {Object} req - Express request object
     * @param {Object} req.session - Contains stored user information
     * @param {string} req.session.userObjectID - ObjectID used to lookup requesting user in database
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object>} - The found user's information
     */
    getAnyUser: async (root, { userid }, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const requestingUser = await User.findById(requesterObjectID).exec();

        if(requestingUser.scope.includes("admin") || requestingUser.scope.includes("createAdmin")) {
          const user = await User.findOne({ userid: userid}).populate("containers").exec();
          return formatMongooseResponse(user);
        } else {
          throw new Error("You do not have the required permissions to complete this action");
        }
      } else {
        throw new Error("You need to login to perform this action");
      }
    },

    /**
     * Resolver which returns the currently logged in user's information
     * @async
     * @memberof UserResolvers
     * @method getCurrentUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} [args] - Arguments passed in by the user, this resolver requires none
     * @param {Object} req - Express request object
     * @param {Object} req.session - Contains stored user information
     * @param {string} req.session.userObjectID - Used to lookup currently logged in user in the database
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object>} - Currently logged in user with fresh information from the database
     */
    getCurrentUser: async (root, args, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const currentUser = await User.findById(requesterObjectID).populate("containers").exec();
        return formatMongooseResponse(currentUser);
      } else {
        throw new Error("You need to login to perform this action");
      }
    },

    /**
     * Resolver which returns a listing of all users - We should paginate this response at some point
     * @async
     * @memberof UserResolvers
     * @method getUsers
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} [args] - Arguments passed in by the user, this resolver requires none
     * @param {Object} req - Express request object
     * @param {Object} req.session - Contains stored user information
     * @param {string} req.session.userObjectID - Used to lookup currently logged in user in the database
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object[]>} - List of all users
     */
    getUsers: async (root, args, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const requestingUser = await User.findById(requesterObjectID).exec();

        if(requestingUser.scope.includes("admin") || requestingUser.scope.includes("createAdmin")) {
          const users = await User.find().populate("containers").exec();
          return formatMongooseResponse(users);
        } else {
          throw new Error("You do not have the required permissions to complete this action");
        }
      } else {
        throw new Error("You need to login to perform this action");
      }
    },
  },
  Mutation: {
    /**
     * GrahphQL resolver which takes user information and creates a new user
     * @async
     * @memberof UserResolvers
     * @method createUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} args - Arguments passed in by the user 
     * @param {string} args.userid - New user's ID Number
     * @param {string} args.password - Any password, new user will be prompted to change it on their first login
     * @param {string} args.name - New user's name
     * @param {string[]} args.scope - New user's assigned scope, this is what allows them to perform specific action on the site
     * @param {Object} req - Express request object
     * @param {Object} req.session - The requesting user's session, which contains information about them. We use this verify users have the required scope to perform the requested action.
     * @param {string} req.session.userObjectID - Requesting user's ObjectID. Used to verify scope.
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object>} - New user data
     */
    createUser: async (root, { userid, password, name, scope }, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const requestingUser = await User.findById(requesterObjectID).exec();

        if(requestingUser.scope.includes("admin") || requestingUser.scope.includes("createAdmin")) {
          const hash = await bcrypt.hash(password, saltRounds);
          const createdUser = await new User({
            _id: mongoose.Types.ObjectId(),
            userid: userid,
            password: hash,
            forceReset: true,
            logins: 0,
            name: name,
            containers: [],
            preferences: {
              theme: "Light",
            },
            scope: scope,
          }).save();
          return formatMongooseResponse(createdUser);
        } else {
          throw new Error("You do not have the required permissions to complete this action");
        }
      } else {
        throw new Error("You need to login to perform this action");
      }
    },
    
    /**
     * Resolver to delete a user by a specified user ID
     * @async
     * @memberof UserResolvers
     * @method deleteUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} args - Arguments passed in by the user
     * @param {string} args.userid - User ID to search by
     * @param {Object} [req] - Express request object
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object>} - Deleted user's information
     */
    deleteUser: async (root, { userid }, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const requestingUser = await User.findById(requesterObjectID).exec();
        
        if(requestingUser.scope.includes("admin") || requestingUser.scope.includes("createAdmin")) {
          const deletedUser = await User.findOneAndDelete({ userid: userid }).exec();
          return formatMongooseResponse(deletedUser);
        } else {
          throw new Error("You do not have the required permissions to complete this action");
        }
      } else {
        throw new Error("You need to login to perform this action");
      }
    },

    /**
     * GrahpQL resolver which takes a userid and password, and attempts to login the user
     * @async
     * @memberof UserResolvers
     * @method loginUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} args - Arguments passed in by the user
     * @param {string} args.userid - User ID to log user in with
     * @param {string} args.password - Password to log user in with
     * @param {Object} req - Express request object
     * @param {Object} req.session - The requesting user's session. If login is successful, we store their ObjectID here for lookup later.
     * @param {Object} [context] - GrahpQL context object
     * @returns {Promise<Object>} - If successful, will return the logged in user.
     */
    loginUser: async (root, { userid, password }, { session }) => {
      const userFromDB = await User.findOne({ userid: userid }).exec();
      if(userFromDB) {
        const match = await bcrypt.compare(password, userFromDB.password);
        if(match) {
          const loggedInUser = await User.findOneAndUpdate({ _id: userFromDB._id }, { logins: userFromDB.logins + 1 }, { new: true }).populate("containers").exec();
          session.userObjectID = loggedInUser._id;
          return formatMongooseResponse(loggedInUser);
        }
        throw new Error("Incorrect password");
      }
      throw new Error("User does not exist");
    },

    /**
     * Resolver which simply signs out the currently logged in user using the ObjectID stored in the session store
     * @async
     * @memberof UserResolvers
     * @method signOutUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} [args] - Arguments passed in by the user, this resolver requires none
     * @param {Object} req - Express request object.
     * @param {Object} req.session - Currently logged in user's session
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<boolean>} - Status of the logout request
     */
    signOutUser: async(root, args, { session }) => new Promise((resolve, reject) => {
      if(session.userObjectID !== undefined) {
        session.destroy(err => {
          if (err) {
            reject(false);
          } else {
            resolve(true)
          }
        });
      } else {
        throw new Error("You need to login to perform this action");
      }
    }),

    /**
     * Resolver which takes a userid to update, and an object containing the new user's information
     * @async
     * @memberof UserResolvers
     * @method updateUser
     * @param {Object} root - The root object passed from Apollo
     * @param {Object} args - Arguments passed in by the user
     * @param {string} args.userid - ID number to update
     * @param {Object} args.user - Object containing user information to update
     * @param {string} [args.user.password] - New password for specified user
     * @param {boolean} [args.user.forceReset] - Set true to force user to update password, false does the inverse
     * @param {string} [args.user.name] - New name for specified user
     * @param {Object} [args.user.preferences] - Object containing users new preferences
     * @param {string} [args.user.preferences.theme] - New theme preference
     * @param {string[]} [args.user.scope] - Updated scope
     * @param {Object} req - Express request object
     * @param {Object} req.session - Currently logged in user's session
     * @param {string} req.session.userObjectID - Used to lookup currently logged in user in the database
     * @param {Object} [context] - GraphQL context object
     * @returns {Promise<Object>} - Updated user object
     */
    updateUser: async(root, { userid: userIdToUpdate, user: userNewInfo }, { session: { userObjectID: requesterObjectID } }) => {
      if(requesterObjectID !== undefined) {
        const requestingUser = await User.findById(requesterObjectID).exec();

        if(requestingUser.scope.includes("admin") || requestingUser.scope.includes("createAdmin") || userNewInfo.password !== undefined) {
          if(userNewInfo.password) {
            userNewInfo.password = await bcrypt.hash(userNewInfo.password, saltRounds);
          }
          const updatedUser = await User.findOneAndUpdate({ userid: userIdToUpdate }, { ...userNewInfo }, { new: true }).populate("containers").exec();
          return formatMongooseResponse(updatedUser);
        } else {
          throw new Error("You do not have the required permissions to complete this action");
        }
      } else {
        throw new Error("You need to login to perform this action");
      }
    }
  },
  Subscription: {},
}

module.exports = { UserResolvers };