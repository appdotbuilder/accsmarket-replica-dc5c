import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type Listing } from '../schema';
import { eq } from 'drizzle-orm';

export async function adminGetAllListings(): Promise<Listing[]> {
  try {
    // Join with users table to include seller information
    // Exclude encrypted_credentials for security
    const results = await db.select({
      id: listingsTable.id,
      seller_id: listingsTable.seller_id,
      title: listingsTable.title,
      description: listingsTable.description,
      platform: listingsTable.platform,
      category: listingsTable.category,
      price: listingsTable.price,
      follower_count: listingsTable.follower_count,
      account_age_months: listingsTable.account_age_months,
      encrypted_credentials: listingsTable.encrypted_credentials, // Keep for type compatibility but will be filtered
      status: listingsTable.status,
      created_at: listingsTable.created_at,
      updated_at: listingsTable.updated_at
    })
    .from(listingsTable)
    .innerJoin(usersTable, eq(listingsTable.seller_id, usersTable.id))
    .execute();

    // Convert numeric fields and exclude encrypted credentials for security
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price),
      encrypted_credentials: '[REDACTED]' // Hide sensitive data from admin view
    }));
  } catch (error) {
    console.error('Admin get all listings failed:', error);
    throw error;
  }
}