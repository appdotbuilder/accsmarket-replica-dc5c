import { db } from '../db';
import { reviewsTable, usersTable, transactionsTable } from '../db/schema';
import { type Review } from '../schema';
import { eq } from 'drizzle-orm';

export const getSellerReviews = async (sellerId: number): Promise<Review[]> => {
  try {
    // Query reviews with buyer and transaction information
    const results = await db.select({
      review: reviewsTable,
      buyer: {
        id: usersTable.id,
        email: usersTable.email
      },
      transaction: {
        id: transactionsTable.id,
        amount: transactionsTable.amount,
        created_at: transactionsTable.created_at
      }
    })
    .from(reviewsTable)
    .innerJoin(usersTable, eq(reviewsTable.buyer_id, usersTable.id))
    .innerJoin(transactionsTable, eq(reviewsTable.transaction_id, transactionsTable.id))
    .where(eq(reviewsTable.seller_id, sellerId))
    .execute();

    // Transform results to match Review schema with numeric conversion
    return results.map(result => ({
      ...result.review,
      // Convert numeric fields back to numbers
      id: result.review.id,
      transaction_id: result.review.transaction_id,
      buyer_id: result.review.buyer_id,
      seller_id: result.review.seller_id,
      rating: result.review.rating,
      comment: result.review.comment,
      created_at: result.review.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch seller reviews:', error);
    throw error;
  }
};