import { db } from '../db';
import { cartItemsTable, listingsTable } from '../db/schema';
import { type AddToCartInput, type CartItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export const addToCart = async (input: AddToCartInput): Promise<CartItem> => {
  try {
    // First, verify the listing exists and is active
    const listings = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, input.listing_id))
      .execute();

    if (listings.length === 0) {
      throw new Error('Listing not found');
    }

    const listing = listings[0];
    if (listing.status !== 'active') {
      throw new Error('Listing is not active');
    }

    // Check if item already exists in cart
    const existingCartItems = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.buyer_id, input.buyer_id),
        eq(cartItemsTable.listing_id, input.listing_id)
      ))
      .execute();

    let result;

    if (existingCartItems.length > 0) {
      // Update existing cart item quantity
      const existingItem = existingCartItems[0];
      const newQuantity = existingItem.quantity + input.quantity;

      const updateResult = await db.update(cartItemsTable)
        .set({ 
          quantity: newQuantity,
          added_at: new Date() // Update timestamp on quantity change
        })
        .where(eq(cartItemsTable.id, existingItem.id))
        .returning()
        .execute();

      result = updateResult[0];
    } else {
      // Create new cart item
      const insertResult = await db.insert(cartItemsTable)
        .values({
          buyer_id: input.buyer_id,
          listing_id: input.listing_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      result = insertResult[0];
    }

    return result;
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
};