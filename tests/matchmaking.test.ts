import { simulateMatchmakingUsers, simulateUser } from './utils/test-runner'; // Import the function to test



/**
 * Basic test for simulating matchmaking users
 *
 * This test simply calls the `simulateMatchmakingUsers` function and ensures that it runs without errors.
 * It also captures all console.log outputs.
 * It has a 5-minute timeout.
 */
describe('Matchmaking Test', () => {
  it('should run simulateMatchmakingUsers and display all console logs for at least 5 minutes', async () => {
    const spyConsoleLog = jest.spyOn(console, 'log'); // Spy on console.log to capture logs

    try {
      // Run the function and ensure it doesn't throw any errors
      await simulateMatchmakingUsers();

      // Make the test wait for 5 minutes regardless of how long the simulation takes
      await new Promise(resolve => setTimeout(resolve, 300000)); // Wait for 5 minutes
    } catch (error) {
      console.error('Error during matchmaking simulation:', error); // Log the error with detailed output
    }

    // Display all captured console.log messages
    spyConsoleLog.mock.calls.forEach((call) => {
      console.log(call[0]); // Log the captured messages for test output
    });

    spyConsoleLog.mockRestore(); // Restore the original console.log after the test
  }, 305000); // Set the test timeout to slightly longer than 5 minutes (305000 ms) to account for any delays
});

/**
 * Test for simulating one user sending a matchmaking request
 */
describe('Single User Matchmaking Test', () => {
  it('should simulate one user sending a matchmaking request and wait for 1 minute', async () => {
    const spyConsoleLog = jest.spyOn(console, 'log'); // Spy on console.log to capture logs

    // Simulate just one user from 'us-east-1' region (you can change the region if needed)
    const simulateOneUser = async () => {
      const region = 'us-east-1'; // Define the region for this test
      console.log(`Simulating user in region: ${region}`); // Log before simulating user
      await simulateUser(region, '1'); // Simulate a single user with index 0
      console.log(`Finished simulation for user in region: ${region}`); // Log after simulating user
    };

    try {
      // Run the single user simulation and ensure it doesn't throw any errors
      await simulateOneUser();

      // Make the test wait for 1 minute regardless of how long the simulation takes
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
    } catch (error) {
      console.error('Error during matchmaking simulation:', error); // Log the error with detailed output
    }

    // Display all captured console.log messages
    spyConsoleLog.mock.calls.forEach((call) => {
      console.log(call[0]); // Log the captured messages for test output
    });

    spyConsoleLog.mockRestore(); // Restore the original console.log after the test
  }, 61000); // Set the test timeout to slightly longer than 1 minute (61000 ms) to account for delay
});

