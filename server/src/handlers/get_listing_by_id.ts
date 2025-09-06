import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type Listing } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getListingById = async (id: number): Promise<Listing | null> => {
  try {
    // Query listing with seller information, excluding credentials and sensitive data
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
      status: listingsTable.status,
      created_at: listingsTable.created_at,
      updated_at: listingsTable.updated_at,
      // Note: Intentionally excluding encrypted_credentials for security
    })
    .from(listingsTable)
    .innerJoin(usersTable, eq(listingsTable.seller_id, usersTable.id))
    .where(
      and(
        eq(listingsTable.id, id),
        eq(listingsTable.status, 'active') // Only return active listings
      )
    )
    .execute();

    if (results.length === 0) {
      return null;
    }

    const listing = results[0];
    
    // Convert numeric fields from string to number and add placeholder for encrypted_credentials
    return {
      ...listing,
      price: parseFloat(listing.price),
      encrypted_credentials: '', // Exclude credentials for security
    };
  } catch (error) {
    console.error('Get listing by ID failed:', error);
    throw error;
  }
};