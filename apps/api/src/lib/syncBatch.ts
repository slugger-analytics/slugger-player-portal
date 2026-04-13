/** Rows per `INSERT … ON CONFLICT` during TBC sync (fewer round trips vs one-upsert-at-a-time). */
export const SYNC_UPSERT_CHUNK = 400
