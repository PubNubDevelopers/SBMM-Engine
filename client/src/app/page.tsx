'use client';

import { useState, useEffect } from "react";

// Define a type for player queue times
interface PlayerQueueTimes {
  [key: string]: Date; // Index signature: keys are strings (player names), and values are Date objects
}

// Initial dummy data for skill buckets
const skillBuckets = [
  { skillLevel: "Beginner", players: ["Player A", "Player B"] },
  { skillLevel: "Intermediate", players: ["Player C", "Player D", "Player E"] },
  { skillLevel: "Advanced", players: ["Player F"] },
];

// Create initial queue times with player names
const initialQueue: PlayerQueueTimes = {
  "Player A": new Date(),
  "Player B": new Date(),
  "Player C": new Date(),
  "Player D": new Date(),
  "Player E": new Date(),
  "Player F": new Date(),
};

export default function Home() {
  const [matchedPlayers, setMatchedPlayers] = useState<any[]>([]); // Will hold the list of recent matches
  const [logs, setLogs] = useState<any[]>([]); // Logs state to be updated dynamically
  const [showAllLogs, setShowAllLogs] = useState(false); // Toggle to show more or fewer logs
  const [playerQueueTimes, setPlayerQueueTimes] = useState<PlayerQueueTimes>(initialQueue); // Track the time when players enter the queue

  // Helper function to calculate wait time
  const calculateWaitTime = (startTime: Date) => {
    const currentTime = new Date();
    const diffInSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
    return diffInSeconds;
  };

  // Simulate matching process
  useEffect(() => {
    const interval = setInterval(() => {
      const randomMatch = {
        players: ["Player A", "Player B"], // You can randomize this with more players
        time: new Date().toLocaleTimeString(),
      };

      // Calculate wait times for both players
      const playerAWaitTime = calculateWaitTime(playerQueueTimes[randomMatch.players[0]]);
      const playerBWaitTime = calculateWaitTime(playerQueueTimes[randomMatch.players[1]]);

      // Append the new match to the list of matched players, keeping only the last 3 matches
      setMatchedPlayers((prev) => {
        const updatedMatches = [...prev, randomMatch].slice(-3); // Keep only the last 3 matches
        return updatedMatches;
      });

      // Add match to logs with wait time
      setLogs((prevLogs) => {
        const newLog = {
          time: randomMatch.time,
          event: `${randomMatch.players[0]} matched with ${randomMatch.players[1]}`,
          waitTime: `${randomMatch.players[0]} waited ${playerAWaitTime}s, ${randomMatch.players[1]} waited ${playerBWaitTime}s`,
        };
        return [...prevLogs, newLog]; // Keep adding logs without limiting
      });

      // Reset the queue times for the matched players
      setPlayerQueueTimes((prevQueueTimes) => ({
        ...prevQueueTimes,
        [randomMatch.players[0]]: new Date(), // Reset the queue time for Player A
        [randomMatch.players[1]]: new Date(), // Reset the queue time for Player B
      }));

    }, 5000); // Simulate new match every 5 seconds

    return () => clearInterval(interval); // Clean up the interval on component unmount
  }, [playerQueueTimes]);

  // Function to toggle between showing all logs and showing only the first 10
  const toggleShowLogs = () => {
    setShowAllLogs(!showAllLogs);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] text-gray-300">
      <main className="w-full flex flex-col gap-8 row-start-2 items-center sm:items-start">
        {/* Display Skill Buckets */}
        <div className="w-full p-4 rounded-lg bg-gray-800 shadow-md">
          <h2 className="text-xl font-bold mb-4">Skill Buckets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {skillBuckets.map((bucket, index) => (
              <div key={index} className="p-4 bg-gray-700 rounded-lg shadow">
                <h3 className="text-lg font-semibold">{bucket.skillLevel}</h3>
                <ul className="mt-2">
                  {bucket.players.map((player, idx) => (
                    <li key={idx} className="text-gray-400">
                      {player}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Asymmetrical layout for matched players and logs */}
        <div className="w-full flex flex-col sm:flex-row gap-4">
          {/* Display Matched Players - smaller container */}
          <div className="w-full h-min sm:flex-grow-0 sm:flex-shrink-0 sm:basis-1/4 p-4 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-bold mb-4">Matched Players</h2>
            <div className="grid grid-cols-1 gap-4">
              {matchedPlayers.map((match, index) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg shadow">
                  <p className="text-lg font-semibold">Match at {match.time}</p>
                  <p className="text-gray-400">Players: {match.players.join(" vs ")}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Display Log History - larger container */}
          <div className="w-full sm:flex-grow sm:basis-3/4 p-4 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-bold mb-4">Log History</h2>
            <ul className="text-gray-400">
              {/* Show first 10 logs or all logs based on toggle */}
              {(showAllLogs ? logs : logs.slice(0, 10)).map((log, index) => (
                <li key={index} className="p-2 border-b border-gray-600">
                  <span className="font-semibold">{log.time}</span>: {log.event} <br />
                  <span className="text-sm text-gray-500">{log.waitTime}</span> {/* Display wait times */}
                </li>
              ))}
            </ul>
            {/* Show 'View More' button if there are more than 10 logs */}
            {logs.length > 10 && (
              <button
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                onClick={toggleShowLogs}
              >
                {showAllLogs ? "View Less" : "View More"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
