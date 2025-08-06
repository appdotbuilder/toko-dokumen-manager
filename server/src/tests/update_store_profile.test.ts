
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { type UpdateStoreProfileInput, type CreateStoreProfileInput } from '../schema';
import { updateStoreProfile } from '../handlers/update_store_profile';
import { eq } from 'drizzle-orm';

// Helper to create a test store profile
const createTestStoreProfile = async (): Promise<number> => {
  const testProfile: CreateStoreProfileInput = {
    name: 'Original Store',
    address: 'Original Address',
    phone: '081234567890',
    email: 'original@store.com',
    npwp: '123456789012345'
  };

  const result = await db.insert(storeProfilesTable)
    .values(testProfile)
    .returning()
    .execute();

  return result[0].id;
};

describe('updateStoreProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all fields of a store profile', async () => {
    const storeId = await createTestStoreProfile();

    const updateInput: UpdateStoreProfileInput = {
      id: storeId,
      name: 'Updated Store Name',
      address: 'Updated Address 123',
      phone: '087654321098',
      email: 'updated@store.com',
      npwp: '987654321098765'
    };

    const result = await updateStoreProfile(updateInput);

    expect(result.id).toEqual(storeId);
    expect(result.name).toEqual('Updated Store Name');
    expect(result.address).toEqual('Updated Address 123');
    expect(result.phone).toEqual('087654321098');
    expect(result.email).toEqual('updated@store.com');
    expect(result.npwp).toEqual('987654321098765');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const storeId = await createTestStoreProfile();

    const updateInput: UpdateStoreProfileInput = {
      id: storeId,
      name: 'Partially Updated Store',
      email: 'newemail@store.com'
    };

    const result = await updateStoreProfile(updateInput);

    expect(result.id).toEqual(storeId);
    expect(result.name).toEqual('Partially Updated Store');
    expect(result.address).toEqual('Original Address'); // Should remain unchanged
    expect(result.phone).toEqual('081234567890'); // Should remain unchanged
    expect(result.email).toEqual('newemail@store.com');
    expect(result.npwp).toEqual('123456789012345'); // Should remain unchanged
  });

  it('should save updated data to database', async () => {
    const storeId = await createTestStoreProfile();

    const updateInput: UpdateStoreProfileInput = {
      id: storeId,
      name: 'Database Updated Store',
      phone: '081111111111'
    };

    await updateStoreProfile(updateInput);

    // Query database to verify changes were persisted
    const profiles = await db.select()
      .from(storeProfilesTable)
      .where(eq(storeProfilesTable.id, storeId))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toEqual('Database Updated Store');
    expect(profiles[0].phone).toEqual('081111111111');
    expect(profiles[0].address).toEqual('Original Address'); // Should remain unchanged
  });

  it('should update the updated_at timestamp', async () => {
    const storeId = await createTestStoreProfile();

    // Get original timestamp
    const originalProfile = await db.select()
      .from(storeProfilesTable)
      .where(eq(storeProfilesTable.id, storeId))
      .execute();

    const originalUpdatedAt = originalProfile[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateStoreProfileInput = {
      id: storeId,
      name: 'Timestamp Test Store'
    };

    const result = await updateStoreProfile(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error when store profile not found', async () => {
    const updateInput: UpdateStoreProfileInput = {
      id: 999999, // Non-existent ID
      name: 'This Should Fail'
    };

    await expect(updateStoreProfile(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should handle email validation in database', async () => {
    const storeId = await createTestStoreProfile();

    const updateInput: UpdateStoreProfileInput = {
      id: storeId,
      email: 'valid.email@domain.com'
    };

    const result = await updateStoreProfile(updateInput);
    expect(result.email).toEqual('valid.email@domain.com');
  });
});
