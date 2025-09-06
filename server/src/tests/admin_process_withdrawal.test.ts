import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { withdrawalRequestsTable, usersTable } from '../db/schema';
import { adminProcessWithdrawal } from '../handlers/admin_process_withdrawal';
import { eq } from 'drizzle-orm';

describe('adminProcessWithdrawal', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should approve a pending withdrawal request and deduct from seller balance', async () => {
    // Create a seller user with sufficient balance
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create a withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Process the withdrawal (approve it)
    const result = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'approved',
      'Withdrawal approved by admin'
    );

    // Verify the withdrawal request was updated
    expect(result).toBeDefined();
    expect(result!.status).toEqual('approved');
    expect(result!.admin_notes).toEqual('Withdrawal approved by admin');
    expect(result!.amount).toEqual(100.00);
    expect(typeof result!.amount).toBe('number');

    // Verify seller's balance was reduced
    const updatedSellers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();

    expect(updatedSellers).toHaveLength(1);
    expect(parseFloat(updatedSellers[0].balance)).toEqual(400.00);
    expect(updatedSellers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should reject a withdrawal request without affecting seller balance', async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create a withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Process the withdrawal (reject it)
    const result = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'rejected',
      'Insufficient documentation provided'
    );

    // Verify the withdrawal request was updated
    expect(result).toBeDefined();
    expect(result!.status).toEqual('rejected');
    expect(result!.admin_notes).toEqual('Insufficient documentation provided');
    expect(result!.amount).toEqual(100.00);

    // Verify seller's balance was NOT reduced
    const updatedSellers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();

    expect(updatedSellers).toHaveLength(1);
    expect(parseFloat(updatedSellers[0].balance)).toEqual(500.00);
  });

  it('should mark withdrawal as completed and set processed_at date', async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create an approved withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'approved'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Mark withdrawal as completed
    const result = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'completed',
      'Payment processed successfully'
    );

    // Verify the withdrawal request was updated
    expect(result).toBeDefined();
    expect(result!.status).toEqual('completed');
    expect(result!.admin_notes).toEqual('Payment processed successfully');
    expect(result!.processed_at).toBeInstanceOf(Date);

    // Verify in database
    const updatedWithdrawals = await db.select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.id, withdrawalRequest.id))
      .execute();

    expect(updatedWithdrawals).toHaveLength(1);
    expect(updatedWithdrawals[0].status).toEqual('completed');
    expect(updatedWithdrawals[0].processed_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent withdrawal request', async () => {
    const result = await adminProcessWithdrawal(999, 'approved', 'Test');

    expect(result).toBeNull();
  });

  it('should throw error when seller has insufficient balance for approval', async () => {
    // Create a seller user with insufficient balance
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '50.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create a withdrawal request for more than available balance
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Attempt to approve the withdrawal
    await expect(
      adminProcessWithdrawal(withdrawalRequest.id, 'approved', 'Test approval')
    ).rejects.toThrow(/insufficient seller balance/i);

    // Verify seller balance unchanged
    const sellers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();

    expect(parseFloat(sellers[0].balance)).toEqual(50.00);
  });

  it('should handle multiple status changes correctly', async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create a withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // First approve the withdrawal
    const approvedResult = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'approved',
      'Initial approval'
    );

    expect(approvedResult!.status).toEqual('approved');

    // Then mark it as completed
    const completedResult = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'completed',
      'Payment sent'
    );

    expect(completedResult!.status).toEqual('completed');
    expect(completedResult!.processed_at).toBeInstanceOf(Date);
  });

  it('should handle processing without admin notes', async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create a withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Process without admin notes
    const result = await adminProcessWithdrawal(withdrawalRequest.id, 'rejected');

    expect(result).toBeDefined();
    expect(result!.status).toEqual('rejected');
    expect(result!.admin_notes).toBeNull();
  });

  it('should not deduct balance when approving already approved withdrawal', async () => {
    // Create a seller user
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashed_password',
        role: 'seller',
        balance: '500.00'
      })
      .returning()
      .execute();
    
    const seller = sellerResult[0];

    // Create an already approved withdrawal request
    const withdrawalResult = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: seller.id,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'encrypted_paypal_details',
        status: 'approved'
      })
      .returning()
      .execute();

    const withdrawalRequest = withdrawalResult[0];

    // Try to approve it again (should not deduct balance again)
    const result = await adminProcessWithdrawal(
      withdrawalRequest.id,
      'approved',
      'Already approved'
    );

    expect(result).toBeDefined();
    expect(result!.status).toEqual('approved');

    // Verify seller's balance was NOT deducted again
    const updatedSellers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, seller.id))
      .execute();

    expect(parseFloat(updatedSellers[0].balance)).toEqual(500.00);
  });
});