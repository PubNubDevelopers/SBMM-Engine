import PubNub from "pubnub";
import { Message } from "pubnub/lib/types/core/types/api/subscription";

// Default values for matchmaking constraints
let constraints = {
  MAX_ELO_GAP: 200,
  WAIT_TIME_WEIGHT: 1.5,
  SKILL_GAP_WEIGHT: 1.0,
  REGIONAL_PRIORITY: 2.0,
  ELO_ADJUSTMENT_WEIGHT: 1.0,
};

// Initialize PubNub
const pubnub = new PubNub({
  publishKey: process.env.PUBLISH_KEY!,
  subscribeKey: process.env.SUBSCRIBE_KEY!,
  userId: 'Illuminate-Sim',
});

/**
 * Get the current constraints.
 * @returns The current matchmaking constraints.
 */
export function getConstraints() {
  return constraints;
}

/**
 * Update the constraints dynamically.
 * @param newConstraints - Object containing updated constraint values.
 */
export function updateConstraints(newConstraints: Partial<typeof constraints>) {
  constraints = { ...constraints, ...newConstraints };
  console.log("Constraints updated:", constraints);
}

/**
 * Subscribe to "SBMM-conditions" to update constraints dynamically.
 */
export function subscribeToConstraintsUpdates() {
  pubnub.subscribe({ channels: ["SBMM-conditions"] });

  pubnub.addListener({
    message: (messageEvent: any) => {
      const { message } = messageEvent;

      // Check if the message contains valid keys to update constraints
      if (typeof message === "object" && message !== null) {
        const updatedConstraints: Partial<typeof constraints> = {};

        // Update only known constraint values
        if (message.hasOwnProperty("max_skill_gap")) {
          updatedConstraints.MAX_ELO_GAP = message.max_skill_gap;
        }
        if (message.hasOwnProperty("skill_gap_weight")) {
          updatedConstraints.SKILL_GAP_WEIGHT = message.skill_gap_weight;
        }
        if(message.hasOwnProperty("elo_adjustment_weight")){
          updatedConstraints.ELO_ADJUSTMENT_WEIGHT = message.elo_adjustment_weight;
        }


        // Update constraints and log changes
        if (Object.keys(updatedConstraints).length > 0) {
          updateConstraints(updatedConstraints);
        } else {
          console.warn("Received a message, but no valid constraint updates found:", message);
        }
      } else {
        console.warn("Invalid message format received on SBMM-conditions channel:", message);
      }
    },
    status: (statusEvent) => {
      if (statusEvent.category === "PNConnectedCategory") {
        console.log("Subscribed to SBMM-conditions channel");
      } else {
        console.log("Status event:", statusEvent);
      }
    },
  });
}