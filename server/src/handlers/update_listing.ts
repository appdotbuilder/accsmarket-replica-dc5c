import { db } from '../db';
import { listingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateListingInput, type Listing } from '../schema';

export const updateListing = async (input: UpdateListingInput): Promise<Listing | null> => {
  try {
    // First, get the current listing to verify it exists and get seller_id
    const currentListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, input.id))
      .execute();

    if (currentListing.length === 0) {
      return null; // Listing not found
    }

    // Build the update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.price !== undefined) {
      updateData.price = input.price.toString(); // Convert number to string for numeric column
    }

    if (input.follower_count !== undefined) {
      updateData.follower_count = input.follower_count;
    }

    if (input.account_age_months !== undefined) {
      updateData.account_age_months = input.account_age_months;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    // Update the listing
    const result = await db.update(listingsTable)
      .set(updateData)
      .where(eq(listingsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const updatedListing = result[0];
    return {
      ...updatedListing,
      price: parseFloat(updatedListing.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Listing update failed:', error);
    throw error;
  }
};