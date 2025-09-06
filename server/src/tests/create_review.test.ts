import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable, reviewsTable } from '../db/schema';
import { type CreateReviewInput } from '../schema';
import { createReview } from '../handlers/create_review';
import { eq } from 'drizzle-orm';

// Test data setup
const testBuyer = {
  email: 'buyer@test.com',
  password_hash: 'hashed_password',
  role: 'buyer' as const,
  is_verified: true,
  balance: '100.00'
};

const testSeller = {
  email: 'seller@test.com',
  password_hash: 'hashed_password',
  role: 'seller' as const,
  is_verified: true,
  balance: '50.00'
};

const testListing = {
  title: 'Test Account',
  description: 'A test account for sale',
  platform: 'instagram' as const,
  category: 'Gaming',
  price: '25.00',
  follower_count: 1000,
  account_age_months: 12,
  encrypted_credentials: 'encrypted_test_credentials',
  status: 'active' as const
};

describe('createReview', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a review for completed transaction', async () => {
    // Create buyer and seller
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    // Create listing
    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    // Create completed transaction
    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '25.00',
        platform_fee: '2.50',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 5,
      comment: 'Great seller, fast delivery!'
    };

    const result = await createReview(reviewInput);

    // Verify review fields
    expect(result.id).toBeDefined();
    expect(result.transaction_id).toEqual(transactionId);
    expect(result.buyer_id).toEqual(buyerId);
    expect(result.seller_id).toEqual(sellerId);
    expect(result.rating).toEqual(5);
    expect(result.comment).toEqual('Great seller, fast delivery!');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save review to database correctly', async () => {
    // Create prerequisite data
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '25.00',
        platform_fee: '2.50',
        payment_method: 'paypal',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 4,
      comment: 'Good experience overall'
    };

    const result = await createReview(reviewInput);

    // Verify in database
    const savedReviews = await db.select()
      .from(reviewsTable)
      .where(eq(reviewsTable.id, result.id))
      .execute();

    expect(savedReviews).toHaveLength(1);
    expect(savedReviews[0].transaction_id).toEqual(transactionId);
    expect(savedReviews[0].buyer_id).toEqual(buyerId);
    expect(savedReviews[0].seller_id).toEqual(sellerId);
    expect(savedReviews[0].rating).toEqual(4);
    expect(savedReviews[0].comment).toEqual('Good experience overall');
  });

  it('should handle null comment correctly', async () => {
    // Create prerequisite data
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '15.00',
        platform_fee: '1.50',
        payment_method: 'crypto',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 3,
      comment: null
    };

    const result = await createReview(reviewInput);

    expect(result.comment).toBeNull();
    expect(result.rating).toEqual(3);
  });

  it('should reject review for non-existent transaction', async () => {
    const reviewInput: CreateReviewInput = {
      transaction_id: 999999,
      buyer_id: 1,
      rating: 5,
      comment: 'This should fail'
    };

    await expect(createReview(reviewInput)).rejects.toThrow(/transaction not found/i);
  });

  it('should reject review from non-buyer of transaction', async () => {
    // Create users
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    // Create another buyer
    const otherBuyers = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        password_hash: 'hashed_password',
        role: 'buyer' as const,
        is_verified: true,
        balance: '75.00'
      })
      .returning()
      .execute();
    const otherBuyerId = otherBuyers[0].id;

    // Create listing and transaction
    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '25.00',
        platform_fee: '2.50',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    // Try to review with different buyer
    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: otherBuyerId,
      rating: 5,
      comment: 'This should fail'
    };

    await expect(createReview(reviewInput)).rejects.toThrow(/does not belong to this buyer/i);
  });

  it('should reject review for incomplete transaction', async () => {
    // Create prerequisite data
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    // Create pending transaction
    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '25.00',
        platform_fee: '2.50',
        payment_method: 'credit_card',
        status: 'pending'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 5,
      comment: 'This should fail'
    };

    await expect(createReview(reviewInput)).rejects.toThrow(/cannot review incomplete transaction/i);
  });

  it('should reject duplicate review for same transaction', async () => {
    // Create prerequisite data
    const buyers = await db.insert(usersTable)
      .values(testBuyer)
      .returning()
      .execute();
    const buyerId = buyers[0].id;

    const sellers = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    const sellerId = sellers[0].id;

    const listings = await db.insert(listingsTable)
      .values({
        ...testListing,
        seller_id: sellerId
      })
      .returning()
      .execute();
    const listingId = listings[0].id;

    const transactions = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '25.00',
        platform_fee: '2.50',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactions[0].id;

    const reviewInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 5,
      comment: 'First review'
    };

    // Create first review
    await createReview(reviewInput);

    // Try to create second review
    const duplicateInput: CreateReviewInput = {
      transaction_id: transactionId,
      buyer_id: buyerId,
      rating: 3,
      comment: 'Duplicate review attempt'
    };

    await expect(createReview(duplicateInput)).rejects.toThrow(/review already exists/i);
  });
});