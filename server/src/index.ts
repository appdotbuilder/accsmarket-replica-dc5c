import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerUserInputSchema,
  loginUserInputSchema,
  createListingInputSchema,
  updateListingInputSchema,
  addToCartInputSchema,
  checkoutInputSchema,
  createReviewInputSchema,
  createDisputeInputSchema,
  createWithdrawalRequestInputSchema,
  searchListingsInputSchema,
  getUserOrdersInputSchema,
  listingStatusSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { createListing } from './handlers/create_listing';
import { getListings } from './handlers/get_listings';
import { getListingById } from './handlers/get_listing_by_id';
import { updateListing } from './handlers/update_listing';
import { addToCart } from './handlers/add_to_cart';
import { getCart } from './handlers/get_cart';
import { removeFromCart } from './handlers/remove_from_cart';
import { checkout } from './handlers/checkout';
import { getUserTransactions } from './handlers/get_user_transactions';
import { getTransactionCredentials } from './handlers/get_transaction_credentials';
import { createReview } from './handlers/create_review';
import { createDispute } from './handlers/create_dispute';
import { getSellerListings } from './handlers/get_seller_listings';
import { getSellerBalance } from './handlers/get_seller_balance';
import { createWithdrawalRequest } from './handlers/create_withdrawal_request';
import { getSellerReviews } from './handlers/get_seller_reviews';
import { adminGetAllUsers } from './handlers/admin_get_all_users';
import { adminGetAllListings } from './handlers/admin_get_all_listings';
import { adminModerateListing } from './handlers/admin_moderate_listing';
import { adminGetDisputes } from './handlers/admin_get_disputes';
import { adminResolveDispute } from './handlers/admin_resolve_dispute';
import { adminGetWithdrawalRequests } from './handlers/admin_get_withdrawal_requests';
import { adminProcessWithdrawal } from './handlers/admin_process_withdrawal';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .query(({ input }) => loginUser(input)),

  // Public listing browsing
  getListings: publicProcedure
    .input(searchListingsInputSchema.optional())
    .query(({ input }) => getListings(input)),

  getListingById: publicProcedure
    .input(z.number())
    .query(({ input }) => getListingById(input)),

  // Seller operations
  createListing: publicProcedure
    .input(createListingInputSchema)
    .mutation(({ input }) => createListing(input)),

  updateListing: publicProcedure
    .input(updateListingInputSchema)
    .mutation(({ input }) => updateListing(input)),

  getSellerListings: publicProcedure
    .input(z.number())
    .query(({ input }) => getSellerListings(input)),

  getSellerBalance: publicProcedure
    .input(z.number())
    .query(({ input }) => getSellerBalance(input)),

  createWithdrawalRequest: publicProcedure
    .input(createWithdrawalRequestInputSchema)
    .mutation(({ input }) => createWithdrawalRequest(input)),

  getSellerReviews: publicProcedure
    .input(z.number())
    .query(({ input }) => getSellerReviews(input)),

  // Shopping cart operations
  addToCart: publicProcedure
    .input(addToCartInputSchema)
    .mutation(({ input }) => addToCart(input)),

  getCart: publicProcedure
    .input(z.number())
    .query(({ input }) => getCart(input)),

  removeFromCart: publicProcedure
    .input(z.object({ cartItemId: z.number(), buyerId: z.number() }))
    .mutation(({ input }) => removeFromCart(input.cartItemId, input.buyerId)),

  // Checkout and transactions
  checkout: publicProcedure
    .input(checkoutInputSchema)
    .mutation(({ input }) => checkout(input)),

  getUserTransactions: publicProcedure
    .input(getUserOrdersInputSchema)
    .query(({ input }) => getUserTransactions(input)),

  getTransactionCredentials: publicProcedure
    .input(z.object({ transactionId: z.number(), buyerId: z.number() }))
    .query(({ input }) => getTransactionCredentials(input.transactionId, input.buyerId)),

  // Reviews and disputes
  createReview: publicProcedure
    .input(createReviewInputSchema)
    .mutation(({ input }) => createReview(input)),

  createDispute: publicProcedure
    .input(createDisputeInputSchema)
    .mutation(({ input }) => createDispute(input)),

  // Admin operations
  adminGetAllUsers: publicProcedure
    .query(() => adminGetAllUsers()),

  adminGetAllListings: publicProcedure
    .query(() => adminGetAllListings()),

  adminModerateListing: publicProcedure
    .input(z.object({
      listingId: z.number(),
      status: z.enum(['active', 'removed']),
      adminNotes: z.string().optional()
    }))
    .mutation(({ input }) => adminModerateListing(input.listingId, input.status, input.adminNotes)),

  adminGetDisputes: publicProcedure
    .query(() => adminGetDisputes()),

  adminResolveDispute: publicProcedure
    .input(z.object({
      disputeId: z.number(),
      resolution: z.enum(['buyer_favor', 'seller_favor', 'partial_refund']),
      adminNotes: z.string(),
      refundAmount: z.number().optional()
    }))
    .mutation(({ input }) => adminResolveDispute(
      input.disputeId,
      input.resolution,
      input.adminNotes,
      input.refundAmount
    )),

  adminGetWithdrawalRequests: publicProcedure
    .query(() => adminGetWithdrawalRequests()),

  adminProcessWithdrawal: publicProcedure
    .input(z.object({
      withdrawalId: z.number(),
      status: z.enum(['approved', 'rejected', 'completed']),
      adminNotes: z.string().optional()
    }))
    .mutation(({ input }) => adminProcessWithdrawal(
      input.withdrawalId,
      input.status,
      input.adminNotes
    ))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`AccsMarket Replica TRPC server listening at port: ${port}`);
}

start();