
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { type StoreProfile } from '../schema';

export const getStoreProfile = async (): Promise<StoreProfile | null> => {
  try {
    // Get the first store profile (assuming single store setup)
    const results = await db.select()
      .from(storeProfilesTable)
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Return the store profile as-is since all fields are already correct types
    return results[0];
  } catch (error) {
    console.error('Failed to get store profile:', error);
    throw error;
  }
};
