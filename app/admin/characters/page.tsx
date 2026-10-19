import { redirect } from "next/navigation";

export default function AdminCharactersRedirectPage() {
  redirect("/admin?tab=characters");
}
