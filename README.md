## Problems encountered

### Supabase Realtime WebSocket failing (cross-browser sync)
The Supabase Realtime WebSocket connection consistently returns 
CLOSED → TIMED_OUT despite the project being active and the 
bookmarks table being added to the supabase_realtime publication.

Cross-tab sync within the same browser works via the BroadcastChannel 
API as a fallback. Cross-browser/device sync requires the WebSocket 
connection which could not be established due to what appears to be 
an infrastructure-level issue with the Supabase free tier project.

Attempted fixes:
- Recreated supabase_realtime publication
- Verified table is in publication via pg_publication_tables
- Confirmed project is active (not paused)
- Verified environment variables match project
- Implemented BroadcastChannel as same-browser fallback

Rest of the features implemented
