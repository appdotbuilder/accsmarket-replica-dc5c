import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable } from '../db/schema';
import { getTransactionCredentials } from '../handlers/get_transaction_credentials';
import { eq } from 'drizzle-orm';

describe('getTransactionCredentials', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let buyerId: number;
  let sellerId: number;
  let listingId: number;
  let transactionId: number;

  beforeEach(async () => {
    // Create test buyer
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer',
        balance: '1000.00'
      })
      .returning()
      .execute();
    buyerId = buyerResult[0].id;

    // Create test seller
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '0.00'
      })
      .returning()
      .execute();
    sellerId = sellerResult[0].id;

    // Create test listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Test Instagram Account',
        description: 'A test account for sale',
        platform: 'instagram',
        category: 'lifestyle',
        price: '99.99',
        follower_count: 10000,
        account_age_months: 24,
        encrypted_credentials: 'encrypted:login:password:email:email_password',
        status: 'active'
      })
      .returning()
      .execute();
    listingId = listingResult[0].id;

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
        amount: '99.99',
        platform_fee: '9.99',
        payment_method: 'credit_card',
        status: 'completed'
      })
      .returning()
      .execute();
    transactionId = transactionResult[0].id;
  });

  it('should return credentials for valid completed transaction', async () => {
    const result = await getTransactionCredentials(transactionId, buyerId);

    expect(result).toEqual('encrypted:login:password:email:email_password');

    // Verify credentials_delivered_at was set
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    expect(updatedTransaction[0].credentials_delivered_at).toBeInstanceOf(Date);
    expect(updatedTransaction[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent transaction', async () => {
    const result = await getTransactionCredentials(99999, buyerId);
    expect(result).toBeNull();
  });

  it('should return null when buyer_id does not match transaction buyer', async () => {
    // Create another buyer
    const anotherBuyerResult = await db.insert(usersTable)
      .values({
        email: 'another@test.com',
        password_hash: 'hashed_password',
        role: 'buyer',
        balance: '500.00'
      })
      .returning()
      .execute();

    const result = await getTransactionCredentials(transactionId, anotherBuyerResult[0].id);
    expect(result).toBeNull();
  });

  it('should return null for pending transaction', async () => {
    // Update transaction to pending status
    await db.update(transactionsTable)
      .set({ status: 'pending' })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const result = await getTransactionCredentials(transactionId, buyerId);
    expect(result).toBeNull();
  });

  it('should return null for disputed transaction', async () => {
    // Update transaction to disputed status
    await db.update(transactionsTable)
      .set({ status: 'disputed' })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const result = await getTransactionCredentials(transactionId, buyerId);
    expect(result).toBeNull();
  });

  it('should return null for cancelled transaction', async () => {
    // Update transaction to cancelled status
    await db.update(transactionsTable)
      .set({ status: 'cancelled' })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const result = await getTransactionCredentials(transactionId, buyerId);
    expect(result).toBeNull();
  });

  it('should return null for refunded transaction', async () => {
    // Update transaction to refunded status
    await db.update(transactionsTable)
      .set({ status: 'refunded' })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const result = await getTransactionCredentials(transactionId, buyerId);
    expect(result).toBeNull();
  });

  it('should return null when credentials already delivered', async () => {
    // Mark credentials as already delivered
    const deliveryDate = new Date();
    await db.update(transactionsTable)
      .set({ credentials_delivered_at: deliveryDate })
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const result = await getTransactionCredentials(transactionId, buyerId);
    expect(result).toBeNull();
  });

  it('should handle multiple calls correctly - second call should return null', async () => {
    // First call should succeed
    const firstResult = await getTransactionCredentials(transactionId, buyerId);
    expect(firstResult).toEqual('encrypted:login:password:email:email_password');

    // Second call should return null (credentials already delivered)
    const secondResult = await getTransactionCredentials(transactionId, buyerId);
    expect(secondResult).toBeNull();
  });

  it('should work with different credential formats', async () => {
    // Create another transaction with different credentials
    const listingResult2 = await db.insert(listingsTable)
      .values({
        seller_id: sellerId,
        title: 'Test Twitter Account',
        description: 'Another test account',
        platform: 'twitter',
        category: 'tech',
        price: '149.99',
        follower_count: 5000,
        account_age_months: 12,
        encrypted_credentials: 'different:encrypted:format:here',
        status: 'active'
      })
      .returning()
      .execute();

    const transactionResult2 = await db.insert(transactionsTable)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingResult2[0].id,
        amount: '149.99',
        platform_fee: '14.99',
        payment_method: 'paypal',
        status: 'completed'
      })
      .returning()
      .execute();

    const result = await getTransactionCredentials(transactionResult2[0].id, buyerId);
    expect(result).toEqual('different:encrypted:format:here');
  });

  it('should update transaction timestamps correctly', async () => {
    const beforeCall = new Date();
    
    await getTransactionCredentials(transactionId, buyerId);
    
    const afterCall = new Date();

    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    const deliveredAt = updatedTransaction[0].credentials_delivered_at!;
    const updatedAt = updatedTransaction[0].updated_at!;

    expect(deliveredAt).toBeInstanceOf(Date);
    expect(updatedAt).toBeInstanceOf(Date);
    expect(deliveredAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(deliveredAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });
});