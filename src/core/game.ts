import { User } from "@pubnub/chat";
import { getConstraints } from "./constraints";
import { sendIlluminateData, updatePlayerMetadataWithRetry } from "../utils/chatSDK";

export async function simulateGame(player1: User, player2: User) {
  const { ELO_ADJUSTMENT_WEIGHT } = getConstraints();

  const K_FACTOR = 32; // Standard K-factor
  const minChange = 4;
  const maxChange = 32;
  const NORMALIZED_ELO = 1500; // Target center of skill normalization

  // Simulate a random wait time between 30s and 10m
  const waitTime = Math.floor(Math.random() * (600000 - 30000 + 1)) + 30000;
  await new Promise((resolve) => setTimeout(resolve, waitTime));

  // Skill Factors & Voice Chat Adjustment
  const player1Skill = player1.custom?.skill || Math.random() * 100;
  const player2Skill = player2.custom?.skill || Math.random() * 100;

  const voiceChatBonus = player1.custom?.voiceChatEnabled && player2.custom?.voiceChatEnabled ? 1.05 : 1;

  // Simulate game outcome with voice chat and skill
  const player1Wins =
    Math.random() < (player1Skill * voiceChatBonus) / (player1Skill + player2Skill * voiceChatBonus);

  // Calculate expected scores
  const player1Expected = 1 / (1 + Math.pow(10, (player2.custom?.elo - player1.custom?.elo) / 400));

  // Calculate base Elo change
  let eloChange = K_FACTOR * ((player1Wins ? 1 : 0) - player1Expected);

  // Normalize adjustment based on Elo
  const player1DistanceFromNormalized = (player1.custom?.elo || NORMALIZED_ELO) - NORMALIZED_ELO;
  const player2DistanceFromNormalized = (player2.custom?.elo || NORMALIZED_ELO) - NORMALIZED_ELO;

  const player1Adjustment = ELO_ADJUSTMENT_WEIGHT / (1 + Math.exp(-player1DistanceFromNormalized / 200));
  const player2Adjustment = ELO_ADJUSTMENT_WEIGHT / (1 + Math.exp(-player2DistanceFromNormalized / 200));

  // Add adjustments and clamp Elo change
  eloChange += player1Wins ? player1Adjustment : -player2Adjustment;
  eloChange = Math.max(minChange, Math.min(maxChange, Math.abs(eloChange))) * Math.sign(eloChange);

  // Add skill drift
  const drift = (Math.random() - 0.5) * 10;

  // Update player stats
  const player1NewElo = Math.max(0, Math.round(player1.custom?.elo + eloChange + drift));
  const player2NewElo = Math.max(0, Math.round(player2.custom?.elo - eloChange - drift));

  // Update win streaks
  const player1WinsStreak = player1Wins ? (player1.custom?.consecutiveWins || 0) + 1 : 0;
  const player2WinsStreak = !player1Wins ? (player2.custom?.consecutiveWins || 0) + 1 : 0;

  // Toxicity level influence
  // Adjust toxicity level probability
  const toxicityLevel = Math.random() < 0.25 ? "High" : "Low"; // 25% chance of a toxic match

  // Increase likelihood of a toxic match if either player is already toxic
  const gameToxicity =
    player1.custom?.toxicityLevel === "High" || player2.custom?.toxicityLevel === "High"
      ? Math.random() < 0.5 ? "High" : "Low" // 50% chance if one or both players are toxic
      : toxicityLevel;

  const updatedToxicityLevel = gameToxicity === "High" ? "High" : player1.custom?.toxicityLevel || "Low";

  // Update playStyle based on performance
  const player1PlayStyle =
  player1WinsStreak >= 3 ? "Aggressive" : eloChange > 0 ? "Balanced" : "Passive";

  const player2PlayStyle =
  player2WinsStreak >= 3 ? "Aggressive" : eloChange < 0 ? "Balanced" : "Passive";

  // Update player metadata
  await updatePlayerMetadataWithRetry(player1, {
    elo: player1NewElo,
    confirmed: false,
    skill: player1Skill,
    consecutiveWins: player1WinsStreak,
    toxicityLevel: updatedToxicityLevel,
    playStyle: player1PlayStyle
  });

  await updatePlayerMetadataWithRetry(player2, {
    elo: player2NewElo,
    confirmed: false,
    skill: player2Skill,
    consecutiveWins: player2WinsStreak,
    toxicityLevel: updatedToxicityLevel,
    playStyle: player2PlayStyle
  });

  await sendIlluminateData({
    eloMatchAvg: (player1NewElo + player2NewElo) / 2,
    toxicityDetected: gameToxicity,
    playStyle: player1.custom?.playStyle ?? "Balanced",
    latency: (player1.custom?.latency ?? 100 + player2.custom?.latency ?? 100)/2,
    completionRate: (player1.custom?.completionRate ?? 100 + player2.custom?.completionRate ?? 100)/2
  });
  await sendIlluminateData({
    playStyle: player2.custom?.playStyle ?? "Balanced",
  })
}