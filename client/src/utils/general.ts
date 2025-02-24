// Define the type for the async function to retry
type AsyncFunction<T> = () => Promise<T>;

// Helper to retry async function if it fails
export async function retryOnFailure<T>(fn: AsyncFunction<T>, retries: number, delay: number): Promise<T> {
  let lastError: any; // Use 'any' for a generic error type, or you can specify 'unknown' in strict environments
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Retrying after failure (${i + 1} of ${retries})`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  console.error("Function failed after retries:", lastError);
  throw lastError;
}

export function isTransientError(error: any): boolean {
  // Check for known transient errors (e.g., network issues, 500 errors)
  return error.status >= 500 || error.code === 'NETWORK_ERROR';
}

const developerMessages = new Set<string>(); // Store unique messages

export function developerMessage(message: string) {
  if (!developerMessages.has(message)) {
    developerMessages.add(message);

    // Styling for the console message
    const style1 =
      "background-color: #0000AA; color: white; font-size: 1em; border: 4px solid #0000AA; padding: 2px 4px; border-radius: 3px;";
    const style2 = "color: white; font-size: 1em;";

    console.log(`%c[DEV LOG]%c${message}`, style1, style2);
  }
}