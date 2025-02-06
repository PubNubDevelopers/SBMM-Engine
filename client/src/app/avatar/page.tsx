'use client';

import React, { useContext, useEffect, useState } from "react";
import FullScreenIframe from "../../../components/full-screen-iframe";
import { useRouter } from "next/navigation";
import { SBMContext } from "@/context/SBMContext";
import { Channel, Message } from "@pubnub/chat";

const AvatarPage: React.FC = () => {
  const [elo, setElo] = useState(1000);
  const [toxicity, setToxicity] = useState("Non-toxic");
  const [playStyle, setPlayStyle] = useState("Balanced");
  const [region, setRegion] = useState("North America");
  const [preferredMode, setPreferredMode] = useState("Casual");
  const [userUUID, setUserUUID] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const context = useContext(SBMContext);
  const { chat } = context || {};

  useEffect(() => {
    let uuid = localStorage.getItem("userUUID");
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem("userUUID", uuid);
    }
    setUserUUID(uuid);
  }, []);

  const handleMatchmaking = async () => {
    if (!chat) return;

    setLoading(true);
    const channelName = "create_player";

    try {
      let channel: Channel | null = await chat.getChannel(channelName);

      if (channel) {
        // Subscribe to the channel to receive matchmaking responses
        channel.join(async (message: Message) => {
          try {
            const data = JSON.parse(message.content.text);
            if (data.type == "MatchmakingResponse") {

              // Store players in localStorage
              localStorage.setItem("matchedPlayers", JSON.stringify(data.players));

              // Redirect to results page with player data
              router.push(`/results`);

              // Unsubscribe and cleanup
              await channel.leave();
              setLoading(false);
            }
          } catch (err) {
            console.error("Error processing response:", err);
          }
        });

        // Send matchmaking request
        await channel.sendText(JSON.stringify({
          type: "MatchmakingRequest",
          userUUID,
          elo,
          toxicity,
          playStyle,
          region,
          preferredMode,
        }));
      }
    } catch (e) {
      console.error("Error in matchmaking process:", e);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      {/* Left Panel */}
      <div className="w-1/3 p-6 bg-gray-800 flex flex-col space-y-6">
        <h2 className="text-2xl font-bold">Player Traits</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Toxicity Level</label>
          <select value={toxicity} onChange={(e) => setToxicity(e.target.value)} className="w-full p-2 bg-gray-700 rounded-lg text-gray-300">
            <option value="Non-toxic">Non-toxic</option>
            <option value="Toxic">Toxic</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Play Style</label>
          <select value={playStyle} onChange={(e) => setPlayStyle(e.target.value)} className="w-full p-2 bg-gray-700 rounded-lg text-gray-300">
            <option value="Balanced">Balanced</option>
            <option value="Passive">Passive</option>
            <option value="Aggressive">Aggressive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">ELO (Skill Level)</label>
          <input type="range" min="0" max="2000" value={elo} onChange={(e) => setElo(Number(e.target.value))} className="w-full" />
          <p className="mt-2 text-gray-300">Selected: {elo}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full p-2 bg-gray-700 rounded-lg text-gray-300">
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
            <option value="Asia">Asia</option>
            <option value="South America">South America</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Preferred Game Mode</label>
          <select value={preferredMode} onChange={(e) => setPreferredMode(e.target.value)} className="w-full p-2 bg-gray-700 rounded-lg text-gray-300">
            <option value="Casual">Casual</option>
            <option value="Competitive">Competitive</option>
          </select>
        </div>

        {/* Matchmaking Button */}
        <div className="mt-4">
          <button
            onClick={handleMatchmaking}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
            disabled={loading}
          >
            {loading ? "Searching..." : "Start Matchmaking"}
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="mt-4 text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-2">Finding the best match...</p>
          </div>
        )}
      </div>

      {/* Right Panel with Iframe */}
      <div className="flex-1">
        {userUUID && <FullScreenIframe src={`https://pubnub-character-configurator.netlify.app/?uuid=${userUUID}`} />}
      </div>
    </div>
  );
};

export default AvatarPage;