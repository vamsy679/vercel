
-- 1. Create the bookmarks table
CREATE TABLE public.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create index for fast lookups by user
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Users can only access their own bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Enable Realtime for the bookmarks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;

-- 6. Required for Realtime DELETE events to include full row data
ALTER TABLE bookmarks REPLICA IDENTITY FULL;
