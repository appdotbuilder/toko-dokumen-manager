
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { type UpdateStoreProfileInput, type StoreProfile } from '../schema';
import { eq } from 'drizzle-orm';

export const updateStoreProfile = async (input: UpdateStoreProfileInput): Promise<StoreProfile> => {
  try {
    // Build update object with only provided fields
    const updateData: Partial<typeof storeProfilesTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.npwp !== undefined) updateData.npwp = input.npwp;

    // Update the store profile record
    const result = await db.update(storeProfilesTable)
      .set(updateData)
      .where(eq(storeProfilesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Store profile with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Store profile update failed:', error);
    throw error;
  }
};
