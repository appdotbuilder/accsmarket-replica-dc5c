import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['buyer', 'seller', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Account platform enum
export const platformSchema = z.enum([
  'instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'twitch', 
  'discord', 'steam', 'epic_games', 'origin', 'battle_net', 'minecraft',
  'league_of_legends', 'fortnite', 'other'
]);
export type Platform = z.infer<typeof platformSchema>;

// Listing status enum
export const listingStatusSchema = z.enum(['active', 'sold', 'removed', 'under_review']);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

// Transaction status enum
export const transactionStatusSchema = z.enum(['pending', 'completed', 'disputed', 'refunded', 'cancelled']);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// Dispute status enum
export const disputeStatusSchema = z.enum(['open', 'in_review', 'resolved', 'closed']);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

// Payment method enum
export const paymentMethodSchema = z.enum(['credit_card', 'paypal', 'crypto', 'bank_transfer']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  is_verified: z.boolean(),
  balance: z.number(), // Available seller balance
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type User = z.infer<typeof userSchema>;

// Account listing schema
export const listingSchema = z.object({
  id: z.number(),
  seller_id: z.number(),
  title: z.string(),
  description: z.string(),
  platform: platformSchema,
  category: z.string(),
  price: z.number().positive(),
  follower_count: z.number().int().nonnegative().nullable(),
  account_age_months: z.number().int().nonnegative().nullable(),
  encrypted_credentials: z.string(), // Encrypted login:password:email:email_password
  status: listingStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type Listing = z.infer<typeof listingSchema>;

// Shopping cart schema
export const cartItemSchema = z.object({
  id: z.number(),
  buyer_id: z.number(),
  listing_id: z.number(),
  quantity: z.number().int().positive().default(1),
  added_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  buyer_id: z.number(),
  seller_id: z.number(),
  listing_id: z.number(),
  amount: z.number().positive(),
  platform_fee: z.number().nonnegative(),
  payment_method: paymentMethodSchema,
  status: transactionStatusSchema,
  escrow_release_date: z.coerce.date().nullable(), // 24 hours after purchase
  credentials_delivered_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Review schema
export const reviewSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  buyer_id: z.number(),
  seller_id: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Review = z.infer<typeof reviewSchema>;

// Dispute schema
export const disputeSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  buyer_id: z.number(),
  seller_id: z.number(),
  reason: z.string(),
  description: z.string(),
  status: disputeStatusSchema,
  admin_notes: z.string().nullable(),
  resolved_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type Dispute = z.infer<typeof disputeSchema>;

// Withdrawal request schema
export const withdrawalRequestSchema = z.object({
  id: z.number(),
  seller_id: z.number(),
  amount: z.number().positive(),
  payment_method: z.string(),
  payment_details: z.string(), // Encrypted payment info
  status: z.enum(['pending', 'approved', 'rejected', 'completed']),
  admin_notes: z.string().nullable(),
  processed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type WithdrawalRequest = z.infer<typeof withdrawalRequestSchema>;

// Input schemas for creating/updating

// User registration input
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema.default('buyer')
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Create listing input
export const createListingInputSchema = z.object({
  seller_id: z.number(),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  platform: platformSchema,
  category: z.string().min(1).max(100),
  price: z.number().positive(),
  follower_count: z.number().int().nonnegative().nullable(),
  account_age_months: z.number().int().nonnegative().nullable(),
  credentials: z.string().min(1) // Raw credentials to be encrypted
});

export type CreateListingInput = z.infer<typeof createListingInputSchema>;

// Update listing input
export const updateListingInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  price: z.number().positive().optional(),
  follower_count: z.number().int().nonnegative().nullable().optional(),
  account_age_months: z.number().int().nonnegative().nullable().optional(),
  status: listingStatusSchema.optional()
});

export type UpdateListingInput = z.infer<typeof updateListingInputSchema>;

// Add to cart input
export const addToCartInputSchema = z.object({
  buyer_id: z.number(),
  listing_id: z.number(),
  quantity: z.number().int().positive().default(1)
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

// Checkout input
export const checkoutInputSchema = z.object({
  buyer_id: z.number(),
  payment_method: paymentMethodSchema,
  cart_items: z.array(z.number()) // Array of cart item IDs
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

// Create review input
export const createReviewInputSchema = z.object({
  transaction_id: z.number(),
  buyer_id: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable()
});

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

// Create dispute input
export const createDisputeInputSchema = z.object({
  transaction_id: z.number(),
  buyer_id: z.number(),
  reason: z.string().min(1).max(200),
  description: z.string().min(10).max(2000)
});

export type CreateDisputeInput = z.infer<typeof createDisputeInputSchema>;

// Withdrawal request input
export const createWithdrawalRequestInputSchema = z.object({
  seller_id: z.number(),
  amount: z.number().positive(),
  payment_method: z.string().min(1),
  payment_details: z.string().min(1)
});

export type CreateWithdrawalRequestInput = z.infer<typeof createWithdrawalRequestInputSchema>;

// Search and filter inputs
export const searchListingsInputSchema = z.object({
  query: z.string().optional(),
  platform: platformSchema.optional(),
  category: z.string().optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().positive().optional(),
  min_followers: z.number().int().nonnegative().optional(),
  max_followers: z.number().int().positive().optional(),
  min_age_months: z.number().int().nonnegative().optional(),
  max_age_months: z.number().int().positive().optional(),
  sort_by: z.enum(['price_asc', 'price_desc', 'followers_desc', 'age_desc', 'created_desc']).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0)
});

export type SearchListingsInput = z.infer<typeof searchListingsInputSchema>;

// Get user orders input
export const getUserOrdersInputSchema = z.object({
  user_id: z.number(),
  status: transactionStatusSchema.optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0)
});

export type GetUserOrdersInput = z.infer<typeof getUserOrdersInputSchema>;