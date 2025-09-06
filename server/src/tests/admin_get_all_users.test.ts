import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable } from '../db/schema';
import { adminGetAllUsers } from '../handlers/admin_get_all_users';
import { eq } from 'drizzle-orm';

describe('adminGetAllUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await adminGetAllUsers();
    
    expect(result).toEqual([]);
  });

  it('should fetch all users and exclude password hashes', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'buyer@test.com',
          password_hash: 'hashed_password_123',
          role: 'buyer',
          is_verified: true,
          balance: '150.50'
        },
        {
          email: 'seller@test.com',
          password_hash: 'another_hash_456',
          role: 'seller',
          is_verified: false,
          balance: '0.00'
        },
        {
          email: 'admin@test.com',
          password_hash: 'admin_hash_789',
          role: 'admin',
          is_verified: true,
          balance: '500.25'
        }
      ])
      .returning()
      .execute();

    const result = await adminGetAllUsers();

    // Should return all users
    expect(result).toHaveLength(3);

    // Check that password hashes are excluded
    result.forEach(user => {
      expect(user.password_hash).toEqual('');
    });

    // Check user data integrity
    const buyerUser = result.find(u => u.email === 'buyer@test.com');
    expect(buyerUser).toBeDefined();
    expect(buyerUser!.role).toEqual('buyer');
    expect(buyerUser!.is_verified).toBe(true);
    expect(buyerUser!.balance).toEqual(150.5);
    expect(typeof buyerUser!.balance).toBe('number');

    const sellerUser = result.find(u => u.email === 'seller@test.com');
    expect(sellerUser).toBeDefined();
    expect(sellerUser!.role).toEqual('seller');
    expect(sellerUser!.is_verified).toBe(false);
    expect(sellerUser!.balance).toEqual(0);

    const adminUser = result.find(u => u.email === 'admin@test.com');
    expect(adminUser).toBeDefined();
    expect(adminUser!.role).toEqual('admin');
    expect(adminUser!.balance).toEqual(500.25);
  });

  it('should return users with correct data types', async () => {
    await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'test_hash',
        role: 'buyer',
        is_verified: true,
        balance: '99.99'
      })
      .execute();

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(1);
    
    const user = result[0];
    expect(typeof user.id).toBe('number');
    expect(typeof user.email).toBe('string');
    expect(typeof user.password_hash).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(typeof user.is_verified).toBe('boolean');
    expect(typeof user.balance).toBe('number');
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at === null || user.updated_at instanceof Date).toBe(true);
  });

  it('should handle users with different roles and verification status', async () => {
    await db.insert(usersTable)
      .values([
        {
          email: 'verified.buyer@test.com',
          password_hash: 'hash1',
          role: 'buyer',
          is_verified: true,
          balance: '100.00'
        },
        {
          email: 'unverified.seller@test.com',
          password_hash: 'hash2',
          role: 'seller',
          is_verified: false,
          balance: '250.75'
        },
        {
          email: 'admin.user@test.com',
          password_hash: 'hash3',
          role: 'admin',
          is_verified: true,
          balance: '1000.00'
        }
      ])
      .execute();

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(3);

    // Check role distribution
    const buyers = result.filter(u => u.role === 'buyer');
    const sellers = result.filter(u => u.role === 'seller');
    const admins = result.filter(u => u.role === 'admin');

    expect(buyers).toHaveLength(1);
    expect(sellers).toHaveLength(1);
    expect(admins).toHaveLength(1);

    // Check verification status
    const verified = result.filter(u => u.is_verified);
    const unverified = result.filter(u => !u.is_verified);

    expect(verified).toHaveLength(2);
    expect(unverified).toHaveLength(1);
  });

  it('should handle users with null updated_at', async () => {
    await db.insert(usersTable)
      .values({
        email: 'new.user@test.com',
        password_hash: 'test_hash',
        role: 'buyer',
        is_verified: false,
        balance: '0.00'
      })
      .execute();

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(1);
    expect(result[0].updated_at).toBeNull();
  });

  it('should return users ordered by their natural database order', async () => {
    const emails = ['user1@test.com', 'user2@test.com', 'user3@test.com'];
    
    // Insert users sequentially
    for (const email of emails) {
      await db.insert(usersTable)
        .values({
          email,
          password_hash: 'hash',
          role: 'buyer',
          is_verified: true,
          balance: '50.00'
        })
        .execute();
    }

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(3);
    
    // Check that users are returned (database order is not guaranteed but IDs should be sequential)
    const resultIds = result.map(u => u.id).sort((a, b) => a - b);
    expect(resultIds[0]).toBeLessThan(resultIds[1]);
    expect(resultIds[1]).toBeLessThan(resultIds[2]);
  });

  it('should handle edge case with zero balance', async () => {
    await db.insert(usersTable)
      .values({
        email: 'zero.balance@test.com',
        password_hash: 'hash',
        role: 'seller',
        is_verified: true,
        balance: '0.00'
      })
      .execute();

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(1);
    expect(result[0].balance).toEqual(0);
    expect(typeof result[0].balance).toBe('number');
  });

  it('should handle large balance amounts correctly', async () => {
    await db.insert(usersTable)
      .values({
        email: 'rich.user@test.com',
        password_hash: 'hash',
        role: 'seller',
        is_verified: true,
        balance: '99999.99'
      })
      .execute();

    const result = await adminGetAllUsers();

    expect(result).toHaveLength(1);
    expect(result[0].balance).toEqual(99999.99);
  });
});