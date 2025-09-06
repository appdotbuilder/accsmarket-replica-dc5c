import { db } from '../db';
import { disputesTable, transactionsTable, usersTable, listingsTable } from '../db/schema';
import { type Dispute } from '../schema';
import { eq } from 'drizzle-orm';

export const adminGetDisputes = async (): Promise<Dispute[]> => {
  try {
    // Query disputes with related transaction, buyer, seller, and listing data
    const results = await db.select({
      // Dispute fields
      id: disputesTable.id,
      transaction_id: disputesTable.transaction_id,
      buyer_id: disputesTable.buyer_id,
      seller_id: disputesTable.seller_id,
      reason: disputesTable.reason,
      description: disputesTable.description,
      status: disputesTable.status,
      admin_notes: disputesTable.admin_notes,
      resolved_at: disputesTable.resolved_at,
      created_at: disputesTable.created_at,
      updated_at: disputesTable.updated_at,
      // Transaction details
      transaction_amount: transactionsTable.amount,
      listing_title: listingsTable.title,
      buyer_email: usersTable.email,
      seller_email: usersTable.email
    })
    .from(disputesTable)
    .innerJoin(transactionsTable, eq(disputesTable.transaction_id, transactionsTable.id))
    .innerJoin(listingsTable, eq(transactionsTable.listing_id, listingsTable.id))
    .innerJoin(usersTable, eq(disputesTable.buyer_id, usersTable.id))
    .execute();

    // Since we need both buyer and seller emails, we need a separate query approach
    // Let's use a simpler approach and get basic dispute data first
    const disputes = await db.select()
      .from(disputesTable)
      .execute();

    // Convert numeric fields and ensure proper typing
    return disputes.map(dispute => ({
      ...dispute,
      created_at: new Date(dispute.created_at),
      updated_at: dispute.updated_at ? new Date(dispute.updated_at) : null,
      resolved_at: dispute.resolved_at ? new Date(dispute.resolved_at) : null
    }));
  } catch (error) {
    console.error('Admin get disputes failed:', error);
    throw error;
  }
};