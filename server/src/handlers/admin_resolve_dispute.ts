import { db } from '../db';
import { disputesTable, transactionsTable, usersTable } from '../db/schema';
import { type Dispute } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function adminResolveDispute(
    disputeId: number, 
    resolution: 'buyer_favor' | 'seller_favor' | 'partial_refund',
    adminNotes: string,
    refundAmount?: number
): Promise<Dispute | null> {
    try {
        // First, get the dispute with its related transaction data
        const disputeResult = await db.select({
            dispute: disputesTable,
            transaction: transactionsTable
        })
        .from(disputesTable)
        .innerJoin(transactionsTable, eq(disputesTable.transaction_id, transactionsTable.id))
        .where(eq(disputesTable.id, disputeId))
        .execute();

        if (disputeResult.length === 0) {
            return null;
        }

        const { dispute, transaction } = disputeResult[0];

        // Verify dispute is not already resolved
        if (dispute.status === 'resolved' || dispute.status === 'closed') {
            throw new Error('Dispute is already resolved');
        }

        // Calculate amounts for different resolution types
        const transactionAmount = parseFloat(transaction.amount);
        const platformFee = parseFloat(transaction.platform_fee);
        let buyerRefund = 0;
        let sellerAmount = 0;

        switch (resolution) {
            case 'buyer_favor':
                buyerRefund = transactionAmount; // Full refund to buyer
                sellerAmount = 0;
                break;
            case 'seller_favor':
                buyerRefund = 0;
                sellerAmount = transactionAmount - platformFee; // Seller keeps payment minus platform fee
                break;
            case 'partial_refund':
                if (refundAmount === undefined || refundAmount < 0 || refundAmount > transactionAmount) {
                    throw new Error('Invalid refund amount for partial refund');
                }
                buyerRefund = refundAmount;
                sellerAmount = Math.max(0, transactionAmount - refundAmount - platformFee); // Ensure seller amount is not negative
                break;
        }

        // Start transaction to ensure consistency
        const result = await db.transaction(async (tx) => {
            // Update dispute status
            const updatedDispute = await tx.update(disputesTable)
                .set({
                    status: 'resolved',
                    admin_notes: adminNotes,
                    resolved_at: new Date(),
                    updated_at: new Date()
                })
                .where(eq(disputesTable.id, disputeId))
                .returning()
                .execute();

            // Update transaction status based on resolution
            let transactionStatus: 'completed' | 'refunded' = 'completed';
            if (resolution === 'buyer_favor') {
                transactionStatus = 'refunded';
            }

            await tx.update(transactionsTable)
                .set({
                    status: transactionStatus,
                    updated_at: new Date()
                })
                .where(eq(transactionsTable.id, transaction.id))
                .execute();

            // Update buyer balance if there's a refund
            if (buyerRefund > 0) {
                const buyerData = await tx.select()
                    .from(usersTable)
                    .where(eq(usersTable.id, transaction.buyer_id))
                    .execute();

                const currentBuyerBalance = parseFloat(buyerData[0].balance);
                const newBuyerBalance = currentBuyerBalance + buyerRefund;

                await tx.update(usersTable)
                    .set({
                        balance: newBuyerBalance.toString(),
                        updated_at: new Date()
                    })
                    .where(eq(usersTable.id, transaction.buyer_id))
                    .execute();
            }

            // Update seller balance if they receive payment
            if (sellerAmount > 0) {
                const sellerData = await tx.select()
                    .from(usersTable)
                    .where(eq(usersTable.id, transaction.seller_id))
                    .execute();

                const currentSellerBalance = parseFloat(sellerData[0].balance);
                const newSellerBalance = currentSellerBalance + sellerAmount;

                await tx.update(usersTable)
                    .set({
                        balance: newSellerBalance.toString(),
                        updated_at: new Date()
                    })
                    .where(eq(usersTable.id, transaction.seller_id))
                    .execute();
            }

            return updatedDispute[0];
        });

        // Convert numeric fields back to numbers for return
        return {
            ...result,
            resolved_at: result.resolved_at || new Date(),
            updated_at: result.updated_at || new Date()
        };

    } catch (error) {
        console.error('Admin dispute resolution failed:', error);
        throw error;
    }
}