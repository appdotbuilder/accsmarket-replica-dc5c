import { db } from '../db';
import { transactionsTable, listingsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function getTransactionCredentials(transactionId: number, buyerId: number): Promise<string | null> {
  try {
    // Get transaction with listing data in a single query using join
    const results = await db.select()
      .from(transactionsTable)
      .innerJoin(listingsTable, eq(transactionsTable.listing_id, listingsTable.id))
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    if (results.length === 0) {
      return null; // Transaction not found
    }

    const transaction = results[0].transactions;
    const listing = results[0].listings;

    // Verify transaction belongs to the requesting buyer
    if (transaction.buyer_id !== buyerId) {
      return null; // Unauthorized access
    }

    // Verify transaction is completed
    if (transaction.status !== 'completed') {
      return null; // Transaction not completed
    }

    // Check if credentials were already delivered
    if (transaction.credentials_delivered_at !== null) {
      return null; // Credentials already delivered
    }

    // Update transaction to mark credentials as delivered
    await db.update(transactionsTable)
      .set({
        credentials_delivered_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    // Return the decrypted credentials
    // Note: In a real implementation, this would decrypt the encrypted_credentials
    // For now, returning the encrypted credentials as placeholder
    return listing.encrypted_credentials;
  } catch (error) {
    console.error('Get transaction credentials failed:', error);
    throw error;
  }
}