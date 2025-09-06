import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, withdrawalRequestsTable } from '../db/schema';
import { type CreateWithdrawalRequestInput } from '../schema';
import { createWithdrawalRequest } from '../handlers/create_withdrawal_request';
import { eq } from 'drizzle-orm';

// Test seller data
const testSeller = {
  email: 'seller@test.com',
  password_hash: 'hashed_password',
  role: 'seller' as const,
  is_verified: true,
  balance: '500.00' // String for database, seller has $500 balance
};

// Test input for withdrawal request
const testWithdrawalInput: CreateWithdrawalRequestInput = {
  seller_id: 0, // Will be set after creating seller
  amount: 100.50,
  payment_method: 'paypal',
  payment_details: 'seller@paypal.com'
};

describe('createWithdrawalRequest', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a withdrawal request successfully', async () => {
    // Create test seller first
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Create withdrawal request
    const input = { ...testWithdrawalInput, seller_id: seller.id };
    const result = await createWithdrawalRequest(input);

    // Verify all fields are correct
    expect(result.seller_id).toEqual(seller.id);
    expect(result.amount).toEqual(100.50);
    expect(typeof result.amount).toBe('number');
    expect(result.payment_method).toEqual('paypal');
    expect(result.status).toEqual('pending');
    expect(result.admin_notes).toBeNull();
    expect(result.processed_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify payment details are encrypted (base64 encoded)
    expect(result.payment_details).not.toEqual('seller@paypal.com');
    expect(result.payment_details.length).toBeGreaterThan(0);
  });

  it('should save withdrawal request to database', async () => {
    // Create test seller first
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Create withdrawal request
    const input = { ...testWithdrawalInput, seller_id: seller.id };
    const result = await createWithdrawalRequest(input);

    // Query database to verify it was saved
    const withdrawalRequests = await db.select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.id, result.id))
      .execute();

    expect(withdrawalRequests).toHaveLength(1);
    const dbWithdrawal = withdrawalRequests[0];
    
    expect(dbWithdrawal.seller_id).toEqual(seller.id);
    expect(parseFloat(dbWithdrawal.amount)).toEqual(100.50);
    expect(dbWithdrawal.payment_method).toEqual('paypal');
    expect(dbWithdrawal.status).toEqual('pending');
    expect(dbWithdrawal.created_at).toBeInstanceOf(Date);
  });

  it('should reject withdrawal request when seller does not exist', async () => {
    const input = { ...testWithdrawalInput, seller_id: 999 };
    
    await expect(createWithdrawalRequest(input)).rejects.toThrow(/seller not found/i);
  });

  it('should reject withdrawal request when insufficient balance', async () => {
    // Create seller with low balance
    const lowBalanceSeller = {
      ...testSeller,
      balance: '50.00' // Only $50 balance
    };
    
    const sellerResult = await db.insert(usersTable)
      .values(lowBalanceSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Try to withdraw more than available balance
    const input = { 
      ...testWithdrawalInput, 
      seller_id: seller.id,
      amount: 100.50 // Requesting more than $50 balance
    };
    
    await expect(createWithdrawalRequest(input)).rejects.toThrow(/insufficient balance/i);
  });

  it('should handle maximum withdrawal amount correctly', async () => {
    // Create seller with exact balance
    const exactBalanceSeller = {
      ...testSeller,
      balance: '100.50'
    };
    
    const sellerResult = await db.insert(usersTable)
      .values(exactBalanceSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Withdraw exact balance amount
    const input = { 
      ...testWithdrawalInput, 
      seller_id: seller.id,
      amount: 100.50
    };
    
    const result = await createWithdrawalRequest(input);
    
    expect(result.amount).toEqual(100.50);
    expect(result.status).toEqual('pending');
  });

  it('should encrypt payment details correctly', async () => {
    // Create test seller
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Create withdrawal request with specific payment details
    const paymentDetails = 'test-bank-account-123456';
    const input = { 
      ...testWithdrawalInput, 
      seller_id: seller.id,
      payment_details: paymentDetails
    };
    
    const result = await createWithdrawalRequest(input);

    // Verify encryption (base64 encoding)
    expect(result.payment_details).not.toEqual(paymentDetails);
    
    // Verify we can decrypt it back
    const decrypted = Buffer.from(result.payment_details, 'base64').toString();
    expect(decrypted).toEqual(paymentDetails);
  });

  it('should handle different payment methods', async () => {
    // Create test seller
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Test crypto payment method
    const cryptoInput = {
      seller_id: seller.id,
      amount: 75.25,
      payment_method: 'crypto',
      payment_details: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
    };
    
    const result = await createWithdrawalRequest(cryptoInput);
    
    expect(result.payment_method).toEqual('crypto');
    expect(result.amount).toEqual(75.25);
    expect(result.status).toEqual('pending');
  });

  it('should handle decimal amounts correctly', async () => {
    // Create test seller
    const sellerResult = await db.insert(usersTable)
      .values(testSeller)
      .returning()
      .execute();
    
    const seller = sellerResult[0];
    
    // Test with precise decimal amount
    const input = { 
      ...testWithdrawalInput, 
      seller_id: seller.id,
      amount: 99.99
    };
    
    const result = await createWithdrawalRequest(input);
    
    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toBe('number');
    
    // Verify in database as well
    const dbWithdrawal = await db.select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.id, result.id))
      .execute();
    
    expect(parseFloat(dbWithdrawal[0].amount)).toEqual(99.99);
  });
});