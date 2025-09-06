import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, cartItemsTable } from '../db/schema';
import { getCart } from '../handlers/get_cart';
import { eq } from 'drizzle-orm';

describe('getCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for user with no cart items', async () => {
    // Create a user with no cart items
    const userResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const buyerId = userResult[0].id;

    const cart = await getCart(buyerId);

    expect(cart).toEqual([]);
  });

  it('should return cart items with active listings', async () => {
    // Create buyer and seller
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyerId = buyerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Create an active listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Test Instagram Account',
        description: 'High quality Instagram account with many followers',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        follower_count: 5000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'active'
      })
      .returning()
      .execute();

    const listingId = listingResult[0].id;

    // Add item to cart
    const cartItemResult = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: listingId,
        quantity: 1
      })
      .returning()
      .execute();

    const cart = await getCart(buyerId);

    expect(cart).toHaveLength(1);
    expect(cart[0]).toEqual({
      id: cartItemResult[0].id,
      buyer_id: buyerId,
      listing_id: listingId,
      quantity: 1,
      added_at: cartItemResult[0].added_at
    });
  });

  it('should exclude cart items for sold listings', async () => {
    // Create buyer and seller
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyerId = buyerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Create a sold listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Sold Instagram Account',
        description: 'This account has been sold',
        platform: 'instagram',
        category: 'social_media',
        price: '150.00',
        follower_count: 8000,
        account_age_months: 18,
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'sold'
      })
      .returning()
      .execute();

    const listingId = listingResult[0].id;

    // Add item to cart (this could happen if listing was sold after adding to cart)
    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: listingId,
        quantity: 1
      })
      .execute();

    const cart = await getCart(buyerId);

    expect(cart).toEqual([]);
  });

  it('should exclude cart items for removed listings', async () => {
    // Create buyer and seller
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyerId = buyerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Create a removed listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Removed Twitter Account',
        description: 'This account has been removed',
        platform: 'twitter',
        category: 'social_media',
        price: '75.00',
        follower_count: 3000,
        account_age_months: 6,
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'removed'
      })
      .returning()
      .execute();

    const listingId = listingResult[0].id;

    // Add item to cart
    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: listingId,
        quantity: 1
      })
      .execute();

    const cart = await getCart(buyerId);

    expect(cart).toEqual([]);
  });

  it('should return multiple cart items with different quantities', async () => {
    // Create buyer and seller
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyerId = buyerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Create multiple active listings
    const listing1Result = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account 1',
        description: 'First Instagram account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        follower_count: 5000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_credentials_data_1',
        status: 'active'
      })
      .returning()
      .execute();

    const listing2Result = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'YouTube Channel',
        description: 'Gaming YouTube channel',
        platform: 'youtube',
        category: 'gaming',
        price: '250.00',
        follower_count: 15000,
        account_age_months: 24,
        encrypted_credentials: 'encrypted_credentials_data_2',
        status: 'active'
      })
      .returning()
      .execute();

    // Add items to cart with different quantities
    const cartItem1Result = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: listing1Result[0].id,
        quantity: 2
      })
      .returning()
      .execute();

    const cartItem2Result = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: listing2Result[0].id,
        quantity: 1
      })
      .returning()
      .execute();

    const cart = await getCart(buyerId);

    expect(cart).toHaveLength(2);
    
    // Find each cart item by listing_id to avoid order dependencies
    const item1 = cart.find(item => item.listing_id === listing1Result[0].id);
    const item2 = cart.find(item => item.listing_id === listing2Result[0].id);

    expect(item1).toBeDefined();
    expect(item1?.quantity).toEqual(2);
    expect(item1?.buyer_id).toEqual(buyerId);

    expect(item2).toBeDefined();
    expect(item2?.quantity).toEqual(1);
    expect(item2?.buyer_id).toEqual(buyerId);
  });

  it('should only return cart items for the specified buyer', async () => {
    // Create two buyers and one seller
    const buyer1Result = await db.insert(usersTable)
      .values({
        email: 'buyer1@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const buyer2Result = await db.insert(usersTable)
      .values({
        email: 'buyer2@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyer1Id = buyer1Result[0].id;
    const buyer2Id = buyer2Result[0].id;
    const sellerId = sellerResult[0].id;

    // Create an active listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Shared Listing',
        description: 'A listing that both buyers have in cart',
        platform: 'discord',
        category: 'gaming',
        price: '50.00',
        follower_count: 2000,
        account_age_months: 8,
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'active'
      })
      .returning()
      .execute();

    const listingId = listingResult[0].id;

    // Add item to both buyers' carts
    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer1Id,
        listing_id: listingId,
        quantity: 1
      })
      .execute();

    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer2Id,
        listing_id: listingId,
        quantity: 3
      })
      .execute();

    // Get cart for buyer1
    const buyer1Cart = await getCart(buyer1Id);
    expect(buyer1Cart).toHaveLength(1);
    expect(buyer1Cart[0].buyer_id).toEqual(buyer1Id);
    expect(buyer1Cart[0].quantity).toEqual(1);

    // Get cart for buyer2
    const buyer2Cart = await getCart(buyer2Id);
    expect(buyer2Cart).toHaveLength(1);
    expect(buyer2Cart[0].buyer_id).toEqual(buyer2Id);
    expect(buyer2Cart[0].quantity).toEqual(3);
  });

  it('should include cart items for listings under_review', async () => {
    // Create buyer and seller
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();

    const buyerId = buyerResult[0].id;
    const sellerId = sellerResult[0].id;

    // Create active listing and under_review listing
    const activeListing = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Active Listing',
        description: 'This listing is active',
        platform: 'steam',
        category: 'gaming',
        price: '30.00',
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'active'
      })
      .returning()
      .execute();

    const reviewListing = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Under Review Listing',
        description: 'This listing is under review',
        platform: 'epic_games',
        category: 'gaming',
        price: '40.00',
        encrypted_credentials: 'encrypted_credentials_data',
        status: 'under_review'
      })
      .returning()
      .execute();

    // Add both to cart
    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: activeListing[0].id,
        quantity: 1
      })
      .execute();

    await db.insert(cartItemsTable)
      .values({
        buyer_id: buyerId,
        listing_id: reviewListing[0].id,
        quantity: 1
      })
      .execute();

    const cart = await getCart(buyerId);

    // Should only include the active listing, not the under_review one
    expect(cart).toHaveLength(1);
    expect(cart[0].listing_id).toEqual(activeListing[0].id);
  });
});