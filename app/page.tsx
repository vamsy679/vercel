import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BookmarkList from "@/components/BookmarkList";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <BookmarkList user={user} />;
}
