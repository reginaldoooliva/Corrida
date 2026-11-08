import { redirect } from "next/navigation";

// The app has no landing page: "/" goes to the dashboard, and proxy.ts sends a signed-out user on
// to /login from there. (Replaces create-next-app's placeholder page, which shipped to production.)
export default function Home() {
  redirect("/dashboard");
}
