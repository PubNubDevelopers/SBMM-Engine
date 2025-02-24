'use client';

import React, { useContext, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import FullScreenIframe from "../../../components/full-screen-iframe";
import { SBMContext } from "@/context/SBMContext";
import { User } from "@pubnub/chat";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MatchResults: React.FC = () => {
  const { chat } = useContext(SBMContext) || {};
  const searchParams = useSearchParams();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [matchedPlayers, setMatchedPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchUserAndMatches = async () => {
      if (!chat) return;

      try {
        const userUUID = searchParams?.get("userUUID");
        const matchesParam = searchParams?.get("matches");

        if (!userUUID || !matchesParam) return;

        // Fetch logged-in user profile from PubNub
        const user = await chat.getUser(userUUID);
        setUserProfile(user);

        // Decode and parse matched player IDs
        const matchedIDs: string[] = JSON.parse(decodeURIComponent(matchesParam));

        const filterExpression = matchedIDs.map((id) => `id == "${id}"`).join(" || ");

        // Fetch full user objects from PubNub
        const { users } = await chat.getUsers({
          limit: 5,
          filter: filterExpression
        });

        setMatchedPlayers(users);
      } catch (error) {
        console.error("Error fetching matchmaking results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndMatches();
  }, [chat, searchParams]);

  if (loading || !userProfile) {
    return (
      <div className="flex min-h-screen justify-center items-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg">Loading Matchmaking Results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        {/* Back Button with Icon */}
        <Link href="/avatar" className="group">
          <button className="w-12 h-12 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-full transition">
            ⬅
          </button>
        </Link>

        {/* Matchmaking Results Title */}
        <h1 className="text-3xl font-bold">Matchmaking Results</h1>
      </div>

      {/* Matched Players */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
        {matchedPlayers.slice(0, 4).map((player, index) => {
          const compatibilityScore =
            0.4 * (1 - Math.abs((player.custom?.elo ?? 1000) - (userProfile.custom?.elo ?? 1000)) / 2000) +
            0.2 * (player.custom?.toxicityLevel === userProfile.custom?.toxicityLevel ? 1 : 0) +
            0.2 * (player.custom?.playStyle === userProfile.custom?.playStyle ? 1 : 0) +
            0.2 * (player.custom?.region === userProfile.custom?.server ? 1 : 0);

          return (
            <div key={index} className="flex bg-gray-800 rounded-lg shadow-lg p-6">
              {/* Left Side: Avatar (Takes Full Height) */}
              <div className="w-1/3 h-[400px] rounded-lg overflow-hidden bg-black shadow-md">
                <FullScreenIframe src={player.profileUrl || "https://pubnub-character-configurator.netlify.app/?avatar=true"} />
              </div>

              {/* Right Side: Player Info */}
              <div className="w-2/3 flex flex-col justify-between px-6">
                {/* Player Name */}
                <div>
                  <h3 className="text-xl font-semibold">{player.name || "Unknown Player"}</h3>
                  <p className="text-sm text-gray-300"><strong className="text-gray-400">ELO:</strong> {player.custom?.elo}</p>
                  <p className="text-sm text-gray-300"><strong className="text-gray-400">Region:</strong> {player.custom?.region}</p>
                </div>

                {/* Compatibility Score */}
                <div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${compatibilityScore * 100}%`,
                        backgroundColor: compatibilityScore > 0.7 ? "#4CAF50" : "#FF9800",
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Compatibility: {(compatibilityScore * 100).toFixed(2)}%</p>
                </div>

                {/* Radar Chart */}
                <div className="mt-4 w-full">
                  <Radar data={{
                    labels: ["ELO", "Toxicity", "Play Style", "Region"],
                    datasets: [
                      {
                        label: userProfile.name || "You",
                        data: [
                          (userProfile.custom?.elo ?? 1000) / 2000,
                          userProfile.custom?.toxicityLevel === "Low" ? 1 : userProfile.custom?.toxicityLevel === "Medium" ? 0.5 : 0,
                          userProfile.custom?.playStyle === "Balanced" ? 1 : 0,
                          1,
                        ],
                        borderColor: "rgba(54, 162, 235, 1)",
                        backgroundColor: "rgba(54, 162, 235, 0.2)",
                      },
                      {
                        label: player.name,
                        data: [
                          (player.custom?.elo ?? 1000) / 2000,
                          player.custom?.toxicityLevel === "Low" ? 1 : player.custom?.toxicityLevel === "Medium" ? 0.5 : 0,
                          player.custom?.playStyle === "Balanced" ? 1 : 0,
                          player.custom?.server === userProfile.custom?.server ? 1 : 0,
                        ],
                        borderColor: "rgba(255, 99, 132, 1)",
                        backgroundColor: "rgba(255, 99, 132, 0.2)",
                      },
                    ],
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchResults;