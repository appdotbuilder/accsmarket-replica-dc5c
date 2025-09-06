import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, cartItemsTable } from '../db/schema';
import { removeFromCart } from '../handlers/remove_from_cart';
import { eq } from 'drizzle-orm';

describe('removeFromCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should remove cart item when it belongs to the buyer', async () => {
    // Create test user (buyer)
    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    // Create test seller
    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create test listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'Test account for sale',
        platform: 'instagram',
        category: 'Gaming',
        price: '99.99',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();

    // Create cart item
    const [cartItem] = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer.id,
        listing_id: listing.id,
        quantity: 1
      })
      .returning()
      .execute();

    // Remove the cart item
    const result = await removeFromCart(cartItem.id, buyer.id);

    // Verify removal was successful
    expect(result).toBe(true);

    // Verify item is actually removed from database
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItem.id))
      .execute();

    expect(remainingItems).toHaveLength(0);
  });

  it('should return false when cart item does not belong to the buyer', async () => {
    // Create test users
    const [buyer1] = await db.insert(usersTable)
      .values({
        email: 'buyer1@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    const [buyer2] = await db.insert(usersTable)
      .values({
        email: 'buyer2@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    // Create test seller
    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create test listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'Test account for sale',
        platform: 'instagram',
        category: 'Gaming',
        price: '99.99',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();

    // Create cart item for buyer1
    const [cartItem] = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer1.id,
        listing_id: listing.id,
        quantity: 1
      })
      .returning()
      .execute();

    // Try to remove cart item using buyer2's ID (should fail)
    const result = await removeFromCart(cartItem.id, buyer2.id);

    // Verify removal failed
    expect(result).toBe(false);

    // Verify item is still in database
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItem.id))
      .execute();

    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].buyer_id).toBe(buyer1.id);
  });

  it('should return false when cart item does not exist', async () => {
    // Create test user
    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    // Try to remove non-existent cart item
    const result = await removeFromCart(999999, buyer.id);

    // Verify removal failed
    expect(result).toBe(false);
  });

  it('should handle multiple cart items correctly', async () => {
    // Create test user
    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    // Create test seller
    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create multiple listings
    const listings = await db.insert(listingsTable)
      .values([
        {
          seller_id: seller.id,
          title: 'Test Account 1',
          description: 'First test account',
          platform: 'instagram',
          category: 'Gaming',
          price: '99.99',
          encrypted_credentials: 'encrypted_creds_1'
        },
        {
          seller_id: seller.id,
          title: 'Test Account 2',
          description: 'Second test account',
          platform: 'twitter',
          category: 'Social',
          price: '149.99',
          encrypted_credentials: 'encrypted_creds_2'
        }
      ])
      .returning()
      .execute();

    // Create multiple cart items
    const cartItems = await db.insert(cartItemsTable)
      .values([
        {
          buyer_id: buyer.id,
          listing_id: listings[0].id,
          quantity: 1
        },
        {
          buyer_id: buyer.id,
          listing_id: listings[1].id,
          quantity: 2
        }
      ])
      .returning()
      .execute();

    // Remove first cart item
    const result1 = await removeFromCart(cartItems[0].id, buyer.id);
    expect(result1).toBe(true);

    // Verify only first item was removed
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.buyer_id, buyer.id))
      .execute();

    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].id).toBe(cartItems[1].id);
    expect(remainingItems[0].listing_id).toBe(listings[1].id);

    // Remove second cart item
    const result2 = await removeFromCart(cartItems[1].id, buyer.id);
    expect(result2).toBe(true);

    // Verify all items are removed
    const finalItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.buyer_id, buyer.id))
      .execute();

    expect(finalItems).toHaveLength(0);
  });
});