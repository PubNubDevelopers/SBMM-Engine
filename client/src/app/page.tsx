'use client';

import React, { useContext, useState } from "react";
import { MdOutlineAccessTime, MdCheckCircle, MdSportsEsports, MdGroup } from "react-icons/md";
import Image from "next/image";
import { SBMContext } from "@/context/SBMContext";
import { SkillRange, Threshold } from "@/types/contextTypes";
import { User } from "@pubnub/chat";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import Link from "next/link";
import FullScreenIframe from "../../components/full-screen-iframe";

export default function Home() {
  const context = useContext(SBMContext);

  const {
    skillBuckets: buckets = new Map<SkillRange, User[]>(),
    userStatusMap = new Map<string, string>(),
    recentMatchedUsers,
    statsUser,
    logs,
    allUsers = [],
    constraints,
    punish_param,
    increase_rewards,
    latency_threshold
  } = context || {};

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Track expanded state for all skill buckets together
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpandAllBuckets = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Hero Section */}
      <header className="relative p-12 text-center bg-black">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/background.jpg"
            alt="Background"
            layout="fill" // Makes the image fill the parent container
            objectFit="cover" // Ensures the image covers the container
            objectPosition="center 10%" // Offsets the image downwards
            quality={100} // Optional: Image quality (0-100)
            priority // Ensures the image loads quickly
          />
          <div className="absolute inset-0 bg-black opacity-50"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="h-4"></div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-wide text-white drop-shadow-lg">
            Real-Time Dynamic Matchmaking
          </h1>
          <p className="text-lg mt-4 max-w-2xl mx-auto text-gray-300 drop-shadow-md">
            Deliver real-time matchmaking, driven by real-time decisioning.
          </p>
          <div className="h-4"></div>
          {/* <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => window.open("https://www.pubnub.com/", "_blank")}
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition drop-shadow-md"
            >
              Get Started Now
            </button>
            <button
              onClick={() => window.open("https://www.pubnub.com/docs", "_blank")}
              className="w-full sm:w-auto px-6 py-3 bg-transparent border border-white text-white hover:border-white hover:text-white rounded-lg font-semibold transition drop-shadow-md"
            >
              Explore Documentation
            </button>
          </div> */}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 space-y-12">
        {/* Active Matchmaking View */}
        <section className="bg-gray-900 text-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-8">Active Matchmaking</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Players in Queue */}
            <div className="lg:col-span-2 bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 rounded-xl shadow-lg border border-gray-700">
              <h3 className="text-2xl font-semibold mb-6 text-white">Players in Queue</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...userStatusMap]
                  .filter(([id, status]) => status === "Joining")
                  .slice(0, 6)
                  .map(([id, status]) => {
                    const user = allUsers.find((user) => user.id === id);
                    if (!user) return null;

                    return (
                      <div
                        key={id}
                        className="flex items-center bg-gray-800 bg-opacity-90 p-4 rounded-xl hover:bg-opacity-100 transition duration-300 border border-gray-700 shadow-md"
                      >
                        {/* Profile Image */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-blue-500 shadow-md">
                          <FullScreenIframe
                            src={user.profileUrl || "/assets/Avatar1.png"}
                          />
                        </div>

                        {/* Player Info */}
                        <div className="ml-4 flex-1">
                          <p className="font-semibold text-white text-lg">{user.name}</p>
                          <p className="text-sm text-gray-400">
                            Skill: <span className="text-blue-400">{user.custom.elo}</span> | Region:{" "}
                            <span className="text-gray-300">{user.custom.server}</span>
                          </p>
                        </div>

                        {/* Status Icon */}
                        <div>
                          {status === "In Queue" && (
                            <MdOutlineAccessTime className="text-yellow-400 text-2xl animate-pulse" title="In Queue" />
                          )}
                          {status === "In Match" && (
                            <MdSportsEsports className="text-green-400 text-2xl animate-bounce" title="In Match" />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* View More Button */}
              {([...userStatusMap].filter(([id, status]) => status === "Joining").length > 6) && (
                <div className="mt-6 text-center text-gray-400">
                  {([...userStatusMap].filter(([id, status]) => status === "Joining").length)} total players in queue
                </div>
              )}
            </div>

            {/* Match Stats */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-6">Match Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Matches Formed:</span>
                  <span className="text-blue-400 text-lg font-semibold">{statsUser?.custom.matchesFormed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Wait Time:</span>
                  <span className="text-blue-400 text-lg font-semibold">{statsUser?.custom.avgWaitTime?.toFixed(2)}s</span>
                </div>
              </div>

              {/* Recently Matched Players */}
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4 text-white">Recently Matched Players</h4>
                <ul className="space-y-4">
                  {recentMatchedUsers?.map((user: User) => (
                    <li
                      key={user.id}
                      className="flex items-center bg-gray-900 bg-opacity-80 backdrop-blur-md p-4 rounded-xl border border-gray-600 hover:bg-opacity-100 transition duration-300"
                    >
                      {/* Profile Image with FullScreenIframe */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-blue-400 shadow-lg">
                        <FullScreenIframe
                          src={user.profileUrl || "/assets/Avatar1.png"}
                        />
                      </div>

                      {/* Player Info */}
                      <div className="ml-5">
                        <p className="font-semibold text-lg text-white">{user.name}</p>
                        <p className="text-sm text-gray-400">
                          Skill: <span className="text-blue-400">{user.custom.elo}</span> | Region:{" "}
                          <span className="text-gray-300">{user.custom.server}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gray-900 text-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-8">Matchmaking Constraints</h2>

          {/* Constraints Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Static Constraint Cards */}
            {constraints && constraints instanceof Map ? (
              [...constraints.entries()].map(([key, value]) => (
                <div
                  key={key}
                  className="bg-gray-800 p-6 rounded-lg shadow-md text-center hover:bg-gray-700 transition"
                >
                  <h3 className="text-lg font-semibold mb-3">{key.replace(/_/g, " ")}</h3>
                  <p className="text-2xl font-bold text-blue-400">{value.toString()}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center col-span-3">No constraints available.</p>
            )}

            {/* Dropdown for Additional Components */}
            <div className="col-span-1 md:col-span-3">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-gray-800 text-white p-4 rounded-lg hover:bg-gray-700 transition"
              >
                <span className="text-lg font-semibold">Additional Constraints</span>
                {isDropdownOpen ? (
                  <FaChevronUp className="w-6 h-6 text-blue-400" />
                ) : (
                  <FaChevronDown className="w-6 h-6 text-blue-400" />
                )}
              </button>

              {/* Dropdown Content */}
              {isDropdownOpen && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Reduce Toxicity */}
                  <div className="flex flex-col items-center bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-700 transition">
                    <h3 className="text-lg font-semibold mb-3">Reduce Toxicity</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-5 h-5 rounded-full ${
                          punish_param === null
                            ? "bg-gray-500"
                            : punish_param
                            ? "bg-green-400"
                            : "bg-red-400"
                        }`}
                      ></span>
                      <span className="font-semibold">
                        {punish_param === null
                          ? "Inactive"
                          : punish_param
                          ? "Active"
                          : "Off"}
                      </span>
                    </div>
                  </div>

                  {/* Increase Rewards */}
                  <div className="flex flex-col items-center bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-700 transition">
                    <h3 className="text-lg font-semibold mb-3">Increase Rewards</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-5 h-5 rounded-full ${
                          increase_rewards === null
                            ? "bg-gray-500"
                            : increase_rewards
                            ? "bg-green-400"
                            : "bg-red-400"
                        }`}
                      ></span>
                      <span className="font-semibold">
                        {increase_rewards === null
                          ? "Inactive"
                          : increase_rewards
                          ? "Active"
                          : "Off"}
                      </span>
                    </div>
                  </div>

                  {/* Latency Threshold */}
                  <div className="flex flex-col items-center bg-gray-800 p-6 rounded-lg shadow-md hover:bg-gray-700 transition">
                    <h3 className="text-lg font-semibold mb-3">Latency Threshold</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-5 h-5 rounded-full ${
                          latency_threshold === null
                            ? "bg-gray-500"
                            : latency_threshold === Threshold.Low
                            ? "bg-green-400"
                            : latency_threshold === Threshold.Medium
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                      ></span>
                      <span className="font-semibold">
                        {latency_threshold === null
                          ? "Inactive"
                          : latency_threshold === Threshold.Low
                          ? "Low"
                          : latency_threshold === Threshold.Medium
                          ? "Medium"
                          : "High"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Skill Buckets Section */}
        <section className="bg-gray-900 text-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-8">Skill Buckets</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...buckets].map(([range, users], index) => {
              // Sort users by Elo in descending order
              const sortedUsers = users.sort((a: User, b: User) => (b.custom?.elo || 0) - (a.custom?.elo || 0));
              const usersToDisplay = isExpanded ? sortedUsers : sortedUsers.slice(0, 5);

              return (
                <div
                  key={index}
                  className="bg-gray-800 p-6 rounded-lg shadow-md" // No hover effect here
                >
                  <h3 className="text-xl font-semibold text-blue-400 mb-4 text-center">
                    Elo Range: {range}
                  </h3>

                  {/* User List */}
                  <ul className="space-y-4">
                    {usersToDisplay.map((user, idx) => {
                      const userStatus = userStatusMap.get(user.id);

                      return (
                        <li
                          key={idx}
                          className="flex items-center bg-gray-700 p-3 rounded-lg hover:bg-gray-600 transition"
                        >
                          {/* Profile Image */}
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-600">
                            {/* <Image
                              src={user.profileUrl || "/assets/Avatar1.png"}
                              alt="Profile"
                              width={48}
                              height={48}
                              className="object-cover"
                            /> */}
                          </div>

                          {/* Player Info */}
                          <div className="ml-4 flex-1">
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-gray-400">
                              Elo: <span className="text-blue-400">{user.custom?.elo}</span>
                            </p>
                          </div>

                          {/* Status Icon */}
                          <div>
                            {userStatus === "Joining" && (
                              <MdOutlineAccessTime className="text-yellow-400 text-2xl" title="Joining" />
                            )}
                            {userStatus === "Matched" && (
                              <MdGroup className="text-blue-400 text-2xl" title="Matched" />
                            )}
                            {userStatus === "Confirmed" && (
                              <MdCheckCircle className="text-green-400 text-2xl" title="Confirmed" />
                            )}
                            {userStatus === "InMatch" && (
                              <MdSportsEsports className="text-red-400 text-2xl" title="In Match" />
                            )}
                            {(userStatus === undefined || userStatus === "Finished") && (
                              <span className="text-gray-400 text-xs">Available</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Total Players */}
                  <div className="mt-4 text-center text-gray-400">
                    {users.length} total players in this bucket
                  </div>

                  {/* Expand/Collapse Button */}
                  {users.length > 5 && (
                    <button
                      onClick={() => toggleExpandAllBuckets()}
                      className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-semibold"
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
        <section className="bg-gray-900 text-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-6">Log History</h2>
          <div className="bg-gray-800 p-6 rounded-lg shadow-md">
            {logs && logs?.slice(-6).reverse().length > 0 ? (
              <ul className="space-y-4">
                {logs?.slice(-6).reverse().map((log, index) => (
                  <li
                    key={index}
                    className="p-3 bg-gray-700 rounded-md text-sm hover:bg-gray-600 transition"
                  >
                    {log}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-center">No logs available.</p>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 p-6 text-center border-t border-gray-700">
        <p className="text-sm">
          © {new Date().getFullYear()} PubNub. All rights reserved.
        </p>
      </footer>

      <Link href="/avatar">
        <button
          style={{
            background: "#4CAF50",
            color: "white",
            padding: "10px 15px",
            borderRadius: "5px",
            border: "none",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Go to Avatar
        </button>
      </Link>
    </div>
  );
}