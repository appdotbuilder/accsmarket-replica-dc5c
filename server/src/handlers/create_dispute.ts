import { db } from '../db';
import { transactionsTable, disputesTable } from '../db/schema';
import { type CreateDisputeInput, type Dispute } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export const createDispute = async (input: CreateDisputeInput): Promise<Dispute> => {
  try {
    // First, verify the transaction exists and belongs to the buyer
    const transactions = await db.select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, input.transaction_id),
        eq(transactionsTable.buyer_id, input.buyer_id)
      ))
      .execute();

    if (transactions.length === 0) {
      throw new Error('Transaction not found or does not belong to buyer');
    }

    const transaction = transactions[0];

    // Check if transaction is within 24-hour dispute window
    const now = new Date();
    const transactionDate = new Date(transaction.created_at);
    const hoursSinceTransaction = (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceTransaction > 24) {
      throw new Error('Dispute window has expired (24 hours after transaction)');
    }

    // Check if a dispute already exists for this transaction
    const existingDisputes = await db.select()
      .from(disputesTable)
      .where(eq(disputesTable.transaction_id, input.transaction_id))
      .execute();

    if (existingDisputes.length > 0) {
      throw new Error('A dispute already exists for this transaction');
    }

    // Create the dispute with seller_id extracted from transaction
    const result = await db.insert(disputesTable)
      .values({
        transaction_id: input.transaction_id,
        buyer_id: input.buyer_id,
        seller_id: transaction.seller_id,
        reason: input.reason,
        description: input.description,
        status: 'open'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Dispute creation failed:', error);
    throw error;
  }
};