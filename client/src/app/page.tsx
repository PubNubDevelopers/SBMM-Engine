'use client';

import React, { useContext, useState } from "react";
import { MdOutlineAccessTime, MdCheckCircle, MdSportsEsports, MdGroup } from "react-icons/md";
import Image from "next/image";
import { SBMContext } from "@/context/SBMContext";
import { SkillRange } from "@/types/contextTypes";
import { User } from "@pubnub/chat";

export default function Home() {
  const context = useContext(SBMContext);

  const {
    skillBuckets: buckets = new Map<SkillRange, User[]>(),
    userStatusMap = new Map<string, string>(),
    recentMatchedUsers,
    statsUser,
    logs: log,
    allUsers = []
  } = context || {};

  const [showAllLogs, setShowAllLogs] = useState(false);
  // Track expanded state for all skill buckets together
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpandAllBuckets = () => {
    setIsExpanded((prev) => !prev);
  };

  const toggleShowLogs = () => {
    setShowAllLogs(!showAllLogs);
  };


  const [players, setPlayers] = useState([
    { id: 1, name: "Alice", skill: 1200, region: "NA", status: "In Queue" },
    { id: 2, name: "Bob", skill: 1250, region: "EU", status: "In Match" },
    { id: 3, name: "Charlie", skill: 1300, region: "ASIA", status: "In Queue" },
    { id: 4, name: "Dana", skill: 1100, region: "SA", status: "In Queue" },
    { id: 5, name: "Eve", skill: 1350, region: "EU", status: "In Match" },
  ]);

  const logs = [
    "2024-12-04 - Player Alice joined matchmaking.",
    "2024-12-04 - Match created: Alice vs. Dana.",
    "2024-12-04 - Player Eve joined matchmaking.",
    "2024-12-04 - Match created: Bob vs. Charlie.",
    "2024-12-04 - Player Dana left matchmaking.",
  ];

  const addFakePlayer = () => {
    const regions = ["NA", "EU", "ASIA", "SA"];
    const statuses = ["In Queue", "In Match"];
    const newPlayer = {
      id: players.length + 1,
      name: `Player ${players.length + 1}`,
      skill: Math.floor(Math.random() * (1400 - 1000 + 1)) + 1000,
      region: regions[Math.floor(Math.random() * regions.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    };
    setPlayers([...players, newPlayer]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800">
      {/* Hero Section */}
      <header className="bg-gray-100 p-6 text-center border-b border-gray-300 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">PubNub Skill-Based Matchmaking</h1>
        <p className="text-gray-600 mt-2">
          Deliver real-time matchmaking with PubNub's App Context and API.
        </p>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-8 p-6">
        {/* Active Matchmaking View */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">Active Matchmaking</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Players in Queue */}
            <div className="col-span-2 bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800">Players in Queue</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {[...userStatusMap]
                .filter(([id, status]) => status === "Joining") // Filter for "Joining" status
                .map(([id, status]) => {
                  const user = allUsers.find((user) => user.id === id); // Find the user in allUsers
                  if (!user) return null; // Skip rendering if the user is not found

                  return (
                    <div
                      key={id}
                      className="flex items-center bg-white p-4 rounded-md shadow-sm border border-gray-200"
                    >
                      {/* Profile Image */}
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-300">
                        <Image
                          src={user.profileUrl || "/assets/Avatar1.png"}
                          alt="Profile"
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      {/* Player Info */}
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{user.custom.name}</p>
                        <p className="text-xs text-gray-600">
                          Skill: <span className="text-blue-600">{user.custom.skill}</span> | Region:{" "}
                          <span className="text-gray-800">{user.custom.region}</span>
                        </p>
                      </div>
                      {/* Status Icon */}
                      <div>
                        {status === "In Queue" && (
                          <MdOutlineAccessTime className="text-yellow-500 text-xl" title="In Queue" />
                        )}
                        {status === "In Match" && (
                          <MdSportsEsports className="text-green-500 text-xl" title="In Match" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Total Players Note */}
              {players.length > 6 && (
                <p className="text-sm text-gray-600 mt-4">
                  + {players.length - 6} more players in queue
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800">Match Stats</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Players:</span>
                  <span className="text-blue-600 text-lg font-semibold">{statsUser?.custom.totalPlayers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Matches Formed:</span>
                  <span className="text-blue-600 text-lg font-semibold">{statsUser?.custom.matchesFormed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg. Match Time:</span>
                  <span className="text-blue-600 text-lg font-semibold">{statsUser?.custom.avgWaitTime?.toFixed(2)}s</span>
                </div>
              </div>

              {/* Recently Matched Players */}
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-800">Recently Matched Players</h4>
                <ul className="mt-4 space-y-2">
                  {recentMatchedUsers && recentMatchedUsers.map((user: User) => (
                      <li
                        key={user.id}
                        className="flex items-center bg-white p-4 rounded-md shadow-sm border border-gray-200"
                      >
                        {/* Profile Image */}
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-300">
                          <Image
                            src={user.profileUrl || "/assets/Avatar1.png"}
                            alt="Profile"
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        {/* Player Info */}
                        <div className="ml-4">
                          <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                          <p className="text-xs text-gray-600">
                            Skill: <span className="text-blue-600">{user.custom.elo}</span> | Region:{" "}
                            <span className="text-gray-800">{user.custom.server}</span>
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Player Simulation Controls */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">Simulate Matchmaking</h2>
          <p className="text-sm text-gray-600 mt-2">
            Add players to the queue with adjustable skill ratings and see how PubNub matches them.
          </p>
          <div className="flex mt-4">
            <button
              onClick={addFakePlayer}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-50 text-blue-600 border border-blue-600 hover:bg-blue-100"
            >
              Add Player
            </button>
          </div>
        </section>

        {/* Skill Buckets Section */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">Skill Buckets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {[...buckets].map(([range, users], index) => {
              // Sort users by Elo in descending order
              const sortedUsers = users.sort((a: User, b: User) => (b.custom?.elo || 0) - (a.custom?.elo || 0));

              // Display the first 5 users by default, expand to show all
              const usersToDisplay = isExpanded ? sortedUsers : sortedUsers.slice(0, 5);

              return (
                <div key={index} className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Elo Range: {range}</h3>
                  <ul className="space-y-3">
                    {usersToDisplay.map((user, idx) => {
                      // Retrieve the user’s status from the map
                      const userStatus = userStatusMap.get(user.id);

                      return (
                        <li key={idx} className="flex items-center p-2 rounded-lg bg-white shadow-sm border border-gray-200">
                          {/* Profile Image */}
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-300">
                            <Image
                              src={user.profileUrl || "/assets/Avatar1.png"}
                              alt="Profile"
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                          {/* Player Info */}
                          <div className="ml-4 flex-1">
                            <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                            <p className="text-xs text-gray-600">
                              Elo: <span className="text-blue-600">{user.custom?.elo}</span>
                            </p>
                          </div>
                          {/* Status Icon */}
                          <div>
                            {userStatus === "Joining" && (
                              <MdOutlineAccessTime className="text-yellow-500 text-xl" title="Joining" />
                            )}
                            {userStatus === "Matched" && <MdGroup className="text-blue-500 text-xl" title="Matched" />}
                            {userStatus === "Confirmed" && (
                              <MdCheckCircle className="text-green-500 text-xl" title="Confirmed" />
                            )}
                            {userStatus === "InMatch" && <MdSportsEsports className="text-red-500 text-xl" title="In Match" />}
                            {(userStatus === undefined || userStatus === "Finished") && (
                              <span className="text-gray-500 text-xs">Available</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 text-center text-gray-500 text-xs">
                    {users.length} total players in this bucket
                  </div>
                  {users.length > 5 && (
                    <button
                      onClick={() => toggleExpandAllBuckets()}
                      className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-100 text-sm"
                    >
                      {isExpanded ? "View Less" : "View More"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* API Calls & Logs */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">Log History</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </section>

        {/* API Calls & Code */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">API & Code Insights</h2>
          <p className="text-sm text-gray-600 mt-2">
            Explore the API calls and implementation details for this demo.
          </p>
          <pre className="bg-gray-100 p-4 mt-4 rounded-lg text-sm text-gray-800 border border-gray-300 shadow-sm">
            {`pubnub.publish({
  channel: 'matchmaking',
  message: { skill: 1200, latency: 50 }
});`}
          </pre>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 p-4 text-center border-t border-gray-300">
        <p className="text-sm text-gray-600">
          © {new Date().getFullYear()} PubNub. All rights reserved.
        </p>
      </footer>
    </div>
  );
}