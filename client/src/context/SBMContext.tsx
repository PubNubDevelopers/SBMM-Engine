"use client"

import { Channel, Chat, Membership, Message, User } from "@pubnub/chat";
import React, { ReactNode, useEffect, useState } from "react";
import { simulateUser } from '../../../tests/utils/test-runner';
import userJson from "../user.json";
import { generateUsername } from "unique-username-generator";
import { v4 as uuidv4 } from 'uuid';

export interface SBMType {
  chat: Chat | undefined;
  matchMakingUsers: User[],
  skillBuckets: Map<SkillRange, User[]>,
  recentMatchedUsers: User[],
  userStatusMap: Map<string, string>,
  logs: string[],
  simulateUsers: (count: number) => Promise<void>,
  generateUsers: (count: number) => Promise<void>
}

export const SBMContext = React.createContext<SBMType | null>(null);

// Skill buckets defined by elo ranges
export enum SkillRange {
  Range1 = "0-999",
  Range2 = "1000-1499",
  Range3 = "1500-1999",
  Range4 = "2000+",
}

// Interface for skill buckets
export interface SkillBucket {
  range: SkillRange;
  users: User[];
}

export const SBMContextProvider = ({ children }: { children: ReactNode }) => {
  const [chat, setChat] = useState<Chat>();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [skillBuckets, setSkillBuckets] = useState<Map<SkillRange, User[]>>(new Map());
  const [matchMakingUsers, setMatchMakingUsers] = useState<User[]>([]);
  const [recentMatchedUsers, setRecentMatchedUsers] = useState<User[]>([]);
  const [userStatusMap, setUserStatusMap] = useState<Map<string, string>>(new Map());
  const [logs, setLogs] = useState<string[]>([]);

  /*
  * Initializes the PubNub Chat instance.
  * Sets up the chat context for matchmaking functionality.
  * Logs an error message if initialization fails.
  */
  const initChat = async () => {
    try{
      const chat = await Chat.init({
        publishKey: process.env.NEXT_PUBLIC_PUBLISH_KEY,
        subscribeKey: process.env.NEXT_PUBLIC_SUBSCRIBE_KEY,
        userId: "client-sim"
      });

      setChat(chat);
    }
    catch(e){
      console.error("Failed to initialize PubNub: ", e);
    }
  }

  /*
  * Retrieves all users from the chat instance with a limit of 100.
  * Updates the allUsers state with the retrieved users.
  */
  const getAllUsers = async () => {
    const u = await chat?.getUsers({ limit: 1000 });
    if (u) {
      // console.log("Initial fetched users from PubNub:");
      // printUsersData(u.users);  // Log initial data

      // Uncomment the following line to clean and update user data
      const users = await cleanUserData(u.users);
      // printUsersData(users);  // Log cleaned data

      console.log(users.length);
      setAllUsers(users);
      organizeUsersIntoSkillBuckets(users);
    }
  };

  /*
  * Ensures each user has required fields by adding missing attributes without overwriting existing values
  * Returns a list of users that were updated
  */
  const cleanUserData = async (users: User[]): Promise<User[]> => {
    const allUsers: User[] = [];

    await Promise.all(users.map(async (user) => {
      let needsUpdate = false; // Track if any field is missing or needs updating

      const updatedData: {
        name?: string;
        custom: {
          elo: number;
          punished: boolean;
          confirmed: boolean;
          inMatch: boolean;
          inPreLobby: boolean;
          server: string;
          latency: number;
        };
      } = { custom: {} as any };  // Initialize custom to ensure it is always defined

      // Only set the name if it's missing or starts with a number
      if (!user.name || /^\d/.test(user.name)) {
        updatedData.name = generateUsername();
        needsUpdate = true;
        console.log(`Generated name for user (ID: ${user.id}): ${updatedData.name}`);
      }

      // Set each field in updatedData.custom, and mark needsUpdate as true if any field is missing
      updatedData.custom = {
        elo: user.custom?.elo ?? (() => { needsUpdate = true; return generateLongTailElo(); })(),
        punished: user.custom?.punished ?? (() => { needsUpdate = true; return false; })(),
        confirmed: user.custom?.confirmed ?? (() => { needsUpdate = true; return false; })(),
        inMatch: user.custom?.inMatch ?? (() => { needsUpdate = true; return false; })(),
        inPreLobby: user.custom?.inPreLobby ?? (() => { needsUpdate = true; return false; })(),
        server: user.custom?.server ?? (() => { needsUpdate = true; return 'us-east-1'; })(),
        latency: user.custom?.latency ?? (() => { needsUpdate = true; return Math.floor(Math.random() * 100) + 20; })()
      };

      // Only update if there are fields that were missing and set in updatedData
      if (needsUpdate) {
        try {
          const updatedUser = await user.update(updatedData);
          allUsers.push(updatedUser);
        } catch (error) {
          console.error(`Failed to update user ${user.name} (ID: ${user.id}):`, error);
        }
      } else {
        // If no update was needed, add the original user
        allUsers.push(user);
      }
    }));

    return allUsers;
  };

  /*
  * Organizes users into skill buckets based on their elo rating.
  * Buckets are mapped according to predefined elo ranges.
  * Updates the skillBuckets state with the sorted user data.
  */
  const organizeUsersIntoSkillBuckets = (users: User[]) => {
    setSkillBuckets((prevBuckets) => {
      // Create a new Map based on the existing buckets or initialize if they don't exist
      const updatedBuckets = new Map(prevBuckets);

      // Ensure each skill range bucket exists in the updatedBuckets map
      if (!updatedBuckets.has(SkillRange.Range1)) updatedBuckets.set(SkillRange.Range1, []);
      if (!updatedBuckets.has(SkillRange.Range2)) updatedBuckets.set(SkillRange.Range2, []);
      if (!updatedBuckets.has(SkillRange.Range3)) updatedBuckets.set(SkillRange.Range3, []);
      if (!updatedBuckets.has(SkillRange.Range4)) updatedBuckets.set(SkillRange.Range4, []);

      // Iterate through the users and assign them to the appropriate skill bucket
      users.forEach(user => {
        const elo = user.custom?.elo || 0;

        if (elo < 1000) {
          updatedBuckets.get(SkillRange.Range1)?.push(user);
        } else if (elo < 1500) {
          updatedBuckets.get(SkillRange.Range2)?.push(user);
        } else if (elo < 2000) {
          updatedBuckets.get(SkillRange.Range3)?.push(user);
        } else {
          updatedBuckets.get(SkillRange.Range4)?.push(user);
        }
      });

      return updatedBuckets;
    });
  };

  /*
  * Simulates users by selecting a specified count from the allUsers state.
  * Shuffles the selected users randomly before initiating a simulation for each.
  * Uses createUser to set up each user and waits for all simulations to complete.
  */
  const simulateUsers = async (count: number) => {
    // Select the first `count` users from allUsers
    const users = allUsers.slice(0, count);

    console.log("Simulating Users: ");
    // Map each user to a simulation promise
    const usersPromises = users.map(async (user) => {
      console.log(user.name);
      // Check if user already exists, otherwise create and simulate
      await simulateUser('us-east-1', user.id);
    });

    // Wait for all simulations to complete
    await Promise.all(usersPromises);
  };

  /*
 * Generates an elo value with a long-tail distribution between 0 and 3000.
 * The result is skewed towards lower values, with fewer high-end values.
 */
  const generateLongTailElo = () => {
    const maxElo = 3000;
    const random = Math.random();
    return Math.floor(maxElo * Math.pow(random, 3)); // Cubic distribution for long tail
  }

  /*
  * Generates a specified number of new users with unique IDs.
  * Sets initial values for each user, including username and latency.
  * Adds each newly created user to the allUsers state.
  */
  const generateUsers = async (count: number) => {
    let users: User[] = [];

    for (let i = 0; i < count; i++) {
      const u = generateUsername();
      console.log("Generated username: ", u);
      const userMeta = {
        id: uuidv4(),
        username: u,
        elo: generateLongTailElo(),
        punished: false,
        confirmed: false,
        inMatch: false,
        inPreLobby: false,
        server: 'us-east-1',
        latency: Math.floor(Math.random() * 100) + 20
      };

      const user = await createUser(userMeta);
      if (user) {
        users.push(user); // Add each created user to the users array
      }
    }

    // Update the allUsers state by appending the new users
    setAllUsers((prevAllUsers) => [...prevAllUsers, ...users]);

    // Organize the new users into skill buckets
    organizeUsersIntoSkillBuckets(users);
  };

  /*
  * Creates a user if they don’t already exist within the chat instance.
  * Retrieves an existing user or creates a new one with custom properties.
  * Returns the created or existing user, or logs an error if unsuccessful.
  */
  async function createUser(u: any): Promise<User | undefined> {
    if(!chat) {
      console.log("Failed to initialize chat");
      return;
    }
    try{
      console.log(u.id);
      console.log(u.username);
      console.log(u.elo);
      console.log(u.punished);
      const user = await chat.createUser(u.id, {
        name: u.username,
        custom: {
          elo: u.elo,
          punished: u.punished,
          confirmed: u.confirmed,
          inMatch: u.inMatch,
          inPreLobby: u.inPreLobby,
          server: u.server,
          latency: u.latency
        }
      });
      console.log("USERRR: ");
      console.log(user);
      if(!user){
        throw new Error("Failed to initialize user");
      }

      return user;
    }
    catch(e){
      console.log(e);
    }
  }

  /*
  * Appends a new action log entry to the logs state.
  * Includes a timestamp and formatted message for tracking actions in real-time.
  */
  const logAction = (action: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${action}\n`;
    setLogs((prevLogs) => [...prevLogs, logMessage]); // Append new log entry to logs state
  };

  const getUser = async (id: string) => {
    if(chat){
      let user: User | undefined | null = allUsers.find(user => user.id === id);
      if(!user){
        try{
          user = await chat.getUser(id);
        }
        catch(e){
          console.log("Failed to get user");
        }
      }
      if(user){
        return user;
      }
      return undefined;
    }
    return undefined;
  }

  /*
  * Starts watching a designated matchmaking channel.
  * Listens for various event types, such as "Joining," "Matched," "Confirmed," "InMatch," and "Finished."
  * Updates user statuses in userStatusMap and logs each action.
  * Maintains recentMatchedUsers state with the latest matched users.
  */
  const startWatchChannel = async () => {
    console.log("Start watch channel");
    // Ensure chat instance is defined before attempting to watch channel
    if (chat) {
      console.log("init watch channel");
      const watchChannelID = `Matchmaking-In-Progress-Client-Testing`;
      let watchChannel = await chat.getChannel(watchChannelID);

      // If the specified channel does not exist, create a new public conversation channel
      if (!watchChannel) {
        // If the channel doesn't exist, create a new one
        watchChannel = await chat.createPublicConversation({
          channelId: watchChannelID
        });
      }

      console.log(watchChannel);

      // Listen for incoming messages on the matchmaking channel
      watchChannel.join(async (message: Message) => {
        let parsedMessage: any;
        try {
          // Attempt to parse the message content as JSON
          parsedMessage = JSON.parse(message.content.text);
        } catch (error) {
          // Log parsing error and exit if message is not in valid JSON format
          console.log("Error parsing message: ", error);
          return;
        }

        console.log(parsedMessage);

        // Extract user IDs and single user ID from the parsed message
        const userIds: string[] = parsedMessage.matchedUsers || [];
        const userId = parsedMessage.user;

        // Handle each type of matchmaking event based on message content
        switch (parsedMessage.message) {
          case "Joining":
            // Update status to "Joining" for each user in matchedUsers array and log action
            for(const id of userIds){
              try{
                const user: User | undefined = await getUser(id);
                setUserStatusMap((prev) => new Map(prev).set(id, "Joining"));

                if(user){
                  logAction(`User ${user.name} is joining the matchmaking.`);
                }
                else{
                  logAction(`User ${id} is joining the matchmaking.`);
                }
              }
              catch(e){
                console.error(`Error fetching user ${id}:`, e);
              }
            }
            break;

          case "Matched":
            // For "Matched" events, update status to "Matched" for each user and log action
            if (userIds.length === 2) {
              for(const id of userIds){
                try{
                  const user: User | undefined = await getUser(id);
                  setUserStatusMap((prev) => new Map(prev).set(id, "Matched"));
                  if(user){
                    logAction(`User ${user.name} has been matched with another user.`);
                  }
                  else{
                    logAction(`User ${id} has been matched with another user.`);
                  }
                }
                catch(e){
                  console.error(`Error fetching user ${id}`, e);
                }
              }
            } else {
              // Log an error if the matched users array does not contain exactly two users
              console.log("Error receiving matched users for Matched: ", JSON.stringify(parsedMessage));
            }
            break;

          case "Confirmed":
             // For "Confirmed" events, update the status to "Confirmed" for the specified user
            if (userId) {
              try{
                const user: User | undefined = await getUser(userId);
                setUserStatusMap((prev) => new Map(prev).set(userId, "Confirmed"));
                if(user){
                  logAction(`User ${user.name} has confirmed their match.`);
                }
                else{
                  logAction(`User ${userId} has confirmed their match.`);
                }
              }
              catch(e){
                console.error(`Error fetching user ${userId}`, e);
              }
            } else {
              // Log an error if no user ID is provided for confirmation
              console.log("Error receiving user confirmed: ", JSON.stringify(parsedMessage));
            }
            break;

          case "InMatch":
            // For "InMatch" events, update status to "InMatch" for both users and log action
            if (userIds.length === 2) {
              for(const id of userIds){
                const user: User | undefined = await getUser(id);
                setUserStatusMap((prev) => new Map(prev).set(id, "InMatch"));
                if(user){
                  logAction(`User ${user.name} is now in a match.`);
                }
                else{
                  logAction(`User ${id} is now in a match.`);
                }
              }

              // Update recentMatchedUsers with only the most recent matched users
              const matchedUsers = userIds.map(id => allUsers.find(user => user.id === id)).filter(Boolean) as User[];
              if (matchedUsers.length === 2) {
                setRecentMatchedUsers(matchedUsers);
              }
              else if(userIds.length == 2){
                const player1: User | null = await chat.getUser(userIds[0]);
                const player2: User | null = await chat.getUser(userIds[1]);
                if(player1 && player2){
                  setRecentMatchedUsers([player1, player2]);
                }
                else{
                  console.log("Error Finding Users to set recentMatchedUsers");
                }
              }
            } else {
              // Log an error if the matched users array does not contain exactly two users
              console.log("Error receiving matched users for InMatch: ", JSON.stringify(parsedMessage));
            }
            break;

          case "Finished":
            // For "Finished" events, update status to "Finished" for each user and log action
            if (userIds.length > 0) {
              userIds.forEach(id => {
                const user: User | undefined = allUsers.find(user => user.id === id);
                setUserStatusMap((prev) => new Map(prev).set(id, "Finished"));
                if(user){
                  logAction(`User ${user.name} match has finished.`);
                }
                else{
                  logAction(`User ${id}'s match has finished.`);
                }
              });
            }
            break;

          default:
            // Log unknown message types to monitor for unexpected event types
            console.log("Unknown message type: ", parsedMessage.message);
        }
      });
    } else {
      console.log("Error watching matchmaking channel: Chat is not defined");
    }
  };



  /*
  * Initializes the chat instance when the component mounts if not already set up.
  * Ensures that the chat instance is available for further operations.
  */
  useEffect(() => {
    if(!chat){
      initChat();
    }
  }, [chat, initChat]);

  /*
  * Fetches all users and organizes them into skill buckets once chat is initialized.
  * Executes asynchronously after the chat instance becomes available.
  */
  useEffect(() => {
    console.log("Initializing Users");
    const initializeUsers = async () => {
      if (chat) {
        await getAllUsers();
        await startWatchChannel();
      }
    };

    initializeUsers();
  }, [chat]);

  return (
    <SBMContext.Provider
      value={{
        chat,
        matchMakingUsers,
        skillBuckets,
        recentMatchedUsers,
        userStatusMap,
        logs,
        simulateUsers,
        generateUsers
      }}
    >
    {children}
    </SBMContext.Provider>
  )
}

