
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { getStoreProfile } from '../handlers/get_store_profile';

// Test store profile data
const testStoreProfile = {
  name: 'Test Store',
  address: '123 Test Street, Test City',
  phone: '+62-21-12345678',
  email: 'test@teststore.com',
  npwp: '12.345.678.9-012.000'
};

describe('getStoreProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when no store profile exists', async () => {
    const result = await getStoreProfile();

    expect(result).toBeNull();
  });

  it('should return store profile when it exists', async () => {
    // Create a test store profile
    const created = await db.insert(storeProfilesTable)
      .values(testStoreProfile)
      .returning()
      .execute();

    const result = await getStoreProfile();

    expect(result).not.toBeNull();
    expect(result?.id).toEqual(created[0].id);
    expect(result?.name).toEqual('Test Store');
    expect(result?.address).toEqual('123 Test Street, Test City');
    expect(result?.phone).toEqual('+62-21-12345678');
    expect(result?.email).toEqual('test@teststore.com');
    expect(result?.npwp).toEqual('12.345.678.9-012.000');
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return first store profile when multiple exist', async () => {
    // Create first store profile
    const firstStore = await db.insert(storeProfilesTable)
      .values({
        ...testStoreProfile,
        name: 'First Store'
      })
      .returning()
      .execute();

    // Create second store profile
    await db.insert(storeProfilesTable)
      .values({
        ...testStoreProfile,
        name: 'Second Store',
        email: 'second@teststore.com'
      })
      .returning()
      .execute();

    const result = await getStoreProfile();

    expect(result).not.toBeNull();
    expect(result?.id).toEqual(firstStore[0].id);
    expect(result?.name).toEqual('First Store');
  });

  it('should have all required fields with correct types', async () => {
    // Create a test store profile
    await db.insert(storeProfilesTable)
      .values(testStoreProfile)
      .returning()
      .execute();

    const result = await getStoreProfile();

    expect(result).not.toBeNull();
    expect(typeof result?.id).toBe('number');
    expect(typeof result?.name).toBe('string');
    expect(typeof result?.address).toBe('string');
    expect(typeof result?.phone).toBe('string');
    expect(typeof result?.email).toBe('string');
    expect(typeof result?.npwp).toBe('string');
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });
});
