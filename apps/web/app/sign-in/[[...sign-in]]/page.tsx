import { SignIn } from "@clerk/nextjs";
export default function SignInPage() {
  return <main className="grid min-h-screen place-items-center px-6"><SignIn fallbackRedirectUrl="/app" /></main>;
}
