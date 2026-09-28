import Link from "next/link";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";

const footerLinks = [
  { href: "/consultants", label: "Find a consultant" },
  { href: "/crisis-resources", label: "Crisis resources" },
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create account" },
] as const;

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <Container className="flex flex-col gap-8 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-base font-semibold text-card-foreground">{siteConfig.name}</p>
            <p className="max-w-measure text-sm text-muted-foreground">{siteConfig.description}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-1 md:items-end">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            {siteConfig.name} is not an emergency service. If you or someone else is in immediate
            danger, contact your local emergency number or a crisis line listed on our{" "}
            <Link
              href="/crisis-resources"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              crisis resources
            </Link>{" "}
            page.
          </p>
          <p>
            Questions? Email{" "}
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {siteConfig.supportEmail}
            </a>
            .
          </p>
        </div>
      </Container>
    </footer>
  );
}

export { SiteFooter };
