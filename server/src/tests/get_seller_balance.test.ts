import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getSellerBalance } from '../handlers/get_seller_balance';

describe('getSellerBalance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return seller balance for existing user', async () => {
    // Create test seller with specific balance
    const sellerData = {
      email: 'seller@test.com',
      password_hash: 'hashed_password',
      role: 'seller' as const,
      balance: '150.75'
    };

    const [seller] = await db.insert(usersTable)
      .values(sellerData)
      .returning()
      .execute();

    const balance = await getSellerBalance(seller.id);

    expect(balance).toEqual(150.75);
    expect(typeof balance).toBe('number');
  });

  it('should return 0 for non-existent seller', async () => {
    const balance = await getSellerBalance(999);

    expect(balance).toEqual(0);
    expect(typeof balance).toBe('number');
  });

  it('should handle zero balance correctly', async () => {
    // Create seller with zero balance
    const sellerData = {
      email: 'zeroseller@test.com',
      password_hash: 'hashed_password',
      role: 'seller' as const,
      balance: '0.00'
    };

    const [seller] = await db.insert(usersTable)
      .values(sellerData)
      .returning()
      .execute();

    const balance = await getSellerBalance(seller.id);

    expect(balance).toEqual(0);
    expect(typeof balance).toBe('number');
  });

  it('should handle decimal balances correctly', async () => {
    // Create seller with decimal balance
    const sellerData = {
      email: 'decimalseller@test.com',
      password_hash: 'hashed_password',
      role: 'seller' as const,
      balance: '99.99'
    };

    const [seller] = await db.insert(usersTable)
      .values(sellerData)
      .returning()
      .execute();

    const balance = await getSellerBalance(seller.id);

    expect(balance).toEqual(99.99);
    expect(typeof balance).toBe('number');
  });

  it('should work for users with different roles', async () => {
    // Create buyer with balance (edge case)
    const buyerData = {
      email: 'buyer@test.com',
      password_hash: 'hashed_password',
      role: 'buyer' as const,
      balance: '25.50'
    };

    const [buyer] = await db.insert(usersTable)
      .values(buyerData)
      .returning()
      .execute();

    const balance = await getSellerBalance(buyer.id);

    expect(balance).toEqual(25.50);
    expect(typeof balance).toBe('number');
  });

  it('should handle large balance values', async () => {
    // Create seller with large balance
    const sellerData = {
      email: 'richseller@test.com',
      password_hash: 'hashed_password',
      role: 'seller' as const,
      balance: '9999999.99'
    };

    const [seller] = await db.insert(usersTable)
      .values(sellerData)
      .returning()
      .execute();

    const balance = await getSellerBalance(seller.id);

    expect(balance).toEqual(9999999.99);
    expect(typeof balance).toBe('number');
  });
});