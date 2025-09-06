import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput } from '../schema';
import { addToCart } from '../handlers/add_to_cart';
import { eq, and } from 'drizzle-orm';

// Test users and listings setup data
const testBuyer = {
  email: 'buyer@test.com',
  password_hash: 'hashedpassword123',
  role: 'buyer' as const
};

const testSeller = {
  email: 'seller@test.com',
  password_hash: 'hashedpassword456',
  role: 'seller' as const
};

const testListing = {
  title: 'Test Instagram Account',
  description: 'A test Instagram account for sale',
  platform: 'instagram' as const,
  category: 'social_media',
  price: '99.99',
  follower_count: 5000,
  account_age_months: 12,
  encrypted_credentials: 'encrypted_test_credentials',
  status: 'active' as const
};

// Test input
const testInput: AddToCartInput = {
  buyer_id: 1,
  listing_id: 1,
  quantity: 2
};

describe('addToCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let buyerId: number;
  let sellerId: number;
  let listingId: number;

  beforeEach(async () => {
    // Create test users
    const buyerResult = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    buyerId = buyerResult[0].id;

    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    sellerId = sellerResult[0].id;

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    listingId = listingResult[0].id;

    // Update test input with actual IDs
    testInput.buyer_id = buyerId;
    testInput.listing_id = listingId;
  });

  it('should add item to cart successfully', async () => {
    const result = await addToCart(testInput);

    // Verify return value structure
    expect(result.id).toBeDefined();
    expect(result.buyer_id).toEqual(buyerId);
    expect(result.listing_id).toEqual(listingId);
    expect(result.quantity).toEqual(2);
    expect(result.added_at).toBeInstanceOf(Date);
  });

  it('should save cart item to database', async () => {
    const result = await addToCart(testInput);

    // Query database to verify item was saved
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, result.id))
      .execute();

    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].buyer_id).toEqual(buyerId);
    expect(cartItems[0].listing_id).toEqual(listingId);
    expect(cartItems[0].quantity).toEqual(2);
    expect(cartItems[0].added_at).toBeInstanceOf(Date);
  });

  it('should update quantity if item already exists in cart', async () => {
    // Add item first time
    await addToCart(testInput);

    // Add same item again with different quantity
    const secondInput = {
      ...testInput,
      quantity: 3
    };
    const result = await addToCart(secondInput);

    // Should have updated quantity (2 + 3 = 5)
    expect(result.quantity).toEqual(5);

    // Verify only one cart item exists in database
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.buyer_id, buyerId),
        eq(cartItemsTable.listing_id, listingId)
      ))
      .execute();

    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].quantity).toEqual(5);
  });

  it('should update timestamp when updating existing cart item', async () => {
    // Add item first time
    const firstResult = await addToCart(testInput);
    const firstTimestamp = firstResult.added_at;

    // Wait a small amount to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    // Add same item again
    const secondResult = await addToCart({
      ...testInput,
      quantity: 1
    });

    // Timestamp should be updated
    expect(secondResult.added_at.getTime()).toBeGreaterThan(firstTimestamp.getTime());
  });

  it('should throw error when listing does not exist', async () => {
    const invalidInput = {
      ...testInput,
      listing_id: 999999 // Non-existent listing ID
    };

    await expect(addToCart(invalidInput)).rejects.toThrow(/listing not found/i);
  });

  it('should throw error when listing is not active', async () => {
    // Update listing status to 'sold'
    await db.update(listingsTable)
      .set({ status: 'sold' })
      .where(eq(listingsTable.id, listingId))
      .execute();

    await expect(addToCart(testInput)).rejects.toThrow(/listing is not active/i);
  });

  it('should handle different listing statuses correctly', async () => {
    const inactiveStatuses = ['sold', 'removed', 'under_review'] as const;

    for (const status of inactiveStatuses) {
      // Update listing status
      await db.update(listingsTable)
        .set({ status })
        .where(eq(listingsTable.id, listingId))
        .execute();

      await expect(addToCart(testInput)).rejects.toThrow(/listing is not active/i);
    }
  });

  it('should work with default quantity of 1', async () => {
    const inputWithDefaultQuantity = {
      buyer_id: buyerId,
      listing_id: listingId,
      quantity: 1
    };

    const result = await addToCart(inputWithDefaultQuantity);

    expect(result.quantity).toEqual(1);
  });
});