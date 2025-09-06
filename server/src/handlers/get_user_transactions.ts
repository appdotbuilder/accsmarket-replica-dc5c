import { db } from '../db';
import { transactionsTable, usersTable, listingsTable } from '../db/schema';
import { type GetUserOrdersInput, type Transaction } from '../schema';
import { eq, or, and, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getUserTransactions(input: GetUserOrdersInput): Promise<Transaction[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Filter by user - user can be either buyer or seller
    conditions.push(
      or(
        eq(transactionsTable.buyer_id, input.user_id),
        eq(transactionsTable.seller_id, input.user_id)
      )!
    );

    // Filter by status if provided
    if (input.status) {
      conditions.push(eq(transactionsTable.status, input.status));
    }

    // Build and execute query with all conditions applied at once
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await db.select({
      id: transactionsTable.id,
      buyer_id: transactionsTable.buyer_id,
      seller_id: transactionsTable.seller_id,
      listing_id: transactionsTable.listing_id,
      amount: transactionsTable.amount,
      platform_fee: transactionsTable.platform_fee,
      payment_method: transactionsTable.payment_method,
      status: transactionsTable.status,
      escrow_release_date: transactionsTable.escrow_release_date,
      credentials_delivered_at: transactionsTable.credentials_delivered_at,
      created_at: transactionsTable.created_at,
      updated_at: transactionsTable.updated_at
    })
    .from(transactionsTable)
    .innerJoin(listingsTable, eq(transactionsTable.listing_id, listingsTable.id))
    .innerJoin(usersTable, eq(transactionsTable.seller_id, usersTable.id))
    .where(whereCondition)
    .orderBy(desc(transactionsTable.created_at))
    .limit(input.limit)
    .offset(input.offset)
    .execute();

    // Convert numeric fields back to numbers and return
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      platform_fee: parseFloat(transaction.platform_fee)
    }));
  } catch (error) {
    console.error('Failed to get user transactions:', error);
    throw error;
  }
}