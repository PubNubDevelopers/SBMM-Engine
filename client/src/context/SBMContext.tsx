"use client"

import { Channel, Chat, Membership, Message, User } from "@pubnub/chat";
import React, { ReactNode, useEffect, useState } from "react";
import { simulateUser } from '../../../tests/utils/test-runner';
import userJson from "../user.json";
import { generateUsername } from "unique-username-generator";

export interface SBMType {
  chat: Chat | undefined;
  matchMakingUsers: User[],
  simulateUsers: (count: number) => Promise<void>
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
    const u = await chat?.getUsers({
      limit: 100
    });
    if(u) setAllUsers(u.users)
  }

  /*
  * Organizes users into skill buckets based on their elo rating.
  * Buckets are mapped according to predefined elo ranges.
  * Updates the skillBuckets state with the sorted user data.
  */
  const organizeUsersIntoSkillBuckets = () => {
    const buckets: Map<SkillRange, User[]> = new Map([
      [SkillRange.Range1, []],
      [SkillRange.Range2, []],
      [SkillRange.Range3, []],
      [SkillRange.Range4, []],
    ]);

    allUsers.forEach(user => {
      const elo = user.custom?.elo || 0;
      if (elo < 1000) {
        buckets.get(SkillRange.Range1)?.push(user);
      } else if (elo < 1500) {
        buckets.get(SkillRange.Range2)?.push(user);
      } else if (elo < 2000) {
        buckets.get(SkillRange.Range3)?.push(user);
      } else {
        buckets.get(SkillRange.Range4)?.push(user);
      }
    });

    setSkillBuckets(buckets);
  };

  /*
  * Simulates users by selecting a specified count from a JSON file.
  * Shuffles the selected users randomly before initiating a simulation for each.
  * Uses createUser to set up each user and waits for all simulations to complete.
  */
  const simulateUsers = async (count: number) => {
    const users = userJson.users.slice(0, count);
    for (let i = users.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
      [users[i], users[j]] = [users[j], users[i]]; // Swap elements
    }
    const usersPromises = users.map(async (jsonUser) => {
      const user: User | undefined = await createUser(jsonUser);
      if(user){
        await simulateUser('us-east-1', user.id);
      }
    }
  );

    await Promise.all(usersPromises); // Wait for all simulations to complete
  };

  /*
  * Retrieves the highest user ID from the user JSON file.
  * Used to determine the starting point for generating new user IDs.
  * Returns the maximum ID found.
  */
  function getMaxId(){
    return userJson.users.reduce((maxId, user) => Math.max(maxId, user.id), 0);
  }

  /*
  * Generates a specified number of new users with unique IDs.
  * Sets initial values for each user, including username and latency.
  * Adds each newly created user to the allUsers state.
  */
  const generateUsers = async (count: number) => {
    const lastId = getMaxId();
    for (let i = lastId + 1; i <= lastId + count; i++){
      const u = generateUsername();
      const userMeta = {
        id: i,
        username: u,
        punished: false,
        confirmed: false,
        inMatch: false,
        inPreLobby: false,
        server: 'us-east-1',
        latency: Math.floor(Math.random() * 100) + 20
      }
      const user = await createUser(userMeta);
      if(user) setAllUsers([...allUsers, user]);
    }
  }

  /*
  * Creates a user if they don’t already exist within the chat instance.
  * Retrieves an existing user or creates a new one with custom properties.
  * Returns the created or existing user, or logs an error if unsuccessful.
  */
  async function createUser(u: any): Promise<User | undefined> {
    try{
      let user: User | null | undefined = await chat?.getUser(u.id);
      if(!user){
        user = await chat?.createUser(u.id, {
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
      }
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

  /*
  * Starts watching a designated matchmaking channel.
  * Listens for various event types, such as "Joining," "Matched," "Confirmed," "InMatch," and "Finished."
  * Updates user statuses in userStatusMap and logs each action.
  * Maintains recentMatchedUsers state with the latest matched users.
  */
  const startWatchChannel = async () => {
    // Ensure chat instance is defined before attempting to watch channel
    if (chat) {
      const watchChannelID = `Matchmaking-In-Progress-Client-Testing`;
      let watchChannel = await chat.getChannel(watchChannelID);

      // If the specified channel does not exist, create a new public conversation channel
      if (!watchChannel) {
        // If the channel doesn't exist, create a new one
        watchChannel = await chat.createPublicConversation({
          channelId: watchChannelID
        });
      }

      // Listen for incoming messages on the matchmaking channel
      watchChannel.join((message: Message) => {
        let parsedMessage: any;
        try {
          // Attempt to parse the message content as JSON
          parsedMessage = JSON.parse(message.content.text);
        } catch (error) {
          // Log parsing error and exit if message is not in valid JSON format
          console.log("Error parsing message: ", error);
          return;
        }

        // Extract user IDs and single user ID from the parsed message
        const userIds: string[] = parsedMessage.matchedUsers || [];
        const userId = parsedMessage.user;

        // Handle each type of matchmaking event based on message content
        switch (parsedMessage.message) {
          case "Joining":
            // Update status to "Joining" for each user in matchedUsers array and log action
            userIds.forEach(id => {
              setUserStatusMap((prev) => new Map(prev).set(id, "Joining"));
              logAction(`User ${id} is joining the matchmaking.`);
            });
            break;

          case "Matched":
            // For "Matched" events, update status to "Matched" for each user and log action
            if (userIds.length === 2) {
              userIds.forEach(id => {
                setUserStatusMap((prev) => new Map(prev).set(id, "Matched"));
                logAction(`User ${id} has been matched with another user.`);
              });
            } else {
              // Log an error if the matched users array does not contain exactly two users
              console.log("Error receiving matched users for Matched: ", JSON.stringify(parsedMessage));
            }
            break;

          case "Confirmed":
             // For "Confirmed" events, update the status to "Confirmed" for the specified user
            if (userId) {
              setUserStatusMap((prev) => new Map(prev).set(userId, "Confirmed"));
              logAction(`User ${userId} has confirmed their match.`);
            } else {
              // Log an error if no user ID is provided for confirmation
              console.log("Error receiving user confirmed: ", JSON.stringify(parsedMessage));
            }
            break;

          case "InMatch":
            // For "InMatch" events, update status to "InMatch" for both users and log action
            if (userIds.length === 2) {
              userIds.forEach(id => {
                setUserStatusMap((prev) => new Map(prev).set(id, "InMatch"));
                logAction(`User ${id} is now in a match.`);
              });

              // Update recentMatchedUsers with only the most recent matched users
              const matchedUsers = userIds.map(id => allUsers.find(user => user.id === id)).filter(Boolean) as User[];
              if (matchedUsers.length === 2) {
                setRecentMatchedUsers(matchedUsers);
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
                setUserStatusMap((prev) => new Map(prev).set(id, "Finished"));
                logAction(`User ${id}'s match has finished.`);
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
    const initializeUsers = async () => {
      if (chat) {
        await getAllUsers();
        organizeUsersIntoSkillBuckets();
      }
    };

    initializeUsers();
  }, [chat]);

  return (
    <SBMContext.Provider
      value={{
        chat,
        matchMakingUsers,
        simulateUsers
      }}
    >
    {children}
    </SBMContext.Provider>
  )
}

