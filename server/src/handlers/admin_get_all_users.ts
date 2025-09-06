import { db } from '../db';
import { usersTable, listingsTable, transactionsTable } from '../db/schema';
import { type User } from '../schema';
import { sql, count, eq } from 'drizzle-orm';

export const adminGetAllUsers = async (): Promise<User[]> => {
  try {
    // Get all users with aggregated statistics
    const result = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      password_hash: sql<string>`''`.as('password_hash'), // Exclude actual password hash
      role: usersTable.role,
      is_verified: usersTable.is_verified,
      balance: usersTable.balance,
      created_at: usersTable.created_at,
      updated_at: usersTable.updated_at,
      listing_count: count(listingsTable.id).as('listing_count'),
      transaction_count: count(transactionsTable.id).as('transaction_count')
    })
    .from(usersTable)
    .leftJoin(listingsTable, eq(listingsTable.seller_id, usersTable.id))
    .leftJoin(transactionsTable, eq(transactionsTable.buyer_id, usersTable.id))
    .groupBy(usersTable.id, usersTable.email, usersTable.role, usersTable.is_verified, 
             usersTable.balance, usersTable.created_at, usersTable.updated_at)
    .execute();

    // Convert numeric fields back to numbers and format the response
    return result.map(user => ({
      id: user.id,
      email: user.email,
      password_hash: '', // Always return empty string for security
      role: user.role,
      is_verified: user.is_verified,
      balance: parseFloat(user.balance),
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch all users:', error);
    throw error;
  }
};