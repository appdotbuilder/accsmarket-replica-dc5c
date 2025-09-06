import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  listingsTable, 
  cartItemsTable, 
  transactionsTable 
} from '../db/schema';
import { type CheckoutInput } from '../schema';
import { checkout } from '../handlers/checkout';
import { eq, and } from 'drizzle-orm';

describe('checkout', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create buyer
    const buyerResult = await db.insert(usersTable)
      .values({
        email: 'buyer@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer',
        is_verified: true,
        balance: '100.00'
      })
      .returning()
      .execute();
    const buyer = buyerResult[0];

    // Create seller
    const sellerResult = await db.insert(usersTable)
      .values({
        email: 'seller@test.com',
        password_hash: 'hashedpassword',
        role: 'seller',
        is_verified: true,
        balance: '0.00'
      })
      .returning()
      .execute();
    const seller = sellerResult[0];

    // Create second seller
    const seller2Result = await db.insert(usersTable)
      .values({
        email: 'seller2@test.com',
        password_hash: 'hashedpassword',
        role: 'seller',
        is_verified: true,
        balance: '0.00'
      })
      .returning()
      .execute();
    const seller2 = seller2Result[0];

    // Create listings
    const listing1Result = await db.insert(listingsTable)
      .values({
        seller_id: seller.id,
        title: 'Instagram Account 1',
        description: 'Test Instagram account with good followers',
        platform: 'instagram',
        category: 'social_media',
        price: '50.00',
        follower_count: 1000,
        account_age_months: 12,
        encrypted_credentials: 'encrypted_creds_1',
        status: 'active'
      })
      .returning()
      .execute();
    const listing1 = listing1Result[0];

    const listing2Result = await db.insert(listingsTable)
      .values({
        seller_id: seller2.id,
        title: 'Twitter Account 1',
        description: 'Test Twitter account with engagement',
        platform: 'twitter',
        category: 'social_media',
        price: '30.00',
        follower_count: 500,
        account_age_months: 8,
        encrypted_credentials: 'encrypted_creds_2',
        status: 'active'
      })
      .returning()
      .execute();
    const listing2 = listing2Result[0];

    // Create cart items
    const cartItem1Result = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer.id,
        listing_id: listing1.id,
        quantity: 1
      })
      .returning()
      .execute();
    const cartItem1 = cartItem1Result[0];

    const cartItem2Result = await db.insert(cartItemsTable)
      .values({
        buyer_id: buyer.id,
        listing_id: listing2.id,
        quantity: 1
      })
      .returning()
      .execute();
    const cartItem2 = cartItem2Result[0];

    return {
      buyer,
      seller,
      seller2,
      listing1,
      listing2,
      cartItem1,
      cartItem2
    };
  };

  it('should successfully checkout with multiple items from different sellers', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id, testData.cartItem2.id]
    };

    const result = await checkout(input);

    // Should create 2 transactions (one per seller)
    expect(result).toHaveLength(2);

    // Verify transaction data
    const transaction1 = result.find(t => t.seller_id === testData.seller.id);
    const transaction2 = result.find(t => t.seller_id === testData.seller2.id);

    expect(transaction1).toBeDefined();
    expect(transaction1!.buyer_id).toEqual(testData.buyer.id);
    expect(transaction1!.amount).toEqual(50.00);
    expect(transaction1!.platform_fee).toEqual(2.5); // 5% of 50
    expect(transaction1!.payment_method).toEqual('credit_card');
    expect(transaction1!.status).toEqual('completed');
    expect(transaction1!.escrow_release_date).toBeInstanceOf(Date);
    expect(transaction1!.credentials_delivered_at).toBeInstanceOf(Date);

    expect(transaction2).toBeDefined();
    expect(transaction2!.buyer_id).toEqual(testData.buyer.id);
    expect(transaction2!.amount).toEqual(30.00);
    expect(transaction2!.platform_fee).toEqual(1.5); // 5% of 30
    expect(transaction2!.payment_method).toEqual('credit_card');
    expect(transaction2!.status).toEqual('completed');
  });

  it('should update listing status to sold', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'paypal',
      cart_items: [testData.cartItem1.id]
    };

    await checkout(input);

    // Verify listing status updated
    const updatedListing = await db.select()
      .from(listingsTable)
      .where(eq(listingsTable.id, testData.listing1.id))
      .execute();

    expect(updatedListing[0].status).toEqual('sold');
    expect(updatedListing[0].updated_at).toBeInstanceOf(Date);
  });

  it('should clear cart items after successful checkout', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'crypto',
      cart_items: [testData.cartItem1.id, testData.cartItem2.id]
    };

    await checkout(input);

    // Verify cart items are cleared
    const remainingCartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.buyer_id, testData.buyer.id))
      .execute();

    expect(remainingCartItems).toHaveLength(0);
  });

  it('should update seller balance with earnings minus platform fee', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'bank_transfer',
      cart_items: [testData.cartItem1.id]
    };

    await checkout(input);

    // Verify seller balance updated (50 - 2.5 platform fee = 47.5)
    const updatedSeller = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testData.seller.id))
      .execute();

    expect(parseFloat(updatedSeller[0].balance)).toEqual(47.5);
  });

  it('should save transactions to database', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id]
    };

    const result = await checkout(input);

    // Verify transaction saved to database
    const dbTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result[0].id))
      .execute();

    expect(dbTransaction).toHaveLength(1);
    expect(dbTransaction[0].buyer_id).toEqual(testData.buyer.id);
    expect(dbTransaction[0].seller_id).toEqual(testData.seller.id);
    expect(parseFloat(dbTransaction[0].amount)).toEqual(50.00);
  });

  it('should throw error when cart items do not exist', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [99999] // Non-existent cart item
    };

    await expect(checkout(input)).rejects.toThrow(/no valid cart items found/i);
  });

  it('should throw error when cart items do not belong to buyer', async () => {
    const testData = await createTestData();

    // Create another buyer
    const otherBuyerResult = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        password_hash: 'hashedpassword',
        role: 'buyer',
        is_verified: true,
        balance: '100.00'
      })
      .returning()
      .execute();
    const otherBuyer = otherBuyerResult[0];

    const input: CheckoutInput = {
      buyer_id: otherBuyer.id,
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id] // Belongs to different buyer
    };

    await expect(checkout(input)).rejects.toThrow(/some cart items are invalid/i);
  });

  it('should throw error when buyer does not exist', async () => {
    const testData = await createTestData();

    const input: CheckoutInput = {
      buyer_id: 99999, // Non-existent buyer
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id]
    };

    await expect(checkout(input)).rejects.toThrow(/buyer not found/i);
  });

  it('should throw error when buyer tries to purchase own listing', async () => {
    const testData = await createTestData();

    // Create cart item where buyer is also the seller
    const selfListingResult = await db.insert(listingsTable)
      .values({
        seller_id: testData.buyer.id, // Same as buyer
        title: 'Self Listing',
        description: 'Buyer owns this listing',
        platform: 'instagram',
        category: 'social_media',
        price: '25.00',
        encrypted_credentials: 'encrypted_creds',
        status: 'active'
      })
      .returning()
      .execute();
    const selfListing = selfListingResult[0];

    const selfCartItemResult = await db.insert(cartItemsTable)
      .values({
        buyer_id: testData.buyer.id,
        listing_id: selfListing.id,
        quantity: 1
      })
      .returning()
      .execute();
    const selfCartItem = selfCartItemResult[0];

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [selfCartItem.id]
    };

    await expect(checkout(input)).rejects.toThrow(/cannot purchase your own listings/i);
  });

  it('should throw error when listing is not active', async () => {
    const testData = await createTestData();

    // Update listing to sold status
    await db.update(listingsTable)
      .set({ status: 'sold' })
      .where(eq(listingsTable.id, testData.listing1.id))
      .execute();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id]
    };

    await expect(checkout(input)).rejects.toThrow(/listings are no longer available/i);
  });

  it('should set correct escrow release date (24 hours from now)', async () => {
    const testData = await createTestData();
    const checkoutTime = new Date();

    const input: CheckoutInput = {
      buyer_id: testData.buyer.id,
      payment_method: 'credit_card',
      cart_items: [testData.cartItem1.id]
    };

    const result = await checkout(input);

    const escrowDate = result[0].escrow_release_date!;
    const expectedTime = new Date(checkoutTime.getTime() + (24 * 60 * 60 * 1000));
    
    // Allow 1 minute tolerance for test execution time
    const timeDiff = Math.abs(escrowDate.getTime() - expectedTime.getTime());
    expect(timeDiff).toBeLessThan(60000); // Less than 1 minute difference
  });
});