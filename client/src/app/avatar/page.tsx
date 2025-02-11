'use client';

import React, { useContext, useEffect, useState } from "react";
import FullScreenIframe from "../../../components/full-screen-iframe";
import { useRouter } from "next/navigation";
import { SBMContext } from "@/context/SBMContext";
import { sendMatchmakingRequest } from "@/api/matchmaking ";
import { User } from "@pubnub/chat";

const AvatarPage: React.FC = () => {

  // State
  const [userUUID, setUserUUID] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const context = useContext(SBMContext);
  const { chat } = context || {};

  // Custom Data
  const [elo, setElo] = useState(1000);
  const [toxicity, setToxicity] = useState("Medium");
  const [playStyle, setPlayStyle] = useState("Balanced");
  const [region, setRegion] = useState("NA");
  const [preferredMode, setPreferredMode] = useState("Casual");

  // User Data
  const [name, setName] = useState("Temp");
  const [email, setEmail] = useState("example@example.com");


  useEffect(() => {
    let uuid = localStorage.getItem("userUUID");
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem("userUUID", uuid);
    }
    setUserUUID(uuid);
  }, []);

  const updateUser = async (userId: string): Promise<User | null> => {
    if(chat){
      return await chat.updateUser(userId, {
        custom: {
          elo,
          toxicityLevel: toxicity,
          server: region,
          gameModePreference: preferredMode,
          inMatch: false,
          inPreLobby: false,
          latency: 25,
          matchesPlayed: 0,
          platform: "PC",
          playFrequency: "Medium",
          playStyle: playStyle,
          teamPreference: "Solo",
          totalMatches: 0,
          punished: false,
          searching: false,
          voiceChatEnabled: false
        },
      })
    }
    return null;
  }

  const createOrUpdateUser = async (userId: string) => {
    if(chat){
      let user: User | null = await chat.getUser(userId);

      if(user){
        user = await updateUser(userId);
      }
      else{
        user = await chat.createUser(userId, {
          name: name,
          email: email
        });

        user = await updateUser(userId);
      }
    }
    else{
      console.log("Chat is not defined while creating user")
    }
  }

  const handleMatchmaking = async () => {
    if (!loading && chat) {
      setLoading(true);

      await createOrUpdateUser(userUUID);

      try {

        // Call the matchmaking API with user preferences
        const matches = await sendMatchmakingRequest(userUUID);

        // Pass matched players and user UUID as query parameters
        const encodedMatches = encodeURIComponent(JSON.stringify(matches.map((p) => p.id)));
        const encodedUserUUID = encodeURIComponent(userUUID);

        // Redirect to results page with userUUID and matched players
        router.push(`/results?userUUID=${encodedUserUUID}&matches=${encodedMatches}`);
      } catch (error) {
        console.error("Error in matchmaking process:", error);
      } finally {
        setLoading(false);
      }
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
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
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
            <option value="NA">North America</option>
            <option value="EU">Europe</option>
            <option value="ASIA">Asia</option>
            <option value="SA">South America</option>
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