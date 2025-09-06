import { db } from '../db';
import { listingsTable } from '../db/schema';
import { type SearchListingsInput, type Listing } from '../schema';
import { and, eq, gte, lte, ilike, desc, asc, type SQL } from 'drizzle-orm';

export const getListings = async (input?: SearchListingsInput): Promise<Listing[]> => {
  try {
    // Handle defaults manually
    const filters = {
      limit: input?.limit ?? 20,
      offset: input?.offset ?? 0,
      query: input?.query,
      platform: input?.platform,
      category: input?.category,
      min_price: input?.min_price,
      max_price: input?.max_price,
      min_followers: input?.min_followers,
      max_followers: input?.max_followers,
      min_age_months: input?.min_age_months,
      max_age_months: input?.max_age_months,
      sort_by: input?.sort_by
    };

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Always filter for active listings only (public browsing)
    conditions.push(eq(listingsTable.status, 'active'));

    // Text search in title and description
    if (filters.query) {
      conditions.push(
        ilike(listingsTable.title, `%${filters.query}%`)
      );
    }

    // Platform filter
    if (filters.platform) {
      conditions.push(eq(listingsTable.platform, filters.platform));
    }

    // Category filter
    if (filters.category) {
      conditions.push(eq(listingsTable.category, filters.category));
    }

    // Price range filters
    if (filters.min_price !== undefined) {
      conditions.push(gte(listingsTable.price, filters.min_price.toString()));
    }

    if (filters.max_price !== undefined) {
      conditions.push(lte(listingsTable.price, filters.max_price.toString()));
    }

    // Follower count range filters
    if (filters.min_followers !== undefined) {
      conditions.push(gte(listingsTable.follower_count, filters.min_followers));
    }

    if (filters.max_followers !== undefined) {
      conditions.push(lte(listingsTable.follower_count, filters.max_followers));
    }

    // Account age range filters
    if (filters.min_age_months !== undefined) {
      conditions.push(gte(listingsTable.account_age_months, filters.min_age_months));
    }

    if (filters.max_age_months !== undefined) {
      conditions.push(lte(listingsTable.account_age_months, filters.max_age_months));
    }

    // Build query with proper chaining
    let query = db.select().from(listingsTable);

    // Apply where conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Determine sort order
    let orderColumn;
    let orderDirection: 'asc' | 'desc' = 'desc';

    switch (filters.sort_by) {
      case 'price_asc':
        orderColumn = listingsTable.price;
        orderDirection = 'asc';
        break;
      case 'price_desc':
        orderColumn = listingsTable.price;
        orderDirection = 'desc';
        break;
      case 'followers_desc':
        orderColumn = listingsTable.follower_count;
        orderDirection = 'desc';
        break;
      case 'age_desc':
        orderColumn = listingsTable.account_age_months;
        orderDirection = 'desc';
        break;
      case 'created_desc':
      default:
        orderColumn = listingsTable.created_at;
        orderDirection = 'desc';
        break;
    }

    // Apply ordering
    query = orderDirection === 'asc' 
      ? query.orderBy(asc(orderColumn)) as typeof query
      : query.orderBy(desc(orderColumn)) as typeof query;

    // Apply pagination
    query = query.limit(filters.limit).offset(filters.offset) as typeof query;

    const results = await query.execute();

    // Convert numeric fields back to numbers
    return results.map(listing => ({
      ...listing,
      price: parseFloat(listing.price)
    }));

  } catch (error) {
    console.error('Failed to fetch listings:', error);
    throw error;
  }
};