import { sqliteTable, text, index, integer } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('organizer_entries', {
  id:text('id').primaryKey(), userId:text('user_id').notNull(), kind:text('kind').notNull(),
  text:text('text').notNull(), subject:text('subject'), dueAt:text('due_at'), createdAt:text('created_at').notNull(),
  operationKey:text('operation_key').notNull().unique(), requestJson:text('request_json').notNull(),
}, table=>[index('idx_entries_user_time').on(table.userId,table.createdAt)]);
export const sessions = sqliteTable('live_sessions', {
  id:text('id').primaryKey(), userId:text('user_id').notNull(), createdAt:integer('created_at').notNull(), expiresAt:integer('expires_at').notNull(),
},table=>[index('idx_sessions_user_time').on(table.userId,table.createdAt)]);
export const eventFacts = sqliteTable('event_facts', {
  key:text('key').primaryKey(), source:text('source').notNull(), retrievedAt:text('retrieved_at').notNull(),
  asOf:text('as_of'), layer:text('layer').notNull(), valueJson:text('value_json').notNull(),
});
