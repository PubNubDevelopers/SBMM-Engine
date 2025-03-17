export async function createSessionAPI(player1Id: string, player2Id: string): Promise<string | null> {
  try {
    const response = await fetch("http://127.0.0.1:8080/matchmaking", {  // ← Change to 127.0.0.1
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ player1: player1Id, player2: player2Id }),
    });

    if (!response.ok) {
      console.error(`❌ Error creating session: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.session_id;
  } catch (error) {
    console.error("❌ API request failed:", error);
    return null;
  }
}

export async function startSessionAPI(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:8080/session/start/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`❌ Error starting session: ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Session started: ${data.session_id}`);
    return true;
  } catch (error) {
    console.error("❌ API request failed:", error);
    return false;
  }
}

/**
 * Calls the deleteSession API to clean up the session after the game finishes.
 *
 * @param sessionId - The session ID to delete.
 */
export async function deleteSessionAPI(sessionId: string) {
  try {
    const response = await fetch(`http://127.0.0.1:8080/session/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`❌ Error deleting session: ${response.statusText}`);
      return;
    }

    console.log(`🗑️ Session ${sessionId} deleted successfully.`);
  } catch (error) {
    console.error("❌ API request to delete session failed:", error);
  }
}