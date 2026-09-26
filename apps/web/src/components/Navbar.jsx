'use client';

import { Show, useClerk, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const landingLinks = [
  { name: 'Features', href: '#platform' },
  { name: 'Topics', href: '#solutions' },
  { name: 'Guides', href: '#resources' },
];

const appLinks = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Profile', href: '/profile' },
];

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M5 3.5h7.5V11M12.1 3.9 3.5 12.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const Navbar = () => {
  const { openSignIn } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === '/';
  const links = isLanding ? landingLinks : appLinks;

  const handleInterview = () => {
    router.push('/dashboard');
  };

  return (
    <nav className="rivr-nav" aria-label="Primary navigation">
      <Link className="rivr-logo" href={isLanding ? '/' : '/dashboard'} aria-label="InterviewME home">
        InterviewME
      </Link>

      <div className="rivr-nav-links">
        {links.map((link) => {
          const isActive = !isLanding && pathname === link.href;

          return isLanding ? (
            <a key={link.name} href={link.href}>
              {link.name}
            </a>
          ) : (
            <Link
              key={link.name}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'is-active' : undefined}
            >
              {link.name}
            </Link>
          );
        })}
      </div>

      <Show when="signed-out">
        <button className="rivr-nav-cta" onClick={() => openSignIn({})} type="button">
          <span className="rivr-icon-pill">
            <ArrowIcon />
          </span>
          Sign In
        </button>
      </Show>

      <Show when="signed-in">
        <div className="rivr-nav-cta rivr-nav-user">
          <span className="rivr-user-avatar">
            <UserButton />
          </span>
          {!isLanding && (
            <button className="rivr-nav-interview" onClick={handleInterview} type="button">
              Interview
            </button>
          )}
        </div>
      </Show>
    </nav>
  );
};

export default Navbar;
