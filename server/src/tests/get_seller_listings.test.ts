import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { getSellerListings } from '../handlers/get_seller_listings';

describe('getSellerListings', () => {
  let sellerId: number;
  let otherSellerId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test sellers
    const sellers = await db.insert(usersTable)
      .values([
        {
          email: 'seller1@example.com',
          password_hash: 'hashed_password_1',
          role: 'seller',
          is_verified: true,
          balance: '1000.00'
        },
        {
          email: 'seller2@example.com',
          password_hash: 'hashed_password_2',
          role: 'seller',
          is_verified: true,
          balance: '500.00'
        }
      ])
      .returning()
      .execute();

    sellerId = sellers[0].id;
    otherSellerId = sellers[1].id;
  });

  afterEach(resetDB);

  it('should return empty array when seller has no listings', async () => {
    const result = await getSellerListings(sellerId);

    expect(result).toEqual([]);
  });

  it('should return all listings for a specific seller', async () => {
    // Create multiple listings for the seller
    await db.insert(listingsTable)
      .values([
        {
          seller_id: sellerId,
          title: 'Instagram Account 1',
          description: 'Popular lifestyle account',
          platform: 'instagram',
          category: 'lifestyle',
          price: '100.50',
          follower_count: 10000,
          account_age_months: 24,
          encrypted_credentials: 'encrypted_creds_1',
          status: 'active'
        },
        {
          seller_id: sellerId,
          title: 'Twitter Account',
          description: 'Tech news account',
          platform: 'twitter',
          category: 'tech',
          price: '75.25',
          follower_count: 5000,
          account_age_months: 12,
          encrypted_credentials: 'encrypted_creds_2',
          status: 'sold'
        },
        {
          seller_id: sellerId,
          title: 'Gaming Account',
          description: 'Steam gaming account',
          platform: 'steam',
          category: 'gaming',
          price: '200.00',
          follower_count: null,
          account_age_months: 36,
          encrypted_credentials: 'encrypted_creds_3',
          status: 'under_review'
        }
      ])
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(3);
    expect(result[0].title).toEqual('Instagram Account 1');
    expect(result[0].seller_id).toEqual(sellerId);
    expect(result[0].price).toEqual(100.50);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].encrypted_credentials).toEqual(''); // Should be excluded
    
    expect(result[1].title).toEqual('Twitter Account');
    expect(result[1].price).toEqual(75.25);
    expect(result[1].status).toEqual('sold');
    
    expect(result[2].title).toEqual('Gaming Account');
    expect(result[2].price).toEqual(200.00);
    expect(result[2].follower_count).toBeNull();
    expect(result[2].status).toEqual('under_review');
  });

  it('should include listings with all statuses for seller dashboard', async () => {
    // Create listings with different statuses
    await db.insert(listingsTable)
      .values([
        {
          seller_id: sellerId,
          title: 'Active Listing',
          description: 'Active account',
          platform: 'instagram',
          category: 'lifestyle',
          price: '100.00',
          encrypted_credentials: 'encrypted_creds_1',
          status: 'active'
        },
        {
          seller_id: sellerId,
          title: 'Sold Listing',
          description: 'Sold account',
          platform: 'twitter',
          category: 'tech',
          price: '150.00',
          encrypted_credentials: 'encrypted_creds_2',
          status: 'sold'
        },
        {
          seller_id: sellerId,
          title: 'Removed Listing',
          description: 'Removed account',
          platform: 'facebook',
          category: 'social',
          price: '75.00',
          encrypted_credentials: 'encrypted_creds_3',
          status: 'removed'
        },
        {
          seller_id: sellerId,
          title: 'Under Review Listing',
          description: 'Under review account',
          platform: 'tiktok',
          category: 'entertainment',
          price: '125.00',
          encrypted_credentials: 'encrypted_creds_4',
          status: 'under_review'
        }
      ])
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(4);
    
    const statuses = result.map(listing => listing.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('sold');
    expect(statuses).toContain('removed');
    expect(statuses).toContain('under_review');
  });

  it('should only return listings for specified seller', async () => {
    // Create listings for both sellers
    await db.insert(listingsTable)
      .values([
        {
          seller_id: sellerId,
          title: 'Seller 1 Listing',
          description: 'First seller account',
          platform: 'instagram',
          category: 'lifestyle',
          price: '100.00',
          encrypted_credentials: 'encrypted_creds_1',
          status: 'active'
        },
        {
          seller_id: otherSellerId,
          title: 'Seller 2 Listing',
          description: 'Second seller account',
          platform: 'twitter',
          category: 'tech',
          price: '150.00',
          encrypted_credentials: 'encrypted_creds_2',
          status: 'active'
        }
      ])
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Seller 1 Listing');
    expect(result[0].seller_id).toEqual(sellerId);
  });

  it('should exclude encrypted credentials from response', async () => {
    await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Test Listing',
        description: 'Test account',
        platform: 'instagram',
        category: 'lifestyle',
        price: '100.00',
        encrypted_credentials: 'sensitive_encrypted_data',
        status: 'active'
      })
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(1);
    expect(result[0].encrypted_credentials).toEqual('');
    expect(result[0].encrypted_credentials).not.toEqual('sensitive_encrypted_data');
  });

  it('should handle numeric conversions correctly', async () => {
    await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Price Test Listing',
        description: 'Testing numeric conversion',
        platform: 'instagram',
        category: 'lifestyle',
        price: '123.45',
        follower_count: 50000,
        account_age_months: 18,
        encrypted_credentials: 'encrypted_creds',
        status: 'active'
      })
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(1);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toEqual(123.45);
    expect(typeof result[0].follower_count).toBe('number');
    expect(result[0].follower_count).toEqual(50000);
    expect(typeof result[0].account_age_months).toBe('number');
    expect(result[0].account_age_months).toEqual(18);
  });

  it('should handle null values correctly', async () => {
    await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Null Test Listing',
        description: 'Testing null values',
        platform: 'steam',
        category: 'gaming',
        price: '99.99',
        follower_count: null,
        account_age_months: null,
        encrypted_credentials: 'encrypted_creds',
        status: 'active'
      })
      .execute();

    const result = await getSellerListings(sellerId);

    expect(result).toHaveLength(1);
    expect(result[0].follower_count).toBeNull();
    expect(result[0].account_age_months).toBeNull();
    expect(result[0].updated_at).toBeNull();
  });
});