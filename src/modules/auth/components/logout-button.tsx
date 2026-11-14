"use client";

import { useFormStatus } from "react-dom";
import { LogOut, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "../actions";

function SubmitLogout() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
    {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
    {pending ? "Cerrando sesión…" : "Cerrar sesión"}
  </Button>;
}

export function LogoutButton() {
  return <form action={logout}><SubmitLogout /></form>;
}
