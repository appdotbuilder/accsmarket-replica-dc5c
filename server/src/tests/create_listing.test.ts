import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type CreateListingInput } from '../schema';
import { createListing } from '../handlers/create_listing';
import { eq } from 'drizzle-orm';

describe('createListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test seller before each test
  const createTestSeller = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true,
        balance: '0.00'
      })
      .returning()
      .execute();
    return result[0];
  };

  const testInput: CreateListingInput = {
    seller_id: 0, // Will be set dynamically
    title: 'High Level Instagram Account',
    description: 'Well established Instagram account with authentic followers and high engagement rate',
    platform: 'instagram',
    category: 'Social Media',
    price: 299.99,
    follower_count: 50000,
    account_age_months: 24,
    credentials: 'user123:pass456:email@example.com:emailpass789'
  };

  it('should create a listing successfully', async () => {
    const seller = await createTestSeller();
    const input = { ...testInput, seller_id: seller.id };

    const result = await createListing(input);

    // Verify basic fields
    expect(result.id).toBeDefined();
    expect(result.seller_id).toEqual(seller.id);
    expect(result.title).toEqual('High Level Instagram Account');
    expect(result.description).toEqual(testInput.description);
    expect(result.platform).toEqual('instagram');
    expect(result.category).toEqual('Social Media');
    expect(result.price).toEqual(299.99);
    expect(typeof result.price).toEqual('number');
    expect(result.follower_count).toEqual(50000);
    expect(result.account_age_months).toEqual(24);
    expect(result.status).toEqual('under_review');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeNull();
    expect(result.encrypted_credentials).toBeDefined();
    expect(result.encrypted_credentials).not.toEqual(testInput.credentials);
  });

  it('should save listing to database correctly', async () => {
    const seller = await createTestSeller();
    const input = { ...testInput, seller_id: seller.id };

    const result = await createListing(input);

    // Query database to verify the listing was saved
    const savedListings = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, result.id))
      .execute();

    expect(savedListings).toHaveLength(1);
    const savedListing = savedListings[0];

    expect(savedListing.seller_id).toEqual(seller.id);
    expect(savedListing.title).toEqual(testInput.title);
    expect(savedListing.platform).toEqual('instagram');
    expect(parseFloat(savedListing.price)).toEqual(299.99);
    expect(savedListing.status).toEqual('under_review');
    expect(savedListing.encrypted_credentials).toBeDefined();
  });

  it('should encrypt credentials properly', async () => {
    const seller = await createTestSeller();
    const input = { ...testInput, seller_id: seller.id };

    const result = await createListing(input);

    // Verify credentials are encrypted (base64 encoded)
    expect(result.encrypted_credentials).not.toEqual(testInput.credentials);
    
    // Verify we can decode the base64 to get original credentials
    const decodedCredentials = Buffer.from(result.encrypted_credentials, 'base64').toString();
    expect(decodedCredentials).toEqual(testInput.credentials);
  });

  it('should handle nullable fields correctly', async () => {
    const seller = await createTestSeller();
    const inputWithNulls: CreateListingInput = {
      seller_id: seller.id,
      title: 'Basic Account',
      description: 'A simple account listing without follower count or age',
      platform: 'twitter',
      category: 'Gaming',
      price: 50.00,
      follower_count: null,
      account_age_months: null,
      credentials: 'basic:creds'
    };

    const result = await createListing(inputWithNulls);

    expect(result.follower_count).toBeNull();
    expect(result.account_age_months).toBeNull();
    expect(result.price).toEqual(50.00);
    expect(result.platform).toEqual('twitter');
  });

  it('should throw error for non-existent seller', async () => {
    const input = { ...testInput, seller_id: 99999 }; // Non-existent seller ID

    await expect(createListing(input)).rejects.toThrow(/seller not found/i);
  });

  it('should throw error for unverified seller', async () => {
    // Create unverified seller
    const unverifiedSeller = await db.insert(usersTable)
      .values({
        email: 'unverified@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: false, // Not verified
        balance: '0.00'
      })
      .returning()
      .execute();

    const input = { ...testInput, seller_id: unverifiedSeller[0].id };

    await expect(createListing(input)).rejects.toThrow(/seller must be verified/i);
  });

  it('should handle different platforms correctly', async () => {
    const seller = await createTestSeller();
    
    const platforms = ['instagram', 'twitter', 'tiktok', 'youtube', 'discord'] as const;
    
    for (const platform of platforms) {
      const input = { 
        ...testInput, 
        seller_id: seller.id,
        title: `${platform} Account`,
        platform: platform 
      };
      
      const result = await createListing(input);
      expect(result.platform).toEqual(platform);
    }
  });

  it('should handle large follower counts and old accounts', async () => {
    const seller = await createTestSeller();
    const input: CreateListingInput = {
      seller_id: seller.id,
      title: 'Mega Influencer Account',
      description: 'Very established account with millions of followers',
      platform: 'youtube',
      category: 'Entertainment',
      price: 15000.00,
      follower_count: 5000000,
      account_age_months: 120, // 10 years old
      credentials: 'mega:account:creds'
    };

    const result = await createListing(input);

    expect(result.price).toEqual(15000.00);
    expect(result.follower_count).toEqual(5000000);
    expect(result.account_age_months).toEqual(120);
  });
});