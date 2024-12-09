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
    const users = await fetchUsersByIds([
      "7094df60-11d9-47fe-8690-10b5932b3a29",
      "5c44ac5e-23eb-455f-8100-23ba69969225",
      "3b598d50-3582-4284-b2eb-ca1842bd1ae2",
      "0812a3db-ea89-40a4-ad79-c3acc4a2e578",
      "1f18ae65-398b-4718-8fa4-18bcee5cfb22",
      "1444d002-6145-4521-a47a-c1ffedfb9765",
      "eb688e7b-7b5d-4a4f-af16-a842f6a15845",
      "62ad1b37-fe77-40ec-895c-572ad0b7232a",
      "5d62b43b-7216-4257-8f85-001871f65981",
      "user-998",
      "user-959",
      "user-949",
      "user-937",
      "user-913",
      "user-911",
      "user-910",
      "user-908",
      "user-898",
      "user-880",
      "user-866",
      "user-848",
      "user-847",
      "user-837",
      "user-833",
      "user-825",
      "user-816",
      "user-811",
      "user-790",
      "user-778",
      "user-761",
      "user-759",
      "user-755",
      "user-741",
      "user-740",
      "user-74",
      "user-730",
      "user-727",
      "user-719",
      "user-707",
      "user-706",
      "user-703",
      "user-702",
      "user-701",
      "user-666",
      "user-649",
      "user-615",
      "user-58",
      "user-560",
      "user-557",
      "user-555",
      "user-549",
      "user-540",
      "user-531",
      "user-525",
      "user-515",
      "user-50",
      "user-498",
      "user-495",
      "user-490",
      "user-483",
      "user-457",
      "user-434",
      "user-427",
      "user-404",
      "user-399",
      "user-390",
      "user-387",
      "user-380",
      "user-355",
      "user-352",
      "user-342",
      "user-33",
      "user-327",
      "user-318",
      "user-317",
      "user-311",
      "user-293",
      "user-279",
      "user-260",
      "user-252",
      "user-248",
      "user-243",
      "user-213",
      "user-197",
      "user-19",
      "user-177",
      "user-173",
      "user-162",
      "user-161",
      "user-14",
      "user-139",
      "user-124",
      "user-116",
      "da8a747f-b0fe-4bf4-bfe3-8360abac4a85",
      "9bd55bd5-1ca0-4fd1-b9b4-b2f26240d709",
      "24d48e78-5dbe-440f-8887-40ba51a947f7",
      "d1d32a18-a9b4-4e3d-aa09-6a914091c45a",
      "5acc0c67-8355-4aea-b202-9fa376151826",
      "001b97ba-d6d3-4aff-b0b1-faa7f167a13c",
      "eeb379d1-5224-46a5-9706-8b89eeb5e747"
    ]);
    if (users) {
      console.log(users.map((user) => user.id));

      setAllUsers(users);
      await hydrateUsers(users);
      // Initialize userStatusMap with each user set to "Finished" using useRef
      userStatusMapRef.current = new Map();

      organizeUsersIntoSkillBuckets(users);
    }
  };

  async function fetchUsersByIds(ids: string[]): Promise<User[]> {
    if(chat){
      try {
        // Create the filter expression for the given list of IDs
        const filterExpression = ids.map((id) => `id == "${id}"`).join(" || ");

        // Fetch users from PubNub with the filter expression
        const response = await chat.getUsers({
          limit: 100, // Adjust the limit if necessary
          filter: filterExpression,
        });

        return response.users; // Return the list of fetched users
      } catch (error) {
        console.error("Error fetching users by IDs:", error);
        return [];
      }
    }
    return [];
  }

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
  * Check membership details with priority
  */
  const checkMembershipDetails = async (user: User) => {
    try {
      const fiveMinutesInTimetokens = 5 * 60 * 1000 * 10_000; // 5 minutes in timeToken units

      // Retrieve user memberships
      const obj = await user.getMemberships();
      const memberships = obj.memberships;

      let statusSet = false; // Track if a status has been set

      // Iterate through memberships to check for specific channels
      for (const membership of memberships) {
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
              // Set user status to "Matched" and exit immediately
              userStatusMapRef.current.set(user.id, "InMatch");
              setUserStatusMap(new Map(userStatusMapRef.current)); // Trigger re-render
              return; // Exit as game-lobby takes priority
            } else if (!statusSet && channelName.startsWith("pre-lobby-")) {
              // Set user status to "InMatch" if no higher-priority status is set
              userStatusMapRef.current.set(user.id, "Matched");
              setUserStatusMap(new Map(userStatusMapRef.current)); // Trigger re-render
              statusSet = true; // Mark that a status has been set
            }
          }
        } else {
          console.warn(`Membership for channel ${channelName} has undefined timeToken.`);
        }
      }
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
        // // Get current time
        // const now = new Date();

        // // Generate timetoken (nanoseconds since epoch)
        // const timetoken = Number(message.timetoken) * 10000; // Milliseconds to nanoseconds

        // // Convert timetoken back to Date
        // const timeFromToken = new Date(timetoken / 10_000); // Nanoseconds to milliseconds

        // console.log("Date from timetoken:", timeFromToken.toISOString());
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
            console.log("Joining Request");
            try {
              // Filter out existing "Joining" statuses from the map
              const currentMap = new Map(userStatusMapRef.current);
              for (const [id, status] of currentMap) {
                if (status === "Joining") {
                  currentMap.delete(id);
                }
              }

              // Add the new user IDs with the "Joining" status
              for (const id of userIds) {
                const user: User | undefined = await getUser(id);
                currentMap.set(id, "Joining");

                if (user) {
                  logAction(`User ${user.name} is joining the matchmaking.`);
                } else {
                  logAction(`User ${id} is joining the matchmaking.`);
                }
              }

              // Update the map reference and trigger a re-render
              userStatusMapRef.current = currentMap;
              setUserStatusMap(new Map(currentMap)); // React state update for re-render
            } catch (e) {
              console.error("Error updating user statuses:", e);
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

