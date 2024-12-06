'use client';

import { useContext, useEffect, useState } from "react";
import { MdOutlineAccessTime, MdGroup, MdCheckCircle, MdSportsEsports } from 'react-icons/md';
import { SBMContext } from "../../types/contextTypes"; // Adjust the import path as needed
import { User } from "@pubnub/chat";
import Image from 'next/image';

export default function Dashboard() {
  const context = useContext(SBMContext);

  const {
    skillBuckets = new Map(),
    userStatusMap = new Map(),
    recentMatchedUsers,
    logs,
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

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] text-gray-200 bg-gray-900">
      <header className="w-full flex items-center justify-between bg-gray-800 p-4 shadow-md">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full overflow-hidden mr-3 relative bg-white">
          <Image
            src="/assets/PN_logo.png" // Replace with the actual path to the PubNub logo in your public/assets folder
            alt="PubNub Logo"
            layout="fill" // Fill the circular container
            objectFit="cover" // Cover the container without distortion
          />
        </div>
        <h1 className="text-xl font-bold text-white">PubNub Matchmaking</h1>
      </div>
    </header>

      <main className="w-full flex flex-col gap-8 row-start-2 items-center sm:items-start">

      <div className="w-full h-min sm:flex-grow-0 sm:flex-shrink-0 sm:basis-1/4 p-4 rounded-lg bg-gray-800 shadow-md">
        <h2 className="text-xl font-bold mb-4 text-white">Matched Players</h2>
        <div className="grid grid-cols-1 gap-4">
          {recentMatchedUsers?.map((user: User, index: number) => (
            <div key={index} className="flex items-center p-4 bg-gray-700 rounded-lg shadow-md">
              {/* Circular Profile Picture */}
              <div className="w-12 h-12 rounded-full overflow-hidden mr-4 relative">
                <Image
                  src={user.profileUrl || "/assets/Avatar1.png"} // Replace with actual path to default avatar
                  alt={`${user.name}'s Profile`}
                  layout="fill"
                  objectFit="cover"
                />
              </div>

              {/* Player Information */}
              <div className="text-white flex-1">
                <p className="text-lg font-semibold">{user.name}</p>
                <p className="text-gray-400 text-sm">Elo: {user.custom?.elo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

        {/* Display Skill Buckets */}
        <div className="w-full p-4 rounded-lg bg-gray-800 shadow-md">
          <h2 className="text-xl font-bold mb-4 text-white">Skill Buckets</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...skillBuckets].map(([range, users], index) => {
              // Sort users by Elo in descending order
              const sortedUsers = users.sort((a: User, b: User) => (b.custom?.elo || 0) - (a.custom?.elo || 0));

              // Select users to display based on expanded state
              const usersToDisplay = isExpanded ? sortedUsers : sortedUsers.slice(0, 5);

              return (
                <div key={index} className="p-4 bg-gray-700 rounded-lg shadow-md flex flex-col justify">
                  <h3 className="text-lg font-semibold text-white mb-2">Elo Range: {range}</h3>
                  <ul className="space-y-2 flex-col items-start justify-start">
                    {usersToDisplay.map((user: User, idx: number) => {
                      // Retrieve the user’s status from the map
                      const userStatus = userStatusMap.get(user.id);

                      return (
                        <li key={idx} className="flex items-center p-2 rounded-lg bg-gray-800 shadow-sm">
                          <div className="w-10 h-10 rounded-full overflow-hidden mr-3 relative">
                            <Image
                              src={user.profileUrl || "/assets/Avatar1.png"}
                              alt="Profile"
                              layout="fill"
                              objectFit="cover"
                            />
                          </div>
                          <div className="text-white flex-1">
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-gray-400 text-sm">Elo: {user.custom?.elo}</p>
                          </div>
                          {/* Status Icon */}
                          <div className="ml-2 text-lg">
                            {userStatus === "Joining" && <MdOutlineAccessTime className="text-yellow-400" />}
                            {userStatus === "Matched" && <MdGroup className="text-blue-400" />}
                            {userStatus === "Confirmed" && <MdCheckCircle className="text-green-400" />}
                            {userStatus === "InMatch" && <MdSportsEsports className="text-red-400" />}
                            {(userStatus === undefined || userStatus === "Finished") && (
                              <span className="text-gray-500">Available</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 text-center text-gray-400 text-xs">
                    {users.length} members in this skill bucket
                  </div>
                  {users.length > 5 && (
                    <button
                      onClick={() => toggleExpandAllBuckets()}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      {isExpanded ? "View Less" : "View More"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Matched Players and Log History */}
        <div className="w-full flex flex-col sm:flex-row gap-4">


          <div className="w-full sm:flex-grow sm:basis-3/4 p-4 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-bold mb-4 text-white">Log History</h2>
            <ul className="text-gray-400">
              {(showAllLogs ? (logs || []) : (logs || []).slice(0, 10)).map((log: string, index: number) => (
                <li key={index} className="p-2 border-b border-gray-600">
                  <span className="font-semibold">{log.split(' - ')[0]}</span>: {log.split(' - ')[1]}
                </li>
              ))}
            </ul>
            {(logs || []).length > 10 && (
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

      <footer className="w-full bg-gray-800 p-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} PubNub. All rights reserved.
      </footer>
    </div>
  );
}