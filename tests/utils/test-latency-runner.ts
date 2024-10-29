import { getPubNubInstance } from "../../src/utils/pubnub";
import PubNub from "pubnub";

interface SignalMessage {
  type: 'ping' | 'pong';
  from: string;
  to: string;
}

export async function startPingPong(clientQueue: string[]): Promise<Map<string, number>> {
  // Get PubNub Chat Instance for the current signed-in user
  const pubnub: PubNub = await getPubNubInstance();

  // Maps to track start times and latencies
  const startTimeMap: Map<string, number> = new Map();
  const latencyMap: Map<string, number> = new Map();

  // Subscribe to the current user's own latency channel to listen for pings
  const userLatencyChannel = `${pubnub.userId}-latency`;
  pubnub.subscribe({ channels: [userLatencyChannel] });

  // Define the wait time for this funciton
  const waitTime = 1000;

  // Ping every client in the queue
  clientQueue.forEach(client => {
    if (client !== pubnub.userId) {
      const startTime = Date.now();
      startTimeMap.set(client, startTime); // Save the start time for each client

      // Send a 'ping' signal to the other clients
      pubnub.signal({
        channel: `${client}-latency`,
        message: {
          type: 'ping',
          from: pubnub.userId,
          to: client
        }
      }).then(() => {
        console.log(`Ping sent to ${client}`);
      }).catch(error => {
        console.error('Error sending ping:', error);
      });
    }
  });

  // Listen for signals (both 'ping' and 'pong') on the user's own latency channel
  const signalListener = {
    signal: (signalEvent: any) => {
      // Ensure the signal is from the correct channel (your own latency channel)
      if (signalEvent.channel === userLatencyChannel) {
        // Cast the message to 'SignalMessage'
        const signalMessage = signalEvent.message as unknown as SignalMessage;

        // Handle incoming 'pong' signals
        if (signalMessage.type === 'pong' && signalMessage.to === pubnub.getUUID()) {
          const startTime = startTimeMap.get(signalMessage.from);  // Retrieve start time for this client
          if (startTime) {
            const latency = Date.now() - startTime;  // Calculate latency
            latencyMap.set(signalMessage.from, latency);  // Store latency for this client
            console.log(`Latency to ${signalMessage.from}: ${latency}ms`);
          }
        }

        // Handle incoming 'ping' signals and respond with a 'pong'
        else if (signalMessage.type === 'ping' && signalMessage.to === pubnub.getUUID()) {
          // Send a 'pong' signal back to the sender
          pubnub.signal({
            channel: `${signalEvent.publisher}-latency`, // Send pong back on the other client's latency channel
            message: {
              type: 'pong',
              from: pubnub.getUUID(),
              to: signalMessage.from
            }
          }).then(() => {
            console.log(`Pong sent to ${signalMessage.from}`);
          }).catch(error => {
            console.error('Error sending pong:', error);
          });
        }
      }
    }
  };

  // Add the listener to PubNub
  pubnub.addListener(signalListener);

  // Wait for a set time (e.g., 1 second) to allow ping-pong exchanges to complete
  await new Promise(resolve => setTimeout(resolve, waitTime));

  // After waiting, unsubscribe and remove the listener
  pubnub.unsubscribe({ channels: [userLatencyChannel] });
  pubnub.removeListener(signalListener);

  console.log("Final Latency Map: ", latencyMap);

  // Optionally, you can return the latency map after pings are done
  return latencyMap;
}