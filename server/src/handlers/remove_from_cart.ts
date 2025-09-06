import { db } from '../db';
import { cartItemsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function removeFromCart(cartItemId: number, buyerId: number): Promise<boolean> {
  try {
    // Verify the cart item belongs to the buyer and delete it in one operation
    const result = await db.delete(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.id, cartItemId),
          eq(cartItemsTable.buyer_id, buyerId)
        )
      )
      .execute();

    // Check if any rows were affected (item was found and deleted)
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Failed to remove item from cart:', error);
    throw error;
  }
}