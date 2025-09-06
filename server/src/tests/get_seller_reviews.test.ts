import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable, reviewsTable } from '../db/schema';
import { getSellerReviews } from '../handlers/get_seller_reviews';
import { eq } from 'drizzle-orm';

describe('getSellerReviews', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch reviews for a seller', async () => {
    // Create test users
    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create test listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'A test gaming account',
        platform: 'steam',
        category: 'Gaming',
        price: '50.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();

    // Create test transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '50.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create test review
    const [review] = await db.insert(reviewsTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        rating: 5,
        comment: 'Excellent seller, quick delivery!'
      })
      .returning()
      .execute();

    const result = await getSellerReviews(seller.id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(review.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].transaction_id).toEqual(transaction.id);
    expect(result[0].rating).toEqual(5);
    expect(result[0].comment).toEqual('Excellent seller, quick delivery!');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return multiple reviews for a seller', async () => {
    // Create test users
    const [buyer1] = await db.insert(usersTable)
      .values({
        email: 'buyer1@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    const [buyer2] = await db.insert(usersTable)
      .values({
        email: 'buyer2@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create test listings
    const [listing1] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Steam Account',
        description: 'Gaming account',
        platform: 'steam',
        category: 'Gaming',
        price: '30.00',
        encrypted_credentials: 'encrypted_creds_1'
      })
      .returning()
      .execute();

    const [listing2] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Epic Games Account',
        description: 'Another gaming account',
        platform: 'epic_games',
        category: 'Gaming',
        price: '40.00',
        encrypted_credentials: 'encrypted_creds_2'
      })
      .returning()
      .execute();

    // Create test transactions
    const [transaction1] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer1.id,
        seller_id: seller.id,
        listing_id: listing1.id,
        amount: '30.00',
        payment_method: 'paypal',
        status: 'completed'
      })
      .returning()
      .execute();

    const [transaction2] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer2.id,
        seller_id: seller.id,
        listing_id: listing2.id,
        amount: '40.00',
        payment_method: 'crypto',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create test reviews
    await db.insert(reviewsTable)
      .values([
        {
          transaction_id: transaction1.id,
          buyer_id: buyer1.id,
          seller_id: seller.id,
          rating: 4,
          comment: 'Good seller'
        },
        {
          transaction_id: transaction2.id,
          buyer_id: buyer2.id,
          seller_id: seller.id,
          rating: 5,
          comment: 'Amazing service!'
        }
      ])
      .execute();

    const result = await getSellerReviews(seller.id);

    expect(result).toHaveLength(2);
    expect(result.every(review => review.seller_id === seller.id)).toBe(true);
    
    const ratings = result.map(r => r.rating).sort();
    expect(ratings).toEqual([4, 5]);

    const comments = result.map(r => r.comment).sort();
    expect(comments).toEqual(['Amazing service!', 'Good seller']);
  });

  it('should return empty array for seller with no reviews', async () => {
    // Create seller with no reviews
    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    const result = await getSellerReviews(seller.id);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should only return reviews for the specified seller', async () => {
    // Create multiple sellers
    const [seller1] = await db.insert(usersTable)
      .values({
        email: 'seller1@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    const [seller2] = await db.insert(usersTable)
      .values({
        email: 'seller2@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    // Create listings for both sellers
    const [listing1] = await db.insert(listingsTable)
      .values({
        seller_id: seller1.id,
        title: 'Account 1',
        description: 'First account',
        platform: 'steam',
        category: 'Gaming',
        price: '25.00',
        encrypted_credentials: 'encrypted_creds_1'
      })
      .returning()
      .execute();

    const [listing2] = await db.insert(listingsTable)
      .values({
        seller_id: seller2.id,
        title: 'Account 2',
        description: 'Second account',
        platform: 'origin',
        category: 'Gaming',
        price: '35.00',
        encrypted_credentials: 'encrypted_creds_2'
      })
      .returning()
      .execute();

    // Create transactions for both sellers
    const [transaction1] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller1.id,
        listing_id: listing1.id,
        amount: '25.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();

    const [transaction2] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller2.id,
        listing_id: listing2.id,
        amount: '35.00',
        payment_method: 'paypal',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create reviews for both sellers
    await db.insert(reviewsTable)
      .values([
        {
          transaction_id: transaction1.id,
          buyer_id: buyer.id,
          seller_id: seller1.id,
          rating: 3,
          comment: 'Review for seller 1'
        },
        {
          transaction_id: transaction2.id,
          buyer_id: buyer.id,
          seller_id: seller2.id,
          rating: 4,
          comment: 'Review for seller 2'
        }
      ])
      .execute();

    // Fetch reviews for seller1 only
    const result = await getSellerReviews(seller1.id);

    expect(result).toHaveLength(1);
    expect(result[0].seller_id).toEqual(seller1.id);
    expect(result[0].comment).toEqual('Review for seller 1');
    expect(result[0].rating).toEqual(3);
  });

  it('should handle reviews with null comments', async () => {
    // Create test users
    const [buyer] = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer'
      })
      .returning()
      .execute();

    const [seller] = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller'
      })
      .returning()
      .execute();

    // Create test listing
    const [listing] = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'A test account',
        platform: 'discord',
        category: 'Social',
        price: '15.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();

    // Create test transaction
    const [transaction] = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '15.00',
        payment_method: 'bank_transfer',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create review with null comment
    await db.insert(reviewsTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        rating: 2,
        comment: null
      })
      .execute();

    const result = await getSellerReviews(seller.id);

    expect(result).toHaveLength(1);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].rating).toEqual(2);
    expect(result[0].comment).toBeNull();
  });
});