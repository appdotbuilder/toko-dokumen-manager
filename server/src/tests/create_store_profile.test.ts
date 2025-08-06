
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { storeProfilesTable } from '../db/schema';
import { type CreateStoreProfileInput } from '../schema';
import { createStoreProfile } from '../handlers/create_store_profile';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreateStoreProfileInput = {
  name: 'Test Store',
  address: '123 Main Street, Test City',
  phone: '+62-123-456-7890',
  email: 'test@store.com',
  npwp: '12.345.678.9-012.345'
};

describe('createStoreProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a store profile', async () => {
    const result = await createStoreProfile(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Store');
    expect(result.address).toEqual(testInput.address);
    expect(result.phone).toEqual(testInput.phone);
    expect(result.email).toEqual(testInput.email);
    expect(result.npwp).toEqual(testInput.npwp);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save store profile to database', async () => {
    const result = await createStoreProfile(testInput);

    // Query using proper drizzle syntax
    const storeProfiles = await db.select()
      .from(storeProfilesTable)
      .where(eq(storeProfilesTable.id, result.id))
      .execute();

    expect(storeProfiles).toHaveLength(1);
    expect(storeProfiles[0].name).toEqual('Test Store');
    expect(storeProfiles[0].address).toEqual(testInput.address);
    expect(storeProfiles[0].phone).toEqual(testInput.phone);
    expect(storeProfiles[0].email).toEqual(testInput.email);
    expect(storeProfiles[0].npwp).toEqual(testInput.npwp);
    expect(storeProfiles[0].created_at).toBeInstanceOf(Date);
    expect(storeProfiles[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle special characters in store data', async () => {
    const specialInput: CreateStoreProfileInput = {
      name: 'Store & Co., Ltd.',
      address: 'Jl. Raya No. 123, RT.01/RW.02, Kelurahan Test',
      phone: '+62 (21) 123-4567',
      email: 'admin@store-co.com',
      npwp: '01.234.567.8-901.234'
    };

    const result = await createStoreProfile(specialInput);

    expect(result.name).toEqual('Store & Co., Ltd.');
    expect(result.address).toEqual(specialInput.address);
    expect(result.phone).toEqual('+62 (21) 123-4567');
    expect(result.email).toEqual('admin@store-co.com');
    expect(result.npwp).toEqual('01.234.567.8-901.234');
  });
});
