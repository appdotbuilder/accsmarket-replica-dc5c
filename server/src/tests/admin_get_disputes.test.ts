import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  listingsTable, 
  transactionsTable, 
  disputesTable 
} from '../db/schema';
import { adminGetDisputes } from '../handlers/admin_get_disputes';
import { eq } from 'drizzle-orm';

// Helper function to create test data
const createTestData = async () => {
  // Create buyer user
  const [buyer] = await db.insert(usersTable)
    .values({
      email: 'buyer@test.com',
      password_hash: 'hashedpassword',
      role: 'buyer'
    })
    .returning()
    .execute();

  // Create seller user
  const [seller] = await db.insert(usersTable)
    .values({
      email: 'seller@test.com',
      password_hash: 'hashedpassword',
      role: 'seller'
    })
    .returning()
    .execute();

  // Create listing
  const [listing] = await db.insert(listingsTable)
    .values({
      seller_id: seller.id,
      title: 'Test Account',
      description: 'A test account for dispute',
      platform: 'instagram',
      category: 'gaming',
      price: '99.99',
      encrypted_credentials: 'encrypted_creds'
    })
    .returning()
    .execute();

  // Create transaction
  const [transaction] = await db.insert(transactionsTable)
    .values({
      buyer_id: buyer.id,
      seller_id: seller.id,
      listing_id: listing.id,
      amount: '99.99',
      platform_fee: '4.99',
      payment_method: 'paypal',
      status: 'disputed'
    })
    .returning()
    .execute();

  return { buyer, seller, listing, transaction };
};

describe('adminGetDisputes', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no disputes exist', async () => {
    const result = await adminGetDisputes();
    expect(result).toEqual([]);
  });

  it('should fetch all disputes', async () => {
    const { buyer, seller, transaction } = await createTestData();

    // Create multiple disputes
    await db.insert(disputesTable)
      .values([
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'Account not as described',
          description: 'The account does not match the listing description',
          status: 'open'
        },
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'Credentials invalid',
          description: 'Login credentials do not work',
          status: 'in_review'
        }
      ])
      .execute();

    const result = await adminGetDisputes();

    expect(result).toHaveLength(2);
    
    // Verify first dispute
    expect(result[0].transaction_id).toEqual(transaction.id);
    expect(result[0].buyer_id).toEqual(buyer.id);
    expect(result[0].seller_id).toEqual(seller.id);
    expect(result[0].reason).toEqual('Account not as described');
    expect(result[0].description).toEqual('The account does not match the listing description');
    expect(result[0].status).toEqual('open');
    expect(result[0].admin_notes).toBeNull();
    expect(result[0].resolved_at).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeNull();

    // Verify second dispute
    expect(result[1].reason).toEqual('Credentials invalid');
    expect(result[1].status).toEqual('in_review');
  });

  it('should return disputes with proper date types', async () => {
    const { buyer, seller, transaction } = await createTestData();

    // Create dispute with resolved date
    const resolvedDate = new Date('2024-01-15T10:30:00Z');
    await db.insert(disputesTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reason: 'Test dispute',
        description: 'Test description',
        status: 'resolved',
        admin_notes: 'Resolved by admin',
        resolved_at: resolvedDate
      })
      .execute();

    const result = await adminGetDisputes();

    expect(result).toHaveLength(1);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].resolved_at).toBeInstanceOf(Date);
    expect(result[0].resolved_at?.getTime()).toEqual(resolvedDate.getTime());
    expect(result[0].admin_notes).toEqual('Resolved by admin');
    expect(result[0].status).toEqual('resolved');
  });

  it('should handle disputes with all status types', async () => {
    const { buyer, seller, transaction } = await createTestData();

    // Create disputes with different statuses
    await db.insert(disputesTable)
      .values([
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'Open dispute',
          description: 'Open dispute description',
          status: 'open'
        },
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'In review dispute',
          description: 'In review dispute description',
          status: 'in_review'
        },
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'Resolved dispute',
          description: 'Resolved dispute description',
          status: 'resolved'
        },
        {
          transaction_id: transaction.id,
          buyer_id: buyer.id,
          seller_id: seller.id,
          reason: 'Closed dispute',
          description: 'Closed dispute description',
          status: 'closed'
        }
      ])
      .execute();

    const result = await adminGetDisputes();

    expect(result).toHaveLength(4);
    
    const statuses = result.map(dispute => dispute.status).sort();
    expect(statuses).toEqual(['closed', 'in_review', 'open', 'resolved']);
  });

  it('should return disputes ordered by creation date', async () => {
    const { buyer, seller, transaction } = await createTestData();

    // Create disputes at different times
    const firstDispute = await db.insert(disputesTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reason: 'First dispute',
        description: 'First dispute description',
        status: 'open'
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondDispute = await db.insert(disputesTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reason: 'Second dispute',
        description: 'Second dispute description',
        status: 'open'
      })
      .returning()
      .execute();

    const result = await adminGetDisputes();

    expect(result).toHaveLength(2);
    // Should be ordered by creation date (first created first)
    expect(result[0].created_at.getTime()).toBeLessThanOrEqual(result[1].created_at.getTime());
    expect(result[0].reason).toEqual('First dispute');
    expect(result[1].reason).toEqual('Second dispute');
  });

  it('should handle disputes with updated_at timestamps', async () => {
    const { buyer, seller, transaction } = await createTestData();

    // Create dispute
    const [dispute] = await db.insert(disputesTable)
      .values({
        transaction_id: transaction.id,
        buyer_id: buyer.id,
        seller_id: seller.id,
        reason: 'Test dispute',
        description: 'Test description',
        status: 'open'
      })
      .returning()
      .execute();

    // Update the dispute to set updated_at
    const updatedDate = new Date();
    await db.update(disputesTable)
      .set({ 
        status: 'in_review',
        updated_at: updatedDate
      })
      .where(eq(disputesTable.id, dispute.id))
      .execute();

    const result = await adminGetDisputes();

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('in_review');
    expect(result[0].updated_at).toBeInstanceOf(Date);
    expect(result[0].updated_at?.getTime()).toBeCloseTo(updatedDate.getTime(), -2); // Within 100ms
  });
});