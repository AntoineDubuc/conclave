import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile from DB
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url, timezone")
    .eq("id", user.id)
    .single();

  // Build user data with auth fallbacks for OAuth users
  const userData = {
    name:
      profile?.name ||
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      "",
    email: user.email || profile?.email || "",
    avatarUrl:
      profile?.avatar_url ||
      (user.user_metadata?.avatar_url as string) ||
      (user.user_metadata?.picture as string) ||
      undefined,
    timezone: profile?.timezone || "America/New_York",
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
        <p className="text-white/60">
          Manage your profile information and preferences.
        </p>
      </div>

      {/* Profile Form Card */}
      <div className="bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 p-8">
        <ProfileForm initialData={userData} />
      </div>
    </div>
  );
}
