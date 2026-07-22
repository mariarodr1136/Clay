import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-12rem] -z-10 flex justify-center blur-3xl"
      >
        <div className="aspect-[3/1] w-[70rem] bg-gradient-to-tr from-[oklch(0.85_0.09_264)] via-[oklch(0.92_0.06_300)] to-[oklch(0.89_0.08_200)] opacity-50" />
      </div>
      <SignIn />
    </div>
  );
}
