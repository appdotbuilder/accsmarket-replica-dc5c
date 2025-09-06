import { db } from '../db';
import { 
  cartItemsTable, 
  listingsTable, 
  transactionsTable, 
  usersTable 
} from '../db/schema';
import { type CheckoutInput, type Transaction } from '../schema';
import { eq, inArray, and, SQL } from 'drizzle-orm';

export const checkout = async (input: CheckoutInput): Promise<Transaction[]> => {
  try {
    // First verify buyer exists
    const buyer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.buyer_id))
      .execute();

    if (buyer.length === 0) {
      throw new Error('Buyer not found');
    }

    // Check if cart items exist at all (regardless of buyer)
    const allCartItems = await db.select()
      .from(cartItemsTable)
      .where(inArray(cartItemsTable.id, input.cart_items))
      .execute();

    if (allCartItems.length === 0) {
      throw new Error('No valid cart items found for checkout');
    }

    if (allCartItems.length !== input.cart_items.length) {
      throw new Error('No valid cart items found for checkout');
    }

    // Now validate that cart items belong to the buyer and get listing details
    const cartItems = await db.select({
      cart_id: cartItemsTable.id,
      listing_id: cartItemsTable.listing_id,
      quantity: cartItemsTable.quantity,
      listing_price: listingsTable.price,
      seller_id: listingsTable.seller_id,
      listing_status: listingsTable.status,
      listing_title: listingsTable.title
    })
    .from(cartItemsTable)
    .innerJoin(listingsTable, eq(cartItemsTable.listing_id, listingsTable.id))
    .where(
      and(
        eq(cartItemsTable.buyer_id, input.buyer_id),
        inArray(cartItemsTable.id, input.cart_items)
      )
    )
    .execute();

    if (cartItems.length !== input.cart_items.length) {
      throw new Error('Some cart items are invalid or do not belong to the buyer');
    }

    // Verify all listings are active
    const inactiveItems = cartItems.filter(item => item.listing_status !== 'active');
    if (inactiveItems.length > 0) {
      throw new Error(`Listings are no longer available: ${inactiveItems.map(i => i.listing_title).join(', ')}`);
    }



    // Check if buyer is trying to buy their own listings
    const selfPurchase = cartItems.filter(item => item.seller_id === input.buyer_id);
    if (selfPurchase.length > 0) {
      throw new Error('Cannot purchase your own listings');
    }

    // Group cart items by seller to create separate transactions
    const itemsBySeller = cartItems.reduce((acc, item) => {
      if (!acc[item.seller_id]) {
        acc[item.seller_id] = [];
      }
      acc[item.seller_id].push(item);
      return acc;
    }, {} as Record<number, typeof cartItems>);

    const transactions: Transaction[] = [];
    const platformFeeRate = 0.05; // 5% platform fee

    // Create transaction for each seller
    for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
      // Calculate total amount for this seller
      const totalAmount = sellerItems.reduce((sum, item) => {
        return sum + (parseFloat(item.listing_price) * item.quantity);
      }, 0);

      const platformFee = totalAmount * platformFeeRate;

      // Set escrow release date (24 hours from now)
      const escrowReleaseDate = new Date();
      escrowReleaseDate.setHours(escrowReleaseDate.getHours() + 24);

      // For this implementation, we'll use the first listing for the transaction
      // In a real system, you might create separate transactions for each item
      const primaryListing = sellerItems[0];

      const result = await db.insert(transactionsTable)
        .values({
          buyer_id: input.buyer_id,
          seller_id: parseInt(sellerId),
          listing_id: primaryListing.listing_id,
          amount: totalAmount.toString(),
          platform_fee: platformFee.toString(),
          payment_method: input.payment_method,
          status: 'completed', // Simulate successful payment processing
          escrow_release_date: escrowReleaseDate,
          credentials_delivered_at: new Date() // Simulate immediate credential delivery
        })
        .returning()
        .execute();

      const transaction = result[0];
      transactions.push({
        ...transaction,
        amount: parseFloat(transaction.amount),
        platform_fee: parseFloat(transaction.platform_fee)
      });

      // Update listing status to sold for the primary listing
      await db.update(listingsTable)
        .set({ 
          status: 'sold',
          updated_at: new Date()
        })
        .where(eq(listingsTable.id, primaryListing.listing_id))
        .execute();

      // Update seller balance (amount minus platform fee)
      const sellerEarnings = totalAmount - platformFee;
      
      // Get current seller balance
      const currentSeller = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(sellerId)))
        .execute();
        
      const newSellerBalance = parseFloat(currentSeller[0].balance || '0') + sellerEarnings;
      
      await db.update(usersTable)
        .set({
          balance: newSellerBalance.toString(),
          updated_at: new Date()
        })
        .where(eq(usersTable.id, parseInt(sellerId)))
        .execute();
    }

    // Clear cart items after successful checkout
    await db.delete(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.buyer_id, input.buyer_id),
          inArray(cartItemsTable.id, input.cart_items)
        )
      )
      .execute();

    return transactions;
  } catch (error) {
    console.error('Checkout failed:', error);
    throw error;
  }
};