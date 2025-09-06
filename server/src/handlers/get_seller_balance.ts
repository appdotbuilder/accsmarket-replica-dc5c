import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const getSellerBalance = async (sellerId: number): Promise<number> => {
  try {
    // Query the user's balance from the database
    const result = await db.select({ balance: usersTable.balance })
      .from(usersTable)
      .where(eq(usersTable.id, sellerId))
      .execute();

    // If user not found, return 0
    if (result.length === 0) {
      return 0;
    }

    // Convert numeric balance to number and return
    const balance = result[0].balance;
    return parseFloat(balance);
  } catch (error) {
    console.error('Failed to get seller balance:', error);
    throw error;
  }
};