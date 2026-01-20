import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const { auth } = NextAuth(authOptions);

export { auth };

