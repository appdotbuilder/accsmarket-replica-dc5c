import { db } from '../db';
import { listingsTable } from '../db/schema';
import { type Listing } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSellerListings(sellerId: number): Promise<Listing[]> {
  try {
    // Fetch all listings for the seller, excluding encrypted credentials
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
      updated_at: listingsTable.updated_at
    })
    .from(listingsTable)
    .where(eq(listingsTable.seller_id, sellerId))
    .execute();

    // Convert numeric price fields back to numbers and add empty encrypted_credentials
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price),
      encrypted_credentials: '' // Exclude from response for security
    }));
  } catch (error) {
    console.error('Failed to fetch seller listings:', error);
    throw error;
  }
}