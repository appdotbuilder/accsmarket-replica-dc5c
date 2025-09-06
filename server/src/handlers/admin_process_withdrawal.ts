import { db } from '../db';
import { withdrawalRequestsTable, usersTable } from '../db/schema';
import { type WithdrawalRequest } from '../schema';
import { eq } from 'drizzle-orm';

export async function adminProcessWithdrawal(
    withdrawalId: number,
    status: 'approved' | 'rejected' | 'completed',
    adminNotes?: string
): Promise<WithdrawalRequest | null> {
    try {
        // First, get the current withdrawal request to verify it exists and get seller info
        const existingRequests = await db.select()
            .from(withdrawalRequestsTable)
            .where(eq(withdrawalRequestsTable.id, withdrawalId))
            .execute();

        if (existingRequests.length === 0) {
            return null;
        }

        const existingRequest = existingRequests[0];

        // If approving a withdrawal, deduct amount from seller's balance
        if (status === 'approved' && existingRequest.status === 'pending') {
            // Get seller's current balance
            const sellers = await db.select()
                .from(usersTable)
                .where(eq(usersTable.id, existingRequest.seller_id))
                .execute();

            if (sellers.length === 0) {
                throw new Error('Seller not found');
            }

            const seller = sellers[0];
            const currentBalance = parseFloat(seller.balance);
            const withdrawalAmount = parseFloat(existingRequest.amount);

            // Check if seller has sufficient balance
            if (currentBalance < withdrawalAmount) {
                throw new Error('Insufficient seller balance for withdrawal');
            }

            // Update seller's balance (deduct withdrawal amount)
            const newBalance = currentBalance - withdrawalAmount;
            await db.update(usersTable)
                .set({
                    balance: newBalance.toString(),
                    updated_at: new Date()
                })
                .where(eq(usersTable.id, existingRequest.seller_id))
                .execute();
        }

        // Update the withdrawal request status
        const updateData: any = {
            status: status,
            updated_at: new Date()
        };

        if (adminNotes) {
            updateData.admin_notes = adminNotes;
        }

        if (status === 'completed') {
            updateData.processed_at = new Date();
        }

        const result = await db.update(withdrawalRequestsTable)
            .set(updateData)
            .where(eq(withdrawalRequestsTable.id, withdrawalId))
            .returning()
            .execute();

        if (result.length === 0) {
            return null;
        }

        const updatedRequest = result[0];
        
        // Convert numeric fields back to numbers before returning
        return {
            ...updatedRequest,
            amount: parseFloat(updatedRequest.amount)
        };
    } catch (error) {
        console.error('Withdrawal processing failed:', error);
        throw error;
    }
}