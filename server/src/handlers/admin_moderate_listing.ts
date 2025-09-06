import { db } from '../db';
import { listingsTable } from '../db/schema';
import { type Listing } from '../schema';
import { eq } from 'drizzle-orm';

export async function adminModerateListing(
  listingId: number, 
  status: 'active' | 'removed', 
  adminNotes?: string
): Promise<Listing | null> {
  try {
    // First, check if the listing exists
    const existingListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId))
      .execute();

    if (existingListing.length === 0) {
      return null;
    }

    // Update the listing with new status and admin notes
    const updateData: any = {
      status,
      updated_at: new Date()
    };

    // Note: Since there's no admin_notes column in listingsTable,
    // we'll focus on updating the status. In a real implementation,
    // you might want to create an audit log table for admin actions.

    const result = await db.update(listingsTable)
      .set(updateData)
      .where(eq(listingsTable.id, listingId))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers
    const listing = result[0];
    return {
      ...listing,
      price: parseFloat(listing.price)
    };
  } catch (error) {
    console.error('Admin moderation failed:', error);
    throw error;
  }
}