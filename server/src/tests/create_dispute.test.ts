import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, transactionsTable, listingsTable, disputesTable } from '../db/schema';
import { type CreateDisputeInput } from '../schema';
import { createDispute } from '../handlers/create_dispute';
import { eq } from 'drizzle-orm';

// Test input for creating a dispute
const testInput: CreateDisputeInput = {
  transaction_id: 1,
  buyer_id: 1,
  reason: 'Account credentials not working',
  description: 'The provided login credentials for the Instagram account are invalid. I cannot access the account despite following the instructions.'
};

describe('createDispute', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a dispute successfully', async () => {
    // Create prerequisite data
    // Create buyer user
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const buyerId = buyerResult[0].id;

    // Create seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@example.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();
    const sellerId = sellerResult[0].id;

    // Create listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account',
        description: 'High follower account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        follower_count: 10000,
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listingId = listingResult[0].id;

    // Create transaction (recent, within 24 hours)
    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '100.00',
        platform_fee: '5.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactionResult[0].id;

    // Create dispute with the actual IDs
    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: transactionId,
      buyer_id: buyerId
    };

    const result = await createDispute(disputeInput);

    // Verify dispute creation
    expect(result.transaction_id).toEqual(transactionId);
    expect(result.buyer_id).toEqual(buyerId);
    expect(result.seller_id).toEqual(sellerId);
    expect(result.reason).toEqual(testInput.reason);
    expect(result.description).toEqual(testInput.description);
    expect(result.status).toEqual('open');
    expect(result.admin_notes).toBeNull();
    expect(result.resolved_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeNull();
  });

  it('should save dispute to database correctly', async () => {
    // Create prerequisite data
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const buyerId = buyerResult[0].id;

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@example.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();
    const sellerId = sellerResult[0].id;

    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account',
        description: 'High follower account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listingId = listingResult[0].id;

    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '100.00',
        platform_fee: '5.00',
        payment_method: 'paypal',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactionResult[0].id;

    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: transactionId,
      buyer_id: buyerId
    };

    const result = await createDispute(disputeInput);

    // Verify the dispute exists in database
    const disputes = await db.select()
      .from(disputesTable)
      .where(eq(disputesTable.id, result.id))
      .execute();

    expect(disputes).toHaveLength(1);
    expect(disputes[0].transaction_id).toEqual(transactionId);
    expect(disputes[0].buyer_id).toEqual(buyerId);
    expect(disputes[0].seller_id).toEqual(sellerId);
    expect(disputes[0].reason).toEqual(testInput.reason);
    expect(disputes[0].description).toEqual(testInput.description);
    expect(disputes[0].status).toEqual('open');
    expect(disputes[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error if transaction does not exist', async () => {
    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: 999, // Non-existent transaction
      buyer_id: 1
    };

    await expect(createDispute(disputeInput)).rejects.toThrow(/transaction not found/i);
  });

  it('should throw error if transaction does not belong to buyer', async () => {
    // Create prerequisite data
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const buyerId = buyerResult[0].id;

    const anotherBuyerResult = await db.insert(usersTable)
      .values({
        email: 'another_buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const anotherBuyerId = anotherBuyerResult[0].id;

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@example.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();
    const sellerId = sellerResult[0].id;

    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account',
        description: 'High follower account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listingId = listingResult[0].id;

    // Create transaction for one buyer
    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '100.00',
        platform_fee: '5.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactionResult[0].id;

    // Try to create dispute with different buyer
    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: transactionId,
      buyer_id: anotherBuyerId
    };

    await expect(createDispute(disputeInput)).rejects.toThrow(/does not belong to buyer/i);
  });

  it('should throw error if dispute window has expired', async () => {
    // Create prerequisite data
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const buyerId = buyerResult[0].id;

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@example.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();
    const sellerId = sellerResult[0].id;

    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account',
        description: 'High follower account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listingId = listingResult[0].id;

    // Create old transaction (more than 24 hours ago)
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '100.00',
        platform_fee: '5.00',
        payment_method: 'credit_card',
        status: 'completed',
        created_at: oldDate
      })
      .returning()
      .execute();
    const transactionId = transactionResult[0].id;

    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: transactionId,
      buyer_id: buyerId
    };

    await expect(createDispute(disputeInput)).rejects.toThrow(/dispute window has expired/i);
  });

  it('should throw error if dispute already exists for transaction', async () => {
    // Create prerequisite data
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@example.com',
        password_hash: 'hashedpassword',
        role: 'buyer'
      })
      .returning()
      .execute();
    const buyerId = buyerResult[0].id;

    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@example.com',
        password_hash: 'hashedpassword',
        role: 'seller'
      })
      .returning()
      .execute();
    const sellerId = sellerResult[0].id;

    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Instagram Account',
        description: 'High follower account',
        platform: 'instagram',
        category: 'social_media',
        price: '100.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listingId = listingResult[0].id;

    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '100.00',
        platform_fee: '5.00',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    const transactionId = transactionResult[0].id;

    // Create existing dispute
    await db.insert(disputesTable)
      .values({
        transaction_id: transactionId,
        buyer_id: buyerId,
        seller_id: sellerId,
        reason: 'Previous dispute',
        description: 'Already disputed',
        status: 'open'
      })
      .execute();

    const disputeInput: CreateDisputeInput = {
      ...testInput,
      transaction_id: transactionId,
      buyer_id: buyerId
    };

    await expect(createDispute(disputeInput)).rejects.toThrow(/dispute already exists/i);
  });
});