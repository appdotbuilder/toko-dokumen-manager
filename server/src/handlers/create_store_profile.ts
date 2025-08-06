
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { type CreateStoreProfileInput, type StoreProfile } from '../schema';

export const createStoreProfile = async (input: CreateStoreProfileInput): Promise<StoreProfile> => {
  try {
    // Insert store profile record
    const result = await db.insert(storeProfilesTable)
      .values({
        name: input.name,
        address: input.address,
        phone: input.phone,
        email: input.email,
        npwp: input.npwp
      })
      .returning()
      .execute();

    // Return the created store profile
    const storeProfile = result[0];
    return storeProfile;
  } catch (error) {
    console.error('Store profile creation failed:', error);
    throw error;
  }
};
