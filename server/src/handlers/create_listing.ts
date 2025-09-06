import { db } from '../db';
import { listingsTable, usersTable } from '../db/schema';
import { type CreateListingInput, type Listing } from '../schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

export const createListing = async (input: CreateListingInput): Promise<Listing> => {
  try {
    // First, verify that the seller exists and is verified
    const seller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.seller_id))
      .execute();

    if (seller.length === 0) {
      throw new Error('Seller not found');
    }

    if (!seller[0].is_verified) {
      throw new Error('Seller must be verified to create listings');
    }

    // Simple encryption simulation - in production, use proper encryption
    const encryptedCredentials = Buffer.from(input.credentials).toString('base64');

    // Insert the listing
    const result = await db.insert(listingsTable)
      .values({
        seller_id: input.seller_id,
        title: input.title,
        description: input.description,
        platform: input.platform,
        category: input.category,
        price: input.price.toString(), // Convert number to string for numeric column
        follower_count: input.follower_count,
        account_age_months: input.account_age_months,
        encrypted_credentials: encryptedCredentials,
        status: 'under_review' // New listings need admin review
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const listing = result[0];
    return {
      ...listing,
      price: parseFloat(listing.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Listing creation failed:', error);
    throw error;
  }
};