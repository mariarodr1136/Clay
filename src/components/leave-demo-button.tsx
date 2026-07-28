import { Button } from "@/components/ui/button";

// A form rather than a link, so the demo session is only cleared by an
// actual click. See the POST handler in /demo/exit: as a prefetchable GET
// this ended the visitor's session the moment the button scrolled into view.
export function LeaveDemoButton({
  to = "/sign-up",
  label,
  className,
}: {
  to?: string;
  label: string;
  className?: string;
}) {
  return (
    <form action="/demo/exit" method="post" className="contents">
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant="outline" className={className}>
        {label}
      </Button>
    </form>
  );
}
