import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { adminModerateListing } from '../handlers/admin_moderate_listing';
import { eq } from 'drizzle-orm';

describe('adminModerateListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller',
        is_verified: true
      })
      .returning()
      .execute();

    const seller = sellerResult[0];

    // Create a test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'A test gaming account for moderation',
        platform: 'instagram',
        category: 'Gaming',
        price: '99.99',
        follower_count: 5000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_test_credentials',
        status: 'active'
      })
      .returning()
      .execute();

    return {
      seller,
      listing: listingResult[0]
    };
  };

  it('should moderate listing to removed status', async () => {
    const { listing } = await createTestData();

    const result = await adminModerateListing(listing.id, 'removed');

    expect(result).toBeDefined();
    expect(result!.id).toEqual(listing.id);
    expect(result!.status).toEqual('removed');
    expect(result!.title).toEqual('Test Account');
    expect(result!.price).toEqual(99.99);
    expect(typeof result!.price).toBe('number');
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should moderate listing to active status', async () => {
    const { listing } = await createTestData();

    // First set it to removed
    await adminModerateListing(listing.id, 'removed');
    
    // Then moderate back to active
    const result = await adminModerateListing(listing.id, 'active');

    expect(result).toBeDefined();
    expect(result!.id).toEqual(listing.id);
    expect(result!.status).toEqual('active');
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should save moderation changes to database', async () => {
    const { listing } = await createTestData();

    await adminModerateListing(listing.id, 'removed');

    // Verify changes are persisted in database
    const updatedListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listing.id))
      .execute();

    expect(updatedListing).toHaveLength(1);
    expect(updatedListing[0].status).toEqual('removed');
    expect(updatedListing[0].updated_at).toBeInstanceOf(Date);
    expect(updatedListing[0].updated_at!.getTime()).toBeGreaterThan(listing.updated_at?.getTime() || 0);
  });

  it('should return null for non-existent listing', async () => {
    const result = await adminModerateListing(99999, 'removed');

    expect(result).toBeNull();
  });

  it('should handle admin notes parameter gracefully', async () => {
    const { listing } = await createTestData();

    // Even though admin_notes isn't stored in listings table,
    // the function should accept the parameter without error
    const result = await adminModerateListing(listing.id, 'removed', 'Violates community guidelines');

    expect(result).toBeDefined();
    expect(result!.status).toEqual('removed');
  });

  it('should preserve other listing fields during moderation', async () => {
    const { listing } = await createTestData();

    const result = await adminModerateListing(listing.id, 'removed');

    expect(result).toBeDefined();
    expect(result!.seller_id).toEqual(listing.seller_id);
    expect(result!.title).toEqual(listing.title);
    expect(result!.description).toEqual(listing.description);
    expect(result!.platform).toEqual(listing.platform);
    expect(result!.category).toEqual(listing.category);
    expect(result!.price).toEqual(99.99);
    expect(result!.follower_count).toEqual(listing.follower_count);
    expect(result!.account_age_months).toEqual(listing.account_age_months);
    expect(result!.encrypted_credentials).toEqual(listing.encrypted_credentials);
  });

  it('should handle listing with under_review status', async () => {
    const { seller } = await createTestData();

    // Create a listing with under_review status
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Under Review Account',
        description: 'Account under moderation review',
        platform: 'twitter',
        category: 'Social Media',
        price: '49.99',
        follower_count: 1000,
        account_age_months: 6,
        encrypted_credentials: 'encrypted_review_credentials',
        status: 'under_review'
      })
      .returning()
      .execute();

    const listing = listingResult[0];

    const result = await adminModerateListing(listing.id, 'active');

    expect(result).toBeDefined();
    expect(result!.status).toEqual('active');
  });

  it('should work with listings having null optional fields', async () => {
    const { seller } = await createTestData();

    // Create a listing with null optional fields
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Minimal Account',
        description: 'Account with minimal information',
        platform: 'other',
        category: 'Misc',
        price: '25.00',
        follower_count: null,
        account_age_months: null,
        encrypted_credentials: 'encrypted_minimal_credentials',
        status: 'active'
      })
      .returning()
      .execute();

    const listing = listingResult[0];

    const result = await adminModerateListing(listing.id, 'removed');

    expect(result).toBeDefined();
    expect(result!.status).toEqual('removed');
    expect(result!.follower_count).toBeNull();
    expect(result!.account_age_months).toBeNull();
    expect(result!.price).toEqual(25.00);
  });
});