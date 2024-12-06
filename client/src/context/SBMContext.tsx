"use client"

import { Chat, Membership, Message, User } from "@pubnub/chat";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { SBMContext, SkillRange } from "../types/contextTypes";

export const SBMContextProvider = ({ children }: { children: ReactNode }) => {
  const [chat, setChat] = useState<Chat>();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [statsUser, setStatsUser] = useState<User | undefined>();
  const [skillBuckets, setSkillBuckets] = useState<Map<SkillRange, User[]>>(new Map());
  const [matchMakingUsers, setMatchMakingUsers] = useState<User[]>([]);
  const [recentMatchedUsers, setRecentMatchedUsers] = useState<User[]>([]);
  const [userStatusMap, setUserStatusMap] = useState<Map<string, string>>(new Map());
  const [logs, setLogs] = useState<string[]>([]);
  const userStatusMapRef = useRef<Map<string, string>>(new Map()); // Use useRef for userStatusMap

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
  * Hydrate stats
  */
  const hydrateStats = async() => {
    if(chat){
      let user: User | null = await chat.getUser("stats-sim");
      if(!user){
        user = await chat.createUser("stats-sim", {
          name: "Stats Data",
          custom: {
            totalPlayers: 0,
            avgWaitTime: 0,
            MatchesFormed: 0
          }
        });
      }

      setStatsUser(user);

      user.streamUpdates((user) => {
        setStatsUser(user);
      });

      console.log(JSON.stringify(user.custom));
    }
  }


  /*
  * Retrieves all users from the chat instance with a limit of 100.
  * Updates the allUsers state with the retrieved users.
  */
  const getAllUsers = async () => {
    const u = await chat?.getUsers({ limit: 1000 });
    if (u && u.users) {
      const users = u.users;

      setAllUsers(users);
      await hydrateUsers(users);
      // Initialize userStatusMap with each user set to "Finished" using useRef
      userStatusMapRef.current = new Map();

      organizeUsersIntoSkillBuckets(users);
    }
  };

    /*
 * Hydrate Users
 */
const hydrateUsers = async (users: User[]) => {
  try {
    // Iterate through all users and check their membership details
    await Promise.all(
      users.map(async (user) => {
        await checkMembershipDetails(user);
      })
    );
  } catch (error) {
    console.error("Error hydrating users:", error);
  }
};

  /*
  * Check membership details
  */
  const checkMembershipDetails = async (user: User) => {
    try {
      const fiveMinutesInTimetokens = 5 * 60 * 1000 * 10_000; // 5 minutes in timeToken units

      // Retrieve user memberships
      const obj = await user.getMemberships();
      const memberships = obj.memberships;

      // Iterate through memberships to check for specific channels
      memberships.forEach((membership: Membership) => {
        const timeToken = membership.lastReadMessageTimetoken;
        const channelName = membership.channel.id;

        // Ensure timeToken is defined
        if (timeToken !== undefined) {
          const timeTokenBigInt = BigInt(timeToken);
          const currentTimeToken = BigInt(Date.now()) * BigInt(10_000); // Current time in timeToken format
          const isWithinLastFiveMinutes = currentTimeToken - timeTokenBigInt <= BigInt(fiveMinutesInTimetokens);

          // Only consider recent memberships
          if (isWithinLastFiveMinutes) {
            if (channelName.startsWith("game-lobby-")) {
              // Set user status to "Matched"
              userStatusMapRef.current.set(user.id, "Matched");
              // Trigger re-render
              setUserStatusMap(new Map(userStatusMapRef.current));
            } else if (channelName.startsWith("pre-lobby-")) {
              // Set user status to "InMatch"
              userStatusMapRef.current.set(user.id, "InMatch");
              // Trigger re-render
              setUserStatusMap(new Map(userStatusMapRef.current));
            }
          }
        } else {
          console.warn(`Membership for channel ${channelName} has undefined timeToken.`);
        }
      });
    } catch (error) {
      console.error("Error checking membership details:", error);
      console.log(JSON.stringify(user.custom));
    }
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
                // Set user status to "Joining" in the status map using useRef
                userStatusMapRef.current.set(id, "Joining");
                // Optionally trigger a re-render if the UI needs to reflect this status change
                setUserStatusMap(new Map(userStatusMapRef.current));

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
                  // Set user status to "Joining" in the status map using useRef
                  userStatusMapRef.current.set(id, "Matched");
                  // Optionally trigger a re-render if the UI needs to reflect this status change
                  setUserStatusMap(new Map(userStatusMapRef.current));
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
                // Set user status to "Joining" in the status map using useRef
                userStatusMapRef.current.set(userId, "Confirmed");
                // Optionally trigger a re-render if the UI needs to reflect this status change
                setUserStatusMap(new Map(userStatusMapRef.current));
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
                // Set user status to "Joining" in the status map using useRef
                userStatusMapRef.current.set(id, "InMatch");
                // Optionally trigger a re-render if the UI needs to reflect this status change
                setUserStatusMap(new Map(userStatusMapRef.current));
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
                // Set user status to "Joining" in the status map using useRef
                userStatusMapRef.current.set(id, "Finished");
                // Optionally trigger a re-render if the UI needs to reflect this status change
                setUserStatusMap(new Map(userStatusMapRef.current));
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
    const initializeUsers = async () => {
      if (chat) {
        await getAllUsers();
        await startWatchChannel();
        await hydrateStats();
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
        statsUser,
        allUsers
      }}
    >
    {children}
    </SBMContext.Provider>
  )
}

export { SBMContext };

