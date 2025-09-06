import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { type SearchListingsInput } from '../schema';
import { getListings } from '../handlers/get_listings';

describe('getListings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async () => {
    const users = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();
    return users[0];
  };

  // Helper function to create test listings
  const createTestListings = async (sellerId: number) => {
    const listings = [
      {
        seller_id: sellerId,
        title: 'Instagram Gaming Account',
        description: 'High follower gaming account with great engagement',
        platform: 'instagram' as const,
        category: 'gaming',
        price: '150.00',
        follower_count: 50000,
        account_age_months: 24,
        encrypted_credentials: 'encrypted_creds_1',
        status: 'active' as const
      },
      {
        seller_id: sellerId,
        title: 'Twitter Tech Account',
        description: 'Professional tech account with verified status',
        platform: 'twitter' as const,
        category: 'tech',
        price: '300.50',
        follower_count: 100000,
        account_age_months: 36,
        encrypted_credentials: 'encrypted_creds_2',
        status: 'active' as const
      },
      {
        seller_id: sellerId,
        title: 'Facebook Business Page',
        description: 'Established business page with loyal followers',
        platform: 'facebook' as const,
        category: 'business',
        price: '75.25',
        follower_count: 25000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_creds_3',
        status: 'sold' as const  // This should be filtered out
      },
      {
        seller_id: sellerId,
        title: 'TikTok Dance Account',
        description: 'Viral dance account with young audience',
        platform: 'tiktok' as const,
        category: 'entertainment',
        price: '200.00',
        follower_count: 75000,
        account_age_months: 18,
        encrypted_credentials: 'encrypted_creds_4',
        status: 'active' as const
      }
    ];

    return await db.insert(listingsTable)
      .values(listings)
      .returning()
      .execute();
  };

  it('should return all active listings without filters', async () => {
    const user = await createTestUser();
    const createdListings = await createTestListings(user.id);

    const result = await getListings();

    // Should return only active listings (3 out of 4)
    expect(result).toHaveLength(3);
    
    // Check that all returned listings are active
    result.forEach(listing => {
      expect(listing.status).toEqual('active');
    });

    // Check numeric conversions
    result.forEach(listing => {
      expect(typeof listing.price).toBe('number');
      expect(listing.price).toBeGreaterThan(0);
    });

    // Should be sorted by creation date desc (newest first) by default
    // Note: Default sort is by created_at desc, but exact order may vary
    // Just check that we have the expected titles in some order
    const titles = result.map(l => l.title).sort();
    const expectedTitles = ['Instagram Gaming Account', 'Twitter Tech Account', 'TikTok Dance Account'].sort();
    expect(titles).toEqual(expectedTitles);
  });

  it('should filter by text search in title', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      query: 'gaming',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Instagram Gaming Account');
    expect(result[0].category).toEqual('gaming');
  });

  it('should filter by platform', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      platform: 'twitter',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(1);
    expect(result[0].platform).toEqual('twitter');
    expect(result[0].title).toEqual('Twitter Tech Account');
  });

  it('should filter by category', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      category: 'tech',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(1);
    expect(result[0].category).toEqual('tech');
    expect(result[0].title).toEqual('Twitter Tech Account');
  });

  it('should filter by price range', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      min_price: 100,
      max_price: 250,
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.price).toBeGreaterThanOrEqual(100);
      expect(listing.price).toBeLessThanOrEqual(250);
    });
  });

  it('should filter by follower count range', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      min_followers: 40000,
      max_followers: 80000,
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.follower_count).toBeGreaterThanOrEqual(40000);
      expect(listing.follower_count!).toBeLessThanOrEqual(80000);
    });
  });

  it('should filter by account age range', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      min_age_months: 15,
      max_age_months: 30,
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(2);
    result.forEach(listing => {
      expect(listing.account_age_months).toBeGreaterThanOrEqual(15);
      expect(listing.account_age_months!).toBeLessThanOrEqual(30);
    });
  });

  it('should sort by price ascending', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      sort_by: 'price_asc',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(3);
    expect(result[0].price).toBeLessThan(result[1].price);
    expect(result[1].price).toBeLessThan(result[2].price);
  });

  it('should sort by price descending', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      sort_by: 'price_desc',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(3);
    expect(result[0].price).toBeGreaterThan(result[1].price);
    expect(result[1].price).toBeGreaterThan(result[2].price);
  });

  it('should sort by followers descending', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      sort_by: 'followers_desc',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(3);
    expect(result[0].follower_count).toBeGreaterThan(result[1].follower_count!);
    expect(result[1].follower_count!).toBeGreaterThan(result[2].follower_count!);
  });

  it('should handle pagination correctly', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    // Test first page
    const firstPage: SearchListingsInput = {
      limit: 2,
      offset: 0
    };

    const firstResult = await getListings(firstPage);
    expect(firstResult).toHaveLength(2);

    // Test second page
    const secondPage: SearchListingsInput = {
      limit: 2,
      offset: 2
    };

    const secondResult = await getListings(secondPage);
    expect(secondResult).toHaveLength(1);

    // Ensure no overlap
    const firstIds = firstResult.map(l => l.id);
    const secondIds = secondResult.map(l => l.id);
    expect(firstIds).not.toEqual(expect.arrayContaining(secondIds));
  });

  it('should combine multiple filters', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      platform: 'instagram',
      min_price: 100,
      min_followers: 40000,
      sort_by: 'price_desc',
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);

    expect(result).toHaveLength(1);
    expect(result[0].platform).toEqual('instagram');
    expect(result[0].price).toBeGreaterThanOrEqual(100);
    expect(result[0].follower_count).toBeGreaterThanOrEqual(40000);
  });

  it('should return empty array when no listings match filters', async () => {
    const user = await createTestUser();
    await createTestListings(user.id);

    const input: SearchListingsInput = {
      platform: 'youtube', // No YouTube listings in test data
      min_price: 1000, // Price too high
      limit: 20,
      offset: 0
    };

    const result = await getListings(input);
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no active listings exist', async () => {
    // Don't create any listings
    const result = await getListings();
    expect(result).toHaveLength(0);
  });

  it('should handle listings with null follower_count and account_age_months', async () => {
    const user = await createTestUser();
    
    // Create listing with null optional fields
    await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Simple Account',
        description: 'Account without follower/age data',
        platform: 'other',
        category: 'misc',
        price: '50.00',
        follower_count: null,
        account_age_months: null,
        encrypted_credentials: 'encrypted_creds_null',
        status: 'active'
      })
      .execute();

    const result = await getListings();

    expect(result).toHaveLength(1);
    expect(result[0].follower_count).toBeNull();
    expect(result[0].account_age_months).toBeNull();
    expect(result[0].price).toEqual(50);
  });
});