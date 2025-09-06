import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { adminGetAllListings } from '../handlers/admin_get_all_listings';

describe('adminGetAllListings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no listings exist', async () => {
    const result = await adminGetAllListings();
    expect(result).toEqual([]);
  });

  it('should return all listings with proper data types', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test listing
    await db.insert(listingsTable)
      .values({
        seller_id: userId,
        title: 'Test Account',
        description: 'A test account for sale',
        platform: 'instagram',
        category: 'social_media',
        price: '99.99',
        follower_count: 1000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_test_credentials',
        status: 'active'
      })
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Test Account');
    expect(result[0].description).toEqual('A test account for sale');
    expect(result[0].platform).toEqual('instagram');
    expect(result[0].category).toEqual('social_media');
    expect(typeof result[0].price).toEqual('number');
    expect(result[0].price).toEqual(99.99);
    expect(result[0].follower_count).toEqual(1000);
    expect(result[0].account_age_months).toEqual(12);
    expect(result[0].status).toEqual('active');
    expect(result[0].seller_id).toEqual(userId);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should redact encrypted credentials for security', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test listing with sensitive credentials
    await db.insert(listingsTable)
      .values({
        seller_id: userId,
        title: 'Sensitive Account',
        description: 'Account with sensitive data',
        platform: 'twitter',
        category: 'social_media',
        price: '150.00',
        encrypted_credentials: 'very_sensitive_encrypted_data',
        status: 'active'
      })
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(1);
    expect(result[0].encrypted_credentials).toEqual('[REDACTED]');
    expect(result[0].encrypted_credentials).not.toEqual('very_sensitive_encrypted_data');
  });

  it('should return listings in all statuses', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create listings with different statuses
    await db.insert(listingsTable)
      .values([
        {
          seller_id: userId,
          title: 'Active Account',
          description: 'Active listing',
          platform: 'instagram',
          category: 'social_media',
          price: '99.99',
          encrypted_credentials: 'encrypted_data_1',
          status: 'active'
        },
        {
          seller_id: userId,
          title: 'Sold Account',
          description: 'Sold listing',
          platform: 'twitter',
          category: 'social_media',
          price: '149.99',
          encrypted_credentials: 'encrypted_data_2',
          status: 'sold'
        },
        {
          seller_id: userId,
          title: 'Removed Account',
          description: 'Removed listing',
          platform: 'facebook',
          category: 'social_media',
          price: '199.99',
          encrypted_credentials: 'encrypted_data_3',
          status: 'removed'
        },
        {
          seller_id: userId,
          title: 'Under Review Account',
          description: 'Under review listing',
          platform: 'tiktok',
          category: 'social_media',
          price: '89.99',
          encrypted_credentials: 'encrypted_data_4',
          status: 'under_review'
        }
      ])
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(4);
    
    const statuses = result.map(listing => listing.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('sold');
    expect(statuses).toContain('removed');
    expect(statuses).toContain('under_review');
    
    // Verify all have redacted credentials
    result.forEach(listing => {
      expect(listing.encrypted_credentials).toEqual('[REDACTED]');
    });
  });

  it('should return listings from multiple sellers', async () => {
    // Create multiple test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'seller1@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'seller2@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId1 = user1Result[0].id;
    const userId2 = user2Result[0].id;

    // Create listings from different sellers
    await db.insert(listingsTable)
      .values([
        {
          seller_id: userId1,
          title: 'Seller 1 Account',
          description: 'Account from first seller',
          platform: 'instagram',
          category: 'social_media',
          price: '99.99',
          encrypted_credentials: 'encrypted_data_1',
          status: 'active'
        },
        {
          seller_id: userId2,
          title: 'Seller 2 Account',
          description: 'Account from second seller',
          platform: 'twitter',
          category: 'social_media',
          price: '149.99',
          encrypted_credentials: 'encrypted_data_2',
          status: 'active'
        }
      ])
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(2);
    
    const sellerIds = result.map(listing => listing.seller_id);
    expect(sellerIds).toContain(userId1);
    expect(sellerIds).toContain(userId2);
    
    const titles = result.map(listing => listing.title);
    expect(titles).toContain('Seller 1 Account');
    expect(titles).toContain('Seller 2 Account');
  });

  it('should handle listings with null optional fields', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create listing with null optional fields
    await db.insert(listingsTable)
      .values({
        seller_id: userId,
        title: 'Minimal Account',
        description: 'Account with minimal data',
        platform: 'discord',
        category: 'gaming',
        price: '25.00',
        follower_count: null,
        account_age_months: null,
        encrypted_credentials: 'encrypted_minimal_data',
        status: 'active'
      })
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(1);
    expect(result[0].follower_count).toBeNull();
    expect(result[0].account_age_months).toBeNull();
    expect(result[0].updated_at).toBeNull();
    expect(result[0].price).toEqual(25.00);
    expect(result[0].encrypted_credentials).toEqual('[REDACTED]');
  });

  it('should handle various platforms and categories', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create listings with different platforms
    await db.insert(listingsTable)
      .values([
        {
          seller_id: userId,
          title: 'Steam Account',
          description: 'Gaming account',
          platform: 'steam',
          category: 'gaming',
          price: '50.00',
          encrypted_credentials: 'steam_credentials',
          status: 'active'
        },
        {
          seller_id: userId,
          title: 'YouTube Channel',
          description: 'Content creator channel',
          platform: 'youtube',
          category: 'content_creation',
          price: '500.00',
          follower_count: 10000,
          account_age_months: 24,
          encrypted_credentials: 'youtube_credentials',
          status: 'active'
        }
      ])
      .execute();

    const result = await adminGetAllListings();

    expect(result).toHaveLength(2);
    
    const platforms = result.map(listing => listing.platform);
    expect(platforms).toContain('steam');
    expect(platforms).toContain('youtube');
    
    const steamListing = result.find(listing => listing.platform === 'steam');
    const youtubeListing = result.find(listing => listing.platform === 'youtube');
    
    expect(steamListing?.category).toEqual('gaming');
    expect(steamListing?.price).toEqual(50.00);
    
    expect(youtubeListing?.category).toEqual('content_creation');
    expect(youtubeListing?.price).toEqual(500.00);
    expect(youtubeListing?.follower_count).toEqual(10000);
    expect(youtubeListing?.account_age_months).toEqual(24);
  });
});