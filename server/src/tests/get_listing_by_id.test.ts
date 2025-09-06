import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { getListingById } from '../handlers/get_listing_by_id';
import { eq } from 'drizzle-orm';

describe('getListingById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return active listing by ID', async () => {
    // Create a seller user first
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create a listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Test Gaming Account',
        description: 'High level gaming account for sale',
        platform: 'steam',
        category: 'gaming',
        price: '99.99',
        follower_count: 1000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_data_here',
        status: 'active'
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(listing.id);
    expect(result!.seller_id).toEqual(user.id);
    expect(result!.title).toEqual('Test Gaming Account');
    expect(result!.description).toEqual('High level gaming account for sale');
    expect(result!.platform).toEqual('steam');
    expect(result!.category).toEqual('gaming');
    expect(result!.price).toEqual(99.99);
    expect(typeof result!.price).toBe('number');
    expect(result!.follower_count).toEqual(1000);
    expect(result!.account_age_months).toEqual(12);
    expect(result!.status).toEqual('active');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.encrypted_credentials).toEqual(''); // Should be excluded for security
  });

  it('should return null for non-existent listing', async () => {
    const result = await getListingById(99999);
    expect(result).toBeNull();
  });

  it('should return null for inactive listings', async () => {
    // Create a seller user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create an inactive listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Sold Account',
        description: 'This account has been sold',
        platform: 'instagram',
        category: 'social_media',
        price: '50.00',
        encrypted_credentials: 'encrypted_data_here',
        status: 'sold' // Not active
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);
    expect(result).toBeNull();
  });

  it('should return null for removed listings', async () => {
    // Create a seller user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create a removed listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Removed Account',
        description: 'This account has been removed',
        platform: 'twitter',
        category: 'social_media',
        price: '75.00',
        encrypted_credentials: 'encrypted_data_here',
        status: 'removed'
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);
    expect(result).toBeNull();
  });

  it('should handle listings with null optional fields', async () => {
    // Create a seller user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create a listing with null optional fields
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Minimal Account',
        description: 'Account with minimal information',
        platform: 'other',
        category: 'misc',
        price: '25.50',
        follower_count: null,
        account_age_months: null,
        encrypted_credentials: 'encrypted_data_here',
        status: 'active'
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(listing.id);
    expect(result!.title).toEqual('Minimal Account');
    expect(result!.price).toEqual(25.50);
    expect(result!.follower_count).toBeNull();
    expect(result!.account_age_months).toBeNull();
    expect(result!.encrypted_credentials).toEqual(''); // Should be excluded
  });

  it('should handle decimal prices correctly', async () => {
    // Create a seller user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create a listing with decimal price
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Decimal Price Account',
        description: 'Account with precise decimal pricing',
        platform: 'discord',
        category: 'communication',
        price: '123.45',
        encrypted_credentials: 'encrypted_data_here',
        status: 'active'
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);

    expect(result).toBeDefined();
    expect(result!.price).toEqual(123.45);
    expect(typeof result!.price).toBe('number');
  });

  it('should verify listing exists in database after retrieval', async () => {
    // Create a seller user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    // Create a listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: user.id,
        title: 'Verification Test Account',
        description: 'Account for database verification',
        platform: 'youtube',
        category: 'content_creation',
        price: '200.00',
        encrypted_credentials: 'encrypted_data_here',
        status: 'active'
      })
      .returning()
      .execute();

    const result = await getListingById(listing.id);

    // Verify the listing exists in database and matches our result
    const dbListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listing.id))
      .execute();

    expect(dbListing).toHaveLength(1);
    expect(result).toBeDefined();
    expect(result!.id).toEqual(dbListing[0].id);
    expect(result!.title).toEqual(dbListing[0].title);
    expect(result!.status).toEqual(dbListing[0].status);
  });
});