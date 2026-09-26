import { SignedIn, SignedOut, useClerk, UserButton } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const landingLinks = [
  { name: 'Platform', href: '#platform' },
  { name: 'Solutions', href: '#solutions' },
  { name: 'Resources', href: '#resources' },
  { name: 'Pricing', href: '#pricing' },
];

const appLinks = [
  { name: 'Home', href: '/home' },
  { name: 'Profile', href: '/home/profile' },
  { name: 'Pricing', href: '/home/pricing' },
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
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';
  const links = isLanding ? landingLinks : appLinks;

  const handleInterview = () => {
    navigate('/home/interview');
  };

  return (
    <nav className="rivr-nav" aria-label="Primary navigation">
      <Link className="rivr-logo" to={isLanding ? '/' : '/home'} aria-label="InterviewME home">
        InterviewME
      </Link>

      <div className="rivr-nav-links">
        {links.map((link) => {
          const isActive = !isLanding && location.pathname === link.href;

          return isLanding ? (
            <a key={link.name} href={link.href}>
              {link.name}
            </a>
          ) : (
            <Link
              key={link.name}
              to={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'is-active' : undefined}
            >
              {link.name}
            </Link>
          );
        })}
      </div>

      <SignedOut>
        <button className="rivr-nav-cta" onClick={() => openSignIn({})} type="button">
          <span className="rivr-icon-pill">
            <ArrowIcon />
          </span>
          Sign In
        </button>
      </SignedOut>

      <SignedIn>
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
      </SignedIn>
    </nav>
  );
};

export default Navbar;
