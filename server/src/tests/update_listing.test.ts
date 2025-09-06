import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable } from '../db/schema';
import { type UpdateListingInput } from '../schema';
import { updateListing } from '../handlers/update_listing';
import { eq } from 'drizzle-orm';

// Create test user for creating listings
const testUser = {
  email: 'seller@test.com',
  password_hash: 'hashed_password',
  role: 'seller' as const,
  is_verified: true
};

// Create test listing
const testListing = {
  seller_id: 1, // Will be set after user creation
  title: 'Original Instagram Account',
  description: 'A test Instagram account for sale',
  platform: 'instagram' as const,
  category: 'social_media',
  price: '99.99',
  follower_count: 5000,
  account_age_months: 12,
  encrypted_credentials: 'encrypted_test_credentials'
};

describe('updateListing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a listing with all fields', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Update the listing
    const updateInput: UpdateListingInput = {
      id: listing.id,
      title: 'Updated Instagram Account',
      description: 'An updated test Instagram account for sale',
      price: 149.99,
      follower_count: 7500,
      account_age_months: 18,
      status: 'under_review'
    };

    const result = await updateListing(updateInput);

    // Verify the result
    expect(result).toBeDefined();
    expect(result!.id).toEqual(listing.id);
    expect(result!.title).toEqual('Updated Instagram Account');
    expect(result!.description).toEqual('An updated test Instagram account for sale');
    expect(result!.price).toEqual(149.99);
    expect(result!.follower_count).toEqual(7500);
    expect(result!.account_age_months).toEqual(18);
    expect(result!.status).toEqual('under_review');
    expect(result!.seller_id).toEqual(user.id);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Update only title and price
    const updateInput: UpdateListingInput = {
      id: listing.id,
      title: 'Partially Updated Title',
      price: 199.99
    };

    const result = await updateListing(updateInput);

    // Verify updated fields
    expect(result).toBeDefined();
    expect(result!.title).toEqual('Partially Updated Title');
    expect(result!.price).toEqual(199.99);

    // Verify unchanged fields
    expect(result!.description).toEqual(testListing.description);
    expect(result!.follower_count).toEqual(testListing.follower_count);
    expect(result!.account_age_months).toEqual(testListing.account_age_months);
    expect(result!.status).toEqual('active'); // Default status
  });

  it('should update nullable fields to null', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing with follower_count and account_age_months
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Update nullable fields to null
    const updateInput: UpdateListingInput = {
      id: listing.id,
      follower_count: null,
      account_age_months: null
    };

    const result = await updateListing(updateInput);

    // Verify nullable fields are set to null
    expect(result).toBeDefined();
    expect(result!.follower_count).toBeNull();
    expect(result!.account_age_months).toBeNull();

    // Verify other fields remain unchanged
    expect(result!.title).toEqual(testListing.title);
    expect(result!.description).toEqual(testListing.description);
    expect(result!.price).toEqual(parseFloat(testListing.price));
  });

  it('should save updated listing to database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Update the listing
    const updateInput: UpdateListingInput = {
      id: listing.id,
      title: 'Database Test Update',
      price: 299.99,
      status: 'sold'
    };

    await updateListing(updateInput);

    // Query database to verify changes were persisted
    const updatedListings = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listing.id))
      .execute();

    expect(updatedListings).toHaveLength(1);
    const dbListing = updatedListings[0];
    expect(dbListing.title).toEqual('Database Test Update');
    expect(parseFloat(dbListing.price)).toEqual(299.99);
    expect(dbListing.status).toEqual('sold');
    expect(dbListing.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent listing', async () => {
    const updateInput: UpdateListingInput = {
      id: 99999, // Non-existent ID
      title: 'Should Not Work'
    };

    const result = await updateListing(updateInput);

    expect(result).toBeNull();
  });

  it('should handle numeric price conversions correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Update with decimal price
    const updateInput: UpdateListingInput = {
      id: listing.id,
      price: 123.45
    };

    const result = await updateListing(updateInput);

    // Verify price is correctly converted
    expect(result).toBeDefined();
    expect(result!.price).toEqual(123.45);
    expect(typeof result!.price).toEqual('number');

    // Verify in database
    const dbListings = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listing.id))
      .execute();
    
    expect(dbListings[0].price).toEqual('123.45'); // Stored as string in DB
  });

  it('should preserve updated_at timestamp update', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({ ...testListing, seller_id: user.id })
      .returning()
      .execute();
    const listing = listingResult[0];
    const originalUpdatedAt = listing.updated_at;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update the listing
    const updateInput: UpdateListingInput = {
      id: listing.id,
      title: 'Timestamp Test'
    };

    const result = await updateListing(updateInput);

    // Verify updated_at was changed
    expect(result).toBeDefined();
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at).not.toEqual(originalUpdatedAt);
  });
});