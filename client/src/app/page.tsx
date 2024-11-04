'use client';

import { useContext, useEffect, useState } from "react";
import { SBMContext } from "../context/SBMContext"; // Adjust the import path as needed
import { User } from "@pubnub/chat";

export default function Home() {
  const context = useContext(SBMContext);

  const {
    skillBuckets = new Map(),
    recentMatchedUsers,
    logs,
    generateUsers,
    simulateUsers
  } = context || {};

  const [showAllLogs, setShowAllLogs] = useState(false);

  const toggleShowLogs = () => {
    setShowAllLogs(!showAllLogs);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] text-gray-300">
      <main className="w-full flex flex-col gap-8 row-start-2 items-center sm:items-start">

        {/* Buttons for Simulating and Generating Users */}
        <div className="w-full flex flex-col sm:flex-row gap-4">
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            onClick={() => simulateUsers && simulateUsers(10)}
          >
            Simulate 10 Users
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            onClick={() => simulateUsers && simulateUsers(50)}
          >
            Simulate 50 Users
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            onClick={() => simulateUsers && simulateUsers(100)}
          >
            Simulate 100 Users
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            onClick={() => generateUsers && generateUsers(10)}
          >
            Generate 10 New Users
          </button>
        </div>

        {/* Display Skill Buckets */}
        <div className="w-full p-4 rounded-lg bg-gray-800 shadow-md">
          <h2 className="text-xl font-bold mb-4">Skill Buckets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...skillBuckets].map(([range, users]: [string, User[]], index) => (
              <div key={index} className="p-4 bg-gray-700 rounded-lg shadow">
                <h3 className="text-lg font-semibold">Elo Range: {range}</h3>
                <ul className="mt-2">
                  {users.map((user, idx) => (
                    <li key={idx} className="text-gray-400">
                      {user.name} (Elo: {user.custom?.elo})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Matched Players and Log History */}
        <div className="w-full flex flex-col sm:flex-row gap-4">
          <div className="w-full h-min sm:flex-grow-0 sm:flex-shrink-0 sm:basis-1/4 p-4 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-bold mb-4">Matched Players</h2>
            <div className="grid grid-cols-1 gap-4">
              {recentMatchedUsers?.map((user: User, index: number) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg shadow">
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-gray-400">Elo: {user.custom?.elo}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full sm:flex-grow sm:basis-3/4 p-4 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-bold mb-4">Log History</h2>
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
    </div>
  );
}
