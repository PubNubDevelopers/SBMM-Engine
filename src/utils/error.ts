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