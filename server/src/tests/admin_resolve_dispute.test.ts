import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, listingsTable, transactionsTable, disputesTable } from '../db/schema';
import { adminResolveDispute } from '../handlers/admin_resolve_dispute';
import { eq } from 'drizzle-orm';

describe('adminResolveDispute', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create buyer user
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashed_password',
        role: 'buyer',
        balance: '50.00'
      })
      .returning()
      .execute();
    const buyer = buyerResult[0];

    // Create seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '0.00'
      })
      .returning()
      .execute();
    const seller = sellerResult[0];

    // Create listing
    const listingResult = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Test Account',
        description: 'A test account for dispute resolution',
        platform: 'instagram',
        category: 'Social Media',
        price: '100.00',
        encrypted_credentials: 'encrypted_creds'
      })
      .returning()
      .execute();
    const listing = listingResult[0];

    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        amount: '100.00',
        platform_fee: '10.00',
        payment_method: 'credit_card',
        status: 'disputed'
      })
      .returning()
      .execute();
    const transaction = transactionResult[0];

    // Create dispute
    const disputeResult = await db.insert(disputesTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reason: 'Account not working',
        description: 'The account credentials do not work',
        status: 'open'
      })
      .returning()
      .execute();
    const dispute = disputeResult[0];

    return { buyer, seller, listing, transaction, dispute };
  };

  it('should resolve dispute in buyer favor with full refund', async () => {
    const { buyer, seller, dispute } = await createTestData();

    const result = await adminResolveDispute(
      dispute.id,
      'buyer_favor',
      'Seller provided non-working credentials'
    );

    expect(result).toBeDefined();
    expect(result?.status).toEqual('resolved');
    expect(result?.admin_notes).toEqual('Seller provided non-working credentials');
    expect(result?.resolved_at).toBeInstanceOf(Date);

    // Check buyer balance increased by $100
    const updatedBuyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, buyer.id))
      .execute();
    expect(parseFloat(updatedBuyer[0].balance)).toEqual(150.00); // 50 + 100 refund

    // Check seller balance remains 0
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();
    expect(parseFloat(updatedSeller[0].balance)).toEqual(0.00);

    // Check transaction status updated to refunded
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, dispute.transaction_id))
      .execute();
    expect(updatedTransaction[0].status).toEqual('refunded');
  });

  it('should resolve dispute in seller favor', async () => {
    const { buyer, seller, dispute } = await createTestData();

    const result = await adminResolveDispute(
      dispute.id,
      'seller_favor',
      'Buyer complaint was invalid'
    );

    expect(result).toBeDefined();
    expect(result?.status).toEqual('resolved');
    expect(result?.admin_notes).toEqual('Buyer complaint was invalid');

    // Check buyer balance unchanged
    const updatedBuyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, buyer.id))
      .execute();
    expect(parseFloat(updatedBuyer[0].balance)).toEqual(50.00);

    // Check seller balance increased by $90 (100 - 10 platform fee)
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();
    expect(parseFloat(updatedSeller[0].balance)).toEqual(90.00);

    // Check transaction status updated to completed
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, dispute.transaction_id))
      .execute();
    expect(updatedTransaction[0].status).toEqual('completed');
  });

  it('should resolve dispute with partial refund', async () => {
    const { buyer, seller, dispute } = await createTestData();

    const result = await adminResolveDispute(
      dispute.id,
      'partial_refund',
      'Both parties partially at fault',
      60.00 // $60 refund to buyer
    );

    expect(result).toBeDefined();
    expect(result?.status).toEqual('resolved');
    expect(result?.admin_notes).toEqual('Both parties partially at fault');

    // Check buyer balance increased by $60
    const updatedBuyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, buyer.id))
      .execute();
    expect(parseFloat(updatedBuyer[0].balance)).toEqual(110.00); // 50 + 60 refund

    // Check seller balance increased by $30 (100 - 60 refund - 10 platform fee)
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();
    expect(parseFloat(updatedSeller[0].balance)).toEqual(30.00);

    // Check transaction status updated to completed
    const updatedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, dispute.transaction_id))
      .execute();
    expect(updatedTransaction[0].status).toEqual('completed');
  });

  it('should return null for non-existent dispute', async () => {
    const result = await adminResolveDispute(
      999999,
      'buyer_favor',
      'Non-existent dispute'
    );

    expect(result).toBeNull();
  });

  it('should throw error for already resolved dispute', async () => {
    const { dispute } = await createTestData();

    // First resolve the dispute
    await adminResolveDispute(
      dispute.id,
      'buyer_favor',
      'First resolution'
    );

    // Try to resolve again
    await expect(adminResolveDispute(
      dispute.id,
      'seller_favor',
      'Second resolution'
    )).rejects.toThrow(/already resolved/i);
  });

  it('should throw error for invalid partial refund amount', async () => {
    const { dispute } = await createTestData();

    // Test negative refund amount
    await expect(adminResolveDispute(
      dispute.id,
      'partial_refund',
      'Invalid refund',
      -10.00
    )).rejects.toThrow(/Invalid refund amount/i);

    // Test refund amount greater than transaction amount
    await expect(adminResolveDispute(
      dispute.id,
      'partial_refund',
      'Invalid refund',
      150.00
    )).rejects.toThrow(/Invalid refund amount/i);
  });

  it('should throw error for partial refund without refund amount', async () => {
    const { dispute } = await createTestData();

    await expect(adminResolveDispute(
      dispute.id,
      'partial_refund',
      'Missing refund amount'
      // No refundAmount parameter
    )).rejects.toThrow(/Invalid refund amount/i);
  });

  it('should handle zero partial refund correctly', async () => {
    const { buyer, seller, dispute } = await createTestData();

    const result = await adminResolveDispute(
      dispute.id,
      'partial_refund',
      'No refund warranted',
      0.00
    );

    expect(result).toBeDefined();
    expect(result?.status).toEqual('resolved');

    // Check buyer balance unchanged
    const updatedBuyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, buyer.id))
      .execute();
    expect(parseFloat(updatedBuyer[0].balance)).toEqual(50.00);

    // Check seller gets full amount minus platform fee
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();
    expect(parseFloat(updatedSeller[0].balance)).toEqual(90.00);
  });

  it('should handle full refund as partial refund correctly', async () => {
    const { buyer, seller, dispute } = await createTestData();

    const result = await adminResolveDispute(
      dispute.id,
      'partial_refund',
      'Full refund via partial',
      100.00
    );

    expect(result).toBeDefined();
    expect(result?.status).toEqual('resolved');

    // Check buyer gets full refund
    const updatedBuyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, buyer.id))
      .execute();
    expect(parseFloat(updatedBuyer[0].balance)).toEqual(150.00);

    // Check seller gets nothing (100 - 100 refund - 10 platform fee = -10, but minimum is 0)
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();
    expect(parseFloat(updatedSeller[0].balance)).toEqual(0.00); // Can't go negative
  });
});