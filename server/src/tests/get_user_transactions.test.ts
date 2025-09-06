import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable } from '../db/schema';
import { type GetUserOrdersInput } from '../schema';
import { getUserTransactions } from '../handlers/get_user_transactions';

// Test data setup
const testBuyer = {
  email: 'buyer@test.com',
  password_hash: 'hash123',
  role: 'buyer' as const,
  is_verified: true,
  balance: '0.00'
};

const testSeller = {
  email: 'seller@test.com',
  password_hash: 'hash456',
  role: 'seller' as const,
  is_verified: true,
  balance: '100.00'
};

const testListing = {
  title: 'Test Account',
  description: 'A test social media account',
  platform: 'instagram' as const,
  category: 'lifestyle',
  price: '49.99',
  follower_count: 1000,
  account_age_months: 12,
  encrypted_credentials: 'encrypted_data_123',
  status: 'active' as const
};

describe('getUserTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no transactions', async () => {
    // Create user but no transactions
    const [buyer] = await db.insert(usersTable).values(testBuyer).returning().execute();

    const input: GetUserOrdersInput = {
      user_id: buyer.id,
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toEqual([]);
  });

  it('should return transactions for buyer', async () => {
    // Create users
    const [buyer, seller] = await db.insert(usersTable)
      .values([testBuyer, testSeller])
      .returning()
      .execute();

    // Create listing
    const [listing] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: seller.id })
      .returning()
      .execute();

    // Create transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '49.99',
        platform_fee: '4.99',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();

    const input: GetUserOrdersInput = {
      user_id: buyer.id,
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(transaction.id);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].listing_id).toEqual(listing.id);
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].amount).toEqual(49.99);
    expect(typeof result[0].platform_fee).toBe('number');
    expect(result[0].platform_fee).toEqual(4.99);
    expect(result[0].payment_method).toEqual('credit_card');
    expect(result[0].status).toEqual('completed');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return transactions for seller', async () => {
    // Create users
    const [buyer, seller] = await db.insert(usersTable)
      .values([testBuyer, testSeller])
      .returning()
      .execute();

    // Create listing
    const [listing] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: seller.id })
      .returning()
      .execute();

    // Create transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '29.99',
        platform_fee: '2.99',
        payment_method: 'paypal',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: GetUserOrdersInput = {
      user_id: seller.id,
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(transaction.id);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].amount).toEqual(29.99);
    expect(result[0].platform_fee).toEqual(2.99);
    expect(result[0].payment_method).toEqual('paypal');
    expect(result[0].status).toEqual('pending');
  });

  it('should filter transactions by status', async () => {
    // Create users
    const [buyer, seller] = await db.insert(usersTable)
      .values([testBuyer, testSeller])
      .returning()
      .execute();

    // Create listing
    const [listing] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: seller.id })
      .returning()
      .execute();

    // Create multiple transactions with different statuses
    await db.insert(transactionsTable)
      .values([
        {
          buyer_id: buyer.id,
          seller_id: seller.id,
          listing_id: listing.id,
          amount: '19.99',
          platform_fee: '1.99',
          payment_method: 'credit_card',
          status: 'completed'
        },
        {
          buyer_id: buyer.id,
          seller_id: seller.id,
          listing_id: listing.id,
          amount: '39.99',
          platform_fee: '3.99',
          payment_method: 'paypal',
          status: 'pending'
        },
        {
          buyer_id: buyer.id,
          seller_id: seller.id,
          listing_id: listing.id,
          amount: '59.99',
          platform_fee: '5.99',
          payment_method: 'crypto',
          status: 'disputed'
        }
      ])
      .execute();

    // Filter for only completed transactions
    const input: GetUserOrdersInput = {
      user_id: buyer.id,
      status: 'completed',
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('completed');
    expect(result[0].amount).toEqual(19.99);
  });

  it('should handle pagination correctly', async () => {
    // Create users
    const [buyer, seller] = await db.insert(usersTable)
      .values([testBuyer, testSeller])
      .returning()
      .execute();

    // Create listing
    const [listing] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: seller.id })
      .returning()
      .execute();

    // Create multiple transactions
    const transactionData = Array.from({ length: 5 }, (_, i) => ({
      buyer_id: buyer.id,
      seller_id: seller.id,
      listing_id: listing.id,
      amount: `${10 + i}.99`,
      platform_fee: '1.00',
      payment_method: 'credit_card' as const,
      status: 'completed' as const
    }));

    await db.insert(transactionsTable)
      .values(transactionData)
      .execute();

    // Test first page
    const firstPageInput: GetUserOrdersInput = {
      user_id: buyer.id,
      limit: 2,
      offset: 0
    };

    const firstPage = await getUserTransactions(firstPageInput);
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageInput: GetUserOrdersInput = {
      user_id: buyer.id,
      limit: 2,
      offset: 2
    };

    const secondPage = await getUserTransactions(secondPageInput);
    expect(secondPage).toHaveLength(2);

    // Ensure different results
    expect(firstPage[0].id).not.toEqual(secondPage[0].id);
  });

  it('should order transactions by creation date descending', async () => {
    // Create users
    const [buyer, seller] = await db.insert(usersTable)
      .values([testBuyer, testSeller])
      .returning()
      .execute();

    // Create listing
    const [listing] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: seller.id })
      .returning()
      .execute();

    // Create transactions with small delay to ensure different timestamps
    const [firstTransaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '10.99',
        platform_fee: '1.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const [secondTransaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '20.99',
        platform_fee: '2.00',
        payment_method: 'paypal',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: GetUserOrdersInput = {
      user_id: buyer.id,
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toHaveLength(2);
    // Most recent should be first
    expect(result[0].id).toEqual(secondTransaction.id);
    expect(result[1].id).toEqual(firstTransaction.id);
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should return transactions where user is either buyer or seller', async () => {
    // Create users
    const [user1, user2, user3] = await db.insert(usersTable)
      .values([
        testBuyer,
        { ...testSeller, email: 'seller2@test.com' },
        { ...testBuyer, email: 'buyer2@test.com', role: 'buyer' as const }
      ])
      .returning()
      .execute();

    // Create listings
    const [listing1] = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user2.id })
      .returning()
      .execute();

    const [listing2] = await db.insert(listingsTable)
      .values({ ...testListing, title: 'Another Account', seller_id: user1.id })
      .returning()
      .execute();

    // Create transactions where user1 is buyer and seller
    await db.insert(transactionsTable)
      .values([
        // user1 as buyer
        {
          buyer_id: user1.id,
          seller_id: user2.id,
          listing_id: listing1.id,
          amount: '15.99',
          platform_fee: '1.59',
          payment_method: 'credit_card',
          status: 'completed'
        },
        // user1 as seller
        {
          buyer_id: user3.id,
          seller_id: user1.id,
          listing_id: listing2.id,
          amount: '25.99',
          platform_fee: '2.59',
          payment_method: 'paypal',
          status: 'pending'
        }
      ])
      .execute();

    const input: GetUserOrdersInput = {
      user_id: user1.id,
      limit: 20,
      offset: 0
    };

    const result = await getUserTransactions(input);

    expect(result).toHaveLength(2);
    // Should include transactions where user1 is buyer or seller
    const buyerTransactions = result.filter(t => t.buyer_id === user1.id);
    const sellerTransactions = result.filter(t => t.seller_id === user1.id);
    expect(buyerTransactions).toHaveLength(1);
    expect(sellerTransactions).toHaveLength(1);
  });
});