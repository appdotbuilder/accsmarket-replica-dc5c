import { db } from '../db';
import { usersTable, withdrawalRequestsTable } from '../db/schema';
import { type CreateWithdrawalRequestInput, type WithdrawalRequest } from '../schema';
import { eq } from 'drizzle-orm';

export const createWithdrawalRequest = async (input: CreateWithdrawalRequestInput): Promise<WithdrawalRequest> => {
  try {
    // First, verify the seller exists and get their current balance
    const sellerData = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.seller_id))
      .execute();

    if (sellerData.length === 0) {
      throw new Error('Seller not found');
    }

    const seller = sellerData[0];
    const currentBalance = parseFloat(seller.balance);

    // Check if seller has sufficient balance
    if (currentBalance < input.amount) {
      throw new Error('Insufficient balance');
    }

    // Simple encryption for payment details (in production, use proper encryption)
    const encryptedPaymentDetails = Buffer.from(input.payment_details).toString('base64');

    // Create the withdrawal request
    const result = await db.insert(withdrawalRequestsTable)
      .values({
        seller_id: input.seller_id,
        amount: input.amount.toString(), // Convert number to string for numeric column
        payment_method: input.payment_method,
        payment_details: encryptedPaymentDetails,
        status: 'pending',
        admin_notes: null,
        processed_at: null
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const withdrawalRequest = result[0];
    return {
      ...withdrawalRequest,
      amount: parseFloat(withdrawalRequest.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Withdrawal request creation failed:', error);
    throw error;
  }
};