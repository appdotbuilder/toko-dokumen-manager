
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createStoreProfileInputSchema,
  updateStoreProfileInputSchema,
  createTransactionInputSchema,
  updateTransactionInputSchema,
  createTransactionItemInputSchema,
  updateTransactionItemInputSchema,
  generateDocumentInputSchema
} from './schema';

// Import handlers
import { createStoreProfile } from './handlers/create_store_profile';
import { getStoreProfile } from './handlers/get_store_profile';
import { updateStoreProfile } from './handlers/update_store_profile';
import { createTransaction } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { getTransactionById } from './handlers/get_transaction_by_id';
import { updateTransaction } from './handlers/update_transaction';
import { deleteTransaction } from './handlers/delete_transaction';
import { createTransactionItem } from './handlers/create_transaction_item';
import { getTransactionItems } from './handlers/get_transaction_items';
import { updateTransactionItem } from './handlers/update_transaction_item';
import { deleteTransactionItem } from './handlers/delete_transaction_item';
import { generateDocument } from './handlers/generate_document';

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

  // Store Profile Management
  createStoreProfile: publicProcedure
    .input(createStoreProfileInputSchema)
    .mutation(({ input }) => createStoreProfile(input)),

  getStoreProfile: publicProcedure
    .query(() => getStoreProfile()),

  updateStoreProfile: publicProcedure
    .input(updateStoreProfileInputSchema)
    .mutation(({ input }) => updateStoreProfile(input)),

  // Transaction Management
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  getTransactions: publicProcedure
    .query(() => getTransactions()),

  getTransactionById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTransactionById(input.id)),

  updateTransaction: publicProcedure
    .input(updateTransactionInputSchema)
    .mutation(({ input }) => updateTransaction(input)),

  deleteTransaction: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteTransaction(input.id)),

  // Transaction Items Management
  createTransactionItem: publicProcedure
    .input(createTransactionItemInputSchema)
    .mutation(({ input }) => createTransactionItem(input)),

  getTransactionItems: publicProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(({ input }) => getTransactionItems(input.transactionId)),

  updateTransactionItem: publicProcedure
    .input(updateTransactionItemInputSchema)
    .mutation(({ input }) => updateTransactionItem(input)),

  deleteTransactionItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteTransactionItem(input.id)),

  // Document Generation
  generateDocument: publicProcedure
    .input(generateDocumentInputSchema)
    .mutation(({ input }) => generateDocument(input)),
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
  console.log(`TRPC server listening at port: ${port}`);
}

start();
