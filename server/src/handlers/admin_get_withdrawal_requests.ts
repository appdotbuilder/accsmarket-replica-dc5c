import { db } from '../db';
import { withdrawalRequestsTable, usersTable } from '../db/schema';
import { type WithdrawalRequest } from '../schema';
import { desc, eq } from 'drizzle-orm';

export const adminGetWithdrawalRequests = async (): Promise<WithdrawalRequest[]> => {
  try {
    // Fetch all withdrawal requests with seller information, ordered by created_at desc
    const results = await db.select({
      id: withdrawalRequestsTable.id,
      seller_id: withdrawalRequestsTable.seller_id,
      amount: withdrawalRequestsTable.amount,
      payment_method: withdrawalRequestsTable.payment_method,
      payment_details: withdrawalRequestsTable.payment_details,
      status: withdrawalRequestsTable.status,
      admin_notes: withdrawalRequestsTable.admin_notes,
      processed_at: withdrawalRequestsTable.processed_at,
      created_at: withdrawalRequestsTable.created_at
    })
    .from(withdrawalRequestsTable)
    .innerJoin(usersTable, eq(withdrawalRequestsTable.seller_id, usersTable.id))
    .orderBy(desc(withdrawalRequestsTable.created_at))
    .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(request => ({
      ...request,
      amount: parseFloat(request.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch withdrawal requests:', error);
    throw error;
  }
};