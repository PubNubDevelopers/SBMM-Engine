import { Chat, User } from "@pubnub/chat";
import React from "react";

export enum Threshold {
  Low,
  Medium,
  High
}

export interface SBMType {
  chat: Chat | undefined;
  matchMakingUsers: User[],
  skillBuckets: Map<SkillRange, User[]>,
  recentMatchedUsers: User[],
  userStatusMap: Map<string, string>,
  logs: string[],
  statsUser: User | undefined,
  allUsers: User[],
  constraints: Map<string, Number>,
  punish_param: boolean | null,
  increase_rewards: boolean | null,
  latency_threshold: Threshold | null
}

export const SBMContext = React.createContext<SBMType | null>(null);

// Skill buckets defined by elo ranges
export enum SkillRange {
  Range1 = "0-999",
  Range2 = "1000-1499",
  Range3 = "1500-1999",
  Range4 = "2000+",
}

// Interface for skill buckets
export interface SkillBucket {
  range: SkillRange;
  users: User[];
}