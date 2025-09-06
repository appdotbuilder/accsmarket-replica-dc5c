import { db } from '../db';
import { cartItemsTable, listingsTable } from '../db/schema';
import { type CartItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getCart = async (buyerId: number): Promise<CartItem[]> => {
  try {
    // Query cart items with their associated listings
    // Only include cart items where the listing is still active
    const results = await db.select()
      .from(cartItemsTable)
      .innerJoin(listingsTable, eq(cartItemsTable.listing_id, listingsTable.id))
      .where(and(
        eq(cartItemsTable.buyer_id, buyerId),
        eq(listingsTable.status, 'active')
      ))
      .execute();

    // Transform results to match CartItem schema
    return results.map(result => ({
      id: result.cart_items.id,
      buyer_id: result.cart_items.buyer_id,
      listing_id: result.cart_items.listing_id,
      quantity: result.cart_items.quantity,
      added_at: result.cart_items.added_at
    }));
  } catch (error) {
    console.error('Failed to fetch cart:', error);
    throw error;
  }
};