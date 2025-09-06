import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, withdrawalRequestsTable } from '../db/schema';
import { adminGetWithdrawalRequests } from '../handlers/admin_get_withdrawal_requests';
import { type RegisterUserInput, type CreateWithdrawalRequestInput } from '../schema';

// Test user data
const testSeller: RegisterUserInput = {
  email: 'seller@test.com',
  password: 'testpassword123',
  role: 'seller'
};

const testSeller2: RegisterUserInput = {
  email: 'seller2@test.com', 
  password: 'testpassword123',
  role: 'seller'
};

describe('adminGetWithdrawalRequests', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no withdrawal requests exist', async () => {
    const result = await adminGetWithdrawalRequests();
    
    expect(result).toEqual([]);
  });

  it('should fetch all withdrawal requests with proper data types', async () => {
    // Create test seller
    const sellers = await db.insert(usersTable)
      .values({
        email: testSeller.email,
        password_hash: 'hashed_password',
        role: testSeller.role,
        is_verified: true,
        balance: '500.00'
      })
      .returning()
      .execute();

    const sellerId = sellers[0].id;

    // Create test withdrawal request
    const testRequest: CreateWithdrawalRequestInput = {
      seller_id: sellerId,
      amount: 250.75,
      payment_method: 'paypal',
      payment_details: 'seller@paypal.com'
    };

    await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: testRequest.seller_id,
        amount: testRequest.amount.toString(),
        payment_method: testRequest.payment_method,
        payment_details: testRequest.payment_details,
        status: 'pending'
      })
      .execute();

    const result = await adminGetWithdrawalRequests();

    expect(result).toHaveLength(1);
    
    const request = result[0];
    expect(request.seller_id).toEqual(sellerId);
    expect(request.amount).toEqual(250.75);
    expect(typeof request.amount).toBe('number');
    expect(request.payment_method).toEqual('paypal');
    expect(request.payment_details).toEqual('seller@paypal.com');
    expect(request.status).toEqual('pending');
    expect(request.admin_notes).toBeNull();
    expect(request.processed_at).toBeNull();
    expect(request.created_at).toBeInstanceOf(Date);
    expect(request.id).toBeDefined();
  });

  it('should return multiple withdrawal requests ordered by created_at desc', async () => {
    // Create test sellers
    const sellers = await db.insert(usersTable)
      .values([
        {
          email: testSeller.email,
          password_hash: 'hashed_password',
          role: testSeller.role,
          is_verified: true,
          balance: '500.00'
        },
        {
          email: testSeller2.email,
          password_hash: 'hashed_password2',
          role: testSeller2.role,
          is_verified: true,
          balance: '750.00'
        }
      ])
      .returning()
      .execute();

    const sellerId1 = sellers[0].id;
    const sellerId2 = sellers[1].id;

    // Create withdrawal requests with slight delay to ensure different timestamps
    await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: sellerId1,
        amount: '100.00',
        payment_method: 'bank_transfer',
        payment_details: 'Bank Account 123',
        status: 'pending'
      })
      .execute();

    // Add small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: sellerId2,
        amount: '200.50',
        payment_method: 'paypal',
        payment_details: 'seller2@paypal.com',
        status: 'approved'
      })
      .execute();

    const result = await adminGetWithdrawalRequests();

    expect(result).toHaveLength(2);
    
    // Should be ordered by created_at desc (newest first)
    expect(result[0].seller_id).toEqual(sellerId2);
    expect(result[0].amount).toEqual(200.50);
    expect(result[0].status).toEqual('approved');
    
    expect(result[1].seller_id).toEqual(sellerId1);
    expect(result[1].amount).toEqual(100.00);
    expect(result[1].status).toEqual('pending');
    
    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should handle withdrawal requests with all status types', async () => {
    // Create test seller
    const sellers = await db.insert(usersTable)
      .values({
        email: testSeller.email,
        password_hash: 'hashed_password',
        role: testSeller.role,
        is_verified: true,
        balance: '1000.00'
      })
      .returning()
      .execute();

    const sellerId = sellers[0].id;

    // Create requests with different statuses
    const statuses = ['pending', 'approved', 'rejected', 'completed'] as const;
    
    for (let i = 0; i < statuses.length; i++) {
      await db.insert(withdrawalRequestsTable)
        .values({
          seller_id: sellerId,
          amount: (100 + i * 50).toString(),
          payment_method: 'paypal',
          payment_details: `test${i}@paypal.com`,
          status: statuses[i],
          admin_notes: statuses[i] === 'rejected' ? 'Insufficient verification' : null,
          processed_at: statuses[i] === 'completed' ? new Date() : null
        })
        .execute();
      
      // Small delay to ensure different timestamps
      if (i < statuses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const result = await adminGetWithdrawalRequests();

    expect(result).toHaveLength(4);
    
    // Verify all statuses are present
    const returnedStatuses = result.map(r => r.status);
    expect(returnedStatuses).toContain('pending');
    expect(returnedStatuses).toContain('approved');
    expect(returnedStatuses).toContain('rejected');
    expect(returnedStatuses).toContain('completed');
    
    // Check that admin_notes and processed_at are handled correctly
    const rejectedRequest = result.find(r => r.status === 'rejected');
    expect(rejectedRequest?.admin_notes).toEqual('Insufficient verification');
    
    const completedRequest = result.find(r => r.status === 'completed');
    expect(completedRequest?.processed_at).toBeInstanceOf(Date);
  });

  it('should handle withdrawal requests with decimal amounts correctly', async () => {
    // Create test seller
    const sellers = await db.insert(usersTable)
      .values({
        email: testSeller.email,
        password_hash: 'hashed_password',
        role: testSeller.role,
        is_verified: true,
        balance: '999.99'
      })
      .returning()
      .execute();

    const sellerId = sellers[0].id;

    // Test various decimal amounts
    const testAmounts = [99.99, 150.50, 0.01, 1000.00];
    
    for (const amount of testAmounts) {
      await db.insert(withdrawalRequestsTable)
        .values({
          seller_id: sellerId,
          amount: amount.toString(),
          payment_method: 'crypto',
          payment_details: 'crypto-wallet-address',
          status: 'pending'
        })
        .execute();
    }

    const result = await adminGetWithdrawalRequests();

    expect(result).toHaveLength(4);
    
    // Verify all amounts are correctly converted to numbers
    const returnedAmounts = result.map(r => r.amount).sort((a, b) => a - b);
    expect(returnedAmounts).toEqual([0.01, 99.99, 150.50, 1000.00]);
    
    // Verify all amounts are numbers
    result.forEach(request => {
      expect(typeof request.amount).toBe('number');
    });
  });

  it('should only return withdrawal requests from valid sellers', async () => {
    // Create test seller
    const sellers = await db.insert(usersTable)
      .values({
        email: testSeller.email,
        password_hash: 'hashed_password',
        role: testSeller.role,
        is_verified: true,
        balance: '500.00'
      })
      .returning()
      .execute();

    const sellerId = sellers[0].id;

    // Create withdrawal request
    await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: sellerId,
        amount: '100.00',
        payment_method: 'paypal',
        payment_details: 'seller@paypal.com',
        status: 'pending'
      })
      .execute();

    const result = await adminGetWithdrawalRequests();

    expect(result).toHaveLength(1);
    expect(result[0].seller_id).toEqual(sellerId);
  });
});