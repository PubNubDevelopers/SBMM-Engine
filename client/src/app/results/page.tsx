'use client'

import React, { useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

interface Player {
  id: string;
  name: string;
  elo: number;
  toxicity: string;
  playStyle: string;
  region: string;
  avatarUrl: string;
}

const MatchResults: React.FC = () => {
  const { chat } = useContext(SBMContext) || {};
  const [userProfile, setUserProfile] = useState<Player | null>(null);
  const [matchedPlayers, setMatchedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndMatches = async () => {
      if (!chat) return;

      try {
        // Fetch user profile from PubNub
        const user: User = chat.currentUser;

        const profile: Player = {
          id: user.id,
          name: user.name || "Unknown Player",
          elo: user.custom?.elo || 1000,
          toxicity: user.custom?.toxicity || "Non-toxic",
          playStyle: user.custom?.playStyle || "Balanced",
          region: user.custom?.region || "North America",
          avatarUrl: `http://localhost:5173/?avatar=true&Name=${user.name || "Unknown Player"}`,
        };

        setUserProfile(profile);

        // Retrieve matched player IDs from localStorage
        const storedPlayerIDs = localStorage.getItem("matchedPlayers");

        console.log(storedPlayerIDs);

        if (storedPlayerIDs) {
          const playerIDs: string[] = JSON.parse(storedPlayerIDs);
          const fetchedPlayers: Player[] = [];

          // Loop through player IDs and fetch their details
          for (const playerId of playerIDs) {
            const fetchedUser: User | null = await chat.getUser(playerId);
            console.log(fetchedUser);
            if (fetchedUser) {
              fetchedPlayers.push({
                id: fetchedUser.id,
                name: fetchedUser.name || `Player ${playerId.slice(-4)}`,
                elo: fetchedUser.custom?.elo || 1000,
                toxicity: fetchedUser.custom?.toxicity || "Non-toxic",
                playStyle: fetchedUser.custom?.playStyle || "Balanced",
                region: fetchedUser.custom?.region || "North America",
                avatarUrl: fetchedUser.custom?.profileURL || "http://localhost:5173/?avatar=true&Head=3&hairColor=%23FFD700&headColor=%23FFD700&hatColor=%23FFD700&Hair=01&Hat=000000002",
              });
            }
          }

          setMatchedPlayers(fetchedPlayers);
        }

      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndMatches();
  }, [chat]);


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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Matchmaking Results</h1>
        <Link href="/">
          <button className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
            Back to Avatar Creation
          </button>
        </Link>
      </div>

      {/* Matched Players */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
        {matchedPlayers.map((player, index) => {
          const compatibilityScore =
            0.4 * (1 - Math.abs(player.elo - userProfile.elo) / userProfile.elo) +
            0.2 * (player.toxicity === userProfile.toxicity ? 1 : 0) +
            0.2 * (player.playStyle === userProfile.playStyle ? 1 : 0) +
            0.2 * (player.region === userProfile.region ? 1 : 0);

          return (
            <div key={index} className="flex bg-gray-800 rounded-lg shadow-lg p-6">
              {/* Left Side: Avatar (Takes Full Height) */}
              <div className="w-1/3 h-[400px] rounded-lg overflow-hidden bg-black shadow-md">
                <FullScreenIframe src={player.avatarUrl} />
              </div>

              {/* Right Side: Player Info */}
              <div className="w-2/3 flex flex-col justify-between px-6">
                {/* Player Name */}
                <div>
                  <h3 className="text-xl font-semibold">{player.name}</h3>
                  <p className="text-sm text-gray-300"><strong className="text-gray-400">ELO:</strong> {player.elo}</p>
                  <p className="text-sm text-gray-300"><strong className="text-gray-400">Region:</strong> {player.region}</p>
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
                        label: userProfile.name,
                        data: [1, userProfile.toxicity === "Non-toxic" ? 1 : 0, userProfile.playStyle === "Balanced" ? 1 : 0, 1],
                        borderColor: "rgba(54, 162, 235, 1)",
                      },
                      {
                        label: player.name,
                        data: [
                          1 - Math.abs(player.elo - userProfile.elo) / 200,
                          player.toxicity === userProfile.toxicity ? 1 : 0,
                          player.playStyle === userProfile.playStyle ? 1 : 0,
                          player.region === userProfile.region ? 1 : 0,
                        ],
                        borderColor: "rgba(255, 99, 132, 1)",
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