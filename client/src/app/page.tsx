'use client';

import React, { useContext, useEffect, useState } from "react";
import { MdOutlineAccessTime, MdCheckCircle, MdSportsEsports, MdGroup } from "react-icons/md";
import Image from "next/image";
import { SBMContext } from "@/context/SBMContext";
import { SkillRange, Threshold } from "@/types/contextTypes";
import { User } from "@pubnub/chat";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import Link from "next/link";
import FullScreenIframe from "../../components/full-screen-iframe";

export default function Home() {

  useEffect(() => {
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};

    return () => {
      // Restore original console methods on unmount (optional)
      console.warn = console.error = console.info = console.log;
    };
  }, []);


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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Hero Section */}
      <header className="relative p-12 text-center bg-black">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/background.jpg"
            alt="Background"
            fill // ✅ Correct replacement for layout="fill"
            priority // ✅ Ensures the image loads quickly
            quality={100} // ✅ Optional: Image quality (0-100)
            style={{
              objectFit: "cover", // ✅ Fix: Moved objectFit inside style
              objectPosition: "center 10%", // ✅ Fix: Moved objectPosition inside style
            }}
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

              {([...userStatusMap].filter(([id, status]) => status === "Joining").length === 0) ? (
                // Display message if no players are in queue
                <p className="text-gray-400 text-center text-lg">No Players in Queue</p>
              ) : (
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
              )}
            </div>

            {/* Match Stats */}
            <div className="bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 rounded-xl shadow-lg border border-gray-700">
              <h3 className="text-2xl font-semibold mb-6 text-white">Match Stats</h3>

              <div className="space-y-6">
                {(!statsUser || !statsUser.custom) ? (
                  // Loading indicator while stats are being fetched
                  <div className="flex justify-center items-center py-6">
                    <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="ml-3 text-gray-400 text-lg">Loading stats...</p>
                  </div>
                ) : (
                  <>
                    {/* Matches Formed */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-lg">Matches Formed:</span>
                      <span className="text-blue-400 text-2xl font-semibold">
                        {statsUser.custom.matchesFormed}
                      </span>
                    </div>

                    {/* Last Wait Time */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-lg">Last Wait Time:</span>
                      <span className="text-green-400 text-2xl font-semibold">
                        {statsUser.custom.avgWaitTime?.toFixed(2)}s
                      </span>
                    </div>
                  </>
                )}
              </div>


              {/* Recently Matched Players */}
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4 text-white">Recently Matched Players</h4>

                {(!recentMatchedUsers || recentMatchedUsers.length === 0) ? (
                  // Display message if no players were recently matched
                  <p className="text-gray-400 text-center text-lg">No Recently Matched Players</p>
                ) : (
                  <ul className="space-y-4">
                    {recentMatchedUsers.map((user: User) => (
                      <li
                        key={user.id}
                        className="flex items-center bg-gray-900 bg-opacity-80 backdrop-blur-md p-4 rounded-xl border border-gray-600 hover:bg-opacity-100 transition duration-300"
                      >
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
                )}
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
        <div className="flex justify-center">
          <section className="bg-gray-900 text-white p-8 rounded-lg shadow-lg ">
            <h2 className="text-3xl font-bold text-center mb-6">Skill Buckets</h2>

            <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-hide">
              {[...buckets].map(([range, users], index) => {
                // Sort users by Elo in descending order
                const sortedUsers = users.sort((a: User, b: User) => (b.custom?.elo || 0) - (a.custom?.elo || 0));
                const topUser = sortedUsers[0]; // Highest Elo player
                const otherUsers = sortedUsers.slice(1, 5); // Other players displayed as small tiles

                return (
                  <div
                    key={index}
                    className="bg-gray-800 p-5 rounded-lg shadow-md min-w-[280px] flex-shrink-0 border border-gray-700"
                  >
                    {/* Elo Range Title with Dynamic Colors */}
                    <h3
                      className={`text-lg font-semibold text-center mb-4 ${
                        index === 0 ? "text-green-400" : index === 1 ? "text-yellow-400" : "text-red-400"
                      }`}
                    >
                      Elo Range: {range}
                    </h3>

                    {/* 🏆 Top Player Tile (Larger, Rectangular) */}
                    {topUser && (
                      <div className="bg-gray-700 p-4 rounded-xl shadow-lg flex flex-col items-center">
                        <div className="w-[200px] h-[120px] border-2 border-blue-400 shadow-md mb-2">
                          <FullScreenIframe
                            src={topUser.profileUrl || "/assets/Avatar1.png"}
                          />
                        </div>
                        <p className="font-semibold text-lg">{topUser.name}</p>
                        <p className="text-sm text-gray-400">
                          Elo: <span className="text-blue-400">{topUser.custom?.elo}</span>
                        </p>
                      </div>
                    )}

                    {/* 🏅 Average Player Tiles (Compact, No Iframe) */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {otherUsers.map((user, idx) => (
                        <div key={idx} className="bg-gray-700 p-2 rounded-md flex flex-col items-center text-center">
                          <p className="text-sm font-semibold">{user.name}</p>
                          <p className="text-xs text-gray-400">Elo: {user.custom?.elo}</p>
                        </div>
                      ))}
                    </div>

                    {/* Total Players */}
                    <div className="mt-4 text-center text-gray-400 text-sm">
                      {users.length} players in this bucket
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 p-6 text-center border-t border-gray-700">
        <p className="text-sm">
          © {new Date().getFullYear()} PubNub. All rights reserved.
        </p>
      </footer>

      <Link href="/avatar">
        <div
          className="fixed bottom-6 right-6 w-16 h-16 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg border border-gray-700 transition transform hover:scale-110"
          style={{ boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)" }}
        >
          <MdGroup className="text-3xl" />
        </div>
      </Link>
    </div>
  );
}