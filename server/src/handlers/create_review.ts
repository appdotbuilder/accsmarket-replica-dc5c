import { db } from '../db';
import { transactionsTable, reviewsTable } from '../db/schema';
import { type CreateReviewInput, type Review } from '../schema';
import { eq } from 'drizzle-orm';

export const createReview = async (input: CreateReviewInput): Promise<Review> => {
  try {
    // First, verify the transaction exists and is completed
    const transaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.transaction_id))
      .execute();

    if (!transaction.length) {
      throw new Error('Transaction not found');
    }

    const transactionData = transaction[0];

    // Verify the transaction belongs to the buyer
    if (transactionData.buyer_id !== input.buyer_id) {
      throw new Error('Transaction does not belong to this buyer');
    }

    // Verify the transaction is completed
    if (transactionData.status !== 'completed') {
      throw new Error('Cannot review incomplete transaction');
    }

    // Check if review already exists
    const existingReview = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.transaction_id, input.transaction_id))
      .execute();

    if (existingReview.length > 0) {
      throw new Error('Review already exists for this transaction');
    }

    // Create the review
    const result = await db.insert(reviewsTable)
      .values({
        transaction_id: input.transaction_id,
        buyer_id: input.buyer_id,
        seller_id: transactionData.seller_id,
        rating: input.rating,
        comment: input.comment
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Review creation failed:', error);
    throw error;
  }
};