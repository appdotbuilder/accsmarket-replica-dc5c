import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  foreignKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', ['buyer', 'seller', 'admin']);
export const platformEnum = pgEnum('platform', [
  'instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'twitch', 
  'discord', 'steam', 'epic_games', 'origin', 'battle_net', 'minecraft',
  'league_of_legends', 'fortnite', 'other'
]);
export const listingStatusEnum = pgEnum('listing_status', ['active', 'sold', 'removed', 'under_review']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'disputed', 'refunded', 'cancelled']);
export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'in_review', 'resolved', 'closed']);
export const paymentMethodEnum = pgEnum('payment_method', ['credit_card', 'paypal', 'crypto', 'bank_transfer']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['pending', 'approved', 'rejected', 'completed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('buyer'),
  is_verified: boolean('is_verified').notNull().default(false),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Account listings table
export const listingsTable = pgTable('listings', {
  id: serial('id').primaryKey(),
  seller_id: integer('seller_id').notNull().references(() => usersTable.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  platform: platformEnum('platform').notNull(),
  category: text('category').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  follower_count: integer('follower_count'),
  account_age_months: integer('account_age_months'),
  encrypted_credentials: text('encrypted_credentials').notNull(),
  status: listingStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Shopping cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  buyer_id: integer('buyer_id').notNull().references(() => usersTable.id),
  listing_id: integer('listing_id').notNull().references(() => listingsTable.id),
  quantity: integer('quantity').notNull().default(1),
  added_at: timestamp('added_at').defaultNow().notNull()
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  buyer_id: integer('buyer_id').notNull().references(() => usersTable.id),
  seller_id: integer('seller_id').notNull().references(() => usersTable.id),
  listing_id: integer('listing_id').notNull().references(() => listingsTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  platform_fee: numeric('platform_fee', { precision: 10, scale: 2 }).notNull().default('0.00'),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  status: transactionStatusEnum('status').notNull().default('pending'),
  escrow_release_date: timestamp('escrow_release_date'),
  credentials_delivered_at: timestamp('credentials_delivered_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Reviews table
export const reviewsTable = pgTable('reviews', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull().references(() => transactionsTable.id),
  buyer_id: integer('buyer_id').notNull().references(() => usersTable.id),
  seller_id: integer('seller_id').notNull().references(() => usersTable.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Disputes table
export const disputesTable = pgTable('disputes', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull().references(() => transactionsTable.id),
  buyer_id: integer('buyer_id').notNull().references(() => usersTable.id),
  seller_id: integer('seller_id').notNull().references(() => usersTable.id),
  reason: text('reason').notNull(),
  description: text('description').notNull(),
  status: disputeStatusEnum('status').notNull().default('open'),
  admin_notes: text('admin_notes'),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Withdrawal requests table
export const withdrawalRequestsTable = pgTable('withdrawal_requests', {
  id: serial('id').primaryKey(),
  seller_id: integer('seller_id').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: text('payment_method').notNull(),
  payment_details: text('payment_details').notNull(), // Encrypted payment info
  status: withdrawalStatusEnum('status').notNull().default('pending'),
  admin_notes: text('admin_notes'),
  processed_at: timestamp('processed_at'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  listings: many(listingsTable),
  cartItems: many(cartItemsTable),
  buyerTransactions: many(transactionsTable, { relationName: 'buyer' }),
  sellerTransactions: many(transactionsTable, { relationName: 'seller' }),
  buyerReviews: many(reviewsTable, { relationName: 'buyer' }),
  sellerReviews: many(reviewsTable, { relationName: 'seller' }),
  buyerDisputes: many(disputesTable, { relationName: 'buyer' }),
  sellerDisputes: many(disputesTable, { relationName: 'seller' }),
  withdrawalRequests: many(withdrawalRequestsTable)
}));

export const listingsRelations = relations(listingsTable, ({ one, many }) => ({
  seller: one(usersTable, {
    fields: [listingsTable.seller_id],
    references: [usersTable.id]
  }),
  cartItems: many(cartItemsTable),
  transactions: many(transactionsTable)
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  buyer: one(usersTable, {
    fields: [cartItemsTable.buyer_id],
    references: [usersTable.id]
  }),
  listing: one(listingsTable, {
    fields: [cartItemsTable.listing_id],
    references: [listingsTable.id]
  })
}));

export const transactionsRelations = relations(transactionsTable, ({ one, many }) => ({
  buyer: one(usersTable, {
    fields: [transactionsTable.buyer_id],
    references: [usersTable.id],
    relationName: 'buyer'
  }),
  seller: one(usersTable, {
    fields: [transactionsTable.seller_id],
    references: [usersTable.id],
    relationName: 'seller'
  }),
  listing: one(listingsTable, {
    fields: [transactionsTable.listing_id],
    references: [listingsTable.id]
  }),
  reviews: many(reviewsTable),
  disputes: many(disputesTable)
}));

export const reviewsRelations = relations(reviewsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [reviewsTable.transaction_id],
    references: [transactionsTable.id]
  }),
  buyer: one(usersTable, {
    fields: [reviewsTable.buyer_id],
    references: [usersTable.id],
    relationName: 'buyer'
  }),
  seller: one(usersTable, {
    fields: [reviewsTable.seller_id],
    references: [usersTable.id],
    relationName: 'seller'
  })
}));

export const disputesRelations = relations(disputesTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [disputesTable.transaction_id],
    references: [transactionsTable.id]
  }),
  buyer: one(usersTable, {
    fields: [disputesTable.buyer_id],
    references: [usersTable.id],
    relationName: 'buyer'
  }),
  seller: one(usersTable, {
    fields: [disputesTable.seller_id],
    references: [usersTable.id],
    relationName: 'seller'
  })
}));

export const withdrawalRequestsRelations = relations(withdrawalRequestsTable, ({ one }) => ({
  seller: one(usersTable, {
    fields: [withdrawalRequestsTable.seller_id],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Listing = typeof listingsTable.$inferSelect;
export type NewListing = typeof listingsTable.$inferInsert;
export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type Review = typeof reviewsTable.$inferSelect;
export type NewReview = typeof reviewsTable.$inferInsert;
export type Dispute = typeof disputesTable.$inferSelect;
export type NewDispute = typeof disputesTable.$inferInsert;
export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;
export type NewWithdrawalRequest = typeof withdrawalRequestsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  listings: listingsTable,
  cartItems: cartItemsTable,
  transactions: transactionsTable,
  reviews: reviewsTable,
  disputes: disputesTable,
  withdrawalRequests: withdrawalRequestsTable
};